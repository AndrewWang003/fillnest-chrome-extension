# Task 021 QA Repairs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to execute these tasks inline, one test-first task at a time.

**Goal:** Make Shared Template Set candidate selection easier to understand and make `Stop sharing` preserve a departing Field's complete independent Template library.

**Architecture:** The Picker ranks only its explicit, same-Site `Add Fields` candidates by local observed-name token overlap, while preserving document order among every matching candidate. The content runtime owns a temporary, non-persistent highlight for live current-page candidates. Repository removal snapshots a set's ordered bindings into the departing Field's direct bindings without deleting its pre-existing direct bindings; Undo removes only that snapshot and restores membership.

**Tech Stack:** TypeScript, Preact, Manifest V3 content script, chrome.runtime messages, Vitest, Playwright.

**Spec:** `tasks/015-share-templates.md` and `tasks/021-shared-template-sets-implementation.md` (QA addendum authorized 2026-09-02).

## Global Constraints

- Remain local-first: no network, AI, telemetry, value reads, named-site rules, or automatic relationship creation.
- Shared Template Sets remain strictly Site-local.
- Add Fields ranking is presentation only; selection remains explicit and all candidates remain available.
- The highlighter must never persist DOM data or mutate an input's value.
- A departing Field retains existing direct bindings and receives a deduplicated, ordered snapshot of the Shared Template Set; later mutations do not synchronize.
- Every new mutation follows the established one-Undo, global invalidation, fail-closed pattern.

---

### Task 1: Record the accepted QA addendum

**Files:**
- Modify: `tasks/015-share-templates.md`
- Modify: `tasks/021-shared-template-sets-implementation.md`
- Modify: `DEVELOPMENT.md`

- [ ] Add the new departure semantics: direct bindings are retained, current shared bindings become a deduplicated direct snapshot, and no future synchronization occurs.
- [ ] Add the candidate-ranking and temporary current-page highlighter boundaries.
- [ ] Record the required regression evidence without marking Task 021 accepted before fresh hands-on QA.

### Task 2: Test and implement non-lossy `Stop sharing`

**Files:**
- Modify: `tests/unit/repository.test.ts`
- Modify: `src/storage/fillnest-repository.ts`
- Modify: `src/messages/runtime-messages.ts`
- Modify: `src/background/service-worker.ts`
- Modify: `src/ui/picker/InlinePicker.tsx`
- Modify: `src/ui/side-panel/SitesPage.tsx`

- [ ] Write failing repository tests proving member removal retains existing direct bindings, adds each missing shared Template in shared order, and Undo removes only snapshot bindings before restoring membership.
- [ ] Run the focused repository test and verify the pre-change assertion fails.
- [ ] Extend the remove/undo result payloads so both Picker and Sites retain the exact snapshot Binding records required for Undo.
- [ ] Implement one atomic repository mutation that builds the snapshot, deduplicates by `fieldProfileId + templateId`, and commits membership and bindings together.
- [ ] Run the focused repository and Picker/Sites tests until green.

### Task 3: Test and implement Add Fields ranking and temporary target highlighting

**Files:**
- Modify: `tests/unit/inline-picker.test.tsx`
- Modify: `tests/unit/content-script-spa-reconstruction.test.ts`
- Modify: `src/ui/picker/InlinePicker.tsx`
- Modify: `src/content/content-script.tsx`
- Modify: `src/ui/picker/picker-styles.ts`

- [ ] Write a failing Picker test using repeated field labels to prove all candidates sharing a normalized name token precede non-matches while preserving document order within the matching group.
- [ ] Write a failing content-runtime test showing hover/focus applies and cleanup removes a temporary highlight only for an on-page identity key.
- [ ] Run focused tests and verify the assertions fail before code changes.
- [ ] Add a small pure normalized-token overlap helper and use it solely as the first sort partition; retain existing structural ordering inside each partition.
- [ ] Add an optional Picker callback for the focused/hovered live candidate identity key. The content runtime resolves that identity against eligible current-page Fields and toggles a private extension marker/class; cleanup runs on change, Add Fields close, Picker close, and runtime stop.
- [ ] Add extension-owned CSS for a visible theme-colored outline/glow without changing page values or styles permanently.
- [ ] Run focused tests until green.

### Task 4: End-to-end evidence and full verification

**Files:**
- Modify: `tests/e2e/shared-template-sets-management.spec.ts` or add a focused Task 021 E2E spec
- Modify: `DEVELOPMENT.md`
- Modify: `tasks/021-shared-template-sets-implementation.md`

- [ ] Add headed E2E coverage for creating a three-Field set, saving a shared Template, stopping sharing on one Field, and verifying the departed Field retains its independent snapshot while later shared mutations affect only the remaining members.
- [ ] Add a current-page repeated-label candidate ordering/highlight interaction assertion where the fixture can observe the extension marker.
- [ ] Run `npm run check`, `npm run test:e2e`, and `git diff --check`.
- [ ] Record exact test totals and any manual QA still required; do not claim acceptance without the user's hands-on confirmation.
