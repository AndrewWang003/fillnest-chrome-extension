import { useEffect, useRef, useState } from "preact/hooks";

import type { ActivationManagementSnapshot } from "../../activation/activation-authority";
import type { SiteIdentity } from "../../domain/site";
import { buildSiteProjections } from "../../sites/site-projection";
import type { FillNestState } from "../../storage/fillnest-repository";
import { type ActivationPage, CurrentWebsiteAccess } from "../shared/CurrentWebsiteAccess";
import { useDocumentLanguage, useMessages, type Messages } from "../../i18n/useMessages";
import { useAppearance } from "../theme/useAppearance";
import { useWebsiteAccessRequest } from "../shared/website-access-request";
import { SettingsPage } from "./SettingsPage";
import {
  isBusinessState,
  isManagementSnapshot,
  NotificationBanner,
  sendRequest,
  useCurrentTabOrigin,
  useSidePanelNotifications,
} from "./SidePanelShared";
import { SitesPage } from "./SitesPage";
import { FEEDBACK_EMAIL_ADDRESS } from "../../support/feedback";
import { BrandIcon, SettingsIcon } from "../icons/FillNestIcons";
import { TemplatesPage, sidePanelUndoLabel, performUndo } from "./TemplatesPage";
import type { SidePanelLastAction } from "./TemplatesPage";

export type Destination = "Overview" | "Templates" | "Sites" | "Settings";

