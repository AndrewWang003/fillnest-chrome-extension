# Task 025 — Modal Dialog Accessibility Repair

**Version:** `0.1.2 Task 16`
**Status:** Implemented — automated verification complete; focused hands-on
accessibility QA explicitly deferred by the project owner until pre-release or
post-MCP work — 2026-09-05
**Origin:** Task 023 automated accessibility audit

## Goal

Make every Side Panel confirmation dialog genuinely modal and keyboard-operable
without changing any confirmation copy, destructive-operation threshold, or
business mutation semantics.

## Confirmed Evidence

In a real headed extension, open the Sites-page `Stop sharing` confirmation,
focus its final action, then press Tab twice. Focus leaves the element declared
`role="dialog" aria-modal="true"`. The same independently implemented modal
markup pattern is used by all Sites-page confirmations and the Settings reset
and restore confirmations.

## Scope

- Provide one shared, extension-owned focus-management pattern for every Side
  Panel confirmation dialog: Delete newly Global Templates, Remove site, Stop
  matching, End sharing, Stop sharing for a Field, Move field, Clear site
  data, Reset FillNest, and Restore.
- On opening a dialog, move focus to its most appropriate safe initial control:
  the typed-confirmation input where one exists; otherwise Cancel; or the
  non-destructive primary action only when no Cancel action exists.
- Keep Tab and Shift+Tab within the open dialog.
- Escape cancels and closes the dialog only while no request is in flight and
  only when the dialog has a Cancel path. It must not trigger a mutation.
- On ordinary cancellation or successful completion, restore focus to the
  still-connected control that opened the dialog. If that control was removed
  by the successful mutation, restore focus to the nearest surviving owning
  section rather than leaving focus on `body`.
- Add headed extension regressions for focus entry, Tab/Shift+Tab containment,
  Escape cancellation, and focus restoration for representative Site and
  Settings dialogs. Cover the shared primitive directly where practical.

## Non-Goals

- Changing dialog wording, confirmation requirements, impact counts, mutation
  semantics, notification wording, Picker behaviour, or Popup behaviour.
- Redesigning dialog layout, adding a dependency, implementing an external
  focus-trap library, or claiming screen-reader certification.
- Closing a dialog with Escape while a request is in flight, or treating
  browser-level close behaviour as confirmation.

## Acceptance

- Every rendered Side Panel confirmation dialog has one programmatic name and
  exposes only its own controls to sequential keyboard navigation while open.
- Tab and Shift+Tab wrap within each dialog; Escape cancels only eligible
  dialogs and performs no data mutation.
- The invoking control regains focus after cancellation or completion whenever
  it remains connected; otherwise the specified surviving fallback receives
  focus.
- Existing destructive-action confirmation gates, error handling, Undo, and
  result announcements remain unchanged.
- Representative unit and headed-extension E2E regressions pass, followed by
  `npm run check`, full headed E2E, standards review, and focused hands-on
  keyboard and zoom QA.

## Implementation Evidence (2026-09-02)

- `ModalDialog` now owns focus entry, Tab/Shift+Tab containment, idle Escape
  cancellation, and ordinary-cancellation focus restoration for every Side
  Panel confirmation. Typed reset, restore, and delete-newly-Global-Templates
  confirmations focus their text input; ordinary confirmations focus Cancel.
- Post-implementation QA found `WholeLibraryNewlyGlobalDeleteSheet` (the Sites
  page "Delete newly Global Templates" dialog, reached when clearing site
  data, removing a Site, or ending sharing makes the entire Template Library
  newly Global) had a typed-confirmation input but no `initialFocusRef`,
  so it opened focused on Cancel instead - contradicting this Task's own
  Acceptance criterion. Fixed by wiring the same `initialFocusRef` pattern
  already used for the Templates-page and Settings typed confirmations, with
  a regression test (`tests/unit/sites-page.test.tsx`) asserting the typed
  input receives focus on open.
- All prior ad-hoc Side Panel confirmation wrappers now use that primitive,
  including multi-Template deletion. Successful mutations retain their
  existing trigger restoration; Sites removal falls back to its surviving
  address-selection control when its selected-action trigger is removed.
- `npm run check` passed: TypeScript, 42 unit files / 439 tests, and package
  verification. Full headed Playwright passed: 34/34 specifications.
- Remaining manual evidence is intentionally limited to VoiceOver reading and
  live-announcement checks plus actual Chrome 200% and 400% zoom/reflow.

## Manual QA Deferral (2026-09-05)

The project owner reviewed the Task 024 testing checklist and reported that
Task 024 product-flow feedback has been supplied and addressed iteratively.
They explicitly defer Task 025's focused manual accessibility QA because
current product priority is the extension's core behaviour rather than
accessibility-operation validation. This is a deferral, not Task acceptance:
VoiceOver/live-announcement and real Chrome 200%/400% zoom/reflow evidence
remain required before a release-readiness or MCP follow-up acceptance gate.

## Addendum A — Escape Outside A Dialog Closed The Side Panel (2026-09-08)

**Status:** Complete on 2026-09-08. Found by the owner's hands-on QA of this
Task.

### Reported

Two symptoms, reported separately:

1. Escape did not cancel an in-progress Template content edit.
2. Closing the Side Panel from the keyboard left focus on some element in the
   top-left of the page rather than on the control that opened it.

They are one defect. This Task gave the modal dialogs an Escape handler that
calls `preventDefault`. The **inline** editors had none, so Escape propagated
out of the panel document and Chrome took it as "close the side panel". The
owner pressed Escape to abandon an edit and lost the whole panel; focus then
went wherever Chrome puts it in the page, which is not ours to place.

The Field rename editor was a near miss: it cancelled on Escape but never
called `preventDefault`, so it leaked the key too.

### Contract

- An inline editor consumes Escape when there is something to cancel: it
  cancels the edit, calls `preventDefault` and stops propagation.
- Escape elsewhere in the Side Panel stays Chrome's to handle. A search box
  with nothing to cancel is not made to swallow it - suppressing Escape where
  it has no local meaning would take away a working browser affordance.
- Where focus lands in the page after Chrome closes the side panel is Chrome's
  behaviour, not something this project sets. It stops being reachable this way
  once Escape no longer closes the panel by accident.

### Scope Checked

Every Side Panel text input was audited. The Reset, Restore and
delete-confirmation inputs are inside `ModalDialog` and were already covered.
The address search box is deliberately left alone. `.confirm-inline` no longer
exists - this Task converted those to dialogs.

### Acceptance Criteria

1. Escape in a Template content editor cancels the edit and is consumed.
2. Escape in a Field rename cancels it and is consumed.
3. Both assertions check `defaultPrevented`, not only that the editor closed -
   the leak is the half that cost the owner the panel.

