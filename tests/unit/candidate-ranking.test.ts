import { describe, expect, it } from "vitest";

import {
  rankCandidates,
  selectAutomaticSuggestion,
  type CompatibilityFieldEvidence,
  type CompatibilityPairDecision,
} from "../../src/compatibility/candidate-ranking";
import type { CompatibilityKind } from "../../src/compatibility/compatibility-kind";

function evidence(overrides: Partial<CompatibilityFieldEvidence> & { fieldProfileId: string }): CompatibilityFieldEvidence {
  return {
    siteId: "example.test",
    kind: { kind: "email" },
    usageCount: 0,
    updatedAt: "2026-01-01T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    displayLabel: overrides.fieldProfileId,
    ...overrides,
  };
}

const EMAIL: CompatibilityKind = { kind: "email" };
const NAME_GIVEN: CompatibilityKind = { kind: "name-given" };
const NAME_FAMILY: CompatibilityKind = { kind: "name-family" };
const ORGANIZATION: CompatibilityKind = { kind: "other", token: "organization" };
const UNCLASSIFIED: CompatibilityKind = { kind: "unclassified" };

describe("rankCandidates", () => {
  it("[positive] ranks an exact same-Site kind match above an unrelated kind", () => {
    const source = evidence({ fieldProfileId: "source", kind: EMAIL });
    const pool = [
      evidence({ fieldProfileId: "match", kind: EMAIL }),
      evidence({ fieldProfileId: "no-match", kind: NAME_GIVEN }),
    ];
    const ranked = rankCandidates(source, pool);
    expect(ranked.map((candidate) => candidate.fieldProfileId)).toEqual(["match", "no-match"]);
    expect(ranked[0]).toMatchObject({ evidenceMatch: true, highConfidence: true, crossSite: false });
    expect(ranked[1]).toMatchObject({ evidenceMatch: false, highConfidence: false });
  });

  it("[negative] never matches two different Name variants against each other", () => {
    const source = evidence({ fieldProfileId: "source", kind: NAME_GIVEN });
    const pool = [evidence({ fieldProfileId: "family", kind: NAME_FAMILY })];
    const ranked = rankCandidates(source, pool);
    expect(ranked[0]).toMatchObject({ evidenceMatch: false, highConfidence: false });
  });

  it("[positive] a same-Site 'other'-kind match is high confidence", () => {
    const source = evidence({ fieldProfileId: "source", siteId: "a.test", kind: ORGANIZATION });
    const pool = [evidence({ fieldProfileId: "candidate", siteId: "a.test", kind: ORGANIZATION })];
    const ranked = rankCandidates(source, pool);
    expect(ranked[0]).toMatchObject({ evidenceMatch: true, highConfidence: true, crossSite: false });
  });

  it("[negative] a cross-Site 'other'-kind match is never high confidence, even with identical tokens", () => {
    const source = evidence({ fieldProfileId: "source", siteId: "a.test", kind: ORGANIZATION });
    const pool = [evidence({ fieldProfileId: "candidate", siteId: "b.test", kind: ORGANIZATION })];
    const ranked = rankCandidates(source, pool);
    expect(ranked[0]).toMatchObject({ evidenceMatch: true, highConfidence: false, crossSite: true });
  });

  it("[positive] a cross-Site reliable-kind match (Email/Phone/Name/Address) is high confidence", () => {
    const source = evidence({ fieldProfileId: "source", siteId: "a.test", kind: EMAIL });
    const pool = [evidence({ fieldProfileId: "candidate", siteId: "b.test", kind: EMAIL })];
    const ranked = rankCandidates(source, pool);
    expect(ranked[0]).toMatchObject({ evidenceMatch: true, highConfidence: true, crossSite: true });
  });

  it("[negative] unclassified evidence never matches, even against another unclassified Field", () => {
    const source = evidence({ fieldProfileId: "source", kind: UNCLASSIFIED });
    const pool = [evidence({ fieldProfileId: "candidate", kind: UNCLASSIFIED })];
    const ranked = rankCandidates(source, pool);
    expect(ranked[0]).toMatchObject({ evidenceMatch: false, highConfidence: false });
  });

  it("excludes the source Field itself from its own candidate pool", () => {
    const source = evidence({ fieldProfileId: "source", kind: EMAIL });
    const ranked = rankCandidates(source, [source]);
    expect(ranked).toHaveLength(0);
  });

  it("orders tied-evidence candidates by usage count, then recency, then label, then FieldProfile ID", () => {
    const source = evidence({ fieldProfileId: "source", kind: EMAIL });
    const pool = [
      evidence({ fieldProfileId: "z-low-usage", kind: EMAIL, usageCount: 1, displayLabel: "Z" }),
      evidence({ fieldProfileId: "a-high-usage", kind: EMAIL, usageCount: 9, displayLabel: "A" }),
      evidence({ fieldProfileId: "b-same-usage-newer", kind: EMAIL, usageCount: 1, updatedAt: "2026-06-01T00:00:00.000Z", displayLabel: "Z" }),
    ];
    const ranked = rankCandidates(source, pool);
    // Highest usage first...
    expect(ranked[0]!.fieldProfileId).toBe("a-high-usage");
    // ...then, among tied usage, the more recently updated one...
    expect(ranked[1]!.fieldProfileId).toBe("b-same-usage-newer");
    expect(ranked[2]!.fieldProfileId).toBe("z-low-usage");
  });

  it("breaks a full tie (usage, recency, label) by opaque FieldProfile ID ascending", () => {
    const source = evidence({ fieldProfileId: "source", kind: EMAIL });
    const pool = [
      evidence({ fieldProfileId: "field-b", kind: EMAIL, displayLabel: "Same" }),
      evidence({ fieldProfileId: "field-a", kind: EMAIL, displayLabel: "Same" }),
    ];
    const ranked = rankCandidates(source, pool);
    expect(ranked.map((candidate) => candidate.fieldProfileId)).toEqual(["field-a", "field-b"]);
  });

  it("marks a pair with an explicit 'No' decision as decided, in either stored order", () => {
    const source = evidence({ fieldProfileId: "source", kind: EMAIL });
    const pool = [evidence({ fieldProfileId: "candidate", kind: EMAIL })];
    const decisions: CompatibilityPairDecision[] = [
      { fieldProfileIdA: "candidate", fieldProfileIdB: "source", decision: "no" },
    ];
    const ranked = rankCandidates(source, pool, decisions);
    expect(ranked[0]).toMatchObject({ highConfidence: true, decided: true });
  });

  it("still ranks a 'No'-decided pair (Search/Browse remain available on explicit intent)", () => {
    const source = evidence({ fieldProfileId: "source", kind: EMAIL });
    const pool = [evidence({ fieldProfileId: "candidate", kind: EMAIL })];
    const decisions: CompatibilityPairDecision[] = [
      { fieldProfileIdA: "source", fieldProfileIdB: "candidate", decision: "no" },
    ];
    const ranked = rankCandidates(source, pool, decisions);
    expect(ranked).toHaveLength(1);
  });
});

