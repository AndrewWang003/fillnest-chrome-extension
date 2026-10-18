# Agent Handoff — Task 032 and QA Repair Wave

**Date:** 2026-09-07  
**Current branch:** `task-032-repository-decomposition`  
**Base branch:** `codex/task-021-shared-template-sets-implementation`  
**Worktree:** `<repo>/.worktrees/task-032`

## Mission

Task 032 decomposes the large Repository module while preserving observable
behavior. The project owner approved a safe extraction phase, then approved a
separate repair wave for three hands-on QA findings. Task 032 Phase B
(command-body extraction) remains intentionally unauthorized.

## Approved Plan

Task 031 was formally accepted. Task 032 Phase A was formally accepted,
including the bounded historical process deviation recorded in its contract:
commit `29d1739` combined two mechanical extraction boundaries without a
durable between-slice evidence checkpoint. The code is reviewable and has fresh
full-suite evidence; Git history was not rewritten.

The QA repair wave was split by owning contract:

- Task 009 Addendum A: live-page teardown after whole-product Reset.
- Task 027 Addendum E: distinct one-to-one and one-to-many Bind icons.
- Task 004 Addendum B: live Field Context and cross-tab convergence after Clear
  Site Data.

Task 032 Phase B is frozen until the repaired build has gone through the
owner's final hands-on QA and a new Phase B plan.

Design and plan files:

- `docs/superpowers/specs/2026-09-07-qa-state-convergence-repairs-design.md`
- `docs/superpowers/plans/2026-09-07-qa-state-convergence-repairs.md`
- `tasks/009-factory-reset.md`
- `tasks/004-site-access-and-data-management.md`
- `tasks/027-explicit-template-audience-scope.md`
- `tasks/032-repository-decomposition.md`

## Completed Work

### Task 032 Phase A

`src/storage/fillnest-repository.ts` was reduced from 5,738 to 4,304 lines.
Stored records, picker position, migrations, state validation, shared
primitives, and repository input/result types now have focused modules. Public
repository re-exports, service-worker ownership, mutation serialization, and
content-script boundaries remain intact.

### QA 1 — Reset Live Teardown

`PermissionLifecycle.removeAllWebsiteAccess()` explicitly sends the idempotent
`PERMISSION_REVOKED` message to every open tab for Origins actually removed by
Reset. It no longer relies on the scheduling of `chrome.permissions.onRemoved`;
the external event remains the fallback.

The headed regression keeps an authorized page and Picker open through Reset
and asserts that the active marker, overlay and Field marker disappear without
a page reload.

### QA 2 — Bind Audience Icons

The supplied network SVG is committed at
`src/ui/icons/assets/share-network.svg` and inlined through the existing
`?inline` boundary. `Bind to this field` retains `plugs-connected.svg`;
`Bind to Shared Set` uses `share-network.svg`. No manifest resource exposure or
web-accessible resource was added.

Follow-up (Task 027 Addendum E.1): `share-network.svg` is a three-node graph
and `ShareIcon` - `Share this version` - already drew the same three-node
graph. The Picker renders the Shared Template Set list and the search results
together, so both commands can appear at once under one picture. Promotion now
has its own glyph. Addendum E's criteria only compared asset identifiers, which
proves two icons are different files, not that they look different.

### QA 3 — Clear Site Data Convergence (root cause NOT proven)

**Superseded on 2026-09-07 by a re-audit. Read this before trusting the
paragraph that follows.** The invalidation below was measured not to change the
outcome of the E2E that accepted it: with the new
`FIELD_IDENTITY_INVALIDATION.RESET_SITE_MAPPINGS_BATCH` entry set to `false`,
so Clear Site Data invalidates nothing at all, the two-Origin E2E still passes.
Its Fields are ordinary Fields on a real path, so they are never cached, and
the open Picker converges through a separate pre-existing path. The unit
regression written for this repair also passed with the production change
removed, and has been replaced. Task 004 Addendum B Acceptance Criterion 3 is
marked not met; the owner's reported scenario is not reproduced under
automation. See `tasks/004-site-access-and-data-management.md`, "Addendum B
Root Cause - Still Unproven", and Addendum B.1 for the SPA-reconstruction
regression this repair caused.

The content runtime resets its document-lifetime Field Context cache when
`BUSINESS_STATE_CHANGED` arrives **and that change could have removed stored
Page or Field Profiles**. The next interaction re-resolves the current Field
instead of reusing a removed identity. Picker state is refreshed without
forcibly closing an open Picker.

