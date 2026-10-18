// @vitest-environment happy-dom

import { render } from "preact";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createInitialFillNestState } from "../../src/storage/fillnest-repository";
import { FEEDBACK_EMAIL_ADDRESS } from "../../src/support/feedback";
import { SidePanel } from "../../src/ui/side-panel/SidePanel";

// Task 042 slice 3. FillNest has no server, so it cannot send feedback, and
// the owner ruled out anything that looks as if it could - a form, or a button
// that opens a mail program with a drafted message. Overview shows the address
// and copies it; that is all.

function stubChrome(language = "en") {
  vi.stubGlobal("chrome", {
    runtime: {
      sendMessage: vi.fn(async (request: { type: string }) => {
        if (request.type === "GET_LANGUAGE") return { ok: true, value: language };
        if (request.type === "GET_DISMISSED_TIPS") return { ok: true, value: ["side-panel-start"] };
        if (request.type === "READ_STATE") return { ok: true, value: createInitialFillNestState() };
        if (request.type === "GET_ACTIVATION_MANAGEMENT") return { ok: true, value: { global: "active", origins: [] } };
        return { ok: true, value: {} };
      }),
      onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
    },
    tabs: { query: vi.fn(async () => []) },
  });
}

function stubClipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", { value: { writeText: vi.fn(writeText) }, configurable: true });
  return navigator.clipboard.writeText as ReturnType<typeof vi.fn>;
}

const root = document.createElement("div");
document.body.append(root);

afterEach(async () => {
  render(null, root);
  await new Promise((resolve) => setTimeout(resolve, 40));
  vi.unstubAllGlobals();
});

function copyButton(): HTMLButtonElement {
  const found = root.querySelector<HTMLButtonElement>(".feedback-row button");
  if (!found) throw new Error("No Copy email button");
  return found;
}

describe("Overview's feedback address", () => {
  it("shows the address as text and copies it, sending nothing", async () => {
    stubChrome();
    const writeText = stubClipboard(async () => undefined);
    render(<SidePanel />, root);
    await vi.waitFor(() => expect(root.querySelector(".feedback-row")).not.toBeNull());

    const row = root.querySelector(".feedback-row")!;
    expect(FEEDBACK_EMAIL_ADDRESS).toBe("fillnest.feedback@gmail.com");
    expect(root.querySelector(".feedback h2")?.textContent).toBe("Problems or ideas");
    expect(root.querySelector(".feedback")?.textContent).toContain("Ran into a problem, or have an idea?");
    expect(row.textContent).toContain(FEEDBACK_EMAIL_ADDRESS);
    expect(copyButton().textContent?.trim()).toBe("Copy email");
    expect(copyButton().getAttribute("aria-label")).toBe(`Copy email ${FEEDBACK_EMAIL_ADDRESS}`);
    expect(root.querySelector('a[href^="mailto:"], form')).toBeNull();

    copyButton().click();
    expect(writeText).toHaveBeenCalledWith(FEEDBACK_EMAIL_ADDRESS);
    await vi.waitFor(() => expect(root.textContent).toContain("Copied."));
  });

  it("says so when the clipboard refuses, and the address stays selectable", async () => {
    stubChrome();
    stubClipboard(async () => {
      throw new Error("denied");
    });
    render(<SidePanel />, root);
    await vi.waitFor(() => expect(root.querySelector(".feedback-row")).not.toBeNull());
    copyButton().click();
    await vi.waitFor(() => expect(root.textContent).toContain("Could not copy. Select the address instead."));
  });

  it("speaks Chinese when Chinese is chosen", async () => {
    stubChrome("zh-Hans");
    stubClipboard(async () => undefined);
    render(<SidePanel />, root);
    await vi.waitFor(() => expect(root.querySelector(".feedback h2")?.textContent).toBe("问题或建议"));
    expect(copyButton().textContent?.trim()).toBe("复制邮箱");
    copyButton().click();
    await vi.waitFor(() => expect(root.textContent).toContain("已复制。"));
  });
});