export function SidePanel() {
  const t = useMessages();
  useDocumentLanguage();
  // Paints this surface and keeps it painted: the stored theme, another
  // surface changing it, and the OS flipping light/dark under `system`.
  const appearance = useAppearance();
  const [destination, setDestination] = useState<Destination>("Overview");
  const [business, setBusiness] = useState<FillNestState | null>(null);
  const [activation, setActivation] = useState<ActivationManagementSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Task 006 Addendum B: a failed Restore keeps FillNest closed. Held as a
  // flag rather than read from `error`, so the message follows a language
  // change made while closed and Settings can offer only what still works.
  const [recoveryBlocked, setRecoveryBlocked] = useState(false);
  // Set by the Sites page's remove-access sheet to hand the user straight to
  // that Site's Templates. Held here rather than pushed through a runtime
  // message: it is pure UI navigation state, never persisted.
  const [pendingSiteFilter, setPendingSiteFilter] = useState<SiteIdentity | null>(null);
  const { notification, notify: showNotification, clearRecoverable } = useSidePanelNotifications();

  // Undo state lifted from TemplatesPage (Task 011) so results survive
  // destination changes. TemplatesPage calls onLastAction to set it; SidePanel
  // renders the label and Undo button in the global result region.
  const [lastAction, setLastAction] = useState<SidePanelLastAction | null>(null);

  function notify(message: string, detail?: string, action?: Parameters<typeof showNotification>[2]): void {
    // One later successful Side Panel operation replaces an earlier recoverable
    // result, rather than leaving a stale Undo ahead of the newer outcome.
    setLastAction(null);
    showNotification(message, detail, action);
  }

  function openTemplatesForSite(siteId: SiteIdentity | null): void {
    setPendingSiteFilter(siteId);
    setDestination("Templates");
  }

  // `refresh` runs from a listener registered once (below), so it reads the
  // current language through a ref rather than closing over one render's.
  const latestMessages = useRef(t);
  latestMessages.current = t;

  async function refresh(): Promise<void> {
    const [businessResponse, activationResponse] = await Promise.all([
      sendRequest({ type: "READ_STATE" }),
      sendRequest({ type: "GET_ACTIVATION_MANAGEMENT" }),
    ]);
    if (!businessResponse.ok) {
      setRecoveryBlocked(businessResponse.errorCode === "restore-recovery-blocked");
      setError(businessResponse.error);
      return;
    }
    if (!activationResponse.ok) {
      setError(activationResponse.error);
      return;
    }
    if (!isBusinessState(businessResponse.value) || !isManagementSnapshot(activationResponse.value)) {
      setError(latestMessages.current.invalidResult());
      return;
    }
    setBusiness(businessResponse.value);
    setActivation(activationResponse.value);
    setRecoveryBlocked(false);
    setError(null);
  }

  // The listener below is registered once for the panel's lifetime, but
  // `clearRecoverable` comes from a hook and is a new function each render.
  // Depending on it would tear the listener down and re-register it on every
  // render; a ref keeps one registration while always calling the current one.
  const latestClearRecoverable = useRef(clearRecoverable);
  latestClearRecoverable.current = clearRecoverable;

  useEffect(() => {
    void refresh();
    const handleChange = (message: unknown) => {
      if (
        typeof message === "object" &&
        message !== null &&
        "type" in message &&
        (message.type === "ACTIVATION_STATE_CHANGED" || message.type === "BUSINESS_STATE_CHANGED")
      ) {
        // A background state change silently invalidates any pending Undo per
        // Task 010's established global invalidation rule.
        setLastAction(null);
        latestClearRecoverable.current();
        void refresh();
      }
    };
    chrome.runtime.onMessage.addListener(handleChange);
    return () => chrome.runtime.onMessage.removeListener(handleChange);
  }, []);

  async function setGlobal(mode: "active" | "paused"): Promise<void> {
    const response = await sendRequest({ type: "SET_GLOBAL_ACTIVATION", mode });
    if (!response.ok) setError(response.error);
    else await refresh();
  }

  async function setOrigin(origin: string, mode: "active" | "paused"): Promise<void> {
    const response = await sendRequest({ type: "SET_ORIGIN_ACTIVATION", origin, mode });
    if (!response.ok) setError(response.error);
    else await refresh();
  }

  async function handleUndo(): Promise<void> {
    if (!lastAction) return;
    const action = lastAction;
    // Clear immediately so a second Undo is never offered.
    setLastAction(null);
    const outcome = await performUndo(action, refresh, setError, t);
    if (outcome) notify(outcome);
  }

  // The active result shown in the global region: a pending Undo takes
  // priority and renders with an Undo button. Plain notifications (Sites,
  // Settings, non-reversible results) render without one.
  const activeNotification = lastAction
    ? {
        message: sidePanelUndoLabel(lastAction, t),
        action: {
          label: t.undo(),
          onClick: () => void handleUndo(),
        },
      }
    : notification;

  // Task 023 Addendum B5 (11, 12). Two separate defects met here.
  //
  // The live region used to be the visible result banner itself, whose content
  // is a subtree of buttons. VoiceOver announces an added interactive subtree
  // unreliably - which is why Reset's "FillNest was reset to its initial
  // state." was never heard: the confirmation sheet closed and focus returned
  // to Reset FillNest, and all the user got was that button's own name.
  // Announcing a plain string from a dedicated text-only region removes the
  // subtree from the equation entirely.
  //
  // And the string itself has to say that Undo exists. "Deleted X from the
  // Library and 1 Field" followed by a button nobody announced left the user
  // with an outcome and no idea it was reversible.
  const announcementText = activeNotification
    ? [
        activeNotification.message,
        activeNotification.detail,
        activeNotification.action?.description,
        activeNotification.action ? t.actionIsAvailable(activeNotification.action.label) : null,
      ]
        .filter((part): part is string => typeof part === "string" && part.length > 0)
        .join(" ")
    : "";

  // The region is emptied and refilled a beat later rather than written in the
  // same commit as the rest of the change. A live region announces a mutation
  // it observes after it already exists, and the mutations these results come
  // with - a confirmation sheet closing, a row disappearing, focus being
  // restored - are exactly the ones that swallow a same-frame update. Clearing
  // first also makes two identical results in a row two announcements.
  const [announcement, setAnnouncement] = useState("");
  useEffect(() => {
    setAnnouncement("");
    if (announcementText === "") return;
    const timer = window.setTimeout(() => setAnnouncement(announcementText), 120);
    return () => window.clearTimeout(timer);
  }, [announcementText, lastAction, notification]);

  // Task 023 Addendum B5 (9). Deleting a Template removes the row that holds
  // the Delete button, and saving an edit removes the Save button; either way
  // the element that had focus is gone and the browser drops focus onto the
  // document. VoiceOver then read "FillNest web content" and the user was
  // stranded. When - and only when - focus was actually lost this way, it
  // moves to the Undo button that the same action just produced, which is both
  // a real destination and the thing the user most likely wants next.
  const undoButtonRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!lastAction) return;
    const active = document.activeElement;
    if (active !== null && active !== document.body && active.isConnected) return;
    undoButtonRef.current?.focus();
  }, [lastAction]);

  return (
    <main class="panel-shell">
      <nav aria-label={t.navSections()}>
        {/* Non-interactive app icon at the left edge of navigation.
            aria-hidden and tabIndex -1 exclude it from all keyboard and
            accessibility tree traversal. */}
        <span class="panel-nav-icon" aria-hidden="true" tabIndex={-1}>
          <BrandIcon class="panel-logo" />
        </span>
        {(["Overview", "Templates", "Sites", "Settings"] as const).map((item) => (
          <button
            type="button"
            class={[destination === item ? "selected" : "", item === "Settings" ? "nav-icon-only" : ""].filter(Boolean).join(" ")}
            aria-current={destination === item ? "page" : undefined}
            // Owner QA 2026-09-15: Settings is its gear alone; the name stays
            // its accessible name and its hover text.
            aria-label={item === "Settings" ? navigationLabel(item, t) : undefined}
            title={item === "Settings" ? navigationLabel(item, t) : undefined}
            onClick={() => setDestination(item)}
          >
            {item === "Settings" ? <SettingsIcon class="nav-icon" /> : navigationLabel(item, t)}
          </button>
        ))}
      </nav>
      <section class="panel-content">
        {error && (
          <p class="panel-error" role="alert">
            {recoveryBlocked && !business ? t.errorRestoreRecoveryBlocked() : error}
          </p>
        )}
        {!business || !activation ? (
          // Task 006 Addendum B: data that cannot be loaded must not leave
          // the panel loading forever - Settings holds Reset FillNest, the
          // way out the error above names.
          error ? (
            <SettingsPage
              appearance={appearance}
              onRefresh={refresh}
              onError={setError}
              onNotify={notify}
              recoveryOnly={recoveryBlocked}
            />
          ) : (
            <p>{t.loadingFillNest()}</p>
          )
        ) : (
          <>
            {destination === "Overview" && (
              <Overview
                activation={activation}
                templateCount={business.templates.length}
                siteCount={buildSiteProjections(business, activation).filter((site) => site.authorized).length}
                onGlobal={setGlobal}
                onOrigin={setOrigin}
                onRefresh={refresh}
                onNotify={notify}
              />
            )}
            {destination === "Templates" && (
              <TemplatesPage
                business={business}
                onRefresh={refresh}
                onError={setError}
                onLastAction={setLastAction}
                onNotify={notify}
                pendingSiteFilter={pendingSiteFilter}
                onPendingSiteFilterApplied={() => setPendingSiteFilter(null)}
              />
            )}
            {destination === "Sites" && (
              <SitesPage
                business={business}
                activation={activation}
                onOrigin={setOrigin}
                onRefresh={refresh}
                onError={setError}
                onOpenTemplatesForSite={openTemplatesForSite}
                onNotify={notify}
              />
            )}
            {destination === "Settings" && (
              <SettingsPage
                appearance={appearance}
                onRefresh={refresh}
                onError={setError}
                onNotify={notify}
              />
            )}
          </>
        )}
      </section>
      {/* Global result region: one current result across all destinations.
          Navigation does not clear it. A later successful operation replaces it.
          A later FillNest mutation silently invalidates a recoverable result
          (via the BUSINESS_STATE_CHANGED handler above).
          Announced as status; never steals focus. */}
      <div class="panel-result-region">
        {activeNotification && (
          <NotificationBanner notification={activeNotification} actionRef={undoButtonRef} />
        )}
      </div>
      {/* The one announcing region: plain text only, never markup. */}
      <div class="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
    </main>
  );
}

