import { describe, expect, it } from "vitest";

import { BUSINESS_STATE_BROADCAST } from "../../src/background/business-state-broadcast";
import type { RuntimeRequest } from "../../src/messages/runtime-messages";

// Regression coverage for the fix to the service worker's silent
// broadcast-registration gap: previously a new mutation RuntimeRequest type
// could be added to the message-handling switch without also being added to
// a separately maintained Set, so a handled mutation would succeed without
// telling other tabs/Side Panel that Business state changed. Now every
// RuntimeRequest type has an explicit, compiler-checked entry here.

const MUTATION_TYPES: RuntimeRequest["type"][] = [
  "CREATE_TEMPLATE",
  "UPDATE_TEMPLATE",
  "DELETE_TEMPLATE",
  "RESTORE_TEMPLATE",
  "DELETE_TEMPLATES",
  "RESTORE_TEMPLATES",
  "SET_PAGE_ALIAS",
  "SET_FIELD_ALIAS",
  "RECORD_INSERTION",
  "SAVE_TEMPLATE_COPY_FOR_FIELD",
  "SAVE_TEMPLATE_COPY_FOR_SHARED_SET",
  "CREATE_TEMPLATE_AND_BIND_SHARED_FIELD_ONLY",
  "UNDO_CREATE_TEMPLATE_AND_BIND_SHARED_FIELD_ONLY",
  "SAVE_TEMPLATE_OVERRIDE_FOR_FIELD",
  "UNDO_SAVE_TEMPLATE_OVERRIDE_FOR_FIELD",
  "EXCLUDE_SHARED_TEMPLATE_FOR_FIELD",
  "UNDO_EXCLUDE_SHARED_TEMPLATE_FOR_FIELD",
  "UNDO_BIND",
  "UNDO_UNBIND",
  "UNDO_SAVE",
  "UNDO_SAVE_COPY_FOR_FIELD",
  "UNDO_SAVE_TEMPLATE_COPY_FOR_SHARED_SET",
  "CREATE_TEMPLATE_AND_BIND",
  "BIND_TEMPLATE",
  "UNBIND_TEMPLATE",
  "RESET_SITE_MAPPINGS_BATCH",
  "REMOVE_SITE",
  "DELETE_NEWLY_GLOBAL_TEMPLATES",
  "CONFIRM_LOGICAL_PAGE_CANDIDATE",
  "STOP_LOGICAL_PAGE_MATCHING",
  "CREATE_SHARED_TEMPLATE_SET",
  "UNDO_CREATE_SHARED_TEMPLATE_SET",
  "ADD_SHARED_TEMPLATE_SET_MEMBER",
  "UNDO_ADD_SHARED_TEMPLATE_SET_MEMBER",
  "REMOVE_SHARED_TEMPLATE_SET_MEMBER",
  "UNDO_REMOVE_SHARED_TEMPLATE_SET_MEMBER",
  "END_SHARED_TEMPLATE_SET",
  "UNDO_END_SHARED_TEMPLATE_SET",
  "RENAME_SHARED_TEMPLATE_SET",
  "CREATE_TEMPLATE_AND_BIND_SHARED",
  "UNDO_CREATE_TEMPLATE_AND_BIND_SHARED",
  "BIND_TEMPLATE_SHARED",
  "UNDO_BIND_TEMPLATE_SHARED",
  "UNBIND_TEMPLATE_SHARED",
  "UNDO_UNBIND_TEMPLATE_SHARED",
  "BIND_TEMPLATE_TO_FIELD_ONLY",
  "UNDO_BIND_TEMPLATE_TO_FIELD_ONLY",
  "PROMOTE_FIELD_ONLY_SLOT",
  "UNDO_PROMOTE_FIELD_ONLY_SLOT",
  "JOIN_SET_AND_SHARE",
  "UNDO_JOIN_SET_AND_SHARE",
  "MERGE_SETS_AND_SHARE",
  "UNDO_MERGE_SETS_AND_SHARE",
  "RECORD_COMPATIBILITY_PAIR_NO",
  "MERGE_SHARED_TEMPLATE_SETS",
  "UNDO_MERGE_SHARED_TEMPLATE_SETS",
];

