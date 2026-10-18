import { RICH_TEXT_EFFECTIVE_TYPE } from "../fields/field-eligibility";

export interface FieldRecognitionMetadata {
  tagName: string;
  effectiveType: string;
  name: string;
  id: string;
  autocomplete: string;
  ariaLabel: string;
  label: string;
  formName: string;
  ancestorTags: string[];
  supportedFieldCount: number;
  equivalentFieldCount: number;
  equivalentFieldIndex: number;
  groupText?: string;
  /**
   * Task 036. The Rich Text Field's accessible name. Absent for every native
   * control, so no existing identity key changes shape.
   */
  accessibleName?: string;
}

/**
 * Task 014 Addendum E. camelCase or PascalCase: every capital after the first
 * character starts a run of lower-case letters or digits.
 */
const WORD_SHAPED_MIXED_CASE = /^[A-Za-z][a-z0-9]*(?:[A-Z][a-z0-9]+)*$/u;
/**
 * Task 014 Addendum E. Random base62 averages under two letters per lower-case
 * run; readable mixed-case segments, acronyms included, average four or more.
 * Measured over two million random 21-character ids and a set of readable
 * segments: it misses about one id in a hundred, and takes no readable segment
 * as a record.
 */
const RANDOM_CASE_MAX_MEAN_LOWER_RUN = 3;

const STABLE_ROUTE_QUERY_KEYS = new Set([
  "action",
  "mode",
  "section",
  "tab",
  "view",
]);
const STABLE_ROUTE_QUERY_VALUES = new Set([
  "contact",
  "create",
  "details",
  "edit",
  "grid",
  "list",
  "new",
  "notes",
  "profile",
  "view",
]);
const RECORD_QUERY_KEYS = new Set(["customer", "id", "name", "record"]);
/**
 * Action words that make the segment before them a record name rather than a
 * route. Kept deliberately short: these are the CRUD verbs that appear as their
 * own path segment, not a general vocabulary.
 */
export const RECORD_ACTION_SEGMENTS: ReadonlySet<string> = new Set(["details", "edit", "profile", "view"]);
/**
 * Query keys whose value changes on every visit. Including them would give the
 * same page a different identity each time it is opened.
 */
const SAFE_QUERY_KEY = /^[a-z][a-z0-9_-]{0,30}$/u;
const VOLATILE_QUERY_KEY_PATTERN =
  /^(?:_|cb|cache|nocache|rand|random|sid|session|sessionid|t|ts|time|timestamp|token|v|ver|version)$/u;
/**
 * Parameters that say where a visitor came from, or what their app build is,
 * rather than which page they are on.
 *
 * Task 014 Addendum D (2026-09-09). The list was too short to survive a real
 * arrival. The owner reached ChatGPT from a search advertisement, so the
 * new-conversation page's address carried fifteen parameters - `utm_*`,
 * `gad_source`, `gbraid`, `gclid` and an eight-member `c_*` campaign family.
 * Every one of them was hashed into the Page identity, so the page the user
 * bound a Template on and the plain `/` they returned to were two Page
 * Profiles, and the Template was never offered again.
 *
 * Everything here is a documented advertising, analytics or app-version
 * parameter. Anything merely unfamiliar still counts towards identity, because
 * `?entity=customers` and `?entity=invoices` are genuinely two pages.
 */
const APPLE_CAMPAIGN_QUERY_KEYS: ReadonlySet<string> = new Set(["pt", "mt", "ct"]);
const TRACKING_QUERY_KEY_PATTERN =
  /^(?:utm_[a-z0-9_]+|gad_[a-z0-9_]+|mc_[a-z0-9_]+|[a-z0-9]+-min-version|gclid|gclsrc|dclid|gbraid|wbraid|fbclid|msclkid|ttclid|twclid|yclid|igshid|epik|rdt_cid|li_fat_id|s_kwcid|_ga|_gl|campaign_id|campaignid|ad_id|adid|adgroup_id|adgroupid|creative_id|keyword_id|is_sa|c_id|c_agid|c_crid|c_kwid|c_ims|c_pms|c_nw|c_dvc)$/u;
const STABLE_EMBEDDED_RECORD_SUFFIXES = new Set([
  "details",
  "edit",
  "overview",
  "profile",
  "settings",
  "view",
]);
const STABLE_EMBEDDED_RECORD_PREFIXES = new Set([
  "case",
  "customer",
  "invoice",
  "order",
  "record",
  "ticket",
]);

