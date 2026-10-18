import {
  isCanonicalPermissionOrigin,
  type ActivationMode,
  type OriginActivationRecord,
} from "../activation/activation-repository";
import {
  CURRENT_SCHEMA_VERSION,
  validateCandidateState,
  type FillNestState,
} from "../storage/fillnest-repository";
import { isCanonicalSiteIdentity } from "../domain/site";

export const BACKUP_ARCHIVE_FORMAT = "fillnest-backup" as const;
export const CURRENT_ARCHIVE_VERSION = 1;

// Restore keeps a durable copy of the current data while writing the target
// state.  Three MiB keeps the combined prior-state journal and target safely
// below chrome.storage.local's 10 MiB quota without unlimitedStorage.
export const MAX_BACKUP_JSON_BYTES = 3 * 1024 * 1024; // 3 MiB in UTF-8 bytes
export const MAX_TEMPLATES_COUNT = 10_000;
export const MAX_SITES_COUNT = 10_000;
export const MAX_PAGE_PROFILES_COUNT = 50_000;
export const MAX_FIELD_PROFILES_COUNT = 100_000;
export const MAX_BINDINGS_COUNT = 100_000;
export const MAX_ORIGINS_COUNT = 10_000;
export const MAX_TEMPLATE_CONTENT_LENGTH = 100_000;
export const MAX_USER_ALIAS_LENGTH = 1_000;
export const MAX_IDENTITY_KEY_LENGTH = 1_000;
export const MAX_SITE_ID_LENGTH = 255; // DNS hostname max is 253
export const MAX_SITE_AFFINITIES_PER_TEMPLATE = 1_000;
export const MAX_LOGICAL_PAGE_SITE_KEYS_COUNT = 10_000; // one per Site
export const MAX_LOGICAL_PAGE_RULES_COUNT = 50_000; // bounded by Page Profile scale
export const MAX_LOGICAL_PAGE_PROVENANCE_COUNT = 50_000; // bounded by Page Profile scale
export const MAX_LOGICAL_PAGE_FEATURE_HASHES_COUNT = 1_000;
export const MAX_LOGICAL_PAGE_FIELD_MAPPINGS_COUNT = 10_000;
export const MAX_LOGICAL_PAGE_BINDING_IDS_PER_MAPPING = 1_000;
export const MAX_SHARED_TEMPLATE_SETS_COUNT = 10_000; // bounded by Field Profile scale
export const MAX_SHARED_TEMPLATE_BINDINGS_COUNT = 100_000; // bounded by Template x Set scale
export const MAX_SHARED_TEMPLATE_SET_NAME_LENGTH = 200;
export const MAX_SHARED_TEMPLATE_SET_MEMBERS_COUNT = 10_000;
export const MAX_COMPATIBILITY_PAIR_DECISIONS_COUNT = 100_000; // bounded by Field Profile pair scale
export const MAX_SHARED_TEMPLATE_FIELD_STATES_COUNT = 100_000; // bounded by Field Profile x slot scale

export interface ArchiveSiteV1 {
  id: string;
}

export interface ArchiveTemplateV1 {
  id: string;
  content: string;
  siteAffinities: string[];
  createdAt: string;
  updatedAt: string;
  totalUsageCount: number;
  revision: number;
}

export interface ArchivePageProfileV1 {
  id: string;
  siteId: string;
  userAlias?: string;
  identityKey?: string;
}

export interface ArchiveFieldProfileV1 {
  id: string;
  pageProfileId: string;
  userAlias?: string;
  identityKey?: string;
  documentOrder?: number;
  observedTitle?: string;
  /**
   * Task 036. Whether this Field's editor refused an insertion. Carried so a
   * Restore does not silently re-arm a failure the user has already been told
   * about; only `true` is ever written, and it stays optional so every archive
   * written before this Task restores unchanged and CURRENT_ARCHIVE_VERSION
   * does not move.
   */
  insertionRejected?: boolean;
}

export interface ArchiveBindingV1 {
  id: string;
  templateId: string;
  pageProfileId: string;
  fieldProfileId: string;
  createdAt: string;
  usageCount: number;
  revision: number;
  /**
   * Field-local manual ordering, removed from the product on 2026-09-08. New
   * archives never write it; archives written before that date still carry it
   * and must still restore, so it is read and ignored.
   */
  order?: number;
  // Task 027 Addendum C.2: present only for a Binding converted from a
  // Field-only Slot. Dropping it on restore would silently make a private
  // Template shareable again the next time its Field joins a Set.
  privateToField?: true;
}

export type ArchivePickerPositionV1 = { top: number; left: number } | null;

export interface ArchiveLogicalPageSiteKeyV1 {
  id: string;
  siteId: string;
  encodedHmacKey: string;
}

export interface ArchiveLogicalPageRuleV1 {
  id: string;
  siteId: string;
  siteKeyId: string;
  origin: string;
  routePattern: string;
  fieldFeatureHashes: string[];
  groupedFieldFeatureHashes: string[];
  pageProfileId: string;
}

export interface ArchiveLogicalPageFieldProvenanceV1 {
  sourceFieldProfileId: string;
  canonicalFieldProfileId: string;
  bindingIds: string[];
}

export interface ArchiveLogicalPageProvenanceV1 {
  id: string;
  ruleId: string;
  origin: string;
  sourcePageProfileId: string;
  canonicalPageProfileId: string;
  fieldMappings: ArchiveLogicalPageFieldProvenanceV1[];
}

export interface ArchiveSharedTemplateSetV1 {
  id: string;
  siteId: string;
  name: string;
  memberFieldProfileIds: string[];
}

export interface ArchiveSharedTemplateBindingV1 {
  id: string;
  setId: string;
  templateId: string;
  usageCount: number;
  revision: number;
  order: number;
  // Task 027: present only for a Field-only relationship - the one Field
  // Profile that may ever resolve this slot.
  ownerFieldProfileId?: string;
}

export interface ArchiveCompatibilityPairDecisionV1 {
  id: string;
  fieldProfileIdA: string;
  fieldProfileIdB: string;
  createdAt: string;
}

export interface ArchiveSharedTemplateFieldStateV1 {
  id: string;
  setId: string;
  slotId: string;
  fieldProfileId: string;
  mode: "override" | "exclude";
  templateId?: string;
  usageCount?: number;
  revision?: number;
}

export interface ArchiveBusinessV1 {
  sites: ArchiveSiteV1[];
  templates: ArchiveTemplateV1[];
  pageProfiles: ArchivePageProfileV1[];
  fieldProfiles: ArchiveFieldProfileV1[];
  bindings: ArchiveBindingV1[];
  pickerPosition: ArchivePickerPositionV1;
  /**
   * Task 038. Where the user put the page status control. Optional, so every
   * archive written before this Task restores unchanged and
   * CURRENT_ARCHIVE_VERSION does not move.
   */
  pageStatusPosition?: ArchivePickerPositionV1;
  // Opaque Page Observations are never included: they are a local,
  // rebuildable cache with no user-portable meaning of their own (Task 014
  // Accepted Contract). An archive with no Logical Page Matching data at all
  // (an older export) restores exactly as if these three were empty - no
  // Rule is inferred from Page/Field records alone.
  logicalPageSiteKeys: ArchiveLogicalPageSiteKeyV1[];
  logicalPageRules: ArchiveLogicalPageRuleV1[];
  logicalPageProvenance: ArchiveLogicalPageProvenanceV1[];
  // Task 015 Accepted Contract: "Backup archives include set names,
  // memberships, shared Template bindings, and order." An archive with none
  // of this data (an older export) restores no shared sets at all.
  sharedTemplateSets: ArchiveSharedTemplateSetV1[];
  sharedTemplateBindings: ArchiveSharedTemplateBindingV1[];
  // Task 026: an archive with none of this data (an older export) restores
  // with every member plainly inheriting every slot - no Override or
  // Exclusion at all.
  sharedTemplateFieldStates: ArchiveSharedTemplateFieldStateV1[];
  // Task 024: an archive with none of this data (an older export) restores
  // with no pair decisions at all - every candidate pair is simply undecided.
  compatibilityPairDecisions: ArchiveCompatibilityPairDecisionV1[];
}

