import {
  rankCandidates,
  selectAutomaticGroupSuggestion,
  selectAutomaticSuggestion,
  type GroupSuggestionFacts,
  type CompatibilityFieldEvidence,
  type CompatibilityPairDecision,
} from "../compatibility/candidate-ranking";
import { classifyCompatibilityKind } from "../compatibility/compatibility-kind";
import { parseGenericFieldTypeEvidence } from "../compatibility/field-type-evidence";
import { siteIdentityFromUrl, type SiteIdentity } from "../domain/site";
import { en } from "../i18n/messages";
import { fieldDisplayName, pageDisplayName } from "../labels/display-label";
import {
  buildRoutePattern,
  routePatternMatches,
  matchesBothSimilarityThresholds,
} from "../recognition/logical-page-matching";
import { InvalidStoredDataError } from "./invalid-stored-data-error";
import {
  migrateV1ToV2, migrateV2ToV3, migrateV3ToV4, migrateV4ToV5, migrateV5ToV6,
  migrateV6ToV7, migrateV7ToV8, migrateV8ToV9, migrateV9ToV10, migrateV10ToV11, migrateV11ToV12, migrateV12ToV13,
} from "./migrations";
import { type PickerPosition } from "./picker-position";
import type {
  AddSharedTemplateSetMemberInput,
  AddSharedTemplateSetMemberResult,
  BindTemplateInput,
  BindTemplateSharedInput,
  BindTemplateToFieldOnlyInput,
  BindTemplateToFieldOnlyResult,
  CompatibilityCandidateView,
  ConfirmLogicalPageCandidateInput,
  CreateSharedTemplateSetInput,
  CreateSharedTemplateSetResult,
  CreateTemplateAndBindInput,
  CreateTemplateAndBindSharedFieldOnlyInput,
  CreateTemplateAndBindSharedFieldOnlyResult,
  CreateTemplateAndBindSharedInput,
  CreateTemplateInput,
  CreatedSharedTemplateBinding,
  CreatedTemplateBinding,
  DeleteNewlyGlobalTemplatesInput,
  DeleteNewlyGlobalTemplatesResult,
  DeleteTemplateInput,
  DeleteTemplatesInput,
  DeleteTemplatesResult,
  EndSharedTemplateSetInput,
  EndSharedTemplateSetResult,
  ExcludeSharedTemplateForFieldInput,
  ExcludeSharedTemplateForFieldResult,
  FieldContextResolution,
  FindSimilarFieldCandidatesInput,
  FindSimilarFieldCandidatesResult,
  JoinSetAndShareInput,
  JoinSetAndShareResult,
  LogicalPageCandidateResolution,
  LogicalPageSiteKeyResult,
  MergeSetsAndShareInput,
  MergeSetsAndShareResult,
  MergeSharedTemplateSetsInput,
  MergeSharedTemplateSetsResult,
  PromoteFieldOnlySlotInput,
  PromoteFieldOnlySlotResult,
  RecordCompatibilityPairNoInput,
  RecordInsertionInput,
  RecordLogicalPageObservationInput,
  RemoveSharedTemplateSetMemberInput,
  RemoveSharedTemplateSetMemberResult,
  RenameSharedTemplateSetInput,
  RepositoryDependencies,
  ResetSiteMappingsBatchInput,
  ResetSiteMappingsResult,
  ResolveFieldContextInput,
  ResolveLogicalPageCandidateInput,
  RestoreTemplateInput,
  RestoreTemplatesInput,
  RestoreTemplatesResult,
  SaveTemplateCopyForFieldInput,
  SaveTemplateCopyForFieldResult,
  SaveTemplateCopyForSharedSetInput,
  SaveTemplateCopyForSharedSetResult,
  SaveTemplateOverrideForFieldInput,
  SaveTemplateOverrideForFieldResult,
  SetFieldAliasInput,
  SetPageAliasInput,
  StopLogicalPageMatchingInput,
  StopLogicalPageMatchingResult,
  UnbindTemplateInput,
  UnbindTemplateSharedInput,
  UndoAddSharedTemplateSetMemberInput,
  UndoBindInput,
  UndoBindTemplateSharedInput,
  UndoBindTemplateToFieldOnlyInput,
  UndoCreateSharedTemplateSetInput,
  UndoCreateTemplateAndBindSharedFieldOnlyInput,
  UndoCreateTemplateAndBindSharedInput,
  UndoEndSharedTemplateSetInput,
  UndoExcludeSharedTemplateForFieldInput,
  UndoJoinSetAndShareInput,
  UndoMergeSetsAndShareInput,
  UndoMergeSharedTemplateSetsInput,
  UndoPromoteFieldOnlySlotInput,
  UndoRemoveSharedTemplateSetMemberInput,
  UndoSaveCopyForFieldInput,
  UndoSaveInput,
  UndoSaveTemplateCopyForSharedSetInput,
  UndoSaveTemplateOverrideForFieldInput,
  UndoUnbindInput,
  UndoUnbindTemplateSharedInput,
  UpdateTemplateInput,
} from "./repository-inputs";
import {
  validateCandidateState, 
  
  
  
} from "./state-validation";
import {
  addSite,
  prepareBindingProfiles,
} from "./state-helpers";
export { deriveResetSiteMappingsImpact, deriveSiteMappingScope } from "./state-helpers";
import {
  bindTemplateTransition,
  recordInsertionRejectionTransition,
  recordInsertionTransition,
  unbindTemplateTransition,
  undoBindTransition,
  undoUnbindTransition,
} from "./binding-commands";
import {
  bindTemplateToFieldOnlyTransition,
  createTemplateAndBindSharedFieldOnlyTransition,
  createTemplateAndBindSharedTransition,
  endSharedTemplateSetTransition,
  excludeSharedTemplateForFieldTransition,
  removeSharedTemplateSetMemberTransition,
  renameSharedTemplateSetTransition,
  saveTemplateCopyForSharedSetTransition,
  saveTemplateOverrideForFieldTransition,
  unbindTemplateSharedTransition,
  undoBindTemplateSharedTransition,
  undoBindTemplateToFieldOnlyTransition,
  undoCreateTemplateAndBindSharedFieldOnlyTransition,
  undoCreateTemplateAndBindSharedTransition,
  undoEndSharedTemplateSetTransition,
  undoExcludeSharedTemplateForFieldTransition,
  undoRemoveSharedTemplateSetMemberTransition,
  undoSaveTemplateCopyForSharedSetTransition,
  undoSaveTemplateOverrideForFieldTransition,
  undoUnbindTemplateSharedTransition,
  bindTemplateSharedTransition,
} from "./shared-set-commands";
import {
  recordCompatibilityPairNoTransition,
  setPageAliasTransition,
  stopLogicalPageMatchingTransition,
  setFieldAliasTransition,
  matchingLogicalPageObservation,
  resetSiteMappingsBatchTransition,
  confirmLogicalPageCandidateTransition,
} from "./page-commands";
import {
  mergeSharedTemplateSetsTransition,
  promoteFieldOnlySlotTransition,
  undoAddSharedTemplateSetMemberTransition,
  undoCreateSharedTemplateSetTransition,
  undoMergeSharedTemplateSetsTransition,
  undoPromoteFieldOnlySlotTransition,
  createSharedTemplateSetTransition,
  addSharedTemplateSetMemberTransition,
} from "./composite-set-commands";
import {
  createTemplateAndBindTransition,
  createTemplateTransition,
  deleteNewlyGlobalTemplatesTransition,
  deleteTemplateTransition,
  deleteTemplatesTransition,
  restoreTemplateTransition,
  restoreTemplatesTransition,
  saveTemplateCopyForFieldTransition,
  undoSaveCopyForFieldTransition,
  undoSaveTransition,
  updateTemplateTransition,
  type StateTransition,
} from "./template-commands";
// Re-exported so every existing import site keeps working; the definitions
// moved out so command modules can throw them without a cycle.
export {
  LogicalPageSeparationError,
  StaleImpactError,
  StaleLogicalPageCandidateError,
  StaleUndoError,
} from "./stale-errors";
import {
} from "./stale-errors";
import {
  createInitialFillNestState,
  type BindingRecord, type CompatibilityPairDecisionRecord, type FieldProfileRecord,
  type FillNestState, type LogicalPageObservationRecord,
  
  type PageProfileRecord, type TemplateRecord,
} from "./records";
import {
  effectiveTemplateListForField,
  type EffectiveTemplateList,
  type SharedTemplateBindingRecord,
  type SharedTemplateSetRecord,
} from "./shared-templates";
import {
  isRecord,
} from "./value-guards";

