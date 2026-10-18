# Task 025 Modal Dialog Accessibility Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:executing-plans` to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all Side Panel confirmation dialogs keyboard-modal, predictable
to close, and focus-restoring without altering their data-operation semantics.

**Architecture:** Extract one `ModalDialog` primitive into
`SidePanelShared.tsx`. It owns focus entry, Tab/Shift+Tab containment, eligible
Escape cancellation, and restoration after ordinary cancellation. Existing Sites, Settings,
and Templates confirmation components retain their current state machines and
render their existing content inside that primitive.

**Tech Stack:** TypeScript, Preact, Vitest with happy-dom, headed Playwright
extension tests.

**Spec:** `tasks/025-modal-dialog-accessibility-repair.md`

## Global Constraints

- No new dependency or external focus-trap library.
- Preserve confirmation copy, typed tokens, business commands, Undo, error
  handling, and result wording.
- Escape must never confirm or close a dialog during an in-flight request.
- Keep all persistent project text in English.

---

### Task 1: Shared modal-dialog primitive and unit coverage

**Files:**

- Modify: `src/ui/side-panel/SidePanelShared.tsx`
- Modify: `tests/unit/side-panel.test.tsx`

**Interfaces:**

- Produces `ModalDialog`, accepting `label` or `labelledBy`, `onCancel`,
  `busy`, `initialFocus`, `restoreFocusTo`, and children.
- Consumes existing `restoreFocus` semantics without changing its public
  behavior for callers that do not use the new primitive.

- [x] **Step 1: Write failing unit tests**

  Render the primitive with two controls and assert: initial focus reaches the
  supplied safe control; Tab after the final control returns to the first;
  Shift+Tab before the first returns to the final; Escape calls `onCancel` only
  when `busy` is false; and unmount restores focus to a connected trigger.

- [x] **Step 2: Run the targeted unit test and verify RED**

  Run: `npm test -- tests/unit/side-panel.test.tsx`

  Expected: the test cannot import or render `ModalDialog` before the
  primitive exists.

- [x] **Step 3: Implement the minimal primitive**

  Use a dialog `ref` and `useEffect` to focus the supplied initial element on
  mount and restore focus on cleanup. On `keydown`, calculate focusable,
  enabled controls within the dialog; wrap Tab/Shift+Tab only at their ends;
  cancel Escape only when `busy` is false. Render the existing overlay,
  backdrop, `role="dialog"`, and `aria-modal="true"` centrally.

- [x] **Step 4: Run the targeted unit test and verify GREEN**

  Run: `npm test -- tests/unit/side-panel.test.tsx`

  Expected: all existing Side Panel shared-component tests and the new modal
  lifecycle tests pass.

- [x] **Step 5: Commit the isolated primitive**

  Run: `git add src/ui/side-panel/SidePanelShared.tsx tests/unit/side-panel.test.tsx && git commit -m "feat: add accessible side panel modal primitive"`

### Task 2: Migrate every existing Side Panel confirmation

**Files:**

- Modify: `src/ui/side-panel/SitesPage.tsx`
- Modify: `src/ui/side-panel/SettingsPage.tsx`
- Modify: `src/ui/side-panel/TemplatesPage.tsx`
- Test: `tests/unit/sites-page.test.tsx`

**Interfaces:**

- Consumes `ModalDialog` from `SidePanelShared.tsx`.
- Produces no new runtime messages or repository commands.

- [x] **Step 1: Write failing component tests**

  Cover representative Sites and Settings flows: opening a typed confirmation
  focuses its typed input; opening an ordinary confirmation focuses Cancel;
  Escape cancels an idle confirmation without calling its mutation callback;
  Escape has no effect while its action is busy.

- [x] **Step 2: Run the targeted unit tests and verify RED**

  Run: `npm test -- tests/unit/sites-page.test.tsx tests/unit/side-panel.test.tsx`

  Expected: current individually-rendered sheets do not have the shared focus
  behavior.

- [x] **Step 3: Migrate the sheets without changing their contents**

  Replace the repeated overlay/dialog wrappers in Sites, Settings, and
  Templates with `ModalDialog`. Pass the existing cancellation handlers and
  existing busy state; preserve typed input, action order, labels, and all
  request callbacks. Use existing trigger refs where the trigger survives, and
  specify the owning section fallback for deletion/removal cases.

- [x] **Step 4: Run the targeted unit tests and verify GREEN**

  Run: `npm test -- tests/unit/sites-page.test.tsx tests/unit/side-panel.test.tsx`

  Expected: existing management tests plus all new keyboard cases pass.

- [ ] **Step 5: Commit the migration**

  Run: `git add src/ui/side-panel/SitesPage.tsx src/ui/side-panel/SettingsPage.tsx src/ui/side-panel/TemplatesPage.tsx tests/unit/sites-page.test.tsx tests/unit/side-panel.test.tsx && git commit -m "fix: contain focus in side panel confirmations"`

### Task 3: Headed extension keyboard regressions and final evidence

**Files:**

- Modify: `tests/e2e/shared-template-sets-management.spec.ts`
- Modify: `tests/e2e/deletion-safety.spec.ts`
- Modify: `tasks/023-cross-surface-accessibility-hardening.md`
- Modify: `DEVELOPMENT.md`

**Interfaces:**

- Consumes the actual built extension and existing management fixture setup.
- Produces headed regression evidence for Sites and Settings dialogs.

- [x] **Step 1: Write failing headed E2E assertions**

  In the existing Stop sharing flow, assert focus enters Cancel, Tab and
  Shift+Tab stay within the dialog, Escape dismisses it without changing
  Shared Set state, and focus returns to the invoking Remove button. In the
  Reset flow, assert focus enters the typed input and Escape dismisses only
  before reset begins.

- [x] **Step 2: Run the selected E2E tests and verify RED**

  Run: `npm run build && npx playwright test tests/e2e/shared-template-sets-management.spec.ts tests/e2e/deletion-safety.spec.ts`

  Expected: the current modal focus escape fails the containment assertion.

- [x] **Step 3: Verify GREEN after Tasks 1–2**

  Re-run the same command and confirm keyboard containment, Escape, and focus
  restoration pass in the built extension.

- [x] **Step 4: Run complete validation**

  Run: `npm run check && npm run test:e2e && git diff --check`

  Expected: typecheck, all unit tests, package verification, full headed E2E,
  and whitespace validation pass.

- [ ] **Step 5: Record current evidence and commit**

  Update Task 023 and `DEVELOPMENT.md` with the exact automated result and
  remaining manual VoiceOver/zoom checks. Commit with:
  `git add tests/e2e/shared-template-sets-management.spec.ts tests/e2e/deletion-safety.spec.ts tasks/023-cross-surface-accessibility-hardening.md DEVELOPMENT.md && git commit -m "test: cover side panel modal keyboard flow"`