export interface BackupActivationInput {
  global: ActivationMode;
  origins: OriginActivationRecord[];
  dormantOrigins?: OriginActivationRecord[];
}

export interface ArchiveOriginActivationV1 {
  origin: string;
  mode: ActivationMode;
}

export interface ArchiveActivationV1 {
  global: ActivationMode;
  origins: ArchiveOriginActivationV1[];
}

export interface BackupArchiveV1 {
  format: typeof BACKUP_ARCHIVE_FORMAT;
  archiveVersion: 1;
  createdAt: string;
  appVersion: string;
  payload: {
    business: ArchiveBusinessV1;
    activation: ArchiveActivationV1;
  };
}

export type BackupArchive = BackupArchiveV1;

export class InvalidBackupArchiveError extends Error {
  constructor(message = "The backup file is invalid or corrupted.") {
    super(message);
    this.name = "InvalidBackupArchiveError";
  }
}

// Validation error messages echo the offending key/value so the user can see
// what's wrong - but that text comes straight from an untrusted archive file
// and flows through to the Side Panel's error banner unfiltered. Truncating
// it bounds how much arbitrary attacker-supplied text can be placed there.
const MAX_ECHOED_VALUE_LENGTH = 64;
function echo(value: unknown): string {
  const text = String(value);
  return text.length > MAX_ECHOED_VALUE_LENGTH ? `${text.slice(0, MAX_ECHOED_VALUE_LENGTH)}…` : text;
}

export class OversizedBackupArchiveError extends Error {
  constructor(message = "The backup file exceeds the maximum allowed size limit.") {
    super(message);
    this.name = "OversizedBackupArchiveError";
  }
}

const ISO_8601_UTC_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

export function generateBackupFilename(date: Date | string = new Date()): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) {
    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(now.getUTCDate()).padStart(2, "0");
    return `fillnest-backup-${yyyy}-${mm}-${dd}.json`;
  }
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `fillnest-backup-${yyyy}-${mm}-${dd}.json`;
}

export function createBackupArchive(
  businessState: FillNestState,
  activationState: BackupActivationInput,
  options: { createdAt?: string; appVersion?: string } = {},
): BackupArchiveV1 {
  const validatedBusiness = validateCandidateState(businessState);
  const activationOrigins = collectActivationPreferences(activationState);
  validateLimits(validatedBusiness, activationOrigins);

  const createdAt = options.createdAt ?? new Date().toISOString();
  if (!ISO_8601_UTC_REGEX.test(createdAt)) {
    throw new InvalidBackupArchiveError("createdAt must be a valid ISO 8601 UTC date string.");
  }
  const appVersion = options.appVersion ?? "0.1.0";

  return {
    format: BACKUP_ARCHIVE_FORMAT,
    archiveVersion: CURRENT_ARCHIVE_VERSION,
    createdAt,
    appVersion,
    payload: {
      business: {
        sites: validatedBusiness.sites.map((s) => ({ id: s.id })),
        templates: validatedBusiness.templates.map((t) => ({
          id: t.id,
          content: t.content,
          siteAffinities: [...t.siteAffinities],
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
          totalUsageCount: t.totalUsageCount,
          revision: t.revision,
        })),
        pageProfiles: validatedBusiness.pageProfiles.map((p) => ({
          id: p.id,
          siteId: p.siteId,
          ...(p.userAlias !== undefined ? { userAlias: p.userAlias } : {}),
          ...(p.identityKey !== undefined ? { identityKey: p.identityKey } : {}),
        })),
        fieldProfiles: validatedBusiness.fieldProfiles.map((f) => ({
          id: f.id,
          pageProfileId: f.pageProfileId,
          ...(f.userAlias !== undefined ? { userAlias: f.userAlias } : {}),
          ...(f.identityKey !== undefined ? { identityKey: f.identityKey } : {}),
          ...(f.documentOrder !== undefined ? { documentOrder: f.documentOrder } : {}),
          ...(f.observedTitle !== undefined ? { observedTitle: f.observedTitle } : {}),
          ...(f.insertionRejected === true ? { insertionRejected: true } : {}),
        })),
        bindings: validatedBusiness.bindings.map((b) => ({
          id: b.id,
          templateId: b.templateId,
          pageProfileId: b.pageProfileId,
          fieldProfileId: b.fieldProfileId,
          createdAt: b.createdAt,
          usageCount: b.usageCount,
          revision: b.revision,
          // Task 027 Addendum C.2: dropping this would silently make a
          // private Template shareable again after a Restore.
          ...(b.privateToField === true ? { privateToField: true as const } : {}),
        })),
        ...(validatedBusiness.pageStatusPosition
          ? {
              pageStatusPosition: {
                top: validatedBusiness.pageStatusPosition.top,
                left: validatedBusiness.pageStatusPosition.left,
              },
            }
          : {}),
        pickerPosition: validatedBusiness.pickerPosition
          ? { top: validatedBusiness.pickerPosition.top, left: validatedBusiness.pickerPosition.left }
          : null,
        logicalPageSiteKeys: validatedBusiness.logicalPageSiteKeys.map((key) => ({
          id: key.id,
          siteId: key.siteId,
          encodedHmacKey: key.encodedHmacKey,
        })),
        logicalPageRules: validatedBusiness.logicalPageRules.map((rule) => ({
          id: rule.id,
          siteId: rule.siteId,
          siteKeyId: rule.siteKeyId,
          origin: rule.origin,
          routePattern: rule.routePattern,
          fieldFeatureHashes: [...rule.fieldFeatureHashes],
          groupedFieldFeatureHashes: [...rule.groupedFieldFeatureHashes],
          pageProfileId: rule.pageProfileId,
        })),
        logicalPageProvenance: validatedBusiness.logicalPageProvenance.map((entry) => ({
          id: entry.id,
          ruleId: entry.ruleId,
          origin: entry.origin,
          sourcePageProfileId: entry.sourcePageProfileId,
          canonicalPageProfileId: entry.canonicalPageProfileId,
          fieldMappings: entry.fieldMappings.map((mapping) => ({
            sourceFieldProfileId: mapping.sourceFieldProfileId,
            canonicalFieldProfileId: mapping.canonicalFieldProfileId,
            bindingIds: [...mapping.bindingIds],
          })),
        })),
        sharedTemplateSets: validatedBusiness.sharedTemplateSets.map((set) => ({
          id: set.id,
          siteId: set.siteId,
          name: set.name,
          memberFieldProfileIds: [...set.memberFieldProfileIds],
        })),
        sharedTemplateBindings: validatedBusiness.sharedTemplateBindings.map((binding) => ({
          id: binding.id,
          setId: binding.setId,
          templateId: binding.templateId,
          usageCount: binding.usageCount,
          revision: binding.revision,
          order: binding.order,
          ...(binding.ownerFieldProfileId !== undefined ? { ownerFieldProfileId: binding.ownerFieldProfileId } : {}),
        })),
        sharedTemplateFieldStates: validatedBusiness.sharedTemplateFieldStates.map((entry) =>
          entry.mode === "override"
            ? {
                id: entry.id,
                setId: entry.setId,
                slotId: entry.slotId,
                fieldProfileId: entry.fieldProfileId,
                mode: "override" as const,
                templateId: entry.templateId,
                usageCount: entry.usageCount,
                revision: entry.revision,
              }
            : {
                id: entry.id,
                setId: entry.setId,
                slotId: entry.slotId,
                fieldProfileId: entry.fieldProfileId,
                mode: "exclude" as const,
              },
        ),
        compatibilityPairDecisions: validatedBusiness.compatibilityPairDecisions.map((decision) => ({
          id: decision.id,
          fieldProfileIdA: decision.fieldProfileIdA,
          fieldProfileIdB: decision.fieldProfileIdB,
          createdAt: decision.createdAt,
        })),
      },
      activation: {
        global: activationState.global,
        origins: activationOrigins,
      },
    },
  };
}

