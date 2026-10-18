// @vitest-environment happy-dom
//
// Task 037 Addendum D, found again in the owner's Chinese QA on 2026-09-11:
// the full-Field and too-long notices must speak the chosen language. They
// used to render English constants straight from the core.

import { render } from "preact";
import { afterEach, expect, it, onTestFinished, vi } from "vitest";
import { createInitialFillNestState, type FillNestState } from "../../src/storage/fillnest-repository";
import { InlinePicker } from "../../src/ui/picker/InlinePicker";
import type { RuntimeRequest } from "../../src/messages/runtime-messages";

const root = document.createElement("div");
document.body.append(root);

afterEach(async () => {
  render(null, root);
  await new Promise((resolve) => setTimeout(resolve, 50));
  vi.unstubAllGlobals();
});

function fullField(): FillNestState {
  const templates = Array.from({ length: 20 }, (_, index) => ({
    id: `t-${index}`,
    content: `Template ${index}`,
    siteAffinities: ["example.test"],
    createdAt: "2026-09-11T00:00:00.000Z",
    updatedAt: "2026-09-11T00:00:00.000Z",
    totalUsageCount: 0,
    revision: 0,
  }));
  return {
    ...createInitialFillNestState(),
    sites: [{ id: "example.test" }],
    pageProfiles: [{ id: "page", siteId: "example.test", identityKey: "/form" }],
    fieldProfiles: [{ id: "field", pageProfileId: "page", identityKey: "field" }],
    templates,
    bindings: templates.map((template, index) => ({
      id: `b-${index}`,
      templateId: template.id,
      pageProfileId: "page",
      fieldProfileId: "field",
      createdAt: "2026-09-11T00:00:00.000Z",
      usageCount: 0,
      revision: 0,
    })),
  };
}

function drawPicker(state: FillNestState): void {
  vi.stubGlobal("chrome", {
    runtime: {
      sendMessage: vi.fn(async (request: RuntimeRequest) =>
        request.type === "GET_LANGUAGE" ? { ok: true, value: "zh-Hans" } : { ok: true, value: state },
      ),
      onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
    },
  });
  vi.stubGlobal("location", new URL("https://example.test/form"));
  render(
    <InlinePicker
      targetField={document.createElement("input")}
      siteId="example.test"
      pageProfileId="page"
      fieldProfileId="field"
      pageIdentityKey="/form"
      fieldIdentityKey="field"
      onInsert={() => undefined}
      onClose={() => undefined}
      pinned={false}
      onPinnedChange={() => undefined}
      pickerPosition={null}
      onPickerPositionChange={() => undefined}
      lastAction={null}
      onLastActionChange={() => undefined}
      targetFieldActionable={true}
      insertionRejected={false}
      insertionRejectionNotice={null}
      onCopyToClipboard={async () => true}
      bindingSupported={true}
    />,
    root,
  );
}

async function openNewTemplate(): Promise<void> {
  const create = await vi.waitFor(() => {
    const button = [...root.querySelectorAll("button")].find((candidate) => candidate.textContent?.includes("新建模版"));
    if (!button) throw new Error("Picker not rendered in Chinese yet");
    return button;
  });
  create.click();
}

// Codex review, 2026-09-13: the Picker sits inside a page whose own `lang`
// says nothing about FillNest's words.
it("tells assistive technology its words are Chinese", async () => {
  drawPicker(fullField());
  await openNewTemplate();
  expect(root.querySelector(".picker")?.getAttribute("lang")).toBe("zh-Hans");
});

it("says a full Field is full, in Chinese", async () => {
  drawPicker(fullField());
  await openNewTemplate();
  await vi.waitFor(() => expect(root.textContent).toContain("这个输入框已达到 20 个模版上限"));
  expect(root.textContent).not.toContain("which is the most FillNest keeps");
});

it("says a Template is too long, in Chinese", async () => {
  drawPicker({ ...createInitialFillNestState(), sites: [{ id: "example.test" }] });
  await openNewTemplate();
  const editor = await vi.waitFor(() => {
    const textarea = root.querySelector<HTMLTextAreaElement>('textarea[aria-label="模版内容"]');
    if (!textarea) throw new Error("Editor not open yet");
    return textarea;
  });
  editor.value = "字".repeat(1001);
  editor.setSelectionRange(1001, 1001);
  editor.dispatchEvent(new InputEvent("input", { bubbles: true }));

  // Task 035 Addendum A: the character past the limit never goes in.
  await vi.waitFor(() => expect(root.textContent).toContain("模版字数已达到上限。"));
  expect(editor.value).toBe("字".repeat(1000));
  expect(root.textContent).not.toContain("This Template is too long");
});

