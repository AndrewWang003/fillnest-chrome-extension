import type { Messages } from "../../i18n/catalogue";
import { useMessages } from "../../i18n/useMessages";
import type { ComponentChildren } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";

import type { ActivationManagementSnapshot } from "../../activation/activation-authority";
import { siteIdentityFromUrl, type SiteIdentity } from "../../domain/site";
import { deriveFieldDisplayLabel, derivePageDisplayLabel } from "../../labels/display-label";
import { permissionOriginFromUrl } from "../../permissions/permission-origin";
import { buildPageIdentityKey } from "../../recognition/recognition-evidence";
import { CURRENT_SCHEMA_VERSION } from "../../storage/schema-version";
import type {
  DeleteTemplatesResult,
  FillNestState,
  RestoreTemplatesResult,
  TemplateRecord,
} from "../../storage/fillnest-repository";
import { isTemplateContentWithinLimit } from "../../templates/template-content";
import { derivePreview } from "../../templates/template-preview";
export { sendRequest } from "../shared/runtime-request";

// Re-exported so the Side Panel's many call sites keep one import path while
// the component itself is shared with the Popup.
export { ToggleSwitch } from "../shared/ToggleSwitch";

export function preview(content: string, messages: Messages): string {
  return derivePreview(content) || messages.emptyTemplate();
}

export interface CurrentTabContext {
  siteId: SiteIdentity;
  pageIdentityKey: string | null;
}

export async function getCurrentTabContext(): Promise<CurrentTabContext | null> {
  try {
    const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    const url = tabs[0]?.url;
    if (!url) return null;
    return { siteId: siteIdentityFromUrl(url), pageIdentityKey: buildPageIdentityKey(url) };
  } catch {
    return null;
  }
}

export function useCurrentTabContext(): CurrentTabContext | null | undefined {
  const [context, setContext] = useState<CurrentTabContext | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    function refresh(): void {
      void getCurrentTabContext().then((next) => {
        if (!cancelled) setContext(next);
      });
    }
    refresh();

    const handleTabEvent = () => refresh();
    const hasChrome = typeof chrome !== "undefined";
    if (hasChrome) {
      chrome.tabs?.onActivated?.addListener(handleTabEvent);
      chrome.tabs?.onUpdated?.addListener(handleTabEvent);
      chrome.windows?.onFocusChanged?.addListener(handleTabEvent);
    }

    return () => {
      cancelled = true;
      if (!hasChrome) return;
      chrome.tabs?.onActivated?.removeListener(handleTabEvent);
      chrome.tabs?.onUpdated?.removeListener(handleTabEvent);
      chrome.windows?.onFocusChanged?.removeListener(handleTabEvent);
    };
  }, []);

  return context;
}

/**
 * Requests transient, local recognition feedback from the active tab's
 * content script. A missing script or unsupported page is deliberately a
 * safe no-op: this must not interrupt Side Panel navigation.
 */
export async function highlightFieldInCurrentTab(fieldIdentityKey: string | null): Promise<void> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (tab?.id === undefined) return;
    await chrome.tabs.sendMessage(tab.id, { type: "HIGHLIGHT_SIDEPANEL_FIELD", fieldIdentityKey });
  } catch {
    // No active FillNest content script in this tab.
  }
}

export interface CurrentTabOrigin {
  origin: string;
  tabId: number | null;
  pageUrl: string;
}

// Distinct from useCurrentTabContext: that hook resolves the registrable
// Site, this one resolves the exact Permission Origin (scheme+host+port)
// needed to look up activation.origins entries. Returns null for a missing
// tab or a non-http(s) page (chrome://, extension pages, etc.).
export function useCurrentTabOrigin(): CurrentTabOrigin | null | undefined {
  const [origin, setOrigin] = useState<CurrentTabOrigin | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    function refresh(): void {
      if (typeof chrome === "undefined" || !chrome.tabs?.query) {
        setOrigin(null);
        return;
      }
      void chrome.tabs
        .query({ active: true, lastFocusedWindow: true })
        .then((tabs) => {
          if (cancelled) return;
          const tab = tabs[0];
          const url = tab?.url;
          if (!url) {
            setOrigin(null);
            return;
          }
          try {
            setOrigin({ origin: permissionOriginFromUrl(url).origin, tabId: tab.id ?? null, pageUrl: url });
          } catch {
            setOrigin(null);
          }
        })
        .catch(() => {
          if (!cancelled) setOrigin(null);
        });
    }
    refresh();

    const handleTabEvent = () => refresh();
    const hasChrome = typeof chrome !== "undefined";
    if (hasChrome) {
      chrome.tabs?.onActivated?.addListener(handleTabEvent);
      chrome.tabs?.onUpdated?.addListener(handleTabEvent);
      chrome.windows?.onFocusChanged?.addListener(handleTabEvent);
    }

    return () => {
      cancelled = true;
      if (!hasChrome) return;
      chrome.tabs?.onActivated?.removeListener(handleTabEvent);
      chrome.tabs?.onUpdated?.removeListener(handleTabEvent);
      chrome.windows?.onFocusChanged?.removeListener(handleTabEvent);
    };
  }, []);

  return origin;
}

