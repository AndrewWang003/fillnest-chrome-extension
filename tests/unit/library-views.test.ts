import { en } from "../../src/i18n/messages";
import { describe, expect, it } from "vitest";

import type { FillNestState } from "../../src/storage/fillnest-repository";
import { buildLocationTree, compareTemplates, defaultDirectionFor, listAllTemplates } from "../../src/templates/library-views";

function template(
  id: string,
  content: string,
  overrides: Partial<{
    siteAffinities: string[];
    totalUsageCount: number;
    createdAt: string;
    updatedAt: string;
  }> = {},
) {
  return {
    id,
    content,
    siteAffinities: overrides.siteAffinities ?? [],
    createdAt: overrides.createdAt ?? "2026-08-01T00:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-08-01T00:00:00.000Z",
    totalUsageCount: overrides.totalUsageCount ?? 0,
    revision: 0,
  };
}

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

describe("listAllTemplates", () => {
  const state: FillNestState = {
    ...emptyState(),
    templates: [
      template("t1", "Jordan Lee support reply", { siteAffinities: ["example.test"], totalUsageCount: 2 }),
      template("t2", "Morgan Reed note", { siteAffinities: [], totalUsageCount: 5 }),
      template("t3", "Another Jordan mention", { siteAffinities: ["other.test"], totalUsageCount: 1 }),
    ],
    bindings: [
      { id: "b1", templateId: "t1", pageProfileId: "p1", fieldProfileId: "f1", createdAt: "x", usageCount: 0, revision: 0},
    ],
  };

  it("lists every Template exactly once with no filters", () => {
    const ids = listAllTemplates(state, {}).map((tpl) => tpl.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.sort()).toEqual(["t1", "t2", "t3"]);
  });

  it("remains correct with zero, one, and ten Templates", () => {
    expect(listAllTemplates(emptyState(), {})).toEqual([]);

    const oneTemplateState: FillNestState = { ...emptyState(), templates: [template("solo", "Solo Template")] };
    expect(listAllTemplates(oneTemplateState, {}).map((tpl) => tpl.id)).toEqual(["solo"]);

    const tenTemplates = Array.from({ length: 10 }, (_unused, index) =>
      template(`ten-${index}`, `Template number ${index}`, { totalUsageCount: index }),
    );
    const tenTemplateState: FillNestState = { ...emptyState(), templates: tenTemplates };
    const tenIds = listAllTemplates(tenTemplateState, {}).map((tpl) => tpl.id);
    expect(new Set(tenIds).size).toBe(10);
    expect(tenIds).toEqual(tenTemplates.map((tpl) => tpl.id).reverse()); // default sort: usage descending
  });

  it("filters by literal Template body Search only", () => {
    expect(listAllTemplates(state, { search: "jordan" }).map((tpl) => tpl.id).sort()).toEqual([
      "t1",
      "t3",
    ]);
  });

  it("filters Global-only: zero-Site-Affinity Templates, plus any Template with no live Bindings regardless of a stale Site Affinity", () => {
    // t2 has no Site Affinity at all; t3 has one ("other.test") but no
    // Binding references it, so it counts as available everywhere too.
    // t1 is excluded: it has both a Site Affinity and a live Binding (b1).
    expect(listAllTemplates(state, { globalOnly: true }).map((tpl) => tpl.id).sort()).toEqual(["t2", "t3"]);
  });

  it("Global-only keeps including a Template after its last Binding is removed, even though its Site Affinity stays put", () => {
    const unboundAfterUnbind: FillNestState = {
      ...emptyState(),
      templates: [template("was-bound", "Reusable note", { siteAffinities: ["example.test"], totalUsageCount: 0 })],
      bindings: [],
    };
    expect(listAllTemplates(unboundAfterUnbind, { globalOnly: true }).map((tpl) => tpl.id)).toEqual(["was-bound"]);
  });

  it("filters by a specific Site Affinity", () => {
    expect(listAllTemplates(state, { siteIds: new Set(["other.test"]) }).map((tpl) => tpl.id)).toEqual(["t3"]);
  });

  it("filters by the union of several Site Affinities", () => {
    expect(
      listAllTemplates(state, { siteIds: new Set(["example.test", "other.test"]) })
        .map((tpl) => tpl.id)
        .sort(),
    ).toEqual(["t1", "t3"]);
  });

  it("filters Bound vs Unbound", () => {
    expect(listAllTemplates(state, { boundOnly: true }).map((tpl) => tpl.id)).toEqual(["t1"]);
    expect(listAllTemplates(state, { boundOnly: false }).map((tpl) => tpl.id).sort()).toEqual([
      "t2",
      "t3",
    ]);
  });

  it("composes filters deterministically and clearing them restores default ordering", () => {
    const filtered = listAllTemplates(state, { search: "jordan", siteIds: new Set(["example.test"]) });
    expect(filtered.map((tpl) => tpl.id)).toEqual(["t1"]);

    const cleared = listAllTemplates(state, {});
    expect(cleared.map((tpl) => tpl.id)).toEqual(["t2", "t1", "t3"]);
  });

  it("defaults to Template total usage count descending", () => {
    expect(listAllTemplates(state, {}).map((tpl) => tpl.id)).toEqual(["t2", "t1", "t3"]);
  });
});

