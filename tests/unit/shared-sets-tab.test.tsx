// @vitest-environment happy-dom

import { render } from "preact";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { FillNestState } from "../../src/storage/fillnest-repository";
import { SidePanel } from "../../src/ui/side-panel/SidePanel";

// Task 040 slice 3: renaming, Leave sharing and End sharing, moved from the
// Sites page to the Templates page's Shared Sets tab with their existing
// confirmations, results and Undo (Tasks 021, 025).

function sharedBusinessState(): FillNestState {
  return {
    schemaVersion: 13,
    compatibilityPairDecisions: [],
    sites: [{ id: "example.test" }],
    templates: [
      { id: "t1", content: "Orphan template", siteAffinities: ["orphan.test"], createdAt: "x", updatedAt: "x", totalUsageCount: 0, revision: 0 },
      { id: "t2", content: "Example mapped template", siteAffinities: ["example.test"], createdAt: "x", updatedAt: "x", totalUsageCount: 0, revision: 0 },
    ],
    pageProfiles: [
      { id: "page-1", siteId: "example.test", identityKey: "/profile", userAlias: "Profile page" },
      { id: "page-2", siteId: "example.test", identityKey: "/billing" },
    ],
    fieldProfiles: [
      { id: "field-1", pageProfileId: "page-1" },
      { id: "field-2", pageProfileId: "page-2", observedTitle: "Billing email" },
    ],
    bindings: [],
    logicalPageSiteKeys: [],
    logicalPageRules: [],
    logicalPageProvenance: [],
    logicalPageObservations: [],
    sharedTemplateSets: [
      { id: "set-1", siteId: "example.test", name: "Contact fields", memberFieldProfileIds: ["field-1", "field-2"] },
    ],
    sharedTemplateBindings: [
      { id: "shared-binding-1", setId: "set-1", templateId: "t2", usageCount: 0, revision: 0, order: 0 },
    ],
    sharedTemplateFieldStates: [],
    pickerPosition: null,
    pageStatusPosition: null,
  };
}

function stubChrome(business: FillNestState, override?: (request: { type: string }) => unknown) {
  const sendMessage = vi.fn(async (request: { type: string }) => {
    const overridden = override?.(request);
    if (overridden !== undefined) return overridden;
    if (request.type === "READ_STATE") return { ok: true, value: business };
    if (request.type === "GET_ACTIVATION_MANAGEMENT") return { ok: true, value: { global: "active", origins: [] } };
    return { ok: true, value: {} };
  });
  vi.stubGlobal("chrome", {
    runtime: { sendMessage, onMessage: { addListener: vi.fn(), removeListener: vi.fn() } },
    tabs: { query: vi.fn(async () => []) },
  });
  return sendMessage;
}

async function openSharedSets(options: { business?: FillNestState; override?: (request: { type: string }) => unknown } = {}) {
  const sendMessage = stubChrome(options.business ?? sharedBusinessState(), options.override);
  const root = document.createElement("div");
  document.body.append(root);
  render(<SidePanel />, root);
  await vi.waitFor(() => expect(root.textContent).toContain("Enable FillNest"));
  click(root, "Templates");
  await vi.waitFor(() => expect(buttonNamed(root, "Shared Sets")).toBeDefined());
  click(root, "Shared Sets");
  await vi.waitFor(() => expect(root.textContent).toContain("Contact fields"));
  return { root, sendMessage };
}

async function expandContactFields(root: Element): Promise<void> {
  clickByLabel(root, 'Expand "Contact fields"');
  await vi.waitFor(() => expect(root.textContent).toContain("Billing email"));
}

const removeResult = (ended: boolean, newlyGlobalTemplates: unknown[] = []) => ({
  ok: true,
  value: {
    set: ended ? null : { id: "set-1", siteId: "example.test", name: "Contact fields", memberFieldProfileIds: ["field-1"] },
    ended,
    newlyGlobalTemplates,
    snapshotBindings: [],
    dormantBindings: [],
    removedOwnedSlots: [],
    removedFieldStates: [],
  },
});