export function serializeBackupArchive(archive: BackupArchive): string {
  const canonical = canonicalizeArchive(archive);
  const json = JSON.stringify(canonical, null, 2) + "\n";
  // Symmetric with parseAndValidateBackupArchive's own check: without this,
  // a dataset comfortably within the count/length limits in validateLimits
  // could still produce a pretty-printed export that this same extension's
  // own restore path would then reject as oversized - an export the product
  // itself cannot restore.
  const utf8ByteLength = new TextEncoder().encode(json).length;
  if (utf8ByteLength > MAX_BACKUP_JSON_BYTES) {
    throw new OversizedBackupArchiveError();
  }
  return json;
}

export function parseAndValidateBackupArchive(jsonString: string): BackupArchiveV1 {
  if (typeof jsonString !== "string") {
    throw new InvalidBackupArchiveError("Expected JSON string content.");
  }

  // Validate exact UTF-8 byte length limit
  const utf8ByteLength = new TextEncoder().encode(jsonString).length;
  if (utf8ByteLength > MAX_BACKUP_JSON_BYTES) {
    throw new OversizedBackupArchiveError();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    throw new InvalidBackupArchiveError("File content is not valid JSON.");
  }

  return migrateAndValidateArchive(parsed);
}

/**
 * The business state a Restore writes, built from a parsed archive.
 *
 * Task 006 Addendum A. This is the only place an archive becomes state. The
 * service worker used to rebuild every record field by field in a second copy
 * of this mapping, and each field added to a record since (a private
 * Binding's audience, a Field's observed title and rejected-insertion fact,
 * the page status control's position) was exported, parsed and then silently
 * dropped by that copy. The parsed payload is already validated and
 * canonical, so the state adds only what an archive never holds: the schema
 * version, and Page Observations, which are a local cache (Task 014).
 */
export function businessStateFromArchive(archive: BackupArchiveV1): FillNestState {
  const business = structuredClone(archive.payload.business);
  return validateCandidateState({
    schemaVersion: CURRENT_SCHEMA_VERSION,
    ...business,
    logicalPageObservations: [],
    pageStatusPosition: business.pageStatusPosition ?? null,
  });
}

/**
 * CURRENT_ARCHIVE_VERSION is 1, so there is no older version to migrate from
 * yet - this only gates version bounds (rejects newer, rejects < 1) and then
 * validates the current schema strictly. When a second Archive version is
 * introduced, add an explicit per-version migration step here rather than
 * changing this gate's meaning; do not let this comment describe migration
 * machinery this function doesn't contain.
 */
export function migrateAndValidateArchive(value: unknown): BackupArchiveV1 {
  if (!isPlainRecord(value)) {
    throw new InvalidBackupArchiveError("Top-level backup must be a JSON object.");
  }

  if (value.format !== BACKUP_ARCHIVE_FORMAT) {
    throw new InvalidBackupArchiveError(`Unsupported backup format: ${echo(value.format)}`);
  }

  if (typeof value.archiveVersion !== "number" || !Number.isInteger(value.archiveVersion)) {
    throw new InvalidBackupArchiveError("archiveVersion must be an integer.");
  }

  if (value.archiveVersion > CURRENT_ARCHIVE_VERSION) {
    throw new InvalidBackupArchiveError(
      `Backup archive version ${value.archiveVersion} is newer than supported version ${CURRENT_ARCHIVE_VERSION}.`,
    );
  }

  if (value.archiveVersion < 1) {
    throw new InvalidBackupArchiveError(`Invalid backup archive version: ${echo(value.archiveVersion)}`);
  }

  return validateArchiveV1Structure(value);
}

function validateArchiveV1Structure(value: Record<string, unknown>): BackupArchiveV1 {
  const allowedTopKeys = new Set(["format", "archiveVersion", "createdAt", "appVersion", "payload"]);
  for (const key of Object.keys(value)) {
    if (!allowedTopKeys.has(key)) {
      throw new InvalidBackupArchiveError(`Unknown top-level property: ${echo(key)}`);
    }
  }

  if (
    typeof value.createdAt !== "string" ||
    !ISO_8601_UTC_REGEX.test(value.createdAt) ||
    Number.isNaN(Date.parse(value.createdAt))
  ) {
    throw new InvalidBackupArchiveError("createdAt must be a valid ISO 8601 UTC date string.");
  }

  if (typeof value.appVersion !== "string" || value.appVersion.trim().length === 0) {
    throw new InvalidBackupArchiveError("appVersion must be a non-empty string.");
  }

  if (!isPlainRecord(value.payload)) {
    throw new InvalidBackupArchiveError("payload must be a JSON object.");
  }

  const allowedPayloadKeys = new Set(["business", "activation"]);
  for (const key of Object.keys(value.payload)) {
    if (!allowedPayloadKeys.has(key)) {
      throw new InvalidBackupArchiveError(`Unknown payload property: ${echo(key)}`);
    }
  }

  const validatedBusiness = validateStrictBusinessPayload(value.payload.business);
  const validatedActivation = validateActivationPayload(value.payload.activation);
  validateLimits(validatedBusiness, validatedActivation.origins);

  return {
    format: BACKUP_ARCHIVE_FORMAT,
    archiveVersion: 1,
    createdAt: value.createdAt,
    appVersion: value.appVersion,
    payload: {
      business: validatedBusiness,
      activation: validatedActivation,
    },
  };
}