/**
 * A stable identity for "which page is this", derived from the address alone.
 *
 * ## Task 014 Addendum C (2026-09-09): it no longer gives up
 *
 * This used to return `null` for any address it could not fully classify - an
 * unfamiliar identifier shape, an unknown query key, a record-name slug. That
 * looked conservative and was in fact the product's largest defect:
 * `resolveFieldContext` treats a `null` key as "brand new page", so it minted a
 * fresh Page and Field Profile **on every visit, including a reload of the
 * identical URL**. On those sites a saved Template was orphaned the moment the
 * user came back, and the Logical Page recovery could not help because it was
 * gated on the same classification.
 *
 * So the rule is now: **every address gets an identity.** A segment that cannot
 * be classified is hashed rather than rejected - the technique this file
 * already used for numbered document filenames, and for the same reason: the
 * key stays stable and opaque, and no readable text reaches storage.
 *
 * ## Migration safety
 *
 * The change is strictly additive. Every address that produced a key before
 * produces the **byte-identical** key now; only addresses that produced `null`
 * gained one. A stored Page Profile is found by exact key match, so anything
 * else would silently orphan Bindings that already exist.
 * `recognition-evidence.test.ts` pins that with a corpus.
 */
export function buildPageIdentityKey(pageUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(pageUrl);
  } catch {
    return null;
  }
  const segments = [...url.pathname.split("/"), ...hashRouteSegments(url.hash)].filter(Boolean);
  const path: string[] = [];
  let hasRecordEvidence = false;
  for (const [index, segment] of segments.entries()) {
    const next = segments[index + 1]?.toLowerCase() ?? "";
    let normalized = normalizePathSegment(segment);
    // A readable slug immediately before an action word is a record name:
    // "/customers/morgan-reed/edit" is the same page as
    // "/customers/alex-kim/edit", which is the whole point of the product.
    // This used to reject the entire address instead, so those sites got no
    // memory at all. `:record` also stores strictly less than the rejection
    // did - it keeps no readable text whatsoever.
    if (
      normalized === segment.toLowerCase() &&
      index > 0 &&
      RECORD_ACTION_SEGMENTS.has(next)
    ) {
      normalized = ":record";
    }
    if (normalized.includes(":record")) hasRecordEvidence = true;
    path.push(normalized);
  }
  const outerQueryParts = normalizeQueryParts(url.searchParams, hasRecordEvidence);
  const hashQueryParts = normalizeQueryParts(hashRouteSearchParams(url.hash), hasRecordEvidence);
  const outerQuery = outerQueryParts.length > 0 ? `?${outerQueryParts.join("&")}` : "";
  // `#?` cannot be emitted by an outer query key: unsafe keys are hashed
  // before they reach the identity. This frames the fragment query source
  // without changing any key that has no hash-route query (Task 039 C2).
  const hashQuery = hashQueryParts.length > 0 ? `#?${hashQueryParts.join("&")}` : "";
  const query = `${outerQuery}${hashQuery}`;
  if (segments.length > 2 && !hasRecordEvidence) {
    return `opaque-path-v1:${fnv1a64(`/${path.join("/")}${query}`)}`;
  }
  return `/${path.join("/")}${query}`;
}

function normalizeQueryParts(
  searchParams: URLSearchParams,
  hasRecordEvidence: boolean,
): string[] {
  const queryParts: string[] = [];
  const queryKeys = new Set([...searchParams.keys()].map((key) => key.toLowerCase()));
  const appleCampaignTriple = [...APPLE_CAMPAIGN_QUERY_KEYS].every((key) => queryKeys.has(key));
  for (const key of [...new Set(searchParams.keys())].sort()) {
    const normalizedKey = key.toLowerCase();
    // Campaign parameters change where a visitor came from, not which page
    // they are using. Keeping them would make an otherwise static page
    // unrecognizable and orphan a user-confirmed Binding on the next focus.
    if (TRACKING_QUERY_KEY_PATTERN.test(normalizedKey)) continue;
    // Apple's App Analytics campaign triple. Individually `pt`, `mt` and `ct`
    // are two-letter keys an application could mean anything by, so they are
    // dropped only when all three appear together - which is the shape of the
    // campaign link itself, and is how Gemini's advertised address arrives.
    if (appleCampaignTriple && APPLE_CAMPAIGN_QUERY_KEYS.has(normalizedKey)) continue;
    // Per-visit noise: a session token or cache-buster is not part of the
    // page's identity and would fragment it into one Profile per visit.
    if (VOLATILE_QUERY_KEY_PATTERN.test(normalizedKey)) continue;
    if (RECORD_QUERY_KEYS.has(normalizedKey) && hasRecordEvidence) continue;
    queryParts.push(normalizeQueryPart(key, searchParams.getAll(key)));
  }
  return queryParts;
}

