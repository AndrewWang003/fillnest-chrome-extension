import type { LogicalPageEvidence } from "../recognition/logical-page-matching";
import type { SiteIdentity } from "../domain/site";
import type {
  BindingRecord, 
  
  TemplateRecord,
} from "./records";
import type {
  SharedTemplateBindingRecord, SharedTemplateFieldStateRecord, SharedTemplateSetRecord,
} from "./shared-templates";

/**
 * The input and result shapes of every repository command.
 *
 * Task 032 moved these out of `fillnest-repository.ts` - roughly ninety
 * declarations, about a sixth of that module, so reading the commands meant
 * scrolling past the vocabulary first. Types erase at runtime, so this move
 * cannot change behaviour: a mistake here is a compile error, which is why it
 * runs before the command bodies rather than after.
 */

export interface RepositoryDependencies {
  createId(): string;
  now(): string;
}

export interface LogicalPageSiteKeyResult {
  siteId: SiteIdentity;
  siteKeyId: string;
  encodedHmacKey: string;
}

export interface RecordLogicalPageObservationInput {
  pageUrl: string;
  pageProfileId: string;
  siteKeyId: string;
  evidence: LogicalPageEvidence;
}

export interface CreateTemplateInput {
  content: string;
  pageUrl: string;
}

export interface UpdateTemplateInput {
  templateId: string;
  content: string;
}

export interface DeleteTemplateInput {
  templateId: string;
}

export interface RestoreTemplateInput {
  template: TemplateRecord;
  bindings: BindingRecord[];
  sharedBindings?: SharedTemplateBindingRecord[];
  // Task 026: the Overrides/Exclusions the deletion's own slot removal took
  // down with it - restored only for a slot that itself gets restored, so a
  // stale slot never resurrects a dangling relationship.
  fieldStates?: SharedTemplateFieldStateRecord[];
}

export interface DeleteTemplatesInput {
  templateIds: string[];
}

export interface DeleteTemplatesResult {
  deletedTemplateIds: string[];
}

export interface ResetSiteMappingsInput {
  siteId: SiteIdentity;
  expectedImpact?: ResetSiteMappingsExpectedImpact;
}

export interface ResetSiteMappingsBatchInput {
  sites: ResetSiteMappingsInput[];
}

export interface ResetSiteMappingsResult {
  pageProfileIds: string[];
  fieldProfileIds: string[];
  bindingIds: string[];
  newlyGlobalTemplates: TemplateRecord[];
  endedSharedTemplateSetCount: number;
  didMutate: boolean;
}

export interface DeleteNewlyGlobalTemplatesInput {
  templates: Array<{ id: string; expectedRevision: number }>;
}

export interface DeleteNewlyGlobalTemplatesResult {
  deleted: RestoreTemplateInput[];
}

export interface ResetSiteMappingsExpectedImpact {
  pageProfileCount: number;
  fieldProfileCount: number;
  bindingCount: number;
  pageAliasCount: number;
  fieldAliasCount: number;
  templateAffinityCount: number;
  logicalPageRuleCount: number;
  sharedTemplateSetCount: number;
}

export interface SiteMappingScope {
  pageIds: Set<string>;
  fieldIds: Set<string>;
  bindingIds: Set<string>;
}

export interface RestoreTemplatesInput {
  templates: RestoreTemplateInput[];
}

export interface RestoreTemplatesFailure {
  templateId: string;
  reason: string;
}

export interface RestoreTemplatesResult {
  restored: TemplateRecord[];
  failed: RestoreTemplatesFailure[];
}

export interface RecordInsertionInput {
  templateId: string;
  fieldProfileId: string;
}

export interface SetPageAliasInput {
  pageProfileId: string;
  alias: string;
}

export interface SetFieldAliasInput {
  fieldProfileId: string;
  alias: string;
  newField?: BindingTargetInput;
}

export interface SaveTemplateCopyForFieldInput {
  templateId: string;
  fieldProfileId: string;
  content: string;
}

