import { UserFacingError } from "../messages/user-error";
import type { RuntimeRequest } from "../messages/runtime-messages";

/**
 * Task 028 Addendum B.1 - the single authority on destructive-operation
 * confirmation.
 *
 * Before this, five entry points each decided independently what counted as
 * destructive and what confirmation it needed: `DELETE_TEMPLATE`,
 * `DELETE_TEMPLATES`, `DELETE_NEWLY_GLOBAL_TEMPLATES`, `RESET_FILLNEST`, and
 * `RESTORE_BACKUP_ARCHIVE`. Two enforced a typed word at the boundary, one
 * enforced it only in the Side Panel, one had no gate at all, and nothing
 * required a newly added message to declare a policy.
 */

export type DestructiveConfirmationPolicy =
  // No typed confirmation at this boundary. Note that some of these are still
  // guarded operations - `REMOVE_SITE` and `RESET_SITE_MAPPINGS_BATCH` carry
  // their own reviewed impact preview and expected-impact staleness token -
  // they simply do not gate on a typed word.
  | { kind: "none" }
  // A deliberate single-object deletion. Never typed, on any surface,
  // including when it removes the last Template (Task 028 Addendum B).
  | { kind: "targeted" }
  // Typed `delete` when the operation removes more than one Template and the
  // result empties the Template Library.
  | { kind: "bulk-empties-library" }
  // Always requires this exact word.
  | { kind: "typed"; word: "reset" | "restore" };

/**
 * A total mapping over every runtime message, in the same shape as
 * `BUSINESS_STATE_BROADCAST`: adding a `RuntimeRequest` variant without
 * classifying it here is a TypeScript compile error, not a silent gap. That
 * is the point of the table - the inventory cannot drift from the union.
 */
export const DESTRUCTIVE_OPERATION_POLICY: Readonly<
  Record<RuntimeRequest["type"], DestructiveConfirmationPolicy>
> = {
  ENABLE_SITE: { kind: "none" },
  RETRY_SITE_ACTIVATION: { kind: "none" },
  REMOVE_WEBSITE_ACCESS: { kind: "none" },
  REMOVE_SITE: { kind: "none" },
  RESET_SITE_MAPPINGS_BATCH: { kind: "none" },
  DELETE_NEWLY_GLOBAL_TEMPLATES: { kind: "bulk-empties-library" },
  GET_ACTIVATION_SNAPSHOT: { kind: "none" },
  GET_ACTIVATION_MANAGEMENT: { kind: "none" },
  SET_GLOBAL_ACTIVATION: { kind: "none" },
  SET_ORIGIN_ACTIVATION: { kind: "none" },
  READ_STATE: { kind: "none" },
  GET_LOGICAL_PAGE_SITE_KEY: { kind: "none" },
  RECORD_LOGICAL_PAGE_OBSERVATION: { kind: "none" },
  RESOLVE_LOGICAL_PAGE_CANDIDATE: { kind: "none" },
  CONFIRM_LOGICAL_PAGE_CANDIDATE: { kind: "none" },
  STOP_LOGICAL_PAGE_MATCHING: { kind: "none" },
  CREATE_TEMPLATE: { kind: "none" },
  UPDATE_TEMPLATE: { kind: "none" },
  DELETE_TEMPLATE: { kind: "targeted" },
  RESTORE_TEMPLATE: { kind: "none" },
  DELETE_TEMPLATES: { kind: "bulk-empties-library" },
  RESTORE_TEMPLATES: { kind: "none" },
  GET_PICKER_POSITION: { kind: "none" },
  SET_PICKER_POSITION: { kind: "none" },
  GET_PAGE_STATUS_POSITION: { kind: "none" },
  SET_PAGE_STATUS_POSITION: { kind: "none" },
  RESET_PAGE_STATUS_POSITION: { kind: "none" },
  GET_DISMISSED_TIPS: { kind: "none" },
  DISMISS_TIP: { kind: "none" },
  SHOW_TIPS_AGAIN: { kind: "none" },
  GET_APPEARANCE: { kind: "none" },
  SET_APPEARANCE: { kind: "none" },
  GET_LANGUAGE: { kind: "none" },
  SET_LANGUAGE: { kind: "none" },
  SET_PAGE_ALIAS: { kind: "none" },
  SET_FIELD_ALIAS: { kind: "none" },
  RECORD_INSERTION: { kind: "none" },
  RECORD_INSERTION_REJECTION: { kind: "none" },
  SAVE_TEMPLATE_COPY_FOR_FIELD: { kind: "none" },
  SAVE_TEMPLATE_COPY_FOR_SHARED_SET: { kind: "none" },
  SAVE_TEMPLATE_OVERRIDE_FOR_FIELD: { kind: "none" },
  UNDO_SAVE_TEMPLATE_OVERRIDE_FOR_FIELD: { kind: "none" },
  EXCLUDE_SHARED_TEMPLATE_FOR_FIELD: { kind: "none" },
  UNDO_EXCLUDE_SHARED_TEMPLATE_FOR_FIELD: { kind: "none" },
  UNDO_BIND: { kind: "none" },
  UNDO_UNBIND: { kind: "none" },
  UNDO_SAVE: { kind: "none" },
  UNDO_SAVE_COPY_FOR_FIELD: { kind: "none" },
  UNDO_SAVE_TEMPLATE_COPY_FOR_SHARED_SET: { kind: "none" },
  CREATE_TEMPLATE_AND_BIND: { kind: "none" },
  BIND_TEMPLATE: { kind: "none" },
  RESOLVE_FIELD_CONTEXT: { kind: "none" },
  UNBIND_TEMPLATE: { kind: "none" },
  CREATE_SHARED_TEMPLATE_SET: { kind: "none" },
  UNDO_CREATE_SHARED_TEMPLATE_SET: { kind: "none" },
  ADD_SHARED_TEMPLATE_SET_MEMBER: { kind: "none" },
  UNDO_ADD_SHARED_TEMPLATE_SET_MEMBER: { kind: "none" },
  REMOVE_SHARED_TEMPLATE_SET_MEMBER: { kind: "none" },
  UNDO_REMOVE_SHARED_TEMPLATE_SET_MEMBER: { kind: "none" },
  END_SHARED_TEMPLATE_SET: { kind: "none" },
  UNDO_END_SHARED_TEMPLATE_SET: { kind: "none" },
  RENAME_SHARED_TEMPLATE_SET: { kind: "none" },
  CREATE_TEMPLATE_AND_BIND_SHARED: { kind: "none" },
  UNDO_CREATE_TEMPLATE_AND_BIND_SHARED: { kind: "none" },
  CREATE_TEMPLATE_AND_BIND_SHARED_FIELD_ONLY: { kind: "none" },
  UNDO_CREATE_TEMPLATE_AND_BIND_SHARED_FIELD_ONLY: { kind: "none" },
  BIND_TEMPLATE_SHARED: { kind: "none" },
  UNDO_BIND_TEMPLATE_SHARED: { kind: "none" },
  UNBIND_TEMPLATE_SHARED: { kind: "none" },
  UNDO_UNBIND_TEMPLATE_SHARED: { kind: "none" },
  BIND_TEMPLATE_TO_FIELD_ONLY: { kind: "none" },
  UNDO_BIND_TEMPLATE_TO_FIELD_ONLY: { kind: "none" },
  PROMOTE_FIELD_ONLY_SLOT: { kind: "none" },
  UNDO_PROMOTE_FIELD_ONLY_SLOT: { kind: "none" },
  JOIN_SET_AND_SHARE: { kind: "none" },
  UNDO_JOIN_SET_AND_SHARE: { kind: "none" },
  MERGE_SETS_AND_SHARE: { kind: "none" },
  UNDO_MERGE_SETS_AND_SHARE: { kind: "none" },
  FIND_SIMILAR_FIELD_CANDIDATES: { kind: "none" },
  RECORD_COMPATIBILITY_PAIR_NO: { kind: "none" },
  MERGE_SHARED_TEMPLATE_SETS: { kind: "none" },
  UNDO_MERGE_SHARED_TEMPLATE_SETS: { kind: "none" },
  CREATE_BACKUP_ARCHIVE: { kind: "none" },
  GET_RESET_PREVIEW: { kind: "none" },
  RESET_FILLNEST: { kind: "typed", word: "reset" },
  VALIDATE_BACKUP_ARCHIVE: { kind: "none" },
  RESTORE_BACKUP_ARCHIVE: { kind: "typed", word: "restore" },
};