/**
 * The segments of a fragment used as a route.
 *
 * Task 014 Addendum C: `location.pathname` excludes the fragment, so every
 * page of a hash-routed application - the older Angular and Vue convention,
 * and still common in internal tools - collapsed onto one identity.
 * `/app#/customers/12` and `/app#/settings` were the same Page Profile, which
 * is the one place this file **over**-matched rather than under-matched.
 *
 * Only a fragment that is shaped like a route (`#/...`) is taken. A plain
 * `#section` anchor is a position within one page, not a different page, and
 * including it would split one page's identity per anchor.
 */
export function hashRouteSegments(hash: string): string[] {
  if (!hash.startsWith("#/")) return [];
  const [routePath] = hash.slice(1).split("?");
  return (routePath ?? "").split("/");
}

/**
 * Query state inside a route-shaped fragment. Kept separate from the outer
 * URL query so the two locations cannot collapse onto one Page identity.
 */
function hashRouteSearchParams(hash: string): URLSearchParams {
  if (!hash.startsWith("#/")) return new URLSearchParams();
  const queryStart = hash.indexOf("?");
  return queryStart === -1 ? new URLSearchParams() : new URLSearchParams(hash.slice(queryStart + 1));
}

/** Shared with the route-pattern builder so the two cannot classify differently. */
export function stableSegmentHash(value: string): string {
  return fnv1a64(value);
}

function fnv1a64(value: string): string {
  let hash = 0xcbf29ce484222325n;
  for (const char of value) {
    hash ^= BigInt(char.codePointAt(0) ?? 0);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, "0");
}

/**
 * A query parameter's contribution to the identity.
 *
 * A short, readable value from a known route key stays readable, which keeps
 * the common `?tab=profile` case inspectable. Everything else is hashed rather
 * than rejected: an unknown key or an unfamiliar value is still part of *which*
 * page this is - `?entity=customers` and `?entity=invoices` are two different
 * pages - and rejecting them used to cost the address its identity entirely.
 * Hashing keeps them distinct without storing what they say.
 */
function normalizeQueryPart(key: string, values: string[]): string {
  const normalizedKey = key.toLowerCase();
  const value = values.length === 1 ? (values[0]?.trim().toLowerCase() ?? "") : "";
  if (
    values.length === 1 &&
    STABLE_ROUTE_QUERY_KEYS.has(normalizedKey) &&
    STABLE_ROUTE_QUERY_VALUES.has(value)
  ) {
    return `${normalizedKey}=${value}`;
  }
  const joined = [...values].sort().join("\u0000").trim().toLowerCase();
  // The key stays readable when it is an ordinary identifier: a query key is
  // chosen by whoever built the site ("entity", "post", "tab"), so it says
  // which page this is without saying anything about the person using it. The
  // value is where a person's own data would appear, so it is always hashed
  // unless it is one of the known route words.
  const key_ = SAFE_QUERY_KEY.test(normalizedKey) ? normalizedKey : fnv1a64(normalizedKey);
  return `${key_}=${fnv1a64(joined)}`;
}