// Task 031 extracted the Shared Template Set subsystem into
// `./shared-templates`, and the stored-data error into its own module so that
// extraction could not create an import cycle. Both are re-exported here so
// every existing importer of this module is unaffected.
export { InvalidStoredDataError };
export { isPickerPosition, type PickerPosition } from "./picker-position";
export type {
  AddSharedTemplateSetMemberInput,
  AddSharedTemplateSetMemberResult,
  BindTemplateInput,
  BindTemplateSharedInput,
  BindTemplateToFieldOnlyInput,
  BindTemplateToFieldOnlyResult,
  BindingTargetInput,
  CompatibilityCandidateView,
  ConfirmLogicalPageCandidateInput,
  CreateSharedTemplateSetInput,
  CreateSharedTemplateSetResult,
  CreateTemplateAndBindInput,
  CreateTemplateAndBindSharedFieldOnlyInput,
  CreateTemplateAndBindSharedFieldOnlyResult,
  CreateTemplateAndBindSharedInput,
  CreateTemplateInput,
  CreatedSharedTemplateBinding,
  CreatedTemplateBinding,
  DeleteNewlyGlobalTemplatesInput,
  DeleteNewlyGlobalTemplatesResult,
  DeleteTemplateInput,
  DeleteTemplatesInput,
  DeleteTemplatesResult,
  EndSharedTemplateSetInput,
  EndSharedTemplateSetResult,
  ExcludeSharedTemplateForFieldInput,
  ExcludeSharedTemplateForFieldResult,
  FieldContextResolution,
  FindSimilarFieldCandidatesInput,
  FindSimilarFieldCandidatesResult,
  JoinSetAndShareInput,
  JoinSetAndShareResult,
  LogicalPageCandidateResolution,
  LogicalPageReviewCandidate,
  LogicalPageSiteKeyResult,
  MergeSetsAndShareInput,
  MergeSetsAndShareResult,
  MergeSharedTemplateSetsInput,
  MergeSharedTemplateSetsResult,
  PromoteFieldOnlySlotInput,
  PromoteFieldOnlySlotResult,
  RecordCompatibilityPairNoInput,
  RecordInsertionInput,
  RecordLogicalPageObservationInput,
  RemoveSharedTemplateSetMemberInput,
  RemoveSharedTemplateSetMemberResult,
  RenameSharedTemplateSetInput,
  RepositoryDependencies,
  ResetSiteMappingsBatchInput,
  ResetSiteMappingsExpectedImpact,
  ResetSiteMappingsInput,
  ResetSiteMappingsResult,
  ResolveFieldContextInput,
  ResolveLogicalPageCandidateInput,
  RestoreTemplateInput,
  RestoreTemplatesFailure,
  RestoreTemplatesInput,
  RestoreTemplatesResult,
  SaveTemplateCopyForFieldInput,
  SaveTemplateCopyForFieldResult,
  SaveTemplateCopyForSharedSetInput,
  SaveTemplateCopyForSharedSetResult,
  SaveTemplateOverrideForFieldInput,
  SaveTemplateOverrideForFieldResult,
  SetFieldAliasInput,
  SetPageAliasInput,
  SharedMemberAddUndo,
  SiteMappingScope,
  StopLogicalPageMatchingInput,
  StopLogicalPageMatchingResult,
  UnbindTemplateInput,
  UnbindTemplateSharedInput,
  UndoAddSharedTemplateSetMemberInput,
  UndoBindInput,
  UndoBindTemplateSharedInput,
  UndoBindTemplateToFieldOnlyInput,
  UndoCreateSharedTemplateSetInput,
  UndoCreateTemplateAndBindSharedFieldOnlyInput,
  UndoCreateTemplateAndBindSharedInput,
  UndoEndSharedTemplateSetInput,
  UndoExcludeSharedTemplateForFieldInput,
  UndoJoinSetAndShareInput,
  UndoMergeSetsAndShareInput,
  UndoMergeSharedTemplateSetsInput,
  UndoPromoteFieldOnlySlotInput,
  UndoRemoveSharedTemplateSetMemberInput,
  UndoSaveCopyForFieldInput,
  UndoSaveInput,
  UndoSaveTemplateCopyForSharedSetInput,
  UndoSaveTemplateOverrideForFieldInput,
  UndoUnbindInput,
  UndoUnbindTemplateSharedInput,
  UpdateTemplateInput,
} from "./repository-inputs";
export { validateCandidateState, validateCandidateInvariants } from "./state-validation";
export {
  createInitialFillNestState,
  type BindingRecord, type CompatibilityPairDecisionRecord, type FieldProfileRecord,
  type FillNestState, type LogicalPageFieldProvenanceRecord, type LogicalPageObservationRecord,
  type LogicalPageProvenanceRecord, type LogicalPageRuleRecord, type LogicalPageSiteKeyRecord,
  type PageProfileRecord, type SiteRecord, type TemplateRecord,
} from "./records";
export {
  effectiveTemplateListForField,
  type EffectiveTemplateList,
  type EffectiveTemplateListEntry,
  type SharedTemplateBindingRecord,
  type SharedTemplateFieldStateRecord,
  type SharedTemplateSetRecord,
  type TemplateRelationRef,
} from "./shared-templates";

const STORAGE_KEY = "fillnestState";
const LEGACY_PICKER_POSITION_STORAGE_KEY = "fillnestPickerPosition";
export { CURRENT_SCHEMA_VERSION } from "./schema-version";

export interface LocalStorageArea {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(key: string): Promise<void>;
}




const defaultDependencies: RepositoryDependencies = {
  createId: () => crypto.randomUUID(),
  now: () => new Date().toISOString(),
};

export class FillNestRepository {
  private mutationQueue: Promise<void> = Promise.resolve();
  private stagedMutationState: FillNestState | null = null;

  constructor(
    private readonly storage: LocalStorageArea,
    private readonly dependencies: RepositoryDependencies = defaultDependencies,
  ) {}

