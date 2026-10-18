import type { UserErrorCode } from "./user-error";
import { isTipId, type TipId } from "../guidance/tips";
import { isLanguagePreference, type LanguagePreference } from "../i18n/language";
import { isThemeId, isThemeModePreference, type AppearancePreference } from "../ui/theme/theme-tokens";
import type {
  AddSharedTemplateSetMemberResult,
  SharedMemberAddUndo,
  BindingRecord,
  BindTemplateToFieldOnlyResult,
  CompatibilityPairDecisionRecord,
  CreatedTemplateBinding,
  CreatedSharedTemplateBinding,
  CreateTemplateAndBindSharedFieldOnlyResult,
  CreateSharedTemplateSetResult,
  DeleteNewlyGlobalTemplatesInput,
  DeleteNewlyGlobalTemplatesResult,
  DeleteTemplatesResult,
  EndSharedTemplateSetResult,
  FieldContextResolution,
  FieldProfileRecord,
  FillNestState,
  FindSimilarFieldCandidatesResult,
  JoinSetAndShareResult,
  LogicalPageCandidateResolution,
  LogicalPageSiteKeyResult,
  MergeSetsAndShareResult,
  MergeSharedTemplateSetsResult,
  PageProfileRecord,
  PickerPosition,
  PromoteFieldOnlySlotResult,
  RemoveSharedTemplateSetMemberResult,
  ResetSiteMappingsBatchInput,
  ResetSiteMappingsExpectedImpact,
  ResetSiteMappingsResult,
  RestoreTemplateInput,
  RestoreTemplatesResult,
  SaveTemplateCopyForFieldResult,
  SaveTemplateCopyForSharedSetResult,
  SaveTemplateOverrideForFieldResult,
  ExcludeSharedTemplateForFieldResult,
  SharedTemplateBindingRecord,
  SharedTemplateFieldStateRecord,
  SharedTemplateSetRecord,
  StopLogicalPageMatchingResult,
  TemplateRecord,
} from "../storage/fillnest-repository";
import type {
  ActivationManagementSnapshot,
  ActivationSnapshot,
  AllowWebsiteAccessResult,
} from "../activation/activation-authority";
import type { ActivationMode, ActivationState } from "../activation/activation-repository";
import type { RemoveWebsiteAccessResult } from "../permissions/permission-lifecycle";
import type { RemoveSiteResult } from "../sites/remove-site-transaction";

import type { RestoreImpactPreview } from "../backup/restore-impact";
import type { ResetImpactPreview } from "../reset/reset-transaction";

export interface OpaqueLogicalPageEvidencePayload {
  origin: string;
  routePattern: string;
  fieldFeatureHashes: string[];
  groupedFieldFeatureHashes: string[];
}

/** Identity data to create one Field's (and its Page's) durable Profile on demand, if it doesn't exist yet. */
export interface BindingTargetPayload {
  pageUrl: string;
  pageProfileId: string;
  fieldProfileId: string;
  pageIdentityKey?: string;
  fieldIdentityKey?: string;
  fieldDocumentOrder?: number;
  fieldObservedTitle?: string;
}

/** Adds the opaque Field identity key a candidate resolution or confirmation needs to locate its Target Field. */
export interface OpaqueLogicalPageCandidateEvidencePayload extends OpaqueLogicalPageEvidencePayload {
  fieldIdentityKey: string | null;
}