export interface SidePanelNotification {
  message: string;
  detail?: string;
  action?: {
    label: string;
    description?: string;
    tone?: "default" | "danger";
    onClick(): void;
  };
}

// Shared feedback for actions that would otherwise close their confirmation
// sheet with no visible outcome (Remove access, Clear site data, Restore).
// Deliberately does not cover Save/Bind/Unbind/Delete - those already have
// durable, actionable feedback via the Undo bar. Task 010 makes the current
// result replaceable rather than timed: the next successful result replaces
// this one, and Task 011 presents it in the bottom-anchored result region.
export function useSidePanelNotifications(): {
  notification: SidePanelNotification | null;
  notify(message: string, detail?: string, action?: SidePanelNotification["action"]): void;
  clear(): void;
  clearRecoverable(): void;
} {
  const [notification, setNotification] = useState<SidePanelNotification | null>(null);
  const notificationRef = useRef<SidePanelNotification | null>(null);

  function notify(message: string, detail?: string, action?: SidePanelNotification["action"]): void {
    const next = { message, detail, action };
    notificationRef.current = next;
    setNotification(next);
  }

  function clear(): void {
    notificationRef.current = null;
    setNotification(null);
  }

  function clearRecoverable(): void {
    if (notificationRef.current?.action) clear();
  }

  return { notification, notify, clear, clearRecoverable };
}

export function NotificationBanner({
  notification,
  actionRef,
}: {
  notification: SidePanelNotification;
  // Let SidePanel reach the action button so it can recover focus when the
  // control the user pressed was removed by the action itself (Task 023
  // Addendum B5, finding 9).
  actionRef?: { current: HTMLButtonElement | null };
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div class="side-panel-notification">
      <button
        type="button"
        class="side-panel-notification-body"
        onClick={() => notification.detail && setExpanded((current) => !current)}
        aria-expanded={notification.detail ? expanded : undefined}
      >
        <span>{notification.message}</span>
        {notification.action?.description && <span class="side-panel-notification-action-description">{notification.action.description}</span>}
        {expanded && notification.detail && <span class="side-panel-notification-detail">{notification.detail}</span>}
      </button>
      {notification.action && (
        <button
          ref={actionRef}
          type="button"
          class={notification.action.tone === "danger" ? "side-panel-notification-action danger" : "side-panel-notification-action"}
          // "Undo" alone does not say what it would undo (Task 023 Addendum
          // B5, finding 11); reached by keyboard or focus recovery it is the
          // only thing the user hears.
          aria-label={`${notification.action.label}: ${notification.action.description ?? notification.message}`}
          onClick={notification.action.onClick}
        >
          {notification.action.label}
        </button>
      )}
    </div>
  );
}

export function rememberFocusedElement(): HTMLElement | null {
  return document.activeElement instanceof HTMLElement ? document.activeElement : null;
}

export function restoreFocus(element: HTMLElement | null): void {
  requestAnimationFrame(() => {
    if (element?.isConnected) element.focus();
  });
}

const FOCUSABLE_DIALOG_SELECTOR = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

