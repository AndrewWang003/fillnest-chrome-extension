// @vitest-environment happy-dom

import { render } from "preact";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createInitialFillNestState } from "../../src/storage/fillnest-repository";
import { Popup } from "../../src/ui/popup/Popup";
import { SidePanel } from "../../src/ui/side-panel/SidePanel";

// Task 042: a start card on first use of the Popup and the Side Panel, gone
// for good after Got it, and back after Show tips again.

function stubChrome(options: { dismissed?: string[]; language?: string } = {}) {
  let dismissed = [...(options.dismissed ?? [])];
  const sendMessage = vi.fn(async (request: { type: string; tip?: string }) => {
    switch (request.type) {
      case "GET_LANGUAGE":
        return { ok: true, value: options.language ?? "en" };
      case "GET_DISMISSED_TIPS":
        return { ok: true, value: dismissed };
      case "DISMISS_TIP":
        dismissed = [...dismissed, request.tip!];
        return { ok: true, value: dismissed };
      case "SHOW_TIPS_AGAIN":
        dismissed = [];
        return { ok: true, value: true };
      case "GET_ACTIVATION_SNAPSHOT":
        return {
          ok: true,
          value: {
            global: "active",
            page: { status: "available", origin: "https://example.test:443", pattern: "https://example.test/*", websiteAccess: false, originActivation: "paused" },
          },
        };
      case "READ_STATE":
        return { ok: true, value: createInitialFillNestState() };
      case "GET_ACTIVATION_MANAGEMENT":
        return { ok: true, value: { global: "active", origins: [] } };
      default:
        return { ok: true, value: {} };
    }
  });
  vi.stubGlobal("chrome", {
    runtime: { sendMessage, onMessage: { addListener: vi.fn(), removeListener: vi.fn() } },
    tabs: { query: vi.fn(async () => [{ id: 3, url: "https://example.test/form", windowId: 1 }]) },
    sidePanel: { open: vi.fn() },
  });
  return sendMessage;
}

const root = document.createElement("div");
document.body.append(root);

afterEach(async () => {
  render(null, root);
  await new Promise((resolve) => setTimeout(resolve, 40));
  vi.unstubAllGlobals();
});

function button(name: string): HTMLButtonElement | undefined {
  return [...root.querySelectorAll("button")].find((candidate) => candidate.textContent?.trim() === name || candidate.getAttribute("aria-label") === name);
}

describe("the Popup's start card", () => {
  it("shows on first open, keeps focus where it was, and goes for good with Got it", async () => {
    const sendMessage = stubChrome();
    render(<Popup />, root);

    await vi.waitFor(() => expect(root.querySelector(".fn-tip")).not.toBeNull());
    const card = root.querySelector(".fn-tip")!;
    expect(card.textContent).toContain("Getting started");
    expect(card.textContent).toContain("Choose [Allow access] to let FillNest work on this site.");
    expect(card.contains(document.activeElement)).toBe(false);

    const gotIt = card.querySelector<HTMLButtonElement>("button")!;
    expect(gotIt.getAttribute("aria-label")).toBe("OK, hide these tips");
    gotIt.click();

    await vi.waitFor(() => expect(root.querySelector(".fn-tip")).toBeNull());
    expect(sendMessage).toHaveBeenCalledWith({ type: "DISMISS_TIP", tip: "popup-start" });
  });

  it("stays away once dismissed", async () => {
    stubChrome({ dismissed: ["popup-start"] });
    render(<Popup />, root);
    await vi.waitFor(() => expect(button("Open FillNest")).toBeDefined());
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(root.querySelector(".fn-tip")).toBeNull();
  });

  it("speaks Chinese when Chinese is chosen", async () => {
    stubChrome({ language: "zh-Hans" });
    render(<Popup />, root);
    await vi.waitFor(() => expect(root.querySelector(".fn-tip")?.textContent).toContain("开始使用"));
    expect(root.querySelector(".fn-tip")?.textContent).toContain("请点击 [授权访问] 以允许插件在本网站使用。");
    expect(root.querySelector(".fn-tip")?.textContent).toContain("确定");
  });
});

// Owner QA 2026-09-15: Overview and Settings work like the Popup and need no
// tip; Show tips again brings back the ones that remain.
describe("the Side Panel's tips and Show tips again", () => {
  it("puts no tip on Overview or Settings, and Show tips again brings a dismissed note back", async () => {
    const sendMessage = stubChrome({ dismissed: ["sites"] });
    render(<SidePanel />, root);
    await vi.waitFor(() => expect(root.textContent).toContain("Enable FillNest"));
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(root.querySelector(".fn-tip, .fn-tip-note")).toBeNull();

    button("Settings")!.click();
    await vi.waitFor(() => expect(button("Show tips again")).toBeDefined());
    expect(root.querySelector(".fn-tip, .fn-tip-note")).toBeNull();
    // Owner QA 2026-09-15: it asks first, since it undoes every tip closed.
    button("Show tips again")!.click();
    await vi.waitFor(() => expect(root.querySelector(".clean-up-sheet")?.textContent).toContain("Show all tips again?"));
    expect(sendMessage).not.toHaveBeenCalledWith({ type: "SHOW_TIPS_AGAIN" });
    [...root.querySelectorAll<HTMLButtonElement>(".clean-up-sheet button")].find((candidate) => candidate.textContent === "Show again")!.click();
    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledWith({ type: "SHOW_TIPS_AGAIN" }));
    await vi.waitFor(() => expect(root.querySelector(".clean-up-sheet")).toBeNull());
    await vi.waitFor(() => expect(root.textContent).toContain("Tips will show again."));

    button("Sites")!.click();
    await vi.waitFor(() => expect(root.querySelector(".fn-tip-note")?.textContent).toContain("Pause, clear or remove a site."));
  });
});