export type RuntimeRequest =
  | { type: "ENABLE_SITE"; pageUrl: string; tabId: number }
  | { type: "RETRY_SITE_ACTIVATION"; pageUrl: string; tabId: number }
  | { type: "REMOVE_WEBSITE_ACCESS"; origins: string[] }
  | { type: "REMOVE_SITE"; origins: string[]; sites: ResetSiteMappingsBatchInput["sites"] }
  | { type: "RESET_SITE_MAPPINGS_BATCH"; sites: ResetSiteMappingsBatchInput["sites"] }
  | {
      type: "DELETE_NEWLY_GLOBAL_TEMPLATES";
      templates: DeleteNewlyGlobalTemplatesInput["templates"];
      // Task 028 Addendum B: same rule as DELETE_TEMPLATES - required only
      // when this would empty the Template Library.
      typedConfirmation?: "delete";
    }
  | { type: "GET_ACTIVATION_SNAPSHOT"; pageUrl?: string | null }
  | { type: "GET_ACTIVATION_MANAGEMENT" }
  | { type: "SET_GLOBAL_ACTIVATION"; mode: ActivationMode }
  | { type: "SET_ORIGIN_ACTIVATION"; origin: string; mode: ActivationMode }
  | { type: "READ_STATE" }
  | { type: "GET_LOGICAL_PAGE_SITE_KEY"; pageUrl: string }
  | {
      type: "RECORD_LOGICAL_PAGE_OBSERVATION";
      pageUrl: string;
      pageProfileId: string;
      siteKeyId: string;
      evidence: OpaqueLogicalPageEvidencePayload;
    }
  | { type: "RESOLVE_LOGICAL_PAGE_CANDIDATE"; evidence: OpaqueLogicalPageCandidateEvidencePayload }
  | {
      type: "CONFIRM_LOGICAL_PAGE_CANDIDATE";
      ruleId: string;
      canonicalPageProfileId: string;
      pageIdentityKey: string | null;
      evidence: OpaqueLogicalPageCandidateEvidencePayload;
    }
  | { type: "STOP_LOGICAL_PAGE_MATCHING"; ruleId: string }
  | { type: "CREATE_TEMPLATE"; content: string; pageUrl: string }
  | { type: "UPDATE_TEMPLATE"; templateId: string; content: string }
  | { type: "DELETE_TEMPLATE"; templateId: string }
  | {
      type: "RESTORE_TEMPLATE";
      template: TemplateRecord;
      bindings: BindingRecord[];
      sharedBindings?: SharedTemplateBindingRecord[];
      fieldStates?: SharedTemplateFieldStateRecord[];
    }
  | {
      type: "DELETE_TEMPLATES";
      templateIds: string[];
      // Task 028 (audit finding C2): required, and enforced in the service
      // worker, only when the request would empty the Template Library.
      // Partial batch deletion carries no typed confirmation (PROJECT.md).
      typedConfirmation?: "delete";
    }
  | { type: "RESTORE_TEMPLATES"; templates: RestoreTemplateInput[] }
  | { type: "GET_APPEARANCE" }
  | { type: "SET_APPEARANCE"; appearance: AppearancePreference }
  | { type: "GET_PICKER_POSITION" }
  | { type: "SET_PICKER_POSITION"; position: PickerPosition | null }
  | { type: "GET_LANGUAGE" }
  | { type: "SET_LANGUAGE"; language: LanguagePreference }
  | { type: "GET_PAGE_STATUS_POSITION" }
  | { type: "SET_PAGE_STATUS_POSITION"; position: PickerPosition | null }
  // Task 038 Addendum B: Settings puts the page button back in its corner.
  | { type: "RESET_PAGE_STATUS_POSITION" }
  // Task 042: the first-use tips this browser has dismissed.
  | { type: "GET_DISMISSED_TIPS" }
  | { type: "DISMISS_TIP"; tip: TipId }
  | { type: "SHOW_TIPS_AGAIN" }
  | { type: "SET_PAGE_ALIAS"; pageProfileId: string; alias: string }
  | { type: "SET_FIELD_ALIAS"; fieldProfileId: string; alias: string; newField?: BindingTargetPayload }
  | { type: "RECORD_INSERTION"; templateId: string; fieldProfileId: string }
  | { type: "RECORD_INSERTION_REJECTION"; fieldProfileId: string; rejected: boolean }
  | { type: "SAVE_TEMPLATE_COPY_FOR_FIELD"; templateId: string; fieldProfileId: string; content: string }
  | { type: "SAVE_TEMPLATE_COPY_FOR_SHARED_SET"; setId: string; slotId: string; content: string }
  | { type: "UNDO_BIND"; bindingId: string }
  | { type: "UNDO_UNBIND"; binding: BindingRecord }
  | { type: "UNDO_SAVE"; template: TemplateRecord; expectedRevision: number }
  | { type: "UNDO_SAVE_COPY_FOR_FIELD"; copyTemplateId: string; originalBinding: BindingRecord }
  | {
      type: "UNDO_SAVE_TEMPLATE_COPY_FOR_SHARED_SET";
      copyTemplateId: string;
      originalSharedBinding: SharedTemplateBindingRecord;
    }
  | {
      type: "CREATE_TEMPLATE_AND_BIND";
      content: string;
      pageUrl: string;
      pageProfileId: string;
      fieldProfileId: string;
      pageIdentityKey?: string;
      fieldIdentityKey?: string;
      fieldDocumentOrder?: number;
      fieldObservedTitle?: string;
      // Task 027 Addendum D: save as private to this Field, so joining a
      // Shared Template Set later does not share it.
      privateToField?: true;
    }
  | {
      type: "BIND_TEMPLATE";
      templateId: string;
      pageUrl: string;
      pageProfileId: string;
      fieldProfileId: string;
      pageIdentityKey?: string;
      fieldIdentityKey?: string;
      fieldDocumentOrder?: number;
      fieldObservedTitle?: string;
    }
  | {
      type: "RESOLVE_FIELD_CONTEXT";
      pageUrl: string;
      pageIdentityKey: string | null;
      fieldIdentityKey: string | null;
    }
  | { type: "UNBIND_TEMPLATE"; templateId: string; fieldProfileId: string }
  | {
      type: "CREATE_SHARED_TEMPLATE_SET";
      fieldProfileIds: string[];
      newFields?: BindingTargetPayload[];
      allowCrossSite?: boolean;
    }
  | { type: "UNDO_CREATE_SHARED_TEMPLATE_SET"; setId: string }
  | {
      type: "ADD_SHARED_TEMPLATE_SET_MEMBER";
      setId: string;
      fieldProfileId: string;
      newField?: BindingTargetPayload;
      allowCrossSite?: boolean;
    }
  | ({ type: "UNDO_ADD_SHARED_TEMPLATE_SET_MEMBER"; setId: string; fieldProfileId: string } & SharedMemberAddUndo)
  | { type: "REMOVE_SHARED_TEMPLATE_SET_MEMBER"; setId: string; fieldProfileId: string }
  | {
      type: "UNDO_REMOVE_SHARED_TEMPLATE_SET_MEMBER";
      fieldProfileId: string;
      set: SharedTemplateSetRecord;
      endedSharedBindings: SharedTemplateBindingRecord[];
      snapshotBindings: BindingRecord[];
      dormantBindings: BindingRecord[];
      removedOwnedSlots: SharedTemplateBindingRecord[];
      removedFieldStates: SharedTemplateFieldStateRecord[];
    }
  | { type: "END_SHARED_TEMPLATE_SET"; setId: string }
  | {
      type: "UNDO_END_SHARED_TEMPLATE_SET";
      set: SharedTemplateSetRecord;
      sharedBindings: SharedTemplateBindingRecord[];
      endedFieldStates: SharedTemplateFieldStateRecord[];
      convertedBindings: BindingRecord[];
      dormantBindings: BindingRecord[];
    }
  | {
      type: "SAVE_TEMPLATE_OVERRIDE_FOR_FIELD";
      setId: string;
      slotId: string;
      fieldProfileId: string;
      content: string;
    }
  | {
      type: "UNDO_SAVE_TEMPLATE_OVERRIDE_FOR_FIELD";
      copyTemplateId: string;
      previousState: SharedTemplateFieldStateRecord | null;
    }
  | {
      type: "EXCLUDE_SHARED_TEMPLATE_FOR_FIELD";
      setId: string;
      slotId: string;
      fieldProfileId: string;
    }
  | {
      type: "UNDO_EXCLUDE_SHARED_TEMPLATE_FOR_FIELD";
      setId: string;
      slotId: string;
      fieldProfileId: string;
      previousState: SharedTemplateFieldStateRecord | null;
    }
  | { type: "RENAME_SHARED_TEMPLATE_SET"; setId: string; name: string }
  | { type: "CREATE_TEMPLATE_AND_BIND_SHARED"; setId: string; content: string }
  | {
      type: "UNDO_CREATE_TEMPLATE_AND_BIND_SHARED";
      setId: string;
      sharedBindingId: string;
      templateId: string;
    }
  | { type: "CREATE_TEMPLATE_AND_BIND_SHARED_FIELD_ONLY"; setId: string; fieldProfileId: string; content: string }
  | {
      type: "UNDO_CREATE_TEMPLATE_AND_BIND_SHARED_FIELD_ONLY";
      setId: string;
      sharedBindingId: string;
      templateId: string;
    }
  | { type: "BIND_TEMPLATE_SHARED"; setId: string; templateId: string; fieldProfileId?: string }
  | { type: "UNDO_BIND_TEMPLATE_SHARED"; sharedBindingId: string }
  | { type: "UNBIND_TEMPLATE_SHARED"; setId: string; slotId: string }
  | {
      type: "UNDO_UNBIND_TEMPLATE_SHARED";
      sharedBinding: SharedTemplateBindingRecord;
      fieldStates: SharedTemplateFieldStateRecord[];
    }
  | { type: "BIND_TEMPLATE_TO_FIELD_ONLY"; setId: string; fieldProfileId: string; templateId: string }
  | { type: "UNDO_BIND_TEMPLATE_TO_FIELD_ONLY"; setId: string; sharedBinding: SharedTemplateBindingRecord }
  | {
      type: "PROMOTE_FIELD_ONLY_SLOT";
      setId: string;
      slotId: string;
      // The owner performing the share - the repository asserts it owns the
      // named slot (Task 027: broadened "only by an explicit action by its
      // owner").
      fieldProfileId: string;
    }
  | {
      type: "UNDO_PROMOTE_FIELD_ONLY_SLOT";
      setId: string;
      slotId: string;
      ownerFieldProfileId: string;
      // Task 027 Addendum A.3: present only when the promotion consumed the
      // owner-only slot into a pre-existing ordinary slot (mode 2).
      consumedSlot?: SharedTemplateBindingRecord;
      previousOrdinarySlot?: SharedTemplateBindingRecord;
      removedFieldStates?: SharedTemplateFieldStateRecord[];
      previousSlot?: SharedTemplateBindingRecord;
    }
  | {
      type: "JOIN_SET_AND_SHARE";
      setId: string;
      slotId: string;
      fieldProfileId: string;
      targetFieldProfileId: string;
      newField?: BindingTargetPayload;
      allowCrossSite?: boolean;
    }
  | {
      type: "UNDO_JOIN_SET_AND_SHARE";
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
  | { type: "MERGE_SETS_AND_SHARE"; keepSetId: string; removeSetId: string; slotId: string; fieldProfileId: string }
  | {
      type: "UNDO_MERGE_SETS_AND_SHARE";
      mergedSet: SharedTemplateSetRecord;
      mergedSetBindings: SharedTemplateBindingRecord[];
      previousKeepSet: SharedTemplateSetRecord;
      previousKeepSetBindings: SharedTemplateBindingRecord[];
      removedSet: SharedTemplateSetRecord;
      removedSetBindings: SharedTemplateBindingRecord[];
      remappedFieldStates: SharedTemplateFieldStateRecord[];
      previousRemovedSetFieldStates: SharedTemplateFieldStateRecord[];
      slotId: string;
      ownerFieldProfileId: string;
      consumedSlot?: SharedTemplateBindingRecord;
      previousOrdinarySlot?: SharedTemplateBindingRecord;
      removedFieldStates?: SharedTemplateFieldStateRecord[];
      previousSlot?: SharedTemplateBindingRecord;
    }
  | { type: "FIND_SIMILAR_FIELD_CANDIDATES"; fieldProfileId: string; newField?: BindingTargetPayload }
  | { type: "RECORD_COMPATIBILITY_PAIR_NO"; fieldProfileIdA: string; fieldProfileIdB: string }
  | { type: "MERGE_SHARED_TEMPLATE_SETS"; keepSetId: string; removeSetId: string }
  | {
      type: "UNDO_MERGE_SHARED_TEMPLATE_SETS";
      mergedSet: SharedTemplateSetRecord;
      mergedSetBindings: SharedTemplateBindingRecord[];
      previousKeepSet: SharedTemplateSetRecord;
      previousKeepSetBindings: SharedTemplateBindingRecord[];
      removedSet: SharedTemplateSetRecord;
      removedSetBindings: SharedTemplateBindingRecord[];
      remappedFieldStates: SharedTemplateFieldStateRecord[];
      previousRemovedSetFieldStates: SharedTemplateFieldStateRecord[];
    }
  | { type: "CREATE_BACKUP_ARCHIVE" }
  | { type: "GET_RESET_PREVIEW" }
  | { type: "RESET_FILLNEST"; expectedConfirmationToken: string; typedConfirmation: "reset" }
  | { type: "VALIDATE_BACKUP_ARCHIVE"; archiveJson: string }
  | {
      type: "RESTORE_BACKUP_ARCHIVE";
      archiveJson: string;
      expectedConfirmationToken: string;
      typedConfirmation: "restore";
  };

export type StateChangeNotification =
  | {
      type: "BUSINESS_STATE_CHANGED";
      /**
       * Whether the change could have removed stored Page or Field Profiles.
       * A live content script holds resolved identities for the Fields it has
       * seen; only a change that can delete those may make it drop them. See
       * `FIELD_IDENTITY_INVALIDATION`.
       */
      fieldIdentitiesInvalidated: boolean;
    }
  // Task 034: the chosen theme changed. Every open surface repaints; nothing
  // re-reads business state, which is why this is its own notification rather
  // than a business-state change.
  | { type: "APPEARANCE_CHANGED"; appearance: AppearancePreference }
  // Task 037: the chosen language changed. Its own notification for the same
  // reason the theme has one - every surface re-renders its own words, and no
  // business state has moved. Task 034's contract is not widened to mean
  // "preferences" for this Task's convenience.
  | { type: "LANGUAGE_CHANGED"; language: LanguagePreference }
  | { type: "ACTIVATION_STATE_CHANGED" };

/**
 * Task 038 Addendum B: the page button's stored position was forgotten, so
 * every open page moves its button back to the default corner. Deliberately
 * not a state-change notification: nothing a Picker or Undo depends on moved.
 */
export interface PageStatusPositionResetNotification {
  type: "PAGE_STATUS_POSITION_RESET";
}

export function isPageStatusPositionResetNotification(value: unknown): value is PageStatusPositionResetNotification {
  return typeof value === "object" && value !== null && "type" in value && value.type === "PAGE_STATUS_POSITION_RESET";
}

export function isStateChangeNotification(value: unknown): value is StateChangeNotification {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    (value.type === "BUSINESS_STATE_CHANGED" ||
      value.type === "ACTIVATION_STATE_CHANGED" ||
      value.type === "APPEARANCE_CHANGED" ||
      value.type === "LANGUAGE_CHANGED")
  );
}