  async read(): Promise<FillNestState> {
    const stored = await this.storage.get(STORAGE_KEY);
    const original = stored[STORAGE_KEY];

    if (original === undefined) return emptyState();
    let value = original;
    let migrated = false;
    if (isRecord(value) && value.schemaVersion === 1) {
      value = await migrateV1ToV2(value, async () => {
        const legacy = await this.storage.get(LEGACY_PICKER_POSITION_STORAGE_KEY);
        return legacy[LEGACY_PICKER_POSITION_STORAGE_KEY];
      });
      migrated = true;
    }
    if (isRecord(value) && value.schemaVersion === 2) {
      value = migrateV2ToV3(value);
      migrated = true;
    }
    if (isRecord(value) && value.schemaVersion === 3) {
      value = migrateV3ToV4(value);
      migrated = true;
    }
    if (isRecord(value) && value.schemaVersion === 4) {
      value = migrateV4ToV5(value);
      migrated = true;
    }
    if (isRecord(value) && value.schemaVersion === 5) {
      value = migrateV5ToV6(value);
      migrated = true;
    }
    if (isRecord(value) && value.schemaVersion === 6) {
      value = migrateV6ToV7(value);
      migrated = true;
    }
    if (isRecord(value) && value.schemaVersion === 7) {
      value = migrateV7ToV8(value);
      migrated = true;
    }
    if (isRecord(value) && value.schemaVersion === 8) {
      value = migrateV8ToV9(value);
      migrated = true;
    }
    if (isRecord(value) && value.schemaVersion === 9) {
      value = migrateV9ToV10(value);
      migrated = true;
    }
    if (isRecord(value) && value.schemaVersion === 10) {
      value = migrateV10ToV11(value);
      migrated = true;
    }
    if (isRecord(value) && value.schemaVersion === 11) {
      value = migrateV11ToV12(value);
      migrated = true;
    }
    if (isRecord(value) && value.schemaVersion === 12) {
      value = migrateV12ToV13(value);
      migrated = true;
    }
    // Validate before persisting: a malformed legacy record must fail closed
    // without ever writing a migrated-but-still-invalid shape to storage.
    const state = validateCandidateState(value);
    if (migrated) await this.commit(state);
    return state;
  }


  private async commit(candidate: FillNestState): Promise<FillNestState> {
    const validated = validateCandidateState(candidate);
    if (this.stagedMutationState !== null) {
      this.stagedMutationState = validated;
      return validated;
    }
    await this.write(validated);
    return validated;
  }

  /**
   * Task 035 (R8). `chrome.storage.local` gives FillNest a fixed budget, and
   * when it runs out the platform rejects with its own wording - something
   * like "Resource::kQuotaBytes quota exceeded", which surfaced to the user as
   * a FillNest failure they could neither understand nor act on.
   *
   * Nothing is retried or dropped: the write genuinely did not happen, and the
   * caller still sees a rejection. Only the sentence changes, to one that says
   * what is full and what to do about it. Every other storage failure is
   * re-thrown untouched, so a transient platform error is never mislabelled as
   * a full store.
   */
  private async write(state: FillNestState): Promise<void> {
    try {
      await this.storage.set({ [STORAGE_KEY]: state });
    } catch (error: unknown) {
      if (isQuotaExceededError(error)) {
        throw new Error(
          "FillNest has run out of local storage, so this change was not saved. Delete some Templates, or export a Backup and then remove what you no longer need.",
        );
      }
      throw error;
    }
  }

  private async readMutationState(): Promise<FillNestState> {
    return this.stagedMutationState ?? this.read();
  }

  /**
   * Task 032 Addendum A: run one extracted command transition.
   *
   * This replicates exactly what each command body did before it moved -
   * `this.read()`, compute, then `this.commit()` - so the number of durable
   * writes is unchanged. `commit` is still the staging-aware one, so a
   * transition invoked inside `runAtomicComposite` stages rather than writes,
   * as its inline predecessor did. A `null` next state commits nothing.
   */
  private async runTransition<T>(
    transition: (state: FillNestState) => StateTransition<T>,
  ): Promise<T> {
    const state = await this.read();
    const { next, result } = transition(state);
    if (next !== null) await this.commit(next);
    return result;
  }

  /**
   * Run a transition that may also be invoked inside `runAtomicComposite`.
   *
   * Task 032 Addendum A slice B4. The difference from `runTransition` is the
   * read: `readMutationState()` returns the staged state when a composite is
   * in flight and falls back to `read()` otherwise, so one runner serves both
   * the standalone command and the composite-nested call. `commit` is already
   * staging-aware, so neither case changes how many durable writes happen.
   */
  private async runStagedTransition<T>(
    transition: (state: FillNestState) => StateTransition<T>,
  ): Promise<T> {
    const state = await this.readMutationState();
    const { next, result } = transition(state);
    if (next !== null) await this.commit(next);
    return result;
  }

  private async runAtomicComposite<T>(operation: () => Promise<T>): Promise<T> {
    if (this.stagedMutationState !== null) throw new Error("Nested atomic repository mutation is not supported.");
    this.stagedMutationState = await this.read();
    try {
      const result = await operation();
      const validated = validateCandidateState(this.stagedMutationState);
      await this.write(validated);
      return result;
    } finally {
      this.stagedMutationState = null;
    }
  }

  async replaceState(nextState: FillNestState): Promise<FillNestState> {
    return this.runMutation(() => this.commit(nextState));
  }

  async getOrCreateLogicalPageSiteKey(pageUrl: string): Promise<LogicalPageSiteKeyResult> {
    return this.runMutation(async () => {
      const state = await this.read();
      const siteId = siteIdentityFromUrl(pageUrl);
      const existing = state.logicalPageSiteKeys.find((key) => key.siteId === siteId);
      if (existing) return { siteId, siteKeyId: existing.id, encodedHmacKey: existing.encodedHmacKey };

      const encodedHmacKey = createEncodedHmacKey();
      const siteKeyId = this.dependencies.createId();
      await this.commit({
        ...state,
        sites: addSite(state.sites, siteId),
        logicalPageSiteKeys: [
          ...state.logicalPageSiteKeys,
          { id: siteKeyId, siteId, encodedHmacKey },
        ],
      });
      return { siteId, siteKeyId, encodedHmacKey };
    });
  }

  async recordLogicalPageObservation(input: RecordLogicalPageObservationInput): Promise<void> {
    return this.runMutation(async () => {
      const state = await this.read();
      const page = state.pageProfiles.find((candidate) => candidate.id === input.pageProfileId);
      const siteId = siteIdentityFromUrl(input.pageUrl);
      const origin = new URL(input.pageUrl).origin;
      const routePattern = buildRoutePattern(input.pageUrl);
      const siteKey = state.logicalPageSiteKeys.find((candidate) => candidate.id === input.siteKeyId);
      if (
        !page ||
        page.siteId !== siteId ||
        !siteKey ||
        siteKey.siteId !== siteId ||
        input.evidence.origin !== origin ||
        routePattern === null ||
        input.evidence.routePattern !== routePattern ||
        input.evidence.routePattern === null ||
        input.evidence.fieldFeatures.size === 0 ||
        input.evidence.groupedFieldFeatures.size === 0 ||
        !state.bindings.some((binding) => binding.pageProfileId === page.id)
      ) {
        throw new Error("Logical Page Observation requires a directly bound Page and matching Site evidence.");
      }

      const observation: LogicalPageObservationRecord = {
        id: state.logicalPageObservations.find((candidate) => candidate.pageProfileId === page.id)?.id ?? this.dependencies.createId(),
        siteId,
        siteKeyId: siteKey.id,
        origin,
        routePattern: input.evidence.routePattern,
        fieldFeatureHashes: [...input.evidence.fieldFeatures].sort(),
        groupedFieldFeatureHashes: [...input.evidence.groupedFieldFeatures].sort(),
        pageProfileId: page.id,
      };
      await this.commit({
        ...state,
        logicalPageObservations: [
          ...state.logicalPageObservations.filter((candidate) => candidate.pageProfileId !== page.id),
          observation,
        ],
      });
    });
  }

