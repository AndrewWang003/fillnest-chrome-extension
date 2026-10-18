# Task 027 Bind/Share Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair every confirmed Task 027 Bind/Share integrity defect without expanding the accepted product surface.

**Architecture:** Make relation provenance explicit at read and mutation boundaries, calculate composite state transitions in memory, and persist each user operation once. Reuse the existing Picker and Side Panel confirmation primitives and keep the service worker as the sole Repository owner.

**Tech Stack:** TypeScript, Preact, Manifest V3, chrome.storage.local Repository, Vitest, Playwright.

**Spec:** `tasks/027-explicit-template-audience-scope.md`, Addendum B.

## Global Constraints

- No dependency, schema-version, framework, permission, or runtime-boundary change.
- No network feature, backend, account, sync, AI, or remote code.
- Owner-only policy is relationship-scoped; a Template entity never gains a global private flag.
- Excluded or unsupported webpage fields remain zero-touch.
- Every mutation remains service-worker-owned and typed.

---

### Task 1: Relation-aware discovery, resolution, and usage

**Files:**
- Modify: `src/storage/fillnest-repository.ts`
- Modify: `src/templates/field-first-view.ts`
- Modify: `src/ui/picker/InlinePicker.tsx`
- Test: `tests/unit/task-027-remediation.test.ts`
- Test: `tests/unit/inline-picker.test.tsx`

- [ ] Add failing regressions for owner-only Search/Finder disclosure, private Override provenance, and primary-relation usage.
- [ ] Run the focused tests and confirm the new cases fail for the audited reasons.
- [ ] Add shared relation-aware selectors and route Search/Finder/usage through them.
- [ ] Run the focused tests and confirm they pass.

### Task 2: Exact Bind, Unbind, Promotion, and Undo contracts

**Files:**
- Modify: `src/storage/fillnest-repository.ts`
- Modify: `src/messages/runtime-messages.ts`
- Modify: `src/background/service-worker.ts`
- Modify: `src/ui/picker/InlinePicker.tsx`
- Modify: `src/ui/side-panel/TemplatesPage.tsx`
- Test: `tests/unit/task-027-remediation.test.ts`
- Test: `tests/unit/repository.test.ts`
- Test: `tests/unit/inline-picker.test.tsx`
- Test: `tests/unit/side-panel-library.test.tsx`

- [ ] Add failing regressions for Exclusion rebind, stale cross-surface Undo, private Override promotion, over-broad Field State deletion, relation-targeted Save, and Unbind state cleanup.
- [ ] Run the focused tests and confirm failure.
- [ ] Introduce discriminated mutation/Undo results and exact expected snapshots.
- [ ] Add accessible pre-mutation Bind/Share confirmations with pending-submit locks.
- [ ] Run the focused tests and confirm they pass.

### Task 3: Single-commit composite Join/Merge-and-share

**Files:**
- Modify: `src/storage/fillnest-repository.ts`
- Modify: `src/messages/runtime-messages.ts`
- Modify: `src/ui/picker/InlinePicker.tsx`
- Test: `tests/unit/task-027-remediation.test.ts`
- Test: `tests/unit/inline-picker.test.tsx`

- [ ] Add failing persistence-failure and invalid-promotion regressions proving current partial commits.
- [ ] Extract pure state transition helpers for Add, Merge, Promote, and inverse operations.
- [ ] Commit each composite or inverse exactly once.
- [ ] Connect the existing Finder candidate flow to explicit Join/Merge-and-share confirmations and one Undo record.
- [ ] Run focused Repository and Picker tests.

### Task 4: Affinity, recovery, and integration evidence

**Files:**
- Modify: `src/storage/fillnest-repository.ts`
- Modify: `tests/e2e/explicit-template-audience-scope.spec.ts`
- Modify: `DEVELOPMENT.md`

- [ ] Add failing owner-only affinity regressions and correct affinity only at explicit promotion.
- [ ] Add the required headed E2E scenarios.
- [ ] Run `npm run check` and `npm run test:e2e`.
- [ ] Perform independent Spec and Project Standards review; resolve every actionable P0-P2 finding.
- [ ] Update `DEVELOPMENT.md` to concise current status, verified checks, remaining hands-on QA, and no stale completion claims.
