import { en } from "../../src/i18n/messages";
import { describe, expect, it } from "vitest";

import { buildFieldFirstView, filterFieldFirstView } from "../../src/templates/field-first-view";
import type {
  BindingRecord,
  FieldProfileRecord,
  FillNestState,
  PageProfileRecord,
  TemplateRecord,
} from "../../src/storage/fillnest-repository";

function emptyState(): FillNestState {
  return {
    schemaVersion: 13,
    compatibilityPairDecisions: [],
    sites: [],
    templates: [],
    pageProfiles: [],
    fieldProfiles: [],
    bindings: [],
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

function template(id: string, overrides: Partial<TemplateRecord> = {}): TemplateRecord {
  return {
    id,
    content: overrides.content ?? `Content ${id}`,
    siteAffinities: overrides.siteAffinities ?? [],
    createdAt: overrides.createdAt ?? "x",
    updatedAt: overrides.updatedAt ?? "x",
    totalUsageCount: overrides.totalUsageCount ?? 0,
    revision: overrides.revision ?? 0,
  };
}

function page(id: string, siteId: string, overrides: Partial<PageProfileRecord> = {}): PageProfileRecord {
  return { id, siteId, ...overrides };
}

function field(id: string, pageProfileId: string, overrides: Partial<FieldProfileRecord> = {}): FieldProfileRecord {
  return { id, pageProfileId, ...overrides };
}

function binding(
  id: string,
  templateId: string,
  pageProfileId: string,
  fieldProfileId: string,
  usageCount = 0,
): BindingRecord {
  return { id, templateId, pageProfileId, fieldProfileId, createdAt: "x", usageCount, revision: 0 };
}

describe("buildFieldFirstView", () => {
  it("is empty for a fresh install", () => {
    expect(buildFieldFirstView(emptyState(), null, en)).toEqual({ fields: [], notOfferedAnywhere: [] });
  });

  it("is empty when no current-tab Page is resolved", () => {
    const state: FillNestState = {
      ...emptyState(),
      templates: [template("t1")],
      pageProfiles: [page("page-1", "example.test")],
      fieldProfiles: [field("field-1", "page-1")],
      bindings: [binding("b1", "t1", "page-1", "field-1", 0)],
    };

    expect(buildFieldFirstView(state, null, en).fields).toEqual([]);
  });

  // Manual ordering was removed on 2026-09-08. A Field's list is ranked by that
  // Field's own Binding usage - "Most used" is bound second and used twice, so
  // it outranks a Template bound first and never used.
  it("groups by Field and ranks each Field's own Templates by that Field's usage", () => {
    const state: FillNestState = {
      ...emptyState(),
      templates: [template("t1", { content: "Never used" }), template("t2", { content: "Most used" })],
      pageProfiles: [page("page-1", "example.test", { identityKey: "/profile" })],
      fieldProfiles: [field("field-1", "page-1", { identityKey: '{"semanticKind":"email"}' })],
      bindings: [binding("b1", "t1", "page-1", "field-1", 0), binding("b2", "t2", "page-1", "field-1", 2)],
    };

    const view = buildFieldFirstView(state, "page-1", en);

    expect(view.fields).toHaveLength(1);
    const row = view.fields[0]!;
    expect(row.label).toBe("Email");
    expect(row.options.map((option) => option.template.content)).toEqual(["Most used", "Never used"]);
  });

  it("scopes to only the given Page, excluding Fields on other Pages", () => {
    const state: FillNestState = {
      ...emptyState(),
      templates: [template("t1"), template("t2")],
      pageProfiles: [page("page-1", "example.test"), page("page-2", "example.test")],
      fieldProfiles: [field("field-1", "page-1"), field("field-2", "page-2")],
      bindings: [binding("b1", "t1", "page-1", "field-1", 0), binding("b2", "t2", "page-2", "field-2", 0)],
    };

    const view = buildFieldFirstView(state, "page-1", en);

    expect(view.fields.map((row) => row.fieldProfileId)).toEqual(["field-1"]);
  });

  it("uses observed titles while retaining DOM Field order instead of alphabetical or alias order", () => {
    const state: FillNestState = {
      ...emptyState(),
      templates: [template("t1"), template("t2")],
      pageProfiles: [page("page-1", "example.test")],
      fieldProfiles: [
        field("field-first", "page-1", { observedTitle: "Zebra", documentOrder: 0 }),
        field("field-second", "page-1", { observedTitle: "Account", userAlias: "A renamed field", documentOrder: 1 }),
      ],
      bindings: [
        binding("b1", "t1", "page-1", "field-first", 0),
        binding("b2", "t2", "page-1", "field-second", 0),
      ],
    };

    const view = buildFieldFirstView(state, "page-1", en);

    expect(view.fields.map((row) => row.fieldProfileId)).toEqual(["field-first", "field-second"]);
    expect(view.fields.map((row) => row.label)).toEqual(["Zebra", "A renamed field"]);
  });

  it("never pulls a Template from a different Field or Page into a Field's own options - real Field data only", () => {
    const state: FillNestState = {
      ...emptyState(),
      templates: [template("t1", { content: "Field one's own" }), template("t2", { content: "Field two's own" })],
      pageProfiles: [page("page-1", "example.test")],
      fieldProfiles: [field("field-1", "page-1"), field("field-2", "page-1")],
      bindings: [binding("b1", "t1", "page-1", "field-1", 0), binding("b2", "t2", "page-1", "field-2", 0)],
    };

    const view = buildFieldFirstView(state, "page-1", en);

    const fieldOne = view.fields.find((row) => row.fieldProfileId === "field-1");
    expect(fieldOne?.options.map((option) => option.template.id)).toEqual(["t1"]);
  });

  it("excludes a Field with zero live Bindings from the list entirely", () => {
    const state: FillNestState = {
      ...emptyState(),
      pageProfiles: [page("page-1", "example.test")],
      fieldProfiles: [field("field-1", "page-1")],
      bindings: [],
    };

    expect(buildFieldFirstView(state, "page-1", en).fields).toEqual([]);
  });

  it("lists every Template with zero live Bindings anywhere as notOfferedAnywhere, sorted alphabetically", () => {
    const state: FillNestState = {
      ...emptyState(),
      templates: [template("t1", { content: "Zebra" }), template("t2", { content: "Apple" }), template("t3", { content: "Bound" })],
      pageProfiles: [page("page-1", "example.test")],
      fieldProfiles: [field("field-1", "page-1")],
      bindings: [binding("b1", "t3", "page-1", "field-1", 0)],
    };

    const view = buildFieldFirstView(state, "page-1", en);

    expect(view.notOfferedAnywhere.map((t) => t.content)).toEqual(["Apple", "Zebra"]);
  });

  it("lists notOfferedAnywhere Templates even when the current-tab Page is null", () => {
    const state: FillNestState = {
      ...emptyState(),
      templates: [template("t1", { content: "Zebra" })],
      pageProfiles: [],
      fieldProfiles: [],
      bindings: [],
    };

    const view = buildFieldFirstView(state, null, en);

    expect(view.notOfferedAnywhere.map((t) => t.content)).toEqual(["Zebra"]);
  });

  it("is defensively tolerant of a Binding whose Field/Page/Template no longer exists (malformed relationships)", () => {
    const state: FillNestState = {
      ...emptyState(),
      templates: [template("t1")],
      pageProfiles: [page("page-1", "example.test")],
      fieldProfiles: [field("field-1", "page-1")],
      bindings: [
        binding("b1", "t1", "page-1", "field-1", 0),
        binding("b2", "missing-template", "page-1", "field-1", 1),
        binding("b3", "t1", "missing-page", "missing-field", 0),
      ],
    };

    const view = buildFieldFirstView(state, "page-1", en);

    expect(view.fields).toHaveLength(1);
    expect(view.fields[0]?.options.map((option) => option.binding?.id)).toEqual(["b1"]);
  });
});

describe("buildFieldFirstView: Shared Template Set parity (Task 026)", () => {
  it("shows a Shared Template Set member's effective slots even with zero direct Bindings of its own", () => {
    const state: FillNestState = {
      ...emptyState(),
      templates: [template("t1", { content: "Shared reply" })],
      pageProfiles: [page("page-1", "example.test")],
      fieldProfiles: [field("field-a", "page-1"), field("field-b", "page-1")],
      sharedTemplateSets: [
        { id: "set-1", siteId: "example.test", name: "Names", memberFieldProfileIds: ["field-a", "field-b"] },
      ],
      sharedTemplateBindings: [
        { id: "slot-1", setId: "set-1", templateId: "t1", usageCount: 0, revision: 0, order: 0 },
      ],
    };

    const view = buildFieldFirstView(state, "page-1", en);

    expect(view.fields).toHaveLength(2);
    const fieldA = view.fields.find((row) => row.fieldProfileId === "field-a");
    expect(fieldA?.sharedSetId).toBe("set-1");
    expect(fieldA?.options.map((option) => option.template.content)).toEqual(["Shared reply"]);
    expect(fieldA?.options[0]?.binding).toBeNull();
    expect(fieldA?.options[0]?.slotId).toBe("slot-1");
    expect(fieldA?.options[0]?.isOverride).toBe(false);
  });

  it("resolves a Field's own Override in place of the slot's base Template, marked isOverride", () => {
    const state: FillNestState = {
      ...emptyState(),
      templates: [template("t1", { content: "Base" }), template("override-1", { content: "A's own version" })],
      pageProfiles: [page("page-1", "example.test")],
      fieldProfiles: [field("field-a", "page-1"), field("field-b", "page-1")],
      sharedTemplateSets: [
        { id: "set-1", siteId: "example.test", name: "Names", memberFieldProfileIds: ["field-a", "field-b"] },
      ],
      sharedTemplateBindings: [
        { id: "slot-1", setId: "set-1", templateId: "t1", usageCount: 0, revision: 0, order: 0 },
      ],
      sharedTemplateFieldStates: [
        {
          id: "state-1",
          setId: "set-1",
          slotId: "slot-1",
          fieldProfileId: "field-a",
          mode: "override",
          templateId: "override-1",
          usageCount: 0,
          revision: 0,
        },
      ],
    };

    const view = buildFieldFirstView(state, "page-1", en);

    const fieldA = view.fields.find((row) => row.fieldProfileId === "field-a")!;
    expect(fieldA.options.map((option) => option.template.content)).toEqual(["A's own version"]);
    expect(fieldA.options[0]?.isOverride).toBe(true);
    const fieldB = view.fields.find((row) => row.fieldProfileId === "field-b")!;
    expect(fieldB.options.map((option) => option.template.content)).toEqual(["Base"]);
  });

  it("omits an excluded slot from that Field's own options while leaving other members unaffected", () => {
    const state: FillNestState = {
      ...emptyState(),
      templates: [template("t1", { content: "Base" })],
      pageProfiles: [page("page-1", "example.test")],
      fieldProfiles: [field("field-a", "page-1"), field("field-b", "page-1")],
      sharedTemplateSets: [
        { id: "set-1", siteId: "example.test", name: "Names", memberFieldProfileIds: ["field-a", "field-b"] },
      ],
      sharedTemplateBindings: [
        { id: "slot-1", setId: "set-1", templateId: "t1", usageCount: 0, revision: 0, order: 0 },
      ],
      sharedTemplateFieldStates: [
        { id: "state-1", setId: "set-1", slotId: "slot-1", fieldProfileId: "field-a", mode: "exclude" },
      ],
    };

    const view = buildFieldFirstView(state, "page-1", en);

    expect(view.fields.find((row) => row.fieldProfileId === "field-a")).toBeUndefined();
    expect(view.fields.find((row) => row.fieldProfileId === "field-b")?.options).toHaveLength(1);
  });

  it("never counts a Shared Template Set slot's base Template, or a live Override, as notOfferedAnywhere", () => {
    const state: FillNestState = {
      ...emptyState(),
      templates: [
        template("t1", { content: "Base" }),
        template("override-1", { content: "Override" }),
        template("t2", { content: "Truly unused" }),
      ],
      pageProfiles: [page("page-1", "example.test")],
      fieldProfiles: [field("field-a", "page-1"), field("field-b", "page-1")],
      sharedTemplateSets: [
        { id: "set-1", siteId: "example.test", name: "Names", memberFieldProfileIds: ["field-a", "field-b"] },
      ],
      sharedTemplateBindings: [
        { id: "slot-1", setId: "set-1", templateId: "t1", usageCount: 0, revision: 0, order: 0 },
      ],
      sharedTemplateFieldStates: [
        {
          id: "state-1",
          setId: "set-1",
          slotId: "slot-1",
          fieldProfileId: "field-a",
          mode: "override",
          templateId: "override-1",
          usageCount: 0,
          revision: 0,
        },
      ],
    };

    const view = buildFieldFirstView(state, "page-1", en);

    expect(view.notOfferedAnywhere.map((t) => t.content)).toEqual(["Truly unused"]);
  });
});

describe("filterFieldFirstView", () => {
  function sampleView() {
    const state: FillNestState = {
      ...emptyState(),
      templates: [
        template("t1", { content: "Warm greeting" }),
        template("t2", { content: "Cold reply" }),
        template("t3", { content: "Never used template" }),
      ],
      pageProfiles: [page("page-1", "example.test")],
      fieldProfiles: [field("field-1", "page-1", { identityKey: '{"semanticKind":"email"}' })],
      bindings: [binding("b1", "t1", "page-1", "field-1", 0), binding("b2", "t2", "page-1", "field-1", 1)],
    };
    return buildFieldFirstView(state, "page-1", en);
  }

  it("returns the view unchanged for an empty search", () => {
    const view = sampleView();
    expect(filterFieldFirstView(view, "")).toEqual(view);
    expect(filterFieldFirstView(view, "   ")).toEqual(view);
  });

  it("matching the Field label keeps every one of its options", () => {
    const filtered = filterFieldFirstView(sampleView(), "email");
    expect(filtered.fields[0]?.options).toHaveLength(2);
  });

  it("matching only a Template's content narrows that Field's options to the match", () => {
    const filtered = filterFieldFirstView(sampleView(), "warm");
    expect(filtered.fields[0]?.options.map((option) => option.template.content)).toEqual(["Warm greeting"]);
  });

  it("drops a Field entirely once none of its options match", () => {
    const filtered = filterFieldFirstView(sampleView(), "nothing matches this");
    expect(filtered.fields).toEqual([]);
  });

  it("also filters the notOfferedAnywhere bucket by content", () => {
    const filtered = filterFieldFirstView(sampleView(), "never used");
    expect(filtered.notOfferedAnywhere.map((t) => t.content)).toEqual(["Never used template"]);
  });
});
