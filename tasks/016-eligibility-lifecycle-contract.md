# Task 016 — Eligibility And Lifecycle Contract

**Version:** `0.1.2 Task 07`  
**Status:** Accepted — 2026-08-27

## Goal

Turn the useful findings from closed Task 013 into one site-neutral, executable
contract for future Eligibility and content-script lifecycle work. The user
value is that supported Fields remain convenient on modern dynamic forms while
ineligible, ambiguous, stale, and replaced controls never receive unsafe
extension behaviour. This task does not reopen Task 013 or change product code.

## Confirmed Decisions

- Field Eligibility remains conservative but useful: an ordinary text-like
  `input` or `textarea` is eligible when no high-confidence generic veto
  applies. Sensitive, special-purpose, hidden, disabled, read-only, or
  actually non-interactable controls are vetoed and receive zero extension
  touch.
- Eligibility is a runtime state. When a previously eligible Field becomes
  actually unavailable to the user, FillNest immediately removes its control,
  marker, per-Field listener, and insertion path. An ordinary unpinned Picker
  closes; the accepted pinned no-target exception is defined below. FillNest
  retains any durable user-confirmed FieldProfile and Binding.
- Actual unavailable state includes native and generic rendered/interactable
  evidence on the Field or its relevant ancestor; it is not limited to a
  native `hidden` attribute. The precise evidence must be generic and proven
  by the Task 017 fixture matrix.
- When the same live Field becomes eligible again, FillNest may restore its
  runtime behaviour. When a framework replaces it with a new node, the new
  node receives only fresh recognition; it inherits a Binding or effective
  scope only if that recognition is reliable.
- A Picker is permanently bound to its captured Target Field. If that Target
  Field is removed or replaced while an ordinary Picker is open, the Picker
  closes and cancels silently. The accepted pinned no-target exception is
  defined below. It must not retarget insertion, Create, or Bind to a new node
  that merely appears similar.
- A newly added FieldInstance in a repeated group automatically uses the same
  FieldProfile's direct or Shared effective Template scope only when generic
  evidence reliably proves the same logical Field. Dynamic row indexes, DOM
  order, and matching labels are runtime clues only; none is sufficient alone
  or may become persistent identity.
- An eligible but ambiguous repeated Field remains usable for deliberate
  single-Field Create and Bind, but receives no inherited Binding or scope.
  A normal manual Create or Bind never teaches a rule for future repeated
  instances.
- A future, separately contracted user-confirmed repeat-reuse rule may offer
  that deliberate expansion. It is recorded in `docs/next-version-discussion.md`
  and is not part of this Task.

## Lifecycle Contract

| Runtime state | Required behaviour |
| --- | --- |
| Candidate | Inspect only the permitted control, safety, semantic, structural, and controller metadata required for Eligibility. Do not read its value. |
| Eligible, reliably recognized | Maintain exactly one effective control, marker set, and handler. Resolve only the reliable FieldProfile's effective scope. |
| Eligible, unrecognized or ambiguous | Maintain ordinary single-Field interaction without inheriting any Binding, Shared scope, or repeated-instance relationship. |
| Temporarily ineligible | Immediately tear down every page-level FillNest surface and path for that Field while retaining durable data. |
| Detached or replaced | Tear down the old instance. A replacement is a fresh candidate, never an automatic Picker Target. |
| Restored or newly added | Reassess as a fresh candidate. Restore relationship state only after reliable recognition. |

Scanning, teardown, recovery, and reinjection must remain idempotent: one live
eligible Field has at most one effective FillNest control, marker set, and
handler. A host-page mutation or untrusted event must never create duplicate
page UI or bypass deliberate Picker action requirements.

## Pinned No-Target Addendum (2026-08-31)

When the user has explicitly enabled Keep Open (the Pin control), temporary
target unavailability or detachment does not dismiss the pinned Picker. It
instead enters a visible, safe no-target state with this message:

> No usable field is focused. Insert and Bind are unavailable until you focus
> a supported field.

In this state, every action that depends on a valid Target Field is disabled:
Insert, Create-and-Bind, Bind, Unbind, and Undo. Read-only Template browsing
and literal Search may remain available. The pinned Picker must not retain an
insertion or Binding path to the unavailable or detached Field.

When the user focuses a supported eligible Field, the pinned Picker may resume
with that Field as its Target under the ordinary recognition rules. A replacement
node never becomes its Target merely because it resembles the detached node;
the DOM Replacement Reliable-Recognition Addendum still controls Binding
recovery. This exception preserves the Pin's user-visible continuity without
weakening fail-closed field operations.

## DOM Replacement Reliable-Recognition Addendum (2026-08-31)