export function ModalDialog({
  label,
  labelledBy,
  busy,
  onCancel,
  initialFocusRef,
  restoreFocusTo,
  children,
}: {
  label?: string;
  labelledBy?: string;
  busy: boolean;
  onCancel(): void;
  initialFocusRef?: { current: HTMLElement | null };
  restoreFocusTo: HTMLElement | null;
  children: ComponentChildren;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  function focusableControls(): HTMLElement[] {
    return [...(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_DIALOG_SELECTOR) ?? [])].filter(
      (element) => !element.hasAttribute("hidden") && element.getAttribute("aria-hidden") !== "true",
    );
  }

  useEffect(() => {
    const controls = focusableControls();
    const initial = initialFocusRef?.current ?? controls[controls.length - 1] ?? dialogRef.current;
    initial?.focus();
    // A ref object's identity is stable, so listing it does not change when
    // this runs; it only stops the rule from having to take that on trust.
  }, [initialFocusRef]);

  function cancel(): void {
    if (busy) return;
    onCancel();
    restoreFocus(restoreFocusTo);
  }

  function handleKeyDown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      if (!busy) {
        event.preventDefault();
        cancel();
      }
      return;
    }
    if (event.key !== "Tab") return;
    const controls = focusableControls();
    if (controls.length === 0) {
      event.preventDefault();
      dialogRef.current?.focus();
      return;
    }
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function handleClickCapture(event: MouseEvent): void {
    const target = event.target;
    if (!(target instanceof Element) || !target.closest("[data-dialog-cancel]")) return;
    event.preventDefault();
    event.stopPropagation();
    if (!busy) cancel();
  }

  return (
    <div class="clean-up-overlay">
      <div class="clean-up-backdrop" onClick={cancel} />
      <div
        ref={dialogRef}
        class="clean-up-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        aria-labelledby={labelledBy}
        tabIndex={-1}
        onKeyDown={(event) => handleKeyDown(event)}
        onClickCapture={(event) => handleClickCapture(event)}
      >
        {children}
      </div>
    </div>
  );
}


export function isBusinessState(value: unknown): value is FillNestState {
  return typeof value === "object" && value !== null && "schemaVersion" in value && value.schemaVersion === CURRENT_SCHEMA_VERSION && "templates" in value && Array.isArray(value.templates);
}

export function isEditContentSavable(editing: TemplateRecord, draft: string): boolean {
  // Task 035 (R8): the service worker refuses over-long content anyway; this
  // stops the user reaching that refusal with a Save they thought would work.
  return draft.trim().length > 0 && draft !== editing.content && isTemplateContentWithinLimit(draft);
}

export function isTemplateRecordShape(value: unknown): value is TemplateRecord {
  return typeof value === "object" && value !== null && "id" in value && "content" in value && "revision" in value;
}


export function isManagementSnapshot(value: unknown): value is ActivationManagementSnapshot {
  return typeof value === "object" && value !== null && "global" in value && "origins" in value && Array.isArray(value.origins);
}

export function isDeleteTemplatesResultShape(value: unknown): value is DeleteTemplatesResult {
  return typeof value === "object" && value !== null && "deletedTemplateIds" in value && Array.isArray((value).deletedTemplateIds);
}

export function isRestoreTemplatesResultShape(value: unknown): value is RestoreTemplatesResult {
  return typeof value === "object" && value !== null && "restored" in value && "failed" in value && Array.isArray((value as { failed: unknown }).failed);
}

export interface DeleteFlow {
  templateIds: string[];
  wholeLibrary: boolean;
  source: "selected" | "all";
}

export function computeDeletionImpact(
  templateIds: Set<string>,
  business: FillNestState,
  // Task 037: the derived half of a label is translated; a name the user typed
  // is not, which is why every line below reads `userAlias ?? derive(...)`.
  t: Messages,
): { bindingCount: number; siteLabels: string[]; pageLabels: string[]; fieldLabels: string[] } {
  const affectedBindings = business.bindings.filter((binding) => templateIds.has(binding.templateId));
  const siteLabels = new Set<string>();
  const pageLabels = new Set<string>();
  const fieldLabels = new Set<string>();
  for (const binding of affectedBindings) {
    const page = business.pageProfiles.find((candidate) => candidate.id === binding.pageProfileId);
    const field = business.fieldProfiles.find((candidate) => candidate.id === binding.fieldProfileId);
    if (page) {
      siteLabels.add(page.siteId);
      pageLabels.add(page.userAlias ?? derivePageDisplayLabel(page.identityKey, t));
    }
    if (field) fieldLabels.add(field.userAlias ?? deriveFieldDisplayLabel(field.identityKey, field.observedTitle, t));
  }

  // Task 026: a deleted Template can also be a Shared Template Set slot's
  // own base (affecting every member Field of that slot) or the target of a
  // Field's own Override (affecting just that one Field) - neither lives in
  // `business.bindings`, so the preview must count them explicitly or it
  // would understate the real deletion impact.
  const affectedSharedSlots = business.sharedTemplateBindings.filter((binding) => templateIds.has(binding.templateId));
  const affectedFieldProfileIds = new Set<string>();
  for (const slot of affectedSharedSlots) {
    // Task 027: a Field-only slot only ever affects its own owner, never
    // the rest of the Set - counting every member here would overstate the
    // real deletion impact for a relationship no one else can even see.
    if (slot.ownerFieldProfileId !== undefined) {
      affectedFieldProfileIds.add(slot.ownerFieldProfileId);
      continue;
    }
    const set = business.sharedTemplateSets.find((candidate) => candidate.id === slot.setId);
    for (const fieldProfileId of set?.memberFieldProfileIds ?? []) affectedFieldProfileIds.add(fieldProfileId);
  }
  for (const entry of business.sharedTemplateFieldStates) {
    if (entry.mode === "override" && entry.templateId && templateIds.has(entry.templateId)) {
      affectedFieldProfileIds.add(entry.fieldProfileId);
    }
  }
  for (const fieldProfileId of affectedFieldProfileIds) {
    const field = business.fieldProfiles.find((candidate) => candidate.id === fieldProfileId);
    if (!field) continue;
    const page = business.pageProfiles.find((candidate) => candidate.id === field.pageProfileId);
    if (page) {
      siteLabels.add(page.siteId);
      pageLabels.add(page.userAlias ?? derivePageDisplayLabel(page.identityKey, t));
    }
    fieldLabels.add(field.userAlias ?? deriveFieldDisplayLabel(field.identityKey, field.observedTitle, t));
  }

  return {
    bindingCount: affectedBindings.length + affectedFieldProfileIds.size,
    siteLabels: [...siteLabels].sort(),
    pageLabels: [...pageLabels].sort(),
    fieldLabels: [...fieldLabels].sort(),
  };
}