const READ_ONLY_OR_NON_BUSINESS_TYPES: RuntimeRequest["type"][] = [
  "ENABLE_SITE",
  "RETRY_SITE_ACTIVATION",
  "REMOVE_WEBSITE_ACCESS",
  "GET_ACTIVATION_SNAPSHOT",
  "GET_ACTIVATION_MANAGEMENT",
  "SET_GLOBAL_ACTIVATION",
  "SET_ORIGIN_ACTIVATION",
  "READ_STATE",
  "GET_LOGICAL_PAGE_SITE_KEY",
  "RECORD_LOGICAL_PAGE_OBSERVATION",
  // Task 036: it writes one boolean on a Field Profile that no surface but the
  // Picker that produced it displays, and that Picker re-reads its own state.
  "RECORD_INSERTION_REJECTION",
  "RESOLVE_LOGICAL_PAGE_CANDIDATE",
  "FIND_SIMILAR_FIELD_CANDIDATES",
  "GET_PICKER_POSITION",
  "SET_PICKER_POSITION",
  // Task 038: the page status control's own position, beside the Picker's.
  "GET_PAGE_STATUS_POSITION",
  "SET_PAGE_STATUS_POSITION",
  // Task 038 Addendum B: open pages follow it through their own
  // PAGE_STATUS_POSITION_RESET notification, which clears no Undo.
  "RESET_PAGE_STATUS_POSITION",
  // Task 042: the dismissed first-use tips, a display preference.
  "GET_DISMISSED_TIPS",
  "DISMISS_TIP",
  "SHOW_TIPS_AGAIN",
  // Task 034: the theme is not business data. Its own APPEARANCE_CHANGED
  // notification repaints the surfaces; BUSINESS_STATE_CHANGED would also
  // invalidate a pending Undo for a change that touched no data.
  "GET_APPEARANCE",
  "SET_APPEARANCE",
  // Task 037: the language is a display preference, like the theme.
  "GET_LANGUAGE",
  "SET_LANGUAGE",
  "RESOLVE_FIELD_CONTEXT",
  "CREATE_BACKUP_ARCHIVE",
  "GET_RESET_PREVIEW",
  "VALIDATE_BACKUP_ARCHIVE",
  // Restore broadcasts both authoritative state changes itself so it can
  // return one accurate reload warning instead of issuing a duplicate
  // unobserved Business broadcast from the generic listener.
  "RESTORE_BACKUP_ARCHIVE",
  "RESET_FILLNEST",
];

describe("BUSINESS_STATE_BROADCAST", () => {
  it("broadcasts a Business state change for every handled business mutation", () => {
    for (const type of MUTATION_TYPES) {
      expect(BUSINESS_STATE_BROADCAST[type]).toBe(true);
    }
  });

  it("does not broadcast a Business state change for read-only or non-business requests", () => {
    for (const type of READ_ONLY_OR_NON_BUSINESS_TYPES) {
      expect(BUSINESS_STATE_BROADCAST[type]).toBe(false);
    }
  });

  it("has an explicit entry for every currently known RuntimeRequest type", () => {
    // Every RuntimeRequest["type"] literal must appear here for this file to
    // typecheck (BUSINESS_STATE_BROADCAST is typed as a total Record over
    // that union) - this assertion just confirms the two lists above,
    // together, cover the whole map with no accidental gaps of their own.
    const covered = new Set([...MUTATION_TYPES, ...READ_ONLY_OR_NON_BUSINESS_TYPES]);
    expect(covered.size).toBe(Object.keys(BUSINESS_STATE_BROADCAST).length);
  });
});