export interface SaveTemplateCopyForFieldResult {
  template: TemplateRecord;
  binding: BindingRecord;
}

export interface SaveTemplateCopyForSharedSetInput {
  // Task 027 Addendum A (defect F): the exact slot to copy into, never a
  // bare `templateId` - a Set may hold both an ordinary and an owner-only
  // slot for the same Template (A.1 coexistence), and a `templateId` alone
  // cannot tell them apart.
  setId: string;
  slotId: string;
  content: string;
}

export interface SaveTemplateCopyForSharedSetResult {
  template: TemplateRecord;
  sharedBinding: SharedTemplateBindingRecord;
}

/** "Save for this field" (Task 026): creates an Override for one member only. */
export interface SaveTemplateOverrideForFieldInput {
  setId: string;
  slotId: string;
  fieldProfileId: string;
  content: string;
}

export interface SaveTemplateOverrideForFieldResult {
  template: TemplateRecord;
  state: SharedTemplateFieldStateRecord;
}

export interface UndoSaveTemplateOverrideForFieldInput {
  copyTemplateId: string;
  // The exact prior state for this (set, field, slot) triple - `null` means
  // it was plain inheritance (no row) before this Override was created.
  previousState: SharedTemplateFieldStateRecord | null;
}

/**
 * "Remove from this field" for a Shared Template Set member (Task 026):
 * excludes slot `slotId` for `fieldProfileId` only, whether that Field
 * currently inherits the slot's base Template or has its own Override.
 */
export interface ExcludeSharedTemplateForFieldInput {
  setId: string;
  slotId: string;
  fieldProfileId: string;
}

export interface ExcludeSharedTemplateForFieldResult {
  state: SharedTemplateFieldStateRecord;
  // The Override this Exclusion replaced, if any - deleting it is not part
  // of this same atomic commit's data loss surface (Undo restores it), but
  // callers may want to know whether one existed.
  replacedOverrideTemplateId: string | null;
}

export interface UndoExcludeSharedTemplateForFieldInput {
  setId: string;
  slotId: string;
  fieldProfileId: string;
  // The exact prior state for this (set, field, slot) triple - `null` means
  // it was plain inheritance (no row) before this Exclusion was created.
  previousState: SharedTemplateFieldStateRecord | null;
}

export interface UndoBindInput {
  bindingId: string;
}

export interface UndoUnbindInput {
  binding: BindingRecord;
}

export interface UndoSaveInput {
  template: TemplateRecord;
  expectedRevision: number;
}

export interface UndoSaveCopyForFieldInput {
  copyTemplateId: string;
  originalBinding: BindingRecord;
}

export interface UndoSaveTemplateCopyForSharedSetInput {
  copyTemplateId: string;
  originalSharedBinding: SharedTemplateBindingRecord;
}

export interface BindingTargetInput {
  pageUrl: string;
  pageProfileId: string;
  fieldProfileId: string;
  pageIdentityKey?: string;
  fieldIdentityKey?: string;
  fieldDocumentOrder?: number;
  fieldObservedTitle?: string;
}

export interface BindTemplateInput extends BindingTargetInput {
  templateId: string;
}

export interface CreateTemplateAndBindInput extends BindingTargetInput {
  content: string;
  // Task 027 Addendum D: save this Template as private to the Target Field,
  // before that Field has ever been shared. Marking it here is the only
  // moment the user can express the intent - once the Field joins a Set,
  // every unmarked Binding is unioned into the shared list.
  privateToField?: true;
}

export interface CreatedTemplateBinding {
  template: TemplateRecord;
  binding: BindingRecord;
}

export interface UnbindTemplateInput {
  templateId: string;
  fieldProfileId: string;
}