export interface CreateBackupArchiveResult {
  archiveJson: string;
  defaultFilename: string;
}

export interface ValidateBackupArchiveResult {
  preview: RestoreImpactPreview;
  confirmationToken: string;
}

export interface RestoreBackupArchiveResult {
  success: true;
  unreachableTabsCount: number;
}

export interface ResetPreviewResult {
  preview: ResetImpactPreview;
  confirmationToken: string;
}

export interface ResetFillNestResult {
  success: true;
}

export type RuntimeResponse =
  | {
      ok: true;
      value:
        | boolean
        | TipId[]
        | AppearancePreference
        | LanguagePreference
        | FillNestState
        | LogicalPageSiteKeyResult
        | LogicalPageCandidateResolution
        | StopLogicalPageMatchingResult
        | TemplateRecord
        | BindingRecord
        | CreatedTemplateBinding
        | FieldContextResolution
        | ActivationSnapshot
        | ActivationManagementSnapshot
        | ActivationState
        | AllowWebsiteAccessResult
        | PickerPosition
        | PageProfileRecord
        | FieldProfileRecord
        | SaveTemplateCopyForFieldResult
        | SaveTemplateCopyForSharedSetResult
        | SaveTemplateOverrideForFieldResult
        | ExcludeSharedTemplateForFieldResult
        | DeleteTemplatesResult
        | RestoreTemplatesResult
        | RemoveWebsiteAccessResult
        | RemoveSiteResult
        | ResetSiteMappingsResult
        | DeleteNewlyGlobalTemplatesResult
        | BindingRecord[]
        | CreateSharedTemplateSetResult
        | SharedTemplateSetRecord
        | RemoveSharedTemplateSetMemberResult
        | EndSharedTemplateSetResult
        | CreatedSharedTemplateBinding
        | CreateTemplateAndBindSharedFieldOnlyResult
        | SharedTemplateBindingRecord
        | FindSimilarFieldCandidatesResult
        | CompatibilityPairDecisionRecord
        | MergeSharedTemplateSetsResult
        | BindTemplateToFieldOnlyResult
        | PromoteFieldOnlySlotResult
        | JoinSetAndShareResult
        | MergeSetsAndShareResult
        | CreateBackupArchiveResult
        | ValidateBackupArchiveResult
        | RestoreBackupArchiveResult
        | ResetPreviewResult
        | ResetFillNestResult
        | null;
    }
  | { ok: false; error: string; errorCode?: UserErrorCode };

