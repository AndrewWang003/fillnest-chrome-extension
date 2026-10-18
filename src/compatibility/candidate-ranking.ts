import {
  compatibilityKindsMatch,
  isReliableCrossSiteKind,
  RICH_TEXT_COMPATIBILITY_TOKEN,
  type CompatibilityKind,
} from "./compatibility-kind";

/**
 * Local, generic evidence about one discoverable Field (Task 024's "Find
 * similar field" pool: a Field with a non-empty effective Template list).
 * Every field here is caller-supplied - this module never reads a webpage,
 * touches stored records, or performs I/O of any kind.
 */
export interface CompatibilityFieldEvidence {
  readonly fieldProfileId: string;
  readonly siteId: string;
  readonly kind: CompatibilityKind;
  /** Total usage across the Field's effective Template list (direct or Shared). */
  readonly usageCount: number;
  readonly updatedAt: string;
  readonly createdAt: string;
  /** System Display Label - used only for the final ordering tiebreak, never for matching. */
  readonly displayLabel: string;
}

/**
 * A user's explicit decision on one candidate Field pair. Only "no" is
 * modeled here: Confirm creates the relationship through the ordinary Link
 * command (a separate concern), and a plain Dismiss is transient UI state
 * that does not change future ranking, per the Confirmed Contract.
 */
export interface CompatibilityPairDecision {
  readonly fieldProfileIdA: string;
  readonly fieldProfileIdB: string;
  readonly decision: "no";
}

export interface CompatibilityCandidateResult {
  readonly fieldProfileId: string;
  readonly crossSite: boolean;
  /** Exact generic-kind match with the source Field. */
  readonly evidenceMatch: boolean;
  /** Match strong enough to ever become an automatic suggestion, before the "No"/uniqueness rules. */
  readonly highConfidence: boolean;
  /** A user has explicitly recorded "No" for this exact pair. */
  readonly decided: boolean;
}

function isPairDecided(
  a: string,
  b: string,
  decisions: readonly CompatibilityPairDecision[],
): boolean {
  return decisions.some(
    (decision) =>
      (decision.fieldProfileIdA === a && decision.fieldProfileIdB === b) ||
      (decision.fieldProfileIdA === b && decision.fieldProfileIdB === a),
  );
}

function mostRecentTimestamp(evidence: CompatibilityFieldEvidence): string {
  return evidence.updatedAt > evidence.createdAt ? evidence.updatedAt : evidence.createdAt;
}

/**
 * Ranks every pool Field against one source Field. Deterministic order:
 * evidence match first, then usage count (descending), then most recent of
 * update/creation time (descending), then System Display Label
 * (alphabetical), then opaque FieldProfile ID - the exact order the
 * Confirmed Contract specifies, with no new counters or timestamps.
 *
 * A "No"-decided pair is still ranked (Search/Browse may still surface it on
 * explicit user intent) but is marked `decided` so callers building the
 * automatic-offer list can exclude it - see `selectAutomaticSuggestion`.
 */
export function rankCandidates(
  source: CompatibilityFieldEvidence,
  pool: readonly CompatibilityFieldEvidence[],
  decisions: readonly CompatibilityPairDecision[] = [],
): CompatibilityCandidateResult[] {
  const scored = pool
    .filter((candidate) => candidate.fieldProfileId !== source.fieldProfileId)
    .map((candidate) => {
      const crossSite = candidate.siteId !== source.siteId;
      const evidenceMatch = compatibilityKindsMatch(source.kind, candidate.kind);
      const highConfidence =
        evidenceMatch && (!crossSite || isReliableCrossSiteKind(candidate.kind));
      const decided = isPairDecided(source.fieldProfileId, candidate.fieldProfileId, decisions);
      return { candidate, crossSite, evidenceMatch, highConfidence, decided };
    });

  scored.sort((left, right) => {
    if (left.evidenceMatch !== right.evidenceMatch) return left.evidenceMatch ? -1 : 1;
    if (left.candidate.usageCount !== right.candidate.usageCount) {
      return right.candidate.usageCount - left.candidate.usageCount;
    }
    const leftRecent = mostRecentTimestamp(left.candidate);
    const rightRecent = mostRecentTimestamp(right.candidate);
    if (leftRecent !== rightRecent) return leftRecent > rightRecent ? -1 : 1;
    const labelOrder = left.candidate.displayLabel.localeCompare(right.candidate.displayLabel);
    if (labelOrder !== 0) return labelOrder;
    return left.candidate.fieldProfileId < right.candidate.fieldProfileId ? -1 : 1;
  });

  return scored.map(({ candidate, crossSite, evidenceMatch, highConfidence, decided }) => ({
    fieldProfileId: candidate.fieldProfileId,
    crossSite,
    evidenceMatch,
    highConfidence,
    decided,
  }));
}

/**
 * Automatic Suggested results appear only when there is exactly one
 * high-confidence, non-"No"-decided candidate; insufficient or tied evidence
 * yields no automatic offer (explicit Search/Browse remain available).
 */
export function selectAutomaticSuggestion(
  ranked: readonly CompatibilityCandidateResult[],
): string | null {
  const eligible = ranked.filter((candidate) => candidate.highConfidence && !candidate.decided);
  return eligible.length === 1 ? eligible[0]!.fieldProfileId : null;
}

/** What the group rule needs to know about one Field beyond its ranking. */
export interface GroupSuggestionFacts {
  readonly kind: CompatibilityKind;
  readonly belongsToSet: boolean;
}

/**
 * Task 024 Addendum C. Every high-confidence candidate offered at once, when
 * they are all rich-text editing hosts and none of them is shared yet.
 *
 * The "exactly one candidate" rule above is right for the ambiguity it was
 * written for: two `email` Fields are two candidates for *one* answer, and
 * choosing between them would be an invention. Three composers are not a
 * choice - the user wants all of them, and linking is not exclusive - so
 * offering the set is the same single question asked once rather than a guess.
 *
 * Bounded to Fields that belong to no Set yet, and that is about Undo, not
 * timidity: a Set-less group is one `CREATE_SHARED_TEMPLATE_SET` with one
 * exact Undo, where a group spanning existing Sets would be a sequence of adds
 * and merges with a half-undoable middle.
 *
 * Returns the candidates in ranked order, or an empty array when the group
 * rule does not apply - in which case the single-candidate rule above still
 * does.
 */
export function selectAutomaticGroupSuggestion(
  source: GroupSuggestionFacts,
  ranked: readonly CompatibilityCandidateResult[],
  facts: ReadonlyMap<string, GroupSuggestionFacts>,
): string[] {
  if (!isGroupable(source)) return [];
  const eligible = ranked.filter((candidate) => candidate.highConfidence && !candidate.decided);
  // One candidate is the ordinary offer, not a group.
  if (eligible.length < 2) return [];
  const groupable = eligible.every((candidate) => {
    const candidateFacts = facts.get(candidate.fieldProfileId);
    return candidateFacts !== undefined && isGroupable(candidateFacts);
  });
  return groupable ? eligible.map((candidate) => candidate.fieldProfileId) : [];
}

function isGroupable(facts: GroupSuggestionFacts): boolean {
  if (facts.belongsToSet) return false;
  return facts.kind.kind === "other" && facts.kind.token === RICH_TEXT_COMPATIBILITY_TOKEN;
}