export interface CreateSharedTemplateSetInput {
  fieldProfileIds: string[];
  // Identity data to create any of the referenced Fields' durable Profiles
  // on demand, for whichever ones don't exist yet. "Candidates are every
  // reliably identified FieldProfile in the current Site, whether or not
  // that Field currently has a Template. Two empty Fields may create a
  // Shared Template Set" (Task 015 Accepted Contract) - a Field otherwise
  // becomes durable only through an actual Bind, so both the Field the
  // user is sharing *from* and any candidate Field discovered live on a
  // page may never have been persisted before.
  newFields?: BindingTargetInput[];
  // Task 024: the only authorized way a Shared Template Set may span Sites -
  // never inferred, always this one explicit flag set by the Link command.
  // Every other caller (Task 015/021's own Add Fields) omits it and keeps
  // the original Site-local-only behavior unchanged.
  allowCrossSite?: boolean;
}

export interface CreateSharedTemplateSetResult {
  set: SharedTemplateSetRecord;
  sharedBindings: SharedTemplateBindingRecord[];
}

export interface UndoCreateSharedTemplateSetInput {
  setId: string;
}

export interface AddSharedTemplateSetMemberInput {
  setId: string;
  fieldProfileId: string;
  // Identity data to create this Field's durable Profile on demand, if it
  // doesn't exist yet - the same "empty Field" allowance
  // createSharedTemplateSet has, needed here too since a Field discovered
  // live on a page after a set already exists is just as likely to have
  // never been bound to anything.
  newField?: BindingTargetInput;
  // Task 024: see CreateSharedTemplateSetInput.allowCrossSite.
  allowCrossSite?: boolean;
}

export interface SharedMemberAddUndo {
  previousSet: SharedTemplateSetRecord;
  expectedSet: SharedTemplateSetRecord;
  previousSharedBindings: SharedTemplateBindingRecord[];
  expectedSharedBindings: SharedTemplateBindingRecord[];
}

export interface AddSharedTemplateSetMemberResult extends SharedTemplateSetRecord {
  undo: SharedMemberAddUndo;
}

export interface UndoAddSharedTemplateSetMemberInput extends SharedMemberAddUndo {
  setId: string;
  fieldProfileId: string;
}

export interface RemoveSharedTemplateSetMemberInput {
  setId: string;
  fieldProfileId: string;
}

export interface RemoveSharedTemplateSetMemberResult {
  /** `null` once the set has ended because its last member just left. */
  set: SharedTemplateSetRecord | null;
  ended: boolean;
  newlyGlobalTemplates: TemplateRecord[];
  /** Direct Bindings created from the Shared list for the departing Field. */
  snapshotBindings: BindingRecord[];
  /**
   * Direct Bindings which were dormant while their Fields belonged to the
   * Set. They are removed before saving the effective snapshot, otherwise a
   * superseded or excluded pre-share Template would be resurrected. Undo
   * restores them verbatim with the Set membership.
   */
  dormantBindings: BindingRecord[];
  /**
   * Task 027: the departing Field's own Field-only slot(s) in this Set, if
   * any - removed from `sharedTemplateBindings` when the Set survives with
   * other members, since their content already lives in `snapshotBindings`
   * as a direct Binding for the departing Field alone.
   */
  removedOwnedSlots: SharedTemplateBindingRecord[];
  /**
   * Task 026: every `sharedTemplateFieldStates` row this removal deleted -
   * the departing Field's own Overrides/Exclusions always, plus every
   * remaining member's if the removal ended (or dissolved) the whole Set.
   * `Stop sharing` "preserves its Overrides and Exclusions" by converting
   * them into the same snapshot direct Bindings above; this list exists so
   * Undo can restore the rows exactly rather than losing them.
   */
  removedFieldStates: SharedTemplateFieldStateRecord[];
}

