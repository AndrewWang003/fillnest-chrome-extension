/**
 * Task 024 (Compatibility Candidate Suggestions) requires that candidate
 * rules "must not depend on a named Site, record URL, field label, selector,
 * schema, or business vocabulary from a target website." The existing
 * `classifySemanticKind` (src/recognition/recognition-evidence.ts) inspects
 * `label`/`ariaLabel`/`name`/`id`, which are exactly that forbidden
 * site-authored vocabulary - it is reused for Field *identity*, a separate
 * concern this Task must not redefine. This classifier instead looks only at
 * two generic, standards-defined HTML vocabularies: the `autocomplete` token
 * (a fixed W3C enumeration) and the effective input `type` - neither is
 * chosen by a particular site's author the way a label or `name`/`id` is.
 *
 * Task 024 Addendum B adds a third, of the same nature: whether the control is
 * a rich-text editing host. That is a structural fact about the element, in
 * the same family as `type="email"`, and it arrives through `effectiveType`.
 * No label, `name`, `id` or accessible name participates.
 */

import { RICH_TEXT_EFFECTIVE_TYPE } from "../fields/field-eligibility";

/** The `other` token a rich-text editing host carries - Task 024 Addendum B. */
export const RICH_TEXT_COMPATIBILITY_TOKEN = "rich-text";

export interface GenericFieldTypeEvidence {
  readonly effectiveType: string;
  readonly autocomplete: string;
}

export type CompatibilityKind =
  | { readonly kind: "email" }
  | { readonly kind: "tel" }
  | { readonly kind: "name-given" }
  | { readonly kind: "name-family" }
  | { readonly kind: "name-full" }
  | { readonly kind: "address-line1" }
  | { readonly kind: "address-line2" }
  | { readonly kind: "address-level1" }
  | { readonly kind: "address-level2" }
  | { readonly kind: "postal-code" }
  | { readonly kind: "country" }
  // A structural signature outside the reliable set above - same-Site only,
  // per the Confirmed Contract's "Complex or weakly canonical Fields" rule.
  | { readonly kind: "other"; readonly token: string }
  // No generic, non-label evidence at all - never an automatic candidate.
  | { readonly kind: "unclassified" };

const RELIABLE_CROSS_SITE_KINDS: ReadonlySet<CompatibilityKind["kind"]> = new Set([
  "email",
  "tel",
  "name-given",
  "name-family",
  "name-full",
  "address-line1",
  "address-line2",
  "address-level1",
  "address-level2",
  "postal-code",
  "country",
]);

const AUTOCOMPLETE_KIND_MAP: Readonly<Record<string, CompatibilityKind>> = {
  email: { kind: "email" },
  "given-name": { kind: "name-given" },
  "family-name": { kind: "name-family" },
  name: { kind: "name-full" },
  "address-line1": { kind: "address-line1" },
  "address-line2": { kind: "address-line2" },
  "address-level1": { kind: "address-level1" },
  "address-level2": { kind: "address-level2" },
  "postal-code": { kind: "postal-code" },
  country: { kind: "country" },
  "country-name": { kind: "country" },
};

export function classifyCompatibilityKind(evidence: GenericFieldTypeEvidence): CompatibilityKind {
  const autocomplete = evidence.autocomplete.trim().toLowerCase();
  const type = evidence.effectiveType.trim().toLowerCase();

  // Task 024 Addendum B. Ahead of the `autocomplete` map on purpose. A
  // composer commonly carries `autocomplete="off"` - ChatGPT's does - and the
  // `other` branch would otherwise take that literally and match the composer
  // with every unrelated control on the site that also opts out of autofill.
  // "Rich text editing host" is the meaningful structural signature here; an
  // autofill hint on a prose editor is not one at all.
  if (type === RICH_TEXT_EFFECTIVE_TYPE) {
    return { kind: "other", token: RICH_TEXT_COMPATIBILITY_TOKEN };
  }

  const mapped = AUTOCOMPLETE_KIND_MAP[autocomplete];
  if (mapped) return mapped;
  if (/^(?:tel|cc-number)$/u.test(type)) return { kind: "tel" };
  if (/^tel(?:-|$)/u.test(autocomplete)) return { kind: "tel" };
  if (type === "email") return { kind: "email" };

  if (autocomplete.length > 0) return { kind: "other", token: autocomplete };
  return { kind: "unclassified" };
}

/** Whether two Fields' generic evidence points at the exact same meaning. */
export function compatibilityKindsMatch(a: CompatibilityKind, b: CompatibilityKind): boolean {
  if (a.kind === "unclassified" || b.kind === "unclassified") return false;
  if (a.kind === "other" || b.kind === "other") {
    return a.kind === "other" && b.kind === "other" && a.token === b.token;
  }
  return a.kind === b.kind;
}

/**
 * Only Name (with its full/given/family variants distinguished), Email,
 * Phone, and Address (with its components distinguished) may ever produce an
 * automatic suggestion across Sites - every other kind, including a same-token
 * "other" match, is same-Site only.
 */
export function isReliableCrossSiteKind(kind: CompatibilityKind): boolean {
  return RELIABLE_CROSS_SITE_KINDS.has(kind.kind);
}