This addendum resolves the narrow replacement-recovery boundary required by
Task 018. It does not authorize repeated-Field reuse, a user confirmation
prompt, or any Site-specific exception.

A replacement Field may recover a detached Field's existing relationship only
when all of the following generic evidence is present:

- its stable logical Page identity is unchanged;
- its normalized Field identity has a non-empty generic semantic kind (email,
  phone, website, postal-code, address, or name); and
- its stable type, `name`, `id`, `autocomplete`, Form identity, and ancestor
  structure evidence exactly match the detached Field.

Any missing, ambiguous, or mismatched evidence makes the replacement a fresh,
unrecognized candidate. In particular, a plain text field with only a stable
`name` or `id` is not sufficient. This keeps the Task 017 `replaceable_field`
fixture fail-closed while preserving reliable recovery for generic semantic
Fields such as an email control on the same logical Page.

## Addendum F — A Removal During Navigation Is Not A Replacement (2026-09-10)

**Owning change:** Task 036 Addendum I. **Status:** implemented, verified by
the owner on Copilot, and the narrowing of the boundary above **accepted by the
owner on 2026-09-10**.

The boundary above applies to a Field swapped on **one** logical Page. Task 036
Addendum A.4 already excludes a removal whose evidence belongs to another Page.
Addendum I defines which Page a removed Field belongs to: the Page it was
recorded under if no address change has happened since, otherwise the Page
before the latest address change - a Field on screen when the address changed
came from there, however often it is touched afterwards.

**The consequence for this boundary, stated plainly:** a Field that survives a
navigation and is later replaced on the new Page, with no further navigation,
is treated as part of that navigation and not as a same-Page swap. Its
replacement is judged by ordinary recognition - an exactly equal Field identity
on an equal Page identity - without the semantic-kind requirement. A Field
first observed on the current Page is unaffected, and the Task 017
`replaceable_field` fixture stays fail-closed.

## Scope

- Define the evidence priority and lifecycle state model above for generic
  dynamic DOM, repeated Fields, hidden-state changes, DOM replacement, and
  recovery.
- Preserve the fail-closed rule: an ineligible Field receives no value read,
  FieldProfile, marker, listener, control, Picker, or insertion path.
- Allocate follow-on ownership: Task 017 supplies synthetic fixtures, Task 018
  implements the accepted boundary, and Task 019 independently validates it.
- Define current-logical-Page repeated-instance reuse only. Cross
  record-specific URL identity remains exclusively Task 014 and Task 020.

## Non-Goals

- Site-specific URLs, labels, IDs, selectors, schemas, or copied fixtures.
- Complex-control support, semantic guessing, multi-field filling, or code
  changes.
- User-confirmed repeat-reuse mappings, per-record persistence, conditional
  Template scopes, or changes to Shared Template Set semantics.
- Silent Picker retargeting, automatic whole-field replacement, automatic
  insertion, or submission.

## Acceptance

- This contract distinguishes confirmed existing product rules, confirmed user
  decisions, and deferred capability work.
- Task 017 can map each lifecycle state and transition to FillNest-owned,
  synthetic positive, negative, ambiguous, and zero-touch fixtures without
  copied target-site structure.
- Task 018 can make only the smallest generic implementation supported by that
  evidence; it may not convert an ambiguous repeated Field into a durable
  relationship.
- Task 019 can independently verify Website Access and activation boundaries,
  eligible and ineligible Fields, dynamic appearance, hidden-state teardown,
  DOM replacement, repeated-instance reuse, single-Field insertion, and no
  submission.
- The user explicitly accepts this contract before Tasks 017 or 018 begin.

## Addendum D — Focus-Driven `readonly` (2026-09-09)

**Status:** Complete — owner-reported, verified against the full Task 018
lifecycle matrix.

### The Defect

On `vue-typescript-admin-template#/example/create`, the "Search User" control
showed a FillNest control and activating it did nothing at all - the control and
everything with it simply vanished.

Element UI's `el-select`, and every typeahead built the same way, marks its own
input `readonly` whenever it does not have focus and clears it again on focus.
Opening the Picker moves focus to the Picker's own Search box. The Field blurs,
the component restores `readonly`, and all three eligibility checks -
`trackPosition` (every frame, so it wins), `handleFocus`, and
`reconcileLifecycle` - correctly concluded the Field was no longer eligible and
tore it down. FillNest removed the interface the user had just asked for,
because FillNest had taken the focus.

### What This Addendum Permits

A Field may stay attached while it is `readonly` **if and only if**:

1. `readonly` is the *only* obstacle - not disabled, not an unsupported type,
   not sensitive, not detached, not hidden (`isSupportedExceptReadOnly`); and
