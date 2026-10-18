# Task 015 — Share Templates

**Version:** `0.1.2 Task 06`
**Status:** Accepted — 2026-09-01
**Prerequisite:** Task 014 must be accepted and complete. Satisfied: Task 014
is complete and accepted, and Task 020 (its implementation) is complete and
accepted.

Contract acceptance authorizes Task 021 to begin implementing it in the four
ordered slices below. Acceptance is not itself implementation evidence; each
slice still needs its own failing-test-first evidence per the delivery
workflow.

## Task 024 Controlled Cross-Site Extension (2026-09-02)

Task 021 implemented this contract's original Site-local Set model. Task 024
is the sole authorized extension: an explicit `Link templates` operation may
create, grow, or merge a Shared Template Set whose members are on different
Sites. This is local relational state, not network synchronization. The
original Site-local Picker `Add Fields` flow and Site-management add-member
flow remain Site-local; cross-Site membership is created only through Task
024's deliberate Field-discovery and Link confirmation.

Task 024 preserves the one-Set-per-Field invariant and all direct-Binding,
departure, automatic-dissolution, Undo, Backup/Restore, and no-value-read
rules below. Its cross-Site Set merge confirmation must state every affected
Site and Field count, retain the Current Field Set's name, and atomically use
the deduplicated union of both effective Template lists.

## Goal

Let a user explicitly create, manage, and end named Shared Template Sets for
reliably identified Fields within one Site. A Shared Template Set gives every
member Field the same effective Template list without guessing semantic
equivalence from URLs, labels, IDs, or DOM similarity.

## User Value

Users can deliberately reuse one Template list across related Fields while
retaining clear control over scope, membership, recovery, and site cleanup.

## Confirmed Contract

### Identity And Scope

- Task 021 sharing is Site-local. Task 024 may create cross-Site membership
  only through an explicit `Link templates` confirmation; no field is added
  across Sites by automatic discovery, Picker `Add Fields`, or Site
  management.
- Candidates are every reliably identified FieldProfile in the current Site,
  whether or not that Field currently has a Template. Two empty Fields may
  create a Shared Template Set.
- The feature never infers sharing from a URL, label, name, ID, or DOM
  similarity. Task 014 owns generic logical-Page identity. Distinct reliable
  FieldProfiles may still be explicitly selected into the same set.
- A set requires at least two Fields at creation. When an operation would
  leave one member, it ends automatically and both formerly shared Fields
  retain independent deduplicated snapshots of the current Shared list.
- A Field has one effective Shared Template Set at a time. Moving it to
  another set requires a confirmation that identifies the set it will leave;
  confirming performs the leave-and-join atomically.

### Template Semantics

- A Field is either independent or shared for effective Template-list
  purposes. Direct bindings remain durable but dormant while the Field is a
  set member.
- The Shared Template Set is the only effective Template list for each of its
  members. The Picker must never mix dormant direct bindings into that list.
- Creating a set takes the union of selected Fields' direct Template IDs,
  deduplicated by Template ID only. Existing direct bindings are not deleted.
- While shared, `New template`, `Bind existing`, and `Unbind` mutate the
  Shared Template Set as a whole. `Edit` and `Delete` keep the existing global
  Template-entity semantics.
- Leaving or ending sharing removes only the relevant shared relationships.
  A departing Field retains every dormant direct Binding and receives a
  deduplicated direct-Binding snapshot of the Shared Template Set's current
  ordered list. It is then independent: later Shared Template Set mutations
  do not propagate to it, and its later direct mutations do not propagate
  back. Templates themselves remain.
- If ending a set, or the final member leaving it, makes Templates Global, the
  result region must say how many are newly Global and offer the established
  explicit dangerous `Delete` action. It never deletes them automatically.

### Naming And Surfaces

- A new set receives a stable system-generated default name and may be renamed
  later by the user. The default must not silently change when members change.
