import { describe, expect, it } from "vitest";

import type { ActivationManagementSnapshot } from "../../src/activation/activation-authority";
import {
  buildSiteProjections,
  computeResetSiteMappingsImpact,
  countTemplatesForSite,
} from "../../src/sites/site-projection";
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
    content: `Content ${id}`,
    siteAffinities: overrides.siteAffinities ?? [],
    createdAt: overrides.createdAt ?? "2026-08-01T00:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-08-01T00:00:00.000Z",
    totalUsageCount: overrides.totalUsageCount ?? 0,
    revision: overrides.revision ?? 0,
  };
}

function pageProfile(id: string, siteId: string, overrides: Partial<PageProfileRecord> = {}): PageProfileRecord {
  return { id, siteId, ...overrides };
}

function fieldProfile(
  id: string,
  pageProfileId: string,
  overrides: Partial<FieldProfileRecord> = {},
): FieldProfileRecord {
  return { id, pageProfileId, ...overrides };
}

function binding(
  id: string,
  templateId: string,
  pageProfileId: string,
  fieldProfileId: string,
): BindingRecord {
  return { id, templateId, pageProfileId, fieldProfileId, createdAt: "x", usageCount: 0, revision: 0};
}

function managementSnapshot(
  origins: ActivationManagementSnapshot["origins"],
): ActivationManagementSnapshot {
  return { global: "active", origins };
}

describe("buildSiteProjections", () => {
  it("is empty for a fresh install", () => {
    expect(buildSiteProjections(emptyState(), managementSnapshot([]))).toEqual([]);
  });

  it("groups subdomains and distinct ports under one registrable Site while keeping origins distinct", () => {
    const activation = managementSnapshot([
      { origin: "https://app.example.com:443", originActivation: "active" },
      { origin: "https://admin.example.com:8443", originActivation: "paused" },
      { origin: "http://example.com:80", originActivation: "active" },
    ]);

    const projections = buildSiteProjections(emptyState(), activation);

    expect(projections).toHaveLength(1);
    const site = projections[0]!;
    expect(site.siteId).toBe("example.com");
    expect(site.origins.map((origin) => origin.origin)).toEqual([
      "http://example.com:80",
      "https://admin.example.com:8443",
      "https://app.example.com:443",
    ]);
    expect(site.authorized).toBe(true);
  });

  it("keeps unrelated public-suffix Sites separate", () => {
    const activation = managementSnapshot([
      { origin: "https://example.com:443", originActivation: "active" },
      { origin: "https://example.co.uk:443", originActivation: "active" },
    ]);

    const projections = buildSiteProjections(emptyState(), activation);

    expect(projections.map((site) => site.siteId).sort()).toEqual(["example.co.uk", "example.com"]);
  });

  it("does not surface historical Site Data with no granted permission", () => {
    const state: FillNestState = {
      ...emptyState(),
      sites: [{ id: "example.test" }],
      pageProfiles: [pageProfile("page-1", "example.test")],
    };

    const projections = buildSiteProjections(state, managementSnapshot([]));

    expect(projections).toEqual([]);
  });

  it("hides a bare Site record once it has neither access nor saved data", () => {
    const state: FillNestState = {
      ...emptyState(),
      sites: [{ id: "stale.test" }],
    };
    expect(buildSiteProjections(state, managementSnapshot([]))).toEqual([]);
  });

  it("surfaces an authorized Site with no FillNest data yet", () => {
    const activation = managementSnapshot([{ origin: "https://fresh.test:443", originActivation: "active" }]);

    const projections = buildSiteProjections(emptyState(), activation);

    expect(projections).toHaveLength(1);
    const site = projections[0]!;
    expect(site.siteId).toBe("fresh.test");
    expect(site.authorized).toBe(true);
  });

  it("does not surface Site Affinity alone without Website Access", () => {
    // Malformed/legacy-shaped case: a Template's Site Affinity references a
    // Site with no SiteRecord and no Page Profile at all.
    const state: FillNestState = {
      ...emptyState(),
      templates: [template("t1", { siteAffinities: ["orphan.test"] })],
    };

    const projections = buildSiteProjections(state, managementSnapshot([]));

    expect(projections).toEqual([]);
  });

  it("ignores a granted origin it cannot parse as a URL instead of throwing", () => {
    const activation = managementSnapshot([{ origin: "not-a-url", originActivation: "active" }]);

    expect(buildSiteProjections(emptyState(), activation)).toEqual([]);
  });

  it("sorts Sites alphabetically", () => {
    const activation = managementSnapshot([
      { origin: "https://zeta.test:443", originActivation: "active" },
      { origin: "https://alpha.test:443", originActivation: "active" },
    ]);

    const projections = buildSiteProjections(emptyState(), activation);

    expect(projections.map((site) => site.siteId)).toEqual(["alpha.test", "zeta.test"]);
  });
});

describe("countTemplatesForSite", () => {
  it("counts each Template once when it has the Site Affinity, including multi-affinity Templates", () => {
    const templates = [
      template("global", { siteAffinities: [] }),
      template("site-only", { siteAffinities: ["example.test"] }),
      template("shared", { siteAffinities: ["example.test", "other.test"] }),
      template("unrelated", { siteAffinities: ["other.test"] }),
    ];

    expect(countTemplatesForSite(templates, "example.test")).toBe(2);
    expect(countTemplatesForSite(templates, "other.test")).toBe(2);
  });
});

describe("computeResetSiteMappingsImpact", () => {
  it("counts only the target Site's Page Profiles, Field Profiles, Bindings, and aliases", () => {
    const state: FillNestState = {
      ...emptyState(),
      templates: [template("t1", { siteAffinities: ["example.test"] })],
      pageProfiles: [
        pageProfile("page-1", "example.test", { userAlias: "My page" }),
        pageProfile("page-2", "other.test"),
      ],
      fieldProfiles: [
        fieldProfile("field-1", "page-1", { userAlias: "Email" }),
        fieldProfile("field-2", "page-2"),
      ],
      bindings: [binding("b1", "t1", "page-1", "field-1"), binding("b2", "t1", "page-2", "field-2")],
    };

    const impact = computeResetSiteMappingsImpact(state, "example.test");

    expect(impact).toEqual({
      siteId: "example.test",
      pageProfileCount: 1,
      fieldProfileCount: 1,
      bindingCount: 1,
      pageAliasCount: 1,
      fieldAliasCount: 1,
      templateAffinityCount: 1,
      logicalPageRuleCount: 0,
      sharedTemplateSetCount: 0,
    });
  });

  it("is all zero for a Site with no data", () => {
    expect(computeResetSiteMappingsImpact(emptyState(), "empty.test")).toEqual({
      siteId: "empty.test",
      pageProfileCount: 0,
      fieldProfileCount: 0,
      bindingCount: 0,
      pageAliasCount: 0,
      fieldAliasCount: 0,
      templateAffinityCount: 0,
      logicalPageRuleCount: 0,
      sharedTemplateSetCount: 0,
    });
  });
});
