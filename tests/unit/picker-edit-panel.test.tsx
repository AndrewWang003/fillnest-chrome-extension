// @vitest-environment happy-dom

import { render } from "preact";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createInitialFillNestState, type FillNestState } from "../../src/storage/fillnest-repository";
import { InlinePicker } from "../../src/ui/picker/InlinePicker";

// Owner QA 2026-09-14. Editing a Template opens its own panel, as New template
// does, rather than an editor squeezed into the row; the full-text flyout
// never covers it; and its Save buttons stay in the Tab order while there is
// nothing to save yet, instead of vanishing from it.

const LONG = "Please review the attached draft.\n".repeat(8);

function state(): FillNestState {
  const business = createInitialFillNestState();
  business.sites = [{ id: "example.test" }];
  business.pageProfiles = [{ id: "page", siteId: "example.test", identityKey: "/form" }];
  business.fieldProfiles = [{ id: "field", pageProfileId: "page", identityKey: "field", observedTitle: "Reply" }];
  business.templates = [
    { id: "t1", content: LONG, siteAffinities: ["example.test"], createdAt: "x", updatedAt: "x", totalUsageCount: 0, revision: 0 },
    { id: "t2", content: "Short one", siteAffinities: ["example.test"], createdAt: "x", updatedAt: "x", totalUsageCount: 0, revision: 0 },
  ];
  business.bindings = business.templates.map((template, index) => ({
    id: `b${index}`, templateId: template.id, pageProfileId: "page", fieldProfileId: "field", createdAt: "x", usageCount: 0, revision: 0,
  }));
  return business;
}

function stubChrome() {
  const sendMessage = vi.fn(async (request: { type: string }) => {
    if (request.type === "GET_LANGUAGE") return { ok: true, value: "en" };
    if (request.type === "GET_DISMISSED_TIPS") return { ok: true, value: ["picker-start"] };
    return { ok: true, value: state() };
  });
  vi.stubGlobal("chrome", { runtime: { sendMessage, onMessage: { addListener: vi.fn(), removeListener: vi.fn() } } });
  vi.stubGlobal("location", new URL("https://example.test/form"));
  return sendMessage;
}

const root = document.createElement("div");
document.body.append(root);

afterEach(async () => {
  render(null, root);
  await new Promise((resolve) => setTimeout(resolve, 40));
  vi.unstubAllGlobals();
});

function drawPicker(): void {
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

async function editFirst(): Promise<HTMLTextAreaElement> {
  await vi.waitFor(() => expect(root.querySelectorAll("[data-template-row]")).toHaveLength(2));
  const row = root.querySelector<HTMLElement>("[data-template-row]")!;
  row.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, movementX: 2 }));
  row.querySelector<HTMLButtonElement>('button[aria-label="Edit"]')!.click();
  await vi.waitFor(() => expect(root.querySelector('textarea[aria-label="Edit template content"]')).not.toBeNull());
  return root.querySelector<HTMLTextAreaElement>('textarea[aria-label="Edit template content"]')!;
}

describe("editing in the Picker", () => {
  it("opens its own panel like New template, with the editor focused", async () => {
    stubChrome();
    drawPicker();
    const editor = await editFirst();

    expect(root.querySelectorAll("[data-template-row]")).toHaveLength(0);
    expect(root.querySelector(".picker-writing")).not.toBeNull();
    expect(editor.value).toBe(LONG);
    expect(document.activeElement).toBe(editor);
  });

  it("never shows the full-text flyout over the editor", async () => {
    stubChrome();
    drawPicker();
    await editFirst();
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(root.querySelector(".preview-flyout")).toBeNull();
  });

  it("keeps Save in the Tab order while there is nothing to save, and saves nothing", async () => {
    const sendMessage = stubChrome();
    drawPicker();
    const editor = await editFirst();

    const save = [...root.querySelectorAll<HTMLButtonElement>(".picker-writing .actions button")].find((button) => button.textContent === "Save")!;
    expect(save.disabled).toBe(false);
    expect(save.getAttribute("aria-disabled")).toBe("true");
    save.click();
    expect(sendMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: "UPDATE_TEMPLATE" }));

    editor.value = `${LONG}more`;
    editor.dispatchEvent(new InputEvent("input", { bubbles: true }));
    await vi.waitFor(() => expect(save.getAttribute("aria-disabled")).toBeNull());
    save.click();
    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ type: "UPDATE_TEMPLATE" })));
  });

  it("Cancel returns to the list", async () => {
    stubChrome();
    drawPicker();
    await editFirst();
    [...root.querySelectorAll<HTMLButtonElement>(".picker-writing button")].find((button) => button.textContent === "Cancel")!.click();
    await vi.waitFor(() => expect(root.querySelectorAll("[data-template-row]")).toHaveLength(2));
    expect(root.querySelector(".picker-writing")).toBeNull();
  });
});

// Owner QA 2026-09-15: Use field content never throws away what was typed.
describe("Use field content in New template", () => {
  function drawWith(field: HTMLInputElement): void {
    render(
      <InlinePicker
        targetField={field}
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

  async function compose(): Promise<HTMLTextAreaElement> {
    await vi.waitFor(() => expect([...root.querySelectorAll("button")].some((button) => button.textContent === "New template")).toBe(true));
    [...root.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === "New template")!.click();
    await vi.waitFor(() => expect(root.querySelector('textarea[aria-label="Template content"]')).not.toBeNull());
    const box = root.querySelector<HTMLTextAreaElement>('textarea[aria-label="Template content"]')!;
    box.value = "Typed by hand";
    box.dispatchEvent(new InputEvent("input", { bubbles: true }));
    return box;
  }

  const useFieldContent = () =>
    [...root.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === "Use field content")!;

  it("does nothing when the field is empty", async () => {
    stubChrome();
    drawWith(document.createElement("input"));
    const box = await compose();
    useFieldContent().click();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(box.value).toBe("Typed by hand");
  });

  it("replacing typed text offers Undo, which brings it back", async () => {
    stubChrome();
    const field = document.createElement("input");
    field.value = "From the field";
    drawWith(field);
    const box = await compose();
    useFieldContent().click();
    await vi.waitFor(() => expect(box.value).toBe("From the field"));
    expect(root.textContent).toContain("Replaced with the field's content.");

    [...root.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === "Undo")!.click();
    await vi.waitFor(() => expect(box.value).toBe("Typed by hand"));
    expect(root.textContent).not.toContain("Replaced with the field's content.");
  });
});