describe("Shared Sets tab actions", () => {
  afterEach(async () => {
    await new Promise((resolve) => setTimeout(resolve, 40));
    document.body.replaceChildren();
    vi.unstubAllGlobals();
  });

  it("renames a Set from its name, which says it renames a Set", async () => {
    const { root, sendMessage } = await openSharedSets();

    clickByLabel(root, "Rename Set Contact fields");
    await vi.waitFor(() => expect(root.querySelector('input[aria-label="Name for Contact fields"]')).not.toBeNull());
    const input = root.querySelector<HTMLInputElement>('input[aria-label="Name for Contact fields"]')!;
    expect(input.value).toBe("Contact fields");
    input.value = "Household bills";
    input.dispatchEvent(new InputEvent("input", { bubbles: true }));
    click(root, "Save");

    await vi.waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith({ type: "RENAME_SHARED_TEMPLATE_SET", setId: "set-1", name: "Household bills" }),
    );
  });

  it("renames a member Field as its Field User Alias", async () => {
    const { root, sendMessage } = await openSharedSets();
    await expandContactFields(root);

    clickByLabel(root, "Rename Billing email");
    await vi.waitFor(() => expect(root.querySelector('input[aria-label="Name for Billing email"]')).not.toBeNull());
    const input = root.querySelector<HTMLInputElement>('input[aria-label="Name for Billing email"]')!;
    input.value = "Invoice email";
    input.dispatchEvent(new InputEvent("input", { bubbles: true }));
    click(root, "Save");

    await vi.waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith({ type: "SET_FIELD_ALIAS", fieldProfileId: "field-2", alias: "Invoice email" }),
    );
  });

  it("Leave sharing confirms, sends, reports the result and offers Undo", async () => {
    const { root, sendMessage } = await openSharedSets({
      override: (request) => (request.type === "REMOVE_SHARED_TEMPLATE_SET_MEMBER" ? removeResult(false) : undefined),
    });
    await expandContactFields(root);

    clickByLabel(root, "Leave sharing for Billing email");
    await vi.waitFor(() => expect(root.textContent).toContain("Leave sharing for Billing email?"));
    clickInSheet(root, "Leave sharing");

    await vi.waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith({ type: "REMOVE_SHARED_TEMPLATE_SET_MEMBER", setId: "set-1", fieldProfileId: "field-2" }),
    );
    await vi.waitFor(() => expect(root.textContent).toContain('left "Contact fields"'));
    expect(root.querySelector(".clean-up-sheet")).toBeNull();

    click(root, "Undo");
    await vi.waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({
        type: "UNDO_REMOVE_SHARED_TEMPLATE_SET_MEMBER",
        fieldProfileId: "field-2",
        set: expect.objectContaining({ id: "set-1" }),
        endedSharedBindings: [expect.objectContaining({ id: "shared-binding-1" })],
      })),
    );
  });

  it("says when leaving ended the Set", async () => {
    const { root } = await openSharedSets({
      override: (request) => (request.type === "REMOVE_SHARED_TEMPLATE_SET_MEMBER" ? removeResult(true) : undefined),
    });
    await expandContactFields(root);

    clickByLabel(root, "Leave sharing for Billing email");
    await vi.waitFor(() => expect(root.querySelector(".clean-up-sheet")).not.toBeNull());
    clickInSheet(root, "Leave sharing");

    await vi.waitFor(() => expect(root.textContent).toContain("ended since it had no other members"));
  });

  it("offers to delete Templates that leaving made Global, instead of Undo", async () => {
    const orphan = sharedBusinessState().templates[1]!;
    const { root, sendMessage } = await openSharedSets({
      override: (request) => {
        if (request.type === "REMOVE_SHARED_TEMPLATE_SET_MEMBER") return removeResult(false, [orphan]);
        if (request.type === "DELETE_NEWLY_GLOBAL_TEMPLATES") return { ok: true, value: { deleted: [] } };
        return undefined;
      },
    });
    await expandContactFields(root);
    clickByLabel(root, "Leave sharing for Billing email");
    await vi.waitFor(() => expect(root.querySelector(".clean-up-sheet")).not.toBeNull());
    clickInSheet(root, "Leave sharing");
    await vi.waitFor(() => expect(buttonNamed(root, "Delete")).toBeDefined());

    click(root, "Delete");

    await vi.waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith({
        type: "DELETE_NEWLY_GLOBAL_TEMPLATES",
        templates: [{ id: "t2", expectedRevision: 0 }],
      }),
    );
  });

  it("End sharing asks through a danger-styled confirmation, then offers Undo", async () => {
    const { root, sendMessage } = await openSharedSets({
      override: (request) =>
        request.type === "END_SHARED_TEMPLATE_SET"
          ? {
              ok: true,
              value: {
                memberFieldProfileIds: ["field-1", "field-2"],
                newlyGlobalTemplates: [],
                endedFieldStates: [],
                convertedBindings: [],
                dormantBindings: [],
              },
            }
          : undefined,
    });
    await expandContactFields(root);

    click(root, "End sharing");
    await vi.waitFor(() => expect(root.textContent).toContain('End "Contact fields"?'));
    expect(root.querySelector(".clean-up-sheet button.danger")?.textContent?.trim()).toBe("End sharing");
    expect(root.querySelector(".clean-up-sheet")?.textContent).toContain("stay in your library");
    clickInSheet(root, "End sharing");

    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledWith({ type: "END_SHARED_TEMPLATE_SET", setId: "set-1" }));
    await vi.waitFor(() => expect(root.textContent).toContain('Ended "Contact fields"'));
    expect(root.textContent).toContain("kept every Template they offered");

    click(root, "Undo");
    await vi.waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({
        type: "UNDO_END_SHARED_TEMPLATE_SET",
        set: expect.objectContaining({ id: "set-1" }),
        sharedBindings: [expect.objectContaining({ id: "shared-binding-1" })],
      })),
    );
  });

  // Owner QA, 2026-09-11: a result the page could not read left the dialog
  // open over a Set that had already ended.
  it("closes End sharing once the Set has ended, even when the result cannot be read", async () => {
    const { root, sendMessage } = await openSharedSets({
      override: (request) =>
        request.type === "END_SHARED_TEMPLATE_SET" ? { ok: true, value: { memberFieldProfileIds: ["field-1", "field-2"] } } : undefined,
    });
    await expandContactFields(root);
    click(root, "End sharing");
    await vi.waitFor(() => expect(root.querySelector(".clean-up-sheet")).not.toBeNull());

    clickInSheet(root, "End sharing");

    await vi.waitFor(() => expect(root.querySelector(".clean-up-sheet")).toBeNull());
    expect(root.textContent).toContain('Ended "Contact fields"');
    expect(sendMessage.mock.calls.filter(([request]) => request.type === "END_SHARED_TEMPLATE_SET")).toHaveLength(1);
  });

  it("offers no way to add a Field to a Set", async () => {
    const { root } = await openSharedSets();
    await expandContactFields(root);
    expect(root.textContent).not.toContain("Add or move a Field here");
    expect(buttonNamed(root, "Add")).toBeUndefined();
  });

  it("the Sites page no longer lists Shared Template Sets", async () => {
    const { root } = await openSharedSets();
    click(root, "Sites");
    await vi.waitFor(() => expect(root.textContent).toContain("Select all"));
    expect(root.textContent).not.toContain("Contact fields");
    expect(root.textContent).not.toContain("Shared Template Sets");
  });
});

function buttonNamed(root: Element, name: string): HTMLButtonElement | undefined {
  return [...root.querySelectorAll("button")].find((candidate) => candidate.textContent?.trim() === name || candidate.getAttribute("aria-label") === name);
}

function click(root: Element, name: string): void {
  const found = buttonNamed(root, name);
  if (!found) throw new Error(`Button not found: ${name}`);
  found.click();
}

function clickInSheet(root: Element, name: string): void {
  const sheet = root.querySelector(".clean-up-sheet");
  if (!sheet) throw new Error("Sheet not open");
  const found = [...sheet.querySelectorAll("button")].find((candidate) => candidate.textContent?.trim() === name || candidate.getAttribute("aria-label") === name);
  if (!found) throw new Error(`Sheet button not found: ${name}`);
  found.click();
}

function clickByLabel(root: Element, label: string): void {
  const found = [...root.querySelectorAll("[aria-label]")].find((candidate) => candidate.getAttribute("aria-label") === label);
  if (!(found instanceof HTMLElement)) throw new Error(`Element not found: ${label}`);
  found.click();
}
