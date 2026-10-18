# Task 032 — Repository Decomposition

**Version:** `0.1.2 Task 23`
**Status:** Phase A checkpoint complete and accepted by the project owner on
2026-09-07 on branch `task-032-repository-decomposition`. Phase B (command-body
extraction) is not authorized and must be replanned after the owner's QA
findings are classified.
**Contract:** Phase A confirmed by the project owner on 2026-09-07: reconcile
and verify the already implemented behaviour-preserving extractions without
continuing into command bodies.
**Execution:** Authorized by the project owner on 2026-09-07 for Phase A only.
**Acceptance:** Phase A explicitly accepted by the project owner on 2026-09-07,
including the bounded historical process deviation recorded below. Phase A does
not complete Task 032 as a whole.
**Prerequisites:** Task 031 is complete and accepted.
**Source:** `tasks/evidence/whole-extension-audit-2026-09-06.md`, section 5.

## Goal

Continue decomposing `src/storage/fillnest-repository.ts` along the boundaries
`AGENTS.md` already asks for — "separate UI, business logic, validation, data
access, and browser integrations where practical" — using the seam pattern
Task 031 establishes.

## Current State

6,068 lines in one module, holding: the whole state schema and record types;
every validator and the candidate-state integrity gate; the complete v1→v10
migration chain; every business command and its Undo; the effective-template
resolver; Site projection and impact calculation; and the mutation queue.

This is the single largest structural risk in the codebase, and Task 031
addresses only the largest of several seams within it.

## Measured Shape (2026-09-07)

`fillnest-repository.ts` is 5,738 lines after Task 031:

| Region | Lines | Notes |
| --- | --- | --- |
| Record and command input/result types | 1-1,114 | ~90 interfaces, type-only |
| `FillNestRepository` class | 1,115-4,886 | 139 methods |
| Migrations `v1 → v11` | 4,887-4,951 | 9 functions, append-only |
| State validation | 4,955-5,680 | `validateCandidateState`, `validateCandidateInvariants`, 12 record validators |
| Remaining helpers | 5,681-5,738 | |

Everything outside the class is 1,967 lines and separable with low risk.
The class is the hard part and is addressed last, in the slice order below.

## Candidate Boundaries

To be confirmed against the code at authorization time, not fixed now:

- **Schema and record types** — the shape, separate from behaviour.
- **Validation** — `validateCandidateState` and per-record validators. Already
  a well-defined unit with its own test file.
- **Migrations** — the v1→v10 chain. Append-only, rarely read, and touched by
  a different kind of change than the commands.
- **Template and Binding commands** — the Task 001–005 core.
- **Shared Template Sets** — extracted by Task 031.
- **Site projection, deletion impact, and usage accounting** — read-model
  calculations with no mutations of their own.
- **The repository shell** — storage access, the mutation queue,
  read/commit, and the public interface everything else is reached through.

## Constraints

- **Behaviour-preserving**, on the same terms as Task 031: existing tests pass
  unchanged, and a test that must change is a stop condition.
- Incremental. Each slice extracts one boundary and runs full evidence before
  the next. No single commit moves the whole file.
- The service worker remains the sole owner of Repository access, and
  mutations remain serialized. The decomposition must not create a second
  write path.
- The content-script bundle must not gain a repository value import.

## Complementary Static Checks

The owner previously selected a narrow check for the audit's confirmed dead-
export defect class. `npm run verify:exports` is already part of `npm run check`.
Phase A does not authorize a TypeScript version change, an ESLint dependency,
or removal of over-exported-but-live symbols. If broader linting is reconsidered,
it requires its own compatibility probe and dependency decision rather than
being bundled with command-body extraction.

## Phase A Slice Order

1. **Stored-state vocabulary** to `src/storage/records.ts`, with Picker position
   type and validation in `src/storage/picker-position.ts` to avoid cycles.
2. **Migrations** to `src/storage/migrations.ts`.
3. **State validation** to `src/storage/state-validation.ts`.
4. **Command input and result types** to `src/storage/repository-inputs.ts`.

## Phase A Acceptance Criteria

