import { isCanonicalSiteIdentity, siteIdentityFromUrl } from "../domain/site";
import { InvalidStoredDataError } from "./invalid-stored-data-error";
import { isPickerPosition, type PickerPosition } from "./picker-position";
import type {
  BindingRecord, CompatibilityPairDecisionRecord, FieldProfileRecord, FillNestState,
  LogicalPageFieldProvenanceRecord, LogicalPageObservationRecord, LogicalPageProvenanceRecord,
  LogicalPageRuleRecord, LogicalPageSiteKeyRecord, PageProfileRecord, SiteRecord, TemplateRecord,
} from "./records";
import { CURRENT_SCHEMA_VERSION } from "./schema-version";
import {
  assertSharedTemplateInvariants,
  validateSharedTemplateBinding,
  validateSharedTemplateFieldState,
  validateSharedTemplateSet,
} from "./shared-templates";
import { isNonEmptyString, isNonNegativeInteger, isRecord } from "./value-guards";

const ENCODED_HMAC_KEY_PATTERN = /^hmac-sha256-v1:[A-Za-z0-9_-]{43,128}$/u;
const HMAC_HASH_PATTERN = /^[a-f0-9]{64}$/u;
/**
 * What a stored Route Pattern may contain.
 *
 * Task 014 Addendum C: `:id` joins `:number` and `:uuid` as a record position,
 * and `seg-v1:<hash>` is admitted for a segment the pattern builder could only
 * hash. Both are additive - every pattern that validated before still does.
 *
 * The point of the shape check is unchanged: a Route Pattern is a normalized
 * structure, never raw address text, so anything readable beyond a lowercase
 * static segment is rejected as corrupt data.
 */
const LOGICAL_ROUTE_SEGMENT = String.raw`(?:[a-z][a-z_.-]*|:number|:uuid|:id|seg-v1:[0-9a-f]{16})`;
const LOGICAL_ROUTE_PATTERN = new RegExp(
  String.raw`^\/${LOGICAL_ROUTE_SEGMENT}(?:\/${LOGICAL_ROUTE_SEGMENT})*$`,
  "u",
);

/**
 * The canonical stored-state integrity gate (Task 006), and every per-record
 * validator behind it.
 *
 * Task 032 moved these out of `fillnest-repository.ts`. Nothing reaches storage
 * without passing through here - which is why three audits' worth of defects in
 * the sharing subsystem surfaced as rejected operations rather than corrupted
 * stores. A gate that load-bearing deserves to be readable on its own, rather
 * than sitting at the end of the module that holds every command.
 */

export function validateCandidateState(value: unknown): FillNestState {
  if (
    !isRecord(value) ||
    value.schemaVersion !== CURRENT_SCHEMA_VERSION ||
    !Array.isArray(value.templates)
  ) {
    throw new InvalidStoredDataError();
  }

  const state: FillNestState = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    sites: readArray(value.sites, validateSite),
    templates: value.templates.map(validateTemplate),
    pageProfiles: readArray(value.pageProfiles, validatePageProfile),
    fieldProfiles: readArray(value.fieldProfiles, validateFieldProfile),
    bindings: readArray(value.bindings, validateBinding),
    logicalPageSiteKeys: readRequiredArray(value.logicalPageSiteKeys, validateLogicalPageSiteKey),
    logicalPageRules: readRequiredArray(value.logicalPageRules, validateLogicalPageRule),
    logicalPageProvenance: readRequiredArray(value.logicalPageProvenance, validateLogicalPageProvenance),
    logicalPageObservations: readRequiredArray(value.logicalPageObservations, validateLogicalPageObservation),
    sharedTemplateSets: readRequiredArray(value.sharedTemplateSets, validateSharedTemplateSet),
    sharedTemplateBindings: readRequiredArray(value.sharedTemplateBindings, validateSharedTemplateBinding),
    sharedTemplateFieldStates: readRequiredArray(value.sharedTemplateFieldStates, validateSharedTemplateFieldState),
    compatibilityPairDecisions: readRequiredArray(value.compatibilityPairDecisions, validateCompatibilityPairDecision),
    pickerPosition: validatePickerPositionField(value.pickerPosition),
    pageStatusPosition: validatePickerPositionField(value.pageStatusPosition),
  };
  validateCandidateInvariants(state);
  return state;
}