export interface UndoRemoveSharedTemplateSetMemberInput {
  fieldProfileId: string;
  /** The full pre-removal set, so Undo can restore it whether or not removal ended it. */
  set: SharedTemplateSetRecord;
  /** The set's shared Bindings at removal time - only used if the removal ended the set. */
  endedSharedBindings: SharedTemplateBindingRecord[];
  /** Exact direct Bindings created by the removal, so Undo deletes no older direct Binding. */
  snapshotBindings: BindingRecord[];
  /** Exact dormant direct Bindings removed by the transition, restored by Undo. */
  dormantBindings: BindingRecord[];
  /** Task 027: the departing Field's own Field-only slot(s) removed from the surviving Set, restored by Undo. */
  removedOwnedSlots: SharedTemplateBindingRecord[];
  /** Task 026: the exact field-state rows this removal deleted, restored verbatim. */
  removedFieldStates: SharedTemplateFieldStateRecord[];
}

export interface EndSharedTemplateSetInput {
  setId: string;
}

export interface EndSharedTemplateSetResult {
  memberFieldProfileIds: string[];
  newlyGlobalTemplates: TemplateRecord[];
  /** Task 026: every member's Override/Exclusion row this ending deleted. */
  endedFieldStates: SharedTemplateFieldStateRecord[];
  /**
   * Task 021 Addendum B (owner decision, 2026-09-11): every member keeps the
   * Templates it was offered, as direct Bindings - its effective list, with
   * its Overrides, Exclusions and Field-only privacy - in place of its
   * dormant ones. The same conversion leaving a Set performs.
   */
  convertedBindings: BindingRecord[];
  /** The members' dormant direct Bindings the conversion replaced. */
  dormantBindings: BindingRecord[];
}

export interface UndoEndSharedTemplateSetInput {
  set: SharedTemplateSetRecord;
  sharedBindings: SharedTemplateBindingRecord[];
  /** Task 026: the exact field-state rows this ending deleted, restored verbatim. */
  endedFieldStates: SharedTemplateFieldStateRecord[];
  /** Task 021 Addendum B: reverses the conversion, restoring the dormant Bindings. */
  convertedBindings: BindingRecord[];
  dormantBindings: BindingRecord[];
}

export interface RenameSharedTemplateSetInput {
  setId: string;
  name: string;
}

export interface FindSimilarFieldCandidatesInput {
  fieldProfileId: string;
  // Identity data to evaluate the Current Field's compatibility evidence
  // in memory when it has no durable Field Profile yet - "An empty Current
  // Field may still open 'Find similar field'" (Task 024 Confirmed
  // Contract). This read-only query never persists it; only an actual Link
  // creates a durable Field Profile, via the existing on-demand-creation
  // path every mutation command already uses.
  newField?: BindingTargetInput;
}

/** One discoverable Field, enriched with the display data the Target Field Picker (Task 024) needs. */
export interface CompatibilityCandidateView {
  fieldProfileId: string;
  siteId: SiteIdentity;
  pageProfileId: string;
  siteLabel: string;
  pageLabel: string;
  fieldLabel: string;
  crossSite: boolean;
  highConfidence: boolean;
  decided: boolean;
  alreadyLinked: boolean;
  templateCount: number;
  templatePreviews: string[];
  // Task 024 Slice 3: the candidate's own current Shared Template Set (if
  // any, and if not the same one `alreadyLinked` already covers) - the
  // Link command needs this to know whether linking would merely add a
  // member, or actually merge two already-distinct Sets.
  existingSetId: string | null;
  existingSetMemberCount: number;
}

export interface FindSimilarFieldCandidatesResult {
  currentFieldLabel: string;
  candidates: CompatibilityCandidateView[];
  suggestedFieldProfileId: string | null;
  /**
   * Task 024 Addendum C: every high-confidence candidate, offered at once,
   * when they are all rich-text editing hosts and none is shared yet. Empty
   * whenever the group rule does not apply - `suggestedFieldProfileId` still
   * carries the ordinary single-candidate offer then.
   */
  suggestedGroupFieldProfileIds: string[];
}

export interface RecordCompatibilityPairNoInput {
  fieldProfileIdA: string;
  fieldProfileIdB: string;
}

export interface MergeSharedTemplateSetsInput {
  keepSetId: string;
  removeSetId: string;
}