1. `fillnest-repository.ts` is no larger than 4,304 lines, and the five Phase A
   modules have the responsibilities stated above.
2. Existing public imports continue to typecheck through repository re-exports.
3. The service worker remains the sole Repository owner, mutation serialization
   is unchanged, and the content-script bundle gains no repository value import.
4. The extraction itself requires no existing test change. The separate Task
   030 test repair is recorded in its owning contract and evidence.
5. `npm run check`, the production-build isolation test, and the complete headed
   E2E suite pass.
6. Independent Spec and Project Standards reviews have no unresolved P0-P2
   findings within Phase A, unless the owner explicitly accepts a documented
   historical process deviation.

## Stop Conditions

- If a boundary cannot be extracted without a behaviour change, stop and
  report rather than adjusting behaviour to fit the seam.
- If decomposition would require a second write path or weaken mutation
  serialization, stop.

---

## Phase A Checkpoint (2026-09-07)

Task 032 added five modules, bringing `src/storage/` from five modules at its
fixed point to ten. `fillnest-repository.ts` went from **5,738 to 4,304 lines**
in Task 032; across Tasks 031 and 032 it went from **6,146 to 4,304 lines**.
The extraction commits did not modify existing tests. Commit `416376e` is a
separate Task 030 test repair and is recorded there rather than counted as
Task 032 refactor evidence.

| Module | Lines | What it owns |
| --- | --- | --- |
| `fillnest-repository.ts` | 4,304 | The class: 134 command methods, read/commit, the mutation queue |
| `repository-inputs.ts` | 810 | ~90 command input and result declarations |
| `state-validation.ts` | 637 | The candidate-state integrity gate and 12 record validators |
| `shared-templates.ts` | 513 | Sharing records, resolver, invariants (Task 031) |
| `records.ts` | 173 | Stored data shapes and the initial state |
| `migrations.ts` | 115 | The `v1 → v11` chain |
| `value-guards.ts`, `picker-position.ts`, `invalid-stored-data-error.ts` | 65 | Shared primitives that break import cycles |

The repository class still owns its command bodies, read/commit boundary and
mutation queue. Phase A makes no claim that the whole decomposition is complete.

## Recorded Process Deviation

Commit `29d1739` combined the stored-state vocabulary/Picker-position extraction
and the migration extraction. Its commit message records the full check set only
after the combined change, so there is no durable fixed point proving that the
full evidence ran between those two boundaries as the incremental constraint
requires. Fresh final verification cannot reconstruct that missing historical
checkpoint.

The project owner accepted this as a bounded historical process deviation on
2026-09-07 rather than rewriting Git history or pretending later evidence
proves an earlier run. Both boundaries are mechanical, the combined commit is
independently reviewable, and the current combined state has fresh full-suite
evidence.

## Phase B Gate: Command Bodies

Command-body extraction is not part of Phase A and is not currently authorized.
It must be replanned after the owner's QA findings are assigned to their owning
Tasks. Any future extraction must preserve observable behaviour, including the
current commit boundaries of composite commands. In the current fixed point,
`joinSetAndShare` and `mergeSetsAndShare` already run through
`runAtomicComposite`: their internal steps stage candidate states and produce
one durable storage commit. The earlier report that they currently commit twice
was incorrect. Phase B must preserve this existing single-commit atomicity; it
does not require a new product decision merely to extract command bodies.

## Phase A Independent Review (2026-09-07)

- Project Standards: no findings.
- Spec: one P2 process-evidence finding, recorded above; no implementation
  mismatch or scope creep found.
- Authorization and ownership: Phase A is accepted; Phase B is not authorized.
  Task 030 owns the isolation-test repair. Task 031 is accepted, and the owner
  accepted the documented historical process deviation.

## Addendum A — Phase B Extraction Rules (2026-09-07)

**Status:** Contract recorded, **execution not authorized.** Phase B stays
frozen until the owner's hands-on QA of the repaired build is complete and its
findings are assigned to their owning Tasks. Recording these rules is not
authorization to start.

**Owner decision (2026-09-07):** this branch keeps refactor and product commits
together and is not split. Agents continue on the branch the previous agent
used. See `docs/agent-handoff.md`.