export function validateCandidateInvariants(state: FillNestState): void {
  // 1. ID uniqueness within each collection
  const templateIds = new Set(state.templates.map((t) => t.id));
  if (templateIds.size !== state.templates.length) throw new InvalidStoredDataError();

  const siteIds = new Set(state.sites.map((s) => s.id));
  if (siteIds.size !== state.sites.length) throw new InvalidStoredDataError();
  if (state.sites.some((site) => !isCanonicalSiteIdentity(site.id))) throw new InvalidStoredDataError();

  const pageIds = new Set(state.pageProfiles.map((p) => p.id));
  if (pageIds.size !== state.pageProfiles.length) throw new InvalidStoredDataError();

  const fieldIds = new Set(state.fieldProfiles.map((f) => f.id));
  if (fieldIds.size !== state.fieldProfiles.length) throw new InvalidStoredDataError();

  const bindingIds = new Set(state.bindings.map((b) => b.id));
  if (bindingIds.size !== state.bindings.length) throw new InvalidStoredDataError();

  const logicalPageSiteKeyIds = new Set(state.logicalPageSiteKeys.map((key) => key.id));
  if (logicalPageSiteKeyIds.size !== state.logicalPageSiteKeys.length) throw new InvalidStoredDataError();
  const logicalPageKeySites = new Set(state.logicalPageSiteKeys.map((key) => key.siteId));
  if (logicalPageKeySites.size !== state.logicalPageSiteKeys.length) throw new InvalidStoredDataError();

  const logicalPageRuleIds = new Set(state.logicalPageRules.map((rule) => rule.id));
  if (logicalPageRuleIds.size !== state.logicalPageRules.length) throw new InvalidStoredDataError();

  const logicalPageProvenanceIds = new Set(state.logicalPageProvenance.map((entry) => entry.id));
  if (logicalPageProvenanceIds.size !== state.logicalPageProvenance.length) throw new InvalidStoredDataError();
  const logicalPageObservationIds = new Set(state.logicalPageObservations.map((entry) => entry.id));
  if (logicalPageObservationIds.size !== state.logicalPageObservations.length) throw new InvalidStoredDataError();

  const sharedTemplateSetIds = new Set(state.sharedTemplateSets.map((set) => set.id));
  if (sharedTemplateSetIds.size !== state.sharedTemplateSets.length) throw new InvalidStoredDataError();

  const sharedTemplateBindingIds = new Set(state.sharedTemplateBindings.map((binding) => binding.id));
  if (sharedTemplateBindingIds.size !== state.sharedTemplateBindings.length) throw new InvalidStoredDataError();

  const compatibilityPairDecisionIds = new Set(state.compatibilityPairDecisions.map((decision) => decision.id));
  if (compatibilityPairDecisionIds.size !== state.compatibilityPairDecisions.length) {
    throw new InvalidStoredDataError();
  }
  const compatibilityPairKeys = new Set(
    state.compatibilityPairDecisions.map((decision) => unorderedPairKey(decision.fieldProfileIdA, decision.fieldProfileIdB)),
  );
  if (compatibilityPairKeys.size !== state.compatibilityPairDecisions.length) throw new InvalidStoredDataError();

  // 2. Cross-collection collision check across entities
  const totalEntityCount =
    state.sites.length +
    state.templates.length +
    state.pageProfiles.length +
    state.fieldProfiles.length +
    state.bindings.length +
    state.logicalPageSiteKeys.length +
    state.logicalPageRules.length +
    state.logicalPageProvenance.length +
    state.logicalPageObservations.length +
    state.sharedTemplateSets.length +
    state.sharedTemplateBindings.length +
    state.compatibilityPairDecisions.length;
  const allEntityIds = new Set([
    ...siteIds,
    ...templateIds,
    ...pageIds,
    ...fieldIds,
    ...bindingIds,
    ...logicalPageSiteKeyIds,
    ...logicalPageRuleIds,
    ...logicalPageProvenanceIds,
    ...logicalPageObservationIds,
    ...sharedTemplateSetIds,
    ...sharedTemplateBindingIds,
    ...compatibilityPairDecisionIds,
  ]);
  if (allEntityIds.size !== totalEntityCount) throw new InvalidStoredDataError();

  // 3. Relational integrity
  for (const page of state.pageProfiles) {
    if (!siteIds.has(page.siteId)) throw new InvalidStoredDataError();
  }

  for (const template of state.templates) {
    if (template.siteAffinities.some((siteId) => !siteIds.has(siteId))) {
      throw new InvalidStoredDataError();
    }
  }

  for (const field of state.fieldProfiles) {
    if (!pageIds.has(field.pageProfileId)) throw new InvalidStoredDataError();
  }

  const fields = new Map(state.fieldProfiles.map((profile) => [profile.id, profile] as const));
  const pages = new Map(state.pageProfiles.map((profile) => [profile.id, profile] as const));
  const rules = new Map(state.logicalPageRules.map((rule) => [rule.id, rule] as const));
  const siteKeys = new Map(state.logicalPageSiteKeys.map((key) => [key.id, key] as const));

  for (const key of state.logicalPageSiteKeys) {
    if (!siteIds.has(key.siteId)) throw new InvalidStoredDataError();
  }

  const observedPageIds = new Set<string>();
  for (const observation of state.logicalPageObservations) {
    const page = pages.get(observation.pageProfileId);
    const siteKey = siteKeys.get(observation.siteKeyId);
    if (
      !page ||
      !siteKey ||
      page.siteId !== observation.siteId ||
      siteKey.siteId !== observation.siteId ||
      siteIdentityFromUrl(observation.origin) !== observation.siteId ||
      observedPageIds.has(observation.pageProfileId) ||
      !state.bindings.some((binding) => binding.pageProfileId === observation.pageProfileId)
    ) {
      throw new InvalidStoredDataError();
    }
    observedPageIds.add(observation.pageProfileId);
  }

  for (const rule of state.logicalPageRules) {
    const page = pages.get(rule.pageProfileId);
    const key = siteKeys.get(rule.siteKeyId);
    if (
      !siteIds.has(rule.siteId) ||
      siteIdentityFromUrl(rule.origin) !== rule.siteId ||
      !key ||
      key.siteId !== rule.siteId ||
      !page ||
      page.siteId !== rule.siteId
    ) {
      throw new InvalidStoredDataError();
    }
  }
  const bindingPairs = new Set<string>();
  for (const binding of state.bindings) {
    const field = fields.get(binding.fieldProfileId);
    if (
      !templateIds.has(binding.templateId) ||
      !pageIds.has(binding.pageProfileId) ||
      !field ||
      field.pageProfileId !== binding.pageProfileId
    ) {
      throw new InvalidStoredDataError();
    }

    const pair = `${binding.templateId}:${binding.fieldProfileId}`;
    if (bindingPairs.has(pair)) {
      throw new InvalidStoredDataError();
    }
    bindingPairs.add(pair);

  }

  const provenancePairs = new Set<string>();
  for (const provenance of state.logicalPageProvenance) {
    const rule = rules.get(provenance.ruleId);
    const sourcePage = pages.get(provenance.sourcePageProfileId);
    const canonicalPage = pages.get(provenance.canonicalPageProfileId);
    const provenancePair = `${provenance.ruleId}:${provenance.sourcePageProfileId}`;
    if (
      !rule ||
      provenancePairs.has(provenancePair) ||
      provenance.origin !== rule.origin ||
      provenance.canonicalPageProfileId !== rule.pageProfileId ||
      !sourcePage ||
      !canonicalPage ||
      sourcePage.siteId !== rule.siteId ||
      canonicalPage.siteId !== rule.siteId
    ) {
      throw new InvalidStoredDataError();
    }
    provenancePairs.add(provenancePair);

    const sourceFieldIds = new Set<string>();
    const canonicalFieldIds = new Set<string>();
    for (const mapping of provenance.fieldMappings) {
      const sourceField = fields.get(mapping.sourceFieldProfileId);
      const canonicalField = fields.get(mapping.canonicalFieldProfileId);
      if (
        !sourceField ||
        !canonicalField ||
        sourceField.pageProfileId !== sourcePage.id ||
        canonicalField.pageProfileId !== canonicalPage.id ||
        sourceField.identityKey === undefined ||
        canonicalField.identityKey === undefined ||
        sourceField.identityKey !== canonicalField.identityKey ||
        sourceFieldIds.has(mapping.sourceFieldProfileId) ||
        canonicalFieldIds.has(mapping.canonicalFieldProfileId)
      ) {
        throw new InvalidStoredDataError();
      }
      sourceFieldIds.add(mapping.sourceFieldProfileId);
      canonicalFieldIds.add(mapping.canonicalFieldProfileId);

      // Task 020 Addendum A: `bindingIds` records what was merged at
      // confirmation. It is not a live constraint on the canonical Field,
      // which stays an ordinary Field the user may bind to, unbind from and
      // delete Templates on; tying the two together refused every such action.
      if (new Set(mapping.bindingIds).size !== mapping.bindingIds.length) {
        throw new InvalidStoredDataError();
      }
    }
  }

  // Task 031: every Shared Template Set invariant now lives beside the
  // records it constrains. See assertSharedTemplateInvariants.
  assertSharedTemplateInvariants({
    sharedTemplateSets: state.sharedTemplateSets,
    sharedTemplateBindings: state.sharedTemplateBindings,
    sharedTemplateFieldStates: state.sharedTemplateFieldStates,
    siteIds,
    templateIds,
    fieldPageIds: new Map([...fields].map(([id, field]) => [id, field.pageProfileId])),
    pageIds: new Set(pages.keys()),
  });

  // Task 024: a "No" pair decision references two real, distinct Fields.
  for (const decision of state.compatibilityPairDecisions) {
    if (!fields.has(decision.fieldProfileIdA) || !fields.has(decision.fieldProfileIdB)) {
      throw new InvalidStoredDataError();
    }
  }


}