function validateStrictBusinessPayload(value: unknown): ArchiveBusinessV1 {
  if (!isPlainRecord(value)) {
    throw new InvalidBackupArchiveError("business payload must be an object.");
  }

  const allowedBusinessKeys = new Set([
    "sites",
    "templates",
    "pageProfiles",
    "fieldProfiles",
    "bindings",
    "pickerPosition",
    "pageStatusPosition",
    "logicalPageSiteKeys",
    "logicalPageRules",
    "logicalPageProvenance",
    "sharedTemplateSets",
    "sharedTemplateBindings",
    "sharedTemplateFieldStates",
    "compatibilityPairDecisions",
  ]);

  for (const key of Object.keys(value)) {
    if (!allowedBusinessKeys.has(key)) {
      throw new InvalidBackupArchiveError(`Unknown business property: ${echo(key)}`);
    }
  }

  // Validate sites
  if (!Array.isArray(value.sites)) throw new InvalidBackupArchiveError("sites must be an array.");
  for (const site of value.sites) {
    if (!isPlainRecord(site)) throw new InvalidBackupArchiveError("Each site must be an object.");
    const allowed = new Set(["id"]);
    for (const k of Object.keys(site)) {
      if (!allowed.has(k)) throw new InvalidBackupArchiveError(`Unknown property in site: ${echo(k)}`);
    }
    if (!isCanonicalSiteIdentity(site.id)) {
      throw new InvalidBackupArchiveError("Site id must be a canonical Site identity.");
    }
  }

  // Validate templates
  if (!Array.isArray(value.templates)) throw new InvalidBackupArchiveError("templates must be an array.");
  for (const t of value.templates) {
    if (!isPlainRecord(t)) throw new InvalidBackupArchiveError("Each template must be an object.");
    const allowed = new Set([
      "id",
      "content",
      "siteAffinities",
      "createdAt",
      "updatedAt",
      "totalUsageCount",
      "revision",
    ]);
    for (const k of Object.keys(t)) {
      if (!allowed.has(k)) throw new InvalidBackupArchiveError(`Unknown property in template: ${echo(k)}`);
    }
    if (typeof t.id !== "string" || t.id.trim().length === 0) {
      throw new InvalidBackupArchiveError("Template id must be a non-empty string.");
    }
    if (typeof t.content !== "string") {
      throw new InvalidBackupArchiveError("Template content must be a string.");
    }
    if (!Array.isArray(t.siteAffinities) || !t.siteAffinities.every(isCanonicalSiteIdentity)) {
      throw new InvalidBackupArchiveError("Template siteAffinities must be an array of canonical Site identities.");
    }
    if (!isValidIsoUtcDate(t.createdAt)) {
      throw new InvalidBackupArchiveError("Template createdAt must be an ISO 8601 UTC date string.");
    }
    if (!isValidIsoUtcDate(t.updatedAt)) {
      throw new InvalidBackupArchiveError("Template updatedAt must be an ISO 8601 UTC date string.");
    }
    if (typeof t.totalUsageCount !== "number" || !Number.isInteger(t.totalUsageCount) || t.totalUsageCount < 0) {
      throw new InvalidBackupArchiveError("Template totalUsageCount must be a non-negative integer.");
    }
    if (typeof t.revision !== "number" || !Number.isInteger(t.revision) || t.revision < 0) {
      throw new InvalidBackupArchiveError("Template revision must be a non-negative integer.");
    }
  }

  // Validate pageProfiles
  if (!Array.isArray(value.pageProfiles)) throw new InvalidBackupArchiveError("pageProfiles must be an array.");
  for (const p of value.pageProfiles) {
    if (!isPlainRecord(p)) throw new InvalidBackupArchiveError("Each pageProfile must be an object.");
    const allowed = new Set(["id", "siteId", "userAlias", "identityKey"]);
    for (const k of Object.keys(p)) {
      if (!allowed.has(k)) throw new InvalidBackupArchiveError(`Unknown property in pageProfile: ${echo(k)}`);
    }
    if (typeof p.id !== "string" || p.id.trim().length === 0) {
      throw new InvalidBackupArchiveError("PageProfile id must be a non-empty string.");
    }
    if (typeof p.siteId !== "string" || p.siteId.trim().length === 0) {
      throw new InvalidBackupArchiveError("PageProfile siteId must be a non-empty string.");
    }
    if (p.userAlias !== undefined && typeof p.userAlias !== "string") {
      throw new InvalidBackupArchiveError("PageProfile userAlias must be a string if defined.");
    }
    if (p.identityKey !== undefined && typeof p.identityKey !== "string") {
      throw new InvalidBackupArchiveError("PageProfile identityKey must be a string if defined.");
    }
  }

  // Validate fieldProfiles
  if (!Array.isArray(value.fieldProfiles)) throw new InvalidBackupArchiveError("fieldProfiles must be an array.");
  for (const f of value.fieldProfiles) {
    if (!isPlainRecord(f)) throw new InvalidBackupArchiveError("Each fieldProfile must be an object.");
    const allowed = new Set([
      "id",
      "pageProfileId",
      "userAlias",
      "identityKey",
      "documentOrder",
      "observedTitle",
      "insertionRejected",
    ]);
    for (const k of Object.keys(f)) {
      if (!allowed.has(k)) throw new InvalidBackupArchiveError(`Unknown property in fieldProfile: ${echo(k)}`);
    }
    if (typeof f.id !== "string" || f.id.trim().length === 0) {
      throw new InvalidBackupArchiveError("FieldProfile id must be a non-empty string.");
    }
    if (typeof f.pageProfileId !== "string" || f.pageProfileId.trim().length === 0) {
      throw new InvalidBackupArchiveError("FieldProfile pageProfileId must be a non-empty string.");
    }
    if (f.insertionRejected !== undefined && typeof f.insertionRejected !== "boolean") {
      throw new InvalidBackupArchiveError("FieldProfile insertionRejected must be a boolean.");
    }
    if (f.userAlias !== undefined && typeof f.userAlias !== "string") {
      throw new InvalidBackupArchiveError("FieldProfile userAlias must be a string if defined.");
    }
    if (f.identityKey !== undefined && typeof f.identityKey !== "string") {
      throw new InvalidBackupArchiveError("FieldProfile identityKey must be a string if defined.");
    }
    if (f.documentOrder !== undefined && (typeof f.documentOrder !== "number" || !Number.isInteger(f.documentOrder) || f.documentOrder < 0)) {
      throw new InvalidBackupArchiveError("FieldProfile documentOrder must be a non-negative integer if defined.");
    }
    if (f.observedTitle !== undefined && typeof f.observedTitle !== "string") {
      throw new InvalidBackupArchiveError("FieldProfile observedTitle must be a string if defined.");
    }
  }

  // Validate bindings
  if (!Array.isArray(value.bindings)) throw new InvalidBackupArchiveError("bindings must be an array.");
  for (const b of value.bindings) {
    if (!isPlainRecord(b)) throw new InvalidBackupArchiveError("Each binding must be an object.");
    const allowed = new Set([
      "id",
      "templateId",
      "pageProfileId",
      "fieldProfileId",
      "createdAt",
      "usageCount",
      "revision",
      "order",
      "privateToField",
    ]);
    for (const k of Object.keys(b)) {
      if (!allowed.has(k)) throw new InvalidBackupArchiveError(`Unknown property in binding: ${echo(k)}`);
    }
    // Only ever `true` or absent - a stored `false` would be a third state
    // nothing in the product produces.
    if (b.privateToField !== undefined && b.privateToField !== true) {
      throw new InvalidBackupArchiveError("Binding privateToField must be true when present.");
    }
    if (typeof b.id !== "string" || b.id.trim().length === 0) {
      throw new InvalidBackupArchiveError("Binding id must be a non-empty string.");
    }
    if (typeof b.templateId !== "string" || b.templateId.trim().length === 0) {
      throw new InvalidBackupArchiveError("Binding templateId must be a non-empty string.");
    }
    if (typeof b.pageProfileId !== "string" || b.pageProfileId.trim().length === 0) {
      throw new InvalidBackupArchiveError("Binding pageProfileId must be a non-empty string.");
    }
    if (typeof b.fieldProfileId !== "string" || b.fieldProfileId.trim().length === 0) {
      throw new InvalidBackupArchiveError("Binding fieldProfileId must be a non-empty string.");
    }
    if (!isValidIsoUtcDate(b.createdAt)) {
      throw new InvalidBackupArchiveError("Binding createdAt must be an ISO 8601 UTC date string.");
    }
    if (typeof b.usageCount !== "number" || !Number.isInteger(b.usageCount) || b.usageCount < 0) {
      throw new InvalidBackupArchiveError("Binding usageCount must be a non-negative integer.");
    }
    if (typeof b.revision !== "number" || !Number.isInteger(b.revision) || b.revision < 0) {
      throw new InvalidBackupArchiveError("Binding revision must be a non-negative integer.");
    }
    // Field-local manual ordering was removed on 2026-09-08, so new archives
    // carry no Binding `order`. It stays in the allowed set and is still
    // checked when present, because every archive written before that date has
    // it and must still restore.
    if (b.order !== undefined && (typeof b.order !== "number" || !Number.isInteger(b.order) || b.order < 0)) {
      throw new InvalidBackupArchiveError("Binding order must be a non-negative integer.");
    }
  }

  // Validate logicalPageSiteKeys (absent entirely on an older archive - Task
  // 014 compatibility: restores exactly as if this were an empty array).
  const rawSiteKeys = value.logicalPageSiteKeys;
  if (rawSiteKeys !== undefined && !Array.isArray(rawSiteKeys)) {
    throw new InvalidBackupArchiveError("logicalPageSiteKeys must be an array.");
  }
  for (const key of rawSiteKeys ?? []) {
    if (!isPlainRecord(key)) throw new InvalidBackupArchiveError("Each logicalPageSiteKey must be an object.");
    const allowed = new Set(["id", "siteId", "encodedHmacKey"]);
    for (const k of Object.keys(key)) {
      if (!allowed.has(k)) throw new InvalidBackupArchiveError(`Unknown property in logicalPageSiteKey: ${echo(k)}`);
    }
    if (typeof key.id !== "string" || key.id.trim().length === 0) {
      throw new InvalidBackupArchiveError("logicalPageSiteKey id must be a non-empty string.");
    }
    if (!isCanonicalSiteIdentity(key.siteId)) {
      throw new InvalidBackupArchiveError("logicalPageSiteKey siteId must be a canonical Site identity.");
    }
    if (typeof key.encodedHmacKey !== "string" || key.encodedHmacKey.trim().length === 0) {
      throw new InvalidBackupArchiveError("logicalPageSiteKey encodedHmacKey must be a non-empty string.");
    }
  }

  // Validate logicalPageRules
  const rawRules = value.logicalPageRules;
  if (rawRules !== undefined && !Array.isArray(rawRules)) {
    throw new InvalidBackupArchiveError("logicalPageRules must be an array.");
  }
  for (const rule of rawRules ?? []) {
    if (!isPlainRecord(rule)) throw new InvalidBackupArchiveError("Each logicalPageRule must be an object.");
    const allowed = new Set([
      "id",
      "siteId",
      "siteKeyId",
      "origin",
      "routePattern",
      "fieldFeatureHashes",
      "groupedFieldFeatureHashes",
      "pageProfileId",
    ]);
    for (const k of Object.keys(rule)) {
      if (!allowed.has(k)) throw new InvalidBackupArchiveError(`Unknown property in logicalPageRule: ${echo(k)}`);
    }
    if (typeof rule.id !== "string" || rule.id.trim().length === 0) {
      throw new InvalidBackupArchiveError("logicalPageRule id must be a non-empty string.");
    }
    if (!isCanonicalSiteIdentity(rule.siteId)) {
      throw new InvalidBackupArchiveError("logicalPageRule siteId must be a canonical Site identity.");
    }
    if (typeof rule.siteKeyId !== "string" || rule.siteKeyId.trim().length === 0) {
      throw new InvalidBackupArchiveError("logicalPageRule siteKeyId must be a non-empty string.");
    }
    if (typeof rule.origin !== "string" || rule.origin.trim().length === 0) {
      throw new InvalidBackupArchiveError("logicalPageRule origin must be a non-empty string.");
    }
    if (typeof rule.routePattern !== "string" || rule.routePattern.trim().length === 0) {
      throw new InvalidBackupArchiveError("logicalPageRule routePattern must be a non-empty string.");
    }
    if (
      !isStringArray(rule.fieldFeatureHashes) ||
      rule.fieldFeatureHashes.length > MAX_LOGICAL_PAGE_FEATURE_HASHES_COUNT
    ) {
      throw new InvalidBackupArchiveError(
        "logicalPageRule fieldFeatureHashes must be an array of strings within the allowed size.",
      );
    }
    if (
      !isStringArray(rule.groupedFieldFeatureHashes) ||
      rule.groupedFieldFeatureHashes.length > MAX_LOGICAL_PAGE_FEATURE_HASHES_COUNT
    ) {
      throw new InvalidBackupArchiveError(
        "logicalPageRule groupedFieldFeatureHashes must be an array of strings within the allowed size.",
      );
    }
    if (typeof rule.pageProfileId !== "string" || rule.pageProfileId.trim().length === 0) {
      throw new InvalidBackupArchiveError("logicalPageRule pageProfileId must be a non-empty string.");
    }
  }

  // Validate logicalPageProvenance
  const rawProvenance = value.logicalPageProvenance;
  if (rawProvenance !== undefined && !Array.isArray(rawProvenance)) {
    throw new InvalidBackupArchiveError("logicalPageProvenance must be an array.");
  }
  for (const entry of rawProvenance ?? []) {
    if (!isPlainRecord(entry)) {
      throw new InvalidBackupArchiveError("Each logicalPageProvenance entry must be an object.");
    }
    const allowed = new Set(["id", "ruleId", "origin", "sourcePageProfileId", "canonicalPageProfileId", "fieldMappings"]);
    for (const k of Object.keys(entry)) {
      if (!allowed.has(k)) throw new InvalidBackupArchiveError(`Unknown property in logicalPageProvenance: ${echo(k)}`);
    }
    if (typeof entry.id !== "string" || entry.id.trim().length === 0) {
      throw new InvalidBackupArchiveError("logicalPageProvenance id must be a non-empty string.");
    }
    if (typeof entry.ruleId !== "string" || entry.ruleId.trim().length === 0) {
      throw new InvalidBackupArchiveError("logicalPageProvenance ruleId must be a non-empty string.");
    }
    if (typeof entry.origin !== "string" || entry.origin.trim().length === 0) {
      throw new InvalidBackupArchiveError("logicalPageProvenance origin must be a non-empty string.");
    }
    if (typeof entry.sourcePageProfileId !== "string" || entry.sourcePageProfileId.trim().length === 0) {
      throw new InvalidBackupArchiveError("logicalPageProvenance sourcePageProfileId must be a non-empty string.");
    }
    if (typeof entry.canonicalPageProfileId !== "string" || entry.canonicalPageProfileId.trim().length === 0) {
      throw new InvalidBackupArchiveError("logicalPageProvenance canonicalPageProfileId must be a non-empty string.");
    }
    if (!Array.isArray(entry.fieldMappings) || entry.fieldMappings.length > MAX_LOGICAL_PAGE_FIELD_MAPPINGS_COUNT) {
      throw new InvalidBackupArchiveError("logicalPageProvenance fieldMappings must be an array within the allowed size.");
    }
    for (const mapping of entry.fieldMappings) {
      if (!isPlainRecord(mapping)) throw new InvalidBackupArchiveError("Each field mapping must be an object.");
      const mappingAllowed = new Set(["sourceFieldProfileId", "canonicalFieldProfileId", "bindingIds"]);
      for (const k of Object.keys(mapping)) {
        if (!mappingAllowed.has(k)) throw new InvalidBackupArchiveError(`Unknown property in field mapping: ${echo(k)}`);
      }
      if (typeof mapping.sourceFieldProfileId !== "string" || mapping.sourceFieldProfileId.trim().length === 0) {
        throw new InvalidBackupArchiveError("Field mapping sourceFieldProfileId must be a non-empty string.");
      }
      if (typeof mapping.canonicalFieldProfileId !== "string" || mapping.canonicalFieldProfileId.trim().length === 0) {
        throw new InvalidBackupArchiveError("Field mapping canonicalFieldProfileId must be a non-empty string.");
      }
      if (
        !isStringArray(mapping.bindingIds) ||
        mapping.bindingIds.length > MAX_LOGICAL_PAGE_BINDING_IDS_PER_MAPPING
      ) {
        throw new InvalidBackupArchiveError(
          "Field mapping bindingIds must be an array of strings within the allowed size.",
        );
      }
    }
  }

  // Validate sharedTemplateSets (absent entirely on an older archive - Task
  // 015 compatibility: restores exactly as if this were an empty array).
  const rawSharedTemplateSets = value.sharedTemplateSets;
  if (rawSharedTemplateSets !== undefined && !Array.isArray(rawSharedTemplateSets)) {
    throw new InvalidBackupArchiveError("sharedTemplateSets must be an array.");
  }
  for (const set of rawSharedTemplateSets ?? []) {
    if (!isPlainRecord(set)) throw new InvalidBackupArchiveError("Each sharedTemplateSet must be an object.");
    const allowed = new Set(["id", "siteId", "name", "memberFieldProfileIds"]);
    for (const k of Object.keys(set)) {
      if (!allowed.has(k)) throw new InvalidBackupArchiveError(`Unknown property in sharedTemplateSet: ${echo(k)}`);
    }
    if (typeof set.id !== "string" || set.id.trim().length === 0) {
      throw new InvalidBackupArchiveError("sharedTemplateSet id must be a non-empty string.");
    }
    if (!isCanonicalSiteIdentity(set.siteId)) {
      throw new InvalidBackupArchiveError("sharedTemplateSet siteId must be a canonical Site identity.");
    }
    if (typeof set.name !== "string" || set.name.trim().length === 0) {
      throw new InvalidBackupArchiveError("sharedTemplateSet name must be a non-empty string.");
    }
    if (set.name.length > MAX_SHARED_TEMPLATE_SET_NAME_LENGTH) {
      throw new OversizedBackupArchiveError("sharedTemplateSet name exceeds maximum allowed length.");
    }
    if (
      !isStringArray(set.memberFieldProfileIds) ||
      set.memberFieldProfileIds.length === 0 ||
      set.memberFieldProfileIds.length > MAX_SHARED_TEMPLATE_SET_MEMBERS_COUNT
    ) {
      throw new InvalidBackupArchiveError(
        "sharedTemplateSet memberFieldProfileIds must be a non-empty array of strings within the allowed size.",
      );
    }
  }

  // Validate sharedTemplateBindings
  const rawSharedTemplateBindings = value.sharedTemplateBindings;
  if (rawSharedTemplateBindings !== undefined && !Array.isArray(rawSharedTemplateBindings)) {
    throw new InvalidBackupArchiveError("sharedTemplateBindings must be an array.");
  }
  for (const binding of rawSharedTemplateBindings ?? []) {
    if (!isPlainRecord(binding)) {
      throw new InvalidBackupArchiveError("Each sharedTemplateBinding must be an object.");
    }
    const allowed = new Set(["id", "setId", "templateId", "usageCount", "revision", "order", "ownerFieldProfileId"]);
    for (const k of Object.keys(binding)) {
      if (!allowed.has(k)) throw new InvalidBackupArchiveError(`Unknown property in sharedTemplateBinding: ${echo(k)}`);
    }
    if (typeof binding.id !== "string" || binding.id.trim().length === 0) {
      throw new InvalidBackupArchiveError("sharedTemplateBinding id must be a non-empty string.");
    }
    if (typeof binding.setId !== "string" || binding.setId.trim().length === 0) {
      throw new InvalidBackupArchiveError("sharedTemplateBinding setId must be a non-empty string.");
    }
    if (typeof binding.templateId !== "string" || binding.templateId.trim().length === 0) {
      throw new InvalidBackupArchiveError("sharedTemplateBinding templateId must be a non-empty string.");
    }
    if (typeof binding.usageCount !== "number" || !Number.isInteger(binding.usageCount) || binding.usageCount < 0) {
      throw new InvalidBackupArchiveError("sharedTemplateBinding usageCount must be a non-negative integer.");
    }
    if (typeof binding.revision !== "number" || !Number.isInteger(binding.revision) || binding.revision < 0) {
      throw new InvalidBackupArchiveError("sharedTemplateBinding revision must be a non-negative integer.");
    }
    if (typeof binding.order !== "number" || !Number.isInteger(binding.order) || binding.order < 0) {
      throw new InvalidBackupArchiveError("sharedTemplateBinding order must be a non-negative integer.");
    }
    if (
      binding.ownerFieldProfileId !== undefined &&
      (typeof binding.ownerFieldProfileId !== "string" || binding.ownerFieldProfileId.trim().length === 0)
    ) {
      throw new InvalidBackupArchiveError("sharedTemplateBinding ownerFieldProfileId must be a non-empty string.");
    }
  }

  // Validate compatibilityPairDecisions (absent entirely on an older archive
  // - Task 024 compatibility: restores exactly as if this were an empty
  // array, i.e. every candidate pair is simply undecided).
  const rawCompatibilityPairDecisions = value.compatibilityPairDecisions;
  if (rawCompatibilityPairDecisions !== undefined && !Array.isArray(rawCompatibilityPairDecisions)) {
    throw new InvalidBackupArchiveError("compatibilityPairDecisions must be an array.");
  }
  for (const decision of rawCompatibilityPairDecisions ?? []) {
    if (!isPlainRecord(decision)) {
      throw new InvalidBackupArchiveError("Each compatibilityPairDecision must be an object.");
    }
    const allowed = new Set(["id", "fieldProfileIdA", "fieldProfileIdB", "createdAt"]);
    for (const k of Object.keys(decision)) {
      if (!allowed.has(k)) {
        throw new InvalidBackupArchiveError(`Unknown property in compatibilityPairDecision: ${echo(k)}`);
      }
    }
    if (typeof decision.id !== "string" || decision.id.trim().length === 0) {
      throw new InvalidBackupArchiveError("compatibilityPairDecision id must be a non-empty string.");
    }
    if (typeof decision.fieldProfileIdA !== "string" || decision.fieldProfileIdA.trim().length === 0) {
      throw new InvalidBackupArchiveError("compatibilityPairDecision fieldProfileIdA must be a non-empty string.");
    }
    if (typeof decision.fieldProfileIdB !== "string" || decision.fieldProfileIdB.trim().length === 0) {
      throw new InvalidBackupArchiveError("compatibilityPairDecision fieldProfileIdB must be a non-empty string.");
    }
    if (typeof decision.createdAt !== "string") {
      throw new InvalidBackupArchiveError("compatibilityPairDecision createdAt must be a string.");
    }
  }

  // Validate sharedTemplateFieldStates (absent entirely on an older archive -
  // Task 026 compatibility: restores exactly as if this were an empty array,
  // i.e. every member plainly inherits every slot).
  const rawSharedTemplateFieldStates = value.sharedTemplateFieldStates;
  if (rawSharedTemplateFieldStates !== undefined && !Array.isArray(rawSharedTemplateFieldStates)) {
    throw new InvalidBackupArchiveError("sharedTemplateFieldStates must be an array.");
  }
  for (const entry of rawSharedTemplateFieldStates ?? []) {
    if (!isPlainRecord(entry)) {
      throw new InvalidBackupArchiveError("Each sharedTemplateFieldState must be an object.");
    }
    const allowed = new Set(["id", "setId", "slotId", "fieldProfileId", "mode", "templateId", "usageCount", "revision"]);
    for (const k of Object.keys(entry)) {
      if (!allowed.has(k)) {
        throw new InvalidBackupArchiveError(`Unknown property in sharedTemplateFieldState: ${echo(k)}`);
      }
    }
    if (typeof entry.id !== "string" || entry.id.trim().length === 0) {
      throw new InvalidBackupArchiveError("sharedTemplateFieldState id must be a non-empty string.");
    }
    if (typeof entry.setId !== "string" || entry.setId.trim().length === 0) {
      throw new InvalidBackupArchiveError("sharedTemplateFieldState setId must be a non-empty string.");
    }
    if (typeof entry.slotId !== "string" || entry.slotId.trim().length === 0) {
      throw new InvalidBackupArchiveError("sharedTemplateFieldState slotId must be a non-empty string.");
    }
    if (typeof entry.fieldProfileId !== "string" || entry.fieldProfileId.trim().length === 0) {
      throw new InvalidBackupArchiveError("sharedTemplateFieldState fieldProfileId must be a non-empty string.");
    }
    if (entry.mode !== "override" && entry.mode !== "exclude") {
      throw new InvalidBackupArchiveError('sharedTemplateFieldState mode must be "override" or "exclude".');
    }
    if (entry.mode === "override") {
      if (typeof entry.templateId !== "string" || entry.templateId.trim().length === 0) {
        throw new InvalidBackupArchiveError("sharedTemplateFieldState templateId must be a non-empty string.");
      }
      if (typeof entry.usageCount !== "number" || !Number.isInteger(entry.usageCount) || entry.usageCount < 0) {
        throw new InvalidBackupArchiveError("sharedTemplateFieldState usageCount must be a non-negative integer.");
      }
      if (typeof entry.revision !== "number" || !Number.isInteger(entry.revision) || entry.revision < 0) {
        throw new InvalidBackupArchiveError("sharedTemplateFieldState revision must be a non-negative integer.");
      }
    } else if (entry.templateId !== undefined || entry.usageCount !== undefined || entry.revision !== undefined) {
      throw new InvalidBackupArchiveError("An excluded sharedTemplateFieldState must not carry a Template.");
    }
  }
  if ((rawSharedTemplateFieldStates ?? []).length > MAX_SHARED_TEMPLATE_FIELD_STATES_COUNT) {
    throw new OversizedBackupArchiveError("sharedTemplateFieldStates exceeds the maximum allowed count.");
  }

  // Validate pickerPosition, and Task 038's page status position beside it -
  // the same shape, the same rules.
  for (const key of ["pickerPosition", "pageStatusPosition"] as const) {
    const position = value[key];
    if (position === null || position === undefined) continue;
    if (!isPlainRecord(position)) {
      throw new InvalidBackupArchiveError(`${key} must be null or an object.`);
    }
    const allowed = new Set(["top", "left"]);
    for (const k of Object.keys(position)) {
      if (!allowed.has(k)) throw new InvalidBackupArchiveError(`Unknown property in ${key}: ${echo(k)}`);
    }
    if (typeof position.top !== "number" || typeof position.left !== "number") {
      throw new InvalidBackupArchiveError(`${key} coordinates must be numbers.`);
    }
  }

  // Invariant validation (uniqueness, relational integrity, non-empty fields).
  // This is the same repository-level check the live extension enforces on
  // every commit, so a Rule's Origin/siteId, a provenance entry's Rule and
  // Field references, and a merged Binding-ID union are all verified as
  // relationally consistent - not just individually well-shaped - before
  // anything from this untrusted archive is accepted.
  try {
    const candidate = validateCandidateState({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      ...value,
      logicalPageSiteKeys: rawSiteKeys ?? [],
      logicalPageRules: rawRules ?? [],
      logicalPageProvenance: rawProvenance ?? [],
      logicalPageObservations: [],
      sharedTemplateSets: rawSharedTemplateSets ?? [],
      sharedTemplateBindings: rawSharedTemplateBindings ?? [],
      sharedTemplateFieldStates: rawSharedTemplateFieldStates ?? [],
      compatibilityPairDecisions: rawCompatibilityPairDecisions ?? [],
    });
    return {
      sites: candidate.sites.map((s) => ({ id: s.id })),
      templates: candidate.templates.map((t) => ({
        id: t.id,
        content: t.content,
        siteAffinities: [...t.siteAffinities],
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        totalUsageCount: t.totalUsageCount,
        revision: t.revision,
      })),
      pageProfiles: candidate.pageProfiles.map((p) => ({
        id: p.id,
        siteId: p.siteId,
        ...(p.userAlias !== undefined ? { userAlias: p.userAlias } : {}),
        ...(p.identityKey !== undefined ? { identityKey: p.identityKey } : {}),
      })),
      fieldProfiles: candidate.fieldProfiles.map((f) => ({
        id: f.id,
        pageProfileId: f.pageProfileId,
        ...(f.userAlias !== undefined ? { userAlias: f.userAlias } : {}),
        ...(f.identityKey !== undefined ? { identityKey: f.identityKey } : {}),
        ...(f.documentOrder !== undefined ? { documentOrder: f.documentOrder } : {}),
        ...(f.observedTitle !== undefined ? { observedTitle: f.observedTitle } : {}),
        ...(f.insertionRejected === true ? { insertionRejected: true } : {}),
      })),
      bindings: candidate.bindings.map((b) => ({
        id: b.id,
        templateId: b.templateId,
        pageProfileId: b.pageProfileId,
        fieldProfileId: b.fieldProfileId,
        createdAt: b.createdAt,
        usageCount: b.usageCount,
        revision: b.revision,
        ...(b.privateToField === true ? { privateToField: true as const } : {}),
      })),
      pickerPosition: candidate.pickerPosition
        ? { top: candidate.pickerPosition.top, left: candidate.pickerPosition.left }
        : null,
      // Task 038: exported beside the Picker's position, and read back beside it.
      ...(candidate.pageStatusPosition
        ? { pageStatusPosition: { top: candidate.pageStatusPosition.top, left: candidate.pageStatusPosition.left } }
        : {}),
      logicalPageSiteKeys: candidate.logicalPageSiteKeys.map((key) => ({
        id: key.id,
        siteId: key.siteId,
        encodedHmacKey: key.encodedHmacKey,
      })),
      logicalPageRules: candidate.logicalPageRules.map((rule) => ({
        id: rule.id,
        siteId: rule.siteId,
        siteKeyId: rule.siteKeyId,
        origin: rule.origin,
        routePattern: rule.routePattern,
        fieldFeatureHashes: [...rule.fieldFeatureHashes],
        groupedFieldFeatureHashes: [...rule.groupedFieldFeatureHashes],
        pageProfileId: rule.pageProfileId,
      })),
      logicalPageProvenance: candidate.logicalPageProvenance.map((entry) => ({
        id: entry.id,
        ruleId: entry.ruleId,
        origin: entry.origin,
        sourcePageProfileId: entry.sourcePageProfileId,
        canonicalPageProfileId: entry.canonicalPageProfileId,
        fieldMappings: entry.fieldMappings.map((mapping) => ({
          sourceFieldProfileId: mapping.sourceFieldProfileId,
          canonicalFieldProfileId: mapping.canonicalFieldProfileId,
          bindingIds: [...mapping.bindingIds],
        })),
      })),
      sharedTemplateSets: candidate.sharedTemplateSets.map((set) => ({
        id: set.id,
        siteId: set.siteId,
        name: set.name,
        memberFieldProfileIds: [...set.memberFieldProfileIds],
      })),
      sharedTemplateBindings: candidate.sharedTemplateBindings.map((binding) => ({
        id: binding.id,
        setId: binding.setId,
        templateId: binding.templateId,
        usageCount: binding.usageCount,
        revision: binding.revision,
        order: binding.order,
        ...(binding.ownerFieldProfileId !== undefined ? { ownerFieldProfileId: binding.ownerFieldProfileId } : {}),
      })),
      sharedTemplateFieldStates: candidate.sharedTemplateFieldStates.map((entry) =>
        entry.mode === "override"
          ? {
              id: entry.id,
              setId: entry.setId,
              slotId: entry.slotId,
              fieldProfileId: entry.fieldProfileId,
              mode: "override" as const,
              templateId: entry.templateId,
              usageCount: entry.usageCount,
              revision: entry.revision,
            }
          : {
              id: entry.id,
              setId: entry.setId,
              slotId: entry.slotId,
              fieldProfileId: entry.fieldProfileId,
              mode: "exclude" as const,
            },
      ),
      compatibilityPairDecisions: candidate.compatibilityPairDecisions.map((decision) => ({
        id: decision.id,
        fieldProfileIdA: decision.fieldProfileIdA,
        fieldProfileIdB: decision.fieldProfileIdB,
        createdAt: decision.createdAt,
      })),
    };
  } catch (error) {
    throw new InvalidBackupArchiveError(
      `Business data in backup is invalid: ${error instanceof Error ? error.message : "Validation failed"}`,
    );
  }
}