  /** Reset every durable business record owned by the repository. */
  async resetToInitialState(): Promise<FillNestState> {
    return this.runMutation(async () => {
      const initial = await this.commit(createInitialFillNestState());
      await this.storage.remove(LEGACY_PICKER_POSITION_STORAGE_KEY);
      return initial;
    });
  }

  async createTemplate(input: CreateTemplateInput): Promise<TemplateRecord> {
    return this.runMutation(() =>
      this.runTransition((state) => createTemplateTransition(state, input, this.dependencies)),
    );
  }

  async createTemplateAndBind(
    input: CreateTemplateAndBindInput,
  ): Promise<CreatedTemplateBinding> {
    return this.runMutation(() =>
      this.runTransition((state) => createTemplateAndBindTransition(state, input, this.dependencies)),
    );
  }

  async updateTemplate(input: UpdateTemplateInput): Promise<TemplateRecord> {
    return this.runMutation(() =>
      this.runTransition((state) => updateTemplateTransition(state, input, this.dependencies)),
    );
  }

  async deleteTemplate(input: DeleteTemplateInput): Promise<boolean> {
    return this.runMutation(() => this.runTransition((state) => deleteTemplateTransition(state, input)));
  }

  async deleteTemplates(input: DeleteTemplatesInput): Promise<DeleteTemplatesResult> {
    return this.runMutation(() => this.runTransition((state) => deleteTemplatesTransition(state, input)));
  }

  async resetSiteMappingsBatch(input: ResetSiteMappingsBatchInput): Promise<ResetSiteMappingsResult> {
    return this.runMutation(() => this.runTransition((state) => resetSiteMappingsBatchTransition(state, input, this.dependencies)));
  }

  async deleteNewlyGlobalTemplates(
    input: DeleteNewlyGlobalTemplatesInput,
  ): Promise<DeleteNewlyGlobalTemplatesResult> {
    return this.runMutation(() => this.runTransition((state) => deleteNewlyGlobalTemplatesTransition(state, input)));
  }

  async recordInsertion(input: RecordInsertionInput): Promise<boolean> {
    return this.runMutation(() => this.runTransition((state) => recordInsertionTransition(state, input)));
  }

  async recordInsertionRejection(input: { fieldProfileId: string; rejected: boolean }): Promise<boolean> {
    return this.runMutation(() =>
      this.runTransition((state) => recordInsertionRejectionTransition(state, input)),
    );
  }

  async restoreTemplate(input: RestoreTemplateInput): Promise<TemplateRecord> {
    return this.runMutation(() => this.runTransition((state) => restoreTemplateTransition(state, input)));
  }

  async restoreTemplates(input: RestoreTemplatesInput): Promise<RestoreTemplatesResult> {
    return this.runMutation(() => this.runTransition((state) => restoreTemplatesTransition(state, input)));
  }

  async bindTemplate(input: BindTemplateInput): Promise<BindingRecord> {
    return this.runMutation(() =>
      this.runTransition((state) => bindTemplateTransition(state, input, this.dependencies)),
    );
  }

  async unbindTemplate(input: UnbindTemplateInput): Promise<boolean> {
    return this.runMutation(() => this.runTransition((state) => unbindTemplateTransition(state, input)));
  }

  async saveTemplateCopyForField(
    input: SaveTemplateCopyForFieldInput,
  ): Promise<SaveTemplateCopyForFieldResult> {
    return this.runMutation(() => this.runTransition((state) => saveTemplateCopyForFieldTransition(state, input, this.dependencies)));
  }

  async saveTemplateCopyForSharedSet(
    input: SaveTemplateCopyForSharedSetInput,
  ): Promise<SaveTemplateCopyForSharedSetResult> {
    return this.runMutation(() => this.runTransition((state) => saveTemplateCopyForSharedSetTransition(state, input, this.dependencies)));
  }

  /** "Save for this field" (Task 026 Confirmed Contract). */
  async saveTemplateOverrideForField(
    input: SaveTemplateOverrideForFieldInput,
  ): Promise<SaveTemplateOverrideForFieldResult> {
    return this.runMutation(() => this.runTransition((state) => saveTemplateOverrideForFieldTransition(state, input, this.dependencies)));
  }

  async undoSaveTemplateOverrideForField(input: UndoSaveTemplateOverrideForFieldInput): Promise<void> {
    return this.runMutation(() => this.runTransition((state) => undoSaveTemplateOverrideForFieldTransition(state, input)));
  }

  /**
   * "Remove from this field" for a Shared Template Set member (Task 026):
   * works whether the Field currently inherits the slot's base Template or
   * has its own Override - both convert to an Exclusion for this Field only.
   */
  async excludeSharedTemplateForField(
    input: ExcludeSharedTemplateForFieldInput,
  ): Promise<ExcludeSharedTemplateForFieldResult> {
    return this.runMutation(() => this.runTransition((state) => excludeSharedTemplateForFieldTransition(state, input, this.dependencies)));
  }

  async undoExcludeSharedTemplateForField(input: UndoExcludeSharedTemplateForFieldInput): Promise<void> {
    return this.runMutation(() => this.runTransition((state) => undoExcludeSharedTemplateForFieldTransition(state, input)));
  }

  async undoBind(input: UndoBindInput): Promise<void> {
    return this.runMutation(() => this.runTransition((state) => undoBindTransition(state, input)));
  }

  async undoUnbind(input: UndoUnbindInput): Promise<void> {
    return this.runMutation(() => this.runTransition((state) => undoUnbindTransition(state, input)));
  }

  async undoSave(input: UndoSaveInput): Promise<TemplateRecord> {
    return this.runMutation(() => this.runTransition((state) => undoSaveTransition(state, input)));
  }

  async undoSaveCopyForField(input: UndoSaveCopyForFieldInput): Promise<void> {
    return this.runMutation(() => this.runTransition((state) => undoSaveCopyForFieldTransition(state, input)));
  }

  async undoSaveTemplateCopyForSharedSet(
    input: UndoSaveTemplateCopyForSharedSetInput,
  ): Promise<void> {
    return this.runMutation(() => this.runTransition((state) => undoSaveTemplateCopyForSharedSetTransition(state, input)));
  }