/** Order-independent key for a Field pair, used to dedupe Compatibility pair decisions. */
export function unorderedPairKey(fieldProfileIdA: string, fieldProfileIdB: string): string {
  return fieldProfileIdA < fieldProfileIdB
    ? `${fieldProfileIdA}:${fieldProfileIdB}`
    : `${fieldProfileIdB}:${fieldProfileIdA}`;
}

function validatePickerPositionField(value: unknown): PickerPosition | null {
  if (value === null || value === undefined) return null;
  if (!isPickerPosition(value)) throw new InvalidStoredDataError();
  return value;
}

export function validateTemplate(value: unknown): TemplateRecord {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    value.id.length === 0 ||
    typeof value.content !== "string" ||
    value.content.trim().length === 0 ||
    !Array.isArray(value.siteAffinities) ||
    !value.siteAffinities.every((site) => typeof site === "string" && site.length > 0) ||
    new Set(value.siteAffinities).size !== value.siteAffinities.length ||
    typeof value.createdAt !== "string" ||
    typeof value.updatedAt !== "string" ||
    !isNonNegativeInteger(value.totalUsageCount) ||
    !isNonNegativeInteger(value.revision)
  ) {
    throw new InvalidStoredDataError();
  }

  return {
    id: value.id,
    content: value.content,
    siteAffinities: [...value.siteAffinities],
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    totalUsageCount: value.totalUsageCount,
    revision: value.revision,
  };
}

