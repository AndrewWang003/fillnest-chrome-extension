# Task 018 — Generic Eligibility And Lifecycle Improvement

**Version:** `0.1.2 Task 09`  
**Status:** Complete and accepted — 2026-08-31

## Goal

Make the smallest generic improvement to field classification and content-script
observation, teardown, and re-scan behaviour required by accepted Task 016 and
the accepted Task 017 fixture matrix.

## Confirmed Grill Decisions

- This Task converts exactly the six named Task 017 expected-red lifecycle
  specifications into ordinary green regressions: proactive dynamic insertion,
  DOM replacement without unsupported Binding inheritance, and temporary
  `hidden`, `display:none`, `disabled`, and `readOnly` unavailability.
- A Field that becomes temporarily ineligible, detached, or replaced loses its
  page-level FillNest control, marker, direct per-Field listener, and insertion
  path immediately. An ordinary unpinned Picker closes; a pinned Picker follows
  the safe no-target rule below. Its user-confirmed durable FieldProfile and
  Binding remain intact.
- A restored or replacement Field is a fresh candidate. It may recover a
  relationship only after accepted reliable recognition. The Task 016 DOM
  replacement addendum requires unchanged stable logical Page identity, a
  non-empty generic semantic kind, and an exact stable Field fingerprint. The
  current fixture provides no such evidence, so it must not inherit a detached
  Field's Binding.
- Review evidence additionally proves that the same protection applies when
  the replaced Field is no longer the currently focused Field, and that a
  semantic replacement with the exact accepted evidence can recover its
  Binding.
- A stable Field added after content-script startup as ordinary page hydration
  uses normal reliable recognition after a tab is reopened. The replacement
  fail-closed boundary applies only when the same lifecycle batch contains a
  detached predecessor.
- Repeated Field automatic reuse and any user-confirmation prompt for it are
  out of scope. They remain blocked on a separate Task 016 evidence addendum.
- The implementation observes only lifecycle-relevant DOM and availability
  changes, coalesces redundant work, and remains idempotent. It must not read a
  Field value while classifying, observing, tearing down, or recovering it.
- Temporary ineligibility and detachment close an ordinary unpinned Picker.
  A pinned Picker instead enters the accepted safe no-target state: it remains
  visible, gives the user the defined unavailable-field message, and disables
  every Target-dependent operation until a supported Field receives focus.

## Scope

- Preserve the existing text-type allowlist and sensitive/special-control veto.
- Correct generic handling for removed/replaced nodes, dynamic appearance,
  hidden-state changes, re-rendering, and Binding recovery.
- Use Task 017 as the regression gate and retain idempotent injection: one
  effective control, marker set, and handler per eligible field.
- Keep the change within the content-script lifecycle and its existing generic
  eligibility/recognition seams. No storage schema, Repository command,
  permission model, Page identity, or ordinary Picker workflow changes.

## Non-Goals

- Comboboxes, rich-text editors, label dictionaries, semantic guesses, or
  any site-specific rule.
- Repeated Field auto-reuse, inferred repeat relationships, or a confirmation
  prompt for suggested reuse.
- Reading or profiling excluded fields, changing product scope, or embedding
  QA repairs in Task 019.

## Acceptance

- Lifecycle matrix and untrusted-page-event regression cases pass.
- All six named Task 017 expected-red specifications pass as ordinary green
  regressions and leave no duplicate controls, markers, handlers, or Picker
  paths after lifecycle transitions.
- Excluded controls are proven zero-touch across every extension path.
- Pinned lifecycle regressions prove that an unavailable or detached Target
  retains only the safe no-target Picker surface, with no insertion or Binding
  path, and that focus on an eligible Field restores normal operation.
- `npm run check`, relevant headed E2E, Spec/Standards review, and Task 019
  hands-on acceptance pass before the task is accepted.