export function buildFieldIdentityKey(
  metadata: FieldRecognitionMetadata,
): string | null {
  const name = stableAttribute(metadata.name);
  const id = stableAttribute(metadata.id);
  const autocomplete = stableAttribute(metadata.autocomplete);
  const semanticKind = classifySemanticKind(metadata);
  // Task 036. A Rich Text Field usually has no `name`, `id` or `autocomplete`
  // at all, and its accessible name is the one stable thing about it. Hashed,
  // for the same reason every other semantic evidence is: the key must not
  // carry readable page text. Present only when there is a name to hash, so a
  // native control's key is byte-identical to what it was before this Task.
  const accessibleName = (metadata.accessibleName ?? "").trim().toLowerCase();
  const accessibleNameHash = accessibleName ? `name-v1:${fnv1a64(accessibleName)}` : "";
  const structuralFallback = !name && !id && !autocomplete && !semanticKind && !accessibleNameHash;
  if (
    structuralFallback &&
    (!Number.isInteger(metadata.supportedFieldCount) || metadata.supportedFieldCount < 1)
  ) {
    return null;
  }

  // Task 036 Addendum A. A named Rich Text Field is keyed without its ancestor
  // chain or its form.
  //
  // Found by the owner's hands-on QA: a Template created in ChatGPT's
  // new-conversation composer was gone after visiting a conversation and
  // coming back - still findable by Search, but no longer this Field's. The
  // page is the same Page Profile, so the only thing that can have moved is
  // the Field key, and on an SPA the ancestor chain is exactly what moves: the
  // composer is re-parented as the view rebuilds around it.
  //
  // The accessible name is the identity of a composer; where in the tree the
  // page currently hangs it is not. Two hosts sharing a name on one page are
  // still separated by `ordinal`, which is counted among hosts with this same
  // base key. This applies only to hosts that have a name to key on - an
  // unnamed one keeps the structural key it cannot do better than, which is
  // the same reason it cannot be bound.
  // Task 036 Addendum A.3. A Rich Text Field's key is built only from evidence
  // that does not move, and an accessible name is the *last* resort rather
  // than the first.
  //
  // The owner's third QA pass showed one composer resolving to two Field
  // Profiles that alternated, each carrying its own user-given name and its
  // own Templates. So the label these applications put on their composer is
  // not one value: it changes with the interface's state, and hydration means
  // it is sometimes not there at all yet.
  //
  // Where the page gives a stable attribute - ChatGPT's composer carries
  // `id="prompt-textarea"` - that is the identity, and the label is left out
  // entirely rather than allowed to move the key. The ancestor chain and the
  // ordinal stay out for the reasons Addendum A and A.2 give: an SPA
  // re-parents its editor, and keeps editors mounted that are off screen.
  if (metadata.effectiveType === RICH_TEXT_EFFECTIVE_TYPE && (name || id || autocomplete || accessibleNameHash)) {
    const stableAttributes = Boolean(name || id || autocomplete);
    return JSON.stringify({
      tag: metadata.tagName.toLowerCase(),
      type: metadata.effectiveType.toLowerCase(),
      name,
      id,
      autocomplete,
      // Both of these read the label, so both are omitted when there is
      // something steadier to key on.
      ...(stableAttributes ? {} : { semanticKind, accessibleName: accessibleNameHash }),
    });
  }

  return JSON.stringify({
    tag: metadata.tagName.toLowerCase(),
    type: metadata.effectiveType.toLowerCase(),
    name,
    id,
    autocomplete,
    semanticKind,
    form: stableAttribute(metadata.formName),
    ancestors: metadata.ancestorTags.map((tag) => tag.toLowerCase()),
    ordinal: metadata.equivalentFieldIndex,
    ...(structuralFallback ? { supportedFieldCount: metadata.supportedFieldCount } : {}),
  });
}

/**
 * One path segment's contribution to the identity: a readable static route, a
 * `:record` placeholder, or an opaque hash. Never `null` - see
 * `buildPageIdentityKey`.
 *
 * The `:record` shapes are deliberately high-specificity. Guessing wrong in
 * that direction collapses two genuinely different pages into one, so anything
 * merely *unusual* falls through to the hash, which keeps the address's own
 * identity stable without claiming two addresses are the same page.
 */
function normalizePathSegment(segment: string): string {
  let original: string;
  try {
    original = decodeURIComponent(segment);
  } catch {
    return `seg-v1:${fnv1a64(segment.toLowerCase())}`;
  }
  const decoded = original.toLowerCase();
  if (/^\d+$/u.test(decoded) || isRecordIdentifierShape(original)) return ":record";
  if (/\d/u.test(decoded)) {
    // A numbered document filename (for example "1.1 Initial Information.html")
    // is a common stable route, not a record identifier. Preserve its ability
    // to recognize a user-confirmed Binding after a reload without retaining
    // the readable document title in storage.
    if (isNumberedStaticDocumentFilename(decoded)) {
      return `static-document-v1:${fnv1a64(decoded)}`;
    }
    const embedded = /^([a-z]+)[-_](\d+)[-_]([a-z]+)$/u.exec(decoded);
    if (embedded) {
      const [, prefix, , suffix] = embedded;
      if (
        prefix &&
        suffix &&
        STABLE_EMBEDDED_RECORD_PREFIXES.has(prefix) &&
        STABLE_EMBEDDED_RECORD_SUFFIXES.has(suffix)
      ) {
        return `${prefix}-:record-${suffix}`;
      }
    }
    return `seg-v1:${fnv1a64(decoded)}`;
  }
  // A segment with no digit at all cannot itself be a variable record id, so
  // hyphens/underscores/dots are accepted here (kebab-case routes like
  // "text-box" or "sign-up", or a static file segment like "form.php" -
  // both extremely common on real sites). A record-name *slug* next to
  // "edit"/"view"/"details"/"profile" is turned into `:record` by
  // `buildPageIdentityKey`'s own lookahead, which can see the next segment.
  return /^[a-z][a-z_.-]*$/u.test(decoded) ? decoded : `seg-v1:${fnv1a64(decoded)}`;
}

