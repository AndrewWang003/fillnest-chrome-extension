import { en } from "../../src/i18n/messages";
// @vitest-environment happy-dom

import { render } from "preact";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SidePanel } from "../../src/ui/side-panel/SidePanel";
import { performUndo } from "../../src/ui/side-panel/TemplatesPage";
import type { FillNestState } from "../../src/storage/fillnest-repository";

function baseState(): FillNestState {
  return {
    schemaVersion: 13 as const,
    compatibilityPairDecisions: [],
    sites: [{ id: "example.test" }],
    templates: [
      {
        id: "bound-1",
        content: "Bound reply\nBody",
        siteAffinities: ["example.test"],
        createdAt: "2026-08-16T00:00:00.000Z",
        updatedAt: "2026-08-16T00:00:00.000Z",
        totalUsageCount: 4,
        revision: 0,
      },
      {
        id: "global-1",
        content: "Global note",
        siteAffinities: [],
        createdAt: "2026-08-16T00:00:00.000Z",
        updatedAt: "2026-08-16T00:00:00.000Z",
        totalUsageCount: 1,
        revision: 0,
      },
    ],
    pageProfiles: [
      { id: "page-1", siteId: "example.test", identityKey: "/customers/:record/edit" },
    ],
    fieldProfiles: [{ id: "field-1", pageProfileId: "page-1", identityKey: '{"semanticKind":"email"}' }],
    bindings: [
      {
        id: "binding-1",
        templateId: "bound-1",
        pageProfileId: "page-1",
        fieldProfileId: "field-1",
        createdAt: "2026-08-16T00:00:00.000Z",
        usageCount: 4,
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

function stubChrome(
  state: ReturnType<typeof baseState>,
  extra: Record<string, unknown> = {},
  // Matches baseState()'s seeded page-1 identityKey ("/customers/:record/edit")
  // exactly, via the same page-identity derivation the real content script
  // uses (a purely numeric segment is what actually normalizes to
  // ":record"), so tests relying on the current-page "This tab" scope can
  // reach page-1's own Fields without manually switching scope.
  activeTabUrl: string | null = "https://example.test/customers/12345/edit",
) {
  let current = state;
  const sendMessage = vi.fn(async (request: { type: string; [key: string]: unknown }) => {
    if (request.type === "READ_STATE") return { ok: true, value: current };
    if (request.type === "GET_ACTIVATION_MANAGEMENT") {
      return { ok: true, value: { global: "active", origins: [] } };
    }
    if (request.type === "SET_PAGE_ALIAS") {
      const alias = (request.alias as string).trim() || undefined;
      current = {
        ...current,
        pageProfiles: current.pageProfiles.map((page) =>
          page.id === request.pageProfileId ? { ...page, userAlias: alias } : page,
        ),
      };
      return { ok: true, value: current.pageProfiles[0] };
    }
    if (request.type === "SET_FIELD_ALIAS") {
      const alias = (request.alias as string).trim() || undefined;
      current = {
        ...current,
        fieldProfiles: current.fieldProfiles.map((field) =>
          field.id === request.fieldProfileId ? { ...field, userAlias: alias } : field,
        ),
      };
      return { ok: true, value: current.fieldProfiles[0] };
    }
    if (request.type === "UNBIND_TEMPLATE") {
      current = {
        ...current,
        bindings: current.bindings.filter(
          (binding) =>
            !(binding.templateId === request.templateId && binding.fieldProfileId === request.fieldProfileId),
        ),
      };
      return { ok: true, value: true };
    }
    if (request.type === "UNDO_UNBIND") {
      const binding = request.binding as (typeof current.bindings)[number];
      current = { ...current, bindings: [...current.bindings, binding] };
      return { ok: true, value: true };
    }
    if (request.type === "REORDER_FIELD_BINDINGS") {
      const orderedBindingIds = request.orderedBindingIds as string[];
      const orderById = new Map(orderedBindingIds.map((id, index) => [id, index] as const));
      current = {
        ...current,
        bindings: current.bindings.map((binding) =>
          orderById.has(binding.id) ? { ...binding, order: orderById.get(binding.id)! } : binding,
        ),
      };
      return { ok: true, value: [] };
    }
    if (request.type === "UPDATE_TEMPLATE") {
      const templateId = request.templateId as string;
      const content = request.content as string;
      const updated = current.templates.map((template) =>
        template.id === templateId
          ? { ...template, content, revision: (template.revision ?? 0) + 1 }
          : template,
      );
      current = { ...current, templates: updated };
      return { ok: true, value: updated.find((template) => template.id === templateId) };
    }
    if (request.type === "DELETE_TEMPLATE") {
      const templateId = request.templateId as string;
      current = {
        ...current,
        templates: current.templates.filter((template) => template.id !== templateId),
        bindings: current.bindings.filter((binding) => binding.templateId !== templateId),
      };
      return { ok: true, value: true };
    }
    if (request.type === "RESTORE_TEMPLATE") {
      const template = request.template as (typeof current.templates)[number];
      const bindings = request.bindings as typeof current.bindings;
      current = { ...current, templates: [...current.templates, template], bindings: [...current.bindings, ...bindings] };
      return { ok: true, value: template };
    }
    if (request.type === "DELETE_TEMPLATES") {
      const templateIds = request.templateIds as string[];
      const idSet = new Set(templateIds.filter((id) => current.templates.some((template) => template.id === id)));
      current = {
        ...current,
        templates: current.templates.filter((template) => !idSet.has(template.id)),
        bindings: current.bindings.filter((binding) => !idSet.has(binding.templateId)),
      };
      return { ok: true, value: { deletedTemplateIds: [...idSet] } };
    }
    if (request.type === "RESTORE_TEMPLATES") {
      const entries = request.templates as Array<{
        template: (typeof current.templates)[number];
        bindings: typeof current.bindings;
      }>;
      const restored: (typeof current.templates)[number][] = [];
      const failed: Array<{ templateId: string; reason: string }> = [];
      for (const entry of entries) {
        if (
          current.templates.some((template) => template.id === entry.template.id) ||
          restored.some((template) => template.id === entry.template.id)
        ) {
          failed.push({ templateId: entry.template.id, reason: "A Template with this ID already exists." });
          continue;
        }
        restored.push(entry.template);
        current = {
          ...current,
          templates: [...current.templates, entry.template],
          bindings: [...current.bindings, ...entry.bindings],
        };
      }
      return { ok: true, value: { restored, failed } };
    }
    if (request.type === "SAVE_TEMPLATE_COPY_FOR_FIELD") {
      const originalTemplate = current.templates.find((t) => t.id === request.templateId)!;
      const newTemplate = { ...originalTemplate, id: `copy-of-${String(request.templateId)}`, content: request.content as string };
      const binding = current.bindings.find(
        (b) => b.templateId === request.templateId && b.fieldProfileId === request.fieldProfileId,
      )!;
      const newBinding = { ...binding, templateId: newTemplate.id };
      current = {
        ...current,
        templates: [...current.templates, newTemplate],
        bindings: current.bindings.map((b) => (b.id === binding.id ? newBinding : b)),
      };
      return { ok: true, value: { template: newTemplate, binding: newBinding } };
    }
    if (request.type === "UNDO_SAVE_COPY_FOR_FIELD") {
      const originalBinding = request.originalBinding as (typeof current.bindings)[number];
      current = {
        ...current,
        templates: current.templates.filter((t) => t.id !== request.copyTemplateId),
        bindings: current.bindings.map((b) => (b.id === originalBinding.id ? originalBinding : b)),
      };
      return { ok: true, value: true };
    }
    if (request.type === "SAVE_TEMPLATE_COPY_FOR_SHARED_SET") {
      const originalTemplate = current.templates.find((t) => t.id === request.templateId)!;
      const newTemplate = { ...originalTemplate, id: `shared-copy-of-${String(request.templateId)}`, content: request.content as string };
      const slot = current.sharedTemplateBindings.find(
        (s) => s.setId === request.setId && s.templateId === request.templateId,
      )!;
      const newSlot = { ...slot, templateId: newTemplate.id };
      current = {
        ...current,
        templates: [...current.templates, newTemplate],
        sharedTemplateBindings: current.sharedTemplateBindings.map((s) => (s.id === slot.id ? newSlot : s)),
      };
      return { ok: true, value: { template: newTemplate, sharedBinding: newSlot } };
    }
    if (request.type === "UNDO_SAVE_TEMPLATE_COPY_FOR_SHARED_SET") {
      const originalSharedBinding = request.originalSharedBinding as (typeof current.sharedTemplateBindings)[number];
      current = {
        ...current,
        templates: current.templates.filter((t) => t.id !== request.copyTemplateId),
        sharedTemplateBindings: current.sharedTemplateBindings.map((s) =>
          s.id === originalSharedBinding.id ? originalSharedBinding : s,
        ),
      };
      return { ok: true, value: true };
    }
    if (request.type === "SAVE_TEMPLATE_OVERRIDE_FOR_FIELD") {
      const setId = request.setId as string;
      const slotId = request.slotId as string;
      const fieldProfileId = request.fieldProfileId as string;
      const newTemplate = {
        id: `override-${fieldProfileId}`,
        content: request.content as string,
        siteAffinities: ["example.test"],
        createdAt: "x",
        updatedAt: "x",
        totalUsageCount: 0,
        revision: 0,
      };
      const stateEntry = {
        id: `state-${fieldProfileId}`,
        setId,
        slotId,
        fieldProfileId,
        mode: "override" as const,
        templateId: newTemplate.id,
        usageCount: 0,
        revision: 0,
      };
      current = {
        ...current,
        templates: [...current.templates, newTemplate],
        sharedTemplateFieldStates: [
          ...current.sharedTemplateFieldStates.filter(
            (s) => !(s.setId === setId && s.slotId === slotId && s.fieldProfileId === fieldProfileId),
          ),
          stateEntry,
        ],
      };
      return { ok: true, value: { template: newTemplate } };
    }
    if (request.type === "UNDO_SAVE_TEMPLATE_OVERRIDE_FOR_FIELD") {
      const previousState = request.previousState as (typeof current.sharedTemplateFieldStates)[number] | null;
      current = {
        ...current,
        templates: current.templates.filter((t) => t.id !== request.copyTemplateId),
        sharedTemplateFieldStates: previousState
          ? current.sharedTemplateFieldStates.map((s) => (s.templateId === request.copyTemplateId ? previousState : s))
          : current.sharedTemplateFieldStates.filter((s) => s.templateId !== request.copyTemplateId),
      };
      return { ok: true, value: true };
    }
    if (request.type === "EXCLUDE_SHARED_TEMPLATE_FOR_FIELD") {
      const setId = request.setId as string;
      const slotId = request.slotId as string;
      const fieldProfileId = request.fieldProfileId as string;
      const stateEntry = { id: `exclude-${fieldProfileId}`, setId, slotId, fieldProfileId, mode: "exclude" as const };
      current = {
        ...current,
        sharedTemplateFieldStates: [
          ...current.sharedTemplateFieldStates.filter(
            (s) => !(s.setId === setId && s.slotId === slotId && s.fieldProfileId === fieldProfileId),
          ),
          stateEntry,
        ],
      };
      return { ok: true, value: true };
    }
    if (request.type === "UNDO_EXCLUDE_SHARED_TEMPLATE_FOR_FIELD") {
      const setId = request.setId as string;
      const slotId = request.slotId as string;
      const fieldProfileId = request.fieldProfileId as string;
      const previousState = request.previousState as (typeof current.sharedTemplateFieldStates)[number] | null;
      current = {
        ...current,
        sharedTemplateFieldStates: previousState
          ? current.sharedTemplateFieldStates.map((s) =>
              s.setId === setId && s.slotId === slotId && s.fieldProfileId === fieldProfileId ? previousState : s,
            )
          : current.sharedTemplateFieldStates.filter(
              (s) => !(s.setId === setId && s.slotId === slotId && s.fieldProfileId === fieldProfileId),
            ),
      };
      return { ok: true, value: true };
    }
    if (request.type === "PROMOTE_FIELD_ONLY_SLOT") {
      const setId = request.setId as string;
      const slotId = request.slotId as string;
      const slot = current.sharedTemplateBindings.find((s) => s.id === slotId && s.setId === setId)!;
      const previousOwnerFieldProfileId = slot.ownerFieldProfileId as string;
      const promoted = { ...slot, ownerFieldProfileId: undefined };
      current = {
        ...current,
        sharedTemplateBindings: current.sharedTemplateBindings.map((s) => (s.id === slotId ? promoted : s)),
      };
      return { ok: true, value: { sharedBinding: promoted, previousOwnerFieldProfileId } };
    }
    if (request.type === "UNDO_PROMOTE_FIELD_ONLY_SLOT") {
      const setId = request.setId as string;
      const slotId = request.slotId as string;
      const ownerFieldProfileId = request.ownerFieldProfileId as string;
      current = {
        ...current,
        sharedTemplateBindings: current.sharedTemplateBindings.map((s) =>
          s.id === slotId && s.setId === setId ? { ...s, ownerFieldProfileId } : s,
        ),
      };
      return { ok: true, value: true };
    }
    if (typeof extra[request.type] === "function") {
      return (extra[request.type] as (request: unknown) => unknown)(request);
    }
    return { ok: true, value: {} };
  });
  const tabsQuery = vi.fn(async () => (activeTabUrl ? [{ id: 42, url: activeTabUrl }] : []));
  const tabsSendMessage = vi.fn();
  vi.stubGlobal("chrome", {
    runtime: { sendMessage, onMessage: { addListener: vi.fn(), removeListener: vi.fn() } },
    tabs: { query: tabsQuery, sendMessage: tabsSendMessage },
  });
  return sendMessage;
}

function click(root: Element, name: string): void {
  const found = [...root.querySelectorAll("button")].find(
    (candidate) => candidate.textContent?.trim() === name || candidate.getAttribute("aria-label") === name,
  );
  if (!(found instanceof HTMLButtonElement)) throw new Error(`Button not found: ${name}`);
  found.click();
}

function clickByLabel(root: Element, label: string): void {
  const found = [...root.querySelectorAll("[aria-label]")].find(
    (candidate) => candidate.getAttribute("aria-label") === label,
  );
  if (!(found instanceof HTMLElement)) throw new Error(`Element not found: ${label}`);
  found.click();
}

function clickInRow(root: Element, rowText: string, buttonName: string): void {
  const rows = [...root.querySelectorAll(".template-item")];
  const row = rows.find((candidate) => candidate.textContent?.includes(rowText));
  if (!row) throw new Error(`Row not found: ${rowText}`);
  const found = [...row.querySelectorAll("button")].find(
    (candidate) => candidate.textContent?.trim() === buttonName || candidate.getAttribute("aria-label") === buttonName,
  );
  if (!(found instanceof HTMLButtonElement)) throw new Error(`Button not found in row "${rowText}": ${buttonName}`);
  found.click();
}

describe("SidePanel Templates: Fields view (default)", () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.unstubAllGlobals();
  });

  it("opens to This tab by default, scoped to the current tab's Page, with Fields collapsed", async () => {
    stubChrome(baseState());
    const root = document.createElement("div");
    document.body.append(root);
    render(<SidePanel />, root);

    click(root, "Templates");
    await vi.waitFor(() => expect(root.textContent).toContain("Email"));
    const tabTab = [...root.querySelectorAll("button")].find((candidate) => candidate.textContent?.trim() === "This tab");
    expect(tabTab?.getAttribute("aria-current")).toBe("true");
    // Collapsed by default: the bound Template's own content isn't shown yet.
    expect(root.textContent).not.toContain("Bound reply");

    clickByLabel(root, 'Expand "Email"');
    await vi.waitFor(() => expect(root.textContent).toContain("Bound reply"));
  });

  it("highlights the matching page Field while its This tab card is hovered or focused", async () => {
    stubChrome(baseState());
    const root = document.createElement("div");
    document.body.append(root);
    render(<SidePanel />, root);

    click(root, "Templates");
    const card = await vi.waitFor(() => {
      const found = root.querySelector<HTMLElement>(".field-card");
      if (!found) throw new Error("Field card not found");
      return found;
    });
    card.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));

    await vi.waitFor(() =>
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(42, {
        type: "HIGHLIGHT_SIDEPANEL_FIELD",
        fieldIdentityKey: '{"semanticKind":"email"}',
      }),
    );

    card.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }));
    await vi.waitFor(() =>
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(42, {
        type: "HIGHLIGHT_SIDEPANEL_FIELD",
        fieldIdentityKey: null,
      }),
    );

    const expandButton = Array.from(card.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.getAttribute("aria-label") === 'Expand "Email"',
    );
    if (!expandButton) throw new Error("Field card expand button not found");
    expandButton.focus();
    await vi.waitFor(() =>
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(42, {
        type: "HIGHLIGHT_SIDEPANEL_FIELD",
        fieldIdentityKey: '{"semanticKind":"email"}',
      }),
    );
  });

  it("expanding a Field, editing its Template, and removing it all work, with Undo restoring the removal", async () => {
    const sendMessage = stubChrome(baseState());
    const root = document.createElement("div");
    document.body.append(root);
    render(<SidePanel />, root);

    click(root, "Templates");
    await vi.waitFor(() => expect(root.textContent).toContain("Email"));
    clickByLabel(root, 'Expand "Email"');
    await vi.waitFor(() => expect(root.textContent).toContain("Bound reply"));

    clickByLabel(root, "Unbind");
    await vi.waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith({
        type: "UNBIND_TEMPLATE",
        templateId: "bound-1",
        fieldProfileId: "field-1",
      }),
    );
    await vi.waitFor(() => expect(root.textContent).toContain("No Fields with saved Templates on this page yet."));

    const resultRegion = root.querySelector(".panel-result-region");
    await vi.waitFor(() => expect(resultRegion?.textContent).toContain('Removed "Bound reply" from this Field; it is now Global'));
    click(root, "Undo");
    await vi.waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: "UNDO_UNBIND", binding: expect.objectContaining({ id: "binding-1" }) }),
      ),
    );
    await vi.waitFor(() => expect(root.textContent).toContain("Bound reply"));
  });

  it("renames a Field via the alias action and shows the alias afterward", async () => {
    const sendMessage = stubChrome(baseState());
    const root = document.createElement("div");
    document.body.append(root);
    render(<SidePanel />, root);

    click(root, "Templates");
    await vi.waitFor(() => expect(root.textContent).toContain("Email"));

    // Task 023 Addendum B5 (2): the name itself is the rename control now -
    // the separate pencil button, whose glyph had gone missing and whose
    // accessible name was a context-free "Rename", is gone.
    clickByLabel(root, "Rename Email");

    const input = await vi.waitFor(() => {
      const found = root.querySelector<HTMLInputElement>('input[aria-label="Name for Email"]');
      if (!found) throw new Error("Alias input not found");
      return found;
    });
    // Task 023 Addendum B5 (3): the editor opens on the name the row shows.
    expect(input.value).toBe("Email");
    input.value = "Work email";
    input.dispatchEvent(new InputEvent("input", { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

    await vi.waitFor(() => expect(root.textContent).toContain("Work email"));
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "SET_FIELD_ALIAS", fieldProfileId: "field-1", alias: "Work email" }),
    );
  });

  it("cancels an unsaved Field rename before opening Template content edit", async () => {
    stubChrome(baseState());
    const root = document.createElement("div");
    document.body.append(root);
    render(<SidePanel />, root);

    click(root, "Templates");
    await vi.waitFor(() => expect(root.textContent).toContain("Email"));
    clickByLabel(root, "Rename Email");
    await vi.waitFor(() => expect(root.querySelector('input[aria-label="Name for Email"]')).not.toBeNull());

    clickByLabel(root, 'Expand "Email"');
    await vi.waitFor(() => expect(root.textContent).toContain("Bound reply"));
    clickByLabel(root, "Edit");

    await vi.waitFor(() => expect(root.querySelector('textarea[aria-label="Edit Template content"]')).not.toBeNull());
    expect(root.querySelector('input[aria-label="Name for Email"]')).toBeNull();
  });

  it("This tab only shows Fields on the current Page, while By location shows every Site", async () => {
    const multiSiteState = () => {
      const state = baseState();
      return {
        ...state,
        sites: [...state.sites, { id: "other.test" }],
        templates: [
          ...state.templates,
          {
            id: "bound-2",
            content: "Other site reply",
            siteAffinities: ["other.test"],
            createdAt: "2026-08-16T00:00:00.000Z",
            updatedAt: "2026-08-16T00:00:00.000Z",
            totalUsageCount: 1,
            revision: 0,
          },
        ],
        pageProfiles: [...state.pageProfiles, { id: "page-2", siteId: "other.test", identityKey: "/notes" }],
        fieldProfiles: [...state.fieldProfiles, { id: "field-2", pageProfileId: "page-2", identityKey: '{"semanticKind":"name"}' }],
        bindings: [
          ...state.bindings,
          {
            id: "binding-2",
            templateId: "bound-2",
            pageProfileId: "page-2",
            fieldProfileId: "field-2",
            createdAt: "2026-08-16T00:00:00.000Z",
            usageCount: 1,
            revision: 0,
          },
        ],
      };
    };
    // Current tab is on example.test's Page, so "This tab" only reaches
    // field-1, not field-2 on the unrelated other.test Page.
    stubChrome(multiSiteState());
    const root = document.createElement("div");
    document.body.append(root);
    render(<SidePanel />, root);

    click(root, "Templates");
    await vi.waitFor(() => expect(root.textContent).toContain("Email"));
    expect(root.textContent).not.toContain("Name");

    click(root, "By location");
    await vi.waitFor(() => expect(root.textContent).toContain("other.test"));
    expect(root.textContent).toContain("example.test");
  });

  it("Not offered anywhere lists Templates with zero live Bindings and lets them be deleted", async () => {
    const sendMessage = stubChrome(baseState());
    const root = document.createElement("div");
    document.body.append(root);
    render(<SidePanel />, root);

    click(root, "Templates");
    await vi.waitFor(() => expect(root.textContent).toContain("Not offered anywhere"));
    expect(root.textContent).not.toContain("Global note");

    const notOfferedToggle = root.querySelector<HTMLButtonElement>(".not-offered-anywhere-toggle");
    if (!notOfferedToggle) throw new Error("Not offered anywhere toggle not found");
    notOfferedToggle.click();
    await vi.waitFor(() => expect(root.textContent).toContain("Global note"));

    clickInRow(root, "Global note", "Delete");
    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledWith({ type: "DELETE_TEMPLATE", templateId: "global-1" }));
  });

});

