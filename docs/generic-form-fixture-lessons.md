# Generic Form Fixture Lessons

## Purpose And Authority

This document transfers lessons from an authorized local, simulated assessment
form fixture suite. It is evidence for generic compatibility research only.
It is not a target-site integration guide, a source of selectors, a field
schema, or authorization to implement a feature.

Use it only with an accepted and explicitly authorized Task 013 or later task
that owns generic form compatibility. The governing product rules remain
`PROJECT.md`, `CONTEXT.md`, `AGENTS.md`, the active Task Contract, and the
current `DEVELOPMENT.md` status.

## Local Fixture Entry Point

The local fixture service is outside the FillNest runtime and must never become
a FillNest dependency. When it is intentionally started from the archived
earlier prototype workspace, one representative page is available at:

```text
http://127.0.0.1:8000/sandbox/Client%20Profile%20Home.html
```

This is a local simulation only. Do not use a live customer portal, a shared
account, real records, or production data as compatibility evidence.

## Reusable Observations

### Field Lifecycle

- A page may create or reveal valid text-entry fields after a user changes a
  select, radio, or checkbox control.
- Repeated groups may be added after a user presses an ordinary page button.
  New groups can clone existing controls while changing their `name`, `id`, and
  label associations.
- Framework re-renders can remove and replace a previously recognized Field.
  Extension UI must not leave duplicate controls, stale listeners, or a Binding
  attached to a removed DOM node.
- A scan must be idempotent. Re-running it after a mutation should create at
  most one FillNest control for each still-eligible live Field.

### Eligibility And Safety

The fixture confirms the value of a narrow, conservative eligibility boundary:

- Consider only plain text-entry controls: `textarea` and ordinary `input`
  controls intended for text, email, telephone, search, or URL entry.
- Exclude password, OTP, payment, number, date, time, file, hidden, disabled,
  and read-only controls.
- Exclude selects, radios, checkboxes, and any control whose typed text is only
  an intermediate search value rather than the submitted field value.
- Do not inspect an excluded field value, create a Field Profile for it, add an
  extension marker or listener, or show a FillNest control next to it.
- A user must deliberately select a Template before insertion. Never submit a
  form, replace an entire value automatically, or infer that a nearby field
  should be filled as a side effect.

### Field Identity

- Labels alone are insufficient. The same label can occur in several repeated
  groups or conditional sections.
- A stable Field match should combine multiple site-neutral signals already
  within FillNest's field-identity model, such as page identity, control type,
  accessible label evidence, safe element metadata, local structural position,
  and an explicit user Binding where confidence is not high enough.
- Do not turn one observed attribute pattern into a universal rule. A matching
  signal must be justified across independent fixtures before it becomes a
  general product rule.
- When a page change makes identity ambiguous, fail closed: show no automatic
  association and require the user to Create or Bind deliberately.

### Grouped Contact-Like Fields

The fixture contains name, phone, email, and address fields that can appear in
several adjacent or repeated groups. The lesson is a boundary, not a feature:

- Spatial proximity, matching labels, or sequential field order does not prove
  that fields belong to one person or one record.
- A second phone field may have a different purpose; do not choose one based on
  position or a guessed regional phone format.
- Conditional fields can remain in the DOM while hidden. Hidden or ambiguous
  sibling fields must not receive a related fill.
- V1 FillNest remains single-field. Structured Contacts and multi-field fill
  require a separate product decision, explicit mapping/review, overwrite,
  partial-failure, preview, and validation rules before any implementation.

## Suggested Generic Test Cases

Add equivalent FillNest-owned fixtures and tests only when an authorized task
needs them. Do not copy source markup or selectors from the archived project.

1. A text Field appears after a trusted user changes a conditional control.
2. A repeated group is added, containing a second Field with the same visible
   label as an earlier group.
3. A framework-style re-render replaces an eligible Field after it has received
   a FillNest control.
4. A mixture of eligible and excluded controls proves excluded controls receive
   no value read, profile, marker, listener, control, or insertion path.
5. A hidden conditional Field becomes visible and then hidden again without
   leaving orphaned FillNest UI.
6. Two adjacent contact-like groups prove that single-field Template insertion
   cannot affect a sibling Field.
7. A low-confidence Field identity requires explicit user Create or Bind rather
   than silently reusing Templates from a similar Field.

## Non-Negotiable Anti-Overfitting Rule

Every compatibility improvement must describe a generic problem class and use
site-neutral evidence. Do not add target-site terminology, host permissions,
page identifiers, selectors, schemas, label dictionaries, or matching
exceptions. If a rule has evidence from only this fixture suite, record it as a
working hypothesis and keep it out of production matching logic.