function validateActivationPayload(value: unknown): ArchiveActivationV1 {
  if (!isPlainRecord(value)) {
    throw new InvalidBackupArchiveError("activation payload must be an object.");
  }

  const allowedKeys = new Set(["global", "origins"]);
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      throw new InvalidBackupArchiveError(`Unknown activation property: ${echo(key)}`);
    }
  }

  if (value.global !== "active" && value.global !== "paused") {
    throw new InvalidBackupArchiveError("activation.global must be 'active' or 'paused'.");
  }

  if (!Array.isArray(value.origins)) {
    throw new InvalidBackupArchiveError("activation.origins must be an array.");
  }

  const origins: ArchiveOriginActivationV1[] = [];
  const seenOrigins = new Set<string>();

  for (const item of value.origins) {
    if (!isPlainRecord(item)) {
      throw new InvalidBackupArchiveError("Each origin entry must be an object.");
    }
    const itemKeys = new Set(["origin", "mode"]);
    for (const k of Object.keys(item)) {
      if (!itemKeys.has(k)) {
        throw new InvalidBackupArchiveError(`Unknown property in origin entry: ${echo(k)}`);
      }
    }
    if (typeof item.origin !== "string" || !isCanonicalPermissionOrigin(item.origin)) {
      throw new InvalidBackupArchiveError(`Invalid canonical Permission Origin in backup: ${echo(item.origin)}`);
    }
    if (item.mode !== "active" && item.mode !== "paused") {
      throw new InvalidBackupArchiveError("origin mode must be 'active' or 'paused'.");
    }
    if (seenOrigins.has(item.origin)) {
      throw new InvalidBackupArchiveError(`Duplicate origin in activation backup: ${echo(item.origin)}`);
    }
    seenOrigins.add(item.origin);
    origins.push({ origin: item.origin, mode: item.mode });
  }

  return {
    global: value.global,
    origins,
  };
}