describe("SidePanel Templates: This tab - Shared Template Set parity (Task 026)", () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.unstubAllGlobals();
  });

  function sharedBaseState(): FillNestState {
    return {
      schemaVersion: 13 as const,
      compatibilityPairDecisions: [],
      sites: [{ id: "example.test" }],
      templates: [
        {
          id: "shared-1",
          content: "Shared reply\nBody",
          siteAffinities: ["example.test"],
          createdAt: "2026-08-16T00:00:00.000Z",
          updatedAt: "2026-08-16T00:00:00.000Z",
          totalUsageCount: 2,
          revision: 0,
        },
      ],
      pageProfiles: [{ id: "page-1", siteId: "example.test", identityKey: "/customers/:record/edit" }],
      fieldProfiles: [
        { id: "field-a", pageProfileId: "page-1", identityKey: '{"semanticKind":"email"}' },
        { id: "field-b", pageProfileId: "page-1", identityKey: '{"semanticKind":"name"}' },
      ],
      bindings: [],
      logicalPageSiteKeys: [],
      logicalPageRules: [],
      logicalPageProvenance: [],
      logicalPageObservations: [],
      sharedTemplateSets: [
        { id: "set-1", siteId: "example.test", name: "Names", memberFieldProfileIds: ["field-a", "field-b"] },
      ],
      sharedTemplateBindings: [
        { id: "slot-1", setId: "set-1", templateId: "shared-1", usageCount: 2, revision: 0, order: 0 },
      ],
      sharedTemplateFieldStates: [],
      pickerPosition: null,
      pageStatusPosition: null,
    };
  }

  it("shows a shared Field's plainly-inherited Template with both Set-scoped Save actions while editing", async () => {
    stubChrome(sharedBaseState());
    const root = document.createElement("div");
    document.body.append(root);
    render(<SidePanel />, root);

    click(root, "Templates");
    await vi.waitFor(() => expect(root.textContent).toContain("Email"));
    clickByLabel(root, 'Expand "Email"');
    await vi.waitFor(() => expect(root.textContent).toContain("Shared reply"));

    clickByLabel(root, "Edit");
    await vi.waitFor(() => expect(root.querySelector('textarea[aria-label="Edit Template content"]')).not.toBeNull());
    expect(root.textContent).toContain("Save for shared fields");
    expect(root.textContent).toContain("Save for this field");
  });

  it("'Save for this field' creates a per-Field Override, leaving the other member's inherited Template untouched, and Undo restores plain inheritance", async () => {
    const sendMessage = stubChrome(sharedBaseState());
    const root = document.createElement("div");
    document.body.append(root);
    render(<SidePanel />, root);

    click(root, "Templates");
    await vi.waitFor(() => expect(root.textContent).toContain("Email"));
    clickByLabel(root, 'Expand "Email"');
    await vi.waitFor(() => expect(root.textContent).toContain("Shared reply"));
    clickByLabel(root, "Edit");
    const textarea = await vi.waitFor(() => {
      const found = root.querySelector<HTMLTextAreaElement>('textarea[aria-label="Edit Template content"]');
      if (!found) throw new Error("Editor not found");
      return found;
    });
    textarea.value = "A's own version";
    textarea.dispatchEvent(new InputEvent("input", { bubbles: true }));
    await Promise.resolve();
    click(root, "Save for this field");

    await vi.waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "SAVE_TEMPLATE_OVERRIDE_FOR_FIELD",
          setId: "set-1",
          slotId: "slot-1",
          fieldProfileId: "field-a",
          content: "A's own version",
        }),
      ),
    );
    await vi.waitFor(() => expect(root.textContent).toContain("A's own version"));

    clickByLabel(root, 'Expand "Name"');
    await vi.waitFor(() => {
      const nameCard = [...root.querySelectorAll(".field-card")].find((card) => card.textContent?.includes("Name"));
      expect(nameCard?.textContent).toContain("Shared reply");
      expect(nameCard?.textContent).not.toContain("A's own version");
    });

    const resultRegion = root.querySelector(".panel-result-region");
    await vi.waitFor(() => expect(resultRegion?.textContent).toContain("Saved for this Field only"));
    click(root, "Undo");
    await vi.waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: "UNDO_SAVE_TEMPLATE_OVERRIDE_FOR_FIELD" }),
      ),
    );
    await vi.waitFor(() => {
      const emailCard = [...root.querySelectorAll(".field-card")].find((card) => card.textContent?.includes("Email"));
      expect(emailCard?.textContent).toContain("Shared reply");
    });
  });

  it("'Remove from this field' on a plainly-inherited shared Template records an Exclusion, leaving the other member unaffected, and is Undoable", async () => {
    const sendMessage = stubChrome(sharedBaseState());
    const root = document.createElement("div");
    document.body.append(root);
    render(<SidePanel />, root);

    click(root, "Templates");
    await vi.waitFor(() => expect(root.textContent).toContain("Email"));
    clickByLabel(root, 'Expand "Email"');
    await vi.waitFor(() => expect(root.textContent).toContain("Shared reply"));

    clickByLabel(root, "Remove from this field");
    await vi.waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "EXCLUDE_SHARED_TEMPLATE_FOR_FIELD",
          setId: "set-1",
          slotId: "slot-1",
          fieldProfileId: "field-a",
        }),
      ),
    );
    await vi.waitFor(() => {
      const emailCard = [...root.querySelectorAll(".field-card")].find((card) => card.textContent?.includes("Email"));
      expect(emailCard).toBeUndefined();
    });
    clickByLabel(root, 'Expand "Name"');
    await vi.waitFor(() => expect(root.textContent).toContain("Shared reply"));

    const resultRegion = root.querySelector(".panel-result-region");
    await vi.waitFor(() => expect(resultRegion?.textContent).toContain('Removed "Shared reply" from this Field'));
    click(root, "Undo");
    await vi.waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: "UNDO_EXCLUDE_SHARED_TEMPLATE_FOR_FIELD" }),
      ),
    );
    await vi.waitFor(() => {
      const emailCard = [...root.querySelectorAll(".field-card")].find((card) => card.textContent?.includes("Email"));
      expect(emailCard).not.toBeUndefined();
    });
  });

  it("Task 027: a Field-only relationship is invisible to the other member and offers 'Share this version', promoting it for the whole Set", async () => {
    const state = sharedBaseState();
    const fieldOnlyState: FillNestState = {
      ...state,
      templates: [
        ...state.templates,
        {
          id: "private-1",
          content: "A's own private template",
          siteAffinities: ["example.test"],
          createdAt: "2026-08-16T00:00:00.000Z",
          updatedAt: "2026-08-16T00:00:00.000Z",
          totalUsageCount: 0,
          revision: 0,
        },
      ],
      sharedTemplateBindings: [
        ...state.sharedTemplateBindings,
        { id: "slot-private", setId: "set-1", templateId: "private-1", usageCount: 0, revision: 0, order: 1, ownerFieldProfileId: "field-a" },
      ],
    };
    const sendMessage = stubChrome(fieldOnlyState);
    const root = document.createElement("div");
    document.body.append(root);
    render(<SidePanel />, root);

    click(root, "Templates");
    await vi.waitFor(() => expect(root.textContent).toContain("Email"));
    clickByLabel(root, 'Expand "Email"');
    await vi.waitFor(() => expect(root.textContent).toContain("A's own private template"));

    // Invisible to field-b, the other Set member.
    clickByLabel(root, 'Expand "Name"');
    await vi.waitFor(() => {
      const nameCard = [...root.querySelectorAll(".field-card")].find((card) => card.textContent?.includes("Name"));
      expect(nameCard?.textContent).not.toContain("A's own private template");
    });

    // Task 027 Explicit Scope UI: the audience change is stated, with the
    // affected Set and its member count, BEFORE anything is mutated.
    clickByLabel(root, "Share this version");
    await vi.waitFor(() =>
      expect(root.querySelector("[role='dialog']")?.textContent).toContain("with the whole Shared Template Set?"),
    );
    expect(root.querySelector("[role='dialog']")?.textContent).toContain("all 2 fields");
    expect(sendMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "PROMOTE_FIELD_ONLY_SLOT" }),
    );

    click(root, "Share with the Set");
    await vi.waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "PROMOTE_FIELD_ONLY_SLOT",
          setId: "set-1",
          slotId: "slot-private",
          fieldProfileId: "field-a",
        }),
      ),
    );
    await vi.waitFor(() => {
      const nameCard = [...root.querySelectorAll(".field-card")].find((card) => card.textContent?.includes("Name"));
      expect(nameCard?.textContent).toContain("A's own private template");
    });

    const resultRegion = root.querySelector(".panel-result-region");
    await vi.waitFor(() => expect(resultRegion?.textContent).toContain("Shared \"A's own private template\" with the whole Set"));
    click(root, "Undo");
    await vi.waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: "UNDO_PROMOTE_FIELD_ONLY_SLOT", setId: "set-1", slotId: "slot-private", ownerFieldProfileId: "field-a" }),
      ),
    );
    await vi.waitFor(() => {
      const nameCard = [...root.querySelectorAll(".field-card")].find((card) => card.textContent?.includes("Name"));
      expect(nameCard?.textContent).not.toContain("A's own private template");
    });
  });
});

