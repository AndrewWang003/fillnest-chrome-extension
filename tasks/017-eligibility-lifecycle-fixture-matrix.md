# Task 017 — Eligibility Lifecycle Fixture Matrix

**Version:** `0.1.2 Task 08`  
**Status:** Complete and accepted — 2026-08-31

## Goal

Create FillNest-owned synthetic fixtures and a case map that become the
regression gate for the accepted Eligibility/lifecycle contract.

## Case Map

| Case ID | Category | Declared Input & Action | Expected Outcome | Protected Rule | Test Harness Status |
| --- | --- | --- | --- | --- | --- |
| `dyn-insert-text` | Dynamic Insertion | Button `#btn-add-dynamic-text` appends `<input type="text">` | Eligible text field; receives FillNest control | Only text-like inputs eligible; no whole-form fill | Green (Harness & E2E `SPEC-016-DYN-01`) |
| `dyn-insert-textarea` | Dynamic Insertion | Button `#btn-add-conditional-note` appends `<textarea>` | Eligible textarea; single-field interaction | Fail-closed on non-text elements | Green (Harness) |
| `repeat-group-distinct-0` | Repeated Groups | Initial row 0 `<input name="contacts[0].name">` | Eligible field; single-field insert isolated to row 0 | Single-field insertion never affects sibling/repeated fields | Green (Harness & E2E) |
| `repeat-group-distinct-1` | Repeated Groups | Button `#btn-add-repeat-contact-row` appends row 1 `contacts[1].name` | Eligible field; manual interaction works without cross-row insertion | Row index is runtime-only evidence | Green (Harness & E2E); no reliable-scope positive is declared |
| `repeat-group-reorder` | Repeated Groups | Button `#btn-reorder-repeat-contact-rows` moves row 1 before row 0 | Live rows reorder without replacing either FieldInstance | Current DOM order is never persistent identity | Green (Harness) |
| `repeat-group-ambiguous-0` | Repeated Groups | Row 0 bare `<label>Item note<input name="item_note"></label>` | Eligible for manual single-field Bind | No speculative binding inheritance | Green (Harness & E2E) |
| `repeat-group-ambiguous-1` | Repeated Groups | Button `#btn-add-ambiguous-item` clones duplicate row | Eligible for manual action; NO inherited binding | Ambiguous repeat receives zero inherited binding | Green (Harness & E2E) |
| `dom-replace-rerender` | DOM Replacement | Button `#btn-replace-field` replaces DOM node with an otherwise identical Field, without accepted reliable recognition evidence | Old node torn down; open Picker closes/cancels silently; replacement receives fresh recognition without inherited Binding | Picker permanently bound to target; never retargets or transfers Binding without reliable recognition | Green (Harness & E2E `SPEC-016-REPLACE-01`) |
| `hidden-lifecycle-attr` | Hidden Lifecycle | Button `#btn-toggle-hidden-attr` toggles `hidden` without moving focus | Complete teardown, one-control recovery, and durable data retention | Unavailable fields receive zero extension UI | Green (Harness & E2E `SPEC-016-HIDDEN-ATTR-01`) |
| `hidden-lifecycle-display-none` | Hidden Lifecycle | Button `#btn-toggle-display-none` toggles ancestor `display:none` without moving focus | Complete teardown, one-control recovery, and durable data retention | Rendered/interactable evidence checks ancestors | Green (Harness & E2E `SPEC-016-HIDE-01`) |
| `hidden-lifecycle-disabled` | Hidden Lifecycle | Button `#btn-toggle-disabled` toggles `disabled` without moving focus | Immediate teardown, one-control recovery, and durable data retention | Disabled fields receive zero touch | Green (Harness & E2E `SPEC-016-DISABLED-01`) |
| `hidden-lifecycle-readonly` | Hidden Lifecycle | Button `#btn-toggle-readonly` toggles `readOnly` without moving focus | Immediate teardown, one-control recovery, and durable data retention | ReadOnly fields receive zero touch | Green (Harness & E2E `SPEC-016-READONLY-01`) |
| `low-conf-unlabelled-0` | Low Confidence | Form input 0 bare `<input type="text">` | Structural ordinal 0; requires manual Bind | Fail-closed on low confidence | Green (Harness) |
| `low-conf-unlabelled-1` | Low Confidence | Form input 1 bare `<input type="text">` | Structural ordinal 1; distinct from input 0 | No accidental cross-binding | Green (Harness) |
| `excluded-password` | Excluded Zero-Touch | `<input type="password">` | Fail-closed veto (`type`); zero touch | Sensitive password fields unconditionally excluded | Green (Harness & E2E) |
| `excluded-otp` | Excluded Zero-Touch | `<input autocomplete="one-time-code">` | Fail-closed veto (`sensitive`); zero touch | 2FA/OTP fields unconditionally excluded | Green (Harness & E2E) |
| `excluded-section-otp` | Excluded Zero-Touch | `<input autocomplete="section-login one-time-code">` | Fail-closed veto (`sensitive`); zero touch | Composite OTP tokens vetoed | Green (Harness & E2E) |
| `excluded-payment-cc` | Excluded Zero-Touch | `<input autocomplete="cc-number">` | Fail-closed veto (`sensitive`); zero touch | Payment card numbers vetoed | Green (Harness & E2E) |
| `excluded-payment-cvv` | Excluded Zero-Touch | `<input name="securityCode" aria-label="CVV">` | Fail-closed veto (`sensitive`); zero touch | Payment CVV/security codes vetoed | Green (Harness & E2E) |
| `excluded-label-card` | Excluded Zero-Touch | `<label>Credit card number<input ...></label>` | Fail-closed veto (`sensitive`); zero touch | Semantic card labels vetoed | Green (Harness & E2E) |
| `excluded-number` | Excluded Zero-Touch | `<input type="number">` | Fail-closed veto (`type`); zero touch | Non-text input types excluded | Green (Harness & E2E) |
| `excluded-date` | Excluded Zero-Touch | `<input type="date">` | Fail-closed veto (`type`); zero touch | Native date controls excluded | Green (Harness & E2E) |
| `excluded-script-date-picker` | Excluded Zero-Touch | `<label>Date picker<input name="my-date"></label>` | Fail-closed veto (`special-purpose`); zero touch | Date picker widgets vetoed | Green (Harness & E2E) |
| `excluded-controlled-date` | Excluded Zero-Touch | `<input role="combobox" aria-controls="app-calendar">` | Fail-closed veto (`special-purpose`); zero touch | Custom calendar comboboxes vetoed | Green (Harness & E2E) |
| `excluded-combobox-country` | Excluded Zero-Touch | `<input role="combobox" aria-controls="country-list">` | Fail-closed veto (`special-purpose`); zero touch | Listbox comboboxes vetoed | Green (Harness & E2E) |
| `excluded-spinbutton` | Excluded Zero-Touch | `<input role="spinbutton">` | Fail-closed veto (`special-purpose`); zero touch | Complex widget roles vetoed | Green (Harness & E2E) |
| `excluded-hidden-input` | Excluded Zero-Touch | `<input type="hidden">` | Fail-closed veto (`type`); zero touch | Hidden inputs receive zero touch | Green (Harness & E2E) |
| `excluded-static-readonly` | Excluded Zero-Touch | `<input readonly>` | Fail-closed veto (`state`); zero touch | ReadOnly inputs vetoed | Green (Harness & E2E) |
| `excluded-static-disabled` | Excluded Zero-Touch | `<input disabled>` | Fail-closed veto (`state`); zero touch | Disabled inputs vetoed | Green (Harness & E2E) |
| `excluded-contenteditable` | Excluded Zero-Touch | `<div contenteditable="true">` | Fail-closed veto (`element`); zero touch | Non-input/textarea elements vetoed | Green (Harness & E2E) |