export function DeletionImpactPanel({
  business,
  deleteFlow,
  typedConfirmation,
  onTypedConfirmationChange,
  impactExpanded,
  onToggleImpactExpanded,
  onConfirm,
  onCancel,
  busy,
  restoreFocusTo,
}: {
  business: FillNestState;
  deleteFlow: DeleteFlow;
  typedConfirmation: string;
  onTypedConfirmationChange(value: string): void;
  impactExpanded: boolean;
  onToggleImpactExpanded(): void;
  onConfirm(): void;
  onCancel(): void;
  busy: boolean;
  restoreFocusTo: HTMLElement | null;
}) {
  const t = useMessages();
  const typedConfirmationRef = useRef<HTMLInputElement>(null);
  const impact = useMemo(
    () => computeDeletionImpact(new Set(deleteFlow.templateIds), business, t),
    [deleteFlow.templateIds, business, t],
  );
  const count = deleteFlow.templateIds.length;
  const canConfirm = deleteFlow.wholeLibrary ? typedConfirmation === "delete" : true;
  return (
    <ModalDialog
      label={t.deleteTemplatesDialog()}
      busy={busy}
      onCancel={onCancel}
      initialFocusRef={deleteFlow.wholeLibrary ? typedConfirmationRef : undefined}
      restoreFocusTo={restoreFocusTo}
    >
      <div class="batch-delete-confirm">
      <p>
        {t.deleteTemplatesEverywhereQuestion(count)}
        {deleteFlow.wholeLibrary && ` ${t.removesWholeLibrary()}`}
      </p>
      <button type="button" class="secondary" onClick={onToggleImpactExpanded}>
        {t.affectedLocationsToggle(impactExpanded, impact.bindingCount)}
      </button>
      {impactExpanded && (
        <div class="impact-detail">
          <p>{t.impactSites(impact.siteLabels.length > 0 ? impact.siteLabels.join(", ") : t.noneListed())}</p>
          <p>{t.impactPages(impact.pageLabels.length > 0 ? impact.pageLabels.join(", ") : t.noneListed())}</p>
          <p>{t.impactFields(impact.fieldLabels.length > 0 ? impact.fieldLabels.join(", ") : t.noneListed())}</p>
        </div>
      )}
      {deleteFlow.wholeLibrary && (
        <label class="search">
          <span>{t.typeDeleteToConfirm()}</span>
          <input
            ref={typedConfirmationRef}
            aria-label={t.typeDeleteToConfirm()}
            value={typedConfirmation}
            onInput={(event) => onTypedConfirmationChange(event.currentTarget.value)}
          />
        </label>
      )}
      <div class="confirm-actions">
        <button type="button" class="danger" disabled={busy || !canConfirm} onClick={onConfirm}>
          {t.deleteAction()}
        </button>
        <button type="button" class="secondary" data-dialog-cancel onClick={onCancel} disabled={busy}>
          {t.cancel()}
        </button>
      </div>
      </div>
    </ModalDialog>
  );
}
