import {
  buildFieldIdentityKey,
  hashRouteSegments,
  isRecordIdentifierShape,
  RECORD_ACTION_SEGMENTS,
  stableSegmentHash,
  type FieldRecognitionMetadata,
} from "./recognition-evidence";

export const LOGICAL_PAGE_SIMILARITY_THRESHOLD = 0.85;

export interface LogicalPageEvidence {
  origin: string;
  routePattern: string | null;
  fieldFeatures: ReadonlySet<string>;
  groupedFieldFeatures: ReadonlySet<string>;
  fieldIdentityKey: string | null;
}

export type SiteKey = CryptoKey | string;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const SAFE_STATIC_SEGMENT = /^[a-z][a-z_.-]*$/u;

/**
 * The route family an address belongs to, used to decide which stored
 * Observations are even comparable.
 *
 * ## Task 014 Addendum C (2026-09-09)
 *
 * `:number` and `:uuid` are **frozen**. A confirmed Logical Page Rule stores
 * this string, and a rule is matched by exact equality, so re-spelling either
 * token would silently break every rule a user has already confirmed. New
 * identifier shapes therefore get their own `:id` token rather than being
 * folded into the existing two.
 *
 * It also no longer returns `null` for an address it cannot classify. Doing so
 * meant the whole Logical Page mechanism - the product's answer to "same page,
 * different address" - could not run at all on any site whose identifiers were
 * not integers or v1-v5 UUIDs, which is most of them.
 */
export function buildRoutePattern(pageUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(pageUrl);
  } catch {
    return null;
  }
  // Includes a route-shaped fragment, for the same reason the identity key
  // does - see `hashRouteSegments`.
  const segments = [...url.pathname.split("/"), ...hashRouteSegments(url.hash)].filter(Boolean);
  const normalized: string[] = [];
  for (const [index, rawSegment] of segments.entries()) {
    let segment: string;
    let original: string;
    try {
      original = decodeURIComponent(rawSegment);
      segment = original.toLowerCase();
    } catch {
      normalized.push(`seg-v1:${stableSegmentHash(rawSegment.toLowerCase())}`);
      continue;
    }
    const next = segments[index + 1]?.toLowerCase() ?? "";
    if (/^\d+$/u.test(segment)) normalized.push(":number");
    else if (UUID_PATTERN.test(segment)) normalized.push(":uuid");
    // Task 014 Addendum E: passed as written, because the rule for random
    // letter case reads it - lower-casing here would lose that rule.
    else if (isRecordIdentifierShape(original)) normalized.push(":id");
    // A readable slug immediately before an action word is a record name, so
    // "/customers/morgan-reed/edit" and "/customers/alex-kim/edit" are one
    // route family rather than two unrelated addresses.
    else if (index > 0 && RECORD_ACTION_SEGMENTS.has(next) && SAFE_STATIC_SEGMENT.test(segment)) {
      normalized.push(":id");
    } else if (SAFE_STATIC_SEGMENT.test(segment)) normalized.push(segment);
    else normalized.push(`seg-v1:${stableSegmentHash(segment)}`);
  }
  return `/${normalized.join("/")}`;
}

/** The tokens a stored Rule may carry that stand for "any value here". */
const ROUTE_WILDCARDS: ReadonlySet<string> = new Set([":number", ":uuid", ":id", ":record"]);

/**
 * Whether a stored Rule's route pattern covers the address being looked at.
 *
 * Task 014 Addendum C Slice 2. Rules used to be matched by exact string
 * equality, which is why a Rule could only ever generalize over the one
 * position the address itself already spelled as `:number` or `:uuid`. Matching
 * segment-wise, with the Rule's wildcards standing for any value, lets a Rule
 * generalize over a position the address builder had to leave literal - a
 * record-name slug, or a segment it could only hash.
 *
 * This is a superset of the old behaviour: two identical patterns still match,
 * so every Rule a user has already confirmed keeps working unchanged.
 */
export function routePatternMatches(rulePattern: string, addressPattern: string): boolean {
  const ruleSegments = rulePattern.split("/");
  const addressSegments = addressPattern.split("/");
  if (ruleSegments.length !== addressSegments.length) return false;
  return ruleSegments.every(
    (segment, index) => segment === addressSegments[index] || ROUTE_WILDCARDS.has(segment),
  );
}

