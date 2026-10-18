# Task 039 — Phase One Audit Residual Repairs

**Version:** `0.2.0`
**Status:** Implemented with automated evidence and independent review on
2026-09-11; accepted by the owner on 2026-09-11 after hands-on QA (R1-A-C,
C1-C3; R1-B and R1-C passed their re-test after the repairs recorded in Task
006 Addendum B). Addendum A (2026-09-15) extends C1 to native Fields; the owner
accepted it the same day after hands-on QA.

## Goal

Repair the four defects that remained after the Phase One audit at
`4327d88226d102f466ec4a49fe1502385dcdd254`, without broadening the accepted
Restore, Page identity, Eligibility lifecycle, or Rich Text Field contracts.

The audit evidence and precise reproduction boundaries are in
`tasks/evidence/phase-one-audit-2026-09-11/final-review.md`.

## Contract Ownership

- R1 remains Task 006 Addenda A/B behavior: a Restore with an unrecovered
  rollback fails closed in the current worker even when persisting the
  journal's `failed` status also fails. The original journal remains recovery
  evidence; only successful recovery or confirmed Reset releases the lock.
- C1 remains Tasks 016/036 behavior: metadata may consume a label's text but
  must exclude the Rich Text Field itself and any editable descendants. The
  user's existing field content is read only by the two already-authorized
  explicit actions.
- C2 remains Tasks 014/020 behavior: query state inside a route-shaped hash is
  classified by the same privacy and volatility rules as outer query state,
  but carries a distinct namespace so outer and fragment queries cannot
  collapse together. Existing non-hash and query-free hash keys remain byte
  identical.
- C3 remains Tasks 016/018/036 behavior: lifecycle reconciliation includes a
  previously marked Rich Text Field after it ceases to be an editing host, so
  the marker and runtime behavior are removed immediately.

## Non-Goals

- No new Restore recovery exit, retry policy, storage format, or archive
  version.
- No accessible-name algorithm implementation beyond excluding editable field
  content from the existing accepted sources.
- No migration or merging of existing Page Profiles.
- No new recurring scan, browser API, dependency, selector, or site-specific
  behavior.
- No change to the accepted presence-only Rich Text insertion verification.

## Acceptance

1. A live worker blocks the next mutation after target write failure,
   rollback failure, and failed-journal write failure; the original journal
   and prior state remain intact.
2. Wrapping and referenced labels retain their non-editable label text while
   excluding Rich Text Field content and other editable descendants from safe
   metadata and observed titles.
3. Hash-route semantic queries distinguish Pages; volatile/tracking hash
   parameters remain ignored; outer and hash query locations are distinct;
   all frozen keys remain unchanged.
4. Changing an unfocused marked Rich Text Field to `contenteditable=false`
   removes `data-fillnest-field` through the ordinary mutation lifecycle.
5. Relevant targeted tests, `npm run check`, and the complete headed
   Playwright suite pass. Accessibility semantics and controls are unchanged;
   no new manual accessibility claim is made.

## Verification Boundary

The automated gate covers deterministic worker fault injection, DOM metadata,
URL identity, and content-script lifecycle behavior. It does not certify every
host page, real assistive technology, or storage failure combination. Owner QA
remains separate from implementation completion.

## Implementation And Evidence

- R1 sets the in-memory rollback-failure latch before the best-effort journal
  status update. The live-worker regression injects target, rollback, and
  journal-update failures and proves the next mutation is blocked while the
  original `in_progress` journal retains the prior data.
- C1 walks label sources and refuses editable subtrees before reading their
  text nodes. Wrapping labels, referenced labels, internal whitespace, and
  multi-source `aria-labelledby` whitespace have regressions so existing
  identity semantics remain frozen outside the defect.
- C2 frames a hash-route query as `#?` after the normalized outer query. Outer
  query output cannot emit that delimiter; regressions cover semantic values,
  volatile/tracking exclusions, prefix collisions, mixed-source collisions,
  and a frozen query-free hash key.
- C3 retains marked mutation targets and marked descendants for one final
  lifecycle pass. Regressions cover both a host changing itself to
  `contenteditable=false` and a child ceasing to be an editing host when its
  ancestor becomes editable.

Fresh verification on the final working tree:

- `npm run check`: passed; 74 test files / 1,017 unit tests, documentation,
  localization, exports, typecheck, lint, production build and closed-root
  gates all passed.
- `npm run test:e2e`: 71 passed; one opt-in lifecycle benchmark skipped by
  design; 2.4 minutes.
- Independent review: no remaining Critical or Important findings; ready to
  merge. Owner QA remains distinct from this automated/review result.

## Addendum A — A Control's Text Inside A Native Field's Label (2026-09-15)

**Status:** Implemented on 2026-09-15 at the owner's request, after an audit
of everything since `4327d88`; accepted by the owner the same day after
hands-on QA with `demo/phase-one-audit-qa.html` (a pre-filled and a mirrored
textarea are named by their labels alone). Ownership is
unchanged: this is C1's rule, and it remains Tasks 016/036 behavior.

**The defect.** C1 walked label sources only for a Rich Text Field. A native
`<input>` or `<textarea>` still read each of its labels through
`label.textContent`, which takes in the text of every control inside the
label. A `<textarea>`'s text is its content: filled in by the server on an
edit form, or the typed value itself where a framework mirrors the value into
`defaultValue` (a controlled React textarea does so on every keystroke). So
`<label>Notes <textarea>…</textarea></label>` reported the label as
"Notes …", and that text became:

- the Field's `observedTitle`, stored in its Field Profile, carried in a
  Backup Archive and shown on the Sites and Templates pages;
- a `text:` feature in Logical Page evidence, hashed with the Site key and
  stored as an observation;
- evidence for semantic classification and eligibility.

That contradicts AGENTS.md (no Field value read outside the two explicit
actions) and the privacy policy ("It never stores what you typed into a
field").

**The repair.** One label reader for every Field:
`readLabelMetadataText` in `src/fields/dom-field.ts` now serves native labels
and group names as well as Rich Text labels. It skips the Field itself, any
`<textarea>` and any editable subtree before reading their text nodes. A
label that holds no such control reads exactly as its `textContent` did, so
no existing Field identity changes shape; only a key that had taken in a
control's text changes, which is the point. A fieldset's legend and a group's
`aria-labelledby` source are read the same way (`readGroupText`).

**Evidence.** Each regression failed before the change:

- `tests/unit/dom-recognition.test.ts` ("Task 039 Addendum A"): a wrapped
  textarea's server content, and a typed value mirrored into its text, stay
  out of label metadata, the observed title and recognition evidence; a
  contenteditable and a second textarea inside a native Field's label stay
  out; Logical Page evidence and the Field identity key are the same whether
  a wrapped textarea (and one inside the legend) is empty or filled. A guard
  confirms labels with no control inside read exactly as before.
- `tests/unit/rich-text-field.test.ts`: a textarea inside a Rich Text Field's
  label stays out of its accessible name and title.

happy-dom's `labels` returns a growing list for a wrapped control that has an
`id` (1, 2, 3 … entries on successive reads); the tests avoid that shape.
Chrome is unaffected.
