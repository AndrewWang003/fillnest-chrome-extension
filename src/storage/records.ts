import type { SiteIdentity } from "../domain/site";
import type { PickerPosition } from "./picker-position";
import { CURRENT_SCHEMA_VERSION } from "./schema-version";
import type {
  SharedTemplateBindingRecord,
  SharedTemplateFieldStateRecord,
  SharedTemplateSetRecord,
} from "./shared-templates";

/**
 * The stored data shapes, and the empty state a fresh install begins from.
 *
 * Task 032 moved these out of `fillnest-repository.ts`. They are the vocabulary
 * every other storage module speaks, so keeping them in the module that also
 * holds live behaviour forced anything that wanted to validate or resolve a
 * record to import the repository back. With the shapes standing alone, the
 * dependency runs from behaviour toward data and never the other way.
 */

export interface TemplateRecord {
  id: string;
  content: string;
  siteAffinities: SiteIdentity[];
  createdAt: string;
  updatedAt: string;
  totalUsageCount: number;
  revision: number;
}

export interface SiteRecord {
  id: SiteIdentity;
}

export interface PageProfileRecord {
  id: string;
  siteId: SiteIdentity;
  identityKey?: string;
  userAlias?: string;
}

export interface FieldProfileRecord {
  id: string;
  pageProfileId: string;
  identityKey?: string;
  userAlias?: string;
  /** Zero-based supported-field position last observed on its page. */
  documentOrder?: number;
  observedTitle?: string;
  /**
   * Task 036. This Field's editor did not accept an insertion. One boolean and
   * nothing else - no Template, no page content, no reason, no timestamp. It
   * exists so the Picker can offer the clipboard fallback up front instead of
   * making the user spend a click discovering the same failure again, and any
   * later successful insertion clears it.
   */
  insertionRejected?: boolean;
}

export interface BindingRecord {
  id: string;
  templateId: string;
  pageProfileId: string;
  fieldProfileId: string;
  createdAt: string;
  usageCount: number;
  revision: number;
  // Task 027 Addendum C.2: set when this Binding came from a Field-only
  // Shared Template Slot that was converted because its owner left a Set, or
  // the Set ended. Without it the Binding is indistinguishable from any
  // other, so the next Set the Field joins would union the Template into the
  // shared list and hand a deliberately private Template to every member -
  // the exact expansion this contract forbids. Absent on every ordinary
  // Binding, which keeps pre-Addendum-C behaviour unchanged.
  privateToField?: true;
}

/** A Site-owned HMAC key used only for opaque Logical Page Matching evidence. */
export interface LogicalPageSiteKeyRecord {
  id: string;
  siteId: SiteIdentity;
  encodedHmacKey: string;
}

/** One user-confirmed, exact-Origin logical page matching rule. */
export interface LogicalPageRuleRecord {
  id: string;
  siteId: SiteIdentity;
  siteKeyId: string;
  origin: string;
  routePattern: string;
  fieldFeatureHashes: string[];
  groupedFieldFeatureHashes: string[];
  pageProfileId: string;
}

/** The exact Field and Binding relationships produced by one confirmed match. */
export interface LogicalPageFieldProvenanceRecord {
  sourceFieldProfileId: string;
  canonicalFieldProfileId: string;
  bindingIds: string[];
}

/** One observed Page Profile relationship retained for safe future separation. */
export interface LogicalPageProvenanceRecord {
  id: string;
  ruleId: string;
  origin: string;
  sourcePageProfileId: string;
  canonicalPageProfileId: string;
  fieldMappings: LogicalPageFieldProvenanceRecord[];
}

/** Opaque evidence retained only for a PageProfile with a direct Binding. */
export interface LogicalPageObservationRecord {
  id: string;
  siteId: SiteIdentity;
  siteKeyId: string;
  origin: string;
  routePattern: string;
  fieldFeatureHashes: string[];
  groupedFieldFeatureHashes: string[];
  pageProfileId: string;
}

/**
 * A user's explicit "No" on one Compatibility Candidate Field pair (Task 024
 * Confirmed Contract): the pair must not be automatically re-offered. Order
 * of the two Field IDs carries no meaning - lookups are always
 * order-independent. There is no separate record for Confirm (the ordinary
 * Shared Template Set membership already records that relationship) or for
 * a plain Dismiss (transient UI state, not persisted).
 */
export interface CompatibilityPairDecisionRecord {
  id: string;
  fieldProfileIdA: string;
  fieldProfileIdB: string;
  createdAt: string;
}

export interface FillNestState {
  schemaVersion: 13;
  sites: SiteRecord[];
  templates: TemplateRecord[];
  pageProfiles: PageProfileRecord[];
  fieldProfiles: FieldProfileRecord[];
  bindings: BindingRecord[];
  logicalPageSiteKeys: LogicalPageSiteKeyRecord[];
  logicalPageRules: LogicalPageRuleRecord[];
  logicalPageProvenance: LogicalPageProvenanceRecord[];
  logicalPageObservations: LogicalPageObservationRecord[];
  sharedTemplateSets: SharedTemplateSetRecord[];
  sharedTemplateBindings: SharedTemplateBindingRecord[];
  sharedTemplateFieldStates: SharedTemplateFieldStateRecord[];
  compatibilityPairDecisions: CompatibilityPairDecisionRecord[];
  pickerPosition: PickerPosition | null;
  /**
   * Task 038. Where the user dragged the page status control, or `null` while
   * it still sits in its default corner. One position for every Site: the
   * corner that is out of the way is usually out of the way everywhere, and a
   * Site-scoped record would have to be understood by Clear Site Data, Remove
   * Site, Backup and Reset to buy a precision few people would use.
   */
  pageStatusPosition: PickerPosition | null;
}

export function createInitialFillNestState(): FillNestState {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    sites: [],
    templates: [],
    pageProfiles: [],
    fieldProfiles: [],
    bindings: [],
    logicalPageSiteKeys: [],
    logicalPageRules: [],
    logicalPageProvenance: [],
    logicalPageObservations: [],
    sharedTemplateSets: [],
    sharedTemplateBindings: [],
    sharedTemplateFieldStates: [],
    compatibilityPairDecisions: [],
    pickerPosition: null,
    pageStatusPosition: null,
  };
}