export function isRuntimeRequest(value: unknown): value is RuntimeRequest {
  if (!isRecord(value) || typeof value.type !== "string") return false;

  switch (value.type) {
    case "REMOVE_WEBSITE_ACCESS":
      return Array.isArray(value.origins) && value.origins.every((origin) => typeof origin === "string");
    case "REMOVE_SITE":
      return Array.isArray(value.origins) && value.origins.every((origin) => typeof origin === "string") &&
        Array.isArray(value.sites) && value.sites.every((site) => isResetSiteMappingsInputShape(site));
    case "RESET_SITE_MAPPINGS_BATCH":
      return Array.isArray(value.sites) && value.sites.every((site) => isResetSiteMappingsInputShape(site));
    case "DELETE_NEWLY_GLOBAL_TEMPLATES":
      if (value.typedConfirmation !== undefined && value.typedConfirmation !== "delete") return false;
      return Array.isArray(value.templates) && value.templates.every(
        (template) => isRecord(template) && typeof template.id === "string" && Number.isInteger(template.expectedRevision),
      );
    case "ENABLE_SITE":
    case "RETRY_SITE_ACTIVATION":
      return typeof value.pageUrl === "string" && Number.isInteger(value.tabId);
    case "READ_STATE":
      return true;
    case "GET_LOGICAL_PAGE_SITE_KEY":
      return typeof value.pageUrl === "string";
    case "RECORD_LOGICAL_PAGE_OBSERVATION":
      return (
        typeof value.pageUrl === "string" &&
        typeof value.pageProfileId === "string" &&
        typeof value.siteKeyId === "string" &&
        isOpaqueLogicalPageEvidencePayload(value.evidence)
      );
    case "RESOLVE_LOGICAL_PAGE_CANDIDATE":
      return isOpaqueLogicalPageCandidateEvidencePayload(value.evidence);
    case "CONFIRM_LOGICAL_PAGE_CANDIDATE":
      return (
        typeof value.ruleId === "string" &&
        typeof value.canonicalPageProfileId === "string" &&
        (value.pageIdentityKey === null || typeof value.pageIdentityKey === "string") &&
        isOpaqueLogicalPageCandidateEvidencePayload(value.evidence)
      );
    case "STOP_LOGICAL_PAGE_MATCHING":
      return typeof value.ruleId === "string";
    case "GET_ACTIVATION_SNAPSHOT":
      return (
        value.pageUrl === undefined ||
        value.pageUrl === null ||
        typeof value.pageUrl === "string"
      );
    case "GET_ACTIVATION_MANAGEMENT":
      return true;
    case "SET_GLOBAL_ACTIVATION":
      return isActivationMode(value.mode);
    case "SET_ORIGIN_ACTIVATION":
      return typeof value.origin === "string" && isActivationMode(value.mode);
    case "CREATE_TEMPLATE":
      return typeof value.content === "string" && typeof value.pageUrl === "string";
    case "UPDATE_TEMPLATE":
      return typeof value.templateId === "string" && typeof value.content === "string";
    case "DELETE_TEMPLATE":
      return typeof value.templateId === "string";
    case "RESTORE_TEMPLATE":
      return (
        isTemplateRecordShape(value.template) &&
        isBindingRecordArrayShape(value.bindings) &&
        (value.sharedBindings === undefined ||
          isSharedTemplateBindingRecordArrayShape(value.sharedBindings)) &&
        (value.fieldStates === undefined || isSharedTemplateFieldStateArrayShape(value.fieldStates))
      );
    case "DELETE_TEMPLATES":
      if (value.typedConfirmation !== undefined && value.typedConfirmation !== "delete") return false;
      return Array.isArray(value.templateIds) && value.templateIds.every((id) => typeof id === "string");
    case "RESTORE_TEMPLATES":
      return (
        Array.isArray(value.templates) &&
        value.templates.every(
          (entry) =>
            isRecord(entry) &&
            isTemplateRecordShape(entry.template) &&
            isBindingRecordArrayShape(entry.bindings) &&
            (entry.sharedBindings === undefined ||
              isSharedTemplateBindingRecordArrayShape(entry.sharedBindings)) &&
            (entry.fieldStates === undefined || isSharedTemplateFieldStateArrayShape(entry.fieldStates)),
        )
      );
    case "GET_PICKER_POSITION":
    case "GET_PAGE_STATUS_POSITION":
    case "RESET_PAGE_STATUS_POSITION":
    case "GET_DISMISSED_TIPS":
    case "SHOW_TIPS_AGAIN":
    case "GET_LANGUAGE":
      return true;
    case "DISMISS_TIP":
      return isTipId(value.tip);
    case "SET_LANGUAGE":
      return isLanguagePreference(value.language);
    case "SET_PICKER_POSITION":
    case "SET_PAGE_STATUS_POSITION":
      return value.position === null || isPickerPositionShape(value.position);
    case "SET_PAGE_ALIAS":
      return typeof value.pageProfileId === "string" && typeof value.alias === "string";
    case "SET_FIELD_ALIAS":
      return (
        typeof value.fieldProfileId === "string" &&
        typeof value.alias === "string" &&
        (value.newField === undefined || isBindingTargetShape(value.newField))
      );
    case "RECORD_INSERTION":
      return typeof value.templateId === "string" && typeof value.fieldProfileId === "string";
    case "RECORD_INSERTION_REJECTION":
      return typeof value.fieldProfileId === "string" && typeof value.rejected === "boolean";
    case "SAVE_TEMPLATE_COPY_FOR_FIELD":
      return (
        typeof value.templateId === "string" &&
        typeof value.fieldProfileId === "string" &&
        typeof value.content === "string"
      );
    case "SAVE_TEMPLATE_COPY_FOR_SHARED_SET":
      return (
        typeof value.setId === "string" &&
        typeof value.slotId === "string" &&
        typeof value.content === "string"
      );
    case "UNDO_BIND":
      return typeof value.bindingId === "string";
    case "UNDO_UNBIND":
      return isBindingRecordShape(value.binding);
    case "UNDO_SAVE":
      return isTemplateRecordShape(value.template) && isNonNegativeInteger(value.expectedRevision);
    case "UNDO_SAVE_COPY_FOR_FIELD":
      return typeof value.copyTemplateId === "string" && isBindingRecordShape(value.originalBinding);
    case "UNDO_SAVE_TEMPLATE_COPY_FOR_SHARED_SET":
      return (
        typeof value.copyTemplateId === "string" &&
        isSharedTemplateBindingRecordShape(value.originalSharedBinding)
      );
    case "CREATE_TEMPLATE_AND_BIND":
      if (value.privateToField !== undefined && value.privateToField !== true) return false;
      return (
        typeof value.content === "string" &&
        typeof value.pageUrl === "string" &&
        typeof value.pageProfileId === "string" &&
        typeof value.fieldProfileId === "string" &&
        (value.pageIdentityKey === undefined ||
          typeof value.pageIdentityKey === "string") &&
        (value.fieldIdentityKey === undefined ||
          typeof value.fieldIdentityKey === "string") &&
        (value.fieldDocumentOrder === undefined || isNonNegativeInteger(value.fieldDocumentOrder)) &&
        (value.fieldObservedTitle === undefined || typeof value.fieldObservedTitle === "string")
      );
    case "BIND_TEMPLATE":
      return (
        typeof value.templateId === "string" &&
        typeof value.pageUrl === "string" &&
        typeof value.pageProfileId === "string" &&
        typeof value.fieldProfileId === "string" &&
        (value.pageIdentityKey === undefined ||
          typeof value.pageIdentityKey === "string") &&
        (value.fieldIdentityKey === undefined ||
          typeof value.fieldIdentityKey === "string") &&
        (value.fieldDocumentOrder === undefined || isNonNegativeInteger(value.fieldDocumentOrder)) &&
        (value.fieldObservedTitle === undefined || typeof value.fieldObservedTitle === "string")
      );
    case "RESOLVE_FIELD_CONTEXT":
      return (
        typeof value.pageUrl === "string" &&
        (typeof value.pageIdentityKey === "string" || value.pageIdentityKey === null) &&
        (typeof value.fieldIdentityKey === "string" || value.fieldIdentityKey === null)
      );
    case "UNBIND_TEMPLATE":
      return (
        typeof value.templateId === "string" &&
        typeof value.fieldProfileId === "string"
      );
    case "CREATE_SHARED_TEMPLATE_SET":
      return (
        Array.isArray(value.fieldProfileIds) &&
        value.fieldProfileIds.every((id) => typeof id === "string") &&
        (value.newFields === undefined ||
          (Array.isArray(value.newFields) && value.newFields.every((entry) => isBindingTargetShape(entry)))) &&
        (value.allowCrossSite === undefined || typeof value.allowCrossSite === "boolean")
      );
    case "UNDO_CREATE_SHARED_TEMPLATE_SET":
      return typeof value.setId === "string";
    case "ADD_SHARED_TEMPLATE_SET_MEMBER":
      return (
        typeof value.setId === "string" &&
        typeof value.fieldProfileId === "string" &&
        (value.newField === undefined || isBindingTargetShape(value.newField)) &&
        (value.allowCrossSite === undefined || typeof value.allowCrossSite === "boolean")
      );
    case "UNDO_ADD_SHARED_TEMPLATE_SET_MEMBER":
      return typeof value.setId === "string" && typeof value.fieldProfileId === "string" && isSharedMemberAddUndo(value);
    case "REMOVE_SHARED_TEMPLATE_SET_MEMBER":
      return typeof value.setId === "string" && typeof value.fieldProfileId === "string";
    case "UNDO_REMOVE_SHARED_TEMPLATE_SET_MEMBER":
      return (
        typeof value.fieldProfileId === "string" &&
        isSharedTemplateSetRecordShape(value.set) &&
        isSharedTemplateBindingRecordArrayShape(value.endedSharedBindings) &&
        isBindingRecordArrayShape(value.snapshotBindings) &&
        isBindingRecordArrayShape(value.dormantBindings) &&
        isSharedTemplateBindingRecordArrayShape(value.removedOwnedSlots) &&
        isSharedTemplateFieldStateArrayShape(value.removedFieldStates)
      );
    case "END_SHARED_TEMPLATE_SET":
      return typeof value.setId === "string";
    case "UNDO_END_SHARED_TEMPLATE_SET":
      return (
        isSharedTemplateSetRecordShape(value.set) &&
        isSharedTemplateBindingRecordArrayShape(value.sharedBindings) &&
        isSharedTemplateFieldStateArrayShape(value.endedFieldStates) &&
        isBindingRecordArrayShape(value.convertedBindings) &&
        isBindingRecordArrayShape(value.dormantBindings)
      );
    case "SAVE_TEMPLATE_OVERRIDE_FOR_FIELD":
      return (
        typeof value.setId === "string" &&
        typeof value.slotId === "string" &&
        typeof value.fieldProfileId === "string" &&
        typeof value.content === "string"
      );
    case "UNDO_SAVE_TEMPLATE_OVERRIDE_FOR_FIELD":
      return (
        typeof value.copyTemplateId === "string" &&
        (value.previousState === null || isSharedTemplateFieldStateShape(value.previousState))
      );
    case "EXCLUDE_SHARED_TEMPLATE_FOR_FIELD":
      return (
        typeof value.setId === "string" &&
        typeof value.slotId === "string" &&
        typeof value.fieldProfileId === "string"
      );
    case "UNDO_EXCLUDE_SHARED_TEMPLATE_FOR_FIELD":
      return (
        typeof value.setId === "string" &&
        typeof value.slotId === "string" &&
        typeof value.fieldProfileId === "string" &&
        (value.previousState === null || isSharedTemplateFieldStateShape(value.previousState))
      );
    case "RENAME_SHARED_TEMPLATE_SET":
      return typeof value.setId === "string" && typeof value.name === "string";
    case "CREATE_TEMPLATE_AND_BIND_SHARED":
      return typeof value.setId === "string" && typeof value.content === "string";
    case "UNDO_CREATE_TEMPLATE_AND_BIND_SHARED":
      return (
        typeof value.setId === "string" &&
        typeof value.sharedBindingId === "string" &&
        typeof value.templateId === "string"
      );
    case "CREATE_TEMPLATE_AND_BIND_SHARED_FIELD_ONLY":
      return (
        typeof value.setId === "string" &&
        typeof value.fieldProfileId === "string" &&
        typeof value.content === "string"
      );
    case "UNDO_CREATE_TEMPLATE_AND_BIND_SHARED_FIELD_ONLY":
      return (
        typeof value.setId === "string" &&
        typeof value.sharedBindingId === "string" &&
        typeof value.templateId === "string"
      );
    case "BIND_TEMPLATE_SHARED":
      return typeof value.setId === "string" && typeof value.templateId === "string" &&
        (value.fieldProfileId === undefined || typeof value.fieldProfileId === "string");
    case "UNBIND_TEMPLATE_SHARED":
      return typeof value.setId === "string" && typeof value.slotId === "string";
    case "UNDO_BIND_TEMPLATE_SHARED":
      return typeof value.sharedBindingId === "string";
    case "UNDO_UNBIND_TEMPLATE_SHARED":
      return isSharedTemplateBindingRecordShape(value.sharedBinding) && isSharedTemplateFieldStateArrayShape(value.fieldStates);
    case "BIND_TEMPLATE_TO_FIELD_ONLY":
      return (
        typeof value.setId === "string" &&
        typeof value.fieldProfileId === "string" &&
        typeof value.templateId === "string"
      );
    case "UNDO_BIND_TEMPLATE_TO_FIELD_ONLY":
      return typeof value.setId === "string" && isSharedTemplateBindingRecordShape(value.sharedBinding);
    case "PROMOTE_FIELD_ONLY_SLOT":
      return (
        typeof value.setId === "string" &&
        typeof value.slotId === "string" &&
        typeof value.fieldProfileId === "string"
      );
    case "UNDO_PROMOTE_FIELD_ONLY_SLOT":
      return (
        typeof value.setId === "string" &&
        typeof value.slotId === "string" &&
        typeof value.ownerFieldProfileId === "string" &&
        (value.consumedSlot === undefined || isSharedTemplateBindingRecordShape(value.consumedSlot)) &&
        (value.previousOrdinarySlot === undefined || isSharedTemplateBindingRecordShape(value.previousOrdinarySlot)) &&
        (value.removedFieldStates === undefined || isSharedTemplateFieldStateArrayShape(value.removedFieldStates)) &&
        (value.previousSlot === undefined || isSharedTemplateBindingRecordShape(value.previousSlot))
      );
    case "JOIN_SET_AND_SHARE":
      return (
        typeof value.setId === "string" &&
        typeof value.slotId === "string" &&
        typeof value.fieldProfileId === "string" &&
        typeof value.targetFieldProfileId === "string" &&
        (value.newField === undefined || isBindingTargetShape(value.newField)) &&
        (value.allowCrossSite === undefined || typeof value.allowCrossSite === "boolean")
      );
    case "UNDO_JOIN_SET_AND_SHARE":
      return (
        typeof value.setId === "string" &&
        typeof value.targetFieldProfileId === "string" &&
        isSharedMemberAddUndo(value.addUndo) &&
        typeof value.slotId === "string" &&
        typeof value.ownerFieldProfileId === "string" &&
        (value.consumedSlot === undefined || isSharedTemplateBindingRecordShape(value.consumedSlot)) &&
        (value.previousOrdinarySlot === undefined || isSharedTemplateBindingRecordShape(value.previousOrdinarySlot)) &&
        (value.removedFieldStates === undefined || isSharedTemplateFieldStateArrayShape(value.removedFieldStates)) &&
        (value.previousSlot === undefined || isSharedTemplateBindingRecordShape(value.previousSlot))
      );
    case "MERGE_SETS_AND_SHARE":
      return (
        typeof value.keepSetId === "string" &&
        typeof value.removeSetId === "string" &&
        typeof value.fieldProfileId === "string" &&
        typeof value.slotId === "string"
      );
    case "UNDO_MERGE_SETS_AND_SHARE":
      return (
        isSharedTemplateSetRecordShape(value.mergedSet) &&
        isSharedTemplateBindingRecordArrayShape(value.mergedSetBindings) &&
        isSharedTemplateSetRecordShape(value.previousKeepSet) &&
        isSharedTemplateBindingRecordArrayShape(value.previousKeepSetBindings) &&
        isSharedTemplateSetRecordShape(value.removedSet) &&
        isSharedTemplateBindingRecordArrayShape(value.removedSetBindings) &&
        isSharedTemplateFieldStateArrayShape(value.remappedFieldStates) &&
        isSharedTemplateFieldStateArrayShape(value.previousRemovedSetFieldStates) &&
        typeof value.slotId === "string" &&
        typeof value.ownerFieldProfileId === "string" &&
        (value.consumedSlot === undefined || isSharedTemplateBindingRecordShape(value.consumedSlot)) &&
        (value.previousOrdinarySlot === undefined || isSharedTemplateBindingRecordShape(value.previousOrdinarySlot)) &&
        (value.removedFieldStates === undefined || isSharedTemplateFieldStateArrayShape(value.removedFieldStates)) &&
        (value.previousSlot === undefined || isSharedTemplateBindingRecordShape(value.previousSlot))
      );
    case "FIND_SIMILAR_FIELD_CANDIDATES":
      return (
        typeof value.fieldProfileId === "string" &&
        (value.newField === undefined || isBindingTargetShape(value.newField))
      );
    case "RECORD_COMPATIBILITY_PAIR_NO":
      return typeof value.fieldProfileIdA === "string" && typeof value.fieldProfileIdB === "string";
    case "MERGE_SHARED_TEMPLATE_SETS":
      return typeof value.keepSetId === "string" && typeof value.removeSetId === "string";
    case "UNDO_MERGE_SHARED_TEMPLATE_SETS":
      return (
        isSharedTemplateSetRecordShape(value.mergedSet) &&
        isSharedTemplateBindingRecordArrayShape(value.mergedSetBindings) &&
        isSharedTemplateSetRecordShape(value.previousKeepSet) &&
        isSharedTemplateBindingRecordArrayShape(value.previousKeepSetBindings) &&
        isSharedTemplateSetRecordShape(value.removedSet) &&
        isSharedTemplateBindingRecordArrayShape(value.removedSetBindings) &&
        isSharedTemplateFieldStateArrayShape(value.remappedFieldStates) &&
        isSharedTemplateFieldStateArrayShape(value.previousRemovedSetFieldStates)
      );
    case "CREATE_BACKUP_ARCHIVE":
    case "GET_RESET_PREVIEW":
    case "GET_APPEARANCE":
      return true;
    case "SET_APPEARANCE":
      return (
        isRecord(value.appearance) &&
        isThemeId(value.appearance.themeId) &&
        isThemeModePreference(value.appearance.mode)
      );
    case "RESET_FILLNEST":
      return typeof value.expectedConfirmationToken === "string" && value.typedConfirmation === "reset";
    case "VALIDATE_BACKUP_ARCHIVE":
      return typeof value.archiveJson === "string";
    case "RESTORE_BACKUP_ARCHIVE":
      return (
        typeof value.archiveJson === "string" &&
        typeof value.expectedConfirmationToken === "string" &&
        value.typedConfirmation === "restore"
      );
    default:
      return false;
  }
}

