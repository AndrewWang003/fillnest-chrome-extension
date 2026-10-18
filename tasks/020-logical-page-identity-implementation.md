# Task 020 — Logical Page Identity Implementation

**Version:** `0.1.2 Task 11`  
**Status:** Complete and accepted — 2026-09-01

Implements the accepted Task 014 contract in full: the Schema V5/V6
repository and migration layer, candidate resolution/confirmation/
separation, the Inline Picker Review/Confirm UI, the Site-management
`Stop matching` action, and Backup/Restore and Site Data cleanup for
rules, provenance, and Site keys. Two independent Spec/Standards review
passes found and resolved issues at each layer, including a bounded
addendum to Task 010 (see that contract) narrowing its mutation-boundary
rule to user-initiated mutations. `npm run check`, the full headed E2E
suite (dedicated fixtures for both new UI flows included), and the user's
hands-on verification of the Picker Review/Confirm and Sites Stop matching
UI all passed on 2026-09-01.

## Goal

Implement the generic Logical Page Identity resolver, migration, and
storage/archive compatibility exactly as accepted through Task 014.

## Scope

- Build the accepted same-Origin resolver, keyed semantic-signature storage,
  and canonical candidate-state validation path.
- Upgrade matching state to persist bounded opaque Page Observations for
  already-bound Pages only; delete the Observation with its last direct
  Binding, Site cleanup, Site removal, or Reset.
- Implement the Inline Picker status-strip candidate state, user-initiated
  `Review` confirmation dialog, and no-write session dismissal behaviour.
- Perform the accepted idempotent PageProfile/FieldProfile/Binding union
  migration and the managed `Stop matching` relationship separation path.
- Reject ambiguous, stale, malformed, or invalid candidates and retain the
  existing record rather than false-merging data.
- Extend Backup/Restore, Site Data cleanup, Site removal, and Reset for rules,
  signatures, and separation provenance.
- Cover Repository integrity, the accepted synthetic identity corpus, headed
  Picker flows, migration, separation, and archive compatibility.

## Non-Goals

- Site-specific rules; raw readable identity data; cross-Origin matching;
  route-only or "looks similar" merging; Shared Template UI; irreversible
  migration; whole-page filling.

## Acceptance

- The complete Task 014 synthetic evidence contract passes, including user
  review/dismissal, strict Field migration, relationship separation, failures,
  and archive compatibility.
- Migration, separation, Site cleanup, Reset, and Backup/Restore preserve data
  integrity and fail closed.
- `npm run check`, headed E2E, Spec/Standards review, and hands-on QA pass
  before Task 015 or Task 021 is unblocked.

## Addendum — Review dialog impact preview (2026-09-01)

Found by the user immediately after acceptance, testing beyond the QA
checklist: the Review confirmation dialog's copy was a fixed, generic
sentence identical for every candidate. It gave no basis for a decision -
Task 014 requires "an extension-owned confirmation dialog with the migration
impact preview," and a sentence that does not change with the candidate is
not a preview.

The dialog now shows the exact Origin and Route Pattern being matched
(the same privacy-safe pair Sites management already displays for a
confirmed rule) and the specific Templates already bound to the matching
Field on the canonical Page - computed client-side with the identical
exact-identity-match rule `confirmLogicalPageCandidate` applies
server-side, so the preview can never promise a different outcome than
confirming actually produces. The explanation also now states plainly that
confirming creates an ongoing match, not a one-time action, and names
where to undo it (Sites > `Stop matching`).

Covered by a new component test with populated Templates/Bindings state
(the existing tests used an empty state, so they could not have caught
this) and the existing Picker Review/Confirm E2E fixture, extended to
assert on the specific route and Template text rather than presence alone.

## Addendum A — A Merged Field Stays An Ordinary Field (2026-09-11)

**Status:** Implemented on 2026-09-11 on the owner's instruction to repair the pre-submission audit's findings; the owner's hands-on QA is pending.

**Defect.** The repository's integrity check required each provenance
mapping's `bindingIds` to equal the canonical Field's *current* Bindings,
exactly. After a user confirmed a Logical Page match, every later Bind, Unbind,
`Create and bind` or Template deletion on that Field changed its Bindings and
was refused as "FillNest local data does not match schema version 13". The
merged Field was frozen until `Stop matching`.

**Rule.** Provenance records what was merged at confirmation. It is not a live
constraint on the canonical Field. `Stop matching` gives each separated Field
the canonical Field's list *as it stands now*, which is what Task 014 means by
"not a destructive restoration of historical lists". The integrity check keeps
every structural rule: Rule, Origin, Pages, exact identity keys, and no
duplicate merged Binding id.

**Evidence.** `tests/unit/logical-page-provenance-lifecycle.test.ts`. The
integrity test that pinned the old equality was inverted, and is joined by one
that still rejects duplicate ids.