  async resolveFieldContext(
    input: ResolveFieldContextInput,
  ): Promise<FieldContextResolution> {
    const state = await this.read();
    const siteId = siteIdentityFromUrl(input.pageUrl);
    if (input.pageIdentityKey === null) {
      return {
        siteId,
        pageProfileId: this.dependencies.createId(),
        fieldProfileId: this.dependencies.createId(),
        recognized: false,
      };
    }
    const page = state.pageProfiles.find(
      (candidate) =>
        candidate.siteId === siteId && candidate.identityKey === input.pageIdentityKey,
    );
    const field =
      page && input.fieldIdentityKey
        ? state.fieldProfiles.find(
            (candidate) =>
              candidate.pageProfileId === page.id &&
              candidate.identityKey === input.fieldIdentityKey,
          )
        : undefined;

    if (page && field) {
      return {
        siteId,
        pageProfileId: page.id,
        fieldProfileId: field.id,
        recognized: true,
      };
    }

    return {
      siteId,
      pageProfileId: page?.id ?? this.dependencies.createId(),
      fieldProfileId: this.dependencies.createId(),
      recognized: false,
    };
  }

  /**
   * A read-only Logical Page candidate lookup (Task 014 Accepted Contract).
   * It never mutates state: an automatically-reusable confirmed Rule match
   * resolves as a normal recognized Field context, an unconfirmed but
   * qualifying Observation surfaces as a reviewable candidate, and anything
   * ambiguous, stale, or below either similarity threshold falls back to an
   * ordinary unrecognized context so the caller never false-merges data.
   */
  async resolveLogicalPageCandidate(
    input: ResolveLogicalPageCandidateInput,
  ): Promise<LogicalPageCandidateResolution> {
    const state = await this.read();
    const { evidence } = input;
    const siteId = siteIdentityFromUrl(evidence.origin);

    const unrecognized = (): LogicalPageCandidateResolution => ({
      siteId,
      pageProfileId: this.dependencies.createId(),
      fieldProfileId: this.dependencies.createId(),
      recognized: false,
      candidate: null,
    });

    if (evidence.routePattern === null) return unrecognized();
    const addressPattern = evidence.routePattern;

    // Task 014 Addendum C Slice 2. A confirmed Rule is matched segment-wise
    // with its own wildcards standing for any value, rather than by exact
    // string equality - that is what lets a Rule generalize over a position the
    // address builder had to leave literal. Identical patterns still match, so
    // every Rule confirmed before this keeps working.
    const sameRoute = <T extends { siteId: SiteIdentity; origin: string; routePattern: string }>(
      records: readonly T[],
    ): T[] =>
      records.filter(
        (record) =>
          record.siteId === siteId &&
          record.origin === evidence.origin &&
          routePatternMatches(record.routePattern, addressPattern),
      );

    const matchingRules = sameRoute(state.logicalPageRules).filter((rule) =>
      matchesBothSimilarityThresholds(
        evidence,
        new Set(rule.fieldFeatureHashes),
        new Set(rule.groupedFieldFeatureHashes),
      ),
    );
    if (matchingRules.length > 1) return unrecognized();
    if (matchingRules.length === 1) {
      const rule = matchingRules[0]!;
      const page = state.pageProfiles.find((candidate) => candidate.id === rule.pageProfileId);
      const field =
        page && evidence.fieldIdentityKey
          ? state.fieldProfiles.find(
              (candidate) =>
                candidate.pageProfileId === page.id && candidate.identityKey === evidence.fieldIdentityKey,
            )
          : undefined;
      if (page && field) {
        return { siteId, pageProfileId: page.id, fieldProfileId: field.id, recognized: true, candidate: null };
      }
    }

    const observation = matchingLogicalPageObservation(state, siteId, evidence);
    if (!observation || !evidence.fieldIdentityKey) return unrecognized();

    const hasMatchingBoundField = state.fieldProfiles.some(
      (field) =>
        field.pageProfileId === observation.pageProfileId &&
        field.identityKey === evidence.fieldIdentityKey &&
        state.bindings.some((binding) => binding.fieldProfileId === field.id),
    );
    if (!hasMatchingBoundField) return unrecognized();

    return {
      siteId,
      pageProfileId: this.dependencies.createId(),
      fieldProfileId: this.dependencies.createId(),
      recognized: false,
      candidate: {
        id: this.dependencies.createId(),
        ruleId: this.dependencies.createId(),
        canonicalPageProfileId: observation.pageProfileId,
        reviewRequired: true,
      },
    };
  }


  /**
   * Confirms a reviewed Logical Page candidate (Task 014 Accepted Contract).
   * The whole operation is one atomic candidate-state migration: it
   * revalidates the candidate against the current state first and throws
   * StaleLogicalPageCandidateError, leaving all prior data untouched,
   * whenever the candidate no longer holds. Only exact matches
   * (Task 014 was already-reviewed and validated to have an exact
   * FieldProfile identity match. Non-matching Fields on the reviewed page
   * remain independent - they are never deleted or reassigned. Duplicate
   * Template IDs merge as one Binding with usage counts added; distinct
   * Template IDs are retained; Template global usage is never touched.
   */
  async confirmLogicalPageCandidate(
    input: ConfirmLogicalPageCandidateInput,
  ): Promise<FieldContextResolution> {
    return this.runMutation(() => this.runTransition((state) => confirmLogicalPageCandidateTransition(state, input, this.dependencies)));
  }

  /**
   * Stops one confirmed Logical Page Matching rule (Task 014 Accepted
   * Contract). This removes only future automatic matching: the rule is
   * deleted and every Page/Field relationship its confirmation recorded is
   * atomically separated back into its own independent Bindings on the
   * originally reviewed Field. Each separated Field receives a full copy of
   * the Binding Template-ID union recorded at confirmation time - not any
   * later change to the canonical Field's Bindings - with each Binding's
   * usage count copied in full; Templates are neither duplicated nor
   * deleted, and the canonical Field's own Bindings are left untouched.
   * It fails closed with LogicalPageSeparationError, changing nothing, if
   * the rule or any provenance it recorded can no longer form a valid
   * candidate state.
   */
  async stopLogicalPageMatching(input: StopLogicalPageMatchingInput): Promise<StopLogicalPageMatchingResult> {
    return this.runMutation(() => this.runTransition((state) => stopLogicalPageMatchingTransition(state, input, this.dependencies)));
  }

  async getPickerPosition(): Promise<PickerPosition | null> {
    const state = await this.read();
    return state.pickerPosition;
  }

  async getPageStatusPosition(): Promise<PickerPosition | null> {
    const state = await this.read();
    return state.pageStatusPosition;
  }

  /** Task 038: written once, when the drag ends - never during it. */
  async setPageStatusPosition(position: PickerPosition | null): Promise<boolean> {
    return this.runMutation(async () => {
      const state = await this.read();
      await this.commit({ ...state, pageStatusPosition: position });
      return true;
    });
  }

  async setPickerPosition(position: PickerPosition | null): Promise<boolean> {
    return this.runMutation(() => this.setPickerPositionUnlocked(position));
  }

  private async setPickerPositionUnlocked(position: PickerPosition | null): Promise<boolean> {
    const state = await this.read();
    await this.commit({
      ...state,
      pickerPosition: position,
    });
    return true;
  }

  async setPageAlias(input: SetPageAliasInput): Promise<PageProfileRecord> {
    return this.runMutation(() => this.runTransition((state) => setPageAliasTransition(state, input)));
  }

