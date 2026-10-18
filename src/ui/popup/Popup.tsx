import { useEffect, useRef, useState } from "preact/hooks";

import type { ActivationSnapshot } from "../../activation/activation-authority";
import { BrandIcon } from "../icons/FillNestIcons";
import { CurrentWebsiteAccess } from "../shared/CurrentWebsiteAccess";
import { useDocumentLanguage, useMessages } from "../../i18n/useMessages";
import { useAppearance } from "../theme/useAppearance";
import { useWebsiteAccessRequest } from "../shared/website-access-request";
import { StartCard, useFirstUseTips } from "../shared/FirstUseTips";
import { sendRequest } from "../shared/runtime-request";

type ActiveTab = { id: number; url: string; windowId: number };
type PopupState =
  | { status: "loading" }
  | { status: "ready"; tab: ActiveTab | null; snapshot: ActivationSnapshot }
  // Task 006 Addendum B: the error keeps the tab it was read for, so the Popup
  // can still open the Side Panel - the only way to Settings and Reset FillNest.
  | { status: "error"; message: string; tab: ActiveTab | null };

export function Popup() {
  // The Popup never chooses a theme, but it must wear the one the Side Panel
  // chose - including a live change while both are open (Task 034).
  useAppearance();
  const t = useMessages();
  useDocumentLanguage();
  // Task 037. `refresh` runs from a listener registered once, so it must not
  // capture a changing value: it reads the current catalogue through this ref
  // instead. Without it the effect would have to re-register on every language
  // change, for two fallback strings.
  const messages = useRef(t);
  messages.current = t;
  const [state, setState] = useState<PopupState>({ status: "loading" });
  const [busyGlobal, setBusyGlobal] = useState(false);
  const { busy: busyAccess, incomplete, allowAccess } = useWebsiteAccessRequest(refresh);
  const tips = useFirstUseTips();
  const busy = busyGlobal || busyAccess;

  async function refresh(): Promise<void> {
    let tab: ActiveTab | null = null;
    try {
      tab = await readActiveTab();
      const response = await sendRequest({
        type: "GET_ACTIVATION_SNAPSHOT",
        pageUrl: requestablePageUrl(tab?.url) ? tab?.url : null,
      });
      if (!response.ok || !isActivationSnapshot(response.value)) {
        throw new Error(response.ok ? messages.current.invalidActivationState() : response.error);
      }
      setState({ status: "ready", tab, snapshot: response.value });
    } catch (error) {
      setState({ status: "error", message: error instanceof Error ? error.message : messages.current.unknownError(), tab });
    }
  }

  useEffect(() => {
    void refresh();
    const handleChange = (message: unknown) => {
      if (isActivationChanged(message)) void refresh();
    };
    chrome.runtime.onMessage.addListener(handleChange);
    return () => chrome.runtime.onMessage.removeListener(handleChange);
  }, []);

  async function setGlobal(mode: "active" | "paused"): Promise<void> {
    setBusyGlobal(true);
    const response = await sendRequest({ type: "SET_GLOBAL_ACTIVATION", mode });
    if (!response.ok) setState({ status: "error", message: response.error, tab: currentTab() });
    else await refresh();
    setBusyGlobal(false);
  }

  async function setOrigin(mode: "active" | "paused"): Promise<void> {
    if (state.status !== "ready" || state.snapshot.page.status !== "available") return;
    setBusyGlobal(true);
    const response = await sendRequest({
      type: "SET_ORIGIN_ACTIVATION",
      origin: state.snapshot.page.origin,
      mode,
    });
    if (!response.ok) setState({ status: "error", message: response.error, tab: currentTab() });
    else await refresh();
    setBusyGlobal(false);
  }

  function toggleOrigin(): void {
    if (state.status !== "ready" || state.snapshot.page.status !== "available") return;
    void setOrigin(state.snapshot.page.originActivation === "active" ? "paused" : "active");
  }

  function requestAccess(retry: boolean): void {
    if (state.status !== "ready" || !state.tab?.url) return;
    const tab = state.tab;
    void allowAccess(tab.url, tab.id, retry).catch((error: unknown) =>
      setState({ status: "error", message: error instanceof Error ? error.message : messages.current.unknownError(), tab }),
    );
  }

  function currentTab(): ActiveTab | null {
    return state.status === "loading" ? null : state.tab;
  }

  function openFillNest(): void {
    const windowId = currentTab()?.windowId;
    if (windowId === undefined) return;
    void chrome.sidePanel.open({ windowId });
  }

  return (
    <main class="popup-shell">
      <header class="popup-header">
        <span class="brand-mark" aria-hidden="true"><BrandIcon /></span>
        <div><h1>FillNest</h1><p>{t.productTagline()}</p></div>
      </header>
      {state.status === "loading" && <p class="status-copy">{t.checkingFillNest()}</p>}
      {state.status === "error" && (
        <>
          <p class="notice error" role="alert">{state.message}</p>
          {state.tab && <button class="open-button" type="button" onClick={openFillNest}>{t.openFillNest()}</button>}
        </>
      )}
      {state.status === "ready" && (
        <>
          {/* Task 042: how to allow a site, on first open. */}
          {tips.shows("popup-start") && (
            <StartCard lines={[t.popupTipAllow()]} onDismiss={() => tips.dismiss("popup-start")} />
          )}
          <div class="popup-section">
            <CurrentWebsiteAccess
              idPrefix="popup"
              global={state.snapshot.global}
              page={state.snapshot.page}
              busy={busy || !state.tab}
              incomplete={incomplete}
              onGlobal={() => void setGlobal(state.snapshot.global === "active" ? "paused" : "active")}
              onOrigin={toggleOrigin}
              onAllow={() => requestAccess(false)}
              onRetry={() => requestAccess(true)}
            />
          </div>
          <button class="open-button" type="button" onClick={openFillNest}>{t.openFillNest()}</button>
        </>
      )}
    </main>
  );
}

async function readActiveTab(): Promise<ActiveTab | null> {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (tab?.id === undefined || tab.windowId === undefined || !tab.url) return null;
  return { id: tab.id, url: tab.url, windowId: tab.windowId };
}

function requestablePageUrl(url?: string): boolean {
  if (!url || !/^https?:\/\//.test(url)) return false;
  try {
    const hostname = new URL(url).hostname;
    return hostname !== "chromewebstore.google.com" && hostname !== "chrome.google.com";
  } catch {
    return false;
  }
}


function isActivationChanged(value: unknown): boolean {
  return typeof value === "object" && value !== null && "type" in value && value.type === "ACTIVATION_STATE_CHANGED";
}

function isActivationSnapshot(value: unknown): value is ActivationSnapshot {
  return typeof value === "object" && value !== null && "global" in value && "page" in value;
}
