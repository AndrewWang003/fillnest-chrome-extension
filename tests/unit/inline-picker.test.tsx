// @vitest-environment happy-dom

import { render } from "preact";
import { afterEach, describe, expect, it, onTestFinished, vi } from "vitest";

import type { BindingRecord } from "../../src/storage/fillnest-repository";
import {
  FIELD_TEMPLATE_COUNT_VISIBLE_FROM,
  MAX_TEMPLATES_PER_FIELD,
} from "../../src/templates/field-template-limit";
import { InlinePicker } from "../../src/ui/picker/InlinePicker";

describe("InlinePicker", () => {
  afterEach(async () => {
    // Preact defers running a mount's useEffect callbacks via a ~35ms timer
    // (see preact/hooks' requestAnimationFrame/setTimeout race). Without
    // waiting for that flush here, a still-pending effect from this test can
    // fire during a later test, after that later test's own chrome stub has
    // been swapped in or removed - surfacing as a spurious "chrome is not
    // defined" ReferenceError unrelated to whichever test happened to be
    // running when the timer fired.
    await new Promise((resolve) => setTimeout(resolve, 40));
    document.body.replaceChildren();
    vi.unstubAllGlobals();
  });

  it("keeps Template preview and contextual action in separate stable regions", async () => {
    vi.stubGlobal("chrome", {
      runtime: {
        onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
        sendMessage: vi.fn().mockResolvedValue({
          ok: true,
          value: {
            schemaVersion: 13,
            sites: [],
            templates: [{
              id: "template-1",
              content: "A long Template preview that must retain a readable text region",
              siteAffinities: ["example.test"],
              createdAt: "2026-08-14T00:00:00.000Z",
              updatedAt: "2026-08-14T00:00:00.000Z",
              totalUsageCount: 0,
            }],
            pageProfiles: [],
            fieldProfiles: [],
            bindings: [{
              id: "binding-1",
              templateId: "template-1",
              pageProfileId: "page-1",
              fieldProfileId: "field-1",
              createdAt: "2026-08-14T00:00:00.000Z",
              usageCount: 0,
            }],
            sharedTemplateSets: [],
            sharedTemplateBindings: [],
            sharedTemplateFieldStates: [],
            pickerPosition: null,
            pageStatusPosition: null,
          },
        }),
      },
    });
    const root = document.createElement("div");
    const field = document.createElement("input");
    render(
      <InlinePicker
        targetField={field}
        pageProfileId="page-1"
        fieldProfileId="field-1"
        pageIdentityKey="page-key"
        fieldIdentityKey="field-key"
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

    await vi.waitFor(() => expect(root.querySelector("[data-template-row]")).not.toBeNull());
    const row = root.querySelector("[data-template-row]");
    expect(row?.querySelector("[data-template-content] .template-preview")?.textContent).toContain("A long Template");
    const actions = row?.querySelector("[data-template-actions]");
    expect(actions).not.toBeNull();
    expect(actions?.querySelector('[aria-label="Remove from this field"]')).not.toBeNull();
    expect(row?.querySelectorAll("[data-template-actions] button").length).toBeGreaterThanOrEqual(2);
  });

  it("shows a running count only once the Field is near its Template limit, and blocks Bind at it (Task 035)", async () => {
    function stateWith(templateCount: number) {
      return {
        schemaVersion: 13,
        sites: [],
        templates: [
          ...Array.from({ length: templateCount }, (_unused, index) => ({
            id: `template-${index}`,
            content: `Template ${index}`,
            siteAffinities: [],
            createdAt: "2026-08-14T00:00:00.000Z",
            updatedAt: "2026-08-14T00:00:00.000Z",
            totalUsageCount: 0,
          })),
          // One Template this Field is not bound to, so Search has something
          // to offer and the Bind action has somewhere to be missing from.
          {
            id: "template-unbound",
            content: "Unbound template",
            siteAffinities: [],
            createdAt: "2026-08-14T00:00:00.000Z",
            updatedAt: "2026-08-14T00:00:00.000Z",
            totalUsageCount: 0,
          },
        ],
        pageProfiles: [],
        fieldProfiles: [],
        bindings: Array.from({ length: templateCount }, (_unused, index) => ({
          id: `binding-${index}`,
          templateId: `template-${index}`,
          pageProfileId: "page-1",
          fieldProfileId: "field-1",
          createdAt: "2026-08-14T00:00:00.000Z",
          usageCount: 0,
        })),
        sharedTemplateSets: [],
        sharedTemplateBindings: [],
        sharedTemplateFieldStates: [],
        pickerPosition: null,
        pageStatusPosition: null,
      };
    }

    async function drawWith(templateCount: number): Promise<HTMLElement> {
      vi.stubGlobal("chrome", {
        runtime: {
          onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
          sendMessage: vi.fn().mockResolvedValue({ ok: true, value: stateWith(templateCount) }),
        },
      });
      const root = document.createElement("div");
      const field = document.createElement("input");
      render(
        <InlinePicker
          targetField={field}
          pageProfileId="page-1"
          fieldProfileId="field-1"
          pageIdentityKey="page-key"
          fieldIdentityKey="field-key"
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
      await vi.waitFor(() => expect(root.querySelector("[data-template-row]")).not.toBeNull());
      return root;
    }

    // Comfortably below the limit: a running total would be noise on a list
    // whose length is visible at a glance.
    const quiet = await drawWith(3);
    expect(quiet.querySelector(".picker-field-count")).toBeNull();
    render(null, quiet);

    // Within five of it: the user is close enough that meeting the limit for
    // the first time as a refusal would be a surprise.
    const nearlyFull = await drawWith(FIELD_TEMPLATE_COUNT_VISIBLE_FROM);
    const count = nearlyFull.querySelector(".picker-field-count");
    expect(count?.textContent?.replace(/\s+/gu, "")).toBe(
      `${FIELD_TEMPLATE_COUNT_VISIBLE_FROM}/${MAX_TEMPLATES_PER_FIELD}`,
    );
    expect(count?.classList.contains("full")).toBe(false);
    render(null, nearlyFull);

    // At it: the count is flagged, and the Bind action is withdrawn rather
    // than left to fail against the service worker's own refusal.
    const full = await drawWith(MAX_TEMPLATES_PER_FIELD);
    expect(full.querySelector(".picker-field-count")?.classList.contains("full")).toBe(true);
    const search = full.querySelector<HTMLInputElement>('input[aria-label="Search templates"]');
    if (!search) throw new Error("Picker search box not found");
    search.value = "Unbound";
    search.dispatchEvent(new InputEvent("input", { bubbles: true }));
    await vi.waitFor(() => expect(full.textContent).toContain("All matching Templates"));
    expect(full.textContent).toContain("which is the most FillNest keeps on one field");
    expect(full.querySelector('[aria-label="Bind to this field"]')).toBeNull();
    render(null, full);
  });

  it("renders a blank Template editor and reads the Target Field only on explicit request", async () => {
    vi.stubGlobal("chrome", {
      runtime: {
        onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
        sendMessage: vi.fn().mockResolvedValue({
          ok: true,
          value: {
            schemaVersion: 13,
            sites: [],
            templates: [],
            pageProfiles: [],
            fieldProfiles: [],
          bindings: [],
          sharedBindings: [],
            sharedTemplateSets: [],
            sharedTemplateBindings: [],
            sharedTemplateFieldStates: [],
            pickerPosition: null,
            pageStatusPosition: null,
          },
        }),
      },
    });
    history.replaceState({}, "", "/profile");
    const targetField = document.createElement("input");
    const nativeValue = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    );
    if (!nativeValue?.get || !nativeValue.set) throw new Error("Native value accessors unavailable");
    nativeValue.set.call(targetField, "private field content");
    let reads = 0;
    Object.defineProperty(targetField, "value", {
      configurable: true,
      get() {
        reads += 1;
        return nativeValue.get?.call(this) as string;
      },
      set(value: string) {
        nativeValue.set?.call(this, value);
      },
    });
    const root = document.createElement("div");
    document.body.append(root);

    render(
      <InlinePicker
        targetField={targetField}
        pageProfileId="page-1"
        fieldProfileId="field-1"
        pageIdentityKey="page-key"
        fieldIdentityKey="field-key"
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
    await Promise.resolve();

    clickButton(root, "New template");
    await Promise.resolve();
    const editor = root.querySelector<HTMLTextAreaElement>(
      'textarea[aria-label="Template content"]',
    );
    expect(editor?.value).toBe("");
    expect(reads).toBe(0);

    clickButton(root, "Use field content");
    await Promise.resolve();
    expect(editor?.value).toBe("private field content");
    expect(reads).toBe(1);
  });

  it("creates a Template already bound and reports its Global-template consequence when removed", async () => {
    let state = {
      schemaVersion: 13 as const,
      compatibilityPairDecisions: [],
      sites: [],
      templates: [] as Array<{ id: string; content: string; siteAffinities: string[]; createdAt: string; updatedAt: string; totalUsageCount: number }>,
      pageProfiles: [],
      fieldProfiles: [],
      bindings: [] as Array<{ id: string; templateId: string; pageProfileId: string; fieldProfileId: string; createdAt: string; usageCount: number }>,
      sharedTemplateSets: [],
      sharedTemplateBindings: [],
      sharedTemplateFieldStates: [],
      pickerPosition: null as { top: number; left: number } | null,
    };
    const sendMessage = vi.fn(async (request: { type: string }) => {
      if (request.type === "CREATE_TEMPLATE_AND_BIND") {
        state = {
          ...state,
          templates: [
            {
              id: "template-created",
              content: "Created for this field",
              siteAffinities: ["localhost"],
              createdAt: "2026-08-13T11:00:00.000Z",
              updatedAt: "2026-08-13T11:00:00.000Z",
              totalUsageCount: 0,
            },
          ],
          bindings: [
            {
              id: "binding-created",
              templateId: "template-created",
              pageProfileId: "page-1",
              fieldProfileId: "field-1",
              createdAt: "2026-08-13T11:00:00.000Z",
              usageCount: 0,
            },
          ],
        };
        return { ok: true, value: { template: state.templates[0], binding: state.bindings[0] } };
      }
      if (request.type === "UNBIND_TEMPLATE") {
        state = { ...state, bindings: [] };
        return { ok: true, value: true };
      }
      return { ok: true, value: state };
    });
    vi.stubGlobal("chrome", { runtime: { sendMessage, onMessage: { addListener: vi.fn(), removeListener: vi.fn() } } });
    history.replaceState({}, "", "/profile");
    const root = document.createElement("div");
    const targetField = document.createElement("input");
    document.body.append(root, targetField);
    const onInsert = vi.fn();

    render(
      <InlinePicker
        targetField={targetField}
        pageProfileId="page-1"
        fieldProfileId="field-1"
        pageIdentityKey="page-key"
        fieldIdentityKey="field-key"
        onInsert={onInsert}
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
    await Promise.resolve();
    clickButton(root, "New template");
    await Promise.resolve();
    const editor = root.querySelector<HTMLTextAreaElement>(
      'textarea[aria-label="Template content"]',
    );
    if (!editor) throw new Error("Template editor unavailable");
    editor.value = "Created for this field";
    editor.dispatchEvent(new InputEvent("input", { bubbles: true }));
    await Promise.resolve();
    clickButton(root, "Save");
    await vi.waitFor(() => {
      expect(root.textContent).toContain("Saved and bound to this field.");
    });

    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "CREATE_TEMPLATE_AND_BIND",
        content: "Created for this field",
        fieldProfileId: "field-1",
      }),
    );
    expect(root.textContent).toContain("Saved and bound to this field.");
    expect(root.textContent).toContain("Created for this field");
    expect(onInsert).not.toHaveBeenCalled();

    clickButton(root, "Remove from this field");
    await vi.waitFor(() => {
      expect(root.textContent).toContain('Removed "Created for this field" from this field · Now in Global templates.');
    });
    expect(sendMessage).toHaveBeenCalledWith({
      type: "UNBIND_TEMPLATE",
      templateId: "template-created",
      fieldProfileId: "field-1",
    });
    expect(root.textContent).toContain('Removed "Created for this field" from this field · Now in Global templates.');
    expect(root.querySelector('[data-template-row]')).toBeNull();
    expect([...root.querySelectorAll("button")].some((button) => button.textContent?.trim() === "Delete template")).toBe(true);
    expect(root.textContent).toContain("No templates bound to this field.");
    expect(onInsert).not.toHaveBeenCalled();
  });

  it("uses the Action Outcome Bar as the only Undo entry and keeps ordinary context neutral", async () => {
    vi.stubGlobal("chrome", {
      runtime: {
        onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
        sendMessage: vi.fn().mockResolvedValue({
          ok: true,
          value: { schemaVersion: 13, sites: [], templates: [], pageProfiles: [], fieldProfiles: [], bindings: [], sharedTemplateSets: [], sharedTemplateBindings: [], sharedTemplateFieldStates: [], compatibilityPairDecisions: [], pickerPosition: null },
        }),
      },
    });
    const root = document.createElement("div");
    const field = document.createElement("input");

    render(
      <InlinePicker
        targetField={field}
        pageProfileId="page-1"
        fieldProfileId="field-1"
        pageIdentityKey="page-key"
        fieldIdentityKey="field-key"
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
    await Promise.resolve();

    expect(root.querySelector("header .undo")).toBeNull();
    // The neutral state still offers the single merged "Share with…"
    // action (Shared Template Set Add Fields and Task 024 candidate
    // discovery are now one entry point), but never an Undo button - there
    // is nothing yet to undo.
    expect(
      Array.from(root.querySelectorAll(".picker-context button")).map(
        (button) => button.getAttribute("aria-label") ?? button.textContent,
      ),
    ).toEqual(['Rename this box, currently named "this field"', "Share with…"]);
    expect(root.textContent).toContain("following focus");

    render(
      <InlinePicker
        targetField={field}
        pageProfileId="page-1"
        fieldProfileId="field-1"
        pageIdentityKey="page-key"
        fieldIdentityKey="field-key"
        onInsert={() => undefined}
        onClose={() => undefined}
        pinned={false}
        onPinnedChange={() => undefined}
        pickerPosition={null}
        onPickerPositionChange={() => undefined}
        lastAction={{
          type: "delete",
          template: {
            id: "template-1",
            content: "Deleted template",
            siteAffinities: [],
            createdAt: "2026-08-14T00:00:00.000Z",
            updatedAt: "2026-08-14T00:00:00.000Z",
            totalUsageCount: 0,
            revision: 0,
          },
        bindings: [],
        sharedBindings: [],
        fieldStates: [],
        }}
        onLastActionChange={() => undefined}
        targetFieldActionable={true}
        insertionRejected={false}
        insertionRejectionNotice={null}
        onCopyToClipboard={async () => true}
        bindingSupported={true}
      />,
      root,
    );
    await Promise.resolve();

    // The result lands in its own row, so it stays the only Undo entry
    // without burying the context row's own affordances underneath it.
    const resultRow = root.querySelector(".picker-result");
    expect(resultRow?.textContent).toContain("Deleted");
    expect(
      Array.from(resultRow?.querySelectorAll("button") ?? []).map((button) => button.textContent),
    ).toEqual(["Undo"]);
    expect(root.querySelectorAll("button")).toSatisfy(
      (buttons: NodeListOf<HTMLButtonElement>) =>
        [...buttons].filter((button) => button.textContent === "Undo").length === 1,
    );
    // Regression: a result used to hide "Share with…" entirely, leaving
    // the user no way back to it until the outcome cleared.
    expect(
      Array.from(root.querySelectorAll(".picker-context button")).map(
        (button) => button.getAttribute("aria-label") ?? button.textContent,
      ),
    ).toEqual(['Rename this box, currently named "this field"', "Share with…"]);
  });

  it("silently invalidates a pending Picker Undo when another successful state mutation is broadcast", async () => {
    let runtimeListener: ((message: unknown) => void) | undefined;
    vi.stubGlobal("chrome", {
      runtime: {
        onMessage: {
          addListener: vi.fn((listener) => { runtimeListener = listener; }),
          removeListener: vi.fn(),
        },
        sendMessage: vi.fn().mockResolvedValue({
          ok: true,
          value: { schemaVersion: 13, sites: [], templates: [], pageProfiles: [], fieldProfiles: [], bindings: [], sharedTemplateSets: [], sharedTemplateBindings: [], sharedTemplateFieldStates: [], compatibilityPairDecisions: [], pickerPosition: null },
        }),
      },
    });
    const root = document.createElement("div");
    const onLastActionChange = vi.fn();
    const field = document.createElement("input");
    render(
      <InlinePicker
        targetField={field}
        pageProfileId="page-1"
        fieldProfileId="field-1"
        pageIdentityKey="page-key"
        fieldIdentityKey="field-key"
        onInsert={() => undefined}
        onClose={() => undefined}
        pinned={false}
        onPinnedChange={() => undefined}
        pickerPosition={null}
        onPickerPositionChange={() => undefined}
        lastAction={{
          type: "delete",
          template: { id: "template-1", content: "Deleted template", siteAffinities: [], createdAt: "x", updatedAt: "x", totalUsageCount: 0, revision: 0 },
          bindings: [],
          sharedBindings: [],
          fieldStates: [],
        }}
        onLastActionChange={onLastActionChange}
        targetFieldActionable={true}
        insertionRejected={false}
        insertionRejectionNotice={null}
        onCopyToClipboard={async () => true}
        bindingSupported={true}
      />,
      root,
    );
    await vi.waitFor(() => expect(runtimeListener).toBeTypeOf("function"));
    runtimeListener?.({ type: "ACTIVATION_STATE_CHANGED" });
    expect(onLastActionChange).toHaveBeenCalledWith(null);
  });

  it("disables Target-dependent actions when no usable Field is focused", async () => {
    const sendMessage = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        schemaVersion: 13,
        sites: [],
        templates: [
          {
            id: "template-1",
            content: "Searchable template",
            siteAffinities: [],
            createdAt: "x",
            updatedAt: "x",
            totalUsageCount: 0,
          },
        ],
        pageProfiles: [],
        fieldProfiles: [],
        bindings: [] as BindingRecord[],
        sharedTemplateSets: [],
        sharedTemplateBindings: [],
        sharedTemplateFieldStates: [],
        pickerPosition: null,
        pageStatusPosition: null,
      },
    });
    vi.stubGlobal("chrome", { runtime: { sendMessage, onMessage: { addListener: vi.fn(), removeListener: vi.fn() } } });
    const root = document.createElement("div");
    const field = document.createElement("input");

    render(
      <InlinePicker
        targetField={field}
        pageProfileId="page-1"
        fieldProfileId="field-1"
        pageIdentityKey="page-key"
        fieldIdentityKey="field-key"
        onInsert={() => undefined}
        onClose={() => undefined}
        pinned={true}
        onPinnedChange={() => undefined}
        pickerPosition={{ top: 0, left: 0 }}
        onPickerPositionChange={() => undefined}
        lastAction={null}
        onLastActionChange={() => undefined}
        targetFieldActionable={false}
        insertionRejected={false}
        insertionRejectionNotice={null}
        onCopyToClipboard={async () => true}
        bindingSupported={true}
      />,
      root,
    );
    await vi.waitFor(() => expect(root.textContent).toContain("No usable field is focused"));

    const searchInput = root.querySelector<HTMLInputElement>('input[aria-label="Search templates"]');
    if (!searchInput) throw new Error("Search input not found");
    searchInput.value = "searchable";
    searchInput.dispatchEvent(new InputEvent("input", { bubbles: true }));
    await vi.waitFor(() => expect(root.querySelector('[aria-label="Bind to this field"]')).not.toBeNull());

    const bindButton = root.querySelector<HTMLButtonElement>('[aria-label="Bind to this field"]');
    expect(bindButton?.disabled).toBe(true);
    bindButton?.click();
    await Promise.resolve();
    expect(sendMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: "BIND_TEMPLATE" }));

    const newTemplateButton = [...root.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent === "New template",
    );
    expect(newTemplateButton?.disabled).toBe(true);
    newTemplateButton?.click();
    expect(sendMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "CREATE_TEMPLATE_AND_BIND" }),
    );
  });

  // Owner QA, 2026-09-11: the full-text flyout of a long Template sits beside
  // the Picker, so reaching it means leaving the list - which cleared the
  // highlight and closed the flyout before the pointer arrived.
  // Owner QA 2026-09-11: a row shows only a Template's first line, so a
  // short Template with more lines than that hid the rest with no flyout -
  // which used to open only past 120 characters.
  it("offers the full-text flyout for a short Template whose later lines the row does not show", async () => {
    const long = "First line\nSecond line\nThird";
    vi.stubGlobal("chrome", {
      runtime: {
        onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
        sendMessage: vi.fn().mockResolvedValue({
          ok: true,
          value: {
            schemaVersion: 13,
            sites: [],
            templates: [{ id: "t1", content: long, siteAffinities: [], createdAt: "x", updatedAt: "x", totalUsageCount: 0 }],
            pageProfiles: [],
            fieldProfiles: [],
            bindings: [{ id: "b1", templateId: "t1", pageProfileId: "page-1", fieldProfileId: "field-1", createdAt: "x", usageCount: 0 }],
            sharedTemplateSets: [],
            sharedTemplateBindings: [],
            sharedTemplateFieldStates: [],
            pickerPosition: null,
            pageStatusPosition: null,
          },
        }),
      },
    });
    const root = document.createElement("div");
    document.body.append(root);
    render(
      <InlinePicker
        targetField={document.createElement("input")}
        pageProfileId="page-1"
        fieldProfileId="field-1"
        pageIdentityKey="page-key"
        fieldIdentityKey="field-key"
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
    await vi.waitFor(() => expect(root.querySelector("[data-template-row]")).not.toBeNull());
    const row = root.querySelector<HTMLElement>("[data-template-row]")!;
    const flyout = () => root.querySelector<HTMLElement>(".preview-flyout");

    row.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, movementX: 3 }));
    await vi.waitFor(() => expect(flyout()).not.toBeNull());

    expect(flyout()?.textContent).toContain("Second line");
    root.remove();
  });

  // Owner QA 2026-09-11: level with the row, not with the Picker's top.
  it("puts the full-text flyout level with the row it belongs to, so the pointer moves across to it", async () => {
    const long = "First line\nSecond line\nThird";
    vi.stubGlobal("chrome", {
      runtime: {
        onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
        sendMessage: vi.fn().mockResolvedValue({
          ok: true,
          value: {
            schemaVersion: 13,
            sites: [],
            templates: [{ id: "t1", content: long, siteAffinities: [], createdAt: "x", updatedAt: "x", totalUsageCount: 0 }],
            pageProfiles: [],
            fieldProfiles: [],
            bindings: [{ id: "b1", templateId: "t1", pageProfileId: "page-1", fieldProfileId: "field-1", createdAt: "x", usageCount: 0 }],
            sharedTemplateSets: [],
            sharedTemplateBindings: [],
            sharedTemplateFieldStates: [],
            pickerPosition: null,
            pageStatusPosition: null,
          },
        }),
      },
    });
    const root = document.createElement("div");
    document.body.append(root);
    render(
      <InlinePicker
        targetField={document.createElement("input")}
        pageProfileId="page-1"
        fieldProfileId="field-1"
        pageIdentityKey="page-key"
        fieldIdentityKey="field-key"
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
    await vi.waitFor(() => expect(root.querySelector("[data-template-row]")).not.toBeNull());
    const row = root.querySelector<HTMLElement>("[data-template-row]")!;
    const flyout = () => root.querySelector<HTMLElement>(".preview-flyout");

    const rect = (top: number, height: number) => () =>
      ({ top, bottom: top + height, left: 0, right: 300, width: 300, height, x: 0, y: top, toJSON: () => ({}) }) as DOMRect;
    const picker = root.querySelector<HTMLElement>(".picker")!;
    picker.getBoundingClientRect = rect(100, 400);
    row.getBoundingClientRect = rect(260, 40);
    row.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, movementX: 3 }));
    await vi.waitFor(() => expect(flyout()).not.toBeNull());

    await vi.waitFor(() => expect(flyout()!.style.top).toBe("260px"));
    // Owner QA 2026-09-11: never taller than the Picker, and its top and
    // bottom stay within the Picker's. A 300 px flyout beside a row at 260
    // would end at 560, past the Picker's bottom at 500, so it moves up to 200.
    expect(flyout()!.style.maxHeight).toBe("300px");
    flyout()!.getBoundingClientRect = rect(260, 300);
    row.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, movementX: -3 }));
    picker.dispatchEvent(new Event("scroll"));
    await vi.waitFor(() => expect(flyout()!.style.top).toBe("200px"));

    // Beside a short Picker, the flyout is no taller than the Picker.
    picker.getBoundingClientRect = rect(100, 180);
    picker.dispatchEvent(new Event("scroll"));
    await vi.waitFor(() => expect(flyout()!.style.maxHeight).toBe("180px"));
    // Beside the Picker it does not cover it, so nothing is see-through.
    expect(flyout()!.classList.contains("covers-picker")).toBe(false);

    // Owner QA 2026-09-14: in a window too narrow for either side, the flyout
    // has to lie over the Picker. It is then half see-through until the
    // pointer is on it.
    picker.getBoundingClientRect = () =>
      ({ top: 100, bottom: 500, left: 10, right: window.innerWidth - 10, width: window.innerWidth - 20, height: 400, x: 10, y: 100, toJSON: () => ({}) });
    picker.dispatchEvent(new Event("scroll"));
    await vi.waitFor(() => expect(flyout()!.classList.contains("covers-picker")).toBe(true));
    root.remove();
  });

  it("offers no flyout for a Template the row already shows in full", async () => {
    const long = "Just one short line";
    vi.stubGlobal("chrome", {
      runtime: {
        onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
        sendMessage: vi.fn().mockResolvedValue({
          ok: true,
          value: {
            schemaVersion: 13,
            sites: [],
            templates: [{ id: "t1", content: long, siteAffinities: [], createdAt: "x", updatedAt: "x", totalUsageCount: 0 }],
            pageProfiles: [],
            fieldProfiles: [],
            bindings: [{ id: "b1", templateId: "t1", pageProfileId: "page-1", fieldProfileId: "field-1", createdAt: "x", usageCount: 0 }],
            sharedTemplateSets: [],
            sharedTemplateBindings: [],
            sharedTemplateFieldStates: [],
            pickerPosition: null,
            pageStatusPosition: null,
          },
        }),
      },
    });
    const root = document.createElement("div");
    document.body.append(root);
    render(
      <InlinePicker
        targetField={document.createElement("input")}
        pageProfileId="page-1"
        fieldProfileId="field-1"
        pageIdentityKey="page-key"
        fieldIdentityKey="field-key"
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
    await vi.waitFor(() => expect(root.querySelector("[data-template-row]")).not.toBeNull());
    const row = root.querySelector<HTMLElement>("[data-template-row]")!;
    const flyout = () => root.querySelector<HTMLElement>(".preview-flyout");

    row.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, movementX: 3 }));
    await vi.waitFor(() => expect(row.getAttribute("data-highlighted")).not.toBeNull());
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(flyout()).toBeNull();
    root.remove();
  });

  it("keeps a long Template's full-text flyout open long enough to reach it, and while it is hovered", async () => {
    const long = "Long template ".repeat(20);
    // One long line: the row's two-line clamp cuts it short. happy-dom does
    // no layout, so the clamped preview reports the overflow a browser would.
    const scrollHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollHeight");
    Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
      configurable: true,
      get(this: HTMLElement) {
        return this.classList.contains("template-preview") ? 200 : 0;
      },
    });
    onTestFinished(() => {
      if (scrollHeight) Object.defineProperty(HTMLElement.prototype, "scrollHeight", scrollHeight);
      else delete (HTMLElement.prototype as { scrollHeight?: number }).scrollHeight;
    });
    vi.stubGlobal("chrome", {
      runtime: {
        onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
        sendMessage: vi.fn().mockResolvedValue({
          ok: true,
          value: {
            schemaVersion: 13,
            sites: [],
            templates: [{ id: "t1", content: long, siteAffinities: [], createdAt: "x", updatedAt: "x", totalUsageCount: 0 }],
            pageProfiles: [],
            fieldProfiles: [],
            bindings: [{ id: "b1", templateId: "t1", pageProfileId: "page-1", fieldProfileId: "field-1", createdAt: "x", usageCount: 0 }],
            sharedTemplateSets: [],
            sharedTemplateBindings: [],
            sharedTemplateFieldStates: [],
            pickerPosition: null,
            pageStatusPosition: null,
          },
        }),
      },
    });
    const root = document.createElement("div");
    document.body.append(root);
    render(
      <InlinePicker
        targetField={document.createElement("input")}
        pageProfileId="page-1"
        fieldProfileId="field-1"
        pageIdentityKey="page-key"
        fieldIdentityKey="field-key"
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
    await vi.waitFor(() => expect(root.querySelector("[data-template-row]")).not.toBeNull());
    const row = root.querySelector<HTMLElement>("[data-template-row]")!;
    const list = row.closest("ul")!;
    const flyout = () => root.querySelector<HTMLElement>(".preview-flyout");

    row.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, movementX: 3 }));
    await vi.waitFor(() => expect(flyout()).not.toBeNull());

    // Leaving the list toward the flyout: it stays while the pointer travels.
    list.dispatchEvent(new MouseEvent("mouseleave"));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(flyout()).not.toBeNull();
    flyout()!.dispatchEvent(new MouseEvent("mouseenter"));
    await new Promise((resolve) => setTimeout(resolve, 700));
    expect(flyout()?.textContent).toContain(long.trim());

    // Leaving the flyout closes it.
    flyout()!.dispatchEvent(new MouseEvent("mouseleave"));
    await vi.waitFor(() => expect(flyout()).toBeNull());

    // Leaving the list without reaching the flyout closes it after the pause.
    row.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, movementX: 3 }));
    await vi.waitFor(() => expect(flyout()).not.toBeNull());
    list.dispatchEvent(new MouseEvent("mouseleave"));
    await vi.waitFor(() => expect(flyout()).toBeNull(), { timeout: 2000 });
    root.remove();
  });

  // Owner QA 2026-09-11, Task 036 Addendum A.3's rule made general: an
  // unsaved rename is discarded by a press anywhere else, not only by the
  // actions A.3 listed.
  it("discards an unsaved Field rename when the pointer goes elsewhere in the Picker", async () => {
    const sendMessage = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        schemaVersion: 13,
        sites: [],
        templates: [{ id: "t1", content: "First template", siteAffinities: [], createdAt: "x", updatedAt: "x", totalUsageCount: 0 }],
        pageProfiles: [{ id: "page-1", siteId: "example.test", identityKey: "/" }],
        fieldProfiles: [{ id: "field-1", pageProfileId: "page-1", observedTitle: "Reply" }],
        bindings: [{ id: "b1", templateId: "t1", pageProfileId: "page-1", fieldProfileId: "field-1", createdAt: "x", usageCount: 0 }],
        sharedTemplateSets: [],
        sharedTemplateBindings: [],
        sharedTemplateFieldStates: [],
        pickerPosition: null,
        pageStatusPosition: null,
      },
    });
    vi.stubGlobal("chrome", { runtime: { onMessage: { addListener: vi.fn(), removeListener: vi.fn() }, sendMessage } });
    const root = document.createElement("div");
    document.body.append(root);
    render(
      <InlinePicker
        targetField={document.createElement("input")}
        pageProfileId="page-1"
        fieldProfileId="field-1"
        pageIdentityKey="page-key"
        fieldIdentityKey="field-key"
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
    await vi.waitFor(() => expect(root.querySelector(".picker-field-alias-trigger")).not.toBeNull());
    root.querySelector<HTMLButtonElement>(".picker-field-alias-trigger")!.click();
    await vi.waitFor(() => expect(root.querySelector(".picker-field-alias-editor input")).not.toBeNull());
    const input = root.querySelector<HTMLInputElement>(".picker-field-alias-editor input")!;
    input.value = "Never saved";
    input.dispatchEvent(new InputEvent("input", { bubbles: true }));

    root.querySelector("[data-template-row]")!.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, composed: true }));

    await vi.waitFor(() => expect(root.querySelector(".picker-field-alias-editor")).toBeNull());
    expect(sendMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: "SET_FIELD_ALIAS" }));
    root.remove();
  });

  it("supports Arrow selection and Enter-to-insert without degrading text entry into Search", async () => {
    const onInsert = vi.fn();
    vi.stubGlobal("chrome", {
      runtime: {
        onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
        sendMessage: vi.fn().mockResolvedValue({
          ok: true,
          value: {
            schemaVersion: 13,
            sites: [],
            templates: [
              { id: "t1", content: "First template", siteAffinities: [], createdAt: "x", updatedAt: "x", totalUsageCount: 0 },
              { id: "t2", content: "Second template", siteAffinities: [], createdAt: "x", updatedAt: "x", totalUsageCount: 0 },
            ],
            pageProfiles: [],
            fieldProfiles: [],
            bindings: [
              { id: "b1", templateId: "t1", pageProfileId: "page-1", fieldProfileId: "field-1", createdAt: "x", usageCount: 0 },
              { id: "b2", templateId: "t2", pageProfileId: "page-1", fieldProfileId: "field-1", createdAt: "x", usageCount: 0 },
            ],
            sharedTemplateSets: [],
            sharedTemplateBindings: [],
            sharedTemplateFieldStates: [],
            pickerPosition: null,
            pageStatusPosition: null,
          },
        }),
      },
    });
    const root = document.createElement("div");
    const field = document.createElement("input");

    render(
      <InlinePicker
        targetField={field}
        pageProfileId="page-1"
        fieldProfileId="field-1"
        pageIdentityKey="page-key"
        fieldIdentityKey="field-key"
        onInsert={onInsert}
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
    await vi.waitFor(() => expect(root.querySelectorAll("[data-template-row]").length).toBe(2));

    const searchInput = root.querySelector<HTMLInputElement>('input[aria-label="Search templates"]');
    if (!searchInput) throw new Error("Search input not found");

    expect(root.querySelector("[data-highlighted]")).toBeNull();
    // Task 036 Addendum J, the owner's decision: with nothing selected, Enter
    // in Search inserts the first Template.
    searchInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    expect(onInsert).toHaveBeenCalledWith(expect.objectContaining({ id: "t1" }));
    onInsert.mockClear();

    searchInput.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));
    const rows = root.querySelectorAll("[data-template-row]");
    await vi.waitFor(() => expect(rows[0]?.getAttribute("data-highlighted")).not.toBeNull());

    // Typing while a row is "selected" must still land in Search, not be swallowed.
    searchInput.value = "f";
    searchInput.dispatchEvent(new InputEvent("input", { bubbles: true }));
    expect(searchInput.value).toBe("f");

    searchInput.value = "";
    searchInput.dispatchEvent(new InputEvent("input", { bubbles: true }));
    searchInput.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));
    searchInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    expect(onInsert).toHaveBeenCalledWith(expect.objectContaining({ id: "t1" }));
  });

  // Bug report: Tab from an arrow-highlighted row jumped back to the first
  // row's actions instead of continuing from the row the user actually
  // navigated to, because Up/Down only moved a visual highlight while real
  // keyboard focus stayed pinned to Search. Arrow keys must move real focus
  // onto the row itself so Tab naturally continues into that row's own
  // actions, and the roving list must span both Search and every row.
  it("moves real keyboard focus onto the highlighted row (not just a visual highlight), and Up from it returns to Search", async () => {
    vi.stubGlobal("chrome", {
      runtime: {
        onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
        sendMessage: vi.fn().mockResolvedValue({
          ok: true,
          value: {
            schemaVersion: 13,
            sites: [],
            templates: [
              { id: "t1", content: "Only template", siteAffinities: [], createdAt: "x", updatedAt: "x", totalUsageCount: 0 },
            ],
            pageProfiles: [],
            fieldProfiles: [],
            bindings: [
              { id: "b1", templateId: "t1", pageProfileId: "page-1", fieldProfileId: "field-1", createdAt: "x", usageCount: 0 },
            ],
            sharedTemplateSets: [],
            sharedTemplateBindings: [],
            sharedTemplateFieldStates: [],
            pickerPosition: null,
            pageStatusPosition: null,
          },
        }),
      },
    });
    const root = document.createElement("div");
    document.body.append(root);
    const field = document.createElement("input");

    try {
      render(
        <InlinePicker
          targetField={field}
          pageProfileId="page-1"
          fieldProfileId="field-1"
          pageIdentityKey="page-key"
          fieldIdentityKey="field-key"
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
      await vi.waitFor(() => expect(root.querySelectorAll("[data-template-row]").length).toBe(1));

      const searchInput = root.querySelector<HTMLInputElement>('input[aria-label="Search templates"]');
      if (!searchInput) throw new Error("Search input not found");
      const rowButton = root.querySelector<HTMLElement>("[data-template-row] [data-template-content]");
      if (!rowButton) throw new Error("Row template button not found");

      searchInput.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));
      expect(document.activeElement).toBe(rowButton);

      // Tab from here (browsers move focus natively; jsdom/happy-dom cannot
      // simulate real Tab traversal) would now continue from this row's own
      // position into its Edit/Bind/Unbind actions, not back to the first
      // row or Search, because real focus - not just the visual highlight -
      // now lives on the row itself.
      const editButton = root.querySelector<HTMLElement>('[aria-label="Edit"]');
      expect(rowButton.compareDocumentPosition(editButton!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

      // Up returns real focus to Search, completing the roving list.
      rowButton.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true, cancelable: true }));
      expect(document.activeElement).toBe(searchInput);
    } finally {
      root.remove();
    }
  });

  it("Down/Up move real focus across multiple rows in document order, not just the first one", async () => {
    vi.stubGlobal("chrome", {
      runtime: {
        onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
        sendMessage: vi.fn().mockResolvedValue({
          ok: true,
          value: {
            schemaVersion: 13,
            sites: [],
            templates: [
              { id: "t1", content: "First template", siteAffinities: [], createdAt: "x", updatedAt: "x", totalUsageCount: 0 },
              { id: "t2", content: "Second template", siteAffinities: [], createdAt: "x", updatedAt: "x", totalUsageCount: 0 },
            ],
            pageProfiles: [],
            fieldProfiles: [],
            bindings: [
              { id: "b1", templateId: "t1", pageProfileId: "page-1", fieldProfileId: "field-1", createdAt: "x", usageCount: 0 },
              { id: "b2", templateId: "t2", pageProfileId: "page-1", fieldProfileId: "field-1", createdAt: "x", usageCount: 0 },
            ],
            sharedTemplateSets: [],
            sharedTemplateBindings: [],
            sharedTemplateFieldStates: [],
            pickerPosition: null,
            pageStatusPosition: null,
          },
        }),
      },
    });
    const root = document.createElement("div");
    document.body.append(root);
    const field = document.createElement("input");

    try {
      render(
        <InlinePicker
          targetField={field}
          pageProfileId="page-1"
          fieldProfileId="field-1"
          pageIdentityKey="page-key"
          fieldIdentityKey="field-key"
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
      await vi.waitFor(() => expect(root.querySelectorAll("[data-template-row]").length).toBe(2));

      const searchInput = root.querySelector<HTMLInputElement>('input[aria-label="Search templates"]');
      if (!searchInput) throw new Error("Search input not found");
      const rows = root.querySelectorAll<HTMLElement>("[data-template-row]");
      const buttons = [...rows].map((row) => row.querySelector<HTMLElement>("[data-template-content]")!);

      // Task 003, restored by Task 036 Addendum J: nothing is selected until
      // the user selects it, so the first Down from Search lands on the first
      // row. Each dispatch awaits a tick after it so the resulting state
      // update commits before the next key is processed - exactly like a real
      // user's keypresses, which are never fired within the same
      // synchronous batch the way back-to-back dispatchEvent calls are.
      expect(root.querySelector("[data-highlighted]")).toBeNull();
      searchInput.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));
      await Promise.resolve();
      expect(document.activeElement).toBe(buttons[0]);

      buttons[0]!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));
      await Promise.resolve();
      expect(document.activeElement).toBe(buttons[1]);

      // Down again at the last row stays put (no wraparound).
      buttons[1]!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));
      await Promise.resolve();
      expect(document.activeElement).toBe(buttons[1]);

      buttons[1]!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true, cancelable: true }));
      await Promise.resolve();
      expect(document.activeElement).toBe(buttons[0]);

      buttons[0]!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true, cancelable: true }));
      await Promise.resolve();
      expect(document.activeElement).toBe(searchInput);
    } finally {
      root.remove();
    }
  });

  it("never inserts on Enter during IME composition, and never inserts on a modified Enter", async () => {
    const onInsert = vi.fn();
    vi.stubGlobal("chrome", {
      runtime: {
        onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
        sendMessage: vi.fn().mockResolvedValue({
          ok: true,
          value: {
            schemaVersion: 13,
            sites: [],
            templates: [
              { id: "t1", content: "First template", siteAffinities: [], createdAt: "x", updatedAt: "x", totalUsageCount: 0 },
            ],
            pageProfiles: [],
            fieldProfiles: [],
            bindings: [
              { id: "b1", templateId: "t1", pageProfileId: "page-1", fieldProfileId: "field-1", createdAt: "x", usageCount: 0 },
            ],
            sharedTemplateSets: [],
            sharedTemplateBindings: [],
            sharedTemplateFieldStates: [],
            pickerPosition: null,
            pageStatusPosition: null,
          },
        }),
      },
    });
    const root = document.createElement("div");
    const field = document.createElement("input");

    render(
      <InlinePicker
        targetField={field}
        pageProfileId="page-1"
        fieldProfileId="field-1"
        pageIdentityKey="page-key"
        fieldIdentityKey="field-key"
        onInsert={onInsert}
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
    await vi.waitFor(() => expect(root.querySelectorAll("[data-template-row]").length).toBe(1));

    const searchInput = root.querySelector<HTMLInputElement>('input[aria-label="Search templates"]');
    if (!searchInput) throw new Error("Search input not found");
    searchInput.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));
    await vi.waitFor(() =>
      expect(root.querySelector("[data-template-row]")?.getAttribute("data-highlighted")).not.toBeNull(),
    );

    searchInput.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", isComposing: true, bubbles: true, cancelable: true }),
    );
    expect(onInsert).not.toHaveBeenCalled();

    searchInput.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", keyCode: 229, bubbles: true, cancelable: true }),
    );
    expect(onInsert).not.toHaveBeenCalled();

    searchInput.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", shiftKey: true, bubbles: true, cancelable: true }),
    );
    expect(onInsert).not.toHaveBeenCalled();

    searchInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    expect(onInsert).toHaveBeenCalledWith(expect.objectContaining({ id: "t1" }));
  });

  it("offers Save everywhere vs Save a copy here only when a Template has multiple Bindings, and Save is disabled when content is unchanged", async () => {
    const state = {
      schemaVersion: 13 as const,
      compatibilityPairDecisions: [],
      sites: ["example.test"].map((id) => ({ id })),
      templates: [
        {
          id: "shared-template",
          content: "Shared reply",
          siteAffinities: ["example.test"],
          createdAt: "x",
          updatedAt: "x",
          totalUsageCount: 0,
          revision: 2,
        },
      ],
      pageProfiles: [],
      fieldProfiles: [],
      bindings: [
        { id: "binding-a", templateId: "shared-template", pageProfileId: "page-1", fieldProfileId: "field-1", createdAt: "x", usageCount: 0, revision: 0 },
        { id: "binding-b", templateId: "shared-template", pageProfileId: "page-2", fieldProfileId: "field-2", createdAt: "x", usageCount: 0, revision: 0 },
      ],
      sharedTemplateSets: [],
      sharedTemplateBindings: [],
      sharedTemplateFieldStates: [],
      pickerPosition: null,
      pageStatusPosition: null,
    };
    const sendMessage = vi.fn(async (request: { type: string; [key: string]: unknown }) => {
      if (request.type === "SAVE_TEMPLATE_COPY_FOR_FIELD") {
        return {
          ok: true,
          value: {
            template: { id: "copy-template", content: request.content, siteAffinities: ["example.test"], createdAt: "y", updatedAt: "y", totalUsageCount: 0, revision: 0 },
            binding: { id: "binding-copy", templateId: "copy-template", pageProfileId: "page-1", fieldProfileId: "field-1", createdAt: "y", usageCount: 0, revision: 0 },
          },
        };
      }
      return { ok: true, value: state };
    });
    vi.stubGlobal("chrome", { runtime: { sendMessage, onMessage: { addListener: vi.fn(), removeListener: vi.fn() } } });
    const root = document.createElement("div");
    const field = document.createElement("input");
    const onLastActionChange = vi.fn();

    render(
      <InlinePicker
        targetField={field}
        pageProfileId="page-1"
        fieldProfileId="field-1"
        pageIdentityKey="page-key"
        fieldIdentityKey="field-key"
        onInsert={() => undefined}
        onClose={() => undefined}
        pinned={false}
        onPinnedChange={() => undefined}
        pickerPosition={null}
        onPickerPositionChange={() => undefined}
        lastAction={null}
        onLastActionChange={onLastActionChange}
        targetFieldActionable={true}
        insertionRejected={false}
        insertionRejectionNotice={null}
        onCopyToClipboard={async () => true}
        bindingSupported={true}
      />,
      root,
    );
    await vi.waitFor(() => expect(root.querySelector("[data-template-row]")).not.toBeNull());

    clickButton(root, "Edit");
    await Promise.resolve();
    expect(root.textContent).toContain("Save everywhere");
    expect(root.textContent).toContain("Save a copy here");
    expect([...root.querySelectorAll("button")].some((button) => button.textContent?.trim() === "Save")).toBe(
      false,
    );

    const editSaveEverywhere = [...root.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "Save everywhere",
    );
    // Content unchanged yet: unavailable, but still in the Tab order (owner QA 2026-09-14).
    expect(editSaveEverywhere?.getAttribute("aria-disabled")).toBe("true");
    expect(editSaveEverywhere?.hasAttribute("disabled")).toBe(false);

    const editor = root.querySelector<HTMLTextAreaElement>('textarea[aria-label="Edit template content"]');
    if (!editor) throw new Error("Editor not found");
    editor.value = "Shared reply edited";
    editor.dispatchEvent(new InputEvent("input", { bubbles: true }));
    await Promise.resolve();
    expect(editSaveEverywhere?.getAttribute("aria-disabled")).toBeNull();

    clickButton(root, "Save a copy here");
    await vi.waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "SAVE_TEMPLATE_COPY_FOR_FIELD",
          templateId: "shared-template",
          fieldProfileId: "field-1",
          content: "Shared reply edited",
        }),
      ),
    );

    await vi.waitFor(() =>
      expect(onLastActionChange).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "save-copy",
          copyTemplateId: "copy-template",
          copyTemplate: expect.objectContaining({ content: "Shared reply edited" }),
          originalBinding: expect.objectContaining({ id: "binding-a" }),
        }),
      ),
    );
    expect(root.textContent).toContain('Saved a copy of "Shared reply edited" for this field.');
  });

  it("copies an edited shared Template into the current Shared Template Set instead of a dormant Field Binding", async () => {
    let state = {
      schemaVersion: 13 as const,
      compatibilityPairDecisions: [],
      sites: [{ id: "example.test" }],
      templates: [{ id: "template-1", content: "Shared reply", siteAffinities: ["example.test", "other.test"], createdAt: "x", updatedAt: "x", totalUsageCount: 0, revision: 0 }],
      pageProfiles: [{ id: "page-1", siteId: "example.test" }],
      fieldProfiles: [
        { id: "field-1", pageProfileId: "page-1", observedTitle: "Primary name" },
        { id: "field-2", pageProfileId: "page-1", observedTitle: "Secondary name" },
      ],
      bindings: [
        { id: "dormant-1", templateId: "template-1", pageProfileId: "page-1", fieldProfileId: "field-1", createdAt: "x", usageCount: 0, revision: 0 },
      ],
      sharedTemplateSets: [{ id: "set-1", siteId: "example.test", name: "Names", memberFieldProfileIds: ["field-1", "field-2"] }],
      sharedTemplateBindings: [{ id: "shared-1", setId: "set-1", templateId: "template-1", usageCount: 0, revision: 0, order: 0 }],
      sharedTemplateFieldStates: [],
      pickerPosition: null,
      pageStatusPosition: null,
    };
    const sendMessage = vi.fn(async (request: { type: string; content?: string }) => {
      if (request.type === "SAVE_TEMPLATE_COPY_FOR_SHARED_SET") {
        const copy = { id: "copy-1", content: request.content ?? "", siteAffinities: ["example.test"], createdAt: "y", updatedAt: "y", totalUsageCount: 0, revision: 0 };
        const sharedBinding = { id: "shared-copy", setId: "set-1", templateId: "copy-1", usageCount: 0, revision: 0, order: 0 };
        state = {
          ...state,
          templates: [...state.templates, copy],
          sharedTemplateBindings: [sharedBinding],
        };
        return { ok: true, value: { template: copy, sharedBinding } };
      }
      return { ok: true, value: state };
    });
    vi.stubGlobal("chrome", { runtime: { sendMessage, onMessage: { addListener: vi.fn(), removeListener: vi.fn() } } });
    const root = document.createElement("div");
    const field = document.createElement("input");
    render(
      <InlinePicker
        targetField={field}
        siteId="example.test"
        pageProfileId="page-1"
        fieldProfileId="field-1"
        pageIdentityKey="page-key"
        fieldIdentityKey="field-key"
        fieldObservedTitle="Primary name"
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

    await vi.waitFor(() => expect(root.textContent).toContain("Shared reply"));
    clickButton(root, "Edit");
    await vi.waitFor(() => expect(root.textContent).toContain("Save for shared fields"));
    expect(root.textContent).toContain("Save for this field");
    const editor = root.querySelector<HTMLTextAreaElement>('textarea[aria-label="Edit template content"]');
    if (!editor) throw new Error("Editor not found");
    editor.value = "Set-only edited reply";
    editor.dispatchEvent(new InputEvent("input", { bubbles: true }));
    await Promise.resolve();
    clickButton(root, "Save for shared fields");

    await vi.waitFor(() => expect(root.textContent).toContain("Set-only edited reply"));
    expect(sendMessage).toHaveBeenCalledWith({
      type: "SAVE_TEMPLATE_COPY_FOR_SHARED_SET",
      slotId: "shared-1",
      setId: "set-1",
      content: "Set-only edited reply",
    });
    expect(state.bindings).toEqual(expect.arrayContaining([expect.objectContaining({ id: "dormant-1" })]));
  });

  it("does not offer a field-local copy while editing an unbound Search result", async () => {
    const state = {
      schemaVersion: 13 as const,
      compatibilityPairDecisions: [],
      sites: [{ id: "example.test" }],
      templates: [{ id: "template-1", content: "Reusable elsewhere", siteAffinities: ["example.test"], createdAt: "x", updatedAt: "x", totalUsageCount: 0, revision: 0 }],
      pageProfiles: [{ id: "page-1", siteId: "example.test" }, { id: "page-2", siteId: "example.test" }],
      fieldProfiles: [{ id: "field-1", pageProfileId: "page-1" }, { id: "field-2", pageProfileId: "page-2" }, { id: "field-3", pageProfileId: "page-2" }],
      bindings: [
        { id: "binding-2", templateId: "template-1", pageProfileId: "page-2", fieldProfileId: "field-2", createdAt: "x", usageCount: 0, revision: 0 },
        { id: "binding-3", templateId: "template-1", pageProfileId: "page-2", fieldProfileId: "field-3", createdAt: "x", usageCount: 0, revision: 0 },
      ],
      sharedTemplateSets: [],
      sharedTemplateBindings: [],
      sharedTemplateFieldStates: [],
      pickerPosition: null,
      pageStatusPosition: null,
    };
    vi.stubGlobal("chrome", { runtime: { sendMessage: vi.fn().mockResolvedValue({ ok: true, value: state }), onMessage: { addListener: vi.fn(), removeListener: vi.fn() } } });
    const root = document.createElement("div");
    render(
      <InlinePicker
        targetField={document.createElement("input")}
        pageProfileId="page-1"
        fieldProfileId="field-1"
        pageIdentityKey="page-key"
        fieldIdentityKey="field-key"
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
    const search = await vi.waitFor(() => {
      const found = root.querySelector<HTMLInputElement>('input[aria-label="Search templates"]');
      if (!found) throw new Error("Template Search not found");
      return found;
    });
    search.value = "Reusable";
    search.dispatchEvent(new InputEvent("input", { bubbles: true }));
    await vi.waitFor(() => expect(root.textContent).toContain("Reusable elsewhere"));
    clickButton(root, "Edit");
    await vi.waitFor(() => expect(root.querySelector('textarea[aria-label="Edit template content"]')).not.toBeNull());
    expect(root.textContent).toContain("Save everywhere");
    expect(root.textContent).not.toContain("Save a copy here");
    expect(root.textContent).not.toContain("Save a copy for shared fields");
  });

  // Task 023 Addendum B. The Search box carried `aria-activedescendant` while
  // nothing in the Picker had the combobox/listbox/option roles that attribute
  // requires, so assistive technology ignored it. Adding those roles would be
  // wrong: the rows contain their own buttons, and ARIA forbids interactive
  // descendants inside `role="option"`. Real focus movement is what announces
  // the highlighted row, so this asserts the mechanism that works and that the
  // inert attribute is gone.
  it("moves real focus to the highlighted row and claims no combobox pattern", async () => {
    const state = {
      schemaVersion: 13 as const,
      compatibilityPairDecisions: [],
      sites: [{ id: "example.test" }],
      templates: [
        { id: "t1", content: "First reply", siteAffinities: ["example.test"], createdAt: "x", updatedAt: "x", totalUsageCount: 2, revision: 0 },
        { id: "t2", content: "Second reply", siteAffinities: ["example.test"], createdAt: "x", updatedAt: "x", totalUsageCount: 1, revision: 0 },
      ],
      pageProfiles: [],
      fieldProfiles: [],
      bindings: [
        { id: "b1", templateId: "t1", pageProfileId: "page-1", fieldProfileId: "field-1", createdAt: "x", usageCount: 2, revision: 0 },
        { id: "b2", templateId: "t2", pageProfileId: "page-1", fieldProfileId: "field-1", createdAt: "x", usageCount: 1, revision: 0 },
      ],
      sharedTemplateSets: [],
      sharedTemplateBindings: [],
      sharedTemplateFieldStates: [],
      pickerPosition: null,
      pageStatusPosition: null,
    };
    vi.stubGlobal("chrome", { runtime: { sendMessage: vi.fn().mockResolvedValue({ ok: true, value: state }), onMessage: { addListener: vi.fn(), removeListener: vi.fn() } } });
    const root = document.createElement("div");
    document.body.append(root);
    const field = document.createElement("input");
    document.body.append(field);

    render(
      <InlinePicker
        targetField={field}
        pageProfileId="page-1"
        fieldProfileId="field-1"
        pageIdentityKey="page-key"
        fieldIdentityKey="field-key"
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
    await vi.waitFor(() => expect(root.querySelector("[data-template-row]")).not.toBeNull());

    const search = root.querySelector<HTMLInputElement>('input[aria-label="Search templates"]');
    if (!search) throw new Error("Search box not found");

    // Inert without the roles it depends on, so it must not be claimed.
    expect(search.getAttribute("aria-activedescendant")).toBeNull();
    expect(root.querySelector('[role="combobox"], [role="listbox"], [role="option"]')).toBeNull();

    search.focus();
    search.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));

    await vi.waitFor(() => {
      if (!document.activeElement?.hasAttribute("data-template-content")) {
        throw new Error("Arrow key did not move real focus onto a row");
      }
    });
  });

  it("orders both This field and All templates results by the accepted default (usage descending), and Search also filters This field", async () => {
    const state = {
      schemaVersion: 13 as const,
      compatibilityPairDecisions: [],
      sites: [{ id: "example.test" }],
      templates: [
        { id: "low", content: "Low usage reply", siteAffinities: ["example.test"], createdAt: "x", updatedAt: "x", totalUsageCount: 1, revision: 0 },
        { id: "high", content: "High usage reply", siteAffinities: ["example.test"], createdAt: "x", updatedAt: "x", totalUsageCount: 5, revision: 0 },
        { id: "mid", content: "Mid usage reply", siteAffinities: ["example.test"], createdAt: "x", updatedAt: "x", totalUsageCount: 3, revision: 0 },
        { id: "unbound-low", content: "Unbound low", siteAffinities: [], createdAt: "x", updatedAt: "x", totalUsageCount: 1, revision: 0 },
        { id: "unbound-high", content: "Unbound high", siteAffinities: [], createdAt: "x", updatedAt: "x", totalUsageCount: 9, revision: 0 },
      ],
      pageProfiles: [],
      fieldProfiles: [],
      // Task 003: an automatically-ordered Field ranks by *its own* Binding
      // usage, while the library-wide list ranks by the Template's total. The
      // two are deliberately opposed here, so this test says which rule each
      // list follows instead of passing under either.
      bindings: [
        { id: "b-low", templateId: "low", pageProfileId: "page-1", fieldProfileId: "field-1", createdAt: "x", usageCount: 5, revision: 0 },
        { id: "b-high", templateId: "high", pageProfileId: "page-1", fieldProfileId: "field-1", createdAt: "x", usageCount: 1, revision: 0 },
        { id: "b-mid", templateId: "mid", pageProfileId: "page-1", fieldProfileId: "field-1", createdAt: "x", usageCount: 3, revision: 0 },
      ],
      sharedTemplateSets: [],
      sharedTemplateBindings: [],
      sharedTemplateFieldStates: [],
      pickerPosition: null,
      pageStatusPosition: null,
    };
    vi.stubGlobal("chrome", { runtime: { sendMessage: vi.fn().mockResolvedValue({ ok: true, value: state }), onMessage: { addListener: vi.fn(), removeListener: vi.fn() } } });
    const root = document.createElement("div");
    const field = document.createElement("input");

    render(
      <InlinePicker
        targetField={field}
        pageProfileId="page-1"
        fieldProfileId="field-1"
        pageIdentityKey="page-key"
        fieldIdentityKey="field-key"
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
    await vi.waitFor(() => expect(root.querySelector("[data-template-row]")).not.toBeNull());

    const rowOrder = () =>
      [...root.querySelectorAll("[data-template-content]")].map((node) => node.textContent);
    // This Field has never been reordered, so it is ranked by Binding usage:
    // Low(5), Mid(3), High(1) - the reverse of the Templates' totals.
    expect(rowOrder()).toEqual(["Low usage reply", "Mid usage reply", "High usage reply"]);

    const searchInput = root.querySelector<HTMLInputElement>('input[aria-label="Search templates"]');
    if (!searchInput) throw new Error("Search input not found");

    // Searching "usage" matches all three bound Templates and both unbound
    // ones; This field stays default-ordered and All templates is filtered
    // to just the two Unbound results, also default-ordered.
    searchInput.value = "unbound";
    searchInput.dispatchEvent(new InputEvent("input", { bubbles: true }));
    await vi.waitFor(() => expect(root.textContent).toContain("Unbound high"));
    expect(root.textContent).not.toContain("Low usage reply");
    expect(root.textContent).not.toContain("This field");
    expect(rowOrder()).toEqual(["Unbound high", "Unbound low"]);

    // Search also narrows the This field group, not just All templates.
    searchInput.value = "high";
    searchInput.dispatchEvent(new InputEvent("input", { bubbles: true }));
    await vi.waitFor(() => expect(root.textContent).toContain("This field"));
    expect(root.textContent).toContain("High usage reply");
    expect(root.textContent).not.toContain("Low usage reply");
    expect(root.textContent).not.toContain("Mid usage reply");
  });

  it("flags a Template inserted more than once into the same field, and resets when the field changes", async () => {
    const state = {
      schemaVersion: 13 as const,
      compatibilityPairDecisions: [],
      sites: [{ id: "example.test" }],
      templates: [
        { id: "template-1", content: "Reusable reply", siteAffinities: ["example.test"], createdAt: "x", updatedAt: "x", totalUsageCount: 0, revision: 0 },
      ],
      pageProfiles: [],
      fieldProfiles: [],
      bindings: [
        { id: "binding-1", templateId: "template-1", pageProfileId: "page-1", fieldProfileId: "field-1", createdAt: "x", usageCount: 0, revision: 0 },
      ],
      sharedTemplateSets: [],
      sharedTemplateBindings: [],
      sharedTemplateFieldStates: [],
      pickerPosition: null,
      pageStatusPosition: null,
    };
    vi.stubGlobal("chrome", { runtime: { sendMessage: vi.fn().mockResolvedValue({ ok: true, value: state }), onMessage: { addListener: vi.fn(), removeListener: vi.fn() } } });
    const root = document.createElement("div");
    const field = document.createElement("input");
    const onInsert = vi.fn();

    const { rerender } = renderPicker(root, {
      targetField: field,
      fieldProfileId: "field-1",
      onInsert,
    });
    await vi.waitFor(() => expect(root.querySelector("[data-template-row]")).not.toBeNull());

    const row = () => root.querySelector("[data-template-row]");
    expect(row()?.hasAttribute("data-repeat-inserted")).toBe(false);

    clickButton(root, "Reusable reply");
    expect(onInsert).toHaveBeenCalledTimes(1);
    expect(row()?.hasAttribute("data-repeat-inserted")).toBe(false);
    expect(root.textContent).not.toContain("times into this field");

    clickButton(root, "Reusable reply");
    expect(onInsert).toHaveBeenCalledTimes(2);
    await vi.waitFor(() => expect(row()?.getAttribute("data-repeat-inserted")).toBe("true"));
    expect(root.textContent).toContain('Inserted "Reusable reply" 2 times into this field.');

    // Switching to a different field resets the per-field warning (and, since
    // nothing is bound to field-2 in this fixture, the row itself disappears).
    rerender({ targetField: field, fieldProfileId: "field-2", onInsert });
    await vi.waitFor(() => expect(root.querySelector("[data-repeat-inserted]")).toBeNull());
    await vi.waitFor(() => expect(root.textContent).not.toContain("times into this field"));
  });

  describe("Task 005: deliberate Search without recommendation", () => {
    function siteScopedState() {
      return {
        schemaVersion: 13 as const,
        compatibilityPairDecisions: [],
        sites: [{ id: "example.test" }, { id: "other.test" }],
        templates: [
          { id: "same-site", content: "Same-site reply", siteAffinities: ["example.test"], createdAt: "x", updatedAt: "x", totalUsageCount: 1, revision: 0 },
          { id: "other-site", content: "Other-site reply", siteAffinities: ["other.test"], createdAt: "x", updatedAt: "x", totalUsageCount: 1, revision: 0 },
          { id: "global", content: "Global reply", siteAffinities: [], createdAt: "x", updatedAt: "x", totalUsageCount: 1, revision: 0 },
        ],        pageProfiles: [{ id: "page-1", siteId: "example.test" }],
        fieldProfiles: [],
        bindings: [] as BindingRecord[],
        sharedTemplateSets: [],
        sharedTemplateBindings: [],
        sharedTemplateFieldStates: [],
        pickerPosition: null,
        pageStatusPosition: null,
      };
    }

    it("Search shows every literal match, with this Field's bound Templates first and visible Site labels for affiliated results", async () => {
      const state = siteScopedState();
      state.templates.push({
        id: "bound",
        content: "Bound reply",
        siteAffinities: ["example.test"],
        createdAt: "x",
        updatedAt: "x",
        totalUsageCount: 0,
        revision: 0,
      });
      state.bindings = [{
        id: "binding-1",
        templateId: "bound",
        pageProfileId: "page-1",
        fieldProfileId: "field-1",
        createdAt: "x",
        usageCount: 0,
        revision: 0,
      }];
      vi.stubGlobal("chrome", {
        runtime: { sendMessage: vi.fn().mockResolvedValue({ ok: true, value: state }), onMessage: { addListener: vi.fn(), removeListener: vi.fn() } },
      });
      const root = document.createElement("div");
      const field = document.createElement("input");
      render(
        <InlinePicker
          targetField={field}
          pageProfileId="page-1"
          fieldProfileId="field-1"
          pageIdentityKey="page-key"
          fieldIdentityKey="field-key"
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
      await vi.waitFor(() => expect(root.textContent).toContain("Bound reply"));

      const searchInput = root.querySelector<HTMLInputElement>('input[aria-label="Search templates"]');
      if (!searchInput) throw new Error("Search input not found");
      searchInput.value = "reply";
      searchInput.dispatchEvent(new InputEvent("input", { bubbles: true }));

      await vi.waitFor(() => expect(root.textContent).toContain("Other-site reply"));
      expect(root.textContent).toContain("Bound reply");
      expect(root.textContent).toContain("Same-site reply");
      expect(root.textContent).toContain("Global reply");
      expect(root.textContent).not.toContain("more result from other Sites");

      const text = root.textContent ?? "";
      expect(text.indexOf("Bound reply")).toBeLessThan(text.indexOf("All matching Templates"));
      expect(root.textContent).toContain("example.test");
      expect(root.textContent).toContain("other.test");
    });

    it("Search remains full-library even on a Field nothing has ever been bound to yet", async () => {
      const state = siteScopedState();
      state.pageProfiles = [];
      vi.stubGlobal("chrome", {
        runtime: { sendMessage: vi.fn().mockResolvedValue({ ok: true, value: state }), onMessage: { addListener: vi.fn(), removeListener: vi.fn() } },
      });
      const root = document.createElement("div");
      const field = document.createElement("input");
      render(
        <InlinePicker
          targetField={field}
          pageProfileId="never-bound-page"
          fieldProfileId="never-bound-field"
          pageIdentityKey="page-key"
          fieldIdentityKey="field-key"
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
      const searchInput = await vi.waitFor(() => {
        const found = root.querySelector<HTMLInputElement>('input[aria-label="Search templates"]');
        if (!found) throw new Error("Search input not found");
        return found;
      });
      searchInput.value = "reply";
      searchInput.dispatchEvent(new InputEvent("input", { bubbles: true }));
      await vi.waitFor(() => expect(root.textContent).toContain("Same-site reply"));
      expect(root.textContent).toContain("Other-site reply");
      expect(root.textContent).toContain("Global reply");
    });

    it("shows the Site Affinity badge primary Site plus count for a Template spanning more than one Site", async () => {
      const state = siteScopedState();
      state.templates.push({
        id: "multi-site",
        content: "Multi-site reply",
        siteAffinities: ["other.test", "third.test"],
        createdAt: "x",
        updatedAt: "x",
        totalUsageCount: 1,
        revision: 0,
      });
      vi.stubGlobal("chrome", {
        runtime: { sendMessage: vi.fn().mockResolvedValue({ ok: true, value: state }), onMessage: { addListener: vi.fn(), removeListener: vi.fn() } },
      });
      const root = document.createElement("div");
      const field = document.createElement("input");
      render(
        <InlinePicker
          targetField={field}
          pageProfileId="page-1"
          fieldProfileId="field-1"
          pageIdentityKey="page-key"
          fieldIdentityKey="field-key"
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
      const searchInput = await vi.waitFor(() => {
        const found = root.querySelector<HTMLInputElement>('input[aria-label="Search templates"]');
        if (!found) throw new Error("Search input not found");
        return found;
      });
      searchInput.value = "multi-site";
      searchInput.dispatchEvent(new InputEvent("input", { bubbles: true }));
      await vi.waitFor(() => expect(root.textContent).toContain("Multi-site reply"));
      // No live Bindings on either Site, so usage ties at zero and the
      // alphabetically-earlier Site ("other.test" < "third.test") wins.
      expect(root.textContent).toContain("other.test +1");
    });

    it("does not show pre-query suggestions for a recognized Field kind", async () => {
      const state = siteScopedState();
      state.templates = [
        { id: "email-template", content: "sarah@example.com", siteAffinities: [], createdAt: "x", updatedAt: "x", totalUsageCount: 3, revision: 0 },
        { id: "unrelated", content: "Meeting notes template", siteAffinities: [], createdAt: "x", updatedAt: "x", totalUsageCount: 0, revision: 0 },
      ];
      vi.stubGlobal("chrome", {
        runtime: { sendMessage: vi.fn().mockResolvedValue({ ok: true, value: state }), onMessage: { addListener: vi.fn(), removeListener: vi.fn() } },
      });
      const root = document.createElement("div");
      const field = document.createElement("input");
      render(
        <InlinePicker
          targetField={field}
          pageProfileId="page-1"
          fieldProfileId="field-1"
          pageIdentityKey="page-key"
          fieldIdentityKey={JSON.stringify({ semanticKind: "email" })}
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
      await vi.waitFor(() => expect(root.textContent).toContain("No templates bound"));
      expect(root.textContent).not.toContain("Suggested");
      expect(root.textContent).not.toContain("Meeting notes template");

      const searchInput = root.querySelector<HTMLInputElement>('input[aria-label="Search templates"]');
      if (!searchInput) throw new Error("Search input not found");
      searchInput.value = "x";
      searchInput.dispatchEvent(new InputEvent("input", { bubbles: true }));
      await vi.waitFor(() => expect(root.textContent).toContain("sarah@example.com"));
    });

    it("uses the real unrecognized state for the empty Field message and still exposes deliberate Search", async () => {
      const state = siteScopedState();
      state.templates = [
        { id: "email-template", content: "sarah@example.com", siteAffinities: [], createdAt: "x", updatedAt: "x", totalUsageCount: 3, revision: 0 },
      ];
      vi.stubGlobal("chrome", {
        runtime: { sendMessage: vi.fn().mockResolvedValue({ ok: true, value: state }), onMessage: { addListener: vi.fn(), removeListener: vi.fn() } },
      });
      const root = document.createElement("div");
      const field = document.createElement("input");
      render(
        <InlinePicker
          targetField={field}
          pageProfileId="page-1"
          fieldRecognized={false}
          fieldProfileId="field-1"
          pageIdentityKey="page-key"
          fieldIdentityKey={JSON.stringify({ semanticKind: "" })}
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
      await vi.waitFor(() => expect(root.textContent).toContain("No saved match for this field"));
      expect(root.textContent).not.toContain("Suggested");
      const searchInput = root.querySelector<HTMLInputElement>('input[aria-label="Search templates"]');
      if (!searchInput) throw new Error("Search input not found");
      searchInput.value = "sarah";
      searchInput.dispatchEvent(new InputEvent("input", { bubbles: true }));
      await vi.waitFor(() => expect(root.textContent).toContain("sarah@example.com"));
    });
  });

  describe("Logical Page Matching candidate review", () => {
    const candidate = {
      id: "candidate-1",
      ruleId: "rule-1",
      canonicalPageProfileId: "page-canonical",
      reviewRequired: true as const,
    };
    const candidateEvidence = {
      origin: "https://forms.example.test",
      routePattern: "/customers/:number",
      fieldFeatureHashes: ["a".repeat(64)],
      groupedFieldFeatureHashes: ["b".repeat(64)],
      fieldIdentityKey: "field-key",
    };
    const emptyState = {
      schemaVersion: 13,
      sites: [],
      templates: [],
      pageProfiles: [],
      fieldProfiles: [],
      bindings: [],
      sharedTemplateSets: [],
      sharedTemplateBindings: [],
      sharedTemplateFieldStates: [],
      pickerPosition: null,
      pageStatusPosition: null,
    };

    it("offers a Review action only while a candidate is present, and opens a no-write confirmation view", async () => {
      const sendMessage = vi.fn().mockResolvedValue({ ok: true, value: emptyState });
      vi.stubGlobal("chrome", {
        runtime: { sendMessage, onMessage: { addListener: vi.fn(), removeListener: vi.fn() } },
      });
      const root = document.createElement("div");
      const field = document.createElement("input");
      render(
        <InlinePicker
          targetField={field}
          pageProfileId="page-1"
          fieldRecognized={false}
          fieldProfileId="field-1"
          pageIdentityKey="page-key"
          fieldIdentityKey="field-key"
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
          logicalPageCandidate={candidate}
          logicalPageCandidateEvidence={candidateEvidence}
        />,
        root,
      );

      await vi.waitFor(() => expect(root.textContent).toContain("filled before"));
      clickButton(root, "Review");
      await vi.waitFor(() => expect(root.textContent).toContain("Confirm"));
      expect(sendMessage).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: "CONFIRM_LOGICAL_PAGE_CANDIDATE" }),
      );
    });

    it("previews the matched address pattern and the specific Templates Confirm would reuse", async () => {
      // A user cannot decide from a generic reassurance sentence alone - the
      // dialog must name what will actually change: which page pattern this
      // matches and which Templates become available here.
      const populatedState = {
        ...emptyState,
        templates: [
          { id: "template-1", content: "Support reply\nThanks for reaching out", siteAffinities: [], createdAt: "x", updatedAt: "x", totalUsageCount: 0, revision: 0 },
          { id: "template-2", content: "Second Template", siteAffinities: [], createdAt: "x", updatedAt: "x", totalUsageCount: 0, revision: 0 },
          { id: "template-unrelated", content: "Belongs to a different Field", siteAffinities: [], createdAt: "x", updatedAt: "x", totalUsageCount: 0, revision: 0 },
        ],
        fieldProfiles: [
          { id: "field-canonical", pageProfileId: "page-canonical", identityKey: "field-key" },
          { id: "field-other", pageProfileId: "page-canonical", identityKey: "other-field-key" },
        ],
        bindings: [
          { id: "binding-1", templateId: "template-1", pageProfileId: "page-canonical", fieldProfileId: "field-canonical", createdAt: "x", usageCount: 0, revision: 0 },
          { id: "binding-2", templateId: "template-2", pageProfileId: "page-canonical", fieldProfileId: "field-canonical", createdAt: "x", usageCount: 0, revision: 0 },
          { id: "binding-unrelated", templateId: "template-unrelated", pageProfileId: "page-canonical", fieldProfileId: "field-other", createdAt: "x", usageCount: 0, revision: 0 },
        ],
      };
      vi.stubGlobal("chrome", {
        runtime: {
          sendMessage: vi.fn().mockResolvedValue({ ok: true, value: populatedState }),
          onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
        },
      });
      const root = document.createElement("div");
      const field = document.createElement("input");
      render(
        <InlinePicker
          targetField={field}
          pageProfileId="page-1"
          fieldRecognized={false}
          fieldProfileId="field-1"
          pageIdentityKey="page-key"
          fieldIdentityKey="field-key"
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
          logicalPageCandidate={candidate}
          logicalPageCandidateEvidence={candidateEvidence}
        />,
        root,
      );

      await vi.waitFor(() => expect(root.textContent).toContain("filled before"));
      clickButton(root, "Review");

      await vi.waitFor(() => expect(root.textContent).toContain("Confirm"));
      expect(root.textContent).toContain("https://forms.example.test/customers/:number");
      expect(root.textContent).toContain("Support reply");
      expect(root.textContent).toContain("Second Template");
      // The other Field's Template on the same canonical Page is not this
      // Field's exact match and must not appear as part of this preview.
      expect(root.textContent).not.toContain("Belongs to a different Field");
    });

    it("confirms a candidate, reports the resulting Field context, and creates no Picker Undo", async () => {
      const confirmedResolution = {
        siteId: "example.test",
        pageProfileId: "page-canonical",
        fieldProfileId: "field-canonical",
        recognized: true,
      };
      const sendMessage = vi.fn().mockImplementation((request: { type: string }) => {
        if (request.type === "CONFIRM_LOGICAL_PAGE_CANDIDATE") {
          return Promise.resolve({ ok: true, value: confirmedResolution });
        }
        return Promise.resolve({ ok: true, value: emptyState });
      });
      vi.stubGlobal("chrome", {
        runtime: { sendMessage, onMessage: { addListener: vi.fn(), removeListener: vi.fn() } },
      });
      const root = document.createElement("div");
      const field = document.createElement("input");
      const onLastActionChange = vi.fn();
      const onLogicalPageCandidateConfirmed = vi.fn();
      render(
        <InlinePicker
          targetField={field}
          pageProfileId="page-1"
          fieldRecognized={false}
          fieldProfileId="field-1"
          pageIdentityKey="page-key"
          fieldIdentityKey="field-key"
          onInsert={() => undefined}
          onClose={() => undefined}
          pinned={false}
          onPinnedChange={() => undefined}
          pickerPosition={null}
          onPickerPositionChange={() => undefined}
          lastAction={null}
          onLastActionChange={onLastActionChange}
          targetFieldActionable={true}
          insertionRejected={false}
          insertionRejectionNotice={null}
          onCopyToClipboard={async () => true}
          bindingSupported={true}
          logicalPageCandidate={candidate}
          logicalPageCandidateEvidence={candidateEvidence}
          onLogicalPageCandidateConfirmed={onLogicalPageCandidateConfirmed}
        />,
        root,
      );

      await vi.waitFor(() => expect(root.textContent).toContain("filled before"));
      clickButton(root, "Review");
      await vi.waitFor(() => expect(root.textContent).toContain("Confirm"));
      clickButton(root, "Confirm");

      await vi.waitFor(() =>
        expect(sendMessage).toHaveBeenCalledWith({
          type: "CONFIRM_LOGICAL_PAGE_CANDIDATE",
          ruleId: candidate.ruleId,
          canonicalPageProfileId: candidate.canonicalPageProfileId,
          pageIdentityKey: "page-key",
          evidence: candidateEvidence,
        }),
      );
      await vi.waitFor(() => expect(onLogicalPageCandidateConfirmed).toHaveBeenCalledWith(confirmedResolution));
      // Confirmation invalidates any prior transient Undo but never creates one of its own.
      expect(onLastActionChange).toHaveBeenCalledWith(null);
      expect(onLastActionChange).not.toHaveBeenCalledWith(expect.objectContaining({ type: expect.anything() }));
    });

    it("keeps the confirmation result visible after the parent swaps in the canonical Field", async () => {
      // Regression: confirming re-identifies the same focused Field as the
      // canonical one, so the parent re-renders this Picker with a different
      // fieldProfileId. The per-Field reset that follows must not erase the
      // result of the very action the user just confirmed.
      const confirmedResolution = {
        siteId: "example.test",
        pageProfileId: "page-canonical",
        fieldProfileId: "field-canonical",
        recognized: true,
      };
      const sendMessage = vi.fn().mockImplementation((request: { type: string }) => {
        if (request.type === "CONFIRM_LOGICAL_PAGE_CANDIDATE") {
          return Promise.resolve({ ok: true, value: confirmedResolution });
        }
        return Promise.resolve({ ok: true, value: emptyState });
      });
      vi.stubGlobal("chrome", {
        runtime: { sendMessage, onMessage: { addListener: vi.fn(), removeListener: vi.fn() } },
      });
      const root = document.createElement("div");
      const field = document.createElement("input");

      const draw = (fieldProfileId: string, logicalPageCandidate: typeof candidate | null) =>
        render(
          <InlinePicker
            targetField={field}
            pageProfileId="page-1"
            fieldRecognized={false}
            fieldProfileId={fieldProfileId}
            pageIdentityKey="page-key"
            fieldIdentityKey="field-key"
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
            logicalPageCandidate={logicalPageCandidate}
            logicalPageCandidateEvidence={candidateEvidence}
            // The real parent reacts by re-rendering with the canonical Field.
            onLogicalPageCandidateConfirmed={(resolution) => draw(resolution.fieldProfileId, null)}
          />,
          root,
        );
      draw("field-1", candidate);

      await vi.waitFor(() => expect(root.textContent).toContain("filled before"));
      clickButton(root, "Review");
      await vi.waitFor(() => expect(root.textContent).toContain("Confirm"));
      clickButton(root, "Confirm");

      await vi.waitFor(() =>
        expect(root.textContent).toContain("Reused your existing Templates for this page."),
      );
    });

    it("dismisses a candidate without sending a confirmation request", async () => {
      const sendMessage = vi.fn().mockResolvedValue({ ok: true, value: emptyState });
      vi.stubGlobal("chrome", {
        runtime: { sendMessage, onMessage: { addListener: vi.fn(), removeListener: vi.fn() } },
      });
      const root = document.createElement("div");
      const field = document.createElement("input");
      const onLogicalPageCandidateDismissed = vi.fn();
      render(
        <InlinePicker
          targetField={field}
          pageProfileId="page-1"
          fieldRecognized={false}
          fieldProfileId="field-1"
          pageIdentityKey="page-key"
          fieldIdentityKey="field-key"
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
          logicalPageCandidate={candidate}
          logicalPageCandidateEvidence={candidateEvidence}
          onLogicalPageCandidateDismissed={onLogicalPageCandidateDismissed}
        />,
        root,
      );

      await vi.waitFor(() => expect(root.textContent).toContain("filled before"));
      clickButton(root, "Review");
      await vi.waitFor(() => expect(root.textContent).toContain("Confirm"));
      clickButton(root, "Cancel");

      expect(onLogicalPageCandidateDismissed).toHaveBeenCalledOnce();
      expect(sendMessage).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: "CONFIRM_LOGICAL_PAGE_CANDIDATE" }),
      );
    });
  });

  describe("Shared Template Set (Task 021 Slice 3)", () => {
    const emptyState = {
      schemaVersion: 13,
      sites: [],
      templates: [],
      pageProfiles: [],
      fieldProfiles: [],
      bindings: [],
      sharedTemplateSets: [],
      sharedTemplateBindings: [],
      sharedTemplateFieldStates: [],
      pickerPosition: null,
      pageStatusPosition: null,
    };

    function draw(overrides: Partial<Parameters<typeof InlinePicker>[0]> = {}) {
      const root = document.createElement("div");
      // Connected to the document: happy-dom only dispatches a checkbox's
      // native "change" event for elements attached to document.body, and
      // the Add Fields flow's candidate checkboxes need that event to reach
      // Preact's onChange handler.
      document.body.append(root);
      const field = document.createElement("input");
      render(
        <InlinePicker
          targetField={field}
          pageProfileId="page-1"
          fieldProfileId="field-1"
          pageIdentityKey="page-key"
          fieldIdentityKey="field-key"
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
          {...overrides}
        />,
        root,
      );
      return root;
    }

    it("shows sharing status and only the Shared Template Set's own effective list, never a dormant direct Binding", async () => {
      const state = {
        ...emptyState,
        templates: [
          { id: "template-shared", content: "Shared reply", siteAffinities: ["example.test"], createdAt: "x", updatedAt: "x", totalUsageCount: 0, revision: 0 },
          { id: "template-dormant", content: "Dormant direct template", siteAffinities: ["example.test"], createdAt: "x", updatedAt: "x", totalUsageCount: 0, revision: 0 },
        ],
        bindings: [
          { id: "binding-dormant", templateId: "template-dormant", pageProfileId: "page-1", fieldProfileId: "field-1", createdAt: "x", usageCount: 0, revision: 0 },
        ],
        sharedTemplateSets: [
          { id: "set-1", siteId: "example.test", name: "Contact fields", memberFieldProfileIds: ["field-1", "field-2"] },
        ],
        sharedTemplateBindings: [
          { id: "shared-binding-1", setId: "set-1", templateId: "template-shared", usageCount: 0, revision: 0, order: 0 },
        ],
      };
      vi.stubGlobal("chrome", {
        runtime: {
          sendMessage: vi.fn().mockResolvedValue({ ok: true, value: state }),
          onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
        },
      });
      const root = draw();

      await vi.waitFor(() => expect(root.textContent).toContain("Shared"));
      expect(root.textContent).toContain("2 fields use the same Templates");
      expect(root.textContent).toContain("Shared reply");
      expect(root.textContent).not.toContain("Dormant direct template");
    });

    it("lets the user rename the focused Field from its persistent context row", async () => {
      let state = {
        ...emptyState,
        sites: [{ id: "example.test" }],
        pageProfiles: [{ id: "page-1", siteId: "example.test" }],
        fieldProfiles: [{ id: "field-1", pageProfileId: "page-1", observedTitle: "Primary name" }],
      };
      const sendMessage = vi.fn(async (request: { type: string; fieldProfileId?: string; alias?: string }) => {
        if (request.type === "SET_FIELD_ALIAS") {
          state = {
            ...state,
            fieldProfiles: state.fieldProfiles.map((field) =>
              field.id === request.fieldProfileId ? { ...field, userAlias: request.alias } : field,
            ),
          };
          return { ok: true, value: state.fieldProfiles[0] };
        }
        return { ok: true, value: state };
      });
      vi.stubGlobal("chrome", { runtime: { sendMessage, onMessage: { addListener: vi.fn(), removeListener: vi.fn() } } });
      const root = draw({ fieldObservedTitle: "Primary name", siteId: "example.test" });

      const rename = await vi.waitFor(() => {
        const found = Array.from(root.querySelectorAll<HTMLButtonElement>("button")).find(
          (button) => button.getAttribute("aria-label") === 'Rename this box, currently named "Primary name"',
        );
        if (!found) throw new Error("Focused Field rename action not found");
        return found;
      });
      expect(rename.classList.contains("picker-field-alias-trigger")).toBe(true);
      expect(rename.textContent).toContain("Primary name");
      expect(rename.querySelector("img")).toBeNull();
      rename.click();
      const input = await vi.waitFor(() => {
        const found = root.querySelector<HTMLInputElement>('input[aria-label="Name for this box"]');
        if (!found) throw new Error("Focused Field alias editor not found");
        return found;
      });
      // Task 023 Addendum B5 (3): renaming edits the name the Field shows, so
      // the box opens on it rather than empty.
      expect(input.value).toBe("Primary name");
      const editor = input.closest(".picker-field-alias-editor");
      // The editor replaces the row's other actions; its own controls are
      // exactly Save and Cancel, and the hint explaining what is being named.
      expect([...(editor?.querySelectorAll("button") ?? [])].map((button) => button.textContent)).toEqual([
        "Save",
        "Cancel",
      ]);
      expect(editor?.textContent).toContain("Names the box you are typing in");
      expect(root.textContent).not.toContain("Share with…");
      input.value = "Applicant name";
      input.dispatchEvent(new InputEvent("input", { bubbles: true }));
      clickButton(root, "Save");

      await vi.waitFor(() => expect(root.textContent).toContain("Applicant name"));
      expect(sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "SET_FIELD_ALIAS",
          fieldProfileId: "field-1",
          alias: "Applicant name",
        }),
      );
    });

    it("Task 027 Addendum D: an unshared Field offers a private Save that survives being shared later", async () => {
      // The audience that matters is not the one at save time - both choices
      // are visible only to this Field then - but the one that exists once the
      // Field joins a Set, where every unmarked Binding is unioned in.
      const sendMessage = vi.fn(async () => ({ ok: true, value: { ...emptyState } }));
      vi.stubGlobal("chrome", { runtime: { sendMessage, onMessage: { addListener: vi.fn(), removeListener: vi.fn() } } });
      const root = draw({ siteId: "example.test" });

      await vi.waitFor(() => expect(root.textContent).toContain("New template"));
      clickButton(root, "New template");
      const editor = await vi.waitFor(() => {
        const area = root.querySelector<HTMLTextAreaElement>('textarea[aria-label="Template content"]');
        if (!area) throw new Error("Template content textarea not found");
        return area;
      });
      editor.value = "Only mine";
      editor.dispatchEvent(new InputEvent("input", { bubbles: true }));
      await Promise.resolve();

      // Both choices exist; the ordinary one stays the default and is unmarked.
      expect(root.textContent).toContain("Save for this field only");
      clickButton(root, "Save for this field only");

      await vi.waitFor(() =>
        expect(sendMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "CREATE_TEMPLATE_AND_BIND",
            content: "Only mine",
            privateToField: true,
          }),
        ),
      );
      await vi.waitFor(() => expect(root.textContent).toContain("stays private if this field is shared later"));
    });

    it("Task 027 Addendum D: the ordinary Save stays unmarked", async () => {
      const sendMessage = vi.fn(async () => ({ ok: true, value: { ...emptyState } }));
      vi.stubGlobal("chrome", { runtime: { sendMessage, onMessage: { addListener: vi.fn(), removeListener: vi.fn() } } });
      const root = draw({ siteId: "example.test" });

      await vi.waitFor(() => expect(root.textContent).toContain("New template"));
      clickButton(root, "New template");
      const editor = await vi.waitFor(() => {
        const area = root.querySelector<HTMLTextAreaElement>('textarea[aria-label="Template content"]');
        if (!area) throw new Error("Template content textarea not found");
        return area;
      });
      editor.value = "Shared later is fine";
      editor.dispatchEvent(new InputEvent("input", { bubbles: true }));
      await Promise.resolve();
      clickButton(root, "Save");

      await vi.waitFor(() => {
        const requests = (sendMessage.mock.calls as unknown[][])
          .map((call) => call[0] as Record<string, unknown> | undefined)
          .filter((request): request is Record<string, unknown> => request?.type === "CREATE_TEMPLATE_AND_BIND");
        expect(requests).toHaveLength(1);
        expect(requests[0]?.privateToField).toBeUndefined();
      });
    });

    it("Task 024 Addendum C: offers every rich-text Field at once, and one confirmation links them all", async () => {
      // The offer the Confirmed Contract has always specified and no surface
      // ever showed: `suggestedFieldProfileId` was computed and dropped.
      const candidate = (id: string, label: string) => ({
        fieldProfileId: id,
        siteId: "example.test",
        pageProfileId: `page-${id}`,
        siteLabel: "example.test",
        pageLabel: label,
        fieldLabel: label,
        crossSite: false,
        highConfidence: true,
        decided: false,
        alreadyLinked: false,
        templateCount: 1,
        templatePreviews: ["a template"],
        existingSetId: null,
        existingSetMemberCount: 0,
      });
      const sendMessage = vi.fn(async (request: { type: string }) => {
        if (request.type === "FIND_SIMILAR_FIELD_CANDIDATES") {
          return {
            ok: true,
            value: {
              currentFieldLabel: "New chat",
              candidates: [candidate("chat", "Chat"), candidate("cowork", "Cowork")],
              suggestedFieldProfileId: null,
              suggestedGroupFieldProfileIds: ["chat", "cowork"],
            },
          };
        }
        if (request.type === "CREATE_SHARED_TEMPLATE_SET") {
          return { ok: true, value: { set: { id: "set-1", name: "Shared", memberFieldProfileIds: [] }, bindings: [] } };
        }
        return { ok: true, value: { ...emptyState, sites: [{ id: "example.test" }] } };
      });
      vi.stubGlobal("chrome", { runtime: { sendMessage, onMessage: { addListener: vi.fn(), removeListener: vi.fn() } } });

      const root = draw({ siteId: "example.test" });
      await vi.waitFor(() =>
        expect(root.textContent).toContain("2 fields you use on this site look like the same editor"),
      );
      // It names the Fields and never previews a Template: recommending
      // Templates before a deliberate Search is the one thing FillNest does
      // not do.
      expect(root.textContent).toContain("Chat · Cowork");
      expect(root.textContent).not.toContain("a template");

      clickButton(root, "Share Templates");
      await vi.waitFor(() => {
        const requests = sendMessage.mock.calls
          .map(([request]) => request as Record<string, unknown>)
          .filter((request) => request?.type === "CREATE_SHARED_TEMPLATE_SET");
        // One mutation over every Field, so one exact Undo.
        expect(requests).toHaveLength(1);
        expect(requests[0]?.fieldProfileIds).toEqual(["field-1", "chat", "cowork"]);
      });
    });

    it("Task 024 Addendum C.2: a single suggestion that needs confirmation asks it where the user can see it", async () => {
      // The scope confirmation lives in the Finder and the offer lives in the
      // list. Asking from the list used to set a confirmation nothing
      // rendered: the click did nothing visible and the offer stayed put.
      const sendMessage = vi.fn(async (request: { type: string }) => {
        if (request.type === "FIND_SIMILAR_FIELD_CANDIDATES") {
          return {
            ok: true,
            value: {
              currentFieldLabel: "This field",
              candidates: [
                {
                  fieldProfileId: "other",
                  siteId: "example.test",
                  pageProfileId: "page-other",
                  siteLabel: "example.test",
                  pageLabel: "Other page",
                  fieldLabel: "Other box",
                  crossSite: false,
                  highConfidence: true,
                  decided: false,
                  alreadyLinked: false,
                  templateCount: 1,
                  templatePreviews: [],
                  // Already in a Set, so linking needs the scope confirmation.
                  existingSetId: "set-other",
                  existingSetMemberCount: 2,
                },
              ],
              suggestedFieldProfileId: "other",
              suggestedGroupFieldProfileIds: [],
            },
          };
        }
        return { ok: true, value: { ...emptyState, sites: [{ id: "example.test" }] } };
      });
      vi.stubGlobal("chrome", { runtime: { sendMessage, onMessage: { addListener: vi.fn(), removeListener: vi.fn() } } });

      const root = draw({ siteId: "example.test" });
      await vi.waitFor(() => expect(root.textContent).toContain("looks like the same field"));
      clickButton(root, "Share Templates");
      await vi.waitFor(() => expect(root.textContent).toContain("Share Templates with"));
      expect(root.textContent).toContain("Other box");
    });

    it("Task 044: the header's Back goes up one level - from a confirmation to the Field list, then to the Templates", async () => {
      const sendMessage = vi.fn(async (request: { type: string }) => {
        if (request.type === "FIND_SIMILAR_FIELD_CANDIDATES") {
          return {
            ok: true,
            value: {
              currentFieldLabel: "This field",
              candidates: [
                {
                  fieldProfileId: "other",
                  siteId: "example.test",
                  pageProfileId: "page-other",
                  siteLabel: "example.test",
                  pageLabel: "Other page",
                  fieldLabel: "Other box",
                  crossSite: false,
                  highConfidence: true,
                  decided: false,
                  alreadyLinked: false,
                  templateCount: 1,
                  templatePreviews: [],
                  // Already in a Set, so linking needs the scope confirmation.
                  existingSetId: "set-other",
                  existingSetMemberCount: 2,
                },
              ],
              suggestedFieldProfileId: "other",
              suggestedGroupFieldProfileIds: [],
            },
          };
        }
        return { ok: true, value: { ...emptyState, sites: [{ id: "example.test" }] } };
      });
      vi.stubGlobal("chrome", { runtime: { sendMessage, onMessage: { addListener: vi.fn(), removeListener: vi.fn() } } });

      const root = draw({ siteId: "example.test" });
      await vi.waitFor(() => expect(root.textContent).toContain("looks like the same field"));
      clickButton(root, "Share Templates");
      await vi.waitFor(() => expect(root.textContent).toContain("Share Templates with"));
      const header = root.querySelector("header")!;
      expect(header.querySelector(".header-title")?.textContent).toBe("Share with…");
      expect(header.querySelector('[data-fillnest-icon="brand"]')).toBeNull();
      expect([...root.querySelectorAll("button")].filter((button) => button.textContent?.trim() === "Back")).toHaveLength(1);

      clickButton(header, "Back");
      await vi.waitFor(() => expect(root.textContent).not.toContain("Share Templates with"));
      expect(root.querySelector('input[type="search"][aria-label="Search Fields"]')).not.toBeNull();
      expect(header.querySelector(".header-title")?.textContent).toBe("Share with…");

      clickButton(header, "Back");
      await vi.waitFor(() => expect(header.querySelector('[data-fillnest-icon="brand"]')).not.toBeNull());
      expect(header.querySelector(".header-lead")?.textContent).toBe("FillNest");
      expect(root.querySelector('input[type="search"][aria-label="Search Fields"]')).toBeNull();
    });

    it("Task 024 Addendum C.2: a Field that cannot be remembered is never offered sharing", async () => {
      // Sharing is a form of remembering - a link creates a durable Field
      // Profile and a Set membership. A Rich Text Field with no stable
      // identity can carry neither, so offering it is offering something that
      // will not hold.
      const sendMessage = vi.fn(async (request: { type: string }) => {
        if (request.type === "FIND_SIMILAR_FIELD_CANDIDATES") {
          throw new Error("The offer must not even be requested for an unbindable Field");
        }
        return { ok: true, value: { ...emptyState, sites: [{ id: "example.test" }] } };
      });
      vi.stubGlobal("chrome", { runtime: { sendMessage, onMessage: { addListener: vi.fn(), removeListener: vi.fn() } } });

      const root = draw({ siteId: "example.test", bindingSupported: false });
      await vi.waitFor(() => expect(root.textContent).toContain("This editor has no stable identity"));
      expect(root.textContent).not.toContain("look like the same editor");
      expect(root.textContent).not.toContain("Share with…");
      expect(
        sendMessage.mock.calls.some(([request]) => request.type === "FIND_SIMILAR_FIELD_CANDIDATES"),
      ).toBe(false);
    });

    it("Task 024 Addendum C: declining records a No for every pair the offer contained", async () => {
      const candidate = (id: string, label: string) => ({
        fieldProfileId: id,
        siteId: "example.test",
        pageProfileId: `page-${id}`,
        siteLabel: "example.test",
        pageLabel: label,
        fieldLabel: label,
        crossSite: false,
        highConfidence: true,
        decided: false,
        alreadyLinked: false,
        templateCount: 1,
        templatePreviews: [],
        existingSetId: null,
        existingSetMemberCount: 0,
      });
      const sendMessage = vi.fn(async (request: { type: string }) => {
        if (request.type === "FIND_SIMILAR_FIELD_CANDIDATES") {
          return {
            ok: true,
            value: {
              currentFieldLabel: "New chat",
              candidates: [candidate("chat", "Chat"), candidate("cowork", "Cowork")],
              suggestedFieldProfileId: null,
              suggestedGroupFieldProfileIds: ["chat", "cowork"],
            },
          };
        }
        return { ok: true, value: { ...emptyState, sites: [{ id: "example.test" }] } };
      });
      vi.stubGlobal("chrome", { runtime: { sendMessage, onMessage: { addListener: vi.fn(), removeListener: vi.fn() } } });

      const root = draw({ siteId: "example.test" });
      await vi.waitFor(() => expect(root.textContent).toContain("look like the same editor"));
      clickButton(root, "Not the same");

      await vi.waitFor(() => {
        const declined = sendMessage.mock.calls
          .map(([request]) => request as Record<string, unknown>)
          .filter((request) => request?.type === "RECORD_COMPATIBILITY_PAIR_NO")
          .map((request) => request.fieldProfileIdB);
        // Every pair, so a refused group is not offered one member at a time.
        expect(declined).toEqual(["chat", "cowork"]);
      });
      await vi.waitFor(() => expect(root.textContent).not.toContain("look like the same editor"));
    });

    it("Task 027 Addendum C.3: a Field on this page stays reachable once a Search query is typed", async () => {
      // QA report 5: "In this page" was rendered only while the Search box was
      // empty, and findSimilarFieldCandidates skips any Field with an empty
      // effective Template list (Task 024's discovery rule). So a Field on this
      // page with no Templates yet could only be browsed to - typing its name
      // hid it.
      const sendMessage = vi.fn(async (request: { type: string }) => {
        if (request.type === "FIND_SIMILAR_FIELD_CANDIDATES") {
          // Deliberately empty: the repository never offers an empty Field.
          return { ok: true, value: { candidates: [], suggestedFieldProfileId: null, currentFieldLabel: "Primary name" } };
        }
        return { ok: true, value: { ...emptyState, sites: [{ id: "example.test" }] } };
      });
      vi.stubGlobal("chrome", { runtime: { sendMessage, onMessage: { addListener: vi.fn(), removeListener: vi.fn() } } });
      const root = draw({
        siteId: "example.test",
        fieldObservedTitle: "Primary name",
        pageFieldCandidates: [{ fieldIdentityKey: "secondary-name", documentOrder: 1, observedTitle: "Secondary name" }],
      });

      await vi.waitFor(() => expect(root.textContent).toContain("Primary name"));
      clickButton(root, "Share with…");
      const search = await vi.waitFor(() => {
        const input = root.querySelector<HTMLInputElement>('input[aria-label="Search Fields"]');
        if (!input) throw new Error("Search Fields input not found");
        return input;
      });
      await vi.waitFor(() => expect(root.textContent).toContain("Secondary name"));

      search.value = "Secondary";
      search.dispatchEvent(new InputEvent("input", { bubbles: true }));

      await vi.waitFor(() => {
        expect(root.textContent).toContain("Secondary name");
        expect(root.textContent).not.toContain("No Fields match this search.");
      });

      // A query matching nothing on this page still reports no match, so the
      // section is filtered rather than merely always shown.
      search.value = "nothing-matches-this";
      search.dispatchEvent(new InputEvent("input", { bubbles: true }));
      await vi.waitFor(() => expect(root.textContent).toContain("No Fields match this search."));
    });

    it("renames a live In this page Field on demand and labels Finder Search as Search Fields", async () => {
      let state = {
        ...emptyState,
        sites: [{ id: "example.test" }],
        pageProfiles: [{ id: "page-1", siteId: "example.test" }],
        fieldProfiles: [] as Array<{ id: string; pageProfileId: string; identityKey?: string; observedTitle?: string; userAlias?: string }>,
      };
      const sendMessage = vi.fn(async (request: { type: string; fieldProfileId?: string; alias?: string; newField?: { fieldProfileId: string; fieldIdentityKey?: string; fieldObservedTitle?: string } }) => {
        if (request.type === "FIND_SIMILAR_FIELD_CANDIDATES") {
          return { ok: true, value: { candidates: [], suggestedFieldProfileId: null, currentFieldLabel: "Primary name" } };
        }
        if (request.type === "SET_FIELD_ALIAS" && request.fieldProfileId && request.newField) {
          state = {
            ...state,
            fieldProfiles: [{
              id: request.fieldProfileId,
              pageProfileId: "page-1",
              identityKey: request.newField.fieldIdentityKey,
              observedTitle: request.newField.fieldObservedTitle,
              userAlias: request.alias,
            }],
          };
          return { ok: true, value: state.fieldProfiles[0] };
        }
        return { ok: true, value: state };
      });
      vi.stubGlobal("chrome", { runtime: { sendMessage, onMessage: { addListener: vi.fn(), removeListener: vi.fn() } } });
      const root = draw({
        siteId: "example.test",
        fieldObservedTitle: "Primary name",
        pageFieldCandidates: [{ fieldIdentityKey: "secondary-name", documentOrder: 1, observedTitle: "Secondary name" }],
      });

      await vi.waitFor(() => expect(root.textContent).toContain("Primary name"));
      clickButton(root, "Share with…");
      await vi.waitFor(() => {
        const search = root.querySelector<HTMLInputElement>('input[aria-label="Search Fields"]');
        if (!search) throw new Error("Search Fields input not found");
        return search;
      });
      const rename = Array.from(root.querySelectorAll<HTMLButtonElement>("button")).find(
        (button) => button.getAttribute("aria-label") === 'Rename "Secondary name"',
      );
      if (!rename) throw new Error("Candidate Field rename action not found");
      expect(rename.querySelector("img")).toBeNull();
      rename.click();
      const input = await vi.waitFor(() => {
        const found = root.querySelector<HTMLInputElement>('input[aria-label="Name for Secondary name"]');
        if (!found) throw new Error("Candidate Field alias editor not found");
        return found;
      });
      expect(input.value).toBe("Secondary name");
      const candidateRow = input.closest(".find-similar-row");
      // A rename row inside a list of other Fields carries no hint - it has
      // its own context already.
      expect(input.closest(".picker-field-alias-editor")?.textContent).toBe("SaveCancel");
      expect(candidateRow?.textContent).not.toContain("Share");
      input.value = "Emergency contact name";
      input.dispatchEvent(new InputEvent("input", { bubbles: true }));
      clickButton(root, "Save");

      await vi.waitFor(() => expect(root.textContent).toContain("Emergency contact name"));
      expect(sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "SET_FIELD_ALIAS",
          alias: "Emergency contact name",
          newField: expect.objectContaining({
            fieldIdentityKey: "secondary-name",
            fieldObservedTitle: "Secondary name",
          }),
        }),
      );
    });

    it("creates a Shared Template Set from the current Field via Add Fields, offering only unshared Fields on this page", async () => {
      const state = {
        ...emptyState,
        pageProfiles: [
          { id: "page-1", siteId: "example.test" },
          { id: "page-other-site", siteId: "other.test" },
        ],
        fieldProfiles: [
          { id: "field-1", pageProfileId: "page-1" },
          { id: "field-2", pageProfileId: "page-1", observedTitle: "Billing email" },
          { id: "field-other-site", pageProfileId: "page-other-site", observedTitle: "Cross-site field" },
        ],
      };
      const setResult = {
        set: { id: "set-1", siteId: "example.test", name: "Shared Template Set 1", memberFieldProfileIds: ["field-1", "field-2"] },
        sharedBindings: [],
      };
      const sendMessage = vi.fn().mockImplementation((request: { type: string }) => {
        if (request.type === "CREATE_SHARED_TEMPLATE_SET") return Promise.resolve({ ok: true, value: setResult });
        if (request.type === "FIND_SIMILAR_FIELD_CANDIDATES") {
          return Promise.resolve({ ok: true, value: { candidates: [], suggestedFieldProfileId: null, currentFieldLabel: "this field" } });
        }
        return Promise.resolve({ ok: true, value: state });
      });
      vi.stubGlobal("chrome", {
        runtime: { sendMessage, onMessage: { addListener: vi.fn(), removeListener: vi.fn() } },
      });
      const onLastActionChange = vi.fn();
      const root = draw({ onLastActionChange });

      await vi.waitFor(() => expect(root.textContent).toContain("following focus"));
      clickButton(root, "Share with…");
      await vi.waitFor(() => expect(root.textContent).toContain("Billing email"));
      // A Field belonging to a different Site is never an eligible candidate.
      expect(root.textContent).not.toContain("Cross-site field");

      // One click on the per-row Share button shares instantly - no
      // multi-select step.
      clickButton(root, "Share");

      await vi.waitFor(() =>
        expect(sendMessage).toHaveBeenCalledWith({
          type: "CREATE_SHARED_TEMPLATE_SET",
          fieldProfileIds: ["field-1", "field-2"],
          allowCrossSite: false,
          // The current Field may never have been bound to anything, so it
          // may have no durable Field Profile yet - this identity data lets
          // the repository create it on demand in the same commit.
          newFields: [
            {
              pageUrl: "http://localhost:3000/profile",
              pageProfileId: "page-1",
              fieldProfileId: "field-1",
              pageIdentityKey: "page-key",
              fieldIdentityKey: "field-key",
            },
          ],
        }),
      );
      await vi.waitFor(() => expect(onLastActionChange).toHaveBeenCalledWith({ type: "create-shared-set", setId: "set-1" }));
    });

    it("confirms scope before adding an in-page Field to the current Shared Template Set", async () => {
      const state = {
        ...emptyState,
        pageProfiles: [{ id: "page-1", siteId: "example.test" }],
        fieldProfiles: [
          { id: "field-1", pageProfileId: "page-1" },
          { id: "field-2", pageProfileId: "page-1" },
          { id: "field-3", pageProfileId: "page-1" },
        ],
        sharedTemplateSets: [{ id: "set-1", siteId: "example.test", name: "Contact fields", memberFieldProfileIds: ["field-1", "field-3"] }],
      };
      const expectedSet = { ...state.sharedTemplateSets[0]!, memberFieldProfileIds: ["field-1", "field-3", "field-2"] };
      const undo = { previousSet: state.sharedTemplateSets[0]!, expectedSet, previousSharedBindings: [], expectedSharedBindings: [] };
      const sendMessage = vi.fn().mockImplementation((request: { type: string }) => {
        if (request.type === "ADD_SHARED_TEMPLATE_SET_MEMBER") {
          return Promise.resolve({ ok: true, value: { ...expectedSet, undo } });
        }
        if (request.type === "FIND_SIMILAR_FIELD_CANDIDATES") {
          return Promise.resolve({ ok: true, value: { candidates: [], suggestedFieldProfileId: null, currentFieldLabel: "this field" } });
        }
        return Promise.resolve({ ok: true, value: state });
      });
      vi.stubGlobal("chrome", {
        runtime: { sendMessage, onMessage: { addListener: vi.fn(), removeListener: vi.fn() } },
      });
      const onLastActionChange = vi.fn();
      const root = draw({ onLastActionChange });

      await vi.waitFor(() => expect(root.textContent).toContain("Shared"));
      clickButton(root, "Share with…");
      await vi.waitFor(() => expect(root.querySelector(".find-similar-row")).not.toBeNull());
      clickButton(root, "Share");
      // Task 027 Addendum C.5: the confirmation states the outcome, not just a
      // count - the reader must be able to say who will see what.
      await vi.waitFor(() => expect(root.textContent).toContain("Every Template these 3 fields"));
      expect(root.textContent).toContain("becomes available to all of them");
      expect(root.textContent).toContain("stay private to that field");
      clickButton(root, "Share");

      await vi.waitFor(() =>
        expect(sendMessage).toHaveBeenCalledWith({
          type: "ADD_SHARED_TEMPLATE_SET_MEMBER",
          setId: "set-1",
          fieldProfileId: "field-2",
          allowCrossSite: false,
        }),
      );
      await vi.waitFor(() =>
        expect(onLastActionChange).toHaveBeenCalledWith({ type: "add-shared-member", setId: "set-1", fieldProfileId: "field-2", undo }),
      );
    });

    it("uses the focused member's actual Site for In this page candidates when its Shared Set is cross-Site", async () => {
      const state = {
        ...emptyState,
        sites: [{ id: "anchor.test" }, { id: "current.test" }],
        pageProfiles: [
          { id: "page-anchor", siteId: "anchor.test" },
          { id: "page-1", siteId: "current.test" },
        ],
        fieldProfiles: [
          { id: "field-anchor", pageProfileId: "page-anchor" },
          { id: "field-1", pageProfileId: "page-1" },
          { id: "field-2", pageProfileId: "page-1", observedTitle: "Current-Site neighbour" },
        ],
        sharedTemplateSets: [{
          id: "set-1",
          siteId: "anchor.test",
          name: "Cross-Site fields",
          memberFieldProfileIds: ["field-anchor", "field-1"],
        }],
      };
      vi.stubGlobal("chrome", {
        runtime: {
          sendMessage: vi.fn().mockImplementation((request: { type: string }) => {
            if (request.type === "FIND_SIMILAR_FIELD_CANDIDATES") {
              return Promise.resolve({ ok: true, value: { candidates: [], suggestedFieldProfileId: null, currentFieldLabel: "this field" } });
            }
            return Promise.resolve({ ok: true, value: state });
          }),
          onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
        },
      });
      const root = draw({ siteId: "current.test" });

      await vi.waitFor(() => expect(root.textContent).toContain("Shared"));
      clickButton(root, "Share with…");
      await vi.waitFor(() => expect(root.textContent).toContain("Current-Site neighbour"));
    });

    it("stops sharing for the current Field only, reporting the change affects the whole set", async () => {
      const set = { id: "set-1", siteId: "example.test", name: "Contact fields", memberFieldProfileIds: ["field-1", "field-2"] };
      const state = { ...emptyState, sharedTemplateSets: [set] };
      const sendMessage = vi.fn().mockImplementation((request: { type: string }) => {
        if (request.type === "REMOVE_SHARED_TEMPLATE_SET_MEMBER") {
          return Promise.resolve({ ok: true, value: { set: { ...set, memberFieldProfileIds: ["field-2"] }, ended: false, newlyGlobalTemplates: [], snapshotBindings: [], dormantBindings: [], removedFieldStates: [] } });
        }
        return Promise.resolve({ ok: true, value: state });
      });
      vi.stubGlobal("chrome", {
        runtime: { sendMessage, onMessage: { addListener: vi.fn(), removeListener: vi.fn() } },
      });
      const onLastActionChange = vi.fn();
      const root = draw({ onLastActionChange });

      await vi.waitFor(() => expect(root.textContent).toContain("Shared"));
      clickButton(root, "Leave sharing");

      await vi.waitFor(() =>
        expect(sendMessage).toHaveBeenCalledWith({
          type: "REMOVE_SHARED_TEMPLATE_SET_MEMBER",
          setId: "set-1",
          fieldProfileId: "field-1",
        }),
      );
      await vi.waitFor(() => expect(root.textContent).toContain("This field left sharing"));
      expect(onLastActionChange).toHaveBeenCalledWith({
        type: "stop-sharing",
        fieldProfileId: "field-1",
        set,
        endedSharedBindings: [],
        snapshotBindings: [],
        dormantBindings: [],
        removedFieldStates: [],
      });
    });

    it("routes New template, Bind, and Unbind to the Shared-scope commands with Shared Template Set wording while shared", async () => {
      const set = { id: "set-1", siteId: "example.test", name: "Contact fields", memberFieldProfileIds: ["field-1", "field-2"] };
      const template = { id: "template-existing", content: "Existing shared template", siteAffinities: ["example.test"], createdAt: "x", updatedAt: "x", totalUsageCount: 0, revision: 0 };
      const state = { ...emptyState, templates: [template], sharedTemplateSets: [set] };
      const createdBinding = {
        template: { id: "template-new", content: "New shared template", siteAffinities: ["example.test"], createdAt: "x", updatedAt: "x", totalUsageCount: 0, revision: 0 },
        sharedBinding: { id: "shared-binding-new", setId: "set-1", templateId: "template-new", usageCount: 0, revision: 0, order: 0 },
      };
      const sendMessage = vi.fn().mockImplementation((request: { type: string }) => {
        if (request.type === "CREATE_TEMPLATE_AND_BIND_SHARED") return Promise.resolve({ ok: true, value: createdBinding });
        return Promise.resolve({ ok: true, value: state });
      });
      vi.stubGlobal("chrome", {
        runtime: { sendMessage, onMessage: { addListener: vi.fn(), removeListener: vi.fn() } },
      });
      const onLastActionChange = vi.fn();
      const root = draw({ onLastActionChange });

      await vi.waitFor(() => expect(root.textContent).toContain("Shared"));
      clickButton(root, "New template");
      await Promise.resolve();
      const textarea = root.querySelector("textarea");
      expect(textarea).not.toBeNull();
      (textarea as HTMLTextAreaElement).value = "New shared template";
      textarea!.dispatchEvent(new InputEvent("input", { bubbles: true }));
      await Promise.resolve();
      clickButton(root, "Save for shared fields");

      await vi.waitFor(() =>
        expect(sendMessage).toHaveBeenCalledWith({
          type: "CREATE_TEMPLATE_AND_BIND_SHARED",
          setId: "set-1",
          content: "New shared template",
        }),
      );
      await vi.waitFor(() =>
        expect(root.textContent).toContain("Saved and bound to the Shared Template Set (2 fields)"),
      );
      expect(onLastActionChange).toHaveBeenCalledWith({
        type: "create-bind-shared",
        setId: "set-1",
        template: createdBinding.template,
        sharedBindingId: "shared-binding-new",
      });
    });

    it("offers every dynamically-added, never-bound Field on the page as a candidate, not only the first two (Task 021 regression)", async () => {
      // Regression: a page's own "generate new fields" button can add any
      // number of new same-kind Fields (name1, name2, name3, name4, ...)
      // after load. None of them has a durable Field Profile until bound to
      // something, so all of them - not just however many happened to
      // already be durable - must be selectable and shareable.
      const liveCandidates = [3, 4, 5].map((n) => ({
        fieldIdentityKey: `{"semanticKind":"name","ordinal":${n}}`,
        documentOrder: n,
        observedTitle: `Name ${n}`,
      }));
      const setResult = {
        set: {
          id: "set-1",
          siteId: "example.test",
          name: "Shared Template Set 1",
          memberFieldProfileIds: ["field-1", "generated-field"],
        },
        sharedBindings: [],
      };
      // The current Field's own page must already be durable for
      // addFieldCandidates to resolve a Site to filter candidates against -
      // the current Field itself may still be genuinely unbound.
      const state = { ...emptyState, pageProfiles: [{ id: "page-1", siteId: "example.test" }] };
      const sendMessage = vi.fn().mockImplementation((request: { type: string }) => {
        if (request.type === "CREATE_SHARED_TEMPLATE_SET") return Promise.resolve({ ok: true, value: setResult });
        if (request.type === "FIND_SIMILAR_FIELD_CANDIDATES") {
          return Promise.resolve({ ok: true, value: { candidates: [], suggestedFieldProfileId: null, currentFieldLabel: "this field" } });
        }
        return Promise.resolve({ ok: true, value: state });
      });
      vi.stubGlobal("chrome", {
        runtime: { sendMessage, onMessage: { addListener: vi.fn(), removeListener: vi.fn() } },
      });
      const onLastActionChange = vi.fn();
      const root = draw({ onLastActionChange, pageFieldCandidates: liveCandidates });

      await vi.waitFor(() => expect(root.textContent).toContain("following focus"));
      clickButton(root, "Share with…");
      await vi.waitFor(() => expect(root.querySelectorAll(".find-similar-row").length).toBe(3));

      expect(root.textContent).toContain("Name 3");
      expect(root.textContent).toContain("Name 4");
      expect(root.textContent).toContain("Name 5");
      // Share the 3rd never-bound candidate specifically, by name - not
      // just the first one, which is what a boundary bug at "2" would
      // still let pass.
      const fifthRow = [...root.querySelectorAll(".find-similar-row")].find((row) =>
        row.textContent?.includes("Name 5"),
      );
      const fifthShareButton = Array.from(fifthRow?.querySelectorAll<HTMLButtonElement>("button") ?? []).find(
        (button) => button.textContent?.trim() === "Share",
      );
      expect(fifthShareButton).not.toBeNull();
      (fifthShareButton as HTMLButtonElement).click();

      await vi.waitFor(() =>
        expect(sendMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "CREATE_SHARED_TEMPLATE_SET",
            fieldProfileIds: expect.arrayContaining(["field-1"]),
            newFields: expect.arrayContaining([
              expect.objectContaining({ fieldProfileId: "field-1" }),
              expect.objectContaining({ fieldIdentityKey: `{"semanticKind":"name","ordinal":5}` }),
            ]),
          }),
        ),
      );
      await vi.waitFor(() => expect(root.textContent).not.toMatch(/Field Profile not found/u));
      await vi.waitFor(() => expect(onLastActionChange).toHaveBeenCalledWith({ type: "create-shared-set", setId: "set-1" }));
    });

    // Owner QA 2026-09-15. A row's page highlight was cleared only by the row's
    // own mouseleave or blur, and neither reaches a row that goes away while
    // the pointer rests on it: Back pressed from the keyboard, or a
    // confirmation opening in the list's place. The page Field stayed outlined
    // until the Picker closed. Task 024: row hover and page highlight clear
    // together.
    it("clears a Field's page highlight when Share takes its row away", async () => {
      const setResult = {
        set: { id: "set-1", siteId: "example.test", name: "Shared Template Set 1", memberFieldProfileIds: ["field-1", "generated-field"] },
        sharedBindings: [],
      };
      const state = { ...emptyState, pageProfiles: [{ id: "page-1", siteId: "example.test" }] };
      vi.stubGlobal("chrome", {
        runtime: {
          sendMessage: vi.fn().mockImplementation((request: { type: string }) => {
            if (request.type === "CREATE_SHARED_TEMPLATE_SET") return Promise.resolve({ ok: true, value: setResult });
            if (request.type === "FIND_SIMILAR_FIELD_CANDIDATES") {
              return Promise.resolve({ ok: true, value: { candidates: [], suggestedFieldProfileId: null, currentFieldLabel: "this field" } });
            }
            return Promise.resolve({ ok: true, value: state });
          }),
          onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
        },
      });
      const onSharedFieldCandidateHighlight = vi.fn();
      const root = draw({
        onSharedFieldCandidateHighlight,
        pageFieldCandidates: [{ fieldIdentityKey: "subject-key", documentOrder: 1, observedTitle: "Subject" }],
      });

      await vi.waitFor(() => expect(root.textContent).toContain("following focus"));
      clickButton(root, "Share with…");
      await vi.waitFor(() => expect(root.querySelectorAll(".find-similar-row").length).toBe(1));
      const row = root.querySelector<HTMLElement>(".find-similar-row")!;
      row.dispatchEvent(new MouseEvent("mouseenter"));
      expect(onSharedFieldCandidateHighlight).toHaveBeenLastCalledWith("subject-key");

      [...row.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent?.trim() === "Share")!.click();

      await vi.waitFor(() => expect(root.querySelector(".find-similar-row")).toBeNull());
      await vi.waitFor(() => expect(onSharedFieldCandidateHighlight).toHaveBeenLastCalledWith(null));
    });

    it("clears a Field's page highlight when Share opens its confirmation in the row's place", async () => {
      // The candidate is already in a Set, so Share asks before joining it.
      const state = {
        ...emptyState,
        pageProfiles: [{ id: "page-1", siteId: "example.test" }],
        fieldProfiles: [
          { id: "field-2", pageProfileId: "page-1", identityKey: "recipient-key", observedTitle: "Recipient name" },
          { id: "field-3", pageProfileId: "page-1", identityKey: "other-key", observedTitle: "Other name" },
        ],
        sharedTemplateSets: [
          { id: "set-2", siteId: "example.test", name: "Recipients", memberFieldProfileIds: ["field-2", "field-3"] },
        ],
      };
      vi.stubGlobal("chrome", {
        runtime: {
          sendMessage: vi.fn().mockImplementation((request: { type: string }) => {
            if (request.type === "FIND_SIMILAR_FIELD_CANDIDATES") {
              return Promise.resolve({ ok: true, value: { candidates: [], suggestedFieldProfileId: null, currentFieldLabel: "this field" } });
            }
            return Promise.resolve({ ok: true, value: state });
          }),
          onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
        },
      });
      const onSharedFieldCandidateHighlight = vi.fn();
      const root = draw({
        onSharedFieldCandidateHighlight,
        pageFieldCandidates: [{ fieldIdentityKey: "recipient-key", documentOrder: 1, observedTitle: "Recipient name" }],
      });

      await vi.waitFor(() => expect(root.textContent).toContain("following focus"));
      clickButton(root, "Share with…");
      await vi.waitFor(() => expect(root.textContent).toContain("Recipient name"));
      const row = [...root.querySelectorAll<HTMLElement>(".find-similar-row")].find((candidate) =>
        candidate.textContent?.includes("Recipient name"),
      )!;
      row.dispatchEvent(new MouseEvent("mouseenter"));
      expect(onSharedFieldCandidateHighlight).toHaveBeenLastCalledWith("recipient-key");

      [...row.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent?.trim() === "Share")!.click();

      await vi.waitFor(() => expect(root.querySelector(".find-similar-row")).toBeNull());
      await vi.waitFor(() => expect(onSharedFieldCandidateHighlight).toHaveBeenLastCalledWith(null));
    });

    it("clears a Field's page highlight when Back takes the list away under the pointer", async () => {
      const state = { ...emptyState, pageProfiles: [{ id: "page-1", siteId: "example.test" }] };
      vi.stubGlobal("chrome", {
        runtime: {
          sendMessage: vi.fn().mockImplementation((request: { type: string }) => {
            if (request.type === "FIND_SIMILAR_FIELD_CANDIDATES") {
              return Promise.resolve({ ok: true, value: { candidates: [], suggestedFieldProfileId: null, currentFieldLabel: "this field" } });
            }
            return Promise.resolve({ ok: true, value: state });
          }),
          onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
        },
      });
      const onSharedFieldCandidateHighlight = vi.fn();
      const root = draw({
        onSharedFieldCandidateHighlight,
        pageFieldCandidates: [{ fieldIdentityKey: "subject-key", documentOrder: 1, observedTitle: "Subject" }],
      });

      await vi.waitFor(() => expect(root.textContent).toContain("following focus"));
      clickButton(root, "Share with…");
      await vi.waitFor(() => expect(root.querySelectorAll(".find-similar-row").length).toBe(1));
      root.querySelector<HTMLElement>(".find-similar-row")!.dispatchEvent(new MouseEvent("mouseenter"));
      expect(onSharedFieldCandidateHighlight).toHaveBeenLastCalledWith("subject-key");

      // Activated from the keyboard: the pointer never leaves the row.
      root.querySelector<HTMLButtonElement>("header .back")!.click();

      await vi.waitFor(() => expect(root.querySelector(".find-similar-row")).toBeNull());
      await vi.waitFor(() => expect(onSharedFieldCandidateHighlight).toHaveBeenLastCalledWith(null));
    });

    it("uses a compact count badge and static effective Shared Template previews for a current-page candidate", async () => {
      const state = {
        ...emptyState,
        templates: [{ id: "template-2", content: "Saved recipient reply", siteAffinities: ["example.test"], createdAt: "x", updatedAt: "x", totalUsageCount: 0, revision: 0 }],
        pageProfiles: [{ id: "page-1", siteId: "example.test" }],
        fieldProfiles: [
          { id: "field-2", pageProfileId: "page-1", identityKey: "candidate-name", observedTitle: "Recipient name" },
          { id: "field-3", pageProfileId: "page-1", identityKey: "other-name", observedTitle: "Other name" },
        ],
        // A Shared member's direct Bindings are dormant; Finder must preview
        // the Set's effective list, not this underlying storage list.
        bindings: [],
        sharedTemplateSets: [
          { id: "set-2", siteId: "example.test", name: "Other names", memberFieldProfileIds: ["field-2", "field-3"] },
        ],
        sharedTemplateBindings: [
          { id: "shared-binding-2", setId: "set-2", templateId: "template-2", usageCount: 0, revision: 0, order: 0 },
        ],
      };
      vi.stubGlobal("chrome", {
        runtime: {
          sendMessage: vi.fn().mockImplementation((request: { type: string }) => {
            if (request.type === "FIND_SIMILAR_FIELD_CANDIDATES") {
              return Promise.resolve({ ok: true, value: { candidates: [], suggestedFieldProfileId: null, currentFieldLabel: "this field" } });
            }
            return Promise.resolve({ ok: true, value: state });
          }),
          onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
        },
      });
      const root = draw({ pageFieldCandidates: [{ fieldIdentityKey: "candidate-name", documentOrder: 1, observedTitle: "Recipient name" }] });

      await vi.waitFor(() => expect(root.textContent).toContain("following focus"));
      clickButton(root, "Share with…");
      const fieldRow = await vi.waitFor(() => {
        const found = Array.from(root.querySelectorAll<HTMLElement>(".find-similar-row")).find((row) =>
          row.textContent?.includes("Recipient name"),
        );
        if (!found) throw new Error("Current-page candidate row not found");
        return found;
      });
      const countBadge = fieldRow.querySelector<HTMLElement>(".find-similar-template-count");
      expect(countBadge?.querySelector('[aria-hidden="true"]')?.textContent).toBe("1");
      expect(countBadge?.getAttribute("title")).toBe("1 saved Template");
      const arrow = Array.from(fieldRow.querySelectorAll<HTMLButtonElement>("button")).find(
        (button) => button.getAttribute("aria-label") === 'Show saved Templates for "Recipient name"',
      );
      const fieldLabel = fieldRow.querySelector(".find-similar-field-label");
      if (!arrow || !fieldLabel) throw new Error("Current-page summary controls not found");
      expect(Boolean(arrow.compareDocumentPosition(fieldLabel) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
      clickButton(root, 'Show saved Templates for "Recipient name"');
      await vi.waitFor(() => expect(root.textContent).toContain("Saved recipient reply"));
      const savedPreview = fieldRow.querySelector<HTMLElement>(".find-similar-saved-template-text");
      expect(savedPreview?.textContent).toBe("Saved recipient reply");
      savedPreview?.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
      expect(chrome.runtime.sendMessage).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: "HIGHLIGHT_SHARED_FIELD_CANDIDATE" }),
      );
      expect(root.querySelector('textarea[aria-label="Edit Template content"]')).toBeNull();
      expect(root.querySelector('[aria-label="Remove"]')).toBeNull();
    });

    it("anchors In this page at the current Field, then opens its following DOM neighbours before offering all other Fields", async () => {
      const liveCandidates = [5, 1, 8, 2, 7, 4, 6].map((n) => ({
        fieldIdentityKey: `{"ordinal":${n}}`,
        documentOrder: n,
        observedTitle: `Field ${n}`,
      }));
      const state = { ...emptyState, pageProfiles: [{ id: "page-1", siteId: "example.test" }] };
      vi.stubGlobal("chrome", {
        runtime: {
          sendMessage: vi.fn().mockImplementation((request: { type: string }) => {
            if (request.type === "FIND_SIMILAR_FIELD_CANDIDATES") {
              return Promise.resolve({ ok: true, value: { candidates: [], suggestedFieldProfileId: null, currentFieldLabel: "this field" } });
            }
            return Promise.resolve({ ok: true, value: state });
          }),
          onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
        },
      });
      const root = draw({
        fieldObservedTitle: "Field 3",
        fieldDocumentOrder: 3,
        pageFieldCandidates: liveCandidates,
      });

      await vi.waitFor(() => expect(root.textContent).toContain("following focus"));
      clickButton(root, "Share with…");
      await vi.waitFor(() => expect(root.querySelectorAll(".find-similar-row").length).toBe(4));

      const shortlist = [...root.querySelectorAll(".find-similar-field-label")].map((row) => row.textContent?.trim());
      expect(root.querySelector(".find-similar-current-field")?.textContent).toContain("Field 3");
      expect(root.querySelector(".find-similar-before-count button")?.textContent).toBe("Show the 2 fields before");
      expect(shortlist).toEqual(["Field 4", "Field 5", "Field 6", "Field 7"]);
      expect(root.textContent).not.toContain("Field 8");

      // Owner QA 2026-09-15: the Fields before open on their own, without
      // listing every other Field.
      clickButton(root, "Show the 2 fields before");
      await vi.waitFor(() => expect(root.querySelectorAll(".find-similar-row").length).toBe(6));
      expect([...root.querySelectorAll(".find-similar-field-label")].map((row) => row.textContent?.trim()))
        .toEqual(["Field 1", "Field 2", "Field 4", "Field 5", "Field 6", "Field 7"]);
      expect(root.querySelector(".find-similar-before-count")).toBeNull();

      clickButton(root, "Show all 7 other Fields");
      await vi.waitFor(() => expect(root.querySelectorAll(".find-similar-row").length).toBe(7));
      const expandedListItems = [...root.querySelectorAll<HTMLElement>(".shared-field-candidates > li")]
        .map((row) => row.classList.contains("find-similar-current-field")
          ? `Focused field${row.querySelector("strong")?.textContent?.trim()}`
          : row.querySelector(".find-similar-field-label")?.textContent?.trim());
      expect(expandedListItems).toEqual([
        "Field 1",
        "Field 2",
        "Focused fieldField 3",
        "Field 4",
        "Field 5",
        "Field 6",
        "Field 7",
        "Field 8",
      ]);
      expect([...root.querySelectorAll(".find-similar-field-label")].map((row) => row.textContent?.trim()))
        .toEqual(["Field 1", "Field 2", "Field 4", "Field 5", "Field 6", "Field 7", "Field 8"]);
      expect(root.textContent).toContain("Field 8");
    });

    it("keeps In this page candidates in DOM order even when labels share words with the current Field", async () => {
      const state = { ...emptyState, pageProfiles: [{ id: "page-1", siteId: "example.test" }] };
      vi.stubGlobal("chrome", {
        runtime: {
          sendMessage: vi.fn().mockImplementation((request: { type: string }) => {
            if (request.type === "FIND_SIMILAR_FIELD_CANDIDATES") {
              return Promise.resolve({ ok: true, value: { candidates: [], suggestedFieldProfileId: null, currentFieldLabel: "this field" } });
            }
            return Promise.resolve({ ok: true, value: state });
          }),
          onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
        },
      });
      const root = draw({
        fieldObservedTitle: "Next of Kin name",
        pageFieldCandidates: [
          { fieldIdentityKey: "other-1", documentOrder: 0, observedTitle: "Phone" },
          { fieldIdentityKey: "name-1", documentOrder: 1, observedTitle: "Name one" },
          { fieldIdentityKey: "other-2", documentOrder: 2, observedTitle: "Address" },
          { fieldIdentityKey: "name-2", documentOrder: 3, observedTitle: "Family name" },
        ],
      });
      await vi.waitFor(() => expect(root.textContent).toContain("following focus"));
      clickButton(root, "Share with…");
      await vi.waitFor(() => expect(root.querySelectorAll(".find-similar-row").length).toBe(4));
      expect([...root.querySelectorAll(".find-similar-field-label")].map((row) => row.textContent?.trim()))
        .toEqual(["Phone", "Name one", "Address", "Family name"]);
    });

    it("locates a current-page candidate without turning it into the Picker's focused Field", async () => {
      const state = { ...emptyState, pageProfiles: [{ id: "page-1", siteId: "example.test" }] };
      vi.stubGlobal("chrome", {
        runtime: {
          sendMessage: vi.fn().mockImplementation((request: { type: string }) => {
            if (request.type === "FIND_SIMILAR_FIELD_CANDIDATES") {
              return Promise.resolve({ ok: true, value: { candidates: [], suggestedFieldProfileId: null, currentFieldLabel: "this field" } });
            }
            return Promise.resolve({ ok: true, value: state });
          }),
          onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
        },
      });
      const onLocate = vi.fn();
      const root = draw({
        pageFieldCandidates: [{ fieldIdentityKey: "candidate-name", documentOrder: 1, observedTitle: "Recipient name" }],
        onSharedFieldCandidateLocate: onLocate,
      });

      await vi.waitFor(() => expect(root.textContent).toContain("following focus"));
      clickButton(root, "Share with…");
      const locate = await vi.waitFor(() => {
        const found = Array.from(root.querySelectorAll<HTMLButtonElement>("button")).find(
          (button) => button.getAttribute("aria-label") === 'Locate "Recipient name" on page',
        );
        if (!found) throw new Error("Locate action not found");
        return found;
      });
      expect(locate.querySelector('[data-fillnest-icon="map-pin"]')).not.toBeNull();
      expect(locate.getAttribute("data-tooltip")).toBe("Locate on page");
      locate.click();
      expect(onLocate).toHaveBeenCalledWith("candidate-name");
      expect(root.textContent).toContain("following focus");
    });

    it("Task 027: a Shared Set member's Search results offer 'Bind to this field' and 'Bind to Shared Set' separately", async () => {
      const state = {
        ...emptyState,
        templates: [
          { id: "template-elsewhere", content: "Found via search", siteAffinities: ["example.test"], createdAt: "x", updatedAt: "x", totalUsageCount: 0, revision: 0 },
        ],
        sharedTemplateSets: [
          { id: "set-1", siteId: "example.test", name: "Contact fields", memberFieldProfileIds: ["field-1", "field-2"] },
        ],
      };
      const sendMessage = vi.fn().mockResolvedValue({ ok: true, value: state });
      vi.stubGlobal("chrome", {
        runtime: { sendMessage, onMessage: { addListener: vi.fn(), removeListener: vi.fn() } },
      });
      const root = draw();
      await vi.waitFor(() => expect(root.textContent).toContain("Shared"));

      const searchInput = root.querySelector<HTMLInputElement>('input[aria-label="Search templates"]');
      if (!searchInput) throw new Error("Search input not found");
      searchInput.value = "found";
      searchInput.dispatchEvent(new InputEvent("input", { bubbles: true }));
      await vi.waitFor(() => expect(root.querySelector('[aria-label="Bind to this field"]')).not.toBeNull());
      const fieldBind = root.querySelector('[aria-label="Bind to this field"]');
      const setBind = root.querySelector('[aria-label="Bind to Shared Set"]');
      expect(fieldBind?.querySelector('[data-fillnest-asset="plugs-connected.svg"]')).not.toBeNull();
      expect(setBind?.querySelector('[data-fillnest-asset="share-network.svg"]')).not.toBeNull();

      clickButton(root, "Bind to this field");
      await vi.waitFor(() =>
        expect(sendMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "BIND_TEMPLATE_TO_FIELD_ONLY",
            setId: "set-1",
            fieldProfileId: "field-1",
            templateId: "template-elsewhere",
          }),
        ),
      );
    });

    it("Task 027: a Field-only relationship offers 'Share this version', promoting it for the whole Set", async () => {
      const state = {
        ...emptyState,
        templates: [
          { id: "template-private", content: "A's private template", siteAffinities: ["example.test"], createdAt: "x", updatedAt: "x", totalUsageCount: 0, revision: 0 },
        ],
        sharedTemplateSets: [
          { id: "set-1", siteId: "example.test", name: "Contact fields", memberFieldProfileIds: ["field-1", "field-2"] },
        ],
        sharedTemplateBindings: [
          { id: "slot-owner", setId: "set-1", templateId: "template-private", usageCount: 0, revision: 0, order: 0, ownerFieldProfileId: "field-1" },
        ],
      };
      const sendMessage = vi.fn().mockImplementation((request: { type: string }) => {
        if (request.type === "PROMOTE_FIELD_ONLY_SLOT") {
          return Promise.resolve({
            ok: true,
            value: {
              sharedBinding: { id: "slot-owner", setId: "set-1", templateId: "template-private", usageCount: 0, revision: 0, order: 0 },
              previousOwnerFieldProfileId: "field-1",
            },
          });
        }
        return Promise.resolve({ ok: true, value: state });
      });
      vi.stubGlobal("chrome", {
        runtime: { sendMessage, onMessage: { addListener: vi.fn(), removeListener: vi.fn() } },
      });
      const root = draw();
      await vi.waitFor(() => expect(root.textContent).toContain("A's private template"));

      // Task 027 Explicit Scope UI: the audience change is stated, with the
      // affected Set and its member count, BEFORE anything is mutated.
      clickButton(root, "Share this version");
      await vi.waitFor(() => expect(root.textContent).toContain("with the whole Shared Template Set?"));
      expect(root.textContent).toContain("all 2 fields");
      expect(root.textContent).toContain("Contact fields");
      expect(sendMessage).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: "PROMOTE_FIELD_ONLY_SLOT" }),
      );

      clickButton(root, "Share with the Set");
      await vi.waitFor(() =>
        expect(sendMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "PROMOTE_FIELD_ONLY_SLOT",
            setId: "set-1",
            slotId: "slot-owner",
            fieldProfileId: "field-1",
          }),
        ),
      );
      await vi.waitFor(() => expect(root.textContent).toContain("Shared \"A's private template\" with the whole Set"));
    });

    it("Task 027 Addendum B: 'Share with a different field...' offers 'Join Set & Share' for a not-yet-shared target, with confirmation, busy state, and Undo", async () => {
      const state = {
        ...emptyState,
        templates: [
          { id: "template-private", content: "A's private template", siteAffinities: ["example.test"], createdAt: "x", updatedAt: "x", totalUsageCount: 0, revision: 0 },
        ],
        pageProfiles: [{ id: "page-1", siteId: "example.test" }, { id: "page-3", siteId: "example.test", userAlias: "Newsletter page" }],
        fieldProfiles: [
          { id: "field-1", pageProfileId: "page-1" },
          { id: "field-2", pageProfileId: "page-1" },
          { id: "field-3", pageProfileId: "page-3", observedTitle: "Newsletter email" },
        ],
        sharedTemplateSets: [
          { id: "set-1", siteId: "example.test", name: "Contact fields", memberFieldProfileIds: ["field-1", "field-2"] },
        ],
        sharedTemplateBindings: [
          { id: "slot-owner", setId: "set-1", templateId: "template-private", usageCount: 0, revision: 0, order: 0, ownerFieldProfileId: "field-1" },
        ],
      };
      const candidatesResult = {
        currentFieldLabel: "This field",
        candidates: [
          {
            fieldProfileId: "field-3",
            siteId: "example.test",
            pageProfileId: "page-3",
            siteLabel: "example.test",
            pageLabel: "Newsletter page",
            fieldLabel: "Newsletter email",
            crossSite: false,
            highConfidence: true,
            decided: false,
            alreadyLinked: false,
            templateCount: 0,
            templatePreviews: [],
            existingSetId: null,
            existingSetMemberCount: 0,
          },
        ],
        suggestedFieldProfileId: null,
      };
      const joinResult = {
        set: { id: "set-1", siteId: "example.test", name: "Contact fields", memberFieldProfileIds: ["field-1", "field-2", "field-3"] },
        sharedBinding: { id: "slot-owner", setId: "set-1", templateId: "template-private", usageCount: 0, revision: 1, order: 0 },
        addUndo: { previousSet: state.sharedTemplateSets[0], expectedSet: state.sharedTemplateSets[0], previousSharedBindings: [], expectedSharedBindings: [] },
        previousOwnerFieldProfileId: "field-1",
      };
      let resolveJoin: (() => void) | undefined;
      const sendMessage = vi.fn().mockImplementation((request: { type: string }) => {
        if (request.type === "FIND_SIMILAR_FIELD_CANDIDATES") return Promise.resolve({ ok: true, value: candidatesResult });
        if (request.type === "JOIN_SET_AND_SHARE") {
          return new Promise((resolve) => {
            resolveJoin = () => resolve({ ok: true, value: joinResult });
          });
        }
        return Promise.resolve({ ok: true, value: state });
      });
      vi.stubGlobal("chrome", {
        runtime: { sendMessage, onMessage: { addListener: vi.fn(), removeListener: vi.fn() } },
      });
      const onLastActionChange = vi.fn();
      const root = draw({ onLastActionChange });
      await vi.waitFor(() => expect(root.textContent).toContain("A's private template"));

      clickButton(root, "Share this version");
      await vi.waitFor(() => expect(root.textContent).toContain("with the whole Shared Template Set?"));
      clickButton(root, "Share with a different field…");

      await vi.waitFor(() => expect(root.querySelector('input[aria-label="Search Fields to share with"]')).not.toBeNull());
      await vi.waitFor(() => expect(root.textContent).toContain("Newsletter email"));

      clickButton(root, "Share");
      // Task 027 Explicit Scope UI: names the affected Field/Set and member
      // count, and states the Set membership change, before any mutation.
      await vi.waitFor(() => expect(root.textContent).toContain("Join Set & Share"));
      expect(root.textContent).toContain("Newsletter email");
      expect(root.textContent).toContain("Contact fields");
      expect(sendMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: "JOIN_SET_AND_SHARE" }));

      clickButton(root, "Join Set & Share");
      await vi.waitFor(() =>
        expect(sendMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "JOIN_SET_AND_SHARE",
            setId: "set-1",
            slotId: "slot-owner",
            fieldProfileId: "field-1",
            targetFieldProfileId: "field-3",
            allowCrossSite: false,
          }),
        ),
      );
      // Busy state: the composite's own confirm button is disabled while the
      // request is in flight, matching the existing Finder Link pattern.
      const confirmButton = Array.from(root.querySelectorAll<HTMLButtonElement>("button")).find(
        (button) => button.textContent === "Join Set & Share",
      );
      expect(confirmButton?.disabled).toBe(true);
      resolveJoin?.();
      await vi.waitFor(() =>
        expect(onLastActionChange).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "join-set-and-share",
            setId: "set-1",
            targetFieldProfileId: "field-3",
            slotId: "slot-owner",
            previousOwnerFieldProfileId: "field-1",
          }),
        ),
      );
      // A successful composite returns to the ordinary list view.
      await vi.waitFor(() => expect(root.querySelector('input[aria-label="Search Fields to share with"]')).toBeNull());
    });

    it("Task 027 Addendum B: 'Share with a different field...' offers 'Merge Sets & Share' for a target already in a different Set", async () => {
      const state = {
        ...emptyState,
        templates: [
          { id: "template-private", content: "A's private template", siteAffinities: ["example.test"], createdAt: "x", updatedAt: "x", totalUsageCount: 0, revision: 0 },
        ],
        pageProfiles: [{ id: "page-1", siteId: "example.test" }, { id: "page-3", siteId: "example.test", userAlias: "Newsletter page" }],
        fieldProfiles: [
          { id: "field-1", pageProfileId: "page-1" },
          { id: "field-2", pageProfileId: "page-1" },
          { id: "field-3", pageProfileId: "page-3", observedTitle: "Newsletter email" },
        ],
        sharedTemplateSets: [
          { id: "set-1", siteId: "example.test", name: "Contact fields", memberFieldProfileIds: ["field-1", "field-2"] },
          { id: "set-2", siteId: "example.test", name: "Newsletter fields", memberFieldProfileIds: ["field-3"] },
        ],
        sharedTemplateBindings: [
          { id: "slot-owner", setId: "set-1", templateId: "template-private", usageCount: 0, revision: 0, order: 0, ownerFieldProfileId: "field-1" },
        ],
      };
      const candidatesResult = {
        currentFieldLabel: "This field",
        candidates: [
          {
            fieldProfileId: "field-3",
            siteId: "example.test",
            pageProfileId: "page-3",
            siteLabel: "example.test",
            pageLabel: "Newsletter page",
            fieldLabel: "Newsletter email",
            crossSite: false,
            highConfidence: true,
            decided: false,
            alreadyLinked: false,
            templateCount: 1,
            templatePreviews: ["Welcome!"],
            existingSetId: "set-2",
            existingSetMemberCount: 1,
          },
        ],
        suggestedFieldProfileId: null,
      };
      const mergeResult = {
        set: { id: "set-1", siteId: "example.test", name: "Contact fields", memberFieldProfileIds: ["field-1", "field-2", "field-3"] },
        bindings: [],
        removedSet: state.sharedTemplateSets[1],
        removedSetBindings: [],
        previousKeepSet: state.sharedTemplateSets[0],
        previousKeepSetBindings: [],
        remappedFieldStates: [],
        previousRemovedSetFieldStates: [],
        sharedBinding: { id: "slot-owner", setId: "set-1", templateId: "template-private", usageCount: 0, revision: 1, order: 0 },
        previousOwnerFieldProfileId: "field-1",
      };
      const sendMessage = vi.fn().mockImplementation((request: { type: string }) => {
        if (request.type === "FIND_SIMILAR_FIELD_CANDIDATES") return Promise.resolve({ ok: true, value: candidatesResult });
        if (request.type === "MERGE_SETS_AND_SHARE") return Promise.resolve({ ok: true, value: mergeResult });
        return Promise.resolve({ ok: true, value: state });
      });
      vi.stubGlobal("chrome", {
        runtime: { sendMessage, onMessage: { addListener: vi.fn(), removeListener: vi.fn() } },
      });
      const onLastActionChange = vi.fn();
      const root = draw({ onLastActionChange });
      await vi.waitFor(() => expect(root.textContent).toContain("A's private template"));

      clickButton(root, "Share this version");
      await vi.waitFor(() => expect(root.textContent).toContain("with the whole Shared Template Set?"));
      clickButton(root, "Share with a different field…");
      await vi.waitFor(() => expect(root.textContent).toContain("Newsletter email"));

      clickButton(root, "Share");
      await vi.waitFor(() => expect(root.textContent).toContain("Merge Shared Template Sets"));
      expect(sendMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: "MERGE_SETS_AND_SHARE" }));

      clickButton(root, "Merge Sets & Share");
      await vi.waitFor(() =>
        expect(sendMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "MERGE_SETS_AND_SHARE",
            keepSetId: "set-1",
            removeSetId: "set-2",
            slotId: "slot-owner",
            fieldProfileId: "field-1",
          }),
        ),
      );
      await vi.waitFor(() =>
        expect(onLastActionChange).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "merge-sets-and-share",
            removedSet: mergeResult.removedSet,
            slotId: "slot-owner",
            previousOwnerFieldProfileId: "field-1",
          }),
        ),
      );
    });
  });

  describe("Find similar field (Task 024 Slice 2)", () => {
    const emptyState = {
      schemaVersion: 13,
      sites: [],
      templates: [],
      pageProfiles: [],
      fieldProfiles: [],
      bindings: [],
      sharedTemplateSets: [],
      sharedTemplateBindings: [],
      sharedTemplateFieldStates: [],
      compatibilityPairDecisions: [],
      pickerPosition: null,
      pageStatusPosition: null,
    };

    function draw(overrides: Partial<Parameters<typeof InlinePicker>[0]> = {}) {
      const root = document.createElement("div");
      document.body.append(root);
      const field = document.createElement("input");
      render(
        <InlinePicker
          targetField={field}
          pageProfileId="page-1"
          fieldProfileId="field-1"
          pageIdentityKey="page-key"
          fieldIdentityKey="field-key"
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
          {...overrides}
        />,
        root,
      );
      return root;
    }

    it("opens the Target Field Picker, offers a Suggested Field, and Links Templates with it", async () => {
      const state = { ...emptyState, pageProfiles: [{ id: "page-1", siteId: "example.test" }] };
      const candidatesResult = {
        currentFieldLabel: "This field",
        candidates: [
          {
            fieldProfileId: "field-2",
            siteId: "example.test",
            pageProfileId: "page-1",
            siteLabel: "example.test",
            pageLabel: "Profile page",
            fieldLabel: "Billing email",
            crossSite: false,
            highConfidence: true,
            decided: false,
            alreadyLinked: false,
            templateCount: 1,
            templatePreviews: ["Thanks for reaching out"],
          },
        ],
        suggestedFieldProfileId: "field-2",
      };
      const setResult = {
        set: { id: "set-1", siteId: "example.test", name: "Shared Template Set 1", memberFieldProfileIds: ["field-1", "field-2"] },
        sharedBindings: [],
      };
      const sendMessage = vi.fn().mockImplementation((request: { type: string }) => {
        if (request.type === "FIND_SIMILAR_FIELD_CANDIDATES") return Promise.resolve({ ok: true, value: candidatesResult });
        if (request.type === "CREATE_SHARED_TEMPLATE_SET") return Promise.resolve({ ok: true, value: setResult });
        return Promise.resolve({ ok: true, value: state });
      });
      vi.stubGlobal("chrome", {
        runtime: { sendMessage, onMessage: { addListener: vi.fn(), removeListener: vi.fn() } },
      });
      const onLastActionChange = vi.fn();
      const root = draw({ onLastActionChange });

      await vi.waitFor(() => expect(root.textContent).toContain("following focus"));
      clickButton(root, "Share with…");
      await vi.waitFor(() =>
        expect(sendMessage).toHaveBeenCalledWith({
          type: "FIND_SIMILAR_FIELD_CANDIDATES",
          fieldProfileId: "field-1",
          newField: {
            pageUrl: "http://localhost:3000/profile",
            pageProfileId: "page-1",
            fieldProfileId: "field-1",
            pageIdentityKey: "page-key",
            fieldIdentityKey: "field-key",
          },
        }),
      );
      // Cross-page results only ever appear once the user explicitly Searches.
      expect(root.textContent).not.toContain("Billing email");
      const searchInput = root.querySelector<HTMLInputElement>('input[aria-label="Search Fields"]')!;
      searchInput.value = "Billing";
      searchInput.dispatchEvent(new InputEvent("input", { bubbles: true }));
      await vi.waitFor(() => expect(root.textContent).toContain("Billing email"));
      expect(root.textContent).toContain("Thanks for reaching out");

      clickButton(root, "Share");
      await vi.waitFor(() =>
        expect(sendMessage).toHaveBeenCalledWith({
          type: "CREATE_SHARED_TEMPLATE_SET",
          fieldProfileIds: ["field-1", "field-2"],
          newFields: [
            {
              pageUrl: "http://localhost:3000/profile",
              pageProfileId: "page-1",
              fieldProfileId: "field-1",
              pageIdentityKey: "page-key",
              fieldIdentityKey: "field-key",
            },
          ],
          allowCrossSite: false,
        }),
      );
      await vi.waitFor(() => expect(onLastActionChange).toHaveBeenCalledWith({ type: "create-shared-set", setId: "set-1" }));
      // A successful Link closes the Target Field Picker back to the ordinary view.
      await vi.waitFor(() => expect(root.querySelector('input[aria-label="Search Fields"]')).toBeNull());
    });

    it("shows no cross-page candidate until the user Searches, then shares Templates with the match found", async () => {
      const state = { ...emptyState, pageProfiles: [{ id: "page-1", siteId: "example.test" }] };
      const candidatesResult = {
        currentFieldLabel: "This field",
        candidates: [
          {
            fieldProfileId: "field-2",
            siteId: "example.test",
            pageProfileId: "page-2",
            siteLabel: "example.test",
            pageLabel: "Profile page",
            fieldLabel: "Unrelated field",
            crossSite: false,
            highConfidence: true,
            decided: false,
            alreadyLinked: false,
            templateCount: 1,
            templatePreviews: ["Some content"],
          },
        ],
        suggestedFieldProfileId: "field-2",
      };
      const setResult = {
        set: { id: "set-1", siteId: "example.test", name: "Shared Template Set 1", memberFieldProfileIds: ["field-1", "field-2"] },
        sharedBindings: [],
      };
      const sendMessage = vi.fn().mockImplementation((request: { type: string }) => {
        if (request.type === "FIND_SIMILAR_FIELD_CANDIDATES") return Promise.resolve({ ok: true, value: candidatesResult });
        if (request.type === "CREATE_SHARED_TEMPLATE_SET") return Promise.resolve({ ok: true, value: setResult });
        return Promise.resolve({ ok: true, value: state });
      });
      vi.stubGlobal("chrome", {
        runtime: { sendMessage, onMessage: { addListener: vi.fn(), removeListener: vi.fn() } },
      });
      const root = draw();

      await vi.waitFor(() => expect(root.textContent).toContain("following focus"));
      clickButton(root, "Share with…");
      await vi.waitFor(() => expect(root.textContent).toContain("No other reliably identified Fields on this page"));
      expect(root.textContent).not.toContain("Unrelated field");
      expect(root.querySelector(".find-similar-row")).toBeNull();

      const searchInput = root.querySelector<HTMLInputElement>('input[aria-label="Search Fields"]')!;
      searchInput.value = "Unrelated";
      searchInput.dispatchEvent(new InputEvent("input", { bubbles: true }));
      await vi.waitFor(() => expect(root.textContent).toContain("Unrelated field"));
      expect(root.querySelectorAll(".find-similar-row-actions button")).toHaveLength(1);

      clickButton(root, "Share");
      await vi.waitFor(() =>
        expect(sendMessage).toHaveBeenCalledWith(
          expect.objectContaining({ type: "CREATE_SHARED_TEMPLATE_SET", fieldProfileIds: ["field-1", "field-2"] }),
        ),
      );
    });

    it("never shows an already-shared Field in Search - there is nothing left for it to offer", async () => {
      const state = { ...emptyState, pageProfiles: [{ id: "page-1", siteId: "example.test" }] };
      const candidatesResult = {
        currentFieldLabel: "This field",
        candidates: [
          {
            fieldProfileId: "field-2",
            siteId: "example.test",
            pageProfileId: "page-2",
            siteLabel: "example.test",
            pageLabel: "Profile page",
            fieldLabel: "Already shared field",
            crossSite: false,
            highConfidence: true,
            decided: false,
            alreadyLinked: true,
            templateCount: 1,
            templatePreviews: ["Some content"],
          },
        ],
        suggestedFieldProfileId: null,
      };
      const sendMessage = vi.fn().mockImplementation((request: { type: string }) => {
        if (request.type === "FIND_SIMILAR_FIELD_CANDIDATES") return Promise.resolve({ ok: true, value: candidatesResult });
        return Promise.resolve({ ok: true, value: state });
      });
      vi.stubGlobal("chrome", {
        runtime: { sendMessage, onMessage: { addListener: vi.fn(), removeListener: vi.fn() } },
      });
      const root = draw();

      await vi.waitFor(() => expect(root.textContent).toContain("following focus"));
      clickButton(root, "Share with…");
      await vi.waitFor(() => expect(root.querySelector('input[aria-label="Search Fields"]')).not.toBeNull());
      const searchInput = root.querySelector<HTMLInputElement>('input[aria-label="Search Fields"]')!;
      searchInput.value = "Already shared";
      searchInput.dispatchEvent(new InputEvent("input", { bubbles: true }));
      await vi.waitFor(() => expect(root.textContent).toContain("No Fields match this search"));
      expect(root.textContent).not.toContain("Already shared field");
    });

    it("Search shows every cross-page match, uncapped, with a Field-name match boosted first", async () => {
      const state = { ...emptyState, pageProfiles: [{ id: "page-1", siteId: "example.test" }] };
      // 6 discoverable candidates. Only one shares a word with the Current
      // Field's own label ("Name") - it must be boosted to the front even
      // though the rest already outrank it on the repository's own
      // deterministic evidence order, and none may be dropped (Search is
      // explicit intent - never capped).
      const candidates = ["Unrelated A", "Unrelated B", "Unrelated C", "Unrelated D", "Unrelated E", "Family name"].map(
        (fieldLabel, index) => ({
          fieldProfileId: `field-${index + 2}`,
          siteId: "example.test",
          pageProfileId: "page-2",
          siteLabel: "example.test",
          pageLabel: "Profile page",
          fieldLabel,
          crossSite: false,
          highConfidence: false,
          decided: false,
          alreadyLinked: false,
          templateCount: 1,
          templatePreviews: ["Some content"],
        }),
      );
      const candidatesResult = { currentFieldLabel: "Name", candidates, suggestedFieldProfileId: null };
      const sendMessage = vi.fn().mockImplementation((request: { type: string }) => {
        if (request.type === "FIND_SIMILAR_FIELD_CANDIDATES") return Promise.resolve({ ok: true, value: candidatesResult });
        return Promise.resolve({ ok: true, value: state });
      });
      vi.stubGlobal("chrome", {
        runtime: { sendMessage, onMessage: { addListener: vi.fn(), removeListener: vi.fn() } },
      });
      const root = draw({ fieldObservedTitle: "Name" });

      await vi.waitFor(() => expect(root.textContent).toContain("following focus"));
      clickButton(root, "Share with…");
      await vi.waitFor(() => expect(root.textContent).toContain("No other reliably identified Fields on this page"));

      const searchInput = root.querySelector<HTMLInputElement>('input[aria-label="Search Fields"]')!;
      searchInput.value = "e";
      searchInput.dispatchEvent(new InputEvent("input", { bubbles: true }));
      await vi.waitFor(() => expect(root.querySelectorAll(".find-similar-row").length).toBe(6));

      const rows = [...root.querySelectorAll(".find-similar-row")];
      expect(rows[0]?.textContent).toContain("Family name");
      expect(root.textContent).toContain("Unrelated E");
    });

    it("clamps a long Field label to a 'more' toggle that reveals the full label on click", async () => {
      const state = { ...emptyState, pageProfiles: [{ id: "page-1", siteId: "example.test" }] };
      const longLabel = "A very long observed Field title that goes on for quite a while past the clamp threshold";
      const candidatesResult = {
        currentFieldLabel: "This field",
        candidates: [
          {
            fieldProfileId: "field-2",
            siteId: "example.test",
            pageProfileId: "page-1",
            siteLabel: "example.test",
            pageLabel: "Profile page",
            fieldLabel: longLabel,
            crossSite: false,
            highConfidence: false,
            decided: false,
            alreadyLinked: false,
            templateCount: 0,
            templatePreviews: [],
          },
        ],
        suggestedFieldProfileId: null,
      };
      const sendMessage = vi.fn().mockImplementation((request: { type: string }) => {
        if (request.type === "FIND_SIMILAR_FIELD_CANDIDATES") return Promise.resolve({ ok: true, value: candidatesResult });
        return Promise.resolve({ ok: true, value: state });
      });
      vi.stubGlobal("chrome", {
        runtime: { sendMessage, onMessage: { addListener: vi.fn(), removeListener: vi.fn() } },
      });
      const root = draw();

      await vi.waitFor(() => expect(root.textContent).toContain("following focus"));
      clickButton(root, "Share with…");
      await vi.waitFor(() => expect(root.querySelector('input[aria-label="Search Fields"]')).not.toBeNull());
      const searchInput = root.querySelector<HTMLInputElement>('input[aria-label="Search Fields"]')!;
      searchInput.value = "long";
      searchInput.dispatchEvent(new InputEvent("input", { bubbles: true }));
      await vi.waitFor(() => expect(root.querySelector(".find-similar-label-more")).not.toBeNull());
      expect(root.querySelector(".find-similar-label-clamped")?.textContent).toBe(longLabel);

      clickButton(root, "more…");
      await vi.waitFor(() => expect(root.querySelector(".find-similar-label-more")).toBeNull());
      expect(root.querySelector(".find-similar-row")?.textContent).toContain(longLabel);
    });

    it("puts cross-Site Search context beside the Field with a bold Site and no duplicated metadata, then marks the request accordingly (Task 024 Slice 3)", async () => {
      const state = { ...emptyState, pageProfiles: [{ id: "page-1", siteId: "example.test" }] };
      const candidatesResult = {
        currentFieldLabel: "This field",
        candidates: [
          {
            fieldProfileId: "field-2",
            siteId: "other.test",
            pageProfileId: "page-2",
            siteLabel: "other.test",
            pageLabel: "Billing page",
            fieldLabel: "Cross-site email",
            crossSite: true,
            highConfidence: true,
            decided: false,
            alreadyLinked: false,
            templateCount: 1,
            templatePreviews: ["Reply"],
            existingSetId: null,
            existingSetMemberCount: 0,
          },
        ],
        suggestedFieldProfileId: null,
      };
      const setResult = {
        set: { id: "set-1", siteId: "example.test", name: "Shared Template Set 1", memberFieldProfileIds: ["field-1", "field-2"] },
        sharedBindings: [],
      };
      const sendMessage = vi.fn().mockImplementation((request: { type: string }) => {
        if (request.type === "FIND_SIMILAR_FIELD_CANDIDATES") return Promise.resolve({ ok: true, value: candidatesResult });
        if (request.type === "CREATE_SHARED_TEMPLATE_SET") return Promise.resolve({ ok: true, value: setResult });
        return Promise.resolve({ ok: true, value: state });
      });
      vi.stubGlobal("chrome", {
        runtime: { sendMessage, onMessage: { addListener: vi.fn(), removeListener: vi.fn() } },
      });
      const root = draw();

      await vi.waitFor(() => expect(root.textContent).toContain("following focus"));
      clickButton(root, "Share with…");
      await vi.waitFor(() => expect(root.querySelector('input[aria-label="Search Fields"]')).not.toBeNull());
      const searchInput = root.querySelector<HTMLInputElement>('input[aria-label="Search Fields"]')!;
      searchInput.value = "Cross-site";
      searchInput.dispatchEvent(new InputEvent("input", { bubbles: true }));
      await vi.waitFor(() => expect(root.textContent).toContain("Cross-site email"));
      const candidateRow = root.querySelector(".find-similar-row");
      expect(candidateRow?.querySelector(".shared-field-candidate-page")).toBeNull();
      const context = candidateRow?.querySelector(".find-similar-search-context");
      expect(context?.textContent).toBe("other.test · Billing page · may have a different purpose.");
      expect(context?.querySelector("strong")?.textContent).toBe("other.test");
      expect(root.textContent).not.toContain("Different Site");
      expect([...root.querySelectorAll("button")].some((button) => button.textContent === "Share")).toBe(true);

      // Neither Field is shared yet, so linking a cross-Site pair still
      // needs no scope confirmation - only growing/merging an existing Set
      // does - but the request must mark allowCrossSite.
      clickButton(root, "Share");
      await vi.waitFor(() =>
        expect(sendMessage).toHaveBeenCalledWith(
          expect.objectContaining({ type: "CREATE_SHARED_TEMPLATE_SET", allowCrossSite: true }),
        ),
      );
    });

    it("requires a scope confirmation before merging two already-distinct Shared Template Sets, then merges on Confirm", async () => {
      const state = {
        ...emptyState,
        pageProfiles: [{ id: "page-1", siteId: "example.test" }, { id: "page-2", siteId: "other.test", userAlias: "Billing page" }],
        fieldProfiles: [
          { id: "field-1", pageProfileId: "page-1" },
          { id: "field-2", pageProfileId: "page-1" },
          { id: "field-3", pageProfileId: "page-2", observedTitle: "Other Set field" },
        ],
        sharedTemplateSets: [
          { id: "my-set", siteId: "example.test", name: "Mine", memberFieldProfileIds: ["field-1", "field-2"] },
          { id: "their-set", siteId: "other.test", name: "Theirs", memberFieldProfileIds: ["field-3"] },
        ],
      };
      const candidatesResult = {
        currentFieldLabel: "This field",
        candidates: [
          {
            fieldProfileId: "field-3",
            siteId: "other.test",
            pageProfileId: "page-2",
            siteLabel: "other.test",
            pageLabel: "Billing page",
            fieldLabel: "Other Set field",
            crossSite: true,
            highConfidence: true,
            decided: false,
            alreadyLinked: false,
            templateCount: 1,
            templatePreviews: ["Reply"],
            existingSetId: "their-set",
            existingSetMemberCount: 1,
          },
        ],
        suggestedFieldProfileId: null,
      };
      const mergeResult = {
        set: { id: "my-set", siteId: "example.test", name: "Mine", memberFieldProfileIds: ["field-1", "field-2", "field-3"] },
        removedSet: { id: "their-set", siteId: "other.test", name: "Theirs", memberFieldProfileIds: ["field-3"] },
        removedSetBindings: [],
        previousKeepSet: state.sharedTemplateSets[0],
        previousKeepSetBindings: [],
      };
      const sendMessage = vi.fn().mockImplementation((request: { type: string }) => {
        if (request.type === "FIND_SIMILAR_FIELD_CANDIDATES") return Promise.resolve({ ok: true, value: candidatesResult });
        if (request.type === "MERGE_SHARED_TEMPLATE_SETS") return Promise.resolve({ ok: true, value: mergeResult });
        return Promise.resolve({ ok: true, value: state });
      });
      vi.stubGlobal("chrome", {
        runtime: { sendMessage, onMessage: { addListener: vi.fn(), removeListener: vi.fn() } },
      });
      const onLastActionChange = vi.fn();
      const root = draw({ fieldProfileId: "field-1", onLastActionChange });

      await vi.waitFor(() => expect(root.textContent).toContain("Shared"));
      clickButton(root, "Share with…");
      await vi.waitFor(() => expect(root.querySelector('input[aria-label="Search Fields"]')).not.toBeNull());
      const searchInput = root.querySelector<HTMLInputElement>('input[aria-label="Search Fields"]')!;
      searchInput.value = "Other Set";
      searchInput.dispatchEvent(new InputEvent("input", { bubbles: true }));
      await vi.waitFor(() => expect(root.textContent).toContain("Other Set field"));

      clickButton(root, "Share");
      // A scope confirmation appears instead of immediately merging, and it
      // states the outcome rather than only a count (Addendum C.5).
      await vi.waitFor(() => expect(root.textContent).toContain("becomes available to all of them"));
      expect(sendMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: "MERGE_SHARED_TEMPLATE_SETS" }));

      clickButton(root, "Share");
      await vi.waitFor(() =>
        expect(sendMessage).toHaveBeenCalledWith({ type: "MERGE_SHARED_TEMPLATE_SETS", keepSetId: "my-set", removeSetId: "their-set" }),
      );
      await vi.waitFor(() =>
        expect(onLastActionChange).toHaveBeenCalledWith(
          expect.objectContaining({ type: "merge-shared-sets", removedSet: mergeResult.removedSet }),
        ),
      );
    });
  });
});