describe("buildLocationTree field ordering", () => {
  it("uses persisted document order instead of a mutable alias label", () => {
    const state: FillNestState = {
      ...emptyState(),
      sites: [{ id: "example.test" }],
      templates: [template("first", "First"), template("second", "Second")],
      pageProfiles: [{ id: "page", siteId: "example.test" }],
      fieldProfiles: [
        { id: "field-later", pageProfileId: "page", userAlias: "A renamed field", documentOrder: 5 },
        { id: "field-earlier", pageProfileId: "page", userAlias: "Z renamed field", documentOrder: 1 },
      ],
      bindings: [
        { id: "binding-later", templateId: "first", pageProfileId: "page", fieldProfileId: "field-later", createdAt: "x", usageCount: 0, revision: 0},
        { id: "binding-earlier", templateId: "second", pageProfileId: "page", fieldProfileId: "field-earlier", createdAt: "x", usageCount: 0, revision: 0},
      ],
    };
    expect(buildLocationTree(state, en).sites[0]?.pages[0]?.fields.map((field) => field.fieldProfileId)).toEqual([
      "field-earlier",
      "field-later",
    ]);
  });
});

describe("compareTemplates", () => {
  const a = template("a-id", "Zebra", { totalUsageCount: 1, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" });
  const b = template("b-id", "apple", { totalUsageCount: 3, createdAt: "2026-02-01T00:00:00.000Z", updatedAt: "2026-03-01T00:00:00.000Z" });

  it("defaults alphabetical sort to ascending, locale/case-insensitive", () => {
    expect(defaultDirectionFor("alphabetical")).toBe("ascending");
    const sorted = [a, b].sort(compareTemplates("alphabetical", "ascending"));
    expect(sorted.map((tpl) => tpl.id)).toEqual(["b-id", "a-id"]);
  });

  it("defaults created/updated/usage sorts to descending (newest/most-used first)", () => {
    expect(defaultDirectionFor("created")).toBe("descending");
    expect(defaultDirectionFor("updated")).toBe("descending");
    expect(defaultDirectionFor("usage")).toBe("descending");
    expect([a, b].sort(compareTemplates("usage", "descending")).map((tpl) => tpl.id)).toEqual([
      "b-id",
      "a-id",
    ]);
  });

  it("reverses direction on request while keeping tie-breakers stable", () => {
    expect([a, b].sort(compareTemplates("usage", "ascending")).map((tpl) => tpl.id)).toEqual([
      "a-id",
      "b-id",
    ]);
  });

  it("falls through the full tie-breaker sequence deterministically", () => {
    const tie1 = template("id-2", "Same preview", { totalUsageCount: 4 });
    const tie2 = template("id-1", "Same preview", { totalUsageCount: 4 });
    const sorted = [tie1, tie2].sort(compareTemplates("usage", "descending"));
    expect(sorted.map((tpl) => tpl.id)).toEqual(["id-1", "id-2"]);
  });
});