function readArray<T>(
  value: unknown,
  validate: (item: unknown) => T,
): T[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new InvalidStoredDataError();
  return value.map(validate);
}

function readRequiredArray<T>(
  value: unknown,
  validate: (item: unknown) => T,
): T[] {
  if (!Array.isArray(value)) throw new InvalidStoredDataError();
  return value.map(validate);
}

export function validateSite(value: unknown): SiteRecord {
  if (!isRecord(value) || typeof value.id !== "string" || value.id.length === 0) {
    throw new InvalidStoredDataError();
  }
  return { id: value.id };
}

export function validatePageProfile(value: unknown): PageProfileRecord {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    value.id.length === 0 ||
    typeof value.siteId !== "string" ||
    value.siteId.length === 0
  ) {
    throw new InvalidStoredDataError();
  }
  if (value.identityKey !== undefined && typeof value.identityKey !== "string") {
    throw new InvalidStoredDataError();
  }
  if (value.userAlias !== undefined && typeof value.userAlias !== "string") {
    throw new InvalidStoredDataError();
  }
  return compactOptionalFields({
    id: value.id,
    siteId: value.siteId,
    identityKey: value.identityKey,
    userAlias: value.userAlias,
  });
}

export function validateFieldProfile(value: unknown): FieldProfileRecord {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    value.id.length === 0 ||
    typeof value.pageProfileId !== "string" ||
    value.pageProfileId.length === 0
  ) {
    throw new InvalidStoredDataError();
  }
  if (value.identityKey !== undefined && typeof value.identityKey !== "string") {
    throw new InvalidStoredDataError();
  }
  if (value.userAlias !== undefined && typeof value.userAlias !== "string") {
    throw new InvalidStoredDataError();
  }
  if (value.documentOrder !== undefined && !isNonNegativeInteger(value.documentOrder)) {
    throw new InvalidStoredDataError();
  }
  if (value.observedTitle !== undefined && (typeof value.observedTitle !== "string" || value.observedTitle.length > 1_000)) {
    throw new InvalidStoredDataError();
  }
  // Task 036. One boolean, and only `true` is ever stored - the absence is the
  // default, so a `false` on disk is normalized away rather than kept.
  if (value.insertionRejected !== undefined && typeof value.insertionRejected !== "boolean") {
    throw new InvalidStoredDataError();
  }
  return compactOptionalFields({
    id: value.id,
    pageProfileId: value.pageProfileId,
    identityKey: value.identityKey,
    userAlias: value.userAlias,
    documentOrder: value.documentOrder,
    observedTitle: value.observedTitle,
    insertionRejected: value.insertionRejected === true ? true : undefined,
  });
}