  async setFieldAlias(input: SetFieldAliasInput): Promise<FieldProfileRecord> {
    return this.runMutation(() => this.runStagedTransition((state) => setFieldAliasTransition(state, input)));
  }

  // -- Shared Template Set commands (Task 015 Accepted Contract, Task 021 Slice 2) --

  async createSharedTemplateSet(
    input: CreateSharedTemplateSetInput,
  ): Promise<CreateSharedTemplateSetResult> {
    return this.runMutation(() => this.runStagedTransition((state) => createSharedTemplateSetTransition(state, input, this.dependencies)));
  }

  async undoCreateSharedTemplateSet(input: UndoCreateSharedTemplateSetInput): Promise<void> {
    return this.runMutation(() => this.runStagedTransition((state) => undoCreateSharedTemplateSetTransition(state, input)));
  }

  async addSharedTemplateSetMember(
    input: AddSharedTemplateSetMemberInput,
  ): Promise<AddSharedTemplateSetMemberResult> {
    return this.runMutation(() => this.runStagedTransition((state) => addSharedTemplateSetMemberTransition(state, input, this.dependencies)));
  }

  async undoAddSharedTemplateSetMember(input: UndoAddSharedTemplateSetMemberInput): Promise<void> {
    return this.runMutation(() => this.runStagedTransition((state) => undoAddSharedTemplateSetMemberTransition(state, input)));
  }

  /** Also used for the Picker's "stop sharing for the current Field" action. */
  async removeSharedTemplateSetMember(
    input: RemoveSharedTemplateSetMemberInput,
  ): Promise<RemoveSharedTemplateSetMemberResult> {
    return this.runMutation(() => this.runTransition((state) => removeSharedTemplateSetMemberTransition(state, input, this.dependencies)));
  }

  async undoRemoveSharedTemplateSetMember(
    input: UndoRemoveSharedTemplateSetMemberInput,
  ): Promise<void> {
    return this.runMutation(() => this.runTransition((state) => undoRemoveSharedTemplateSetMemberTransition(state, input)));
  }

  async endSharedTemplateSet(input: EndSharedTemplateSetInput): Promise<EndSharedTemplateSetResult> {
    return this.runMutation(() => this.runTransition((state) => endSharedTemplateSetTransition(state, input, this.dependencies)));
  }

  async undoEndSharedTemplateSet(input: UndoEndSharedTemplateSetInput): Promise<void> {
    return this.runMutation(() => this.runTransition((state) => undoEndSharedTemplateSetTransition(state, input)));
  }

  async renameSharedTemplateSet(input: RenameSharedTemplateSetInput): Promise<SharedTemplateSetRecord> {
    return this.runMutation(() => this.runTransition((state) => renameSharedTemplateSetTransition(state, input)));
  }

  // -- Task 024: Compatibility Candidate Suggestions (Slice 2) --

  /**
   * A read-only Compatibility Candidate lookup (Task 024 Confirmed
   * Contract). It never mutates state: it ranks every other discoverable
   * Field (one with a non-empty effective Template list) against the given
   * Current Field using only local, generic evidence - never a webpage
   * value, a network service, or an AI model.
   */
  async findSimilarFieldCandidates(
    input: FindSimilarFieldCandidatesInput,
  ): Promise<FindSimilarFieldCandidatesResult> {
    const state = await this.read();
    let currentField = state.fieldProfiles.find((candidate) => candidate.id === input.fieldProfileId);
    let currentPage = currentField
      ? state.pageProfiles.find((candidate) => candidate.id === currentField!.pageProfileId)
      : undefined;
    // The Current Field may never have been bound to anything, so it may
    // have no durable Field Profile yet. This query never persists one -
    // it evaluates evidence against an in-memory profile built the same
    // way every other on-demand-creation command does, without a commit.
    if ((!currentField || !currentPage) && input.newField && input.newField.fieldProfileId === input.fieldProfileId) {
      const prepared = prepareBindingProfiles(state, input.newField);
      currentField = prepared.fieldProfiles.find((candidate) => candidate.id === input.fieldProfileId);
      currentPage = currentField
        ? prepared.pageProfiles.find((candidate) => candidate.id === currentField!.pageProfileId)
        : undefined;
    }
    if (!currentField) throw new Error(`Field Profile not found: ${input.fieldProfileId}`);
    if (!currentPage) throw new Error(`Page Profile not found: ${currentField.pageProfileId}`);
    const resolvedCurrentField = currentField;
    const resolvedCurrentPage = currentPage;

    const sourceEvidence = buildCompatibilityFieldEvidence(state, resolvedCurrentField, resolvedCurrentPage);
    const pool: Array<{ evidence: CompatibilityFieldEvidence; field: FieldProfileRecord; page: PageProfileRecord }> = [];
    for (const field of state.fieldProfiles) {
      if (field.id === resolvedCurrentField.id) continue;
      const page = state.pageProfiles.find((candidate) => candidate.id === field.pageProfileId);
      if (!page) continue;
      const effective = effectiveTemplateListForField(state, field.id);
      // Only a Field with a non-empty effective Template list is
      // discoverable (Confirmed Contract: "A Field is discoverable in 'Find
      // similar field' only when it has a non-empty effective Template
      // list").
      if (effective.templateIds.length === 0) continue;
      pool.push({ evidence: buildCompatibilityFieldEvidence(state, field, page, effective), field, page });
    }

    const decisions: CompatibilityPairDecision[] = state.compatibilityPairDecisions.map((decision) => ({
      fieldProfileIdA: decision.fieldProfileIdA,
      fieldProfileIdB: decision.fieldProfileIdB,
      decision: "no",
    }));
    const ranked = rankCandidates(
      sourceEvidence,
      pool.map(({ evidence }) => evidence),
      decisions,
    );
    const suggestedFieldProfileId = selectAutomaticSuggestion(ranked);
    // Task 024 Addendum C. Set membership is the repository's to know, so the
    // facts the group rule needs are assembled here and the rule itself stays
    // a pure function over them.
    const belongsToSet = (fieldProfileId: string): boolean =>
      state.sharedTemplateSets.some((set) => set.memberFieldProfileIds.includes(fieldProfileId));
    const groupFacts = new Map<string, GroupSuggestionFacts>(
      pool.map(({ evidence }) => [
        evidence.fieldProfileId,
        { kind: evidence.kind, belongsToSet: belongsToSet(evidence.fieldProfileId) },
      ]),
    );
    const suggestedGroupFieldProfileIds = selectAutomaticGroupSuggestion(
      { kind: sourceEvidence.kind, belongsToSet: belongsToSet(resolvedCurrentField.id) },
      ranked,
      groupFacts,
    );

    const poolById = new Map(pool.map((entry) => [entry.evidence.fieldProfileId, entry] as const));
    const currentEffectiveSet = state.sharedTemplateSets.find((set) =>
      set.memberFieldProfileIds.includes(resolvedCurrentField.id),
    );
    const candidates: CompatibilityCandidateView[] = ranked.map((result) => {
      const entry = poolById.get(result.fieldProfileId);
      if (!entry) throw new Error("Compatibility candidate ranking returned an unknown Field.");
      const { field, page, evidence } = entry;
      const templateIds = effectiveTemplateListForField(state, field.id).entries
        .filter((effectiveEntry) => effectiveEntry.relations.some((relation) => {
          if (relation.kind === "binding") return true;
          if (relation.kind === "override") return relation.fieldProfileId === resolvedCurrentField.id;
          const relationSlot = state.sharedTemplateBindings.find((slot) => slot.id === relation.slotId);
          return relationSlot?.ownerFieldProfileId === undefined || relationSlot.ownerFieldProfileId === resolvedCurrentField.id;
        }))
        .map((effectiveEntry) => effectiveEntry.templateId);
      const templates = templateIds
        .map((templateId) => state.templates.find((candidate) => candidate.id === templateId))
        .filter((template): template is TemplateRecord => template !== undefined);
      const fieldOwnSet = state.sharedTemplateSets.find((set) => set.memberFieldProfileIds.includes(field.id));
      return {
        fieldProfileId: field.id,
        siteId: page.siteId,
        pageProfileId: page.id,
        siteLabel: page.siteId,
        // English on purpose: the service worker has no reader. These are
        // search and sort keys; the Picker shows names it derives itself in the
        // reader's language (Task 040).
        pageLabel: pageDisplayName(page, en),
        fieldLabel: evidence.displayLabel,
        crossSite: result.crossSite,
        highConfidence: result.highConfidence,
        decided: result.decided,
        alreadyLinked: currentEffectiveSet?.memberFieldProfileIds.includes(field.id) ?? false,
        templateCount: templates.length,
        templatePreviews: templates.slice(0, 2).map((template) => truncateTemplatePreview(template.content)),
        existingSetId: fieldOwnSet?.id ?? null,
        existingSetMemberCount: fieldOwnSet?.memberFieldProfileIds.length ?? 0,
      };
    });

    return {
      currentFieldLabel: sourceEvidence.displayLabel,
      candidates,
      suggestedFieldProfileId,
      suggestedGroupFieldProfileIds,
    };
  }

