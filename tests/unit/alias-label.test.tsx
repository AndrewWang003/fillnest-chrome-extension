// @vitest-environment happy-dom

import { render } from "preact";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AliasLabel } from "../../src/ui/side-panel/TemplatesPage";

// Owner QA, 2026-09-11, and the rule from Task 036 Addendum A.3: renaming
// edits the name shown, and doing anything else without saving discards the
// rename rather than leaving it open beside the rest of the page.

const root = document.createElement("div");
document.body.append(root);

function renderLabel(onSave = vi.fn()) {
  vi.stubGlobal("chrome", {
    runtime: {
      sendMessage: vi.fn(async () => ({ ok: true, value: "en" })),
      onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
    },
  });
  render(
    <div>
      <AliasLabel displayLabel="Contact fields" currentAlias={undefined} onSave={onSave} />
      <button type="button" id="elsewhere">Elsewhere</button>
    </div>,
    root,
  );
  return onSave;
}

async function startEditing(): Promise<HTMLInputElement> {
  root.querySelector<HTMLButtonElement>('[aria-label="Rename Contact fields"]')!.click();
  await vi.waitFor(() => expect(root.querySelector(".alias-editor input")).not.toBeNull());
  return root.querySelector<HTMLInputElement>(".alias-editor input")!;
}

afterEach(async () => {
  render(null, root);
  await new Promise((resolve) => setTimeout(resolve, 20));
  vi.unstubAllGlobals();
});

describe("AliasLabel", () => {
  it("opens on the name it shows", async () => {
    renderLabel();
    expect((await startEditing()).value).toBe("Contact fields");
  });

  it("discards an unsaved rename when the pointer goes elsewhere", async () => {
    const onSave = renderLabel();
    const input = await startEditing();
    input.value = "Household bills";
    input.dispatchEvent(new InputEvent("input", { bubbles: true }));

    root.querySelector("#elsewhere")!.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));

    await vi.waitFor(() => expect(root.querySelector(".alias-editor")).toBeNull());
    expect(onSave).not.toHaveBeenCalled();
    expect(root.textContent).toContain("Contact fields");
  });

  it("discards an unsaved rename when focus moves elsewhere", async () => {
    const onSave = renderLabel();
    const input = await startEditing();
    const elsewhere = root.querySelector<HTMLButtonElement>("#elsewhere")!;

    input.dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: elsewhere }));

    await vi.waitFor(() => expect(root.querySelector(".alias-editor")).toBeNull());
    expect(onSave).not.toHaveBeenCalled();
  });

  it("stays open for its own Save, and while the window merely loses focus", async () => {
    const onSave = renderLabel();
    const input = await startEditing();
    const save = [...root.querySelectorAll<HTMLButtonElement>(".alias-editor button")].find((button) => button.textContent === "Save")!;

    input.dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: null }));
    save.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    input.dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: save }));
    expect(root.querySelector(".alias-editor")).not.toBeNull();

    input.value = "Household bills";
    input.dispatchEvent(new InputEvent("input", { bubbles: true }));
    save.click();
    expect(onSave).toHaveBeenCalledWith("Household bills");
  });
});