export function isCreateBackupArchiveResultShape(value: unknown): value is CreateBackupArchiveResult {
  return (
    isRecord(value) &&
    typeof value.archiveJson === "string" &&
    typeof value.defaultFilename === "string"
  );
}

export function isValidateBackupArchiveResultShape(value: unknown): value is ValidateBackupArchiveResult {
  return isRecord(value) && isRecord(value.preview) && typeof value.confirmationToken === "string";
}

export function isRestoreBackupArchiveResultShape(value: unknown): value is RestoreBackupArchiveResult {
  return isRecord(value) && value.success === true && typeof value.unreachableTabsCount === "number";
}

export function isResetPreviewResultShape(value: unknown): value is ResetPreviewResult {
  return isRecord(value) && isRecord(value.preview) && typeof value.confirmationToken === "string";
}

export function isResetFillNestResultShape(value: unknown): value is ResetFillNestResult {
  return isRecord(value) && value.success === true;
}

function isActivationMode(value: unknown): value is ActivationMode {
  return value === "active" || value === "paused";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isResetSiteMappingsExpectedImpactShape(value: unknown): value is ResetSiteMappingsExpectedImpact {
  return (
    isRecord(value) &&
    isNonNegativeInteger(value.pageProfileCount) &&
    isNonNegativeInteger(value.fieldProfileCount) &&
    isNonNegativeInteger(value.bindingCount) &&
    isNonNegativeInteger(value.pageAliasCount) &&
    isNonNegativeInteger(value.fieldAliasCount) &&
    isNonNegativeInteger(value.templateAffinityCount) &&
    isNonNegativeInteger(value.logicalPageRuleCount) &&
    isNonNegativeInteger(value.sharedTemplateSetCount)
  );
}

function isBindingTargetShape(value: unknown): value is BindingTargetPayload {
  return (
    isRecord(value) &&
    typeof value.pageUrl === "string" &&
    typeof value.pageProfileId === "string" &&
    typeof value.fieldProfileId === "string" &&
    (value.pageIdentityKey === undefined || typeof value.pageIdentityKey === "string") &&
    (value.fieldIdentityKey === undefined || typeof value.fieldIdentityKey === "string") &&
    (value.fieldDocumentOrder === undefined || isNonNegativeInteger(value.fieldDocumentOrder)) &&
    (value.fieldObservedTitle === undefined || typeof value.fieldObservedTitle === "string")
  );
}

function isSharedTemplateSetRecordShape(value: unknown): value is SharedTemplateSetRecord {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.siteId === "string" &&
    typeof value.name === "string" &&
    Array.isArray(value.memberFieldProfileIds) &&
    value.memberFieldProfileIds.every((id) => typeof id === "string")
  );
}

