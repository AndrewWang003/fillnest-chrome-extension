// @vitest-environment happy-dom

import { render } from "preact";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Popup } from "../../src/ui/popup/Popup";

describe("Popup", () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.unstubAllGlobals();
  });

  it("shows explicit Website Access and disabled Origin Activation on an unauthorized origin", async () => {
    const sendMessage = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        global: "active",
        page: {
          status: "available",
          origin: "https://app.example.test:8443",
          pattern: "https://app.example.test:8443/*",
          websiteAccess: false,
          originActivation: "paused",
        },
      },
    });
    vi.stubGlobal("chrome", chromeStub({
      tab: { id: 12, url: "https://app.example.test:8443/form", windowId: 7 },
      sendMessage,
    }));
    const root = document.createElement("div");
    document.body.append(root);

    render(<Popup />, root);

    // Owner QA 2026-09-15: each switch is titled for what it turns on, the
    // site is named beside its own switch, and one line says the next step.
    await vi.waitFor(() => expect(root.textContent).toContain("Not ready yet: choose [Allow access]."));
    expect(root.textContent).toContain("Enable FillNest");
    expect(root.textContent).toContain("Enable on this site · app.example.test:8443");
    expect(button(root, "Allow access to https://app.example.test:8443").disabled).toBe(false);
    // No site switch until the site is allowed: it could not act before then.
    expect(root.querySelector("#popup-origin-toggle")).toBeNull();
    expect(button(root, "Open FillNest").disabled).toBe(false);
  });

  it("keeps Global Activation and Open FillNest on a restricted page without access actions", async () => {
    vi.stubGlobal("chrome", chromeStub({
      tab: { id: 12, url: "chrome://extensions", windowId: 7 },
      sendMessage: vi.fn().mockResolvedValue({
        ok: true,
        value: { global: "paused", page: { status: "unavailable" } },
      }),
    }));
    const root = document.createElement("div");
    document.body.append(root);

    render(<Popup />, root);

    await vi.waitFor(() => {
      expect(root.textContent).toContain("FillNest can't be used on this page.");
    });
    // Task 023 Addendum B5 (1): the Global switch's accessible name says what
    // it activates rather than repeating the visible "Paused" state, which on
    // its own named nothing.
    expect(switchControl(root, "FillNest active everywhere")).toBeTruthy();
    expect(root.textContent).toContain("Paused");
    expect(button(root, "Open FillNest")).toBeTruthy();
    expect(root.textContent).not.toContain("Allow access");
    expect(root.textContent).not.toContain("Enable on this site");
  });

  // Task 006 Addendum B, found in the owner's QA on 2026-09-11: while a
  // failed Restore keeps FillNest closed, the Side Panel's Settings - where
  // Reset FillNest is - is the way out, and the Popup is the only way into
  // the Side Panel. The Popup's error state used to offer nothing.
  it("still opens FillNest when it reports an error, so Reset stays reachable", async () => {
    const chrome = chromeStub({
      tab: { id: 12, url: "https://app.example.test/form", windowId: 7 },
      sendMessage: vi.fn().mockResolvedValue({
        ok: false,
        error: "A restore could not finish, so FillNest has stopped to keep your previous data safe.",
        errorCode: "restore-recovery-blocked",
      }),
    });
    vi.stubGlobal("chrome", chrome);
    const root = document.createElement("div");
    document.body.append(root);

    render(<Popup />, root);

    await vi.waitFor(() => expect(root.textContent).toContain("A restore could not finish"));
    button(root, "Open FillNest").click();
    expect(chrome.sidePanel.open).toHaveBeenCalledWith({ windowId: 7 });
  });
});

function chromeStub(input: {
  tab: { id: number; url: string; windowId: number };
  sendMessage: ReturnType<typeof vi.fn>;
}) {
  return {
    runtime: {
      sendMessage: input.sendMessage,
      onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
    },
    tabs: { query: vi.fn().mockResolvedValue([input.tab]) },
    sidePanel: { open: vi.fn().mockResolvedValue(undefined) },
  };
}

function button(root: Element, name: string): HTMLButtonElement {
  const found = [...root.querySelectorAll("button")].find(
    (candidate) => candidate.textContent?.trim() === name || candidate.getAttribute("aria-label") === name,
  );
  if (!(found instanceof HTMLButtonElement)) throw new Error(`Button not found: ${name}`);
  return found;
}

function switchControl(root: Element, name: string): HTMLInputElement {
  const found = [...root.querySelectorAll('input[type="checkbox"][role="switch"]')].find(
    (candidate) => candidate.getAttribute("aria-label") === name,
  );
  if (!(found instanceof HTMLInputElement)) throw new Error(`Switch not found: ${name}`);
  return found;
}
