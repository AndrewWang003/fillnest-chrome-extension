# Phase One Audit Residual Repairs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair R1 and C1–C3 from the Phase One audit with focused regression evidence and no product-scope expansion.

**Architecture:** Preserve the existing coordinator, DOM metadata, URL identity, and mutation-observer boundaries. Move each missing safety decision to the earliest point where its evidence exists: latch rollback failure before persistence, filter editable descendants while reading label metadata, classify fragment query state as a separate source, and retain formerly marked elements through lifecycle teardown.

**Tech Stack:** TypeScript 5.9, Chrome Manifest V3, Vitest/happy-dom, Playwright, npm/Vite.

**Spec:** `tasks/039-phase-one-audit-residual-repairs.md`

## Global Constraints

- Keep all behavior local-first and make no network-dependent product change.
- Preserve frozen Page identity keys except route-shaped hashes whose semantic query was previously discarded.
- Never read a Field's current value outside the already-authorized explicit actions.
- Add no dependency, new recurring scan, site-specific selector, HTML explanation artifact, or user-facing control.
- Keep `DEVELOPMENT.md` concise and current; owner QA remains separate.

---

### Task 1: Fail Closed Before Failed-Journal Persistence

**Files:**
- Modify: `tests/unit/service-worker-runtime.test.ts`
- Modify: `src/backup/restore-journal.ts`

**Interfaces:**
- Consumes: `RestoreTransactionCoordinator.failedRollback()` and the service worker's existing request gate.
- Produces: an in-memory recovery lock set before attempting the best-effort `failed` journal update.

- [x] Add a live-worker regression that injects target activation failure, business rollback failure, and failed-status journal write failure; assert the next mutation is rejected with `restore-recovery-blocked` and the original `in_progress` journal still contains the prior data.
- [x] Run `npx vitest run tests/unit/service-worker-runtime.test.ts` and confirm the new assertion fails because the later mutation succeeds.
- [x] In the rollback catch, construct and assign `rollbackFailure` before the journal status write; make that status write best-effort because the existing `in_progress` entry already holds recovery evidence.
- [x] Re-run the test and confirm it passes.

### Task 2: Exclude Editable Content From Rich Field Labels

**Files:**
- Modify: `tests/unit/rich-text-field.test.ts`
- Modify: `src/fields/dom-field.ts`

**Interfaces:**
- Consumes: `readAccessibleName`, `readSafeMetadata`, and `fieldObservedTitle`.
- Produces: a local label-text reader that clones the label source, removes the target Rich Text Field and all other `[contenteditable]` descendants, then reads remaining text.

- [x] Add regressions for a wrapping label and an `aria-labelledby` element that contain editable descendants; assert useful label text remains and draft text is absent from accessible metadata and observed title.
- [x] Run `npx vitest run tests/unit/rich-text-field.test.ts` and confirm the new literal expectations fail with the draft text present.
- [x] Implement the minimal filtered label-text reader and use it for the two rich accessible-name fallbacks.
- [x] Re-run the test and confirm it passes without changing native-control behavior.

### Task 3: Preserve Hash-Route Query Identity

**Files:**
- Modify: `tests/unit/page-identity-coverage.test.ts`
- Modify: `src/recognition/recognition-evidence.ts`

**Interfaces:**
- Consumes: the current tracking, volatile, record-query, stable-route, and opaque-value classifiers.
- Produces: query parts from both `URL.searchParams` and a route-shaped hash's `URLSearchParams`, with `hash-` namespacing only for fragment parameters.

- [x] Add literal regression cases proving distinct semantic hash values produce distinct keys, volatile/tracking hash parameters are ignored, the same key/value in outer and fragment query positions stays distinct, and query-free frozen keys remain unchanged.
- [x] Run `npx vitest run tests/unit/page-identity-coverage.test.ts` and confirm the semantic hash case fails by returning equal keys.
- [x] Extract the existing query classification into a source-aware helper and append separately namespaced hash-query parts while keeping outer output byte-identical.
- [x] Re-run the test and confirm all identity and route-family coverage passes.

### Task 4: Reconcile Former Rich Field Markers

**Files:**
- Modify: `tests/unit/content-script-spa-reconstruction.test.ts`
- Modify: `src/content/content-script.tsx`

**Interfaces:**
- Consumes: `FIELD_MARKER`, `observedFieldEvidence`, `fieldsAffectedBy`, and `markCandidate`.
- Produces: a lifecycle element queue that accepts current candidates plus previously marked/observed elements long enough to remove stale runtime state.

- [x] Add a content-script regression that marks an unfocused Rich Text Field, changes it to `contenteditable=false`, and waits for its marker to disappear.
- [x] Run `npx vitest run tests/unit/content-script-spa-reconstruction.test.ts` and confirm the marker remains.
- [x] Broaden only lifecycle queue typing and affected-element discovery; keep recognition, snapshots, focus targeting, and persistent identity restricted to real `SupportedField` values.
- [x] Re-run the test and confirm the marker is removed.

### Task 5: Documentation And Full Verification

**Files:**
- Modify: `tasks/039-phase-one-audit-residual-repairs.md`
- Modify: `DEVELOPMENT.md`

**Interfaces:**
- Consumes: fresh targeted and full-suite outputs.
- Produces: current implementation status, verified counts, known limits, and next gates.

- [x] Run the focused unit files for all four repairs together.
- [x] Run `npm run check` and read the complete result.
- [x] Run `npm run test:e2e` and read the complete result.
- [x] Review `git diff --check`, `git diff --stat`, and the exact changed hunks; verify no unrelated user change was overwritten.
- [x] Update Task 039 and `DEVELOPMENT.md` with only the fresh evidence, unresolved owner QA, and release blockers.