function isSharedTemplateBindingRecordShape(value: unknown): value is SharedTemplateBindingRecord {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.setId === "string" &&
    typeof value.templateId === "string" &&
    isNonNegativeInteger(value.usageCount) &&
    isNonNegativeInteger(value.revision) &&
    isNonNegativeInteger(value.order)
  );
}

function isSharedTemplateBindingRecordArrayShape(value: unknown): value is SharedTemplateBindingRecord[] {
  return Array.isArray(value) && value.every((binding) => isSharedTemplateBindingRecordShape(binding));
}

function isSharedTemplateFieldStateShape(value: unknown): value is SharedTemplateFieldStateRecord {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.setId !== "string" ||
    typeof value.slotId !== "string" ||
    typeof value.fieldProfileId !== "string" ||
    (value.mode !== "override" && value.mode !== "exclude")
  ) {
    return false;
  }
  if (value.mode === "override") {
    return (
      typeof value.templateId === "string" &&
      isNonNegativeInteger(value.usageCount) &&
      isNonNegativeInteger(value.revision)
    );
  }
  return value.templateId === undefined && value.usageCount === undefined && value.revision === undefined;
}

function isSharedTemplateFieldStateArrayShape(value: unknown): value is SharedTemplateFieldStateRecord[] {
  return Array.isArray(value) && value.every((entry) => isSharedTemplateFieldStateShape(entry));
}

