import type { Messages } from "../../i18n/catalogue";
import { useMessages } from "../../i18n/useMessages";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";

import type { ActivationManagementSnapshot } from "../../activation/activation-authority";
import type { SiteIdentity } from "../../domain/site";
import {
  buildSiteProjections,
  countTemplatesForSite,
  computeResetSiteMappingsImpact,
} from "../../sites/site-projection";
import type {
  FillNestState,
  LogicalPageRuleRecord,
  ResetSiteMappingsExpectedImpact,
  TemplateRecord,
} from "../../storage/fillnest-repository";
import {
  ModalDialog,
  rememberFocusedElement,
  type SidePanelNotification,
  sendRequest,
  ToggleSwitch,
  useCurrentTabContext,
} from "./SidePanelShared";
import { PageNote, useFirstUseTips } from "../shared/FirstUseTips";
import { useNewlyGlobalDeletion } from "./newly-global-deletion";
import { TreeNodeRow } from "./TemplatesPage";

export type SiteStatusFacet = "active" | "paused";

// Labels come from `statusFilterLabel`, in the reader's language.
export const SITE_STATUS_FILTERS: ReadonlyArray<SiteStatusFacet | ""> = ["", "active", "paused"];

function statusFilterLabel(value: SiteStatusFacet | "", messages: Messages): string {
  if (value === "active") return messages.globalActive();
  if (value === "paused") return messages.globalPaused();
  return messages.statusAll();
}

export const ADDRESSES_PAGE_SIZE = 10;

export type SitesView = "groups" | "flat";

export interface AddressRow {
  origin: string;
  siteId: SiteIdentity;
  mode: SiteStatusFacet;
  isCurrentTab: boolean;
}

export interface SiteGroup {
  siteId: SiteIdentity;
  matches: AddressRow[];
}

export interface RemoveAccessFlow {
  origins: string[];
  siteIds: SiteIdentity[];
  impacts: Array<ResetSiteMappingsExpectedImpact & { siteId: SiteIdentity }>;
}

export interface ClearMappingsFlow {
  impacts: Array<ResetSiteMappingsExpectedImpact & { siteId: SiteIdentity }>;
}

export interface StopMatchingFlow {
  ruleId: string;
  origin: string;
  routePattern: string;
}

function isResetSiteMappingsResult(value: unknown): value is { newlyGlobalTemplates: TemplateRecord[] } {
  return typeof value === "object" && value !== null && "newlyGlobalTemplates" in value &&
    Array.isArray((value).newlyGlobalTemplates);
}

export function siteTemplateCount(business: FillNestState, siteId: SiteIdentity): number {
  return countTemplatesForSite(business.templates, siteId);
}

/**
 * Website Access remains separate and reversible. Clear site data is the one
 * explicit Site action that removes the selected Site's Template filing
 * relationship; it never deletes a Template until the user chooses the
 * ordinary delete follow-up for the exact newly-Global set.
 */
