import { describe, expect, it } from "vitest";

import {
  rankCandidates,
  selectAutomaticGroupSuggestion,
  selectAutomaticSuggestion,
  type CompatibilityFieldEvidence,
  type CompatibilityPairDecision,
  type GroupSuggestionFacts,
} from "../../src/compatibility/candidate-ranking";
import { RICH_TEXT_COMPATIBILITY_TOKEN, type CompatibilityKind } from "../../src/compatibility/compatibility-kind";

/**
 * Task 024 Addendum C. Every high-confidence candidate offered at once, when
 * they are all rich-text editing hosts and none of them is shared yet.
 */
const richText: CompatibilityKind = { kind: "other", token: RICH_TEXT_COMPATIBILITY_TOKEN };
const email: CompatibilityKind = { kind: "email" };

describe("selectAutomaticGroupSuggestion", () => {
  it("offers every rich-text candidate at once, in ranked order", () => {
    const { ranked, facts } = pool(richText, [
      { id: "chat", kind: richText },
      { id: "cowork", kind: richText },
    ]);
    expect(selectAutomaticGroupSuggestion(source(richText), ranked, facts)).toEqual(["chat", "cowork"]);
  });

  it("leaves one candidate to the ordinary single-candidate rule", () => {
    const { ranked, facts } = pool(richText, [{ id: "chat", kind: richText }]);
    expect(selectAutomaticGroupSuggestion(source(richText), ranked, facts)).toEqual([]);
    // Which still fires, so the user is not left with nothing.
    expect(selectAutomaticSuggestion(ranked)).toBe("chat");
  });

  it("refuses a group when any candidate is not a rich-text host", () => {
    // The ambiguity the original rule guards: two candidates for one answer.
    const { ranked, facts } = pool(email, [
      { id: "billing-email", kind: email },
      { id: "contact-email", kind: email },
    ]);
    expect(selectAutomaticGroupSuggestion(source(email), ranked, facts)).toEqual([]);
    expect(selectAutomaticSuggestion(ranked)).toBeNull();
  });

  it("refuses a group when any Field already belongs to a Set, so the link stays one undoable mutation", () => {
    const { ranked, facts } = pool(richText, [
      { id: "chat", kind: richText },
      { id: "cowork", kind: richText, belongsToSet: true },
    ]);
    expect(selectAutomaticGroupSuggestion(source(richText), ranked, facts)).toEqual([]);
  });

  it("refuses a group when the current Field is already shared", () => {
    const { ranked, facts } = pool(richText, [
      { id: "chat", kind: richText },
      { id: "cowork", kind: richText },
    ]);
    expect(selectAutomaticGroupSuggestion(source(richText, true), ranked, facts)).toEqual([]);
  });

  it("leaves a declined pair out, and offers nothing once too few remain", () => {
    const decisions: CompatibilityPairDecision[] = [
      { fieldProfileIdA: "current", fieldProfileIdB: "cowork", decision: "no" },
    ];
    const { ranked, facts } = pool(
      richText,
      [
        { id: "chat", kind: richText },
        { id: "cowork", kind: richText },
      ],
      decisions,
    );
    // One survivor is not a group; the single-candidate rule takes it instead.
    expect(selectAutomaticGroupSuggestion(source(richText), ranked, facts)).toEqual([]);
    expect(selectAutomaticSuggestion(ranked)).toBe("chat");
  });

  it("never groups across Sites, because `other` is same-Site only", () => {
    const { ranked, facts } = pool(richText, [
      { id: "chat", kind: richText, siteId: "elsewhere.test" },
      { id: "cowork", kind: richText, siteId: "elsewhere.test" },
    ]);
    expect(selectAutomaticGroupSuggestion(source(richText), ranked, facts)).toEqual([]);
  });
});

function source(kind: CompatibilityKind, belongsToSet = false): GroupSuggestionFacts {
  return { kind, belongsToSet };
}

function pool(
  sourceKind: CompatibilityKind,
  entries: Array<{ id: string; kind: CompatibilityKind; belongsToSet?: boolean; siteId?: string }>,
  decisions: CompatibilityPairDecision[] = [],
) {
  const evidence = (id: string, kind: CompatibilityKind, siteId: string): CompatibilityFieldEvidence => ({
    fieldProfileId: id,
    siteId,
    kind,
    usageCount: 1,
    updatedAt: "2026-09-09T00:00:00.000Z",
    createdAt: "2026-09-09T00:00:00.000Z",
    displayLabel: id,
  });
  const ranked = rankCandidates(
    evidence("current", sourceKind, "example.test"),
    entries.map((entry) => evidence(entry.id, entry.kind, entry.siteId ?? "example.test")),
    decisions,
  );
  const facts = new Map<string, GroupSuggestionFacts>(
    entries.map((entry) => [entry.id, { kind: entry.kind, belongsToSet: entry.belongsToSet ?? false }]),
  );
  return { ranked, facts };
}
