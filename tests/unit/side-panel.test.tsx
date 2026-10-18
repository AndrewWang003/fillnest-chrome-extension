// @vitest-environment happy-dom

import { render } from "preact";
import { useRef } from "preact/hooks";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SidePanel } from "../../src/ui/side-panel/SidePanel";
import { ModalDialog, NotificationBanner } from "../../src/ui/side-panel/SidePanelShared";

describe("SidePanel", () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.unstubAllGlobals();
  });

  it("navigates among real Overview, Templates, Sites, and Settings data", async () => {
    vi.stubGlobal("chrome", {
      runtime: {
        sendMessage: vi.fn(async (request: { type: string }) => {
          if (request.type === "READ_STATE") return {
            ok: true,
            value: {
              schemaVersion: 13,
              sites: [{ id: "example.test" }],
              templates: [{ id: "t1", content: "Jordan Lee\nOperations", siteAffinities: ["example.test"], createdAt: "x", updatedAt: "x", totalUsageCount: 0 }],
              pageProfiles: [], fieldProfiles: [], bindings: [],
              logicalPageSiteKeys: [], logicalPageRules: [], logicalPageProvenance: [], logicalPageObservations: [],
              sharedTemplateSets: [], sharedTemplateBindings: [], sharedTemplateFieldStates: [],
              compatibilityPairDecisions: [],
              pickerPosition: null,
              pageStatusPosition: null,
            },
          };
          if (request.type === "GET_ACTIVATION_MANAGEMENT") return {
            ok: true,
            value: {
              global: "active",
              origins: [
                { origin: "https://app.example.test:443", originActivation: "paused" },
                { origin: "https://other.test:443", originActivation: "active" },
              ],
            },
          };
          return { ok: true, value: {} };
        }),
        onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
      },
    });
    const root = document.createElement("div");
    document.body.append(root);

    render(<SidePanel />, root);
    await vi.waitFor(() => expect(root.querySelector<HTMLInputElement>("#overview-global-toggle")?.checked).toBe(true));

    // Overview's Sites stat must count granted Website Access origins (same
    // source the Sites page uses: 2, across example.test and other.test),
    // not `business.sites` (only 1 site has a saved Template) - otherwise
    // the two pages disagree on how many Sites the user is using FillNest on.
    const sitesLabel = [...root.querySelectorAll("dt")].find((dt) => dt.textContent === "Sites");
    expect(sitesLabel?.nextElementSibling?.textContent).toBe("2");

    click(root, "Templates");
    await vi.waitFor(() => expect(root.textContent).toContain("Fields"));
    click(root, "All templates");
    await vi.waitFor(() => expect(root.textContent).toContain("Jordan Lee"));
    expect(root.querySelector('input[aria-label="Search Template bodies"]')).toBeTruthy();

    click(root, "Sites");
    // Sites opens on its By-site default view - switch to the flat list,
    // where every Permission Origin is a top-level row reachable with no
    // expansion at all.
    await vi.waitFor(() => expect(root.textContent).toContain("By site"));
    click(root, "All addresses");
    await vi.waitFor(() => expect(root.textContent).toContain("https://app.example.test:443"));
    expect(root.textContent).toContain("example.test");
    expect(root.textContent).toContain("Paused");

    click(root, "Settings");
    await vi.waitFor(() => expect(root.textContent).toContain("Data Management"));
    expect(root.textContent).not.toContain("Global Activation");
    expect(root.textContent).not.toContain("Coming soon");
    expect(root.textContent).not.toContain("User");
    // Task 034: Settings now leads with Appearance and states each Data
    // Management action in one line - "Backup" and "Restore" rather than the
    // paragraph-per-row that filled the page.
    expect(root.textContent).toContain("Appearance");
    // The backup privacy warning hangs off the Backup action rather than
    // standing as a block, but it stays reachable without a mouse: a real
    // focusable control whose accessible name is the whole warning.
    const privacyHint = root.querySelector(".setting-hint");
    expect(privacyHint?.tagName).toBe("BUTTON");
    expect(privacyHint?.getAttribute("aria-label")).toMatch(/^Privacy warning: a backup is plain text/u);
    expect(privacyHint?.getAttribute("data-tooltip")).toBe(privacyHint?.getAttribute("aria-label"));
    expect(root.textContent).toContain("Backup");
    expect(root.textContent).toContain("Restore");
  });

  it("Overview shows the current website's access status and an Active/Paused toggle for an already-authorized tab", async () => {
    let currentTabUrl = "https://app.example.test/";
    vi.stubGlobal("chrome", {
      runtime: {
        sendMessage: vi.fn(async (request: { type: string; [key: string]: unknown }) => {
          if (request.type === "READ_STATE") {
            return { ok: true, value: { schemaVersion: 13, sites: [], templates: [], pageProfiles: [], fieldProfiles: [], bindings: [], logicalPageSiteKeys: [], logicalPageRules: [], logicalPageProvenance: [], logicalPageObservations: [], sharedTemplateSets: [], sharedTemplateBindings: [], sharedTemplateFieldStates: [], compatibilityPairDecisions: [], pickerPosition: null } };
          }
          if (request.type === "GET_ACTIVATION_MANAGEMENT") {
            return {
              ok: true,
              value: {
                global: "active",
                origins: [{ origin: "https://app.example.test:443", originActivation: "active" }],
              },
            };
          }
          if (request.type === "SET_ORIGIN_ACTIVATION") {
            return { ok: true, value: {} };
          }
          return { ok: true, value: {} };
        }),
        onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
      },
      tabs: {
        query: vi.fn(async () => [{ id: 7, url: currentTabUrl }]),
        onActivated: { addListener: vi.fn(), removeListener: vi.fn() },
        onUpdated: { addListener: vi.fn(), removeListener: vi.fn() },
      },
      windows: { onFocusChanged: { addListener: vi.fn(), removeListener: vi.fn() } },
    });
    const root = document.createElement("div");
    document.body.append(root);
    render(<SidePanel />, root);

    await vi.waitFor(() => expect(root.textContent).toContain("Enable on this site · app.example.test"));
    await vi.waitFor(() => expect(root.querySelector("#overview-origin-toggle")).toBeTruthy());
    expect(root.textContent).toContain("Ready to use on this site.");
    expect(root.querySelector(".primary-button")).toBeNull();

    const toggle = root.querySelector("#overview-origin-toggle") as HTMLInputElement;
    expect(toggle.checked).toBe(true);

    // Task 023 Addendum B5 (1): both Overview switches show only
    // "Active"/"Paused", so on their own a screen reader announced "Active,
    // on, switch" for each and neither said which thing it turned on.
    const globalToggle = root.querySelector("#overview-global-toggle") as HTMLInputElement;
    expect(globalToggle.getAttribute("aria-label")).toBe("FillNest active everywhere");
    expect(toggle.getAttribute("aria-label")).toBe("FillNest active on https://app.example.test:443");

    toggle.click();

    // An unauthorized current tab shows the same Allow-access request the
    // Popup offers, not a silent status line - swap the current tab to one
    // absent from activation.origins and confirm. Overview unmounts/remounts
    // on navigation, so its effect re-reads the (now-changed) current tab.
    currentTabUrl = "https://unauthorized.test/";
    click(root, "Templates");
    await vi.waitFor(() => expect(root.textContent).toContain("Fields"));
    click(root, "Overview");
    await vi.waitFor(() => expect(root.textContent).toContain("Not ready yet: choose [Allow access]."));
    expect(root.querySelector("#overview-origin-toggle")).toBeNull();
    // Two centred lines (owner QA 2026-09-15); the accessible name is one phrase.
    expect(root.querySelector(".primary-button")?.getAttribute("aria-label")).toBe("Allow access to https://unauthorized.test:443");
    expect(root.querySelector(".allow-access-action")?.textContent).toBe("Allow access");
    expect(root.querySelector(".allow-access-origin")?.textContent).toBe("https://unauthorized.test:443");
  });

  it("Overview updates live when the user switches browser tabs while staying on the Overview page (no navigation)", async () => {
    let currentTabUrl = "https://authorized.test/";
    let activatedHandler: (() => void) | undefined;
    vi.stubGlobal("chrome", {
      runtime: {
        sendMessage: vi.fn(async (request: { type: string; [key: string]: unknown }) => {
          if (request.type === "READ_STATE") {
            return { ok: true, value: { schemaVersion: 13, sites: [], templates: [], pageProfiles: [], fieldProfiles: [], bindings: [], logicalPageSiteKeys: [], logicalPageRules: [], logicalPageProvenance: [], logicalPageObservations: [], sharedTemplateSets: [], sharedTemplateBindings: [], sharedTemplateFieldStates: [], compatibilityPairDecisions: [], pickerPosition: null } };
          }
          if (request.type === "GET_ACTIVATION_MANAGEMENT") {
            return {
              ok: true,
              value: { global: "active", origins: [{ origin: "https://authorized.test:443", originActivation: "active" }] },
            };
          }
          return { ok: true, value: {} };
        }),
        onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
      },
      tabs: {
        query: vi.fn(async () => [{ id: 1, url: currentTabUrl }]),
        onActivated: {
          addListener: vi.fn((listener: () => void) => {
            activatedHandler = listener;
          }),
          removeListener: vi.fn(),
        },
        onUpdated: { addListener: vi.fn(), removeListener: vi.fn() },
      },
      windows: { onFocusChanged: { addListener: vi.fn(), removeListener: vi.fn() } },
    });
    const root = document.createElement("div");
    document.body.append(root);
    render(<SidePanel />, root);

    await vi.waitFor(() => expect(root.textContent).toContain("Ready to use on this site."));

    // The user switches to a different browser tab without touching the Side
    // Panel at all - only chrome.tabs.onActivated fires, the same event a
    // real tab switch produces. Overview must pick this up without any
    // in-panel navigation.
    currentTabUrl = "https://unrelated.test/";
    expect(activatedHandler).toBeDefined();
    activatedHandler?.();

    await vi.waitFor(() => expect(root.textContent).toContain("unrelated.test"));
    expect(root.textContent).toContain("Not ready yet: choose [Allow access].");
  });

  it("Overview's Allow access button requests Website Access for the current tab, through the same ENABLE_SITE path the Popup uses", async () => {
    let authorized = false;
    const sendMessage = vi.fn(async (request: { type: string; [key: string]: unknown }) => {
      if (request.type === "READ_STATE") {
        return { ok: true, value: { schemaVersion: 13, sites: [], templates: [], pageProfiles: [], fieldProfiles: [], bindings: [], logicalPageSiteKeys: [], logicalPageRules: [], logicalPageProvenance: [], logicalPageObservations: [], sharedTemplateSets: [], sharedTemplateBindings: [], sharedTemplateFieldStates: [], compatibilityPairDecisions: [], pickerPosition: null } };
      }
      if (request.type === "GET_ACTIVATION_MANAGEMENT") {
        return {
          ok: true,
          value: {
            global: "active",
            origins: authorized ? [{ origin: "https://formy-project.herokuapp.com:443", originActivation: "active" }] : [],
          },
        };
      }
      if (request.type === "ENABLE_SITE") {
        authorized = true;
        return { ok: true, value: { status: "active" } };
      }
      return { ok: true, value: {} };
    });
    vi.stubGlobal("chrome", {
      runtime: { sendMessage, onMessage: { addListener: vi.fn(), removeListener: vi.fn() } },
      tabs: {
        query: vi.fn(async () => [{ id: 42, url: "https://formy-project.herokuapp.com/login" }]),
        onActivated: { addListener: vi.fn(), removeListener: vi.fn() },
        onUpdated: { addListener: vi.fn(), removeListener: vi.fn() },
      },
      windows: { onFocusChanged: { addListener: vi.fn(), removeListener: vi.fn() } },
    });
    const root = document.createElement("div");
    document.body.append(root);
    render(<SidePanel />, root);

    await vi.waitFor(() => expect(root.textContent).toContain("formy-project.herokuapp.com"));
    expect(root.textContent).toContain("Not ready yet: choose [Allow access].");

    click(root, "Allow access to https://formy-project.herokuapp.com:443");
    await vi.waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith({
        type: "ENABLE_SITE",
        pageUrl: "https://formy-project.herokuapp.com/login",
        tabId: 42,
      }),
    );
    await vi.waitFor(() => expect(root.querySelector(".primary-button")).toBeNull());
    render(null, root);
  });

  // Task 006 Addendum B (owner decision, 2026-09-11): when FillNest has
  // stopped to protect data a Restore could not put back, the Side Panel
  // still reaches Reset FillNest - the one way out - instead of loading forever.
  // Task 038 Addendum B: a page button moved out of sight can be put back.
  it("Settings puts the page button back in its corner", async () => {
    const sendMessage = vi.fn(async (request: { type: string }) => {
      if (request.type === "READ_STATE") return { ok: true, value: {
        schemaVersion: 13, sites: [], templates: [], pageProfiles: [], fieldProfiles: [], bindings: [],
        logicalPageSiteKeys: [], logicalPageRules: [], logicalPageProvenance: [], logicalPageObservations: [],
        sharedTemplateSets: [], sharedTemplateBindings: [], sharedTemplateFieldStates: [], compatibilityPairDecisions: [],
        pickerPosition: null, pageStatusPosition: { top: 10, left: 10 },
      } };
      if (request.type === "GET_ACTIVATION_MANAGEMENT") return { ok: true, value: { global: "active", origins: [] } };
      if (request.type === "GET_LANGUAGE") return { ok: true, value: "en" };
      return { ok: true, value: true };
    });
    vi.stubGlobal("chrome", {
      runtime: { sendMessage, onMessage: { addListener: vi.fn(), removeListener: vi.fn() } },
      tabs: { query: vi.fn(async () => []) },
    });
    const root = document.createElement("div");
    document.body.append(root);
    render(<SidePanel />, root);
    await vi.waitFor(() => expect(root.textContent).toContain("Enable FillNest"));
    click(root, "Settings");
    await vi.waitFor(() => expect(root.textContent).toContain("FillNest button on pages"));

    click(root, "Move to bottom right");

    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledWith({ type: "RESET_PAGE_STATUS_POSITION" }));
    await vi.waitFor(() => expect(root.textContent).toContain("The FillNest button is back in the bottom-right corner"));
  });

  it("offers Settings and Reset when FillNest cannot load its data", async () => {
    const blocked = {
      ok: false,
      error: "A restore could not finish, so FillNest has stopped to keep your previous data safe.",
      errorCode: "restore-recovery-blocked",
    };
    vi.stubGlobal("chrome", {
      runtime: {
        sendMessage: vi.fn(async (request: { type: string }) => {
          if (request.type === "READ_STATE" || request.type === "GET_ACTIVATION_MANAGEMENT") return blocked;
          if (request.type === "GET_LANGUAGE") return { ok: true, value: "en" };
          return { ok: true, value: {} };
        }),
        onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
      },
    });
    const root = document.createElement("div");
    document.body.append(root);

    render(<SidePanel />, root);

    await vi.waitFor(() => expect(root.textContent).toContain("A restore could not finish"));
    expect(root.textContent).not.toContain("Loading FillNest");
    expect([...root.querySelectorAll("button")].some((button) => button.textContent?.trim() === "Reset FillNest")).toBe(true);
  });

  // Owner QA, 2026-09-11: while a failed Restore keeps FillNest closed, the
  // language and theme still change - and the error follows the language -
  // while Backup and Restore, which the worker refuses, are not offered.
  it("while a failed Restore keeps FillNest closed, offers only language, theme and Reset", async () => {
    const blocked = {
      ok: false,
      error: "A restore could not finish, so FillNest has stopped to keep your previous data safe.",
      errorCode: "restore-recovery-blocked",
    };
    const listeners: Array<(message: unknown) => void> = [];
    let language = "en";
    const sendMessage = vi.fn(async (request: { type: string; language?: string }) => {
      if (request.type === "READ_STATE" || request.type === "GET_ACTIVATION_MANAGEMENT") return blocked;
      if (request.type === "GET_LANGUAGE") return { ok: true, value: language };
      if (request.type === "SET_LANGUAGE") {
        language = request.language!;
        for (const listener of listeners) listener({ type: "LANGUAGE_CHANGED", language });
        return { ok: true, value: language };
      }
      return { ok: true, value: {} };
    });
    vi.stubGlobal("chrome", {
      runtime: {
        sendMessage,
        onMessage: { addListener: vi.fn((listener: (message: unknown) => void) => listeners.push(listener)), removeListener: vi.fn() },
      },
    });
    const root = document.createElement("div");
    document.body.append(root);

    render(<SidePanel />, root);

    await vi.waitFor(() => expect(root.textContent).toContain("A restore could not finish"));
    expect(root.textContent).not.toContain("Export Backup");
    expect(root.textContent).not.toContain("Restore...");
    expect([...root.querySelectorAll("button")].some((button) => button.textContent?.trim() === "Reset FillNest")).toBe(true);

    const select = root.querySelector<HTMLSelectElement>(".language-choice select")!;
    select.value = "zh-Hans";
    select.dispatchEvent(new Event("change", { bubbles: true }));

    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledWith({ type: "SET_LANGUAGE", language: "zh-Hans" }));
    await vi.waitFor(() => expect(root.textContent).toContain("一次还原未能完成"));
    expect(root.textContent).not.toContain("A restore could not finish");
    expect(root.textContent).toContain("重置 FillNest");
  });

  it("has no standalone FillNest header — the header element and standalone title are absent", async () => {
    vi.stubGlobal("chrome", {
      runtime: {
        sendMessage: vi.fn(async () => ({ ok: true, value: { schemaVersion: 13, sites: [], templates: [], pageProfiles: [], fieldProfiles: [], bindings: [], logicalPageSiteKeys: [], logicalPageRules: [], logicalPageProvenance: [], logicalPageObservations: [], sharedTemplateSets: [], sharedTemplateBindings: [], sharedTemplateFieldStates: [], compatibilityPairDecisions: [], pickerPosition: null } })),
        onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
      },
    });
    const root = document.createElement("div");
    document.body.append(root);
    render(<SidePanel />, root);

    await vi.waitFor(() => expect(root.querySelector("nav")).not.toBeNull());

    // The standalone <header class="panel-header"> and its FillNest title text must be gone.
    expect(root.querySelector(".panel-header")).toBeNull();
    expect(root.querySelector("header")).toBeNull();
    // The "FillNest" text only appears as part of product copy, not as a header.
    // The nav should contain the logo span but not a <strong>FillNest</strong> heading.
    expect(root.querySelector("nav strong")).toBeNull();
    render(null, root);
  });

  it("app icon in nav is non-interactive: aria-hidden, no interactive role, tabIndex -1", async () => {
    vi.stubGlobal("chrome", {
      runtime: {
        sendMessage: vi.fn(async () => ({ ok: true, value: { schemaVersion: 13, sites: [], templates: [], pageProfiles: [], fieldProfiles: [], bindings: [], logicalPageSiteKeys: [], logicalPageRules: [], logicalPageProvenance: [], logicalPageObservations: [], sharedTemplateSets: [], sharedTemplateBindings: [], sharedTemplateFieldStates: [], compatibilityPairDecisions: [], pickerPosition: null } })),
        onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
      },
    });
    const root = document.createElement("div");
    document.body.append(root);
    render(<SidePanel />, root);

    await vi.waitFor(() => expect(root.querySelector("nav")).not.toBeNull());

    const navIcon = root.querySelector(".panel-nav-icon");
    expect(navIcon).not.toBeNull();
    expect(navIcon?.getAttribute("aria-hidden")).toBe("true");
    // Must not be focusable via keyboard: tabIndex -1 or excluded from flow.
    const tabIndex = (navIcon as HTMLElement)?.tabIndex;
    expect(tabIndex).toBe(-1);
    // Must not carry a button, link, or interactive ARIA role.
    expect(navIcon?.querySelector("button, a, [role='button'], [role='link']")).toBeNull();
    render(null, root);
  });

  it("global result region is the bottom panel child with one polite status region", async () => {
    vi.stubGlobal("chrome", {
      runtime: {
        sendMessage: vi.fn(async () => ({ ok: true, value: { schemaVersion: 13, sites: [], templates: [], pageProfiles: [], fieldProfiles: [], bindings: [], logicalPageSiteKeys: [], logicalPageRules: [], logicalPageProvenance: [], logicalPageObservations: [], sharedTemplateSets: [], sharedTemplateBindings: [], sharedTemplateFieldStates: [], compatibilityPairDecisions: [], pickerPosition: null } })),
        onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
      },
    });
    const root = document.createElement("div");
    document.body.append(root);
    render(<SidePanel />, root);

    await vi.waitFor(() => expect(root.querySelector("nav")).not.toBeNull());

    const resultRegion = root.querySelector(".panel-result-region");
    expect(resultRegion).not.toBeNull();

    // Task 023 Addendum B5 (12): the announcing region is a separate text-only
    // node rather than the visible banner itself, because VoiceOver did not
    // reliably announce a live region whose new content is a subtree of
    // buttons. The visible region stays the last laid-out panel child; the
    // announcing region follows it, out of the layout entirely.
    const liveRegion = resultRegion?.nextElementSibling;
    expect(liveRegion?.classList.contains("visually-hidden")).toBe(true);
    expect(resultRegion?.parentElement?.lastElementChild).toBe(liveRegion);
    expect(resultRegion?.getAttribute("role")).toBeNull();
    expect(liveRegion?.getAttribute("role")).toBe("status");
    expect(liveRegion?.getAttribute("aria-live")).toBe("polite");
    expect(root.querySelectorAll("[role='status']")).toHaveLength(1);

    // No legacy bottom Undo bar anywhere in the document.
    expect(root.querySelector(".side-panel-undo-bar")).toBeNull();
    expect(root.querySelector(".side-panel-undo-handle")).toBeNull();
    render(null, root);
  });

  it("renders notification content without creating a nested live-status region", () => {
    const root = document.createElement("div");
    document.body.append(root);
    render(<NotificationBanner notification={{ message: "Removed access." }} />, root);

    expect(root.querySelector("[role='status']")).toBeNull();
    expect(root.textContent).toContain("Removed access.");
    render(null, root);
  });

  it("keeps keyboard focus in a modal dialog, cancels idle Escape, and restores the trigger", async () => {
    const root = document.createElement("div");
    const trigger = document.createElement("button");
    trigger.textContent = "Open confirmation";
    document.body.append(trigger, root);
    trigger.focus();
    const onCancel = vi.fn();

    function Fixture({ busy = false }: { busy?: boolean }) {
      const cancelRef = useRef<HTMLButtonElement>(null);
      return (
        <ModalDialog
          label="Test confirmation"
          busy={busy}
          onCancel={onCancel}
          initialFocusRef={cancelRef}
          restoreFocusTo={trigger}
        >
          <button type="button">Confirm</button>
          <button ref={cancelRef} type="button" data-dialog-cancel>Cancel</button>
        </ModalDialog>
      );
    }

    render(<Fixture />, root);
    await vi.waitFor(() => expect(document.activeElement).toBe(root.querySelector("button:last-child")));

    const dialog = root.querySelector("[role='dialog']") as HTMLElement;
    const confirm = root.querySelector("button") as HTMLButtonElement;
    const cancel = root.querySelector("button:last-child") as HTMLButtonElement;
    cancel.focus();
    dialog.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    expect(document.activeElement).toBe(confirm);
    confirm.focus();
    dialog.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true }));
    expect(document.activeElement).toBe(cancel);
    dialog.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(document.activeElement).toBe(trigger));

    cancel.click();
    expect(onCancel).toHaveBeenCalledTimes(2);
    await vi.waitFor(() => expect(document.activeElement).toBe(trigger));

    render(<Fixture busy />, root);
    const busyDialog = root.querySelector("[role='dialog']") as HTMLElement;
    busyDialog.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(onCancel).toHaveBeenCalledTimes(2);

    render(null, root);
  });
});


function click(root: Element, name: string): void {
  const found = [...root.querySelectorAll("button")].find(
    (candidate) => candidate.textContent?.trim() === name || candidate.getAttribute("aria-label") === name,
  );
  if (!(found instanceof HTMLButtonElement)) throw new Error(`Button not found: ${name}`);
  found.click();
}