The two-Origin E2E covers clearing one Site, reconstructing a template on that
Site without reload, and finding it from the other Site without reload. It also
verifies that the reconstructed Field receives a fresh profile identity. It
proves the product converges; it does not prove why.

## Commit Sequence

- `29d1739` — original combined records/migrations extraction
- `416376e` — Task 030 isolation-test stability repair
- `30f15a6` — state validation extraction
- `5dbb194` — repository inputs/results extraction
- `71b5bba` — initial Task 032 documentation
- `b128e3e`, `fa3ac04`, `198f331` — reconciliation, semantics correction and review gate
- `9b9569e` — formal acceptance of Task 031 and Task 032 Phase A
- `dacc81a` — QA repair design and owning-contract addenda
- `d6f00b5` — QA repair implementation plan
- `d8f44f0` — Reset live-page teardown
- `30c0b6d` — distinct Shared Set Bind icon
- `e1346aa` — Field Context invalidation and regression coverage
- `b2b5480` — preserve Picker behavior while refreshing context
- `bf319bf` — narrow invalidation to cache reset without closing Picker
- `bb8d2d7` — unit regression adjustment
- `f2d107e` — QA repair evidence documentation
- `2dd0bb8` — this handoff document
- `d0d05d9` — re-audit repairs: Promotion glyph, scoped Field Context invalidation
- `4f4cd01` — re-audit evidence: Addendum B root cause recorded as unproven

## Verification Evidence

The final verified tree passed:

- `npm run check`: 54 test files, 677 unit tests, TypeScript, documentation
  conformance (32 contracts), dead-export verification, production build and
  closed-Shadow-Root build gate.
- Focused Reset lifecycle/transaction, Picker icon and content-runtime tests.
- Focused Reset E2E and Clear Site Data cross-tab E2E.
- `npm run test:e2e`: 45/45 headed Playwright tests, no skips, on three
  consecutive full runs.

Known flake, not repaired on one observation: `deletion-safety.spec.ts`
"Factory Reset" failed once with the Reset dialog still open past the 5s
assertion, then passed four consecutive full suites and in isolation. Reset now
fans out to every tab four times - reconcile inject, explicit revocation,
activation broadcast, business broadcast - so timing under load is the leading
hypothesis.

## QA 4 — Product Precondition

The missing `Share this version` entry was not confirmed as an implementation
defect. It appears only when the current Field owns a Field-only relation. To
test `Share with a different field…`:

1. Put the current Field in a Shared Template Set.
2. Search for an unrelated Template.
3. Choose `Bind to this field`.
4. Return to the resulting row; `Share this version` should be present.
5. Click it, then choose `Share with a different field…`.

If this remains confusing, create a separate Task 027 UX addendum. Do not
change audience semantics implicitly.

## Remaining Work

### Task 032 Phase B — Not Authorized

The repository class still contains command method bodies, `read`/`commit`,
and the mutation queue. Any further decomposition must be replanned after the
owner reviews the repaired build. Preserve current observable commit semantics:
`joinSetAndShare` and `mergeSetsAndShare` already use `runAtomicComposite` and
produce one durable storage commit. This was disputed during the re-audit and
is now settled by measurement rather than by reading: both composites carry a
behaviour lock in `tests/unit/repository.test.ts` asserting exactly one
`storage.set` per call, using the `InMemoryLocalStorage` `setCount` seam. Phase
B's per-group behaviour locks can be written the same way.

Before starting Phase B, the next Agent must re-read the Task 032 contract and
this handoff, confirm final hands-on QA, create a new one-boundary-per-slice
plan, add focused tests first, and run independent Spec and Project Standards
review before acceptance.

## Safety Notes

- Do not build or reload the main checkout's `dist/` while comparing the
  pre-repair QA baseline; the repaired build lives in this worktree.
- Production `dist` uses closed Shadow Roots. `dist-e2e` uses the documented
  open-Shadow-Root test exception only.
- The main checkout still has the user's original untracked
  `public/share-network.svg`; this branch has the committed source asset under
  `src/ui/icons/assets/`. Resolve that duplicate intentionally when integrating.
- Integration decided by the owner on 2026-09-07: this branch keeps refactor
  and product commits together and is **not** split. Agents continue on the
  branch the previous agent used - a handoff is a token handoff, not a new line
  of development. Recorded in `docs/agent-handoff.md`.
- The branch is a strict fast-forward of
  `codex/task-021-shared-template-sets-implementation`, so merging it is
  trivial; there is no divergence to resolve.