function isResetSiteMappingsInputShape(value: unknown): value is ResetSiteMappingsBatchInput["sites"][number] {
  return (
    isRecord(value) &&
    typeof value.siteId === "string" &&
    (value.expectedImpact === undefined || isResetSiteMappingsExpectedImpactShape(value.expectedImpact))
  );
}

function isTemplateRecordShape(value: unknown): value is TemplateRecord {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.content === "string" &&
    Array.isArray(value.siteAffinities) &&
    value.siteAffinities.every((site) => typeof site === "string") &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string" &&
    isNonNegativeInteger(value.totalUsageCount) &&
    isNonNegativeInteger(value.revision)
  );
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isLogicalPageFeatureHashArray(candidate: unknown): candidate is string[] {
  return (
    Array.isArray(candidate) &&
    candidate.length > 0 &&
    candidate.every((entry) => typeof entry === "string" && /^[a-f0-9]{64}$/u.test(entry)) &&
    new Set(candidate).size === candidate.length
  );
}

function isOpaqueLogicalPageEvidencePayload(value: unknown): value is OpaqueLogicalPageEvidencePayload {
  return (
    isRecord(value) &&
    Object.keys(value).every((key) => [
      "origin",
      "routePattern",
      "fieldFeatureHashes",
      "groupedFieldFeatureHashes",
    ].includes(key)) &&
    typeof value.origin === "string" &&
    typeof value.routePattern === "string" &&
    value.routePattern.startsWith("/") &&
    isLogicalPageFeatureHashArray(value.fieldFeatureHashes) &&
    isLogicalPageFeatureHashArray(value.groupedFieldFeatureHashes)
  );
}