interface RenderPickerProps {
  targetField: HTMLInputElement;
  fieldProfileId: string;
  onInsert(template: unknown): void;
}

function renderPicker(
  root: Element,
  overrides: Partial<RenderPickerProps>,
): { rerender(next: Partial<RenderPickerProps>): void } {
  const base: RenderPickerProps = {
    targetField: document.createElement("input"),
    fieldProfileId: "field-1",
    onInsert: () => undefined,
  };
  const draw = (props: RenderPickerProps) =>
    render(
      <InlinePicker
        targetField={props.targetField}
        pageProfileId="page-1"
        fieldProfileId={props.fieldProfileId}
        pageIdentityKey="page-key"
        fieldIdentityKey="field-key"
        onInsert={props.onInsert}
        onClose={() => undefined}
        pinned={true}
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
  draw({ ...base, ...overrides });
  return {
    rerender: (next) => draw({ ...base, ...overrides, ...next }),
  };
}

function clickButton(root: Element, label: string): void {
  const button = [...root.querySelectorAll("button")].find(
    (candidate) =>
      candidate.textContent?.trim() === label || candidate.getAttribute("aria-label") === label,
  );
  if (!(button instanceof HTMLButtonElement)) throw new Error(`Button not found: ${label}`);
  button.click();
}