export function validateBinding(value: unknown): BindingRecord {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    value.id.length === 0 ||
    typeof value.templateId !== "string" ||
    value.templateId.length === 0 ||
    typeof value.pageProfileId !== "string" ||
    value.pageProfileId.length === 0 ||
    typeof value.fieldProfileId !== "string" ||
    value.fieldProfileId.length === 0 ||
    typeof value.createdAt !== "string" ||
    !isNonNegativeInteger(value.usageCount) ||
    !isNonNegativeInteger(value.revision) ||
    (value.privateToField !== undefined && value.privateToField !== true)
  ) {
    throw new InvalidStoredDataError();
  }
  return {
    id: value.id,
    templateId: value.templateId,
    pageProfileId: value.pageProfileId,
    fieldProfileId: value.fieldProfileId,
    createdAt: value.createdAt,
    usageCount: value.usageCount,
    revision: value.revision,
    // Task 027 Addendum C.2: only ever `true` or absent, never `false` - a
    // stored `false` would be a third state nothing in the product produces.
    ...(value.privateToField === true ? { privateToField: true as const } : {}),
  };
}

export function validateLogicalPageSiteKey(value: unknown): LogicalPageSiteKeyRecord {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.id) ||
    !isNonEmptyString(value.siteId) ||
    !isEncodedHmacKey(value.encodedHmacKey)
  ) {
    throw new InvalidStoredDataError();
  }
  return { id: value.id, siteId: value.siteId, encodedHmacKey: value.encodedHmacKey };
}

export function validateCompatibilityPairDecision(value: unknown): CompatibilityPairDecisionRecord {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.id) ||
    !isNonEmptyString(value.fieldProfileIdA) ||
    !isNonEmptyString(value.fieldProfileIdB) ||
    value.fieldProfileIdA === value.fieldProfileIdB ||
    typeof value.createdAt !== "string"
  ) {
    throw new InvalidStoredDataError();
  }
  return {
    id: value.id,
    fieldProfileIdA: value.fieldProfileIdA,
    fieldProfileIdB: value.fieldProfileIdB,
    createdAt: value.createdAt,
  };
}