describe("selectAutomaticSuggestion", () => {
  it("[positive] offers the single high-confidence, undecided candidate", () => {
    const source = evidence({ fieldProfileId: "source", kind: EMAIL });
    const pool = [evidence({ fieldProfileId: "candidate", kind: EMAIL })];
    const suggestion = selectAutomaticSuggestion(rankCandidates(source, pool));
    expect(suggestion).toBe("candidate");
  });

  it("[negative] offers nothing when zero candidates are high confidence", () => {
    const source = evidence({ fieldProfileId: "source", kind: EMAIL });
    const pool = [evidence({ fieldProfileId: "candidate", kind: NAME_GIVEN })];
    expect(selectAutomaticSuggestion(rankCandidates(source, pool))).toBeNull();
  });

  it("[negative] offers nothing on a tie between two equally high-confidence candidates", () => {
    const source = evidence({ fieldProfileId: "source", kind: EMAIL });
    const pool = [
      evidence({ fieldProfileId: "candidate-a", kind: EMAIL }),
      evidence({ fieldProfileId: "candidate-b", kind: EMAIL }),
    ];
    expect(selectAutomaticSuggestion(rankCandidates(source, pool))).toBeNull();
  });

  it("[negative] a 'No'-decided pair is never automatically offered, even as the sole match", () => {
    const source = evidence({ fieldProfileId: "source", kind: EMAIL });
    const pool = [evidence({ fieldProfileId: "candidate", kind: EMAIL })];
    const decisions: CompatibilityPairDecision[] = [
      { fieldProfileIdA: "source", fieldProfileIdB: "candidate", decision: "no" },
    ];
    expect(selectAutomaticSuggestion(rankCandidates(source, pool, decisions))).toBeNull();
  });

  it("[negative] a same-Site complex ('other') match becomes automatic only same-Site, never cross-Site", () => {
    const source = evidence({ fieldProfileId: "source", siteId: "a.test", kind: ORGANIZATION });
    const crossSitePool = [evidence({ fieldProfileId: "candidate", siteId: "b.test", kind: ORGANIZATION })];
    expect(selectAutomaticSuggestion(rankCandidates(source, crossSitePool))).toBeNull();

    const sameSitePool = [evidence({ fieldProfileId: "candidate", siteId: "a.test", kind: ORGANIZATION })];
    expect(selectAutomaticSuggestion(rankCandidates(source, sameSitePool))).toBe("candidate");
  });

  it("[positive] a cross-Site reliable-kind match is automatic when it is the sole high-confidence candidate", () => {
    const source = evidence({ fieldProfileId: "source", siteId: "a.test", kind: EMAIL });
    const pool = [
      evidence({ fieldProfileId: "cross-site-match", siteId: "b.test", kind: EMAIL }),
      evidence({ fieldProfileId: "unrelated", siteId: "b.test", kind: NAME_GIVEN }),
    ];
    expect(selectAutomaticSuggestion(rankCandidates(source, pool))).toBe("cross-site-match");
  });
});