export interface MergeSharedTemplateSetsResult {
  set: SharedTemplateSetRecord;
  bindings: SharedTemplateBindingRecord[];
  removedSet: SharedTemplateSetRecord;
  removedSetBindings: SharedTemplateBindingRecord[];
  previousKeepSet: SharedTemplateSetRecord;
  previousKeepSetBindings: SharedTemplateBindingRecord[];
  // Task 026 acceptance 6: when a cross-Site merge deduplicates the same
  // base Template from both Sets, the Current Field Set's slot is the
  // canonical surviving slot - every Override and Exclusion the removed
  // Set's members held against their own (now-gone) slot is atomically
  // remapped onto that canonical slot (or onto the fresh slot created for a
  // Template exclusive to the removed Set) so no relationship is silently
  // lost or reattached to an unrelated slot.
  remappedFieldStates: SharedTemplateFieldStateRecord[];
  previousRemovedSetFieldStates: SharedTemplateFieldStateRecord[];
}

export interface UndoMergeSharedTemplateSetsInput {
  // The merged Set exactly as `mergeSharedTemplateSets` left it - Undo
  // verifies the stored Set still matches this snapshot (Task 010's global
  // rule: any later successful mutation invalidates a pending Undo) before
  // discarding it and restoring the two pre-merge Sets.
  mergedSet: SharedTemplateSetRecord;
  mergedSetBindings: SharedTemplateBindingRecord[];
  previousKeepSet: SharedTemplateSetRecord;
  previousKeepSetBindings: SharedTemplateBindingRecord[];
  removedSet: SharedTemplateSetRecord;
  removedSetBindings: SharedTemplateBindingRecord[];
  remappedFieldStates: SharedTemplateFieldStateRecord[];
  previousRemovedSetFieldStates: SharedTemplateFieldStateRecord[];
}

export interface CreateTemplateAndBindSharedInput {
  setId: string;
  content: string;
}

export interface CreatedSharedTemplateBinding {
  template: TemplateRecord;
  sharedBinding: SharedTemplateBindingRecord;
}

export interface UndoCreateTemplateAndBindSharedInput {
  setId: string;
  sharedBindingId: string;
  templateId: string;
}

/**
 * "Save only for this field" (Task 026): a brand-new Template created from
 * a Shared Template Set member field is a new slot no other CURRENT member
 * can see - every other member gets an immediate Exclusion for it, so it
 * behaves exactly like an ordinary private Template despite living inside
 * the Set's own slot structure (a later new member would otherwise inherit
 * it, which "for this field only" must never allow).
 */
export interface CreateTemplateAndBindSharedFieldOnlyInput {
  setId: string;
  fieldProfileId: string;
  content: string;
}

export interface CreateTemplateAndBindSharedFieldOnlyResult {
  template: TemplateRecord;
  sharedBinding: SharedTemplateBindingRecord;
}

export interface UndoCreateTemplateAndBindSharedFieldOnlyInput {
  setId: string;
  sharedBindingId: string;
  templateId: string;
}

export interface BindTemplateSharedInput {
  setId: string;
  templateId: string;
  fieldProfileId?: string;
}

export interface UndoBindTemplateSharedInput {
  sharedBindingId: string;
}

/**
 * Task 027 Confirmed Contract: "Bind to this field" from a Shared Set
 * member's Search results creates a Field-only relationship for an existing
 * Template found elsewhere - the current Field is the sole owner; every
 * other current or future member simply never resolves this slot at all
 * (`ownerFieldProfileId`, checked by the resolver ahead of any Override/
 * Exclusion logic), rather than needing an explicit Exclusion each.
 */
export interface BindTemplateToFieldOnlyInput {
  setId: string;
  fieldProfileId: string;
  templateId: string;
}

export interface BindTemplateToFieldOnlyResult {
  sharedBinding: SharedTemplateBindingRecord;
}

export interface UndoBindTemplateToFieldOnlyInput {
  setId: string;
  sharedBinding: SharedTemplateBindingRecord;
}