/** The minimum a Template record must expose for the bulk-delete rule. */
interface IdentifiedTemplate {
  id: string;
}

/**
 * Throws unless a Template deletion is permitted.
 *
 * `PROJECT.md`, as amended by Task 028 Addendum B: typed `delete` guards a
 * bulk operation whose result empties the Template Library. A deliberate
 * single-Template deletion is targeted and never typed, even when it is the
 * last one - Undo is its safety net, exactly as it already was for the
 * row-level and Inline Picker delete paths.
 *
 * Both "is this bulk" and "does this empty the Library" are derived from the
 * repository's own current state at handling time, never from a count the
 * caller supplied: unknown ids and duplicates must not be able to turn a
 * targeted deletion into a bulk one, or a bulk one into a targeted one.
 */
export function assertBulkDeleteConfirmation(
  currentTemplates: readonly IdentifiedTemplate[],
  requestedTemplateIds: readonly string[],
  typedConfirmation: string | undefined,
): void {
  const existingIds = new Set(currentTemplates.map((template) => template.id));
  const deletableIds = new Set(requestedTemplateIds.filter((id) => existingIds.has(id)));
  if (deletableIds.size <= 1) return;
  if (deletableIds.size < existingIds.size) return;
  if (typedConfirmation === "delete") return;
  throw new UserFacingError(
    "confirmation-mismatch",
    "Deleting the entire Template Library requires exact 'delete' confirmation.",
  );
}

/**
 * Throws unless the exact word this operation declares was supplied. Reset and
 * Restore read their required word from the table above rather than repeating
 * a literal, so the inventory stays the single source of truth.
 */
export function assertTypedWord(
  type: RuntimeRequest["type"],
  typedConfirmation: string | undefined,
): void {
  const policy = DESTRUCTIVE_OPERATION_POLICY[type];
  if (policy.kind !== "typed") return;
  if (typedConfirmation === policy.word) return;
  throw new UserFacingError("confirmation-mismatch", `Confirmation must be exact '${policy.word}'.`);
}
