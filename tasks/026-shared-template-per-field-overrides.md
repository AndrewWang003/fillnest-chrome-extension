# Task 026 — Shared Template Per-Field Overrides

**Version:** `0.1.2 Task 17`  
**Status:** **Complete and accepted by the project owner on 2026-09-07**, after
hands-on QA of the repaired build. See `DEVELOPMENT.md`'s 2026-09-05 Task 026
entry for the implementation evidence and the 2026-09-07 entries for the QA
wave that preceded acceptance. Acceptance criterion 7's broader headed E2E
coverage of Side Panel scope presentation, Set copy and cross-Site Sets was
not completed and is accepted as an explicit gap, not as satisfied.  
**Prerequisites:** Tasks 003 and 021 are accepted. Task 024's implemented
cross-Site Shared Template Set behaviour remains in scope for compatibility.

## Goal

Let one member of a Shared Template Set customise or explicitly omit one
shared Template without leaving the Set or changing the other members'
Template lists. The feature preserves the user's explicit divergence; it does
not add a Git-style history, branch, merge, or automatic restoration model.

## User Value

Users can keep the useful parts of a shared Template library while adapting a
single Template for one Field. The save choice always states its scope, so a
user can predict exactly which Fields will see the edited content.

## Confirmed Product Decisions

- A Shared Template Set remains the default source of every member's Template
  list, but a member may have a per-Template **Override** or **Exclusion**.
- `Save for this field` on an inherited shared Template creates a new local
  Template and records it as an Override for only the Current Field. Other Set
  members continue inheriting the shared Template.
- An Override is intentional divergence, not a temporary preview. FillNest
  provides no `Restore shared version` action and never silently re-inherits
  the shared Template.
- Removing a Field's Override from that Field creates an Exclusion for the
  same shared Template slot. The original shared Template stays absent from
  that Field; it remains available to other members and in the Template
  Library according to ordinary Template lifecycle rules.
- `Remove from this field` is the only field-scoped action that converts an
  Override into an Exclusion. `Delete template everywhere` remains a global
  Template deletion operation and must never be presented as a field-scoped
  removal or implicit restoration choice.
- `Save for shared fields` creates a new Template and replaces the base
  Template in the Current Shared Template Set's logical Template slot. It
  changes every member that inherits that slot but never overwrites an Override
  or clears an Exclusion.
- `Save everywhere` edits the original Template record and affects every
  active use of that original Template. It never overwrites a separate
  Override Template.
- The product will not implement Git-like revision history, branching,
  merging, diffs, conflict resolution, or automatic version restoration in
  this Task.

## Scope And Data Semantics

### Stable Shared Template Slots

- Each entry in a Shared Template Set has a durable logical slot identity,
  separate from the Template record currently supplying its base content.
- A Set-level copy changes the base Template for its existing slot; it does
  not destroy that slot identity. This ensures existing member Overrides and
  Exclusions survive a Set-level edit.
- A per-field state is keyed by Shared Template Set, member Field Profile, and
  logical slot. Its mutually exclusive modes are:
  - **inherit:** no stored state; the Field uses the slot's base Template;
  - **override:** the Field uses its stored replacement Template;
  - **exclude:** the Field omits that slot entirely.
- A field's effective Template list resolves slots in their shared order,
  selecting the base, Override, or no entry for each slot. It must remain the
  single source of truth for Picker, Side Panel `This tab`, Search-related
  current-field context, insertion, usage accounting, deletion impact, and
  all field-facing counts/previews.
- An Override Template is an ordinary local Template entity. It may be found
  by deliberate Search and subsequently used elsewhere only through existing
  explicit actions. Its original per-field Override relationship remains
  scoped to its one Field and slot.
- New Override Templates start with zero Template usage and have Site
  Affinity for the Current Field's Site. A Set-level copy has affinities for
  the current Set's member Sites, matching existing Shared-set copy semantics.

### Save Scope UI

- Edit uses one scope vocabulary across all Picker surfaces:
  - **Save** is shown only when the edited Template has one effective use
    scope; it updates that Template record.
  - **Save everywhere** updates the original Template record when it has more
    than one actual effective use scope.
  - **Save for shared fields** appears for an inherited shared Template and
    creates a replacement base version for the Current Set's logical slot.
  - **Save for this field** appears for an inherited shared Template and
    creates an Override for the Current Field only.
- Scope choices are calculated from actual effective consumers, never merely
  from the number of Site Affinities. A Template with one effective use scope
  must not present duplicate save choices that produce the same visible result.
- Each non-global save choice names the affected Field or Shared Set and its
  member count before mutation. No choice is selected by default.
- The Side Panel never labels a global original-Template mutation merely
  `Save`; it uses `Save everywhere` whenever there is more than one effective
  use scope. A `This tab` Field-card edit has a concrete Field context and
  exposes the same valid scopes as that Field's Picker. An `All templates`,
  Search, or other context-free Side Panel edit has no Field scope and offers
  only `Save everywhere`. Neither surface may silently omit a narrower valid
  scope from a field-context edit.

