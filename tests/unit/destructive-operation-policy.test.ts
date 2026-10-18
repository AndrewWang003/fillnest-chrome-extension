// Task 028 Slice 2 (audit finding C2). PROJECT.md: "Any operation whose final
// result deletes the entire Template Library requires typing `delete`,
// regardless of entry point. Partial single or batch deletion uses
// confirmation but never typed `delete`."
//
// RESET_FILLNEST and RESTORE_BACKUP_ARCHIVE both enforce their typed
// confirmation in the service worker. DELETE_TEMPLATES enforced its gate only
// in the Side Panel UI, despite being the one of the three that can empty the
// Template Library in a single call.
import { describe, expect, it } from "vitest";

import {
  assertBulkDeleteConfirmation,
  assertTypedWord,
  DESTRUCTIVE_OPERATION_POLICY,
} from "../../src/background/destructive-operation-policy";

const templates = (...ids: string[]) => ids.map((id) => ({ id }));

describe("batch delete confirmation policy", () => {
  it("requires typed delete when a bulk request empties the Template Library", () => {
    expect(() =>
      assertBulkDeleteConfirmation(templates("t-1", "t-2"), ["t-1", "t-2"], undefined),
    ).toThrow(/exact 'delete'/u);

    expect(() =>
      assertBulkDeleteConfirmation(templates("t-1", "t-2"), ["t-1", "t-2"], "delete"),
    ).not.toThrow();
  });

  // Task 028 Addendum B: a deliberate single-Template deletion is a targeted
  // deletion, never a bulk one - including when it is the last Template. It
  // previously demanded a typed word only through the multi-select path, so
  // deleting your only Template behaved differently depending on the surface.
  it("never requires typed delete for a single Template, even the last one", () => {
    expect(() =>
      assertBulkDeleteConfirmation(templates("only"), ["only"], undefined),
    ).not.toThrow();

    expect(() =>
      assertBulkDeleteConfirmation(templates("t-1", "t-2"), ["t-2"], undefined),
    ).not.toThrow();
  });

  it("does not require typed delete for a partial delete", () => {
    expect(() =>
      assertBulkDeleteConfirmation(templates("t-1", "t-2", "t-3"), ["t-1", "t-2"], undefined),
    ).not.toThrow();
  });

  it("judges emptiness and count from current state, never from the caller's claim", () => {
    // Ids that do not exist cannot make a partial delete look total, and
    // duplicates cannot inflate the count into looking like a bulk operation.
    expect(() =>
      assertBulkDeleteConfirmation(templates("t-1", "t-2"), ["t-1", "t-1", "ghost"], undefined),
    ).not.toThrow();

    // One real Template plus noise is still a targeted deletion.
    expect(() =>
      assertBulkDeleteConfirmation(templates("t-1"), ["t-1", "t-1", "ghost"], undefined),
    ).not.toThrow();

    expect(() =>
      assertBulkDeleteConfirmation(templates("t-1", "t-2"), ["t-1", "t-2", "ghost"], undefined),
    ).toThrow(/exact 'delete'/u);
  });

  it("accepts only the exact word, like Reset and Restore", () => {
    for (const typed of ["Delete", "delete ", "DELETE", "del", ""]) {
      expect(() =>
        assertBulkDeleteConfirmation(templates("t-1", "t-2"), ["t-1", "t-2"], typed),
      ).toThrow(/exact 'delete'/u);
    }
  });

  it("treats an empty or no-op request as targeted", () => {
    // Degenerate cases delete nothing; they must not demand a typed word.
    expect(() => assertBulkDeleteConfirmation([], [], undefined)).not.toThrow();
    expect(() => assertBulkDeleteConfirmation(templates("t-1"), [], undefined)).not.toThrow();
  });
});

// Task 028 Addendum B.1 (Notion review item 5): five entry points each decided
// independently what counted as destructive, and nothing forced a new message
// to declare a policy at all.
describe("destructive operation inventory", () => {
  it("classifies every destructive runtime message", () => {
    expect(DESTRUCTIVE_OPERATION_POLICY.DELETE_TEMPLATE).toEqual({ kind: "targeted" });
    expect(DESTRUCTIVE_OPERATION_POLICY.DELETE_TEMPLATES).toEqual({ kind: "bulk-empties-library" });
    expect(DESTRUCTIVE_OPERATION_POLICY.DELETE_NEWLY_GLOBAL_TEMPLATES).toEqual({
      kind: "bulk-empties-library",
    });
    expect(DESTRUCTIVE_OPERATION_POLICY.RESET_FILLNEST).toEqual({ kind: "typed", word: "reset" });
    expect(DESTRUCTIVE_OPERATION_POLICY.RESTORE_BACKUP_ARCHIVE).toEqual({
      kind: "typed",
      word: "restore",
    });
    expect(DESTRUCTIVE_OPERATION_POLICY.READ_STATE).toEqual({ kind: "none" });
  });

  it("enforces a declared typed word exactly", () => {
    expect(() => assertTypedWord("RESET_FILLNEST", "reset")).not.toThrow();
    for (const wrong of ["Reset", "reset ", "restore", "", undefined]) {
      expect(() => assertTypedWord("RESET_FILLNEST", wrong)).toThrow(/exact 'reset'/u);
    }
    expect(() => assertTypedWord("RESTORE_BACKUP_ARCHIVE", "restore")).not.toThrow();
    expect(() => assertTypedWord("RESTORE_BACKUP_ARCHIVE", "reset")).toThrow(/exact 'restore'/u);
  });
});