/**
 * Task 027 Confirmed Contract: "Share this version" is the sole action that
 * broadens a Field-only relationship - it promotes the relationship, not
 * the Template entity, to a normal Shared Template Slot every current
 * member resolves normally. This variant promotes within the owner's own
 * current Set (no membership change); `joinSetAndShare`/`mergeSetsAndShare`
 * cover the composite cases where the target belongs to a different Set.
 */
export interface PromoteFieldOnlySlotInput {
  setId: string;
  slotId: string;
  // Task 027 Confirmed Contract: a Field-only relationship "may be expanded
  // only by an explicit action by its owner." The acting Field is therefore
  // part of the command, not a UI convention - the repository asserts it.
  fieldProfileId: string;
}

export interface PromoteFieldOnlySlotResult {
  // Task 027 Addendum A.3: the slot the promotion left behind - the same
  // slot with its owner cleared (mode 1), or the pre-existing ordinary slot
  // the owner-only slot was consumed into (mode 2, when the Set already
  // shares this Template).
  sharedBinding: SharedTemplateBindingRecord;
  previousOwnerFieldProfileId: string;
  // Mode 2 only: the owner-only slot deleted into `sharedBinding`, that
  // ordinary slot's exact state immediately before consuming (Undo's
  // staleness reconstruction), and every field-state row deleted alongside
  // the consumed slot (the owner's own Override/Exclusion on either slot).
  consumedSlot?: SharedTemplateBindingRecord;
  previousOrdinarySlot?: SharedTemplateBindingRecord;
  removedFieldStates?: SharedTemplateFieldStateRecord[];
  previousSlot?: SharedTemplateBindingRecord;
}

export interface UndoPromoteFieldOnlySlotInput {
  setId: string;
  slotId: string;
  ownerFieldProfileId: string;
  consumedSlot?: SharedTemplateBindingRecord;
  previousOrdinarySlot?: SharedTemplateBindingRecord;
  removedFieldStates?: SharedTemplateFieldStateRecord[];
  previousSlot?: SharedTemplateBindingRecord;
}

/**
 * Task 027 Confirmed Contract: "When a requested target belongs to a
 * different existing Set, the UI may offer one explicit composite action:
 * `Join Set & Share`... It must never join or merge Sets silently." This
 * atomically adds the (previously unshared) target Field to the owner's own
 * current Set and promotes the named Field-only slot in the same
 * transaction, reusing `addSharedTemplateSetMember`'s own logic and Undo
 * shape for the membership half.
 */
export interface JoinSetAndShareInput {
  setId: string;
  slotId: string;
  // The owner performing the share - see PromoteFieldOnlySlotInput.
  fieldProfileId: string;
  targetFieldProfileId: string;
  newField?: BindingTargetInput;
  // Task 027 Addendum B: the Picker's Finder-derived candidate list includes
  // cross-Site matches (Task 024), so the composite must accept the same
  // explicit `allowCrossSite` flag `addSharedTemplateSetMember` already
  // requires for a cross-Site add - never implied, never defaulted true.
  allowCrossSite?: boolean;
}

export interface JoinSetAndShareResult {
  set: SharedTemplateSetRecord;
  sharedBinding: SharedTemplateBindingRecord;
  addUndo: SharedMemberAddUndo;
  previousOwnerFieldProfileId: string;
  // Task 027 Addendum A.3: present only when the promotion consumed the
  // owner-only slot into a pre-existing ordinary slot (mode 2).
  consumedSlot?: SharedTemplateBindingRecord;
  previousOrdinarySlot?: SharedTemplateBindingRecord;
  removedFieldStates?: SharedTemplateFieldStateRecord[];
  previousSlot?: SharedTemplateBindingRecord;
}

export interface UndoJoinSetAndShareInput {
  setId: string;
  targetFieldProfileId: string;
  addUndo: SharedMemberAddUndo;
  slotId: string;
  ownerFieldProfileId: string;
  consumedSlot?: SharedTemplateBindingRecord;
  previousOrdinarySlot?: SharedTemplateBindingRecord;
  removedFieldStates?: SharedTemplateFieldStateRecord[];
  previousSlot?: SharedTemplateBindingRecord;
}