### Rules

1. No change to existing commit counts or storage semantics. Extraction is
   behaviour-preserving or it does not happen.
2. `joinSetAndShare` and `mergeSetsAndShare` keep the single durable
   `storage.set` they already perform through `runAtomicComposite`. Whether
   composite commit boundaries should change at all is a product question and
   needs its own Task; it must not be decided as a side effect of a refactor.
3. Move one related command family per slice - Template, Binding, Shared Set -
   never a mixed batch.
4. Each family gets its behaviour-locking tests **before** it is moved: commit
   count, failure rollback, Undo, and staleness checks.
5. Each family is its own commit, with its own full verification and its own
   independent review.
6. If a family cannot be extracted without a behaviour change, stop that family
   and record why. Do not force it through.

### How To Write A Commit-Count Lock

The seam already exists. `InMemoryLocalStorage` in `tests/unit/repository.test.ts`
counts `set` calls in `setCount`; sample it before and after the command and
assert the difference. Both composite promotions already carry such a lock, and
they are the reference for the rest.

### Acceptance Criteria

1. Every moved family carries its four behaviour locks, written before the move.
2. `fillnest-repository.ts` shrinks with no existing test modified to
   accommodate the move.
3. Any family stopped under rule 6 is recorded here with its reason.
4. `npm run check` and the complete headed E2E suite pass per slice.

## Phase B Result (2026-09-08)

**Status:** Complete. Every command body is now a pure state transition.

`fillnest-repository.ts` is **6,146 -> 1,337 lines** across Tasks 031 and 032.
What remains is the class itself: `read`, `commit`, the mutation queue,
`runAtomicComposite`, the two transition runners, and the public command
methods that delegate to the transitions.

### Slices

| Slice | Boundary | Repository lines after |
| --- | --- | --- |
| B0 | Shared state helpers | 4,223 |
| B1 | Template commands | 3,951 |
| B2 | Binding commands | 3,769 |
| B3 | Shared Template Set commands | 2,763 |
| B5 | Template leftovers, Page identity commands | 2,536 |
| B4 | Composite-participating Set commands | 2,089 |
| B6 | The three that needed reshaping first | 1,337 |

### How Rule 1 Was Held

`runTransition` reads through `read()`, `runStagedTransition` through
`readMutationState()`, which returns staged state inside a composite and falls
back to `read()` otherwise. `commit` was already staging-aware. So a command
performs the same single durable write it always did, whether it is called on
its own or as a composite step, and `joinSetAndShare` and `mergeSetsAndShare`
still produce one write each - asserted by locks written before Phase B began.

`next: null` means "write nothing", which is deliberately not the same as
returning the unchanged state: committing an identical state is still a write,
and the families' no-op locks would catch it.

### Three Commands Were Reshaped Before Moving

`bindTemplateShared` committed conditionally and then returned the same value on
both paths. `resetSiteMappingsBatch` committed inside `if (didMutate)` and fell
through to a shared return. `confirmLogicalPageCandidate` computed part of its
result *after* committing.

Each was first restructured in place into an equivalent shape - explicit
branches, and for the third, resolving the target Field before the commit
because `state.fieldProfiles` is untouched by it - with the suite run after each
change. Only then were they moved mechanically. Hand-writing 150 lines of
transition would have been the riskier route.

### Method

The extraction was scripted, and the script refuses shapes it does not
recognise rather than guessing. Over the whole of Phase B it declined bodies
that read state twice, still called Repository members, or returned in a shape
it could not classify; each was then handled deliberately. Its first version
had a real defect - it rewrote returns inside nested `.map` callbacks as
no-write exits - which typecheck caught and which was fixed by tracking nested
function bodies with a brace stack, not by patching the output.

Six Repository-local helpers moved to shared modules so command modules could
use them without a cycle. `fillnest-repository.ts` re-exports the ones other
areas import, so no import site outside `src/storage/` changed.

### Not Done

`setPickerPositionUnlocked` stays in the Repository. It is eight lines and
belongs to no command family; a module for it alone would be worse than leaving
it. No existing test was modified across any slice.