/**
 * The route family two addresses share, or `null` when they are not comparable.
 *
 * Two addresses are the same family when they have the same shape and differ in
 * at most one position - which is exactly what `:number` and `:uuid` already
 * expressed, generalized to a position the address builder could not name. The
 * differing position becomes `:id`, and that generalized pattern is what a
 * confirmation stores.
 *
 * The floor that keeps this from meaning nothing is at least one shared
 * **literal** segment. Shared wildcards do not count: `/orders/:number` and
 * `/customers/:number` have a position in common that matches anything, which
 * is not structure - they are an order and a customer, and comparing them is
 * exactly the mistake this floor exists to prevent. Without any floor at all,
 * `/contact` and `/about` would be one family on the strength of having nothing
 * in common.
 *
 * Nothing here decides that two pages are the same. It decides only that they
 * are close enough to be *compared* - the field-set similarity thresholds and
 * the user's own confirmation still stand between this and any match.
 */
export function routeFamily(left: string, right: string): string | null {
  if (left === right) return left;
  const leftSegments = left.split("/");
  const rightSegments = right.split("/");
  if (leftSegments.length !== rightSegments.length) return null;

  let differing = -1;
  for (const [index, segment] of leftSegments.entries()) {
    if (segment === rightSegments[index]) continue;
    if (differing !== -1) return null;
    differing = index;
  }
  if (differing === -1) return left;
  // `split` on a leading "/" yields an empty first segment shared by every
  // address, and a wildcard matches anything - neither is structure.
  const sharedLiterals = leftSegments.filter(
    (segment, index) => index !== differing && segment !== "" && !ROUTE_WILDCARDS.has(segment),
  ).length;
  if (sharedLiterals === 0) return null;
  return leftSegments.map((segment, index) => (index === differing ? ":id" : segment)).join("/");
}


export async function createSiteKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: "HMAC", hash: "SHA-256" },
    true,
    ["sign", "verify"],
  );
}

export async function keyedHash(siteKey: SiteKey, normalizedText: string): Promise<string> {
  const key = typeof siteKey === "string"
    ? await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(siteKey),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      )
    : siteKey;
  const normalized = normalizedText.trim().toLowerCase().replace(/\s+/gu, " ");
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(normalized));
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

export function jaccardSimilarity(left: ReadonlySet<string>, right: ReadonlySet<string>): number {
  const union = new Set([...left, ...right]);
  if (union.size === 0) return 1;
  return [...left].filter((value) => right.has(value)).length / union.size;
}

/**
 * A candidate matches only when both the Field semantic-feature set and the
 * group-qualified Field semantic-feature set independently meet the accepted
 * Jaccard similarity threshold. Route equality or either threshold alone is
 * insufficient (Task 014 Accepted Contract).
 */
export function matchesBothSimilarityThresholds(
  evidence: Pick<LogicalPageEvidence, "fieldFeatures" | "groupedFieldFeatures">,
  candidateFieldFeatureHashes: ReadonlySet<string>,
  candidateGroupedFieldFeatureHashes: ReadonlySet<string>,
): boolean {
  return (
    jaccardSimilarity(evidence.fieldFeatures, candidateFieldFeatureHashes) >=
      LOGICAL_PAGE_SIMILARITY_THRESHOLD &&
    jaccardSimilarity(evidence.groupedFieldFeatures, candidateGroupedFieldFeatureHashes) >=
      LOGICAL_PAGE_SIMILARITY_THRESHOLD
  );
}

export async function buildLogicalPageEvidence(
  pageUrl: string,
  targetMetadata: FieldRecognitionMetadata,
  pageFields: ReadonlyArray<FieldRecognitionMetadata>,
  siteKey: SiteKey,
): Promise<LogicalPageEvidence> {
  const url = new URL(pageUrl);
  const fieldFeatures = new Set<string>();
  const groupedFieldFeatures = new Set<string>();
  for (const field of pageFields) {
    const features = semanticFeatures(field);
    for (const feature of features) {
      fieldFeatures.add(await keyedHash(siteKey, feature));
      const group = field.groupText?.trim().toLowerCase().replace(/\s+/gu, " ") ?? "";
      groupedFieldFeatures.add(await keyedHash(siteKey, group ? `${group} ${feature}` : feature));
    }
  }
  return {
    origin: url.origin,
    routePattern: buildRoutePattern(pageUrl),
    fieldFeatures,
    groupedFieldFeatures,
    fieldIdentityKey: buildFieldIdentityKey(targetMetadata),
  };
}

function semanticFeatures(metadata: FieldRecognitionMetadata): string[] {
  const features = [
    `tag:${metadata.tagName.toLowerCase()}`,
    `type:${metadata.effectiveType.toLowerCase()}`,
    `autocomplete:${metadata.autocomplete.toLowerCase()}`,
  ];
  for (const value of [metadata.name, metadata.id, metadata.ariaLabel, metadata.label]) {
    const normalized = value.trim().toLowerCase().replace(/\s+/gu, " ");
    if (normalized && normalized.length <= 80 && !/\d/u.test(normalized)) features.push(`text:${normalized}`);
  }
  return features;
}