export function Overview({
  activation,
  templateCount,
  siteCount,
  onGlobal,
  onOrigin,
  onRefresh,
  onNotify,
}: {
  activation: ActivationManagementSnapshot;
  templateCount: number;
  siteCount: number;
  onGlobal(mode: "active" | "paused"): Promise<void>;
  onOrigin(origin: string, mode: "active" | "paused"): Promise<void>;
  onRefresh(): Promise<void>;
  onNotify(message: string): void;
}) {
  const t = useMessages();
  const currentOrigin = useCurrentTabOrigin();
  const currentOriginRecord =
    currentOrigin && activation.origins.find((candidate) => candidate.origin === currentOrigin.origin);
  const { busy: busyAccess, incomplete, allowAccess } = useWebsiteAccessRequest(onRefresh);
  async function copyFeedbackAddress(): Promise<void> {
    try {
      await navigator.clipboard.writeText(FEEDBACK_EMAIL_ADDRESS);
      onNotify(t.emailCopied());
    } catch {
      onNotify(t.emailNotCopied());
    }
  }

  function requestAccess(retry: boolean): void {
    if (!currentOrigin?.tabId) return;
    void allowAccess(currentOrigin.pageUrl, currentOrigin.tabId, retry);
  }

  const page: ActivationPage = currentOrigin
    ? {
        status: "available",
        origin: currentOrigin.origin,
        websiteAccess: currentOriginRecord !== undefined,
        originActivation: currentOriginRecord?.originActivation ?? "paused",
      }
    : { status: "unavailable" };

  return (
    <div class="overview-page">
      <h1>{t.overviewHeading()}</h1>
      {/* Task 023 Addendum B5 (1) still holds: each switch's accessible name
          says what it turns on, not only "Active". Owner QA 2026-09-15: the
          same block as the Popup, titled and explained, with one status line. */}
      <CurrentWebsiteAccess
        idPrefix="overview"
        global={activation.global}
        page={page}
        busy={busyAccess || (currentOrigin !== null && currentOrigin !== undefined && !currentOrigin.tabId)}
        incomplete={incomplete}
        onGlobal={() => void onGlobal(activation.global === "active" ? "paused" : "active")}
        onOrigin={() => {
          if (currentOriginRecord) {
            void onOrigin(currentOriginRecord.origin, currentOriginRecord.originActivation === "active" ? "paused" : "active");
          }
        }}
        onAllow={() => requestAccess(false)}
        onRetry={() => requestAccess(true)}
      />

      <dl class="summary">
        <div>
          <dt>{t.templatesLabel()}</dt>
          <dd>{templateCount}</dd>
        </div>
        <div>
          <dt>{t.sitesLabel()}</dt>
          <dd>{siteCount}</dd>
        </div>
      </dl>
      <p class="guidance">{t.overviewGuidance()}</p>

      {/* Task 042. FillNest has no server and sends nothing, so it shows where
          to write and copies the address - never a form, and never a drafted
          message in a mail program, either of which would suggest otherwise
          (owner decision, 2026-09-14). Owner QA 2026-09-15: at the foot of
          Overview, just above the result region, under its own heading. */}
      <section class="feedback" aria-labelledby="feedback-heading">
        <h2 id="feedback-heading">{t.feedbackHeading()}</h2>
        <p>{t.feedbackDescription()}</p>
        <p class="feedback-row">
          <span class="feedback-address">{FEEDBACK_EMAIL_ADDRESS}</span>
          <button
            type="button"
            class="secondary"
            aria-label={t.copyEmailLabel(FEEDBACK_EMAIL_ADDRESS)}
            onClick={() => void copyFeedbackAddress()}
          >
            {t.copyEmail()}
          </button>
        </p>
      </section>
    </div>
  );
}


/**
 * Task 037. The navigation's own labels.
 *
 * `Destination` is an English union used as a key throughout this surface -
 * routing, state, tests - and it stays that way. Only its label is translated.
 */
function navigationLabel(destination: Destination, messages: Messages): string {
  switch (destination) {
    case "Overview":
      return messages.navOverview();
    case "Templates":
      return messages.navTemplates();
    case "Sites":
      return messages.navSites();
    case "Settings":
      return messages.navSettings();
  }
}