function validateLimits(
  business: {
    sites: ArchiveSiteV1[];
    templates: ArchiveTemplateV1[];
    pageProfiles: ArchivePageProfileV1[];
    fieldProfiles: ArchiveFieldProfileV1[];
    bindings: ArchiveBindingV1[];
    logicalPageSiteKeys: ArchiveLogicalPageSiteKeyV1[];
    logicalPageRules: ArchiveLogicalPageRuleV1[];
    logicalPageProvenance: ArchiveLogicalPageProvenanceV1[];
    sharedTemplateSets: ArchiveSharedTemplateSetV1[];
    sharedTemplateBindings: ArchiveSharedTemplateBindingV1[];
    sharedTemplateFieldStates: ArchiveSharedTemplateFieldStateV1[];
    compatibilityPairDecisions: ArchiveCompatibilityPairDecisionV1[];
  },
  origins: ArchiveOriginActivationV1[],
): void {
  if (business.templates.length > MAX_TEMPLATES_COUNT) throw new OversizedBackupArchiveError();
  if (business.sites.length > MAX_SITES_COUNT) throw new OversizedBackupArchiveError();
  if (business.pageProfiles.length > MAX_PAGE_PROFILES_COUNT) throw new OversizedBackupArchiveError();
  if (business.fieldProfiles.length > MAX_FIELD_PROFILES_COUNT) throw new OversizedBackupArchiveError();
  if (business.bindings.length > MAX_BINDINGS_COUNT) throw new OversizedBackupArchiveError();
  if (business.logicalPageSiteKeys.length > MAX_LOGICAL_PAGE_SITE_KEYS_COUNT) throw new OversizedBackupArchiveError();
  if (business.logicalPageRules.length > MAX_LOGICAL_PAGE_RULES_COUNT) throw new OversizedBackupArchiveError();
  if (business.logicalPageProvenance.length > MAX_LOGICAL_PAGE_PROVENANCE_COUNT) throw new OversizedBackupArchiveError();
  if (business.sharedTemplateSets.length > MAX_SHARED_TEMPLATE_SETS_COUNT) throw new OversizedBackupArchiveError();
  if (business.sharedTemplateBindings.length > MAX_SHARED_TEMPLATE_BINDINGS_COUNT) throw new OversizedBackupArchiveError();
  if (business.sharedTemplateFieldStates.length > MAX_SHARED_TEMPLATE_FIELD_STATES_COUNT) {
    throw new OversizedBackupArchiveError();
  }
  if (business.compatibilityPairDecisions.length > MAX_COMPATIBILITY_PAIR_DECISIONS_COUNT) {
    throw new OversizedBackupArchiveError();
  }
  if (origins.length > MAX_ORIGINS_COUNT) throw new OversizedBackupArchiveError();

  for (const site of business.sites) {
    if (site.id.length > MAX_SITE_ID_LENGTH) {
      throw new OversizedBackupArchiveError("Site id exceeds maximum allowed length.");
    }
  }

  for (const template of business.templates) {
    if (template.content.length > MAX_TEMPLATE_CONTENT_LENGTH) {
      throw new OversizedBackupArchiveError("Template content exceeds maximum allowed length.");
    }
    if (template.siteAffinities.length > MAX_SITE_AFFINITIES_PER_TEMPLATE) {
      throw new OversizedBackupArchiveError("Template Site Affinity count exceeds maximum allowed.");
    }
  }

  for (const page of business.pageProfiles) {
    if (page.userAlias && page.userAlias.length > MAX_USER_ALIAS_LENGTH) {
      throw new OversizedBackupArchiveError("Page user alias exceeds maximum allowed length.");
    }
    if (page.identityKey && page.identityKey.length > MAX_IDENTITY_KEY_LENGTH) {
      throw new OversizedBackupArchiveError("Page identity key exceeds maximum allowed length.");
    }
  }

  for (const field of business.fieldProfiles) {
    if (field.userAlias && field.userAlias.length > MAX_USER_ALIAS_LENGTH) {
      throw new OversizedBackupArchiveError("Field user alias exceeds maximum allowed length.");
    }
    if (field.identityKey && field.identityKey.length > MAX_IDENTITY_KEY_LENGTH) {
      throw new OversizedBackupArchiveError("Field identity key exceeds maximum allowed length.");
    }
  }
}

