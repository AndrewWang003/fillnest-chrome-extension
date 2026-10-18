import { describe, expect, it } from "vitest";

import { computeSiteAffinityBadge } from "../../src/templates/template-site-badge";
import type { BindingRecord, PageProfileRecord } from "../../src/storage/fillnest-repository";

function page(id: string, siteId: string): PageProfileRecord {
  return { id, siteId };
}

function binding(
  id: string,
  templateId: string,
  pageProfileId: string,
  usageCount: number,
): BindingRecord {
  return {
    id,
    templateId,
    pageProfileId,
    fieldProfileId: `field-for-${pageProfileId}`,
    createdAt: "2026-08-01T00:00:00.000Z",
    usageCount,
    revision: 0,
  };
}

describe("computeSiteAffinityBadge", () => {
  it("returns null for a Template with no Site Affinity", () => {
    expect(computeSiteAffinityBadge({ id: "t1", siteAffinities: [] }, [], [])).toBeNull();
  });

  it("returns a visible badge for a Template with exactly one Site Affinity", () => {
    expect(computeSiteAffinityBadge({ id: "t1", siteAffinities: ["indeed.com"] }, [], [])).toEqual({
      primarySite: "indeed.com",
      otherCount: 0,
    });
  });

  it("picks the Site with the highest aggregate usage as primary", () => {
    const pageProfiles = [page("p1", "indeed.com"), page("p2", "linkedin.com")];
    const bindings = [
      binding("b1", "t1", "p1", 3),
      binding("b2", "t1", "p2", 9),
    ];
    const badge = computeSiteAffinityBadge(
      { id: "t1", siteAffinities: ["indeed.com", "linkedin.com"] },
      bindings,
      pageProfiles,
    );
    expect(badge).toEqual({ primarySite: "linkedin.com", otherCount: 1 });
  });

  it("sums usage across multiple Bindings on the same Site", () => {
    const pageProfiles = [page("p1", "indeed.com"), page("p2", "indeed.com"), page("p3", "linkedin.com")];
    const bindings = [
      binding("b1", "t1", "p1", 2),
      binding("b2", "t1", "p2", 2),
      binding("b3", "t1", "p3", 3),
    ];
    const badge = computeSiteAffinityBadge(
      { id: "t1", siteAffinities: ["indeed.com", "linkedin.com"] },
      bindings,
      pageProfiles,
    );
    // indeed.com: 2 + 2 = 4, beats linkedin.com's 3.
    expect(badge?.primarySite).toBe("indeed.com");
  });

  it("breaks ties alphabetically when usage is equal", () => {
    const pageProfiles = [page("p1", "zeta.test"), page("p2", "alpha.test")];
    const bindings = [binding("b1", "t1", "p1", 5), binding("b2", "t1", "p2", 5)];
    const badge = computeSiteAffinityBadge(
      { id: "t1", siteAffinities: ["zeta.test", "alpha.test"] },
      bindings,
      pageProfiles,
    );
    expect(badge?.primarySite).toBe("alpha.test");
  });

  it("treats a Site with zero live Bindings as zero usage, not excluded from consideration", () => {
    // Site Affinity survives Unbind (PROJECT.md), so a Site can be affiliated
    // with no live Binding at all - it must still be a valid (if unlikely)
    // primary-site candidate, not silently dropped.
    const pageProfiles = [page("p1", "indeed.com")];
    const bindings = [binding("b1", "t1", "p1", 1)];
    const badge = computeSiteAffinityBadge(
      { id: "t1", siteAffinities: ["indeed.com", "unbound-everywhere.test"] },
      bindings,
      pageProfiles,
    );
    expect(badge).toEqual({ primarySite: "indeed.com", otherCount: 1 });
  });

  it("reports otherCount as every affiliated Site besides the primary, for three or more Sites", () => {
    const pageProfiles = [page("p1", "a.test"), page("p2", "b.test"), page("p3", "c.test")];
    const bindings = [
      binding("b1", "t1", "p1", 1),
      binding("b2", "t1", "p2", 5),
      binding("b3", "t1", "p3", 1),
    ];
    const badge = computeSiteAffinityBadge(
      { id: "t1", siteAffinities: ["a.test", "b.test", "c.test"] },
      bindings,
      pageProfiles,
    );
    expect(badge).toEqual({ primarySite: "b.test", otherCount: 2 });
  });

  it("ignores Bindings belonging to a different Template", () => {
    const pageProfiles = [page("p1", "indeed.com"), page("p2", "linkedin.com")];
    const bindings = [
      binding("b1", "t1", "p1", 1),
      binding("b2", "other-template", "p2", 100),
    ];
    const badge = computeSiteAffinityBadge(
      { id: "t1", siteAffinities: ["indeed.com", "linkedin.com"] },
      bindings,
      pageProfiles,
    );
    expect(badge?.primarySite).toBe("indeed.com");
  });
});
