# Task 019 — Eligibility Lifecycle Acceptance

**Version:** `0.1.2 Task 10`  
**Status:** Complete and accepted — 2026-08-31

## Goal

Collect independent, reproducible hands-on evidence for the accepted generic
Eligibility and lifecycle behaviour. This is an acceptance task, not a repair
or contract-redesign task.

## Scope

- Run a Chrome-extension checklist for Website Access, Global/Origin
  Activation, eligible and ineligible fields, dynamic DOM, teardown/recovery,
  single-field insertion, and no-submit behaviour.
- Record steps, expected result, actual result, pass/fail/unverified state, and
  necessary screenshots or recordings.

## Non-Goals

- Production-site testing, real personal data, code changes, or redefining
  Task 016 while validating it.

## Acceptance

- Every checklist item is evidenced; an unverified item is never reported as
  passing.
- Any failure becomes a separately bounded repair task with reproduction
  evidence; it is not fixed during this acceptance task.

## Acceptance Evidence

- The user independently reproduced a Binding-recognition failure after closing
  and reopening a tab on a delayed-hydration form. The bounded Task 018 repair
  added a generic local regression and passed the complete check set.
- The user re-reviewed the repaired lifecycle behaviour and accepted Task 019
  on 2026-08-31.
