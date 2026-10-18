import type { RuntimeRequest } from "../messages/runtime-messages";

// Whether handling a given RuntimeRequest type should broadcast
// BUSINESS_STATE_CHANGED to every extension page and content script.
//
// This is a total mapping keyed by every RuntimeRequest["type"] literal, so
// adding a new RuntimeRequest variant without adding a corresponding entry
// here is a TypeScript compile error, not a silent runtime gap - the failure
// mode a separately maintained allow-list (e.g. a Set checked ad hoc against
// the type) would otherwise permit.
export const BUSINESS_STATE_BROADCAST: Readonly<Record<RuntimeRequest["type"], boolean>> = {
  ENABLE_SITE: false,
  RETRY_SITE_ACTIVATION: false,
  REMOVE_WEBSITE_ACCESS: false,
  REMOVE_SITE: true,
  RESET_SITE_MAPPINGS_BATCH: true,
  DELETE_NEWLY_GLOBAL_TEMPLATES: true,
  GET_ACTIVATION_SNAPSHOT: false,
  GET_ACTIVATION_MANAGEMENT: false,
  SET_GLOBAL_ACTIVATION: false,
  SET_ORIGIN_ACTIVATION: false,
  READ_STATE: false,
  GET_LOGICAL_PAGE_SITE_KEY: false,
  // An Observation is opaque background bookkeeping with no UI surface of its
  // own (unlike a confirmed Rule, which Sites management shows and can Stop
  // matching) - broadcasting here would only ever invalidate an unrelated
  // pending Undo/outcome elsewhere for no user-visible reason.
  RECORD_LOGICAL_PAGE_OBSERVATION: false,
  RESOLVE_LOGICAL_PAGE_CANDIDATE: false,
  CONFIRM_LOGICAL_PAGE_CANDIDATE: true,
  STOP_LOGICAL_PAGE_MATCHING: true,
  CREATE_TEMPLATE: true,
  UPDATE_TEMPLATE: true,
  DELETE_TEMPLATE: true,
  RESTORE_TEMPLATE: true,
  DELETE_TEMPLATES: true,
  RESTORE_TEMPLATES: true,
  GET_PICKER_POSITION: false,
  SET_PICKER_POSITION: false,
  GET_PAGE_STATUS_POSITION: false,
  SET_PAGE_STATUS_POSITION: false,
  RESET_PAGE_STATUS_POSITION: false,
  // Task 042: a display preference; no business state moves.
  GET_DISMISSED_TIPS: false,
  DISMISS_TIP: false,
  SHOW_TIPS_AGAIN: false,
  // Task 034: the theme has its own APPEARANCE_CHANGED notification. Sending
  // BUSINESS_STATE_CHANGED for it would invalidate a pending Undo elsewhere
  // for a change that touched no business data at all.
  GET_APPEARANCE: false,
  SET_APPEARANCE: false,
  // Task 037: the language, like the theme, is a display preference. Every
  // surface re-renders its own words from LANGUAGE_CHANGED; no business state
  // has moved, and a pending Undo must survive changing language.
  GET_LANGUAGE: false,
  SET_LANGUAGE: false,
  SET_PAGE_ALIAS: true,
  SET_FIELD_ALIAS: true,
  RECORD_INSERTION: true,
  // Task 036. No surface displays the Insertion Rejection fact except the
  // Picker that just produced it, and it re-reads its own state; broadcasting
  // would make every content script re-record its Page Observation and could
  // erase an unrelated Picker outcome, which is the Task 020 defect this
  // mapping already learned once.
  RECORD_INSERTION_REJECTION: false,
  SAVE_TEMPLATE_COPY_FOR_FIELD: true,
  SAVE_TEMPLATE_COPY_FOR_SHARED_SET: true,
  SAVE_TEMPLATE_OVERRIDE_FOR_FIELD: true,
  UNDO_SAVE_TEMPLATE_OVERRIDE_FOR_FIELD: true,
  EXCLUDE_SHARED_TEMPLATE_FOR_FIELD: true,
  UNDO_EXCLUDE_SHARED_TEMPLATE_FOR_FIELD: true,
  UNDO_BIND: true,
  UNDO_UNBIND: true,
  UNDO_SAVE: true,
  UNDO_SAVE_COPY_FOR_FIELD: true,
  UNDO_SAVE_TEMPLATE_COPY_FOR_SHARED_SET: true,
  CREATE_TEMPLATE_AND_BIND: true,
  BIND_TEMPLATE: true,
  RESOLVE_FIELD_CONTEXT: false,
  UNBIND_TEMPLATE: true,
  CREATE_SHARED_TEMPLATE_SET: true,
  UNDO_CREATE_SHARED_TEMPLATE_SET: true,
  ADD_SHARED_TEMPLATE_SET_MEMBER: true,
  UNDO_ADD_SHARED_TEMPLATE_SET_MEMBER: true,
  REMOVE_SHARED_TEMPLATE_SET_MEMBER: true,
  UNDO_REMOVE_SHARED_TEMPLATE_SET_MEMBER: true,
  END_SHARED_TEMPLATE_SET: true,
  UNDO_END_SHARED_TEMPLATE_SET: true,
  RENAME_SHARED_TEMPLATE_SET: true,
  CREATE_TEMPLATE_AND_BIND_SHARED: true,
  UNDO_CREATE_TEMPLATE_AND_BIND_SHARED: true,
  CREATE_TEMPLATE_AND_BIND_SHARED_FIELD_ONLY: true,
  UNDO_CREATE_TEMPLATE_AND_BIND_SHARED_FIELD_ONLY: true,
  BIND_TEMPLATE_SHARED: true,
  UNDO_BIND_TEMPLATE_SHARED: true,
  UNBIND_TEMPLATE_SHARED: true,
  UNDO_UNBIND_TEMPLATE_SHARED: true,
  BIND_TEMPLATE_TO_FIELD_ONLY: true,
  UNDO_BIND_TEMPLATE_TO_FIELD_ONLY: true,
  PROMOTE_FIELD_ONLY_SLOT: true,
  UNDO_PROMOTE_FIELD_ONLY_SLOT: true,
  JOIN_SET_AND_SHARE: true,
  UNDO_JOIN_SET_AND_SHARE: true,
  MERGE_SETS_AND_SHARE: true,
  UNDO_MERGE_SETS_AND_SHARE: true,
  FIND_SIMILAR_FIELD_CANDIDATES: false,
  RECORD_COMPATIBILITY_PAIR_NO: true,
  MERGE_SHARED_TEMPLATE_SETS: true,
  UNDO_MERGE_SHARED_TEMPLATE_SETS: true,
  CREATE_BACKUP_ARCHIVE: false,
  GET_RESET_PREVIEW: false,
  // Reset explicitly broadcasts both Business and Activation updates after
  // every reset invariant has been verified.
  RESET_FILLNEST: false,
  VALIDATE_BACKUP_ARCHIVE: false,
  // Restore explicitly broadcasts both Business and Activation updates and
  // reports unreachable authorized tabs before returning to its caller.
  RESTORE_BACKUP_ARCHIVE: false,
};