2. FillNest's own interface is what took the focus, judged at the transition.

Everything the Task 016 contract requires torn down is still torn down.

### Why The Judgement Is Made Once

After the transition the two cases are indistinguishable: a component reacting
to focus and a page that genuinely made a Field read-only both leave a
read-only Field under an open Picker. Only *causality* separates them, and
causality is only observable while it is happening.

So the evidence is a flag set at the moment FillNest's interface takes focus -
a `focusin` whose path is inside the overlay, which is the Picker's Search box
receiving focus as the Picker opens - and **consumed within one frame** by
`trackPosition`. The decision it produces is recorded against that one Field and
kept until the overlay moves to another Field or goes away.

A page-driven `readonly` toggle arriving later, with no focus change of
FillNest's, finds no evidence and tears down. That is SPEC-016-READONLY-01, and
it still passes.

Getting the timing right took the matrix to demonstrate. An earlier attempt
latched the evidence at `mousedown` on the control and never expired it, which
made SPEC-016-READONLY-01 fail - the flag from opening the Picker was still set
when the page toggled `readonly` minutes later. The failure was the point: the
suite drew the line this addendum had to stay behind.

### Insertion

`insertTemplate` now focuses the Field before judging it. A focus-driven
component clears its own `readonly` on focus, so the insertion lands in a
genuinely editable Field rather than being written into one the page considers
read-only. A Field that is read-only for any other reason is unmoved by the
focus and fails the same check as before.

### Evidence

`tests/e2e/typeahead-select-field.spec.ts` reproduces the component's shape -
an input that re-marks itself `readonly` on blur - and asserts both halves: the
Picker survives and inserts, and a genuinely read-only field on the same page
still gets no control at all. The complete Task 018 lifecycle matrix passes
unchanged, and the headed suite is 47/47.

## Addendum E — Accessible-Name Evidence For DOM Replacement

**Status:** **Complete and accepted on 2026-09-09** with its parent Task 036. `hasGenericSemanticKind` now answers true for an
element with no generic semantic kind and a non-empty accessible name; the
unchanged-Page-identity and exact-fingerprint conditions are untouched, and the
complete Task 018 lifecycle matrix passes unchanged.
**Origin:** Task 036 (Rich Text Field Support) grill, decision Q6.
**Requested by:** the project owner, 2026-09-09.

### The Gap

The accepted DOM-replacement addendum lets a replacement recover an existing
relationship only when three conditions hold together: unchanged stable logical
Page identity, a **non-empty generic semantic kind**, and an exact stable Field
fingerprint.

The second condition was written for ordinary forms, where words like "email"
or "phone" supply the kind. A rich-text composer has no such word: "Enter a
prompt here" maps to no generic semantic category, so `classifySemanticKind`
returns empty and recovery can never run.

The sites Task 036 targets are SPAs that replace their editor host routinely -
switching conversations, changing model, collapsing a sidebar. Under the
current rule every one of those events breaks the Binding, which would leave
the feature technically working and practically unusable.

### The Change

A **stable keyed hash of the element's accessible name** satisfies the
non-empty-generic-semantic-kind condition, for elements that have no semantic
kind and do have an accessible name.

The other two conditions are untouched. Recovery still requires unchanged
logical Page identity **and** an exact stable Field fingerprint - the
fingerprint already carries the ancestor chain, the ordinal and the structural
signature, so this addendum widens the evidence by one term and relaxes no
gate.

Nothing readable is persisted: the accessible name is hashed with the existing
Site-specific key, exactly as the Field semantic evidence already is.

### Why It Is Safe

The failure mode to fear is a replacement wrongly taking over an unrelated
relationship. For that to happen, two elements on the same logical Page would
need the same accessible name **and** an exactly equal stable fingerprint -
same tag, same structure, same ancestor chain, same ordinal. Two elements
matching on all of that are equivalent by every measure the product has; there
is no third element to confuse them with.

### What It Does Not Authorize

- Reliable repeated-FieldInstance reuse. That remains blocked on its own
  evidence addendum, exactly as the accepted DOM-replacement addendum states.
- Any relaxation of the logical Page identity or fingerprint conditions.
- Retaining the accessible name in readable form anywhere.

### Acceptance

1. A replaced element with no semantic kind, an unchanged Page identity, an
   exactly equal fingerprint and an equal accessible-name hash recovers its
   relationship.
2. A replaced element differing in accessible name, fingerprint or Page
   identity does not.
3. Storage holds only the keyed hash; no readable accessible name is written.
4. The complete Task 018 lifecycle matrix passes unchanged.