export function validateLogicalPageRule(value: unknown): LogicalPageRuleRecord {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.id) ||
    !isNonEmptyString(value.siteId) ||
    !isNonEmptyString(value.siteKeyId) ||
    !isCanonicalOrigin(value.origin) ||
    !isNonEmptyString(value.routePattern) ||
    !LOGICAL_ROUTE_PATTERN.test(value.routePattern) ||
    !isNonEmptyString(value.pageProfileId) ||
    !isOpaqueHashArray(value.fieldFeatureHashes) ||
    !isOpaqueHashArray(value.groupedFieldFeatureHashes)
  ) {
    throw new InvalidStoredDataError();
  }
  return {
    id: value.id,
    siteId: value.siteId,
    siteKeyId: value.siteKeyId,
    origin: value.origin,
    routePattern: value.routePattern,
    fieldFeatureHashes: [...value.fieldFeatureHashes],
    groupedFieldFeatureHashes: [...value.groupedFieldFeatureHashes],
    pageProfileId: value.pageProfileId,
  };
}

export function validateLogicalPageProvenance(value: unknown): LogicalPageProvenanceRecord {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.id) ||
    !isNonEmptyString(value.ruleId) ||
    !isCanonicalOrigin(value.origin) ||
    !isNonEmptyString(value.sourcePageProfileId) ||
    !isNonEmptyString(value.canonicalPageProfileId) ||
    !Array.isArray(value.fieldMappings) ||
    value.fieldMappings.length === 0
  ) {
    throw new InvalidStoredDataError();
  }
  return {
    id: value.id,
    ruleId: value.ruleId,
    origin: value.origin,
    sourcePageProfileId: value.sourcePageProfileId,
    canonicalPageProfileId: value.canonicalPageProfileId,
    fieldMappings: value.fieldMappings.map(validateLogicalPageFieldProvenance),
  };
}

export function validateLogicalPageObservation(value: unknown): LogicalPageObservationRecord {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.id) ||
    !isNonEmptyString(value.siteId) ||
    !isNonEmptyString(value.siteKeyId) ||
    !isCanonicalOrigin(value.origin) ||
    !isNonEmptyString(value.routePattern) ||
    !LOGICAL_ROUTE_PATTERN.test(value.routePattern) ||
    !isNonEmptyString(value.pageProfileId) ||
    !isOpaqueHashArray(value.fieldFeatureHashes) ||
    !isOpaqueHashArray(value.groupedFieldFeatureHashes)
  ) {
    throw new InvalidStoredDataError();
  }
  return {
    id: value.id,
    siteId: value.siteId,
    siteKeyId: value.siteKeyId,
    origin: value.origin,
    routePattern: value.routePattern,
    fieldFeatureHashes: [...value.fieldFeatureHashes],
    groupedFieldFeatureHashes: [...value.groupedFieldFeatureHashes],
    pageProfileId: value.pageProfileId,
  };
}

export function validateLogicalPageFieldProvenance(value: unknown): LogicalPageFieldProvenanceRecord {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.sourceFieldProfileId) ||
    !isNonEmptyString(value.canonicalFieldProfileId) ||
    !Array.isArray(value.bindingIds) ||
    value.bindingIds.length === 0 ||
    !value.bindingIds.every(isNonEmptyString)
  ) {
    throw new InvalidStoredDataError();
  }
  return {
    sourceFieldProfileId: value.sourceFieldProfileId,
    canonicalFieldProfileId: value.canonicalFieldProfileId,
    bindingIds: [...value.bindingIds],
  };
}

function isCanonicalOrigin(value: unknown): value is string {
  if (!isNonEmptyString(value)) return false;
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && url.origin === value;
  } catch {
    return false;
  }
}

function isOpaqueHashArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((entry) => typeof entry === "string" && HMAC_HASH_PATTERN.test(entry)) &&
    new Set(value).size === value.length
  );
}

function isEncodedHmacKey(value: unknown): value is string {
  if (!isNonEmptyString(value) || !ENCODED_HMAC_KEY_PATTERN.test(value)) return false;
  const encodedPayload = value.slice("hmac-sha256-v1:".length);
  return encodedPayload.length % 4 !== 1;
}

export function compactOptionalFields<T extends Record<string, unknown>>(value: T): T {
  const result = { ...value };
  for (const key of Object.keys(result) as Array<keyof T>) {
    if (result[key] === undefined) delete result[key];
  }
  return result;
}