/**
 * Whether handling a given RuntimeRequest can remove the stored Page and Field
 * Profiles that a live content script is already holding.
 *
 * Task 004 Addendum B repaired Clear Site Data by dropping the content
 * runtime's document-lifetime Field Context cache on every business change.
 * That cache is also what stops an SPA-reconstructed Field from losing the
 * Binding the user just made: such a Field resolves with no field identity
 * key, so each re-resolution mints a new Field Profile id. Clearing it after
 * an ordinary mutation therefore discarded the identity that mutation had just
 * been recorded against.
 *
 * Only the commands below can invalidate a held identity, so only they carry
 * `fieldIdentitiesInvalidated`. Like its sibling above, this is a total
 * mapping: a new RuntimeRequest variant without an entry is a compile error.
 */
export const FIELD_IDENTITY_INVALIDATION: Readonly<Record<RuntimeRequest["type"], boolean>> = {
  ENABLE_SITE: false,
  RETRY_SITE_ACTIVATION: false,
  REMOVE_WEBSITE_ACCESS: false,
  // Clear Site Data and Remove Site both run through
  // `resetSiteMappingsBatch`, the only command that removes stored Page and
  // Field Profiles.
  REMOVE_SITE: true,
  RESET_SITE_MAPPINGS_BATCH: true,
  DELETE_NEWLY_GLOBAL_TEMPLATES: false,
  GET_ACTIVATION_SNAPSHOT: false,
  GET_ACTIVATION_MANAGEMENT: false,
  SET_GLOBAL_ACTIVATION: false,
  SET_ORIGIN_ACTIVATION: false,
  READ_STATE: false,
  GET_LOGICAL_PAGE_SITE_KEY: false,
  RECORD_LOGICAL_PAGE_OBSERVATION: false,
  RESOLVE_LOGICAL_PAGE_CANDIDATE: false,
  CONFIRM_LOGICAL_PAGE_CANDIDATE: false,
  STOP_LOGICAL_PAGE_MATCHING: false,
  CREATE_TEMPLATE: false,
  UPDATE_TEMPLATE: false,
  DELETE_TEMPLATE: false,
  RESTORE_TEMPLATE: false,
  DELETE_TEMPLATES: false,
  RESTORE_TEMPLATES: false,
  GET_PICKER_POSITION: false,
  SET_PICKER_POSITION: false,
  GET_PAGE_STATUS_POSITION: false,
  SET_PAGE_STATUS_POSITION: false,
  RESET_PAGE_STATUS_POSITION: false,
  // Task 042: a display preference; no business state moves.
  GET_DISMISSED_TIPS: false,
  DISMISS_TIP: false,
  SHOW_TIPS_AGAIN: false,
  GET_APPEARANCE: false,
  SET_APPEARANCE: false,
  // Task 037: the language, like the theme, is a display preference. Every
  // surface re-renders its own words from LANGUAGE_CHANGED; no business state
  // has moved, and a pending Undo must survive changing language.
  GET_LANGUAGE: false,
  SET_LANGUAGE: false,
  SET_PAGE_ALIAS: false,
  SET_FIELD_ALIAS: false,
  RECORD_INSERTION: false,
  RECORD_INSERTION_REJECTION: false,
  SAVE_TEMPLATE_COPY_FOR_FIELD: false,
  SAVE_TEMPLATE_COPY_FOR_SHARED_SET: false,
  SAVE_TEMPLATE_OVERRIDE_FOR_FIELD: false,
  UNDO_SAVE_TEMPLATE_OVERRIDE_FOR_FIELD: false,
  EXCLUDE_SHARED_TEMPLATE_FOR_FIELD: false,
  UNDO_EXCLUDE_SHARED_TEMPLATE_FOR_FIELD: false,
  UNDO_BIND: false,
  UNDO_UNBIND: false,
  UNDO_SAVE: false,
  UNDO_SAVE_COPY_FOR_FIELD: false,
  UNDO_SAVE_TEMPLATE_COPY_FOR_SHARED_SET: false,
  CREATE_TEMPLATE_AND_BIND: false,
  BIND_TEMPLATE: false,
  RESOLVE_FIELD_CONTEXT: false,
  UNBIND_TEMPLATE: false,
  CREATE_SHARED_TEMPLATE_SET: false,
  UNDO_CREATE_SHARED_TEMPLATE_SET: false,
  ADD_SHARED_TEMPLATE_SET_MEMBER: false,
  UNDO_ADD_SHARED_TEMPLATE_SET_MEMBER: false,
  REMOVE_SHARED_TEMPLATE_SET_MEMBER: false,
  UNDO_REMOVE_SHARED_TEMPLATE_SET_MEMBER: false,
  END_SHARED_TEMPLATE_SET: false,
  UNDO_END_SHARED_TEMPLATE_SET: false,
  RENAME_SHARED_TEMPLATE_SET: false,
  CREATE_TEMPLATE_AND_BIND_SHARED: false,
  UNDO_CREATE_TEMPLATE_AND_BIND_SHARED: false,
  CREATE_TEMPLATE_AND_BIND_SHARED_FIELD_ONLY: false,
  UNDO_CREATE_TEMPLATE_AND_BIND_SHARED_FIELD_ONLY: false,
  BIND_TEMPLATE_SHARED: false,
  UNDO_BIND_TEMPLATE_SHARED: false,
  UNBIND_TEMPLATE_SHARED: false,
  UNDO_UNBIND_TEMPLATE_SHARED: false,
  BIND_TEMPLATE_TO_FIELD_ONLY: false,
  UNDO_BIND_TEMPLATE_TO_FIELD_ONLY: false,
  PROMOTE_FIELD_ONLY_SLOT: false,
  UNDO_PROMOTE_FIELD_ONLY_SLOT: false,
  JOIN_SET_AND_SHARE: false,
  UNDO_JOIN_SET_AND_SHARE: false,
  MERGE_SETS_AND_SHARE: false,
  UNDO_MERGE_SETS_AND_SHARE: false,
  FIND_SIMILAR_FIELD_CANDIDATES: false,
  RECORD_COMPATIBILITY_PAIR_NO: false,
  MERGE_SHARED_TEMPLATE_SETS: false,
  UNDO_MERGE_SHARED_TEMPLATE_SETS: false,
  CREATE_BACKUP_ARCHIVE: false,
  GET_RESET_PREVIEW: false,
  // Reset and Restore replace the whole store, so every stored identity a
  // live page is holding may be gone.
  RESET_FILLNEST: true,
  VALIDATE_BACKUP_ARCHIVE: false,
  RESTORE_BACKUP_ARCHIVE: true,
};