  async recordCompatibilityPairNo(
    input: RecordCompatibilityPairNoInput,
  ): Promise<CompatibilityPairDecisionRecord> {
    return this.runMutation(() => this.runTransition((state) => recordCompatibilityPairNoTransition(state, input, this.dependencies)));
  }

  /**
   * Task 024 Confirmed Contract: "if both belong to distinct Sets, merge
   * their complete memberships and effective lists... A merge retains the
   * Current Field Set's custom name, removes the other Set, and gives every
   * member the deduplicated ordered union." `keepSetId` is always the
   * Current Field's own Set, so its name and identity survive; `removeSetId`
   * is deleted. The result may span Sites - this is the one place besides
   * `allowCrossSite` where that is possible, and only ever through this
   * explicit Link command.
   */
  async mergeSharedTemplateSets(
    input: MergeSharedTemplateSetsInput,
  ): Promise<MergeSharedTemplateSetsResult> {
    return this.runMutation(() => this.runStagedTransition((state) => mergeSharedTemplateSetsTransition(state, input, this.dependencies)));
  }

  async undoMergeSharedTemplateSets(input: UndoMergeSharedTemplateSetsInput): Promise<void> {
    return this.runMutation(() => this.runStagedTransition((state) => undoMergeSharedTemplateSetsTransition(state, input)));
  }

  // -- Shared-scope Template-list mutations --

  async createTemplateAndBindShared(
    input: CreateTemplateAndBindSharedInput,
  ): Promise<CreatedSharedTemplateBinding> {
    return this.runMutation(() => this.runTransition((state) => createTemplateAndBindSharedTransition(state, input, this.dependencies)));
  }

  async undoCreateTemplateAndBindShared(input: UndoCreateTemplateAndBindSharedInput): Promise<void> {
    return this.runMutation(() => this.runTransition((state) => undoCreateTemplateAndBindSharedTransition(state, input)));
  }

  /** "Save only for this field" (Task 026 Confirmed Contract). */
  async createTemplateAndBindSharedFieldOnly(
    input: CreateTemplateAndBindSharedFieldOnlyInput,
  ): Promise<CreateTemplateAndBindSharedFieldOnlyResult> {
    return this.runMutation(() => this.runTransition((state) => createTemplateAndBindSharedFieldOnlyTransition(state, input, this.dependencies)));
  }

  async undoCreateTemplateAndBindSharedFieldOnly(
    input: UndoCreateTemplateAndBindSharedFieldOnlyInput,
  ): Promise<void> {
    return this.runMutation(() => this.runTransition((state) => undoCreateTemplateAndBindSharedFieldOnlyTransition(state, input)));
  }

  async bindTemplateShared(input: BindTemplateSharedInput): Promise<SharedTemplateBindingRecord> {
    return this.runMutation(() => this.runTransition((state) => bindTemplateSharedTransition(state, input, this.dependencies)));
  }

  async undoBindTemplateShared(input: UndoBindTemplateSharedInput): Promise<void> {
    return this.runMutation(() => this.runTransition((state) => undoBindTemplateSharedTransition(state, input)));
  }

  // Task 027: "Bind to this field" from a Shared Set member's Search results
  // - unlike bindTemplateShared, this never affiliates the Template with the
  // whole Set's member Sites, since it is never visible to those members.
  async bindTemplateToFieldOnly(
    input: BindTemplateToFieldOnlyInput,
  ): Promise<BindTemplateToFieldOnlyResult> {
    return this.runMutation(() => this.runTransition((state) => bindTemplateToFieldOnlyTransition(state, input, this.dependencies)));
  }

  async undoBindTemplateToFieldOnly(input: UndoBindTemplateToFieldOnlyInput): Promise<void> {
    return this.runMutation(() => this.runTransition((state) => undoBindTemplateToFieldOnlyTransition(state, input)));
  }

  /**
   * "Share this version" (Task 027 Confirmed Contract): promotes a Field-only
   * relationship to a normal Shared Template Slot within the owner's own
   * current Set - every current member then resolves it normally.
   */
  async promoteFieldOnlySlot(input: PromoteFieldOnlySlotInput): Promise<PromoteFieldOnlySlotResult> {
    return this.runMutation(() => this.runStagedTransition((state) => promoteFieldOnlySlotTransition(state, input, this.dependencies)));
  }

  async undoPromoteFieldOnlySlot(input: UndoPromoteFieldOnlySlotInput): Promise<void> {
    return this.runMutation(() => this.runStagedTransition((state) => undoPromoteFieldOnlySlotTransition(state, input)));
  }

  /**
   * "Join Set & Share" (Task 027 Confirmed Contract): one atomic operation
   * that adds a previously-unshared target Field to the owner's own current
   * Set and promotes the named Field-only slot, so nothing is ever a hidden
   * side effect of selecting a Field. Reuses addSharedTemplateSetMember's own
   * logic and Undo shape for the membership half.
   */
  async joinSetAndShare(input: JoinSetAndShareInput): Promise<JoinSetAndShareResult> {
    return this.runMutation(() => this.runAtomicComposite(async () => {
      const addResult = await this.runStagedTransition((state) => addSharedTemplateSetMemberTransition(state, {
        setId: input.setId,
        fieldProfileId: input.targetFieldProfileId,
        newField: input.newField,
        allowCrossSite: input.allowCrossSite,
      }, this.dependencies));
      const promoteResult = await this.runStagedTransition((state) => promoteFieldOnlySlotTransition(state, {
        setId: input.setId,
        slotId: input.slotId,
        fieldProfileId: input.fieldProfileId,
      }, this.dependencies));
      return {
        set: addResult,
        sharedBinding: promoteResult.sharedBinding,
        addUndo: addResult.undo,
        previousOwnerFieldProfileId: promoteResult.previousOwnerFieldProfileId,
        consumedSlot: promoteResult.consumedSlot,
        previousOrdinarySlot: promoteResult.previousOrdinarySlot,
        removedFieldStates: promoteResult.removedFieldStates,
        previousSlot: promoteResult.previousSlot,
      };
    }));
  }

