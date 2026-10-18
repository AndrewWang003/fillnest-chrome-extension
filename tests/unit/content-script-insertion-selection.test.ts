// @vitest-environment happy-dom
//
// Task 003, addendum of 2026-09-11 (pre-submission audit). The text
// selection an insertion replaces belongs to the Field it was read from and
// to one insertion. A pinned ("Keep open") Picker used to keep the offsets
// captured when its control was clicked and apply them to every later
// insertion - including one into a different Field - overwriting text the
// user never selected.
//
// Mounts the real content script against a stubbed chrome.runtime, as
// content-script-trusted-events.test.ts does.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FillNestState } from "../../src/storage/fillnest-repository";

const CONTROLLER_KEY = "__fillnestActivationController";

function dispatchClick(target: Element): void {
  const event = new MouseEvent("click", { bubbles: true, composed: true, cancelable: true });
  // happy-dom events are never trusted; the content script drops untrusted
  // clicks, so force the flag the way a real user click would carry it.
  Object.defineProperty(event, "isTrusted", { value: true });
  target.dispatchEvent(event);
}

function templateState(): FillNestState {
  return {
    schemaVersion: 13,
    compatibilityPairDecisions: [],
    sites: [{ id: "example.test" }],
    templates: [
      {
        id: "template-1",
        content: "Reply",
        siteAffinities: ["example.test"],
        createdAt: "x",
        updatedAt: "x",
        totalUsageCount: 0,
        revision: 0,
      },
    ],
    pageProfiles: [],
    fieldProfiles: [],
    bindings: [
      {
        id: "binding-1",
        templateId: "template-1",
        pageProfileId: "page-1",
        fieldProfileId: "field-1",
        createdAt: "x",
        usageCount: 0,
        revision: 0,
      },
    ],
    logicalPageSiteKeys: [],
    logicalPageRules: [],
    logicalPageProvenance: [],
    logicalPageObservations: [],
    sharedTemplateSets: [],
    sharedTemplateBindings: [],
    sharedTemplateFieldStates: [],
    pickerPosition: null,
    pageStatusPosition: null,
  };
}

function focusField(field: HTMLInputElement): void {
  field.focus();
  field.dispatchEvent(new FocusEvent("focusin", { bubbles: true, composed: true }));
}

describe("content-script: the selection an insertion replaces", () => {
  beforeEach(() => {
    const sendMessage = vi.fn(async (request: { type: string }) => {
      switch (request.type) {
        case "GET_ACTIVATION_SNAPSHOT":
          return {
            ok: true,
            value: {
              global: "active",
              page: {
                status: "available",
                origin: "https://example.test:443",
                pattern: "https://example.test:443/*",
                websiteAccess: true,
                originActivation: "active",
              },
            },
          };
        case "GET_PICKER_POSITION":
          return { ok: true, value: null };
        case "RESOLVE_FIELD_CONTEXT":
          return {
            ok: true,
            value: { pageProfileId: "page-1", fieldProfileId: "field-1", siteId: "example.test", recognized: true },
          };
        case "READ_STATE":
          return { ok: true, value: templateState() };
        default:
          return { ok: true, value: {} };
      }
    });
    vi.stubGlobal("chrome", {
      runtime: { sendMessage, onMessage: { addListener: vi.fn(), removeListener: vi.fn() } },
    });
    // happy-dom has no `execCommand`. A browser's `insertText` writes at the
    // focused control's own caret, which is exactly what these tests are about.
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: (command: string, _showUi: boolean, text: string) => {
        const active = document.activeElement;
        if (command !== "insertText" || !(active instanceof HTMLInputElement)) return false;
        active.setRangeText(text, active.selectionStart ?? 0, active.selectionEnd ?? 0, "end");
        return true;
      },
    });
    (globalThis as Record<string, unknown>)[CONTROLLER_KEY] = undefined;
  });

  afterEach(async () => {
    await new Promise((resolve) => setTimeout(resolve, 60));
    delete (document as unknown as Record<string, unknown>).execCommand;
    document.body.replaceChildren();
    document.documentElement.removeAttribute("data-fillnest-extension-active");
    for (const host of document.documentElement.querySelectorAll(
      "[data-fillnest-overlay], [data-fillnest-page-status]",
    )) {
      host.remove();
    }
    delete (globalThis as Record<string, unknown>)[CONTROLLER_KEY];
    vi.resetModules();
  });

  async function openPinnedPickerOver(value: string, start: number, end: number) {
    await import("../../src/content/content-script");
    const field = document.createElement("input");
    field.type = "text";
    field.name = "notes";
    document.body.append(field);
    focusField(field);
    const shadowRoot = await vi.waitFor(() => {
      const root = document.documentElement.querySelector("[data-fillnest-overlay]")?.shadowRoot;
      if (!root?.querySelector("button.control")) throw new Error("Control not rendered yet");
      return root;
    });
    field.value = value;
    field.setSelectionRange(start, end);
    dispatchClick(shadowRoot.querySelector("button.control")!);
    const pin = await vi.waitFor(() => {
      const button = shadowRoot.querySelector('[aria-label="Keep open"]');
      if (!button) throw new Error("Picker not open yet");
      return button;
    });
    dispatchClick(pin);
    await new Promise((resolve) => setTimeout(resolve, 20));
    const insert = () => dispatchClick(shadowRoot.querySelector("[data-template-content]")!);
    return { field, insert };
  }

  it("inserts into another Field at that Field's own caret, not at the first Field's selection", async () => {
    const { field, insert } = await openPinnedPickerOver("ABCDEF", 0, 6);

    const second = document.createElement("input");
    second.type = "text";
    second.name = "other";
    second.value = "KEEP ME";
    document.body.append(second);
    focusField(second);
    second.setSelectionRange(7, 7);
    await new Promise((resolve) => setTimeout(resolve, 100));

    insert();
    await vi.waitFor(() => expect(second.value).toBe("KEEP MEReply"));
    expect(field.value).toBe("ABCDEF");
  });

  it("uses a captured selection for one insertion only", async () => {
    const { field, insert } = await openPinnedPickerOver("ABCDEF", 0, 3);

    insert();
    await vi.waitFor(() => expect(field.value).toBe("ReplyDEF"));
    await new Promise((resolve) => setTimeout(resolve, 20));

    insert();
    // Where the live caret sits after a programmatic focus is the browser's
    // business (happy-dom moves it to the end; Chromium keeps it). What must
    // not happen is the old offsets being reused over the first insertion,
    // which produced "ReplylyDEF".
    await vi.waitFor(() => expect(field.value).toHaveLength("ReplyReplyDEF".length));
    expect(field.value.split("Reply")).toHaveLength(3);
    expect(field.value).toContain("DEF");
  });
});