it("waits for an input method's composition to finish before cutting", async () => {
  // Chromium has no `oncompositionend` property; happy-dom does, and that hid
  // a handler Chromium never ran (owner QA, 2026-09-11). Take it away so this
  // test sees what Chromium sees.
  const descriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "oncompositionend");
  delete (HTMLElement.prototype as unknown as Record<string, unknown>).oncompositionend;
  onTestFinished(() => {
    if (descriptor) Object.defineProperty(HTMLElement.prototype, "oncompositionend", descriptor);
  });
  expect("oncompositionend" in document.createElement("textarea")).toBe(false);
  drawPicker({ ...createInitialFillNestState(), sites: [{ id: "example.test" }] });
  await openNewTemplate();
  const editor = await vi.waitFor(() => {
    const textarea = root.querySelector<HTMLTextAreaElement>('textarea[aria-label="模版内容"]');
    if (!textarea) throw new Error("Editor not open yet");
    return textarea;
  });
  const composing = "字".repeat(1002);
  editor.value = composing;
  editor.setSelectionRange(1002, 1002);
  editor.dispatchEvent(new InputEvent("input", { bubbles: true, isComposing: true }));
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(editor.value).toBe(composing);

  editor.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true }));
  await vi.waitFor(() => expect(editor.value).toBe("字".repeat(1000)));
});

// Task 040: the service worker names candidate Fields in English, as sort
// keys; the share Finder shows them in the reader's language.
it("names the fields it offers to share with in Chinese", async () => {
  const state: FillNestState = {
    ...createInitialFillNestState(),
    sites: [{ id: "example.test" }],
    pageProfiles: [
      { id: "page", siteId: "example.test", identityKey: "/form" },
      { id: "other", siteId: "example.test", identityKey: "/" },
    ],
    fieldProfiles: [
      { id: "field", pageProfileId: "page", identityKey: "field" },
      { id: "candidate", pageProfileId: "other", identityKey: JSON.stringify({ semanticKind: "email", ordinal: 0 }) },
    ],
  };
  vi.stubGlobal("chrome", {
    runtime: {
      sendMessage: vi.fn(async (request: RuntimeRequest) => {
        if (request.type === "GET_LANGUAGE") return { ok: true, value: "zh-Hans" };
        if (request.type === "FIND_SIMILAR_FIELD_CANDIDATES") {
          return {
            ok: true,
            value: {
              currentFieldLabel: "Text field",
              suggestedFieldProfileId: null,
              suggestedGroupFieldProfileIds: [],
              candidates: [
                {
                  fieldProfileId: "candidate",
                  siteId: "example.test",
                  pageProfileId: "other",
                  siteLabel: "example.test",
                  pageLabel: "Home",
                  fieldLabel: "Email",
                  crossSite: false,
                  highConfidence: false,
                  decided: false,
                  alreadyLinked: false,
                  templateCount: 0,
                  templatePreviews: [],
                  existingSetId: null,
                },
              ],
            },
          };
        }
        return { ok: true, value: state };
      }),
      onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
    },
  });
  vi.stubGlobal("location", new URL("https://example.test/form"));
  render(
    <InlinePicker
      targetField={document.createElement("input")}
      siteId="example.test"
      pageProfileId="page"
      fieldProfileId="field"
      pageIdentityKey="/form"
      fieldIdentityKey="field"
      onInsert={() => undefined}
      onClose={() => undefined}
      pinned={false}
      onPinnedChange={() => undefined}
      pickerPosition={null}
      onPickerPositionChange={() => undefined}
      lastAction={null}
      onLastActionChange={() => undefined}
      targetFieldActionable={true}
      insertionRejected={false}
      insertionRejectionNotice={null}
      onCopyToClipboard={async () => true}
      bindingSupported={true}
    />,
    root,
  );
  const shareWith = await vi.waitFor(() => {
    const button = root.querySelector<HTMLButtonElement>('button[aria-label="共享给…"]');
    if (!button) throw new Error("Picker not rendered in Chinese yet");
    return button;
  });
  shareWith.click();
  // Fields on other pages are offered through the Finder's search.
  const search = await vi.waitFor(() => {
    const input = root.querySelector<HTMLInputElement>('input[aria-label="搜索输入框"]');
    if (!input) throw new Error("Finder not open yet");
    return input;
  });
  search.value = "邮箱";
  search.dispatchEvent(new InputEvent("input", { bubbles: true }));

  await vi.waitFor(() => expect(root.textContent).toContain("邮箱"));
  expect(root.textContent).toContain("首页");
  expect(root.textContent).not.toContain("Email");
  expect(root.textContent).not.toContain("Home");
});