describe("SidePanel Templates: All templates tab", () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.unstubAllGlobals();
  });

  it("lists every Template with no filter applied", async () => {
    stubChrome(baseState());
    const root = document.createElement("div");
    document.body.append(root);
    render(<SidePanel />, root);

    click(root, "Templates");
    await vi.waitFor(() => expect(root.textContent).toContain("Email"));
    click(root, "All templates");
    await vi.waitFor(() => expect(root.textContent).toContain("Bound reply"));
    expect(root.textContent).toContain("Global note");
  });

  it("the Global only toggle button narrows the list to zero-Site-Affinity Templates", async () => {
    stubChrome(baseState());
    const root = document.createElement("div");
    document.body.append(root);
    render(<SidePanel />, root);

    click(root, "Templates");
    await vi.waitFor(() => expect(root.textContent).toContain("Email"));
    click(root, "All templates");
    await vi.waitFor(() => expect(root.textContent).toContain("Bound reply"));
    expect(root.textContent).toContain("Global note");

    const globalToggle = [...root.querySelectorAll("button")].find((candidate) => candidate.textContent?.trim() === "Global only");
    if (!(globalToggle instanceof HTMLButtonElement)) throw new Error("Global only toggle not found");
    expect(globalToggle.getAttribute("aria-pressed")).toBe("false");

    globalToggle.click();
    await vi.waitFor(() => expect(globalToggle.getAttribute("aria-pressed")).toBe("true"));
    expect(root.textContent).toContain("Global note");
    expect(root.textContent).not.toContain("Bound reply");
  });

  it("announces the version actually saved, not the one it replaced (Task 023 Addendum B5, finding 10)", async () => {
    stubChrome(baseState());
    const root = document.createElement("div");
    document.body.append(root);
    render(<SidePanel />, root);

    click(root, "Templates");
    await vi.waitFor(() => expect(root.textContent).toContain("Email"));
    click(root, "All templates");
    await vi.waitFor(() => expect(root.textContent).toContain("Global note"));

    clickInRow(root, "Global note", "Edit");
    const editor = await vi.waitFor(() => {
      const found = root.querySelector<HTMLTextAreaElement>('textarea[aria-label="Edit Template content"]');
      if (!found) throw new Error("Template editor not open");
      return found;
    });
    editor.value = "Global note revised";
    editor.dispatchEvent(new InputEvent("input", { bubbles: true }));
    await Promise.resolve();
    click(root, "Save");

    const resultRegion = root.querySelector(".panel-result-region");
    await vi.waitFor(() => expect(resultRegion?.textContent).toContain("Saved"));
    // The pre-save version is still carried for Undo, but naming it here told
    // the user their edit had not been saved.
    expect(resultRegion?.textContent).toContain("Global note revised");
    expect(resultRegion?.textContent).not.toContain('Saved "Global note" everywhere');
  });

  it("announces results as plain text, says Undo exists, and recovers focus the action destroyed (Task 023 Addendum B5, findings 9 and 11)", async () => {
    stubChrome(baseState());
    const root = document.createElement("div");
    document.body.append(root);
    render(<SidePanel />, root);

    click(root, "Templates");
    await vi.waitFor(() => expect(root.textContent).toContain("Email"));
    click(root, "All templates");
    await vi.waitFor(() => expect(root.textContent).toContain("Global note"));

    clickInRow(root, "Global note", "Delete");
    await vi.waitFor(() => expect(root.querySelector(".template-list")?.textContent).not.toContain("Global note"));

    // The announcing region is text-only: VoiceOver did not reliably announce
    // the visible banner, whose new content is a subtree of buttons.
    const liveRegion = root.querySelector(".visually-hidden[role='status']");
    await vi.waitFor(() => expect(liveRegion?.textContent).toContain("Deleted"));
    expect(liveRegion?.querySelector("button")).toBeNull();
    // "Undo" on its own was never announced at all; the outcome now says so.
    expect(liveRegion?.textContent).toContain("Undo is available.");

    // Deleting removed the row holding the Delete button that had focus, so
    // the browser dropped focus onto the document and VoiceOver read
    // "FillNest web content". Focus lands on the Undo the same action created.
    const undo = root.querySelector<HTMLButtonElement>(".side-panel-notification-action");
    expect(document.activeElement).toBe(undo);
    expect(undo?.getAttribute("aria-label")).toContain("Undo: Deleted");
  });

  it("deletes a Template immediately with no pre-confirmation, showing a result notification with Undo that reverses it", async () => {
    const sendMessage = stubChrome(baseState());
    const root = document.createElement("div");
    document.body.append(root);
    render(<SidePanel />, root);

    click(root, "Templates");
    await vi.waitFor(() => expect(root.textContent).toContain("Email"));
    click(root, "All templates");
    await vi.waitFor(() => expect(root.textContent).toContain("Global note"));

    clickInRow(root, "Global note", "Delete");
    await vi.waitFor(() => expect(root.querySelector(".template-list")?.textContent).not.toContain("Global note"));
    expect(sendMessage).toHaveBeenCalledWith({ type: "DELETE_TEMPLATE", templateId: "global-1" });

    // Result is shown in the global result region below navigation, not the old bottom bar.
    const resultRegion = root.querySelector(".panel-result-region");
    expect(resultRegion).not.toBeNull();
    await vi.waitFor(() => expect(resultRegion?.textContent).toContain("Deleted"));
    expect(resultRegion?.textContent).toContain("Global note");

    click(root, "Undo");
    await vi.waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: "RESTORE_TEMPLATE", template: expect.objectContaining({ id: "global-1" }) }),
      ),
    );
    await vi.waitFor(() => expect(root.textContent).toContain("Global note"));
    // After Undo succeeds, a completion notice replaces the Undo entry; no second Undo is offered.
    await vi.waitFor(() => expect(resultRegion?.querySelector("button[onClick]")?.textContent?.trim()).not.toBe("Undo"));
  });

  it("restores a deleted Template's Shared Bindings through Side Panel Undo", async () => {
    const sendMessage = vi.fn().mockResolvedValue({ ok: true, value: {} });
    vi.stubGlobal("chrome", { runtime: { sendMessage } });
    const template = {
      id: "shared-template",
      content: "Shared reply",
      siteAffinities: ["example.test"],
      createdAt: "x",
      updatedAt: "x",
      totalUsageCount: 0,
      revision: 0,
    };
    const sharedBinding = {
      id: "shared-binding",
      setId: "set-1",
      templateId: template.id,
      usageCount: 2,
      revision: 0,
      order: 0,
    };

    await performUndo(
      {
        type: "delete",
        template,
        bindings: [],
        sharedBindings: [sharedBinding],
        fieldStates: [],
        affectedFieldCount: 2,
      },
      async () => undefined,
      vi.fn(),
      en,
    );

    expect(sendMessage).toHaveBeenCalledWith({
      type: "RESTORE_TEMPLATE",
      template,
      bindings: [],
      sharedBindings: [sharedBinding],
      fieldStates: [],
    });
  });

  it("result persists through destination changes and is replaced by a later operation", async () => {
    const sendMessage = stubChrome(baseState());
    const root = document.createElement("div");
    document.body.append(root);
    render(<SidePanel />, root);

    click(root, "Templates");
    await vi.waitFor(() => expect(root.textContent).toContain("Email"));
    click(root, "All templates");
    await vi.waitFor(() => expect(root.textContent).toContain("Global note"));

    clickInRow(root, "Global note", "Delete");
    const resultRegion = root.querySelector(".panel-result-region");
    await vi.waitFor(() => expect(resultRegion?.textContent).toContain("Global note"));
    expect(resultRegion?.textContent).toContain("Deleted");

    // Navigate to a different destination — the result must still be visible.
    click(root, "Sites");
    await vi.waitFor(() => expect(root.textContent).toContain("By site"));
    expect(resultRegion?.textContent).toContain("Global note");

    // Navigate back to Templates and delete the second Template. The new result
    // replaces the previous one in the single-slot region.
    click(root, "Templates");
    await vi.waitFor(() => expect(root.textContent).toContain("Email"));
    click(root, "All templates");
    await vi.waitFor(() => expect(root.textContent).toContain("Bound reply"));

    clickInRow(root, "Bound reply", "Delete");
    await vi.waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: "DELETE_TEMPLATE", templateId: "bound-1" }),
      ),
    );
    await vi.waitFor(() => expect(resultRegion?.textContent).toContain("Bound reply"));
    // The earlier "Global note" result is gone — replaced by the later operation.
    expect(resultRegion?.textContent).not.toContain("Global note");
  });

  it("multi-select deletion shows an expandable impact summary with ordinary confirmation, and batch Undo restores the deleted subset", async () => {
    const extraState = () => {
      const state = baseState();
      return {
        ...state,
        templates: [
          ...state.templates,
          {
            id: "global-2",
            content: "Second global note",
            siteAffinities: [] as string[],
            createdAt: "2026-08-16T00:00:00.000Z",
            updatedAt: "2026-08-16T00:00:00.000Z",
            totalUsageCount: 0,
            revision: 0,
          },
        ],
      };
    };
    const sendMessage = stubChrome(extraState());
    const root = document.createElement("div");
    document.body.append(root);
    render(<SidePanel />, root);

    click(root, "Templates");
    await vi.waitFor(() => expect(root.textContent).toContain("Email"));
    click(root, "All templates");
    await vi.waitFor(() => expect(root.textContent).toContain("Global note"));
    expect(root.textContent).toContain("Second global note");

    const checkbox = (label: string): HTMLInputElement | undefined =>
      [...root.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].find(
        (candidate) => candidate.getAttribute("aria-label") === label,
      );
    const globalCheckbox = checkbox('Select "Global note" for deletion');
    const secondCheckbox = checkbox('Select "Second global note" for deletion');
    if (!globalCheckbox || !secondCheckbox) throw new Error("Selection checkboxes not found");
    globalCheckbox.click();
    secondCheckbox.click();
    await vi.waitFor(() => expect(root.textContent).toContain("2 selected"));

    click(root, "Delete selected");
    await vi.waitFor(() => expect(root.textContent).toContain("Delete 2 Templates everywhere?"));
    expect(root.querySelector('input[aria-label="Type delete to confirm"]')).toBeNull();

    const showImpact = [...root.querySelectorAll("button")].find((candidate) =>
      candidate.textContent?.startsWith("Show affected locations"),
    );
    if (!(showImpact instanceof HTMLButtonElement)) throw new Error("Impact toggle not found");
    showImpact.click();
    await vi.waitFor(() => expect(root.textContent).toContain("Sites:"));

    const confirmButtons = [...root.querySelectorAll("button.danger")].filter(
      (button) => button.textContent?.trim() === "Delete",
    );
    const confirmButton = confirmButtons[confirmButtons.length - 1];
    if (!(confirmButton instanceof HTMLButtonElement)) throw new Error("Confirm Delete button not found");
    confirmButton.click();

    await vi.waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith({
        type: "DELETE_TEMPLATES",
        templateIds: expect.arrayContaining(["global-1", "global-2"]),
      }),
    );
    await vi.waitFor(() => {
      expect(root.textContent).not.toContain("Global note");
      expect(root.textContent).not.toContain("Second global note");
    });
    expect(root.textContent).toContain("Bound reply");

    const resultRegion = root.querySelector(".panel-result-region");
    await vi.waitFor(() => expect(resultRegion?.textContent).toContain("Deleted 2 Templates"));

    click(root, "Undo");
    await vi.waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ type: "RESTORE_TEMPLATES" })),
    );
    await vi.waitFor(() => {
      expect(root.textContent).toContain("Global note");
      expect(root.textContent).toContain("Second global note");
    });
  });

  it("keeps whole-library Template deletion out of Settings", async () => {
    const sendMessage = stubChrome(baseState());
    const root = document.createElement("div");
    document.body.append(root);
    render(<SidePanel />, root);

    click(root, "Settings");
    await vi.waitFor(() => expect(root.textContent).toContain("Reset FillNest"));
    expect(root.textContent).not.toContain("Delete all templates");
    expect(sendMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: "DELETE_TEMPLATES" }));
  });

  it("does not ask for a typed word when a multi-select covers the only Template", async () => {
    // Task 028 Addendum B: typed `delete` guards a BULK operation that empties
    // the Library. Selecting the single Template you own is a targeted
    // deletion - the row-level Delete and the Inline Picker never asked for a
    // typed word, and a one-item multi-select must not either.
    const single = baseState();
    single.templates = single.templates.filter((template) => template.id === "global-1");
    single.bindings = [];
    const sendMessage = stubChrome(single);
    const root = document.createElement("div");
    document.body.append(root);
    render(<SidePanel />, root);

    click(root, "Templates");
    await vi.waitFor(() => expect(root.textContent).toContain("All templates"));
    click(root, "All templates");
    await vi.waitFor(() => expect(root.textContent).toContain("Global note"));

    const selectAll = root.querySelector<HTMLInputElement>(
      'input[aria-label="Select all visible Templates"]',
    );
    if (!selectAll) throw new Error("Select all checkbox not found");
    selectAll.click();
    await vi.waitFor(() => expect(root.textContent).toContain("1 selected"));

    click(root, "Delete selected");
    await vi.waitFor(() => expect(root.textContent).toContain("Delete 1 Template"));
    expect(root.textContent).not.toContain("This removes your entire Template Library.");
    expect(root.querySelector('input[aria-label="Type delete to confirm"]')).toBeNull();

    const confirmButtons = [...root.querySelectorAll<HTMLButtonElement>("button.danger")].filter(
      (button) => button.textContent?.trim() === "Delete",
    );
    const confirmButton = confirmButtons[confirmButtons.length - 1];
    expect(confirmButton?.hasAttribute("disabled")).toBe(false);
    confirmButton?.click();

    await vi.waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith({
        type: "DELETE_TEMPLATES",
        templateIds: ["global-1"],
      }),
    );
  });

  it("also requires exact typed lowercase delete for a Templates-page multi-select batch that happens to cover the whole Library", async () => {
    // Task 007 Slice 2 gap: the traceability matrix found only the Settings
    // "Delete all templates" path tested for the typed-delete gate. This
    // covers the other emptying path: selecting every visible Template via
    // the Templates page "Select all" checkbox and batch-deleting them.
    const sendMessage = stubChrome(baseState());
    const root = document.createElement("div");
    document.body.append(root);
    render(<SidePanel />, root);

    click(root, "Templates");
    await vi.waitFor(() => expect(root.textContent).toContain("Email"));
    click(root, "All templates");
    await vi.waitFor(() => expect(root.textContent).toContain("Global note"));
    expect(root.textContent).toContain("Bound reply");

    const selectAll = root.querySelector<HTMLInputElement>(
      'input[aria-label="Select all visible Templates"]',
    );
    if (!selectAll) throw new Error("Select all checkbox not found");
    selectAll.click();
    await vi.waitFor(() => expect(root.textContent).toContain("2 selected"));

    click(root, "Delete selected");
    // Because this selection happens to be the entire Template Library, the
    // batch-delete path must gate on typed "delete" exactly like the
    // Settings whole-library path does - never the ordinary one-click
    // confirmation used for a partial multi-select.
    await vi.waitFor(() => expect(root.textContent).toContain("This removes your entire Template Library."));
    const typedInput = root.querySelector<HTMLInputElement>('input[aria-label="Type delete to confirm"]');
    if (!typedInput) throw new Error("Typed delete input not found");

    const confirmButtons = () =>
      [...root.querySelectorAll<HTMLButtonElement>("button.danger")].filter(
        (button) => button.textContent?.trim() === "Delete",
      );
    const confirmButton = () => confirmButtons()[confirmButtons().length - 1];
    expect(confirmButton()?.hasAttribute("disabled")).toBe(true);

    typedInput.value = "DELETE";
    typedInput.dispatchEvent(new InputEvent("input", { bubbles: true }));
    await vi.waitFor(() => expect(confirmButton()?.hasAttribute("disabled")).toBe(true));

    typedInput.value = "delete";
    typedInput.dispatchEvent(new InputEvent("input", { bubbles: true }));
    await vi.waitFor(() => expect(confirmButton()?.hasAttribute("disabled")).toBe(false));

    confirmButton()?.click();
    await vi.waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith({
        type: "DELETE_TEMPLATES",
        templateIds: expect.arrayContaining(["bound-1", "global-1"]),
        // Task 028 (audit finding C2): the typed word travels to the service
        // worker, which re-derives from its own state whether this empties the
        // Library and enforces the gate there - so the rule holds "regardless
        // of entry point", not only in this dialog.
        typedConfirmation: "delete",
      }),
    );
    await vi.waitFor(() => expect(root.textContent).toContain("No Templates match this Search."));
  });

  it("composes Search, Site, and Bound filters deterministically", async () => {
    stubChrome(baseState());
    const root = document.createElement("div");
    document.body.append(root);
    render(<SidePanel />, root);

    click(root, "Templates");
    await vi.waitFor(() => expect(root.textContent).toContain("Email"));
    click(root, "All templates");
    await vi.waitFor(() => expect(root.textContent).toContain("Global note"));
    expect(root.textContent).toContain("Bound reply");

    const searchInput = root.querySelector<HTMLInputElement>('input[aria-label="Search Template bodies"]');
    if (!searchInput) throw new Error("Search input not found");
    searchInput.value = "bound";
    searchInput.dispatchEvent(new InputEvent("input", { bubbles: true }));

    await vi.waitFor(() => {
      expect(root.textContent).toContain("Bound reply");
      expect(root.textContent).not.toContain("Global note");
    });

    searchInput.value = "";
    searchInput.dispatchEvent(new InputEvent("input", { bubbles: true }));
    await vi.waitFor(() => expect(root.textContent).toContain("Global note"));

    const boundSelect = root.querySelector<HTMLSelectElement>('select[aria-label="Filter by Bound or Unbound"]');
    if (!boundSelect) throw new Error("Bound filter not found");
    boundSelect.value = "unbound";
    boundSelect.dispatchEvent(new Event("change", { bubbles: true }));

    await vi.waitFor(() => {
      expect(root.textContent).toContain("Global note");
      expect(root.textContent).not.toContain("Bound reply");
    });
  });

  it("the Site filter multi-selects with union matching, chips, backspace-removal, and disables under Global only", async () => {
    const state = baseState();
    const multiSiteState = {
      ...state,
      sites: [...state.sites, { id: "other.test" }, { id: "third.test" }],
      templates: [
        ...state.templates,
        {
          id: "other-1",
          content: "Other site reply",
          siteAffinities: ["other.test"],
          createdAt: "2026-08-16T00:00:00.000Z",
          updatedAt: "2026-08-16T00:00:00.000Z",
          totalUsageCount: 0,
          revision: 0,
        },
        {
          id: "third-1",
          content: "Third site reply",
          siteAffinities: ["third.test"],
          createdAt: "2026-08-16T00:00:00.000Z",
          updatedAt: "2026-08-16T00:00:00.000Z",
          totalUsageCount: 0,
          revision: 0,
        },
      ],
    };
    stubChrome(multiSiteState);
    const root = document.createElement("div");
    document.body.append(root);
    render(<SidePanel />, root);

    click(root, "Templates");
    await vi.waitFor(() => expect(root.textContent).toContain("Email"));
    click(root, "All templates");
    await vi.waitFor(() => expect(root.textContent).toContain("Global note"));

    const siteOption = (siteId: string): HTMLInputElement => {
      const option = [...root.querySelectorAll(".site-filter-option")].find((candidate) =>
        candidate.textContent?.includes(siteId),
      );
      const checkbox = option?.querySelector('input[type="checkbox"]');
      if (!(checkbox instanceof HTMLInputElement)) throw new Error(`Site option not found: ${siteId}`);
      return checkbox;
    };

    click(root, "Any Site");
    await vi.waitFor(() => expect(root.textContent).toContain("Filter Site"));

    // Task 023 Addendum B5 (5): the open menu is a group of checkboxes, not a
    // listbox. As a listbox its children were not options, so browsers pruned
    // them from the accessibility tree and VoiceOver could not reach a single
    // Site with Ctrl+Alt+Arrow even though Tab still focused them.
    const siteMenu = root.querySelector(".site-filter-menu");
    expect(siteMenu?.getAttribute("role")).toBe("group");
    expect(siteMenu?.getAttribute("aria-label")).toBe("Filter by Site");
    siteOption("example.test").click();
    siteOption("other.test").click();

    // Both picks become chips in the Search area, and the button reflects the count.
    await vi.waitFor(() => expect(root.textContent).toContain("2 Sites"));
    expect(root.querySelector('button[aria-label="Remove Site filter example.test"]')).toBeTruthy();
    expect(root.querySelector('button[aria-label="Remove Site filter other.test"]')).toBeTruthy();
    expect(root.textContent).toContain("Showing Templates from any of 2 Sites (union)");

    // Union match: both selected Sites' Templates show; the third Site's and
    // the Global (no-affinity) Template don't.
    expect(root.textContent).toContain("Bound reply");
    expect(root.textContent).toContain("Other site reply");
    expect(root.textContent).not.toContain("Third site reply");
    expect(root.textContent).not.toContain("Global note");

    // Removing one chip narrows back to a single-Site filter.
    const removeOther = root.querySelector<HTMLButtonElement>('button[aria-label="Remove Site filter other.test"]');
    removeOther?.click();
    await vi.waitFor(() => expect(root.textContent).not.toContain("Other site reply"));
    expect(root.textContent).toContain("Bound reply");

    // Backspace in an empty Search field removes the last remaining chip.
    const searchInput = root.querySelector<HTMLInputElement>('input[aria-label="Search Template bodies"]');
    if (!searchInput) throw new Error("Search input not found");
    searchInput.focus();
    searchInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace", bubbles: true }));
    await vi.waitFor(() =>
      expect(root.querySelector('button[aria-label="Remove Site filter example.test"]')).toBeFalsy(),
    );
    expect(root.textContent).toContain("Third site reply");

    // Global only disables the Site filter button, as today.
    click(root, "Global only");
    await vi.waitFor(() => {
      const siteButton = [...root.querySelectorAll("button")].find((candidate) =>
        candidate.getAttribute("aria-label")?.startsWith("Filter by Site:"),
      );
      expect(siteButton?.hasAttribute("disabled")).toBe(true);
    });
  });

  it("expands a Template row to show its full text on click, and collapses again on a second click", async () => {
    const state = baseState();
    const longTemplate = {
      id: "long-1",
      content: "Opening line\nSecond line with more detail\nThird line\nFourth line, the tail end",
      siteAffinities: [] as string[],
      createdAt: "2026-08-16T00:00:00.000Z",
      updatedAt: "2026-08-16T00:00:00.000Z",
      totalUsageCount: 0,
      revision: 0,
    };
    stubChrome({ ...state, templates: [...state.templates, longTemplate] });
    const root = document.createElement("div");
    document.body.append(root);
    render(<SidePanel />, root);

    click(root, "Templates");
    await vi.waitFor(() => expect(root.textContent).toContain("Email"));
    click(root, "All templates");
    await vi.waitFor(() => expect(root.textContent).toContain("Opening line"));
    expect(root.textContent).not.toContain("Fourth line, the tail end");

    const row = [...root.querySelectorAll(".template-item")].find((candidate) => candidate.textContent?.includes("Opening line"));
    if (!row) throw new Error("Row not found");
    const textButton = row.querySelector<HTMLButtonElement>(".template-row-text");
    if (!textButton) throw new Error("Row text button not found");
    expect(textButton.getAttribute("aria-expanded")).toBe("false");

    textButton.click();
    await vi.waitFor(() => expect(root.textContent).toContain("Fourth line, the tail end"));
    expect(textButton.getAttribute("aria-expanded")).toBe("true");

    textButton.click();
    await vi.waitFor(() => expect(root.textContent).not.toContain("Fourth line, the tail end"));
    expect(textButton.getAttribute("aria-expanded")).toBe("false");
  });
});