/**
 * Identifier shapes common enough across real products to be worth collapsing
 * to `:record` without asking. Each is specific enough that a static route is
 * very unlikely to match it.
 *
 * Task 014 Addendum C: before this, only a bare integer and a v1-v5 UUID
 * counted, which excluded UUIDv7 (now the default in several databases), Mongo
 * ObjectIds, Stripe-style prefixed ids, and Jira/Linear issue keys - so those
 * products got no cross-record recognition at all.
 *
 * Takes the decoded segment **as written**, not lower-cased: Addendum E's rule
 * reads letter case. Every other rule lower-cases it first.
 */
export function isRecordIdentifierShape(segment: string): boolean {
  const decoded = segment.toLowerCase();
  // Any UUID version and variant, including the nil UUID. The old rule pinned
  // version 1-5 and variant 8/9/a/b.
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(decoded)) return true;
  // A long hex run: Mongo ObjectId (24), a git sha (40), a hex token.
  if (/^[0-9a-f]{16,}$/u.test(decoded)) return true;
  // A prefixed opaque id: Stripe `cus_NffrFeU...`, Slack `B01ABCD...`.
  if (/^[a-z]{2,10}_[a-z0-9]{8,}$/u.test(decoded) && /\d/u.test(decoded)) return true;
  // An issue key: Jira `PROJ-123`, Linear `ENG-45`.
  if (/^[a-z]{2,10}-\d{1,9}$/u.test(decoded)) return true;
  // A random-looking alphanumeric token: nanoid, base62, Salesforce. Requires
  // letters and digits genuinely mixed - a trailing or leading run of digits is
  // how product names read ("office365", "2fa", "ipv6"), and collapsing those
  // would merge real routes.
  if (
    decoded.length >= 10 &&
    /^[a-z0-9]+$/u.test(decoded) &&
    /[a-z]/u.test(decoded) &&
    (decoded.match(/\d/gu)?.length ?? 0) >= 2 &&
    !/^[a-z]+\d+$/u.test(decoded) &&
    !/^\d+[a-z]+$/u.test(decoded)
  ) {
    return true;
  }
  // Task 014 Addendum E. The rule above needs two digits, and about one
  // base62 id in eight has fewer. A long mixed-case token counts when its
  // letter case is random: it is not camelCase or PascalCase, and its
  // lower-case runs are short. Words - acronyms included - carry long
  // lower-case runs ("SSOConfiguration"); random base62 averages under two.
  if (segment.length >= 16 && /^[A-Za-z0-9]+$/u.test(segment) && /[A-Z]/u.test(segment) && /[a-z]/u.test(segment)) {
    const lowerRuns = segment.match(/[a-z]+/gu) ?? [];
    const meanLowerRun = lowerRuns.reduce((total, run) => total + run.length, 0) / lowerRuns.length;
    if (!WORD_SHAPED_MIXED_CASE.test(segment) && meanLowerRun < RANDOM_CASE_MAX_MEAN_LOWER_RUN) return true;
  }
  return false;
}


function isNumberedStaticDocumentFilename(segment: string): boolean {
  return /^\d+(?:\.\d+)*(?:[ _-]+[a-z][a-z _-]*)?\.(?:html?|php|aspx?|jsp)$/u.test(
    segment,
  );
}

function stableAttribute(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized.length > 80 || /\d/u.test(normalized)) return "";
  return /^[a-z][a-z_-]*$/u.test(normalized) ? normalized : "";
}

export function classifySemanticKind(metadata: FieldRecognitionMetadata): string {
  const evidence = [
    metadata.effectiveType,
    metadata.name,
    metadata.id,
    metadata.autocomplete,
    metadata.ariaLabel,
    metadata.label,
  ]
    .join(" ")
    .toLowerCase();

  if (/\b(?:e-?mail)\b/u.test(evidence)) return "email";
  if (/\b(?:tel|telephone|phone|mobile)\b/u.test(evidence)) return "phone";
  if (/\b(?:url|website|web site)\b/u.test(evidence)) return "website";
  if (/\b(?:postal code|postcode|zip)\b/u.test(evidence)) return "postal-code";
  if (/\b(?:address|street|city|suburb|state|province|country)\b/u.test(evidence)) {
    return "address";
  }
  if (/\b(?:first name|given name)\b/u.test(evidence)) return "first-name";
  if (/\b(?:last name|family name|surname)\b/u.test(evidence)) return "last-name";
  if (/\b(?:full name|contact name|name)\b/u.test(evidence)) return "name";
  return "";
}