## Execution Boundary & Verification

Task 017 owns executable test evidence, not the product behaviour that evidence
specifies. Runtime product code (`src/`) was left untouched.

Fixture case data and page behaviour remain test-only; the local HTTP server
lifecycle is isolated in `tests/helpers/synthetic-lifecycle-server.ts`, and
extension activation, runtime requests, and value-read observation are shared
by E2E suites through `tests/helpers/extension-e2e-session.ts`.

- **Fixture & Harness Checks (Deterministic & Green):**
  - `tests/unit/synthetic-lifecycle-matrix.test.ts` (9 tests passed in happy-dom):
    - Confirms synthetic DOM structure and declared sections.
    - Confirms dynamic insertion, repeated groups creation, DOM replacement, and hidden/disabled/readonly toggles.
    - Confirms fail-closed eligibility classification for all 29 cases.
    - Confirms structural ordinal separation for repeated and unlabelled inputs.
    - Confirms single-field event isolation between repeated rows and form submission prevention.
  - `tests/e2e/synthetic-lifecycle-matrix.spec.ts` (passed in Playwright):
    - Confirms observable zero-touch across excluded fields: no value read,
      direct per-Field listener, marker, effective Picker path, FieldProfile,
      or Binding after focus and input events. The value-read hook has a
      positive content-script control: the explicit `Use current field content`
      action must increase the observed count on an eligible Field. The direct
      listener audit has a positive fixture control: a regular fixture Field
      with host listeners must report a non-zero direct listener count.
    - Confirms repeated groups single-field insertion isolation.
    - Confirms focus-driven single-field template creation, binding, and insertion.
- **Task 018 Lifecycle Regressions (`tests/e2e/lifecycle-specifications.spec.ts`):**
  - `[SPEC-016-DYN-01]` proves proactive dynamic field observation without initial user focus.
  - `[SPEC-016-REPLACE-01]` proves a replacement Field without reliable evidence does not inherit the detached Field Binding.
  - `[SPEC-016-HIDE-01]`, `[SPEC-016-HIDDEN-ATTR-01]`, `[SPEC-016-DISABLED-01]`, and `[SPEC-016-READONLY-01]` prove immediate teardown and single-control recovery for their named availability transition.
  - Each temporary-ineligible specification first creates a real FieldProfile and
    Binding while its Picker is open. It then requires Picker closure, marker,
    direct per-Field listener, and insertion-path teardown, followed by exactly
    one recovered control and unchanged durable FieldProfile/Binding state.
  - No `reliable repeated instance` positive specification is valid yet. The
    current contact rows differ only by dynamic index and share labels and row
    structure, which Task 016 explicitly says are insufficient. A Task 016
    addendum must first define a generic, reliable evidence rule; Task 017 will
    then add a synthetic case and Task 018 may implement it.
  - These specifications are now ordinary headed E2E regressions under
    `npm run test:e2e`; Task 018 converted their Task 017 expected-red baseline
    into green lifecycle evidence.

## Acceptance

- [x] First-review findings are remediated and independently re-verified.
- [x] The case map covers every Task 016 lifecycle transition relevant to tests.
- [x] Observable zero-touch assertions cover every permitted test seam.
- [x] Fixture and harness checks are stable and green before Task 018 starts.
- [x] Every missing implementation behaviour is recorded as a reproducible,
      individually named expected-baseline failure or pending specification, with
      its required future green outcome and owning Task 018.
- [x] The accepted Task 016 contract names generic evidence sufficient to prove
      a repeated FieldInstance reliable before any positive reuse fixture is
      added.
