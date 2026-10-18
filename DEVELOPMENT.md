# Development Status

## Current status

FillNest's accepted V1 validation MVP remains a local-first Chrome extension
for deliberate single-Field plain-text Templates. The current version is
`0.2.0`, a Beta candidate, not a published Chrome Web Store release.

The Phase One audit is complete at `4327d88226d102f466ec4a49fe1502385dcdd254`
on branch `fix/phase-one-audit-repairs`. Task 039 has repaired its four
remaining defects with automated evidence and an independent review, and the
owner accepted it after hands-on QA on 2026-09-11. Release acceptance and
store submission remain pending. See the
[final audit report](tasks/evidence/phase-one-audit-2026-09-11/final-review.md)
for the original counterexamples and
[Task 039](tasks/039-phase-one-audit-residual-repairs.md) for the bounded repair.

Task 041 (accepted 2026-09-14) refines the general development workflow -
source evidence, risk and delivery, Demo decisions, tool readiness, commit
authority and manual QA handoff - without changing product behaviour or any
FillNest-specific rule. Work that starts on `main` moves to a task branch and
is merged only at the owner's request.

## Task 039 repairs (accepted 2026-09-11)

| ID | Priority | Implemented repair | Automated evidence |
| --- | --- | --- | --- |
| R1 | P1 | Latch Restore recovery failure before the failed-status journal write | Live worker blocks later mutation and preserves the original journal through all three injected failures |
| C1 | P1 | Exclude Rich Fields and editable descendants before reading label metadata | Wrapping/referenced label, title, identity-whitespace and multi-source regressions |
| C2 | P2 | Classify hash-route queries in a disjoint `#?` source frame | Semantic, privacy-filter, frozen-key, prefix-collision and mixed-source regressions |
| C3 | P2 | Reconcile previously marked mutation targets and descendants after support is lost | Direct `contenteditable=false` and ancestor-becomes-editable lifecycle regressions |

The implementation and independent review gates completed with no remaining
P0–P2 review finding, and the owner accepted Task 039 after hands-on QA on
2026-09-11. That does not by itself accept the release; the remaining release
work is listed under "Pending acceptance and release work" below.

## Accepted fixed points and active decisions

- Tasks 001–009 are the accepted MVP baseline; Task 007 acceptance was
  `26fab0b`, and whole-product Reset was accepted on 2026-08-24.
- Template management, deliberate local Search, Site management and explicit
  Website Access remain implemented. Access removal never silently deletes
  business data; Site Affinity is organizational.
- Tasks 014/020 implement user-confirmed same-Origin Logical Page Matching.
  Task 016 and Tasks 017–019 own generic eligibility/lifecycle rules and
  fixtures. Task 013 was closed without execution.
- Tasks 015/021 implement explicit shared lists. Task 024 permits explicitly
  confirmed cross-Site local relationships. Tasks 026/027 add per-Field
  Overrides/Exclusions and private audience. These are local relationships,
  not accounts, team sharing or synchronization. Task 040 (accepted
  2026-09-11 after Chinese owner QA) moves their management to the Templates
  page's `Shared Sets` tab and removes Move.
- Leaving or ending sharing preserves each Field's effective Template list
  (Task 021 B). Joining unions the joining Field's eligible Templates,
  including across Sites; the original A/B/C disappearance case has regression
  coverage. One-member Sets dissolve with a survivor snapshot.
- The latest storage audit confirms repairs for cleanup/privacy, copy,
  membership/Undo, Logical Page provenance, and archive roundtrip defects.
  Task 039 also closes the remaining R1 recovery exception in the running
  worker when the failed-journal status write itself fails.
- Task 036 rich-text support is accepted (2026-09-09); subsequent G–J repairs
  were owner-verified on 2026-09-10. Eligible editing hosts support plain-text
  insertion, tiered Binding and explicit clipboard fallback.
- Task 037 localization is accepted after Chinese owner QA (2026-09-11).
  English is the source catalogue; a language adds its catalogue, registry
  entry and locale directory. Never translate user data.
- Task 038 movable status is accepted (2026-09-10). Its pointer-only movement
  is an explicit contract boundary.
- Task 030 requires closed production Shadow Roots. Only `dist-e2e` uses
  open roots for inspection; the build gate and production isolation test
  remain required. No other production behavior differs for E2E.
- The baseline remains MV3, TypeScript 5.9, npm/Vite/Preact, local versioned
  Repository storage, typed messages, Vitest/Playwright and ESLint.
- No backend, remote product feature, AI, account, sync, whole-page filling
  or automatic submission is authorized for V1.

## Owner QA, 2026-09-11 (second session)

Using the QA guide and `demo/phase-one-audit-qa.html`: R1-A, R1-B, R1-C, C1,
C3, the input cap except B4, all nine sharing-icon checks, and Task 021
Addendum A passed. Three findings, each repaired with a regression that failed
first:

- R1-B: the locked Popup offered no way into the Side Panel, so Reset was
  unreachable (Task 006 Addendum B, point 4).
- R1-C: a restored page-status position applied only after a page reload
  (Task 006 Addendum A).
- B4: a Chinese input-method composition was never cut at the limit in
  Chromium (Task 035 Addendum A).

C2 reported the Template still offered on the second route. It does not
reproduce on a clean profile, where that route instead offers a Logical Page
Review ("looks like a page you have filled before"); the owner is checking
whether a match was confirmed or a rule already existed.

## Latest verification

