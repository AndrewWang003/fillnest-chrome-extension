# Task 031 — Sharing Subsystem Extraction

**Version:** `0.1.2 Task 22`
**Status:** Complete and accepted by the project owner on 2026-09-07 for its stated scope - the subsystem's
records, invariants, resolver and helpers now have their own module. The
command bodies remain in the repository; see the closing note. Evidence in
`DEVELOPMENT.md`.
**Acceptance:** Explicitly accepted by the project owner on 2026-09-07 after
review of the Task 032 prerequisite gate.
**Prerequisites:** Task 028 complete. Task 030's decision known, since it may
move Picker code.
**Source:** `tasks/evidence/whole-extension-audit-2026-09-06.md`, section 5.

## Goal

Give the Shared Template Set subsystem its own module with its own stated
invariants, extracted from `src/storage/fillnest-repository.ts`. Reduce the
recurrence rate of the defect class three consecutive Task 027 audits kept
finding.

## Why This, Before The Rest Of The File

The three audits of Task 027 found 15 defects between them. They were not
distributed randomly. Every one lived at a seam inside one 6,068-line module
where three things had to agree about a data shape that changed twice:

- the membership commands (add, remove, move, merge, cross-Site merge, end),
- the effective-template resolver,
- the Undo staleness checks.

The recurring failure was always the same shape: one of the three was updated
for a new data shape and another was not. Examples, all confirmed:

- Slot lookups keyed by `templateId` when the uniqueness key had become
  `setId:templateId:owner` (findings A, B, F, J).
- A staleness check comparing fields that no longer identified a slot
  (the merge Undo omitting `ownerFieldProfileId`; the add Undo comparing with
  order-sensitive `JSON.stringify`).
- Membership operations that preserved a slot's content but not its policy
  (Move, End Set, Clear Site Data).

A module boundary with explicit invariants converts most of that class from a
runtime defect into a compile error or a single obvious place to update.

## Intended Shape

- One module owning `SharedTemplateBindingRecord`,
  `SharedTemplateFieldStateRecord`, their invariants, the per-Slot resolver,
  every Set command, and every corresponding Undo.
- Its invariants asserted in one place rather than distributed through
  `validateCandidateInvariants`: an owner is a member of its own Slot's Set;
  uniqueness is `setId:templateId:owner`; a Field belongs to at most one Set;
  a field-state references a real Slot, Set, and member.
- A single relation-addressing type (`TemplateRelationRef`, already introduced
  by Task 027 Addendum A) as the module's only mutation vocabulary, so
  `templateId`-keyed mutation becomes unrepresentable rather than merely
  discouraged.
- One shared staleness-comparison helper, so a new field on a Slot record has
  exactly one place to be added.

## Constraints

- **Behaviour-preserving.** This is a refactor. Every existing unit and E2E
  test must pass unchanged; a test that must change indicates a behaviour
  change, which is out of scope and a stop condition.
- The content-script bundle must not gain a repository value import. The
  Picker imports types only; `npm run check`'s build inspection guards this.
- No schema change and no migration.

## Acceptance Criteria (outline)

1. Set commands, the resolver, and their Undo logic live in one module with
   stated invariants.
2. No mutation command outside that module addresses a shared Slot by
   `templateId`.
3. The full existing test suite passes unchanged, and the sharing tests move
   with the code they cover.
4. `npm run check` and the complete headed E2E suite pass.

## Stop Conditions

- If extraction requires a behaviour change to proceed, stop and report it
  rather than folding a product decision into a refactor.

## Delivered, And What Was Deliberately Left

Delivered on 2026-09-07, in two behaviour-preserving slices, with the full
existing suite passing unchanged after each:

1. The subsystem's records, its resolver (`effectiveTemplateListForField`,
   `TemplateRelationRef`, the collapsed entry types), its four helpers, and its
   three record validators moved to `src/storage/shared-templates.ts`. Two
   supporting extractions - `invalid-stored-data-error.ts` and
   `value-guards.ts` - exist only so that module can stand alone without
   importing the repository back.
2. Every Shared Template Set stored-data invariant moved beside the records it
   constrains, behind `assertSharedTemplateInvariants`. Seven of them now have
   a dedicated regression test, because a refactor that silently disabled one
   would otherwise still pass the rest of the suite.

`shared-templates.ts` imports nothing from `fillnest-repository.ts`. It takes
structural state slices rather than `FillNestState`, so the dependency runs one
way by construction and cannot regress into a cycle.

**Left in the repository on purpose: the command bodies.** Roughly thirty Set
and Slot commands are methods that call `this.read()`, `this.commit()`,
`this.runMutation()` and `this.dependencies`. Extracting them means converting
each into a pure `(state, input) => nextState` transition with the repository
keeping a thin read/apply/commit shell. That is the right shape, and it is a
much larger change than slices 1 and 2: it touches every command and every Undo
at once, in the exact code three audits found fragile, and a mistake there is a
behaviour change rather than a compile error.

Doing it in the same pass would have meant a single large refactor verified
only at the end. It belongs in Task 032 as its own slice, after the seam this
Task established has been used in anger. The audit's stated goal - give the
shape, its invariants, and its resolution one home so the membership commands,
the resolver, and the staleness checks can no longer drift apart - is met by
what shipped.