function isOpaqueLogicalPageCandidateEvidencePayload(
  value: unknown,
): value is OpaqueLogicalPageCandidateEvidencePayload {
  return (
    isRecord(value) &&
    Object.keys(value).every((key) => [
      "origin",
      "routePattern",
      "fieldFeatureHashes",
      "groupedFieldFeatureHashes",
      "fieldIdentityKey",
    ].includes(key)) &&
    typeof value.origin === "string" &&
    typeof value.routePattern === "string" &&
    value.routePattern.startsWith("/") &&
    isLogicalPageFeatureHashArray(value.fieldFeatureHashes) &&
    isLogicalPageFeatureHashArray(value.groupedFieldFeatureHashes) &&
    (value.fieldIdentityKey === null || typeof value.fieldIdentityKey === "string")
  );
}

function isPickerPositionShape(value: unknown): value is PickerPosition {
  return (
    isRecord(value) &&
    typeof value.top === "number" &&
    typeof value.left === "number" &&
    Number.isFinite(value.top) &&
    Number.isFinite(value.left)
  );
}

function isBindingRecordArrayShape(value: unknown): value is BindingRecord[] {
  return Array.isArray(value) && value.every((binding) => isBindingRecordShape(binding));
}

function isBindingRecordShape(value: unknown): value is BindingRecord {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.templateId === "string" &&
    typeof value.pageProfileId === "string" &&
    typeof value.fieldProfileId === "string" &&
    typeof value.createdAt === "string" &&
    isNonNegativeInteger(value.usageCount) &&
    isNonNegativeInteger(value.revision)
  );
}

function isSharedMemberAddUndo(value: unknown): value is SharedMemberAddUndo {
  return isRecord(value) && isSharedTemplateSetRecordShape(value.previousSet) &&
    isSharedTemplateSetRecordShape(value.expectedSet) &&
    isSharedTemplateBindingRecordArrayShape(value.previousSharedBindings) &&
    isSharedTemplateBindingRecordArrayShape(value.expectedSharedBindings);
}

export function isAddSharedTemplateSetMemberResult(value: unknown): value is AddSharedTemplateSetMemberResult {
  return isSharedTemplateSetRecordShape(value) && isRecord(value) && isSharedMemberAddUndo(value.undo);
}