  async undoJoinSetAndShare(input: UndoJoinSetAndShareInput): Promise<void> {
    return this.runMutation(() => this.runAtomicComposite(async () => {
      // Reverse in the opposite order the composite operation applied them,
      // so each step's own staleness check sees exactly the state it left
      // behind and neither can silently discard an intervening mutation.
      // `input.slotId` is the slot the promotion actually left behind - the
      // surviving ordinary slot's id in Addendum A.3 mode 2, the same slot
      // id otherwise.
      await this.runStagedTransition((state) => undoPromoteFieldOnlySlotTransition(state, {
        setId: input.setId,
        slotId: input.slotId,
        ownerFieldProfileId: input.ownerFieldProfileId,
        consumedSlot: input.consumedSlot,
        previousOrdinarySlot: input.previousOrdinarySlot,
        removedFieldStates: input.removedFieldStates,
        previousSlot: input.previousSlot,
      }));
      await this.runStagedTransition((state) => undoAddSharedTemplateSetMemberTransition(state, {
        ...input.addUndo,
        setId: input.setId,
        fieldProfileId: input.targetFieldProfileId,
      }));
    }));
  }

  /**
   * "Merge Sets & Share" (Task 027 Confirmed Contract): the composite for a
   * target already in a different existing Set. `keepSetId` is always the
   * owner's own Set (Task 024's canonical-slot rule), so the promoted slot's
   * own id survives the merge unchanged.
   */
  async mergeSetsAndShare(input: MergeSetsAndShareInput): Promise<MergeSetsAndShareResult> {
    return this.runMutation(() => this.runAtomicComposite(async () => {
      const mergeResult = await this.runStagedTransition((state) => mergeSharedTemplateSetsTransition(state, {
        keepSetId: input.keepSetId,
        removeSetId: input.removeSetId,
      }, this.dependencies));
      const promoteResult = await this.runStagedTransition((state) => promoteFieldOnlySlotTransition(state, {
        setId: input.keepSetId,
        slotId: input.slotId,
        fieldProfileId: input.fieldProfileId,
      }, this.dependencies));
      return {
        ...mergeResult,
        sharedBinding: promoteResult.sharedBinding,
        previousOwnerFieldProfileId: promoteResult.previousOwnerFieldProfileId,
        consumedSlot: promoteResult.consumedSlot,
        previousOrdinarySlot: promoteResult.previousOrdinarySlot,
        removedFieldStates: promoteResult.removedFieldStates,
        previousSlot: promoteResult.previousSlot,
      };
    }));
  }

  async undoMergeSetsAndShare(input: UndoMergeSetsAndShareInput): Promise<void> {
    return this.runMutation(() => this.runAtomicComposite(async () => {
      // `input.slotId` is the slot the promotion actually left behind - the
      // surviving ordinary slot's id in Addendum A.3 mode 2 (defect G),
      // reversed first so `undoMergeSharedTemplateSetsUnlocked` sees exactly
      // the merge's own post-merge state next, unchanged order.
      await this.runStagedTransition((state) => undoPromoteFieldOnlySlotTransition(state, {
        setId: input.mergedSet.id,
        slotId: input.slotId,
        ownerFieldProfileId: input.ownerFieldProfileId,
        consumedSlot: input.consumedSlot,
        previousOrdinarySlot: input.previousOrdinarySlot,
        removedFieldStates: input.removedFieldStates,
        previousSlot: input.previousSlot,
      }));
      await this.runStagedTransition((state) => undoMergeSharedTemplateSetsTransition(state, input));
    }));
  }

  async unbindTemplateShared(input: UnbindTemplateSharedInput): Promise<UndoUnbindTemplateSharedInput | false> {
    return this.runMutation(() => this.runTransition((state) => unbindTemplateSharedTransition(state, input)));
  }

  async undoUnbindTemplateShared(input: UndoUnbindTemplateSharedInput): Promise<void> {
    return this.runMutation(() => this.runTransition((state) => undoUnbindTemplateSharedTransition(state, input)));
  }

  public runMutation<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.mutationQueue.then(operation, operation);
    this.mutationQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}


function emptyState(): FillNestState {
  return createInitialFillNestState();
}

/**
 * Task 024's ranking tiebreak ("existing update or creation time") reads the
 * effective list's own Templates, not a new per-Field timestamp - the
 * Confirmed Contract explicitly forbids "no new counters or timestamps
 * solely to rank candidates."
 */
function buildCompatibilityFieldEvidence(
  state: FillNestState,
  field: FieldProfileRecord,
  page: PageProfileRecord,
  effective: EffectiveTemplateList = effectiveTemplateListForField(state, field.id),
): CompatibilityFieldEvidence {
  const templates = effective.templateIds
    .map((templateId) => state.templates.find((candidate) => candidate.id === templateId))
    .filter((template): template is TemplateRecord => template !== undefined);
  const mostRecentTouch = templates.reduce(
    (latest, template) => (template.updatedAt > latest ? template.updatedAt : latest),
    "",
  );
  return {
    fieldProfileId: field.id,
    siteId: page.siteId,
    kind: classifyCompatibilityKind(parseGenericFieldTypeEvidence(field.identityKey)),
    usageCount: effective.usageCount,
    updatedAt: mostRecentTouch,
    createdAt: mostRecentTouch,
    // English on purpose, as `pageLabel` above: a ranking tiebreak, not display.
    displayLabel: fieldDisplayName(field, en),
  };
}

const TEMPLATE_PREVIEW_MAX_LENGTH = 80;

/**
 * A privacy-safe, recognition-only preview - never Template content long
 * enough to substitute for opening the real Field Picker (Confirmed
 * Contract: "at most two truncated Template previews").
 */
function truncateTemplatePreview(content: string): string {
  const collapsed = content.replace(/\s+/gu, " ").trim();
  return collapsed.length > TEMPLATE_PREVIEW_MAX_LENGTH
    ? `${collapsed.slice(0, TEMPLATE_PREVIEW_MAX_LENGTH)}…`
    : collapsed;
}

function createEncodedHmacKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const encoded = btoa(String.fromCharCode(...bytes))
    .replace(/\+/gu, "-")
    .replace(/\//gu, "_")
    .replace(/=+$/gu, "");
  return `hmac-sha256-v1:${encoded}`;
}

/**
 * Chrome reports a full store as an ordinary `Error` whose message names the
 * quota, with no code to match on - so the message is what there is to read.
 * Matched loosely and case-insensitively, and only ever used to *replace the
 * wording*: an unrecognized failure is re-thrown exactly as it arrived.
 */
function isQuotaExceededError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return /quota|exceeded the storage/iu.test(message);
}
