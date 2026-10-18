# Task 011 — Side Panel Header And Notification Region

**Version:** `0.1.2 Task 02`
**Status:** Complete and accepted — 2026-08-25

Contract drafted from the 2026-08-25 Grill Mode decisions. It is accepted for implementation.

## Goal

Recover vertical space in the Side Panel and make every Side Panel-originated
result discoverable in one stable region anchored at the bottom of the panel.

## User Value

Users can see what their most recent Side Panel operation did, and can use its
Undo when available, without a duplicate bottom bar that obscures management
controls or disappears when they navigate.

## Confirmed Decisions

- Remove the standalone `FillNest` title/header at the top of the Side Panel.
- Place a non-interactive FillNest app icon at the left edge of the navigation
  bar. It is not a button, does not create a navigation action, and is absent
  from keyboard navigation.
- Reserve one global result region below the scrollable destination content,
  anchored at the bottom of the Side Panel.
- The region holds every Side Panel result, including normal completion notices
  and reversible Template-operation outcomes with their `Undo` action.
- Remove the fixed bottom Side Panel Undo bar, its collapsed handle, and all
  related collapse/hide behaviour.
- The region has one current result across all Side Panel destinations.
  Navigation does not clear it. A later successful operation replaces it.
  A later successful FillNest mutation silently invalidates a recoverable
  result, under Task 010's established global invalidation rule.
- Successful Undo replaces its prior result with its real restored/reverted
  outcome and creates no second Undo.
- When a confirmation sheet closes after success, focus returns to the button
  that opened it. The result is announced as status and does not steal focus.

## Scope

### In Scope

- Side Panel shell and navigation layout needed to remove the title/header and
  install the permanent bottom-anchored global result region.
- Moving existing Templates, Sites, and Settings result/Undo presentation into
  that region without duplicating feedback.
- Deleting the Side Panel bottom Undo bar, collapse handle, and obsolete
  related UI state and tests.
- Accessible status announcements, predictable keyboard order, confirmation
  focus restoration, and narrow Side Panel layout verification.
- Focused unit/component and headed extension evidence.

### Out Of Scope

- Changing Task 010's outcome vocabulary, all-successful-mutation invalidation
  policy, same-Field Picker Undo policy, or Repository semantics.
- Changing Picker layout or behavior.
- Changing Side Panel destinations, Sites/Templates information architecture,
  permissions, data models, or browser integration boundaries.
- Persistent result history, queued notifications, timers, toasts, telemetry,
  network features, or new dependencies.

## Slices

| Slice | Deliverable | Required exit evidence | Status |
| --- | --- | --- | --- |
| 1. Shell And Region | Remove the standalone header; add the non-interactive navigation icon and one global result region below the scrollable content. | Component tests cover navigation semantics, icon non-interactivity, bottom-region placement, and no duplicate header. | Complete |
| 2. Unified Results And Undo | Route existing Side Panel outcomes and Undo into the global region; remove bottom Undo/collapse behavior. | Component tests cover result replacement, cross-page persistence, Undo completion, and silent invalidation. | Complete |
| 3. Accessibility And Narrow-Width Review | Verify focus restoration, status announcements, keyboard access, and usable 360px/420px layouts. | Focused component evidence, headed extension regression, and user hands-on review on 2026-08-25. | Complete |

## Acceptance Criteria

- The standalone Side Panel title/header and every bottom Undo/collapse
  affordance are absent.
- The only Side Panel result presentation is below scrollable destination content and remains visible at the bottom of the Side Panel.
- The app icon is visible but has no interactive role, accessible action, or
  keyboard stop.
- At most one current Side Panel result is visible. It remains through
  destination changes and is replaced or invalidated only by the established
  Task 010 rules.
- Reversible Templates operations expose their existing Undo in the global
  region; successful Undo reports completion without offering another Undo.
- A successful confirmation returns focus to its trigger and announces the
  result without moving focus.
- The region and navigation remain readable, operable, and non-obscuring at
  narrow Side Panel widths.

## Required Review

Review Spec and Project Standards separately. Adversarial coverage must include
operation result followed by cross-destination navigation, a later mutation
while Undo is available, keyboard-only confirmation and Undo, screen-reader
status announcement, long result copy, and 360px/420px widths.