/**
 * Task 027 Confirmed Contract: the `Merge Sets & Share` composite action,
 * covering a target already in a different existing Set. Reuses
 * `mergeSharedTemplateSets` (keepSetId is always the owner's own Set, so the
 * promoted slot's own id survives the merge unchanged) plus the same
 * promotion step as `promoteFieldOnlySlot`, atomically.
 */
export interface MergeSetsAndShareInput {
  keepSetId: string;
  removeSetId: string;
  slotId: string;
  // The owner performing the share - see PromoteFieldOnlySlotInput.
  fieldProfileId: string;
}

export interface MergeSetsAndShareResult extends MergeSharedTemplateSetsResult {
  sharedBinding: SharedTemplateBindingRecord;
  previousOwnerFieldProfileId: string;
  // Task 027 Addendum A.3 (defect G): present only when the promotion
  // consumed the owner-only slot into a slot the merge already brought into
  // the kept Set (mode 2 - the other Set already shared this Template).
  consumedSlot?: SharedTemplateBindingRecord;
  previousOrdinarySlot?: SharedTemplateBindingRecord;
  removedFieldStates?: SharedTemplateFieldStateRecord[];
  previousSlot?: SharedTemplateBindingRecord;
}

export interface UndoMergeSetsAndShareInput extends UndoMergeSharedTemplateSetsInput {
  slotId: string;
  ownerFieldProfileId: string;
  consumedSlot?: SharedTemplateBindingRecord;
  previousOrdinarySlot?: SharedTemplateBindingRecord;
  removedFieldStates?: SharedTemplateFieldStateRecord[];
  previousSlot?: SharedTemplateBindingRecord;
}

export interface UnbindTemplateSharedInput {
  // Task 027 Addendum A (defect A): a specific slot, never a bare
  // `templateId` - a Set may hold both an ordinary and an owner-only slot
  // for the same Template (A.1 coexistence), and unbinding by `templateId`
  // alone would delete every slot for it, including a peer's owner-only one.
  setId: string;
  slotId: string;
}

export interface UndoUnbindTemplateSharedInput {
  sharedBinding: SharedTemplateBindingRecord;
  fieldStates: SharedTemplateFieldStateRecord[];
}

export interface ResolveFieldContextInput {
  pageUrl: string;
  pageIdentityKey: string | null;
  fieldIdentityKey: string | null;
}

export interface FieldContextResolution {
  siteId: SiteIdentity;
  pageProfileId: string;
  fieldProfileId: string;
  recognized: boolean;
}

/** Opaque evidence supplied for a Logical Page candidate resolution lookup. */
export interface ResolveLogicalPageCandidateInput {
  evidence: LogicalPageEvidence;
}

export interface LogicalPageReviewCandidate {
  id: string;
  ruleId: string;
  canonicalPageProfileId: string;
  reviewRequired: true;
}

/** The resolver returns either recognized context or a reviewable candidate, never both. */
export type LogicalPageCandidateResolution =
  | (FieldContextResolution & { candidate: null })
  | (FieldContextResolution & { recognized: false; candidate: LogicalPageReviewCandidate });

/** Confirms one reviewed Logical Page candidate as an atomic Rule creation and Field/Binding merge. */
export interface ConfirmLogicalPageCandidateInput {
  ruleId: string;
  canonicalPageProfileId: string;
  /** The exact-Origin same-Page identity of the page currently being reviewed, if it already exists. */
  pageIdentityKey: string | null;
  evidence: LogicalPageEvidence;
}

export interface StopLogicalPageMatchingInput {
  ruleId: string;
}

/** The Fields whose relationships were separated back out by a `Stop matching`. */
export interface StopLogicalPageMatchingResult {
  separatedFieldProfileIds: string[];
}
