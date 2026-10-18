import {
  asSupportedField,
  fieldFormElement,
  fieldLabelText,
  fieldObservedTitle,
  FIELD_CANDIDATE_SELECTOR,
  isNativeField,
  readLabelMetadataText,
  readSafeMetadata,
  type SupportedField,
} from "../fields/dom-field";
import { richTextFieldName } from "../fields/field-eligibility";
import {
  buildFieldIdentityKey,
  buildPageIdentityKey,
  classifySemanticKind,
  type FieldRecognitionMetadata,
} from "./recognition-evidence";
import {
  buildLogicalPageEvidence,
  type LogicalPageEvidence,
  type SiteKey,
} from "./logical-page-matching";

export interface DomRecognitionEvidence {
  pageIdentityKey: string | null;
  fieldIdentityKey: string | null;
  // A numeric DOM position is safe metadata: it contains no field value,
  // label, selector, or URL path. It lets management views preserve the
  // order users see on the page instead of reordering after an alias rename.
  documentOrder: number | null;
  observedTitle: string | null;
}

/**
 * Every eligible Field on the page, in document order.
 *
 * Task 036 split the count that feeds a structural identity key in two. A
 * native control's `supportedFieldCount` still counts native controls only:
 * folding Rich Text Fields into it would change the stored key of every
 * unlabelled `<input>` that happens to share a page with a composer, and a
 * changed key is a lost Binding. A Rich Text Field counts Rich Text Fields for
 * the same purpose.
 */
/**
 * The page's eligible Fields, with each one's metadata and base identity key,
 * computed once.
 *
 * Task 035 R7, second measurement. `readDomRecognitionEvidence` enumerates the
 * whole page and builds a key for every peer, which is fine once and quadratic
 * when a caller does it per Field - and three callers do: the lifecycle
 * reconciliation, the Picker's page-candidate list, and the Finder's
 * highlight. Measured on a page of 200 Fields under 500 churn batches, that
 * cost 686ms against the page's own 13ms. Sharing one snapshot across a pass
 * makes the same answer cost O(n) instead of O(n squared).
 */
export interface PageFieldSnapshot {
  readonly fields: readonly SupportedField[];
  readonly metadata: ReadonlyMap<SupportedField, FieldRecognitionMetadata>;
  readonly baseKeys: ReadonlyMap<SupportedField, string | null>;
}

export function snapshotPageFields(root: ParentNode = document): PageFieldSnapshot {
  const fields = eligibleFields(root);
  const metadata = new Map<SupportedField, FieldRecognitionMetadata>();
  const baseKeys = new Map<SupportedField, string | null>();
  for (const field of fields) {
    const candidateMetadata = readRecognitionMetadata(field);
    metadata.set(field, candidateMetadata);
    baseKeys.set(field, buildFieldIdentityKey(candidateMetadata));
  }
  return { fields, metadata, baseKeys };
}

export function eligibleFields(root: ParentNode = document): SupportedField[] {
  return [...root.querySelectorAll(FIELD_CANDIDATE_SELECTOR)]
    .map((element) => asSupportedField(element))
    .filter((candidate): candidate is SupportedField => candidate !== null)
    .filter((candidate) => isNativeField(candidate) || isRendered(candidate));
}

/**
 * Whether this editing host is actually on the page.
 *
 * Task 036 Addendum A.2. A chat application keeps editors mounted that the
 * user cannot see - the conversation being animated out, a hidden second
 * composer - and counting them moved every other Field's ordinal. Applied to
 * Rich Text Fields only: a native control's enumeration has to stay exactly
 * what it was, or every stored structural key moves with it.
 */
function isRendered(field: SupportedField): boolean {
  const bounds = field.getBoundingClientRect();
  if (bounds.width === 0 && bounds.height === 0) return false;
  return field.checkVisibility?.({ checkOpacity: false, checkVisibilityCSS: true }) ?? true;
}

function peerFields(field: SupportedField, all: readonly SupportedField[]): SupportedField[] {
  return all.filter((candidate) => isNativeField(candidate) === isNativeField(field));
}

export function readDomRecognitionEvidence(
  field: SupportedField,
  snapshot: PageFieldSnapshot = snapshotPageFields(),
): DomRecognitionEvidence {
  const metadata = snapshot.metadata.get(field) ?? readRecognitionMetadata(field);
  const candidateKey = snapshot.baseKeys.get(field) ?? buildFieldIdentityKey(metadata);
  if (!candidateKey) {
    return { pageIdentityKey: buildPageIdentityKey(location.href), fieldIdentityKey: null, documentOrder: null, observedTitle: null };
  }

  const allFields = snapshot.fields;
  const supportedFields = peerFields(field, allFields);

  const baseKeys = supportedFields.map((candidate) => snapshot.baseKeys.get(candidate) ?? null);
  const equivalentFieldCount = baseKeys.filter((key) => key === candidateKey).length;
  // `findIndex` would give every duplicate field the first field's ordinal.
  // Count only matching predecessors so two otherwise identical, unlabelled
  // text controls retain distinct exact structural identities.
  const fieldIndex = supportedFields.indexOf(field);
  const equivalentFieldIndex = baseKeys
    .slice(0, fieldIndex)
    .filter((key) => key === candidateKey).length;

  return {
    pageIdentityKey: buildPageIdentityKey(location.href),
    fieldIdentityKey: buildFieldIdentityKey({
      ...metadata,
      supportedFieldCount: supportedFields.length,
      equivalentFieldCount,
      equivalentFieldIndex,
    }),
    documentOrder: allFields.indexOf(field),
    observedTitle: fieldObservedTitle(field),
  };
}