On the 2026-09-16 working tree, after the audit repairs (Task 039 Addendum A,
Task 033 Addendum E), Task 024 Addendum E, Task 037 Addendum F and the
listing's privacy-policy and picture work (Task 033 Addenda F and H):

- `npm run check`: passed 91 files / 1,110 unit tests, typecheck, lint,
  documentation, localization, exports and production build gates.
- `npm run test:e2e`: 84 passed, two opt-in specs skipped by design - the
  lifecycle benchmark and the store screenshots - including the exact-origin
  restart and revocation scenario the tab-query change touches.
- `npm audit`: no known vulnerability.
- `npm run verify:store`: one item left, and it is a step rather than a
  blocker - `output/fillnest-0.2.0.zip` is older than `dist/`, so
  `npm run package` runs again just before uploading. Icons, version, the
  published privacy policy, five screenshots and the promo tile are ready.

Task 039's own red/green evidence, independent review and storage
revalidation are recorded in its contract and the
[final audit report](tasks/evidence/phase-one-audit-2026-09-11/final-review.md).
Automated checks do not replace pending owner QA or establish absence of all
bugs.

## Pending acceptance and release work

- Owner hands-on QA on 2026-09-11 accepted Task 039, Task 040, Task 035
  Addendum A, Task 021 Addenda B and C, Task 006 Addenda A and B, Task 038
  Addenda A and B, and the Task 003 addenda of that day (pinned insertion
  selection; the full-text flyout, rename editors and pinned-Picker drag).
  Task 021 Addendum A was superseded by Task 040. Every QA finding was
  repaired with a regression that failed first, and re-tested by the owner.
  Restore not returning Chrome Website Access is by contract (Task 006).
- Task 023 B5 VoiceOver/zoom owner evidence is complete (2026-09-08).
  Task 025's separate deferred manual acceptance is not closed by that session;
  the owner deferred its VoiceOver session again on 2026-09-11.
  Task 026's broader headed coverage gap remains recorded in its contract.
- Task 042 (first-use tips, the feedback address, and the Popup/Overview
  switches with their status line) and Task 037 Addendum E were accepted after
  the owner's hands-on QA in Chinese on 2026-09-15.
- Task 033 B owns Unlisted Beta distribution. The owner's icon set is applied,
  the toolbar icon on a white ground in every theme (Task 033 D). The privacy
  policy is published and its drift is checked (Addendum F); the listing text
  is decided (Addendum G); the five screenshots and the promo tile are made by
  `npm run shots:store` from FillNest's own demo page, and `verify:store`
  reads them (Addendum H). What remains is the package, the upload and the
  store's forms, all at the owner's hand. Submission has not been performed.
- An audit of everything since `4327d88` (2026-09-15) found two privacy
  defects, both repaired with regressions that failed first and accepted by
  the owner after hands-on QA the same day: a native `<textarea>`'s own text read through the label wrapping
  it and stored as the Field's title (Task 039 Addendum A; fixture section in
  `demo/phase-one-audit-qa.html`), and the permission lifecycle reading every
  open tab's address on each worker start and revocation (Task 033 Addendum
  E, which also makes `verify:store` name a stale upload package).
- Task 044 (the mark in the Picker header; Back in the top-left corner of
  the Field list) and Task 045 (scroll containers keep their scrollbar's
  room) were accepted after the owner's hands-on QA on 2026-09-15, with
  `demo/picker-header-scroll-qa.html`. During it the owner found a Field-list row, or its page Field,
  left looking selected; Task 024 Addendum E repairs both paths and was
  accepted after the owner's re-test. Task 037 Addendum F translates the
  share Finder's `more…` and closes the gate's blind spot that missed it.
- `tasks/README.md` was reconciled with the owning contracts on 2026-09-11,
  including Tasks 037/038 shipping in `0.2.0` rather than `0.2.1`. Owning
  addenda and explicit acceptance evidence remain the authority.
- A hands-on QA guide for the open items, with its fixture page, is
  `demo/phase-one-audit-qa.html` (see `demo/README.md`).

## Known product boundaries

- Archive size is deliberately limited to 3 MiB UTF-8. Restore replaces local
  business data and does not grant Website Access. Reset clears verified
  access and local state and returns activation to Paused.
- Rich insertion checks for Template presence after insertion. A refused
  duplicate may appear successful when the same text was already present.
  This accepted Task 036 limitation is distinct from C1.
- Rich Fields without stable attributes use accessible names for identity;
  localization can change that identity. Task 036 A.6/A.7 fixture gaps retain
  their recorded hands-on/argument evidence.
- Logical Page observations are restricted to eligible bound-page evidence
  and Site-keyed hashes. Index/record routes with different segment counts and
  unrelated root-level slugs remain separate by decision. Generic manual page
  pairing is future scope.
- Reliable repeated-Field reuse requires the still-missing Task 016 evidence
  addendum. General custom-control support remains separately scoped.
- Task 035 R7 performance repair is complete; this audit did not rerun the
  opt-in benchmark or conduct new assistive-technology/forced-colors sessions.
- Initiating a one-Template share from an unshared Field was declined on
  2026-09-09. Future work in the
  [discussion queue](docs/next-version-discussion.md) is not execution authority.

## History and reference order

Use PROJECT.md and CONTEXT.md for product/domain rules, AGENTS.md for working
rules, and the owning contracts under tasks/ for scope and acceptance.
The previous long status document is preserved as
[historical evidence](tasks/evidence/phase-one-audit-2026-09-11/development-before-audit-close.md);
it contains superseded states and is not the current handoff. Release history
belongs in CHANGELOG.md and major decisions in docs/adr/.