function canonicalizeArchive(archive: BackupArchiveV1): BackupArchiveV1 {
  const sortedSites = [...archive.payload.business.sites].sort((a, b) => a.id.localeCompare(b.id));
  const sortedTemplates = [...archive.payload.business.templates]
    .map((t) => ({
      ...t,
      siteAffinities: [...t.siteAffinities].sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const sortedPages = [...archive.payload.business.pageProfiles].sort((a, b) => a.id.localeCompare(b.id));
  const sortedFields = [...archive.payload.business.fieldProfiles].sort((a, b) => a.id.localeCompare(b.id));
  const sortedBindings = [...archive.payload.business.bindings].sort((a, b) => a.id.localeCompare(b.id));
  const sortedOrigins = [...archive.payload.activation.origins].sort((a, b) => a.origin.localeCompare(b.origin));
  const sortedSiteKeys = [...archive.payload.business.logicalPageSiteKeys].sort((a, b) => a.id.localeCompare(b.id));
  const sortedRules = [...archive.payload.business.logicalPageRules]
    .map((rule) => ({
      ...rule,
      fieldFeatureHashes: [...rule.fieldFeatureHashes].sort((a, b) => a.localeCompare(b)),
      groupedFieldFeatureHashes: [...rule.groupedFieldFeatureHashes].sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const sortedProvenance = [...archive.payload.business.logicalPageProvenance]
    .map((entry) => ({
      ...entry,
      fieldMappings: [...entry.fieldMappings]
        .map((mapping) => ({ ...mapping, bindingIds: [...mapping.bindingIds].sort((a, b) => a.localeCompare(b)) }))
        .sort((a, b) => a.sourceFieldProfileId.localeCompare(b.sourceFieldProfileId)),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const sortedSharedTemplateSets = [...archive.payload.business.sharedTemplateSets]
    .map((set) => ({ ...set, memberFieldProfileIds: [...set.memberFieldProfileIds].sort((a, b) => a.localeCompare(b)) }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const sortedSharedTemplateBindings = [...archive.payload.business.sharedTemplateBindings].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  const sortedSharedTemplateFieldStates = [...archive.payload.business.sharedTemplateFieldStates].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  const sortedCompatibilityPairDecisions = [...archive.payload.business.compatibilityPairDecisions].sort((a, b) =>
    a.id.localeCompare(b.id),
  );

  return {
    format: BACKUP_ARCHIVE_FORMAT,
    archiveVersion: archive.archiveVersion,
    createdAt: archive.createdAt,
    appVersion: archive.appVersion,
    payload: {
      business: {
        sites: sortedSites,
        templates: sortedTemplates,
        pageProfiles: sortedPages,
        fieldProfiles: sortedFields,
        bindings: sortedBindings,
        pickerPosition: archive.payload.business.pickerPosition,
        ...(archive.payload.business.pageStatusPosition
          ? { pageStatusPosition: archive.payload.business.pageStatusPosition }
          : {}),
        logicalPageSiteKeys: sortedSiteKeys,
        logicalPageRules: sortedRules,
        logicalPageProvenance: sortedProvenance,
        sharedTemplateSets: sortedSharedTemplateSets,
        sharedTemplateBindings: sortedSharedTemplateBindings,
        sharedTemplateFieldStates: sortedSharedTemplateFieldStates,
        compatibilityPairDecisions: sortedCompatibilityPairDecisions,
      },
      activation: {
        global: archive.payload.activation.global,
        origins: sortedOrigins,
      },
    },
  };
}

function collectActivationPreferences(input: BackupActivationInput): ArchiveOriginActivationV1[] {
  const preferences = new Map<string, ActivationMode>();
  for (const record of [...(input.dormantOrigins ?? []), ...input.origins]) {
    if (!isCanonicalPermissionOrigin(record.origin) || (record.mode !== "active" && record.mode !== "paused")) {
      throw new InvalidBackupArchiveError("Activation preferences must contain canonical Permission Origins.");
    }
    if (preferences.has(record.origin)) {
      throw new InvalidBackupArchiveError(`Duplicate activation preference: ${echo(record.origin)}`);
    }
    preferences.set(record.origin, record.mode);
  }
  return [...preferences.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([origin, mode]) => ({ origin, mode }));
}

function isValidIsoUtcDate(value: unknown): value is string {
  return typeof value === "string" && ISO_8601_UTC_REGEX.test(value) && !Number.isNaN(Date.parse(value));
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}