export function SitesPage({
  business,
  activation,
  onOrigin,
  onRefresh,
  onError,
  onOpenTemplatesForSite,
  onNotify,
}: {
  business: FillNestState;
  activation: ActivationManagementSnapshot;
  onOrigin(origin: string, mode: "active" | "paused"): Promise<void>;
  onRefresh(): Promise<void>;
  onError(message: string): void;
  onOpenTemplatesForSite(siteId: SiteIdentity | null): void;
  onNotify(message: string, detail?: string, action?: SidePanelNotification["action"]): void;
}) {
  const t = useMessages();
  const projections = useMemo(() => buildSiteProjections(business, activation), [business, activation]);
  const currentTabContext = useCurrentTabContext();

  const [view, setView] = useState<SitesView>("groups");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<SiteStatusFacet | "">("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [removeFlow, setRemoveFlow] = useState<RemoveAccessFlow | null>(null);
  const [clearFlow, setClearFlow] = useState<ClearMappingsFlow | null>(null);
  const [stopMatchingFlow, setStopMatchingFlow] = useState<StopMatchingFlow | null>(null);
  const [confirming, setConfirming] = useState(false);
  const confirmingRef = useRef(false);
  const [expandedOrigin, setExpandedOrigin] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<SiteIdentity>>(new Set());
  const groupsInitialized = useRef(false);
  const confirmationTriggerRef = useRef<HTMLElement | null>(null);
  const newlyGlobalDeletion = useNewlyGlobalDeletion({ business, onRefresh, onError, onNotify });
  const tips = useFirstUseTips();

  const normalizedSearch = searchQuery.trim().toLocaleLowerCase();

  const orderedProjections = useMemo(() => {
    if (!currentTabContext) return projections;
    const index = projections.findIndex((site) => site.siteId === currentTabContext.siteId);
    if (index <= 0) return projections;
    const reordered = [...projections];
    const [current] = reordered.splice(index, 1);
    if (!current) return projections;
    reordered.unshift(current);
    return reordered;
  }, [projections, currentTabContext]);

  const orderedSites = useMemo(
    () => orderedProjections.filter((site) => site.origins.length > 0),
    [orderedProjections],
  );

  useEffect(() => {
    if (groupsInitialized.current) return;
    if (projections.length === 0) return;
    if (currentTabContext === undefined) return;
    groupsInitialized.current = true;
    if (currentTabContext && projections.some((site) => site.siteId === currentTabContext.siteId)) {
      setExpandedGroups(new Set([currentTabContext.siteId]));
    }
  }, [projections, currentTabContext]);

  const allRows = useMemo<AddressRow[]>(
    () =>
      orderedSites.flatMap((site) =>
        site.origins.map((origin) => ({
          origin: origin.origin,
          siteId: site.siteId,
          mode: origin.originActivation === "paused" ? ("paused" as const) : ("active" as const),
          isCurrentTab: currentTabContext?.siteId === site.siteId,
        })),
      ),
    [orderedSites, currentTabContext],
  );

  const rows = useMemo(
    () =>
      allRows.filter((row) => {
        if (statusFilter && row.mode !== statusFilter) return false;
        if (normalizedSearch.length === 0) return true;
        return (
          row.origin.toLocaleLowerCase().includes(normalizedSearch) ||
          row.siteId.toLocaleLowerCase().includes(normalizedSearch)
        );
      }),
    [allRows, statusFilter, normalizedSearch],
  );

  const totalPages = Math.max(1, Math.ceil(rows.length / ADDRESSES_PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages - 1);
  const pageRows = rows.slice(
    clampedPage * ADDRESSES_PAGE_SIZE,
    clampedPage * ADDRESSES_PAGE_SIZE + ADDRESSES_PAGE_SIZE,
  );

  useEffect(() => {
    setPage(0);
  }, [normalizedSearch, statusFilter]);

  const rowsBySite = useMemo(() => {
    const map = new Map<SiteIdentity, AddressRow[]>();
    for (const row of rows) {
      const list = map.get(row.siteId) ?? [];
      list.push(row);
      map.set(row.siteId, list);
    }
    return map;
  }, [rows]);

  const groupedSites = useMemo<SiteGroup[]>(() => {
    const groups: SiteGroup[] = [];
    for (const site of orderedSites) {
      const matches = rowsBySite.get(site.siteId) ?? [];
      if (matches.length === 0) continue;
      groups.push({ siteId: site.siteId, matches });
    }
    const order = new Map(orderedProjections.map((site, index) => [site.siteId, index] as const));
    return groups.sort((a, b) => (order.get(a.siteId) ?? 0) - (order.get(b.siteId) ?? 0));
  }, [orderedSites, orderedProjections, rowsBySite]);

  const rowByOrigin = useMemo(() => new Map(allRows.map((row) => [row.origin, row] as const)), [allRows]);

  const rulesBySite = useMemo(() => {
    const map = new Map<SiteIdentity, LogicalPageRuleRecord[]>();
    for (const rule of business.logicalPageRules) {
      const list = map.get(rule.siteId) ?? [];
      list.push(rule);
      map.set(rule.siteId, list);
    }
    return map;
  }, [business.logicalPageRules]);

  const scope = useMemo(() => {
    if (view === "flat") return rows.map((row) => row.origin);
    // The toolbar acts on the current filtered address result. Group collapse
    // is visual disclosure only; it must not make Select all unusable on the
    // first visit.
    return groupedSites.flatMap((group) => group.matches.map((row) => row.origin));
  }, [view, rows, groupedSites]);

  const selectedVisible = useMemo(
    () => scope.filter((origin) => selected.has(origin)),
    [scope, selected],
  );
  const allSelected = scope.length > 0 && selectedVisible.length === scope.length;

  const selectedSiteIds = useMemo(() => {
    const ids = new Set<SiteIdentity>();
    for (const origin of scope) {
      if (!selected.has(origin)) continue;
      const row = rowByOrigin.get(origin);
      if (row) ids.add(row.siteId);
    }
    return [...ids];
  }, [scope, selected, rowByOrigin]);

  function toggleAll(): void {
    setSelected((current) => {
      const next = new Set(current);
      if (allSelected) for (const origin of scope) next.delete(origin);
      else for (const origin of scope) next.add(origin);
      return next;
    });
  }

  function toggleGroup(siteId: SiteIdentity): void {
    setExpandedGroups((current) => {
      const next = new Set(current);
      if (next.has(siteId)) next.delete(siteId);
      else next.add(siteId);
      return next;
    });
  }

  function toggleOne(origin: string): void {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(origin)) next.delete(origin);
      else next.add(origin);
      return next;
    });
  }

  function beginClearSiteData(impacts: ClearMappingsFlow["impacts"]): void {
    confirmationTriggerRef.current = rememberFocusedElement();
    setClearFlow({ impacts });
  }

  function beginRemoveAccess(flow: RemoveAccessFlow): void {
    confirmationTriggerRef.current = rememberFocusedElement();
    setRemoveFlow(flow);
  }

  function beginStopMatching(rule: LogicalPageRuleRecord): void {
    confirmationTriggerRef.current = rememberFocusedElement();
    setStopMatchingFlow({ ruleId: rule.id, origin: rule.origin, routePattern: rule.routePattern });
  }

  function restoreConfirmationFocus(): void {
    const trigger = confirmationTriggerRef.current;
    confirmationTriggerRef.current = null;
    requestAnimationFrame(() => {
      const fallback = document.querySelector<HTMLElement>("[aria-label='Select all addresses']")
        ?? document.querySelector<HTMLElement>("nav[aria-label='FillNest sections'] button[aria-current='page']");
      (trigger?.isConnected ? trigger : fallback)?.focus();
    });
  }

  function runConfirmation(action: () => Promise<unknown>): void {
    if (confirmingRef.current) return;
    confirmingRef.current = true;
    setConfirming(true);
    void action().finally(() => {
      confirmingRef.current = false;
      setConfirming(false);
    });
  }

  async function confirmStopMatching(): Promise<void> {
    if (!stopMatchingFlow) return;
    const response = await sendRequest({ type: "STOP_LOGICAL_PAGE_MATCHING", ruleId: stopMatchingFlow.ruleId });
    if (!response.ok) {
      onError(response.error);
      return;
    }
    const { origin, routePattern } = stopMatchingFlow;
    setStopMatchingFlow(null);
    await onRefresh();
    restoreConfirmationFocus();
    onNotify(t.stoppedMatching(origin, routePattern));
  }

  async function confirmRemoveAccess(): Promise<void> {
    if (!removeFlow) return;
    const response = await sendRequest({ type: "REMOVE_SITE", origins: removeFlow.origins, sites: removeFlow.impacts.map(({ siteId, ...expectedImpact }) => ({ siteId, expectedImpact })) });
    if (!response.ok) {
      onError(response.error);
      return;
    }
    if (!isResetSiteMappingsResult(response.value) || !("removedOrigins" in response.value) || !Array.isArray(response.value.removedOrigins)) {
      onError(t.invalidResult());
      return;
    }
    const removed = new Set(response.value.removedOrigins);
    const failed = removeFlow.origins.filter((origin) => !removed.has(origin));
    if (failed.length > 0) {
      setRemoveFlow(null);
      setSelected(new Set(failed));
      await onRefresh();
      onError(
        t.addressesNotRemoved(failed.length),
      );
      return;
    }
    const removedCount = removeFlow.origins.length;
    setRemoveFlow(null);
    setSelected(new Set());
    await onRefresh();
    restoreConfirmationFocus();
    const newlyGlobalTemplates = response.value.newlyGlobalTemplates;
    onNotify(
      t.removedAccessAndData(removedCount),
      undefined,
      newlyGlobalTemplates.length > 0 ? {
        label: t.deleteAction(),
        description: t.templatesNowGlobal(newlyGlobalTemplates.length),
        tone: "danger",
        onClick: () => newlyGlobalDeletion.request(newlyGlobalTemplates),
      } : undefined,
    );
  }

  async function confirmClearMappings(): Promise<void> {
    if (!clearFlow) return;
    const response = await sendRequest({
      type: "RESET_SITE_MAPPINGS_BATCH",
      sites: clearFlow.impacts.map(({ siteId, ...expectedImpact }) => ({ siteId, expectedImpact })),
    });
    if (!response.ok) {
      onError(response.error);
      return;
    }
    if (!isResetSiteMappingsResult(response.value)) {
      onError(t.invalidResult());
      return;
    }
    const siteIds = clearFlow.impacts.map((impact) => impact.siteId);
    const newlyGlobalTemplates = response.value.newlyGlobalTemplates;
    setClearFlow(null);
    setSelected(new Set());
    await onRefresh();
    restoreConfirmationFocus();
    onNotify(
      t.clearedSiteData(siteIds.length),
      newlyGlobalTemplates.length > 0
        ? siteIds.join(", ")
        : siteIds.join(", "),
      newlyGlobalTemplates.length > 0
        ? {
            label: t.deleteAction(),
            description: t.templatesNowGlobal(newlyGlobalTemplates.length),
            tone: "danger",
            onClick: () => newlyGlobalDeletion.request(newlyGlobalTemplates),
          }
        : undefined,
    );
  }

  const toolbarLabel =
    selectedVisible.length > 0 ? t.selectedOfTotal(selectedVisible.length, scope.length) : t.selectAllFilteredAddresses();

  // A confirmed Rule belongs to a Site, not to one address, so both views
  // reach the same row: nested under its Site in the by-site view, and in a
  // Site-labelled section of its own in the flat address view, which has no
  // Site grouping to nest into.
  function renderRuleRow(rule: LogicalPageRuleRecord) {
    return (
      <div key={rule.id} class="logical-page-rule-row">
        <span class="logical-page-rule-label">
          {rule.origin}
          {rule.routePattern}
        </span>
        <button type="button" class="secondary" onClick={() => beginStopMatching(rule)}>
          {t.stopMatching()}
        </button>
      </div>
    );
  }

  function renderAddressRow(row: AddressRow) {
    const isExpanded = expandedOrigin === row.origin;
    return (
      <div key={row.origin} class={row.isCurrentTab ? "address-row current" : "address-row"}>
        <input
          type="checkbox"
          aria-label={t.selectOrigin(row.origin)}
          checked={selected.has(row.origin)}
          onChange={() => toggleOne(row.origin)}
        />
        <button
          type="button"
          class={isExpanded ? "address-origin expanded" : "address-origin"}
          aria-expanded={isExpanded}
          aria-label={t.expandOrCollapseOrigin(isExpanded, row.origin)}
          onClick={() => setExpandedOrigin((current) => (current === row.origin ? null : row.origin))}
        >
          {row.origin}
        </button>
        <ToggleSwitch
          compact
          id={`address-mode-${row.origin}`}
          label={row.mode === "active" ? t.globalActive() : t.globalPaused()}
          ariaLabel={t.originAccess(row.origin)}
          checked={row.mode === "active"}
          disabled={activation.global === "paused"}
          onChange={() => void onOrigin(row.origin, row.mode === "active" ? "paused" : "active")}
        />
      </div>
    );
  }

  return (
    <>
      <div class="field-first-header">
        <h1>{t.sitesHeading()}</h1>
        <span class="field-first-count">{allRows.length}</span>
      </div>
      <p class="sites-lead">{t.sitesLead()}</p>
      {tips.shows("sites") && <PageNote text={t.noteSites()} onDismiss={() => tips.dismiss("sites")} />}

      <div class="filter-toggle-row" aria-label={t.sitesView()}>
        <button
          type="button"
          class={view === "groups" ? "filter-toggle selected" : "filter-toggle"}
          aria-pressed={view === "groups"}
          onClick={() => setView("groups")}
        >
          {t.bySite()}
        </button>
        <button
          type="button"
          class={view === "flat" ? "filter-toggle selected" : "filter-toggle"}
          aria-pressed={view === "flat"}
          onClick={() => setView("flat")}
        >
          {t.allAddresses()}
        </button>
      </div>

      <div class="sites-filter-row">
        <label class="search">
          <span>{t.search()}</span>
          <input
            aria-label={t.searchAddresses()}
            type="search"
            placeholder={t.search()}
            value={searchQuery}
            onInput={(event) => setSearchQuery(event.currentTarget.value)}
          />
        </label>
        <label class="sites-status-filter">
          <span>{t.statusLabel()}</span>
          <select
            aria-label={t.filterAddressesByStatus()}
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.currentTarget.value as SiteStatusFacet | "")}
          >
            {SITE_STATUS_FILTERS.map((value) => (
              <option value={value}>{statusFilterLabel(value, t)}</option>
            ))}
          </select>
        </label>
      </div>

      <div class="address-toolbar">
        <label class="address-toolbar-select">
          <input
            type="checkbox"
            aria-label={t.selectAllAddresses()}
            checked={allSelected}
            disabled={scope.length === 0}
            onChange={toggleAll}
          />
          <span>{toolbarLabel}</span>
        </label>
        {selectedVisible.length > 0 && (
          <span class="address-toolbar-actions">
            <button
              type="button"
              class="secondary"
              onClick={() =>
                beginClearSiteData(
                  selectedSiteIds.map((siteId) => ({
                    ...computeResetSiteMappingsImpact(business, siteId),
                    siteId,
                  })),
                )
              }
            >
              {t.clearSiteData()}
            </button>
            <button
              type="button"
              class="danger"
              onClick={() => beginRemoveAccess({ origins: selectedVisible, siteIds: selectedSiteIds, impacts: selectedSiteIds.map((siteId) => ({ ...computeResetSiteMappingsImpact(business, siteId), siteId })) })}
            >
              {t.removeSite()}
            </button>
          </span>
        )}
      </div>

      {view === "groups" && (
        <ul class="site-groups" aria-label={t.sitesByWebsiteGroup()}>
          {groupedSites.map((group) => {
            const isOpen = expandedGroups.has(group.siteId);
            const templates = siteTemplateCount(business, group.siteId);
            return (
              <li key={group.siteId}>
                <TreeNodeRow
                  depth={0}
                  expanded={isOpen}
                  onToggle={() => toggleGroup(group.siteId)}
                  count={group.matches.length}
                >
                  <span class="node-label-group">
                    <span class="node-label">{group.siteId}</span>
                  </span>
                </TreeNodeRow>
                {isOpen && (
                  <div class="group-children">
                    {group.matches.length > 0 ? (
                      group.matches.map((row) => renderAddressRow(row))
                    ) : null}
                    {(rulesBySite.get(group.siteId) ?? []).length > 0 && (
                      <div class="logical-page-rules">
                        {(rulesBySite.get(group.siteId) ?? []).map((rule) => renderRuleRow(rule))}
                      </div>
                    )}
                    <div class="group-footer">
                      {templates > 0 && (
                        <button
                          type="button"
                          class="group-templates-link"
                          onClick={() => onOpenTemplatesForSite(group.siteId)}
                        >
                          {t.siteTemplatesLink(templates)}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
          {groupedSites.length === 0 && <p>{t.noSitesMatch()}</p>}
        </ul>
      )}

      {view === "flat" && (
        <>
          <div class="address-list">
            {pageRows.map((row) => renderAddressRow(row))}
            {rows.length === 0 && (
              <p>{t.noAddressesMatch()}</p>
            )}
          </div>

          {business.logicalPageRules.length > 0 && (
            <section class="flat-rules" aria-label={t.logicalPageMatchingRules()}>
              <h2 class="flat-rules-heading">{t.logicalPageMatching()}</h2>
              <div class="logical-page-rules">
                {business.logicalPageRules.map((rule) => renderRuleRow(rule))}
              </div>
            </section>
          )}

          {rows.length > ADDRESSES_PAGE_SIZE && (
            <div class="sites-pagination">
              <span>
                {t.addressRange(
                  clampedPage * ADDRESSES_PAGE_SIZE + 1,
                  Math.min(rows.length, (clampedPage + 1) * ADDRESSES_PAGE_SIZE),
                  rows.length,
                )}
              </span>
              <span class="sites-pagination-buttons">
                <button
                  type="button"
                  class="pagination-arrow"
                  aria-label={t.previousPage()}
                  disabled={clampedPage === 0}
                  onClick={() => setPage((current) => Math.max(0, current - 1))}
                >
                  ‹
                </button>
                <button
                  type="button"
                  class="pagination-arrow"
                  aria-label={t.nextPage()}
                  disabled={clampedPage >= totalPages - 1}
                  onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))}
                >
                  ›
                </button>
              </span>
            </div>
          )}

        </>
      )}

      {removeFlow && (
        <RemoveAccessSheet
          business={business}
          flow={removeFlow}
          onConfirm={() => runConfirmation(confirmRemoveAccess)}
          onCancel={() => setRemoveFlow(null)}
          onOpenTemplatesForSite={onOpenTemplatesForSite}
          busy={confirming}
          restoreFocusTo={confirmationTriggerRef.current}
        />
      )}

      {clearFlow && (
        <ClearMappingsSheet
          business={business}
          flow={clearFlow}
          onConfirm={() => runConfirmation(confirmClearMappings)}
          onCancel={() => setClearFlow(null)}
          busy={confirming}
          restoreFocusTo={confirmationTriggerRef.current}
        />
      )}
      {stopMatchingFlow && (
        <StopMatchingSheet
          flow={stopMatchingFlow}
          onConfirm={() => runConfirmation(confirmStopMatching)}
          onCancel={() => setStopMatchingFlow(null)}
          busy={confirming}
          restoreFocusTo={confirmationTriggerRef.current}
        />
      )}
      {newlyGlobalDeletion.sheet}
    </>
  );
}

export function RemoveAccessSheet({
  business,
  flow,
  onConfirm,
  onCancel,
  onOpenTemplatesForSite,
  busy,
  restoreFocusTo,
}: {
  business: FillNestState;
  flow: RemoveAccessFlow;
  onConfirm(): void;
  onCancel(): void;
  onOpenTemplatesForSite(siteId: SiteIdentity | null): void;
  busy: boolean;
  restoreFocusTo: HTMLElement | null;
}) {
  const t = useMessages();
  const singleSiteId = flow.siteIds.length === 1 ? flow.siteIds[0] ?? null : null;
  const templates = singleSiteId ? siteTemplateCount(business, singleSiteId) : 0;
  const named = singleSiteId !== null && templates > 0;

  return (
    <ModalDialog label={t.removeSite()} busy={busy} onCancel={onCancel} restoreFocusTo={restoreFocusTo}>
        <span class="clean-up-grabber" aria-hidden="true" />
        <strong class="clean-up-title">
          {t.removeSitesQuestion(flow.siteIds.length)}
        </strong>
        <ul class="remove-sheet-origins">
          {flow.origins.map((origin) => (
            <li key={origin}>{origin}</li>
          ))}
        </ul>
        <p class="remove-sheet-body">
          {t.removeSiteWarning()}
        </p>
        <p class="remove-sheet-note">
          {t.templatesBecomeGlobal()}
        </p>
        <button
          type="button"
          class="remove-sheet-link"
          onClick={() => onOpenTemplatesForSite(named ? singleSiteId : null)}
        >
          {named ? t.viewAffectedTemplates(templates) : t.openTemplatesLink()}
        </button>
        <div class="confirm-actions">
          <button type="button" class="danger" onClick={onConfirm}>
            {t.removeSite()}
          </button>
          <button type="button" class="secondary" data-dialog-cancel onClick={onCancel}>
            {t.cancel()}
          </button>
        </div>
    </ModalDialog>
  );
}

export function StopMatchingSheet({
  flow,
  onConfirm,
  onCancel,
  busy,
  restoreFocusTo,
}: {
  flow: StopMatchingFlow;
  onConfirm(): void;
  onCancel(): void;
  busy: boolean;
  restoreFocusTo: HTMLElement | null;
}) {
  const t = useMessages();
  return (
    <ModalDialog label={t.stopMatching()} busy={busy} onCancel={onCancel} restoreFocusTo={restoreFocusTo}>
        <span class="clean-up-grabber" aria-hidden="true" />
        <strong class="clean-up-title">{t.stopMatchingQuestion()}</strong>
        <ul class="remove-sheet-origins">
          <li>
            {flow.origin}
            {flow.routePattern}
          </li>
        </ul>
        <p class="remove-sheet-body">
          {t.stopMatchingExplanation()}
        </p>
        <div class="confirm-actions">
          <button type="button" onClick={onConfirm}>
            {t.stopMatching()}
          </button>
          <button type="button" class="secondary" data-dialog-cancel onClick={onCancel}>
            {t.cancel()}
          </button>
        </div>
    </ModalDialog>
  );
}

export function ClearMappingsSheet({
  flow,
  onConfirm,
  onCancel,
  busy,
  restoreFocusTo,
}: {
  business: FillNestState;
  flow: ClearMappingsFlow;
  onConfirm(): void;
  onCancel(): void;
  busy: boolean;
  restoreFocusTo: HTMLElement | null;
}) {
  const t = useMessages();
  const total = flow.impacts.reduce(
    (sum, impact) => ({
      pageProfileCount: sum.pageProfileCount + impact.pageProfileCount,
      fieldProfileCount: sum.fieldProfileCount + impact.fieldProfileCount,
      bindingCount: sum.bindingCount + impact.bindingCount,
      pageAliasCount: sum.pageAliasCount + impact.pageAliasCount,
      fieldAliasCount: sum.fieldAliasCount + impact.fieldAliasCount,
      templateAffinityCount: sum.templateAffinityCount + impact.templateAffinityCount,
      logicalPageRuleCount: sum.logicalPageRuleCount + impact.logicalPageRuleCount,
      sharedTemplateSetCount: sum.sharedTemplateSetCount + impact.sharedTemplateSetCount,
    }),
    {
      pageProfileCount: 0,
      fieldProfileCount: 0,
      bindingCount: 0,
      pageAliasCount: 0,
      fieldAliasCount: 0,
      templateAffinityCount: 0,
      logicalPageRuleCount: 0,
      sharedTemplateSetCount: 0,
    },
  );
  const siteIds = flow.impacts.map((impact) => impact.siteId);
  const siteList = siteIds.join(", ");

  return (
    <ModalDialog label={t.clearSiteData()} busy={busy} onCancel={onCancel} restoreFocusTo={restoreFocusTo}>
        <span class="clean-up-grabber" aria-hidden="true" />
        <strong class="clean-up-title">
          {t.clearSiteDataQuestion(siteIds.length)}
        </strong>
        <ul class="remove-sheet-origins">
          {siteIds.map((siteId) => (
            <li key={siteId}>{siteId}</li>
          ))}
        </ul>
        <p class="remove-sheet-body">
          {t.clearSiteDataBody(
            total.pageProfileCount,
            total.fieldProfileCount,
            total.bindingCount,
            total.pageAliasCount,
            total.fieldAliasCount,
          )}
        </p>
        {total.logicalPageRuleCount > 0 && (
          <p class="remove-sheet-note">
            {t.clearSiteDataStopsRules(total.logicalPageRuleCount)}
          </p>
        )}
        {total.sharedTemplateSetCount > 0 && (
          <p class="remove-sheet-note">
            {t.clearSiteDataLeavesSets(total.sharedTemplateSetCount)}
          </p>
        )}
        <p class="remove-sheet-note">
          {t.clearSiteDataAffinities(total.templateAffinityCount, siteList)}
        </p>
        <div class="confirm-actions">
          <button type="button" class="danger" onClick={onConfirm}>
            {t.confirm()}
          </button>
          <button type="button" class="secondary" data-dialog-cancel onClick={onCancel}>
            {t.cancel()}
          </button>
        </div>
    </ModalDialog>
  );
}