/**
 * Whether this Field carries the semantic evidence a DOM replacement needs
 * before it may recover an existing relationship.
 *
 * Task 016 Addendum E. An accessible name satisfies the condition for an
 * element that has no generic semantic kind. The rule was written for ordinary
 * forms, where a word like "email" supplies the kind; a composer labelled
 * "Write your prompt" maps to no generic category, so under the original rule
 * every SPA re-render broke its Binding. The other two conditions - unchanged
 * logical Page identity and an exactly equal fingerprint - are untouched, and
 * the fingerprint already carries the ancestor chain and the ordinal.
 */
export function hasGenericSemanticKind(
  field: SupportedField,
  snapshot?: PageFieldSnapshot,
): boolean {
  const metadata = snapshot?.metadata.get(field) ?? readRecognitionMetadata(field);
  if (classifySemanticKind(metadata).length > 0) return true;
  return (metadata.accessibleName ?? "").trim().length > 0;
}

/**
 * Computes local, opaque Logical Page evidence from eligible controls only.
 * The helper never reads `field.value`; raw metadata is used only in memory by
 * the HMAC builder and is not returned or persisted here.
 */
export async function readLogicalPageEvidence(
  field: SupportedField,
  siteKey: SiteKey,
  pageUrl: string = location.href,
): Promise<LogicalPageEvidence> {
  const supportedFields = eligibleFields();
  const metadata = supportedFields.map((candidate) => readRecognitionMetadata(candidate));
  const targetIndex = supportedFields.indexOf(field);
  if (targetIndex < 0) throw new Error("Logical Page evidence requires an eligible connected field.");

  const targetMetadata = metadata[targetIndex];
  if (!targetMetadata) throw new Error("Logical Page target metadata is unavailable.");
  const targetBaseKey = buildFieldIdentityKey(targetMetadata);
  const equivalentFieldCount = metadata.filter((candidate) => buildFieldIdentityKey(candidate) === targetBaseKey).length;
  const equivalentFieldIndex = metadata
    .slice(0, targetIndex)
    .filter((candidate) => buildFieldIdentityKey(candidate) === targetBaseKey).length;

  return buildLogicalPageEvidence(
    pageUrl,
    {
      ...targetMetadata,
      // Peers only, for the reason `eligibleFields` gives: this count feeds a
      // structural identity key, and a native control's key must not change
      // because a composer shares its page.
      supportedFieldCount: peerFields(field, supportedFields).length,
      equivalentFieldCount,
      equivalentFieldIndex,
    },
    metadata,
    siteKey,
  );
}

function readRecognitionMetadata(field: SupportedField): FieldRecognitionMetadata {
  const safe = readSafeMetadata(field);
  return {
    tagName: safe.tagName,
    effectiveType: safe.effectiveType,
    name: safe.name,
    id: safe.id,
    autocomplete: safe.autocomplete,
    ariaLabel: safe.ariaLabel,
    label: fieldLabelText(field),
    // Task 036 Addendum D. A host with no accessible name is keyed on its
    // placeholder rather than falling through to the ancestor chain, which
    // Addendum A established an SPA re-parents. Empty for every native control,
    // so no existing key changes shape.
    accessibleName: richTextFieldName(safe),
    formName: readFormName(field),
    ancestorTags: ancestorTags(field),
    supportedFieldCount: 1,
    equivalentFieldCount: 1,
    equivalentFieldIndex: 0,
    groupText: readGroupText(field),
  };
}

function readFormName(field: SupportedField): string {
  const form = fieldFormElement(field);
  return form?.getAttribute("name") ?? form?.getAttribute("aria-label") ?? form?.id ?? "";
}

function readGroupText(field: SupportedField): string {
  const fieldset = field.closest("fieldset");
  const group = fieldset ?? field.closest('[role="group"], [role="radiogroup"]');
  if (!group) return "";

  // Task 039 Addendum A: a group's name is read as a label is, never taking
  // in the text of a control inside it.
  const labelledBy = group.getAttribute("aria-labelledby");
  if (labelledBy) {
    const text = labelledBy
      .split(/\s+/u)
      .map((id) => readLabelMetadataText(document.getElementById(id), field))
      .join(" ")
      .trim();
    if (text) return text.slice(0, 250);
  }
  const ariaLabel = group.getAttribute("aria-label")?.trim();
  if (ariaLabel) return ariaLabel.slice(0, 250);
  if (fieldset) return readLabelMetadataText(fieldset.querySelector("legend"), field).trim().slice(0, 250);
  return "";
}

function ancestorTags(field: SupportedField): string[] {
  const tags: string[] = [];
  let ancestor = field.parentElement;
  while (ancestor && ancestor !== document.body && tags.length < 4) {
    tags.push(ancestor.tagName.toLowerCase());
    ancestor = ancestor.parentElement;
  }
  return tags.reverse();
}