// Task 025 Addendum A. Reported by the owner: Escape did not cancel a Template
// content edit, and pressing it closed the whole Side Panel with focus landing
// somewhere in the page. Those are one defect. The modal dialogs handle Escape
// and call preventDefault; the inline editors handled nothing, so the key
// reached Chrome, which closes the side panel. The alias editor cancelled but
// did not preventDefault, so it leaked the key too.
describe("Side Panel inline editors and Escape", () => {
  function pressEscape(element: Element): boolean {
    const event = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    element.dispatchEvent(event);
    return event.defaultPrevented;
  }

  it("cancels a Template content edit and does not let Escape reach the browser", async () => {
    stubChrome(baseState());
    const root = document.createElement("div");
    document.body.append(root);
    render(<SidePanel />, root);

    click(root, "Templates");
    await vi.waitFor(() => expect(root.textContent).toContain("Email"));
    clickByLabel(root, 'Expand "Email"');
    await vi.waitFor(() => expect(root.textContent).toContain("Bound reply"));
    clickByLabel(root, "Edit");
    const editor = await vi.waitFor(() => {
      const found = root.querySelector<HTMLTextAreaElement>('textarea[aria-label="Edit Template content"]');
      if (!found) throw new Error("Editor not open");
      return found;
    });

    editor.value = "Half-typed change";
    editor.dispatchEvent(new InputEvent("input", { bubbles: true }));

    // Both halves matter: the edit closes, and the key is consumed so Chrome
    // does not take it as "close the side panel".
    expect(pressEscape(editor)).toBe(true);
    await vi.waitFor(() =>
      expect(root.querySelector('textarea[aria-label="Edit Template content"]')).toBeNull(),
    );
    expect(root.textContent).toContain("Bound reply");
  });

  it("cancels a rename and does not let Escape reach the browser", async () => {
    stubChrome(baseState());
    const root = document.createElement("div");
    document.body.append(root);
    render(<SidePanel />, root);

    click(root, "Templates");
    await vi.waitFor(() => expect(root.textContent).toContain("Email"));
    clickByLabel(root, "Rename Email");
    const input = await vi.waitFor(() => {
      const found = root.querySelector<HTMLInputElement>('input[aria-label="Name for Email"]');
      if (!found) throw new Error("Rename not open");
      return found;
    });

    expect(pressEscape(input)).toBe(true);
    await vi.waitFor(() => expect(root.querySelector('input[aria-label="Name for Email"]')).toBeNull());
  });
});