### Relationship Changes And Recovery

- `Stop sharing` converts the departing Field's current effective list into
  direct Bindings, preserving its Overrides and Exclusions. It does not
  restore excluded or superseded inherited entries.
- Adding, moving, and merging Set members preserves existing Overrides and
  Exclusions for their owning Field and slot. A merge retains/remaps every
  surviving logical slot deterministically; no Override or Exclusion may be
  silently lost or applied to an unrelated slot.
- When a cross-Site merge deduplicates the same base Template from both Sets,
  the Current Field Set's slot is the canonical surviving slot, consistent
  with Task 024 retaining that Set's custom name. Every Override and Exclusion
  from the merged-away slot is atomically remapped to the canonical slot. No
  duplicate effective Template row is shown merely because two pre-merge Sets
  both inherited the same Template.
- Removing or deleting a base Template follows an explicit impact preview. It
  must not transform an Override into inheritance or an Exclusion into a
  visible Template. Deleting an Override Template globally follows existing
  Template deletion rules and removes its dependent Override relationship
  only after the user sees the Field impact.
- Every mutation is atomic. Undo restores the exact pre-mutation slots,
  Overrides, Exclusions, Templates, Bindings, Shared Bindings, ordering, Site
  Affinities, and usage counts where applicable. Task 010's global successful
  mutation invalidation rule remains absolute.
- Backup and Restore include Slots, Overrides, and Exclusions as validated
  local business data. Schema and archive migrations are additive and reject
  malformed, dangling, duplicate, or contradictory relationships.

## Explicit Non-Goals

- Git, commit graphs, revision browsers, branches, merge requests, content
  diffs, conflict resolution, or automatic rollback to a shared version.
- Automatic Field or Template relationship creation, semantic matching,
  value reads, multi-Field filling, Contacts, network synchronization,
  accounts, remote services, AI, telemetry, or a backend.
- Silent fallback from an Exclusion or deleted Override to the base shared
  Template.
- Changing Task 024's explicit cross-Site Link confirmation requirement.

## Acceptance Criteria

1. Given A and B share Template T, `Save for this field` from A produces A's
   T′ while B still receives T; both Fields continue to share every other Set
   Template.
2. Given A overrides T and B inherits T, a Set-level `Save for shared fields`
   changes B's inherited version but leaves A's T′ unchanged.
3. Removing A's T′ from A records an Exclusion: A no longer receives that
   slot and does not re-inherit T; B remains unaffected.
4. A template with one actual effective use scope shows one Save action even
   if it has multiple Site Affinities.
5. Picker and Side Panel use scope-accurate labels and never silently turn a
   field-context edit into a global mutation when a valid narrower scope
   exists. `This tab` Field-card edits offer Picker-equivalent scopes;
   context-free Side Panel edits offer only `Save everywhere`.
6. Stop sharing, member move, cross-Site merge, base Template deletion, Undo,
   Backup/Restore, usage accounting, direct Search, and Set-level Template
   mutations retain or reject Override/Exclusion state deterministically.
   A merge that deduplicates a base Template retains one canonical slot and
   remaps all dependent Overrides and Exclusions without duplicate effective
   rows.
7. Unit tests cover effective-list resolution, all mutation and stale-Undo
   boundaries, migration/archive validation, and no-value-read guarantees.
   Headed E2E covers direct and cross-Site Sets, Picker and Side Panel scope
   presentation, Override, Exclusion, Set copy, Stop sharing, and Undo.
8. `npm run check`, the complete headed E2E suite, Task/Project Standards
   review, and hands-on QA pass before the Task is marked complete.

## Expected Implementation Slices

1. Domain model, schema/archive migration, validation, effective-list resolver,
   and unit tests.
2. Atomic repository commands, runtime messages, Undo, deletion/cleanup,
   usage accounting, and unit tests.
3. Picker and Side Panel save-scope UI with explicit impact language and
   accessibility/keyboard evidence.
4. Cross-Site merge, lifecycle, Backup/Restore, E2E, review, and hands-on QA.

## Addendum A — Clear Site Data's Survivor, And Undoing An Override's Deletion (2026-09-11)

**Status:** Implemented on 2026-09-11 on the owner's instruction to repair the pre-submission audit's findings; the owner's hands-on QA is pending.

**Defect 1.** When Clear Site Data left a Set with one member, the survivor
received the Set's raw slots, which dropped its Overrides and Exclusions (for
example, an excluded Template came back) and the privacy of its own Field-only
Templates. This contract requires the conversion to be deterministic and
non-lossy. **Repair:** the survivor keeps its effective list through the same
conversion `Stop sharing` uses.

**Defect 2.** Deleting the Template an Override points at removes only that
Override; its slot stays. Undo restored the Template but not the Override,
because Undo restored field states only for slots it recreated itself.
**Repair:** that Override returns to its slot while the slot, the Field's
membership and the Field's freedom on that slot all still hold.

**Evidence.** `tests/unit/shared-set-audit-repairs.test.ts`.
