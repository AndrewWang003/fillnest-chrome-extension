# Task 013 — Generic Form Compatibility Learning

**Version:** `0.1.2 Task 04`
**Status:** Closed without execution; findings retained for future Tasks — 2026-08-26

> The user closed this Task after the current discovery pass. Its observed
> scenarios are retained as generic evidence and future architecture work in
> `docs/generic-form-fixture-lessons.md` and
> `docs/next-version-discussion.md`. This contract was not implemented or
> accepted as completed; any future generic compatibility implementation needs
> a newly accepted bounded contract.

## Goal

Increase FillNest reliability on ordinary web forms by turning observed
compatibility failures into conservative, site-neutral Field Eligibility and
field-lifecycle rules.

## User Value

Users can rely on FillNest for normal text entry while it stays out of date,
masked, externally controlled, or otherwise special-purpose controls that only
look like plain text inputs.

## Confirmed Decisions

- A real website report starts compatibility research and becomes regression
  evidence, but never authorizes a site-specific production rule.
- A new production rule requires a page-neutral explanation and a separate,
  offline synthetic contrast fixture. The user is not responsible for finding
  two real websites.
- The task may improve generic handling of date/date-picker-like controls,
  masked or externally controlled text controls, dynamic creation and
  re-rendering, and repeated fields.
- A field that becomes hidden or disconnected after FillNest has presented a
  control must leave no actionable FillNest UI, Target Field, or insertion
  path. If it later becomes visible, it is reconsidered through ordinary
  Eligibility and Field Match rules; visibility alone must not restore a
  prior Binding.
- Existing supported native `textarea` and text-like input behavior remains
  the target; ordinary fields must not be excluded merely because metadata is
  weak or absent.
- High-confidence special-purpose or externally controlled evidence vetoes
  eligibility. Where such evidence is insufficient, preserve the existing
  conservative behavior rather than guessing a new field role.
- Automated tests use local, offline fixtures only. Real websites are manual
  discovery and post-fix verification sources, never an E2E dependency.

## Scope

### In Scope

- A reusable local compatibility fixture matrix and regression tests for the
  confirmed problem classes.
- Site-neutral Field Eligibility and lifecycle refinements justified by those
  fixtures.
- Tests proving both exclusion of special controls and preservation of normal
  native text fields, including dynamic/re-rendered, repeated, and
  visible-to-hidden-to-visible fields.
- FillNest-owned fixture coverage for repeated groups with the same visible
  label, proving ambiguous identity inherits no Binding without an explicit
  user Create or Bind.
- Directly affected product rules, task records, and current status.

### Out Of Scope

- `contenteditable`, combobox, iframe, rich-text, or custom-widget support.
- Site-specific selectors, URLs, names, branded terminology, schemas, or
  network-dependent automated tests.
- Template discovery/ranking changes, multi-field filling, accounts, sync,
  remote services, or a general form-autofill capability.

## Evidence Ladder

1. Preserve each reported failure as a regression scenario.
2. Identify a reusable native, semantic, structural, or controller signal.
3. Add a separate synthetic counterexample demonstrating that signal without
   the originating site's identifiers or structure.
4. Add the rule only when it preserves legitimate text-field behavior and
   fails closed for the special control. Otherwise record the scenario as an
   unresolved experiment, not product logic.

## Acceptance Criteria

- Every production change is explained through site-neutral evidence and has
  both a regression fixture and an independent synthetic contrast fixture.
- Supported ordinary text inputs and `textarea` controls remain eligible when
  no high-confidence veto applies.
- Date/date-picker-like, masked, or externally controlled controls supported
  by the evidence receive no FillNest field UI or value read.
- Dynamic/re-rendered and repeated ordinary fields remain independently safe;
  no stale Binding or field identity crosses to another control.
- A once-eligible field that becomes hidden or disconnected has no remaining
  actionable FillNest UI or insertion path. Reappearance is idempotent and
  cannot create duplicate UI or silently inherit a Binding when identity is
  ambiguous.
- Tests remain local and deterministic; no production code or test uses a
  site-specific selector or remote page.
- Full checks, headed extension regression, Spec/Standards audit, and
  hands-on review complete before acceptance.