- Sets are created contextually from a Field's in-page Picker.
- The Picker provides current-Field actions only: show sharing status, add
  Fields, and stop sharing for the current Field.
- `Add Fields` is an explicit same-Site selection surface, not an automatic
  relationship suggestion. It may present candidates whose normalized
  displayed names share one or more token with the current Field before
  non-matches; all matches retain their page document order, and no candidate
  is selected or hidden by this ordering. When a current-page candidate is
  hovered or keyboard-focused, FillNest may show a temporary extension-owned
  visual outline around that actual Field to aid deliberate selection. This
  never reads a Field value, persists DOM data, or applies to another page.
- Full Site management is at `Side Panel → Sites → [Site] → Shared Templates`:
  inspect sets, rename sets, manage members, and end sharing. No new top-level
  Side Panel navigation is introduced.
- A shared Field Picker always identifies the Shared scope and the number of
  affected Fields.
- Result or confirmation text for `New template`, `Bind existing`, and
  `Unbind` in Shared scope explicitly says that the change affects the entire
  Shared Template Set. `Edit` and `Delete` retain their existing global
  Template-entity wording.

### Undo, Site Data, And Portability

- Create, add member, remove member, move member, stop sharing, end sharing,
  and Shared-scope Template-list mutations are atomic operations with one
  applicable Undo.
- The Task 010 rule remains absolute: every successful FillNest data, setting,
  or relationship mutation silently invalidates any previous Undo. A command's
  own Undo restores only its complete pre-command relationship state and fails
  closed if that state is no longer valid.
- `Clear site data` and `Remove site` remove the affected Site's memberships.
  Any resulting empty set ends and its shared bindings are removed; Templates
  are retained. The operation result reports how many sets ended.
- Backup archives include set names, memberships, shared Template bindings,
  and order. Restore replaces all current FillNest data atomically; it never
  merges current shared relationships with a backup. An older archive with no
  shared-set data restores no shared sets.
- Repository validation, Backup, and Restore must reject or fail closed on
  duplicate membership, dangling references, invalid shared binding order, or
  cross-Site membership not created or restored under Task 024's validated
  Shared Template Set model.

## Explicit Non-Goals

- Automatic semantic field matching, site-specific rules, or cross-Site
  sharing outside Task 024's explicit Link flow.
- Multiple simultaneous Shared Template Sets for one Field.
- Shared Templates between users, accounts, sync, remote storage, or
  multi-field form filling.
- Mixing direct and shared Template lists in a shared Field Picker.

## Slices

1. **Domain and persistence:** define the validated local Shared Template Set
   model, membership and binding invariants, migration, Backup/Restore archive
   support, and unit coverage.
2. **Commands and recovery:** implement atomic creation, membership lifecycle,
   shared Template-list operations, Site Data cleanup, global-template
   aftermath, Undo, and result messages.
3. **In-page Picker:** implement contextual creation, shared-state indication,
   current-Field actions, and scope-safe Template operations.
4. **Site management and evidence:** implement the nested Shared Templates
   management view, confirmations, accessibility and regression coverage, then
   complete full checks, headed extension testing, review, and hands-on QA.

## Acceptance Criteria

- No shared relationship is created, restored, or retained across Sites.
- Empty Fields can participate; a shared Picker never displays dormant direct
  bindings.
- All members observe the same ordered shared Template list, and every
  Shared-scope mutation is communicated as affecting the whole set.
- Moving a Field cannot happen without the explicit leave-existing-set
  confirmation; its relationship state is all-or-nothing.
- Removing a member that would leave one member ends the set automatically;
  both former members retain independent deduplicated snapshots of the former
  Shared list.
- Site clearing, site removal, Backup, Restore, Reset, Template deletion, and
  undo invalidation preserve the confirmed semantics above without dangling
  records or silent Template deletion.
- No production or test code depends on a specific website, record URL, page
  label, field name, selector, or DOM structure.
- `npm run check`, headed extension regression, Spec review, Standards review,
  and hands-on QA pass before acceptance.
