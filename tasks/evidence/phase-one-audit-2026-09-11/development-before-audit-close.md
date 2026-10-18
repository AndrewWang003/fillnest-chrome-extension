# Development Status

## Current Status

The FillNest V1 validation MVP is complete and accepted after the user's hands-on review on 2026-08-24. The current version is `0.2.0`, the Chrome Web Store Beta candidate (Task 033); the post-MVP baseline was `0.1.1`, and Tasks 001-009 are complete and accepted. The user confirmed that the implemented MVP meets its intended product-validation needs; reported MVP defects were either repaired under their owning contracts or deliberately deferred to later-version discussion.

FillNest V1 remains a local-first Chrome extension, not yet a Chrome Web Store release or commercial product. It provides deliberate, single-field plain-text Template creation, discovery, insertion, and Binding; Website Access and activation controls; Template, Site, and Settings management; Backup, Restore, and verified whole-product Reset.

## Accepted Fixed Points

- Task 001: engineering foundation, accepted at `a81491d`.
- Tasks 002-006: interaction surfaces, Template management, Site management, deliberate Search, and Backup/Restore, complete and accepted.
- Task 007: integrated V1 acceptance and hardening, accepted at `26fab0b` (2026-08-21).
- Task 008: behavior-preserving architecture maintenance, complete and accepted.
- Task 009: Factory Reset, accepted after automated and hands-on verification (2026-08-24).
- Task 010: Interaction Feedback Consistency, complete and accepted.
- Task 011: Side Panel Header And Notification Region, complete and accepted after automated remediation evidence and the user's hands-on review on 2026-08-25. The result region is anchored below scrollable Side Panel content, not directly below navigation.
- Task 012: Sites And Templates Information Architecture, complete and accepted after automated checks and the user's hands-on review on 2026-08-25. It replaces historical `No Access` Site display with an authorized-Sites-only view and changes the explicit Sites-page removal action to a rollback-safe Remove site transaction.
- Task 013: Generic Form Compatibility Learning, closed without execution by
  user direction on 2026-08-26. Its discovery findings remain in
  `docs/generic-form-fixture-lessons.md` and
  `docs/next-version-discussion.md`; they must not become target-site
  selectors, schemas, or matching exceptions. Any future implementation needs
  a new accepted bounded contract.
- Task 014: Logical Page Identity is complete and accepted on 2026-08-31.
  It establishes user-confirmed, same-Origin Route Pattern plus keyed semantic
  signature rules; raw page text and values remain unpersisted. Task 020 owns
  implementation, including the Picker status-strip review flow, atomic
  migration, relationship separation, and archive compatibility. A bounded
  early repair for numbered static document filenames remains separate from
  that implementation contract.
- Task 015: Share Templates, accepted on 2026-09-01. It is an explicit,
  Site-local Shared Template Set feature; its prerequisite (Task 014,
  complete and accepted) is satisfied. Execution proceeds through Task 021
  in four ordered slices. Its contract is `tasks/015-share-templates.md`.
- Task 016: Eligibility And Lifecycle Contract, accepted by the user on
  2026-08-27. It defines generic dynamic Field eligibility, teardown,
  recovery, and reliable repeated-FieldInstance reuse without reopening Task
  013 or adding code.
- Task 017: Eligibility Lifecycle Fixture Matrix is complete and accepted on
  2026-08-31. It provides independently reproducible E2E activation,
  observable zero-touch evidence, repeat-reorder coverage, and six named Task
  018 expected-red specifications. A Task 016 addendum remains required before
  any reliable-repeat positive fixture can be named or implemented.
- Task 018: Generic Eligibility And Lifecycle Improvement and Task 019:
  Eligibility Lifecycle Acceptance are complete and accepted on 2026-08-31.
  The accepted evidence includes generic delayed-hydration Binding recovery,
  DOM replacement protection, and the pinned safe no-target state.
- Task 016 DOM replacement addendum: accepted on 2026-08-31. A replacement
  may recover an existing relationship only with unchanged stable logical Page
  identity, a non-empty generic semantic kind, and an exact stable Field
  fingerprint; it does not authorize repeated-Field reuse.
- Task 020: Logical Page Identity Implementation, complete and accepted on
  2026-09-01 after the user's hands-on verification of the Inline Picker
  Review/Confirm flow and the Sites `Stop matching` action. It delivers the
  Task 014 contract in full: the repository/migration layer, candidate
  resolution/confirmation/separation, both new UI surfaces, and
  Backup/Restore and Site Data cleanup for rules, provenance, and Site keys.
  Task 010 carries a bounded addendum from this work narrowing its mutation-
  invalidation boundary to user-initiated mutations.
- Task 021: Shared Template Sets Implementation, complete and accepted on
  2026-09-02 after the user's hands-on QA. It delivers explicit, Site-local
  named shared Template lists, their Picker and Site-management flows, and
  the approved non-lossy departure and automatic one-member-set dissolution
  behaviour. Future defects are bounded repairs under the owning contract.
- Task 022: Current-State Documentation Alignment, complete on 2026-09-01.
  Corrected `README.md`'s stale seven-Task delivery status and
  `docs/adr/0002`'s status field, which its own text said should have become
  `accepted` once Task 002 shipped. No other inconsistency found. See the
  Task 022 record for the exact evidence behind each change.
- Task 024: Compatibility Candidate Suggestions is complete; its accepted
  contract now includes the post-completion current-page recognition, Field
  User Alias, and unified Link-scope corrections. It is a local, deterministic Field-discovery and
  explicit-Link feature that extends Shared Template Sets across Sites only
  after a scope confirmation. The resulting local relationship is
  bidirectional across all members; it does not add Contacts, multi-Field
  fill, remote AI, accounts, or network synchronization.
- Task 026: Shared Template Per-Field Overrides is complete and accepted by
  the project owner on 2026-09-07 (implemented 2026-09-05). It is the bounded successor to
  the prior all-members-same-list Shared Template Set rule: a Set member may
  explicitly override or exclude one shared Template for one Field, without
  Git-style version control or automatic restoration. Stable per-slot
  identity survives a Set-level Template swap; the Picker and Side Panel
  `This tab` Field-card expose the same scope-accurate `Save`/`Save
  everywhere`/`Save for shared fields`/`Save for this field` choices
  (calculated from actual effective consumers, never Site Affinity count); a
  cross-Site merge remaps every Override/Exclusion from a deduplicated slot
  onto the surviving canonical slot; Backup/Restore, Undo, and deletion
  impact all treat Slots/Overrides/Exclusions as first-class local business
  data. See `tasks/026-shared-template-per-field-overrides.md` for the full
  contract and acceptance criteria.
- Task 027: Explicit Template Audience Scope is complete and accepted by the
  project owner on 2026-09-07 (implemented 2026-09-06); its Addendum B is
  still pending acceptance, see Known Boundaries. It closes two real gaps the
  Task 026 QA session found: binding a search-found Template from a Shared
  Set member's Picker always affected the whole Set with no narrower choice,
  and a Field's own private ("Save for this field") slot could leak to a
  brand-new member added later, or to an unrelated Set through a merge, with
  no way back. `SharedTemplateBindingRecord` gains an optional
  `ownerFieldProfileId`: present, it is a Field-only relationship the
  resolver enforces before any Override/Exclusion logic, checked ahead of
  every membership mutation (add member, move, merge, cross-Site merge,
  restore). New commands: `bindTemplateToFieldOnly` ("Bind to this field",
  alongside the renamed "Bind to Shared Set"), `promoteFieldOnlySlot`
  ("Share this version", same-Set), and the composite
  `joinSetAndShare`/`mergeSetsAndShare` for a target in a different Set or
  unshared - the repository operations are atomic and fully Undoable. The
  same-Set Picker/Side Panel flows are wired; the cross-Set/unshared
  Join/Merge-and-share entry point is not yet wired into the Picker. An
  external audit of this implementation on 2026-09-06
  found 5 real correctness bugs in the initial pass, all independently
  verified against the code and fixed the same day (see the 2026-09-06 audit
  entry below): Stop Sharing could orphan an owner-only slot; Move converted
  an owner's slot into a direct Binding that went dormant the instant the
  mover rejoined a Set elsewhere (fixed by migrating the slot itself into the
  destination Set instead); End Set discarded an owner-only slot's content
  outright instead of converting it; Merge deduped an owner-only slot against
  an ordinary slot for the same Template, either leaking it or dropping an
  ordinary member's access; and the merge Undo staleness check didn't compare
  `ownerFieldProfileId`, so a stale Undo could silently revert a promotion.
  Also fixed in the initial pass: `mergeSharedTemplateSets` was silently
  dropping `ownerFieldProfileId` for a Template exclusive to the removed Set,
  and the Backup/Restore archive path was dropping it on restore. `npm run
  check` and the full headed E2E suite pass. See
  `tasks/027-explicit-template-audience-scope.md` for the full contract and
  acceptance criteria.
- Task 037: Interface Localization And Simplified Chinese, **complete and
  accepted on 2026-09-11** after the owner's hands-on QA in Chinese. English is
  the core and each language a catalogue around it; the only Chinese in the
  source is `src/i18n/messages.zh-Hans.ts`. A new language is one `LANGUAGES`
  entry, its catalogue and its `_locales` folder.
- Task 036: Rich Text Field Support, **complete and accepted on 2026-09-09**, together with
  Task 016 Addendum E and Task 024 Addendum B. It makes an eligible
  `contenteditable` editing host a Field: eligibility is declared by
  `role="textbox"` or an accessible name, with grid, code and single-line
  structures excluded; Binding is tiered, so a host without an accessible name
  may be inserted into but not bound; insertion goes through Selection/Range
  and is verified on the next frame, with no synthetic key event ever
  dispatched; and a rejected insertion offers a clipboard copy that is written
  only on an explicit click. Named AI chat sites are acceptance evidence and
  never appear in code. Task 014 Addendum D landed with it, keeping advertising
  and analytics parameters out of the Page identity.

  Accepted with three things explicitly on the record: Addenda A.6 and A.7 have
  no fixture coverage and rest on argument plus the owner's hands-on re-test; a
  Rich Text Field with no stable attribute is identified by its accessible
  name, so a site that localizes that name loses the Binding; and a Rich Text
  Field's text is read once after each insertion to compute one boolean, a new
  and narrow read outside the two cases AGENTS.md otherwise allows.

## Current Product Decisions

- FillNest is local-only in V1: no backend, network product feature, account, sync, AI, or remote code.
- Users explicitly authorize Website Access per Permission Origin and explicitly choose each insertion and Binding. FillNest does not recommend Templates before deliberate Search, replace whole fields automatically, fill whole pages, or submit forms.
- Template Search is literal, local, and library-wide. Site Affinity is organizational only and remains after Website Access is removed.
- Backup is a versioned local JSON archive; Restore is strict all-or-nothing replacement and never grants Website Access. Archive input/output is limited to 3 MiB UTF-8.
- Reset FillNest is distinct from Template deletion: it removes verified Website Access, clears local FillNest data, and returns Global Activation to Paused.
- Pinned Picker lifecycle: when its Target becomes unavailable or detached, a
  user-pinned Picker remains visible only as a safe no-target surface. It
  disables Insert, Create-and-Bind, Bind, Unbind, and Undo until an eligible
  Field receives focus; it never retains an action path to the stale Target.
- Logical Page Matching is user-confirmed and Origin-scoped. It uses matching
  normalized Route Patterns plus two local semantic Jaccard thresholds of
  `0.85`, retaining only Site-specific keyed hashes of eligible Field
  label/name/group evidence. Rule separation preserves the merged Binding
  Template union and copies Binding usage counts to each separated Field.
- Two addresses are comparable only when they share at least one **literal**
  route segment. Confirmed by the owner on 2026-09-09: a root-level
  single-segment slug (`/some-product-name`) is therefore never offered as the
  same Logical Page as another, and this is deliberate - without the floor,
  every flat page on a Site would be one family, and a login and a registration
  page that both reduce to one email Field would be offered as a match.

## Latest Verified Checks

- 2026-09-11: **Two owner requests after QA, implemented; owner QA pending.**
  Template editors stop input at the content limit, cutting only what was
  just typed or pasted and waiting out an input method's composition (Task 035
  Addendum A). The Picker header's `Leave sharing` and `Share with…` are icon
  buttons with an immediate explanation on hover and focus (Task 021 Addendum
  C).

- 2026-09-11: **Owner hands-on QA of the audit repairs.** Passed: pinned
  Picker insertion, Logical Page merge then bind/unbind/delete and `Stop
  matching`, Task 014 Addendum E on Copilot, End sharing keeping each Field's
  Templates, and the Chinese 退出共享 copy. Reported: English full-Field and
  too-long notices in the Chinese Picker, and End sharing failing with
  "Shared Template Set not found" behind a dialog that stayed open. Both
  reproduce only with a mixed build - a freshly opened Side Panel against the
  previous service worker, and a tab still running the previous content
  script. On the current build they are correct in real Chromium (new
  `end-sharing-from-sites.spec.ts`, English and Chinese) and in
  `inline-picker-chinese-limits.test.tsx`, which fails on the pre-repair
  commit with exactly the reported English. The dialog now also closes once
  the Set has ended, even when its result cannot be read. Re-test after
  reloading the extension and every open tab.

- 2026-09-11: **The owner's decisions on the audit's questions, implemented;
  owner QA pending.** Leaving and ending a Shared Template Set both keep every
  Template each Field offered, and the Chinese label for leaving is 退出共享
  (Task 021 Addendum B). A failed Restore journal is retried at every startup,
  and Reset FillNest is the way out while it cannot be. The Side Panel reaches
  Settings when it cannot load, where it previously loaded forever (Task 006
  Addendum B). The version is `0.2.0`, and the store decisions are recorded in
  Task 033 Addendum B: Unlisted visibility; icons, screenshots and the Gist
  privacy URL are the owner's.

- 2026-09-11: **Pre-submission audit repaired; owner QA pending.** An audit
  against the contracts before the first store submission found five P1
  defects, seven P2 and three P3, each reproduced by a failing test first:
  a pinned Picker inserting over text the user never selected (Task 003
  addendum of 2026-09-11); a Field frozen after a confirmed Logical Page match
  (Task 020 Addendum A); Clear Site Data refused after any compatibility "No"
  and cross-Site Stop-sharing Undo refused (Task 024 Addendum D); Restore
  dropping `privateToField`, `observedTitle`, `insertionRejected` and the page
  status position, and a failed rollback not failing closed (Task 006 Addendum
  A, Task 038 Addendum A); Clear Site Data's survivor and Override-deletion
  Undo (Task 026 Addendum A); Move leaving a one-member Set (Task 021 Addendum
  A); private Bindings through a second Set and confirmations following focus
  (Task 027 Addendum F); English errors in the Chinese interface, acceptance 6
  never implemented (Task 037 Addendum D). Store readiness (Task 033 Addendum
  A): the package gate now admits the store icons, tab queries are limited to
  authorized Sites to match the listing wording, and the privacy policy was
  corrected against the code. `npm run check` passed 72 files / 987 unit tests
  and every gate; the complete headed suite passed 68 with the opt-in benchmark
  skipped, and the new `keep-open-insertion-selection.spec.ts` passed in real
  Chromium. Two questions the audit raised are under Awaiting A Decision.

- 2026-09-11: **Task 037 is complete and accepted by the owner**, after their
  hands-on QA in Chinese. Addendum C made `LANGUAGES` (`src/i18n/language.ts`)
  the one registry a new language is added to; Settings, `system` resolution
  and the catalogue tests read it, and an id without a catalogue does not
  compile. `AGENTS.md`'s Language Rules name the recipe.

- 2026-09-11: **Task 037 Addendum B implemented.** The owner's screenshots showed English in the Chinese build. The
  localization gate was extended first - quoted strings in ternaries, tuples,
  object properties and setters; JSX text beside expressions; multi-line and
  single-word template literals; `src/content` and `.ts` files - and reported
  192 findings; all are now catalogue entries. Sentences with emphasised parts
  use a new `RichMessage`; theme names live only in the catalogue; a Picker
  font defect (serif headings) is fixed. `npm run check` passed 947 unit tests
  and every gate; the headed suite passed 68, benchmark skipped.

- 2026-09-10: **Task 014 Addendum E implemented and reviewed; owner QA
  pending.** A long mixed-case token whose letter case is random is now
  `:record`, so Copilot-style ids with fewer than two digits no longer become a
  Page of their own. Revised after independent review: the first version took
  16 of 22 readable segments as records; this one takes none and misses about
  one random id in a hundred. Page Profiles and confirmed Logical Page Rules
  stored under such an address's old hashed segment are no longer found; their
  Templates remain searchable.

- 2026-09-10: **Task 036 Addenda G-J: implemented, reviewed, owner-verified.**
  The owner verified them on Copilot, ChatGPT, Claude and Gemini. Independent
  Spec and Project Standards reviews found no P0/P1; their P2 findings are
  repaired and recorded in the Addenda. Cross-Task effects carry their own
  addenda: Task 003 (Picker selection, Enter, editing) and Task 016 Addendum F
  (a removal during navigation is not a same-Page swap). The owner accepted
  Addendum F and Addendum H's behaviour change - pages no longer receive
  `focusin`/`focusout` for FillNest's own interface - on 2026-09-10.
  After the review repairs: `npm run check` passed 939 unit tests and every
  gate; the complete headed Playwright suite passed 68, opt-in benchmark
  skipped.

- 2026-09-10: **Task 036 Addendum F is implemented; owner QA is pending.** After the
  Addendum E revert, the owner confirmed Copilot returned to its earlier
  baseline: Templates appear most of the time and occasionally disappear;
  closing the Picker, waiting, and reopening restores them. A real-Chromium
  diagnostic reproduced both halves with a generic native `<textarea>` whose
  SPA moves the DOM before changing the URL. The stored Binding is intact; the
  Picker temporarily retains a context resolved for a transition-only Field
  identity because Addendum A.7 converges Page identity but not Field identity.
  Addendum F keeps the fresh-candidate boundary and identity keys unchanged,
  and adds mutation-driven Page-plus-Field context convergence with no polling
  or Site-specific rule. Its real-Chromium regression is green on the first
  Picker open and also covers native `form` reassociation plus external Form
  name/id changes and removal, while asserting that the Field Control remains
  live. After both independent review gates reported no actionable P0-P2
  findings, `npm run check` passed 65 files / 939 unit tests and every static
  and production-build gate; the complete headed Playwright suite passed 57
  with the existing opt-in lifecycle benchmark skipped. The owner's Copilot
  reload and repeat-use QA is the remaining acceptance gate.

- 2026-09-10: **Handover written.** `docs/agent-handoff-2026-09-10.md` carries
  what does not fit here: the reverted Addendum E and what a next attempt must
  explain, the three remaining blind spots in the localization gate (a quoted
  string in an object property, JSX text adjacent to an expression, and the
  theme constants), Task 033's owner-side blockers, and the standing rules.
  Task 038 is **accepted by the owner**; Task 037 is implemented and **not**
  accepted.

- 2026-09-10: **Task 036 Addendum E was shipped and reverted the same day.**
  `ee32b7e` is reverted in the tree. The carve-out it added - an element removed
  and re-added by a view rebuild is not a Field swapped underneath the user -
  had a fixture that failed without it, and still left the owner's product in a
  worse state than before: saved Templates were no longer offered in a
  conversation at all. The mechanism for that is **not understood**. The
  Addendum records what to examine first, including the untested side effect on
  `cacheableWithinDocument`. Do not re-apply it without an explanation.

- 2026-09-10: **Task 036 Addendum D - three vetoes, measured against six real
  composers.** The owner probed the AI chat products this Task did not target.
  Three composers were getting no control at all, each refused by a different
  rule.

  **D.1** A host declaring only `data-placeholder` was refused for having no
  name - while Task 024 Addendum C.1 had already decided that a Rich Text
  Field's placeholder is the best name it has, and `fieldObservedTitle` had been
  reading it since. A placeholder is now a declaration, and reaches
  `buildFieldIdentityKey` too, so the Field can be remembered as well as
  admitted. The accessible name keeps precedence in the key, so every Binding
  made before this keeps the key it was made under.

  **D.2** The Task 017 `combobox` veto is sound - a combobox commits a choice,
  so the typed text may never be submitted - but that is an argument about a
  single-value control, and all four fixtures protecting it are `<input>`. A
  `<textarea>` cannot be committing one choice. The veto now requires `INPUT`.

  **D.3** `aria-multiline="false"` is withdrawn on the owner's decision. It was
  written against an imagined single-line rich editor, never refused one, and
  the first thing it met on the open web was a 734x60 chat composer holding
  paragraphs. `SafeFieldMetadata.ariaMultiline` is deleted with it.

  Two probe captures were **not** defects (Templates differing between a
  new-chat screen and a conversation are two Pages), and one remains open: a
  composer that shows Templates and then does not, on one address, with
  byte-identical markup in all three samples. It needs the owner's observation
  of whether they vanish on navigation or at rest - two different faults - and
  a page-world probe cannot reach FillNest's state to settle it.

  939 unit tests; headed E2E green.

- 2026-09-10: **Task 037 Addendum A - the gate was too weak, and the owner
  found what it missed.** On the first look at the Chinese build: the
  Appearance section, System/Light/Dark, `Export Backup`, `Restore`, the Sites
  and Templates filters and sorts, `Move`, `Insert`, and every outcome message
  were still English.

  The gate letting them through is the more important half. It required **two
  words**, so every one-word button escaped it, and it only looked between JSX
  tags and at three HTML attributes - so it never saw a sentence built at
  runtime, which is what every outcome message is. It now counts a single
  capitalised word, template literals with two real words outside their
  interpolations, and the `label`/`ariaLabel` props that become a dialog's
  accessible name. It excludes identifier shapes instead, and a line may opt
  out with `i18n-exempt: <reason>` - one honest reason exists, and this product
  has three instances of it: `delete`, `reset` and `restore` are words the user
  must **type**.

  The strict version found **131** strings the loose one had been reporting as
  zero. All are translated: 936 unit tests, 52/53 headed specs.

  One product change came with it, on the owner's judgement: a theme swatch
  shows what a theme looks like, so the sentence under its name is gone.

- 2026-09-10: **Task 037 is implemented - all five slices - and Task 038 with
  it.** FillNest's interface now speaks the language the reader chooses, and
  the shell principle held exactly as promised: code, identifiers, keys,
  comments, commits and tests are English, and the only files containing
  Chinese are the language catalogues, where it is data in a lookup table.

  The mechanism is a typed catalogue whose interface is the contract, so a
  language that omits an entry is a `tsc` error rather than English text in
  front of someone who cannot read it. Entries are functions rather than format
  strings, because English inflects for number and Chinese does not. The
  language is its own storage key beside the theme's, with its own
  `LANGUAGE_CHANGED` notification rather than widening Task 034's accepted
  contract, and Reset clears it. The manifest's name and description go through
  `_locales`, which is the only way Chrome will resolve them.

  Translated: the Popup, the page status control, the Side Panel's shell,
  Overview, Sites, Templates and Settings pages, the Inline Picker, and the
  derived labels FillNest makes up for a Page or a Field. **Never translated:**
  a Template's content, a name the user typed, a Site or page name, or a
  Field's name derived from page markup - a headed spec asserts a Template
  written in English is byte-identical after switching to Chinese.

  `verify:i18n` now runs inside `npm run check` and fails on a user-visible
  string written inline in a component. It has its own fixture, because the
  first version reported TypeScript generics as rendered text and had to be
  taught the difference. It deliberately ignores single words: a false positive
  teaches people to silence a gate, which costs more than the miss.

  `AGENTS.md`'s Language Rules are replaced, as the contract proposed and the
  owner approved by directing this work. The first line - English for code,
  comments, identifiers, tests and commits - is unchanged.

  `npm run check` passes (932 unit tests) and the headed suite is 52/53 with
  the benchmark skipped. **Both Tasks await the owner's hands-on QA.**

- 2026-09-10: **Task 038 is implemented: the page status control can be moved.**
  Free positioning with viewport clamping, one stored position rather than one
  per Site, and pointer only - all three the owner's choices, the last recorded
  as a decision rather than an oversight because it means a keyboard-only user
  cannot move it. It reuses the pinned Picker's `clampPickerPosition` and its
  live-versus-saved split rather than inventing a second way to float
  something.

  Three things implementation settled. The position had to join the Backup
  Archive, or a Backup, Reset and Restore would quietly return the control to
  its corner; it is optional there, so older archives restore unchanged and
  `CURRENT_ARCHIVE_VERSION` does not move. The **default** stays expressed as a
  corner rather than a point, so an untouched control follows the corner as the
  window resizes instead of being pinned to whichever pixel it first occupied.
  And a drag that actually moved swallows the `click` that follows its
  `pointerup`, which would otherwise have toggled activation at the end of
  every drag.

  A headed regression drags it, checks a plain click still toggles, reloads,
  opens a second tab, and shrinks the viewport below the stored position.

- 2026-09-10: **Task 024 Addendum C.2 - two defects in C, both from the same
  blind spot.** The owner reported a share confirmation that would not go away
  on a Rich Text Field that cannot be bound.

  **Sharing is a form of remembering, and C did not know it.** A link creates a
  durable Field Profile and a Set membership, which a Field with no stable
  identity cannot carry - yet the offer and `Share with…` were both shown
  there. Both are now unavailable on such a Field, and the offer is not even
  requested.

  **And the confirmation was asked where nobody could see it.** The scope
  confirmation renders only in the Finder while C's offer lives in the list, so
  a single candidate needing confirmation set a `pendingLink` that nothing
  rendered - the click did nothing and the offer stayed put. The single path
  now opens the Finder on the same candidates first, and a completed link
  retires the offer.

  Both were reachable only by walking a case C was not designed around: C was
  built for the group on a normal Field. 913 unit tests and 50/50 headed E2E.

- 2026-09-09: **Task 024 Addendum C is accepted and implemented - and the
  automatic offer had no surface at all.** The addendum's premise was that the
  offer "goes quiet from the second candidate onward". Implementation found
  worse: `suggestedFieldProfileId` was computed by the repository and returned
  to nobody. No surface in the extension read it, at any candidate count, so
  the Confirmed Contract's automatic Suggested result had never been shown to a
  user.

  The addendum therefore does two things. It gives the offer a surface in the
  Picker's list view, showing the ordinary single candidate where the group
  rule does not apply - without which a user with exactly two composers would
  still see nothing, the common first state. And it adds the group: when every
  high-confidence, non-`No` candidate on the Site is a rich-text editing host
  and none of them is shared yet, all of them are offered at once, and one
  confirmation creates one Shared Template Set in one mutation with one exact
  Undo. Declining records the `No` for every pair, so a refused group is not
  re-offered one member at a time.

  The offer **names Fields and never previews a Template**. Recommending
  Templates before a deliberate Search is the one thing this product does not
  do, and an offer that previewed what it would bring would be exactly that. It
  also yields to a Logical Page candidate, because two questions at once is
  nagging.

  No site name is involved. The owner asked for an allowlist of the three AI
  chat sites; that was refused, and the structural `other: rich-text` kind from
  Addendum B does the same job on any site built the same way.

  **Verified on Claude by the owner the same day: one click shared everything.**
  What it also showed is that the Fields were listed by a name taken from the
  page's markup, which the user has never seen. Addendum C.1 answers that, in
  display only - identity is untouched. A Rich Text Field's title now prefers
  its **placeholder**, the one name the user has actually read (Gemini's box
  shows `Ask Gemini` and tells a screen reader `Enter a prompt for Gemini`); the
  offer names the page each box is on as well as the box; and the rename
  affordance stops calling it a "field" - `Rename this box. Only you see this
  name.`, with a hint saying it names the box you are typing in and where that
  name will appear.

- 2026-09-09: **Task 035 R7 is resolved: lifecycle mutation cost measured, then
  cut twenty-fold.** The method was the one R7 asked for - measure first. The
  same page runs the same churn twice, once on an Origin with no access (so no
  content script exists) and once with access granted and the Picker open, so
  the gap between them is FillNest's own cost and nothing else.

  Streaming text - 5,000 rewrites of one node, what a chat does while a reply
  arrives - costs nothing measurable: a `characterData` record's target is a
  text node, and the field search returns immediately for a non-Element.

  Structure churn cost **three times the page's own DOM work**: 500
  append-and-remove batches over a 2,000-node list took 44ms with FillNest
  against 14ms without. The reason was exact - every record was answered with a
  `querySelectorAll` over its target's whole subtree, and a growing list sends a
  thousand records whose target is the *same* container. Scanning each distinct
  target once per flush is the same answer for less work, because
  `queueLifecycleField` already collected into a Set. Overhead fell from
  **+29.6ms to +1.5ms** - from triple the page's own cost to a tenth of it.

  **Then a third shape, because the first two were too kind.** Asked whether
  more optimization was warranted, the honest answer was that a form-heavy page
  under churn had not been measured at all. Added - 200 Fields - it showed
  **+673ms, fifty-three times the page's own cost**. Two quadratic paths were
  behind it, both the same mistake: `readDomRecognitionEvidence` enumerates the
  whole page, which is right once and quadratic when a caller does it per
  Field. The replacement check did it for every added Field (522ms of the
  remainder on its own); the reconciliation, the Picker's page-candidate list
  and the Finder's highlight each did it per Field. All now share one
  `PageFieldSnapshot` per pass, built lazily. **673ms to 35ms.**

  The sparse `structure` number is now noisy - 4ms to 26ms across runs for 500
  batches - which is the measurement's own scatter, not a signal; the work left
  is too small to separate from the page. The form-heavy number is the one that
  mattered and it is unambiguous.

  The first measurement attempt measured the frame rate rather than the work,
  and is recorded in the contract because the mistake is easy to repeat.

  `npm run check` passes (902 unit tests) and the headed suite is 50/50,
  including the Task 018 lifecycle matrix that is the accepted evidence for
  this exact path. The benchmark is not in the suite - a timing measurement
  that gates a suite becomes a flake - and runs as `npm run bench:lifecycle`.

- 2026-09-09: **Task 036 is hands-on verified on all three named targets.** The
  owner confirmed Addendum A.7 on a clean install: Gemini's new-conversation
  page keeps its own Templates, and the Picker and Side Panel agree. ChatGPT
  and Claude had already passed in full.

  Seven QA passes produced eight repairs - control placement, keyboard capture
  by the page, three separate identity faults, a navigation treated as a Field
  replacement, advertising parameters in the Page identity, a stale Picker
  context, and an unsaved rename outliving its own action. Six have a fixture
  that fails when the repair is reverted; A.6 and A.7 rest on argument and the
  owner's re-test, and say so where they are recorded.

  One reported failure was not a defect but data written under an earlier
  build's identity - and one *diagnosis* of residue was wrong, corrected the
  same day when a clean install reproduced the failure. Both are recorded,
  because the lesson runs in both directions: an identity change orphans stored
  data, and "it must be residue" is a hypothesis that has to be tested rather
  than assumed.

  `npm run check` passes (902 unit tests) and the headed suite is **50/50**.
  **Task 036 awaits the owner's acceptance.**

- 2026-09-09: **Task 036 Addendum A.7 - the Picker's context must belong to the
  address on screen. The previous entry's "migration residue" conclusion was
  wrong.** On a clean install, Gemini's new-conversation page showed both
  surfaces disagreeing at the same moment: the Picker said `HISTORY` and
  offered `T-hist`, the Side Panel's `This tab` said `NEWCHAT` and offered
  `T-new`. The Side Panel recomputes from the tab's address, so it was right
  and the Picker was holding a context resolved for the page it came from.

  A.5 re-resolved at the moment the address changed - one attempt, which can be
  lost when the composer is briefly ineligible during the swap, or when
  `removeOverlay` bumps the focus revision and discards a resolution already in
  flight. The address marker had already advanced, so nothing tried again. The
  check is now an invariant instead of an event: the address the live context
  was resolved for is remembered and compared every frame, and repaired until
  they agree, throttled to one attempt per 300ms.

  **Not covered by a fixture, and recorded as such.** Three attempts at one
  failed: the ordering that would isolate it leaves the extension with no
  overlay at all, because a page that removes a focused Field tears the
  interface down and discards the resolution that focus started - existing and
  correct behaviour that puts the guarded state out of the fixture's reach. The
  repair rests on the argument and on the owner's re-test.

- 2026-09-09: **Task 036 passes on all three named targets.** The owner's fifth
  pass, on a clean install, named the two Gemini Fields differently and read
  the Picker's own header: the new-conversation page says `NEWCHAT` and offers
  `T-new`, and the Side Panel's `This tab` agrees. ChatGPT and Claude had
  already passed in full.

  The Gemini failure reported the pass before was **data written under an
  earlier build's identity**, not a defect. That diagnosis came from the code:
  `/app` and `/app/:record` are different Page identities, no Logical Page rule
  can match across them, and `resolveFieldContext` scopes its Field lookup to
  the Page Profile - so the resolution path could not produce what was
  reported. A fifth speculative repair was declined in favour of asking for the
  one observation that distinguished residue from defect.

  The 250ms address poll added as insurance in Addendum A.6 was removed again
  once that was settled. `popstate` and `hashchange` remain, because history
  navigation carries no DOM mutation of its own; a recurring timer on every
  authorized page guarding no distinguishable case does not.

  **A method note for the next identity change.** Three of the defects across
  these passes were real and are fixed; one was migration residue. Both the
  rich-text Field identity and the page identity moved during this work, and
  every such change orphans what was stored under the old one. QA of an
  identity-affecting change starts from a clean install, or it reports the
  previous build's ghosts.

- 2026-09-09: **Task 014 Addendum D and Task 036 Addendum A.5 - two more
  causes, found from the owner's recordings rather than guessed.**

  **ChatGPT's new-conversation page: the address carried an advertisement.**
  Conversations were stable and shared their Templates; `/` never offered one
  again. The Field's evidence was byte-identical throughout, so the address was
  the variable - and the owner had reached ChatGPT from a search ad, so that
  page carried fifteen campaign parameters that were hashed into the Page
  identity. The advertised `/` and the plain `/` were two Page Profiles. The
  tracking-parameter list now covers the documented advertising, analytics and
  app-version families, plus Apple's `pt`/`mt`/`ct` triple when all three
  appear together. Both ChatGPT's and Gemini's advertised addresses now reduce
  to exactly their clean equivalents. An unfamiliar parameter still counts:
  `?entity=customers` and `?entity=invoices` are genuinely two pages.

  **Gemini: the Picker held the previous page's Templates.** A Field's context
  is resolved on focus, and Gemini changes page while the composer keeps both
  the element and the focus, so no focus event arrives. The Side Panel fetches
  for itself, which is why the two surfaces disagreed - and the Side Panel was
  right. The content script now notices the address changing and re-resolves,
  checked both from the lifecycle reconciliation and from the per-frame
  position loop, because a route change need not mutate anything FillNest
  watches and `pushState` fires no event.

  Both repairs are covered by the hostility fixture, and reverting either makes
  its own assertion fail. `npm run check` passes (902 unit tests); the headed
  suite is **50/50**.

  A fourth pass followed: **ChatGPT and Claude both pass in full.** Gemini
  still loses a Template created on its new-conversation page and then offers a
  conversation's Templates there instead. Addendum A.6 adds an address check
  that depends on nothing - a 250ms poll plus `popstate`/`hashchange` - because
  A.5's two checks can both be absent exactly when needed. It is insurance, not
  a diagnosed repair: the fixture cannot isolate it, and that is recorded in
  the contract rather than dressed up as coverage. The next step for Gemini is
  a diagnosis, not another repair.

  **Claude passed in full** on the third pass - new-conversation, Chat and Cowork
  each stable, each sharing Templates within itself. The owner asked whether
  the three should share by default; that is an open product question recorded
  in the Next-Version Discussion Queue.

- 2026-09-09: **Task 036 Addendum A.4 - a navigation was being treated as a
  Field replacement. This is the root cause of the Templates that came and
  went.** The owner recorded the identity key's inputs on ChatGPT across
  eighteen samples in both states, and every input was byte-identical: one
  rendered host, `id="prompt-textarea"`, the same label, every time. The
  identity was never the variable.

  What correlated exactly was the **previous** address. Arriving at a
  conversation from the new-conversation page showed nothing; arriving from
  another conversation showed everything - including at the same URL that had
  worked a minute earlier.

  An SPA route change removes the old page's composer and adds the new page's
  in one mutation batch. The detached evidence carries the *previous* page's
  identity, so the replacement comparison could never match, and the new
  composer was marked a fresh candidate - which nulls its identity on purpose,
  so a Field with a perfectly stable key resolves as brand new and offers
  nothing. The mark then persisted for that element's whole life.

  Only a removal from the same page is a replacement now: evidence from another
  page is discarded rather than counted as a failure to match, and fresh-
  candidate marks are dropped when the address changes. Task 016's fail-closed
  boundary is about a Field being swapped underneath the user *on one page*.

  The hostility fixture performs a real route change - `pushState` plus a
  replaced composer in one batch - and requires the Template to survive leaving
  and returning. Reverting the repair makes it fail on that assertion, so the
  reproduction is genuine rather than incidental.

- 2026-09-09: **Task 036 Addendum A.3 - the composer's label is not an
  identity.** The owner's third QA pass renamed ChatGPT's new-conversation
  Field twice with two different names, then saw *both* renames appear on
  different visits, each with its own Templates - and sometimes neither. Two
  names cannot coexist on one Field Profile, so the key was taking more than
  one value.

  It is the accessible name. These applications rewrite their composer's label
  with the state of the interface, and during hydration it is briefly absent
  entirely - which is also why a visit could show nothing at all. A Rich Text
  Field is now keyed on a stable attribute wherever the page provides one
  (`name`, `id`, `autocomplete`); ChatGPT's composer carries
  `id="prompt-textarea"`, so the label is left out of its key rather than
  allowed to move it. Only a host with no such attribute falls back to the
  name, which is the same evidence that grants it a Binding at all.

  **A warning about QA method, from Gemini's regression.** Every change to the
  key orphans Field Profiles stored under the previous one - the Templates
  survive and stay findable by Search, but they are no longer that Field's. The
  rich-text key changed three times on 2026-09-09. A QA pass carrying data
  across builds will see losses that are migration, not defect. Reset FillNest
  between builds, or expect the first visit after an update to start empty.

  Also repaired: an unsaved rename in the Picker now ends when the user does
  something else - starting a new Template, searching, inserting, or moving to
  another Field.

  **Still unconfirmed:** Claude and Gemini expose no stable attribute on their
  composers, so their identity is still the accessible name. Whether that name
  holds still on those sites cannot be observed from this repository; the owner
  has a console diagnostic that records the key's inputs across visits.

- 2026-09-09: **Task 036 Addendum A.2 - the second QA pass found Templates
  appearing and disappearing on all three sites; the identity that moved is
  repaired.** The decisive report was Claude: renaming a Field in Cowork/Project
  mode was lost across a reload while the same rename in Chat mode persisted.
  An alias is written against a Field Profile and read back by key, so the key
  itself was moving between visits.

  It was the ordinal. A named Rich Text Field's key still carried its position
  among peers sharing its base key, and a chat application keeps editors
  mounted that are not on screen - the conversation animating out, an
  edit-message box, the next view pre-mounting. Every time that set changed,
  the key changed. A named Rich Text Field is now keyed **without its ordinal**,
  and the enumeration that produces an ordinal skips unrendered editing hosts -
  Rich Text Fields only, so a native control's key stays byte-identical.

  The same fault very likely explains the rest of the intermittency: a
  replacement Field may inherit an existing relationship only if its key
  exactly equals the detached one's, and an ordinal that moved during the same
  mutation batch made that comparison fail - which presents as a Template that
  is there, then is not, then is.

  Also repaired: the Field Control was still landing inside ChatGPT's composer,
  over the model picker. The visual-box search used absolute pixel margins that
  ChatGPT's composer exceeds; the caps are now viewport-relative and a multiple
  of the host.

  `npm run check` passes (901 unit tests) and the headed suite is **50/50**,
  with the hostility fixture extended to mount an off-screen composer carrying
  the same accessible name. **Not confirmed against the real sites** - that is
  the next QA pass.

- 2026-09-09: **Task 036 Addendum A - the owner's hands-on QA found three
  defects; all three are repaired with regression coverage.** Gemini passed the
  whole loop, including creating a Template and sharing it across pages through
  `Share with…`. ChatGPT and Claude failed at Template creation, and the Field
  Control was mispositioned on all three.

  - **The control landed inside the composer, on the site's own buttons.** The
    editing host is the inner text node; the attach/dictate/send controls live
    in the visual box around it. A Rich Text Field is now anchored to that box,
    found generically by walking up while each ancestor still hugs the host and
    taking the last one that draws itself with a border, radius or background.
  - **Typing in the Picker was captured by the page.** A chat composer listens
    on `document` for "type anywhere and I will focus the composer", so every
    keystroke reached the page, the page took the focus, and the Picker closed
    mid-edit - on Claude even a mouse-driven paste. Repaired in three parts:
    text-input and clipboard events no longer propagate out of FillNest's own
    host; focus taken from FillNest's interface while the user's own last
    keystroke or paste is being delivered is given back. The discriminator took
    three attempts: a time window since the last pointer was wrong in both
    directions, and "the last interaction was inside our interface" wrongly
    caught a programmatic focus and broke Keep Open's no-target contract. A
    fourth repair - keeping an open Picker open when its Field is re-focused -
    was implemented and reverted after it broke five accepted behaviours;
    focus restoration already covers what it was for.
  - **A Binding was lost when the SPA rebuilt the view around the composer.**
    Same Page Profile, so the Field key had moved: an SPA re-parents its editor
    and the ancestor chain shifts. A Rich Text Field with an accessible name is
    now keyed without its ancestor chain or its form - the name is the identity
    of a composer, where the page currently hangs it is not. This also unblocks
    the Task 016 Addendum E recovery path, which needed an exactly equal
    fingerprint and so could never fire while the fingerprint carried a chain
    the SPA rewrites.

  `tests/e2e/rich-text-composer-hostility.spec.ts` reproduces all three from
  the behaviours that caused them - a composer stealing focus from both a
  bubble-phase and a capture-phase `document` listener, a rounded composer box
  with its own toolbar, and a view rebuilt around the same editor - and asserts
  the page counts **zero** keystrokes while a Template is typed.

  **Not yet verified:** the owner's QA of ChatGPT and Claude stopped at the
  second defect, so everything past Template creation on those two sites is
  untested. A repeat pass is required before Task 036 is accepted.

- 2026-09-09: **Task 036 - Rich Text Field Support is implemented.** Eligible
  `contenteditable` editing hosts are Fields: they offer Templates, accept a
  deliberate insertion, and remember a Binding where they can be identified.
  No site name, domain, class name or editor identity appears anywhere in the
  source.

  **The measurement that changed the design.** In a real headed Chrome,
  `document.execCommand("insertText")` called from a content script fires
  `input` in the page's world but **never `beforeinput`**. The obvious
  implementation was therefore wrong in precisely the case it was chosen for:
  ProseMirror, Lexical and Quill route typing through `beforeinput`, so they
  would have received a DOM mutation they did not author with no event
  explaining it - the condition under which they revert it. Insertion now
  dispatches a cancelable `beforeinput` first and lets `execCommand` do the
  work only if the editor does not cancel; a cancelling editor is taken at its
  word, because inserting anyway would insert twice.

  **A privacy boundary the existing suite caught.** Post-insertion verification
  read the Field's text, which on a native control is a `field.value` read
  outside the two cases `AGENTS.md` allows - and `static-field-loop.spec.ts`
  failed on it immediately. Native controls are no longer verified and lose
  nothing: `setRangeText` has a defined result. The read stands for a Rich Text
  Field, bounded to one boolean, retained nowhere. **The owner should confirm
  this narrow read.**

  **Excluded, and why generically.** Grid and listbox descendants, cells, rows,
  list items, `role="code"`, `aria-multiline="false"`, an undeclared bare host,
  and an `aria-disabled` host all receive no marker, no listener and no read.
  Code editors needed a real rule rather than `role="code"`: CodeMirror 6
  declares `role="textbox"` with `aria-multiline="true"`, exactly as a chat
  composer does. The separation used is that a code editor switches off all
  three of `spellcheck`, `autocorrect` and `autocapitalize`; ChatGPT's composer
  sets all three *on*, and Claude's and Gemini's set none.

  **Tiered Binding, the Insertion Rejection fact, and the clipboard.** A host
  with an accessible name binds normally; one qualifying through
  `role="textbox"` alone can be inserted into but not bound, and says so. A
  refused insertion is reported and offers `Copy to clipboard`; **the clipboard
  is written only when the user clicks that**, asserted in the headed suite
  against a sentinel value. The refusal is remembered as one boolean on the
  Field Profile - no Template, no page content, no reason - is offered up front
  on the next visit, and is cleared by the next successful insertion. It
  travels in a Backup Archive and is removed with the Field's other data;
  `CURRENT_ARCHIVE_VERSION` does not move.

  Two addenda landed with it. Task 016 Addendum E lets an accessible name
  satisfy the DOM-replacement recovery's semantic-kind condition, without which
  every SPA re-render would break a composer's Binding. Task 024 Addendum B
  gives rich-text hosts the structural `other: rich-text` compatibility token -
  computed ahead of the `autocomplete` map, because ChatGPT's composer carries
  `autocomplete="off"` and would otherwise have matched every unrelated control
  on the site that also opts out of autofill.

  One Task 017 fixture descriptor changed meaning: a bare
  `<div contenteditable="true">` is still excluded and still zero-touch, but its
  veto reason is now `type` ("declares nothing") rather than `element` ("not an
  input").

  `npm run check` passes: typecheck, lint, docs and export conformance,
  **62 files / 901 unit tests**, and the verified build. The headed Playwright
  suite passes **49/49**, including two new specs covering the four editor
  behaviours, every exclusion, the absence of any synthetic key event, and the
  clipboard consent gate.

- 2026-09-09: **Owner hands-on QA of Logical Page Matching, Slug routes,
  eligibility and the Picker - passed.** The owner ran the twelve-item
  checklist agreed after Task 014 Addendum C, on real sites rather than
  fixtures, and reported every item as passing. The items with product weight:

  - **Slug route confirmation, end to end** (`wormald.com.au/careers/<slug>`,
    `mcgconcrete.com/careers/<slug>` with a `#apply-now` fragment, and
    `agcvinythai.com/apply-job/?job_title=<value>` with a `utm_source`
    parameter). Store on page A, get the "looks like a page you filled" offer
    on page B, confirm once, and a never-visited page C is recognized with no
    second ask. This is the path Slice 2 exists for and it had never been
    exercised by a human before this session.
  - **Reverse verification**: a structurally different page on the same Site is
    not swept into a confirmed rule.
  - **Query-parameter separation**: same path, different `?` value, stays two
    Pages.
  - Persistence across a browser restart; `Stop matching` withdrawing a
    confirmed rule; Clear Site Data removing rules and Observations together;
    Backup -> Reset -> Restore round-tripping the new identity keys.
  - **iframe forms** (`selenium-cucumber.github.io`): every eligible Field in
    the top document is supported and the iframe's controls receive nothing at
    all - no error, no ghost control. The documented non-support behaves as
    "safely does nothing", which is the contract.
  - **Sensitive fields**: no FillNest control on password, card number, or OTP
    inputs on real sign-in and payment pages.
  - Picker behaviour at 200% and 400% zoom on real pages (the Task 023
    Addendum B5 repair, previously verified only in automation); two tabs on
    one page staying in sync; and a table of twenty same-kind inputs, where the
    control follows focus correctly.

  Two reports from the same session were confirmed as **designed behaviour,
  not defects**, by reading the code against them:

  - `demo.nopcommerce.com` product pages are not offered as the same Logical
    Page. Both addresses sit one segment below the root and share no literal
    segment, which `routeFamily` requires. Declined for widening by the owner;
    the full reasoning is in the Next-Version Discussion Queue under
    `Root-Level Single-Segment Slugs`.
  - A Shopify `Quantity` control offers nothing. It is `type="number"` with
    `role="spinbutton"`, excluded by `classifyField` on two independent rules.

- 2026-09-09: **Task 016 Addendum D - focus-driven `readonly`.** Owner-reported
  from hands-on testing: on `vue-typescript-admin-template#/example/create` the
  "Search User" control showed a FillNest control and activating it did nothing
  at all.

  Element UI's `el-select`, and every typeahead built the same way, marks its
  own input `readonly` whenever it does not have focus. Opening the Picker moves
  focus to the Picker's Search box, the Field blurs, the component restores
  `readonly`, and all three eligibility checks correctly concluded the Field was
  no longer eligible and tore it down - removing the interface the user had just
  asked for, because FillNest had taken the focus.

  A Field may now stay attached while `readonly` **only** when `readonly` is the
  sole obstacle and FillNest's own interface is what took the focus. After the
  transition those two cases are indistinguishable, so the judgement is made
  once, while the evidence exists, and remembered against that one Field. The
  evidence is a `focusin` into the overlay and is consumed within one frame; a
  page-driven toggle arriving later finds none and tears down.

  **The lifecycle matrix earned its keep.** An earlier attempt latched the
  evidence at `mousedown` and never expired it, and SPEC-016-READONLY-01 failed
  - the flag from opening the Picker was still set when the page toggled
  `readonly` later. The suite drew the line the addendum had to stay behind.

  `insertTemplate` now focuses the Field before judging it, so a focus-driven
  component clears its own `readonly` and the insertion lands in a genuinely
  editable Field. A Field read-only for any other reason is unmoved and fails
  the same check as before.

  New `typeahead-select-field` spec reproduces the component's shape and asserts
  both halves - the Picker survives and inserts, and a genuinely read-only field
  on the same page still gets no control. `npm run check` passes: typecheck,
  lint, **61 files / 879 unit tests**, and the verified build. The headed suite
  passes **47/47**, including the complete Task 018 lifecycle matrix unchanged.

  Recorded from the same testing session: **rich-text and chat input support is
  now a Required Before Launch item** in `tasks/README.md`. FillNest attaches
  only to `<input>` and `<textarea>`, which is why that template's Markdown and
  JSON editors work and why the ChatGPT, Claude and Gemini composers do not -
  all three are `contenteditable`. It needs its own contract.

- 2026-09-09: **Task 014 Addendum C, Slice 1 - page recognition coverage.**
  Owner-directed after reviewing how FillNest recognizes "the same page at a
  different address". Full record in the Task 014 contract, Addendum C.

  **The defect was worse than under-matching.** `buildPageIdentityKey` returned
  `null` for any address it could not fully classify, and `resolveFieldContext`
  treats `null` as *brand new page* - it mints a fresh Page and Field Profile.
  So on those sites a saved Template was orphaned by **the next reload of the
  identical address**, not merely by a different record. Reproduced against the
  real repository before the change: a Stripe-style id page bound a Template on
  visit 1 and offered **0** on visit 2 of the same URL, while a numeric-id page
  correctly offered its Template on a completely different record. The Logical
  Page recovery could not help, because it is gated on a route pattern that was
  `null` for the same addresses.

  A survey of twenty-eight real address shapes produced `null` for UUIDv7,
  Mongo ObjectIds, Stripe-style ids, Salesforce ids, nanoid tokens, Jira and
  Linear issue keys, record-name slugs, WordPress `post.php`, `?tab=billing`,
  `?page=2`, and every hash-routed application.

  **Now: every address gets an identity.** What cannot be classified is hashed
  rather than rejected - the technique already used for numbered document
  filenames, and for the same reason: stable, opaque, no readable text stored.
  The identifier alphabet is wider (any UUID version, long hex, prefixed ids,
  issue keys, and interleaved alphanumeric tokens - with `office365` staying a
  route rather than collapsing with `office2019`). A record-name slug before an
  action word is now `:record`, which retains strictly less than the rejection
  it replaces. Query keys stay readable and values are hashed, with per-visit
  noise dropped. Route-shaped `#/` fragments count, fixing the one place the
  file **over**-matched: `/app#/customers/12` and `/app#/settings` were the same
  Page Profile.

  **Migration safety is the constraint that shaped it.** A stored Page Profile
  is found by exact key match, so the change is additive: every address that
  produced a key before produces the byte-identical key now, frozen by a corpus
  of twenty-four keys and five route patterns. `:number` and `:uuid` are
  untouched because confirmed Logical Page Rules store and match them exactly.
  The one deliberate exception is hash-routed addresses, whose key must change
  because it previously ignored the part that identified the page.

  Across the same twenty-eight shapes: **no `null` remains**, and the route
  families offered to Logical Page matching went from four to ten.

  `npm run check` passes: typecheck, lint, **61 files / 876 unit tests**, and
  the verified build. The headed Playwright suite passes **46/46**.

- 2026-09-09: **Task 014 Addendum C, Slice 2 - comparability is a route
  family.** The owner chose to keep the confirmation step: a similarity
  judgement can be wrong, and being wrong means showing one page's Templates on
  another; one confirmation is cheap and permanent.

  Slice 1 gave every address an identity; Slice 2 makes the field-similarity
  recovery reachable at all. Observations were recorded, and candidates
  offered, only for addresses whose pattern already spelled `:number` or
  `:uuid` - so on every other site there was never anything stored to compare
  against and the mechanism could not run even in principle. That gate is gone.

  **Comparability is now a route family**: same shape, differing in at most one
  position - exactly what `:number` already expressed, generalized to a
  position the pattern builder could not name. The floor that keeps it
  meaningful is at least one shared **literal** segment; shared wildcards do
  not count, because `/orders/:number` and `/customers/:number` have in common
  only a position that matches anything. A confirmed Rule now stores the
  generalized family and is matched segment-wise with its wildcards standing
  for any value - a superset of the old string equality, so every Rule
  confirmed before this keeps working. The stored-state validator followed: a
  Route Pattern no longer has to contain a dynamic segment, and its shape check
  still rejects anything carrying raw address text.

  Verified end to end against the real repository - the owner's own scenario:
  bind T1 on `/jobs/data-analyst/apply`; open `/jobs/senior-engineer/apply` and
  a candidate is **offered, not taken**; confirm once and the Rule is
  `/jobs/:id/apply` with T1 offered; open `/jobs/product-manager/apply`, never
  visited, and it is recognized with no second ask; open `/employers/contact`
  and it is not offered, however similar its fields.

  `npm run check` passes: typecheck, lint, **61 files / 879 unit tests**, and
  the verified build. The headed Playwright suite passes **46/46**.

- 2026-09-08: **Task 035's open findings are settled.** The owner answered the
  three that were theirs and delegated the rest.

  **A Template holds 1,000 Chinese characters** (owner's number). Other writing
  systems convert at the same weight, so the measure is **UTF-8 bytes**: a CJK
  character is three of them, 1,000 of them is 3,000 bytes, and the same budget
  buys roughly 3,000 Latin letters. Counting characters would have squeezed
  English to a third of the room and charged an emoji the price of a word.
  Enforced at the service worker's own boundary - every message carrying newly
  authored text does so as a top-level `content`, so one check covers all eight
  and any added later - and deliberately **not** applied to Restore or any
  Undo, whose content arrives nested: that text was accepted once already, and
  refusing to give a user their own data back is the worse failure. Both
  editors disable Save past the limit and say why.

  **A Field offers at most 20 Templates** (owner's number, V1). Not a storage
  limit - a usability one: the Picker's list is meant to be scanned. Checked
  when something is **added**, never when state is read or validated, so a
  Field already over it keeps working and raising the number later breaks
  nothing. It covers the ordinary "put this Template on this Field" actions and
  deliberately not the structural Shared Template Set operations - adding a
  member, joining, merging - which are one-off and already confirmed, and where
  refusing mid-flow is worse than a Field briefly offering twenty-one; those
  Fields still cannot grow further, because every add path checks. A slot added
  to a Set lands on every member at once, so there the question is whether any
  member is full.

  That exemption used to be **silent**, which was its real problem - a merge
  could take a Field from twenty to forty while the confirmation said only how
  many *fields* were affected. After the owner reviewed it, the Picker's join
  and merge confirmation now states the resulting Template count, and when the
  union goes over says so and explains the consequence. It still never blocks:
  the decision was that the user should see the cost and choose, not be stopped
  mid-flow.

  The Picker counts from the same effective list its rows render from, so what
  the user sees and what the limit counts are the same thing. A running count
  appears from within five of the limit (`15 / 20`) and turns to the warning
  colour at it; past the limit the Bind actions are gone and Save is disabled,
  each with a line saying why.

  **Both Template editors now show how much room is left**, from 80% of the
  length budget. It reads "About 400 characters left" rather than
  "2,600 / 3,000" - the owner asked for the latter, but the budget is UTF-8
  bytes, so someone who has typed 867 Chinese characters has not typed 2,600 of
  anything, and the *limit* has no single character count either (1,000
  characters or 3,000 letters, depending what you type). The room remaining,
  measured in the characters the writer is using, survives both problems and is
  the number a writer wants; the exact budget stays in the tooltip.

  **A full local store now says so in words the user can act on**, instead of
  Chrome's "Resource::kQuotaBytes quota exceeded". Only the wording changes -
  the write genuinely did not happen - and any other storage failure is
  re-thrown untouched, so a transient platform error is never mislabelled.

  **`tabs` stays, with a precise justification** now written into Task 033
  beside the permission: only one of its four uses actually needs it, reading
  the current tab's Origin *before* it is authorized, which is the entry point
  to the product.

  **One switch size rule.** Three sizes existed across three surfaces with
  nothing saying why. One shared stylesheet beside the one shared component,
  and one rule: default for a switch that is a control in its own right,
  `.compact` inside a dense list row. The size is three custom properties, so a
  variant states only what differs and the thumb's travel is computed rather
  than restated - that hand-written `translateX` per size was the easiest thing
  to get wrong. The forced-colors block travels with the control, which is how
  the Popup came to have none at all until Task 035 found it.

  **Half of the button-vocabulary finding was a real defect.** `.primary-button`,
  `.origin`, `.access-line` and `.notice.warning` belong to
  `CurrentWebsiteAccess`, which **both** surfaces render, and each stylesheet
  declared them separately and differently - the Allow-access button had one
  margin in the Popup and another in Overview with nothing saying which was
  intended. One definition now, beside the component. The rest of F4 - each
  surface's *own* buttons under different names - stays as it is: wide, purely
  cosmetic, no user-visible gain.

  **Lifecycle mutation cost: decided to leave it.** Measuring well needs a
  representative churny page and a repeatable harness, and there is no
  complaint to aim it at. Recorded as: measure before optimizing.

  `npm run check` passes: typecheck, lint, **60 files / 821 unit tests**, and
  the verified build. The headed Playwright suite passes **46/46**, with both
  limits asserted against the real service worker - over the length limit
  refused, exactly at it accepted, an over-long Restore still accepted; a Field
  filled to twenty refusing the twenty-first while a different Field on the
  same page is unaffected. The Picker's own behaviour is unit-tested at three
  counts, and the join confirmation's resulting count in the headed suite.

- 2026-09-08: **The theme system is modular, and the shape enforces it.** The
  owner asked whether adding a theme could be made easy and miss-proof.

  Adding a theme is now **one file and one line**: `src/ui/theme/themes/` holds
  one file per theme and `themes/index.ts` is the registry. `ThemeId` is
  derived from that array rather than declared beside it, so the
  hand-maintained parallel id list a new theme could silently miss is gone.
  Adding a **token** is a compile error until both neutral ramps supply it,
  because the ramps are typed as total records over one list of token names
  held as data; `AccentPalette` is total over the accent names for the same
  reason.

  Two remaining silent-failure modes are now tested: a `var(--fn-typo)`
  resolves to nothing and the declaration is dropped with no error, and a token
  nobody reads still has to be defined twice and still has to pass the contrast
  test. One test compares the declared vocabulary against every `var(--fn-…)`
  in all four stylesheets, in both directions.

  **It found three real defects on its first run**, all artifacts of Task 034's
  mechanical conversion: destructive buttons took their label colour from
  `on-accent` instead of `on-danger`, the Picker's tooltips from `on-accent`
  instead of `on-inverse-surface`, and the modal backdrop was a shadow tint
  instead of `overlay`. Each looked right in light mode and was a colour
  borrowed from a different surface in dark mode.

  `theme-tokens.ts` stays the public surface and re-exports everything, so no
  import anywhere changed. `npm run check` passes: typecheck, lint, **58 files
  / 798 unit tests**, and the verified build. The headed Playwright suite
  passes **46/46**.

- 2026-09-08: **Task 034 follow-up - two defects the owner found by using the
  themed build.** Both are the same kind of miss: a rule written for a shape
  that no longer exists.

  - **The page-status control never changed colour.** It has its own
    Shadow-Root stylesheet in `PageStatusControl.tsx` - a fourth sheet Task 034
    did not tokenize. Its host was already themed, but the stylesheet held
    hard-coded hex, so the control floating on every authorized page stayed
    light under every theme. Tokenized, and the "no literal colour" test now
    lists all four sheets rather than three. Its paused state got a token pair
    of its own (`muted-fill` / `on-muted-fill`): the switch's `control-off` is
    a bare track and far too light to put a white glyph on, and the contrast
    test asserts the new pair.
  - **The Field Finder's Locate action rendered as an empty button.** Its rule
    still sized an `img`; Addendum B4 replaced every provided-asset image with
    a masked span, so the selector matched nothing and the glyph had no size -
    invisible in both modes, though dark is where it showed. The identical
    defect Addendum B5 fixed on the Side Panel's rename action, in the one
    place that pass did not reach. The product now renders no `<img>` at all,
    so a surviving `img` rule is always this bug; a test asserts none of the
    four stylesheets has one.

  Both are verified in the headed suite against the real extension: the Locate
  glyph is measured at its intended 14x14, and the page-status host is checked
  to carry the theme and to follow a mode change.

  `npm run check` passes: typecheck, lint, **58 files / 797 unit tests**, and
  the verified build. The headed Playwright suite passes **46/46**.

- 2026-09-08: **Task 035 - owner-requested whole-extension review.** Read
  against the shipped artifact rather than the diff: manifest and store
  posture, the message and permission boundary, the storage write path, all
  four runtime surfaces, browser-version compatibility, accessibility,
  performance and every authoritative document. Full record in
  `tasks/035-whole-extension-review.md`.

  **Three defects fixed.**

  - **The provided icons paint as solid blocks on Chrome 116-119.** Task 023
    Addendum B4 replaced the `<img>` icons with a span masked over
    `currentColor` using unprefixed `mask-image`. Unprefixed CSS masking
    shipped in Chrome **120**; the manifest declares
    `minimum_chrome_version: 116`. On those four versions the mask is ignored
    and the span keeps `background-color: currentColor`, so every pencil,
    map-pin, plug and share icon renders as a filled rectangle - which reads as
    a rendering fault rather than a missing asset. Fixed by also declaring the
    `-webkit-` spelling, which those versions support; the icon-seam test now
    asserts both.
  - **The Popup had no forced-colors support at all.** B4 restated every
    background-only distinction in system colours in `side-panel.css` and the
    Picker's stylesheet, and missed `popup.css`. So the exact control B4 exists
    for - an activation switch whose on state is track colour alone - was still
    undistinguished in Windows High Contrast, on the surface where Website
    Access is granted. This is the second defect in two reviews caused by the
    Popup being a near-copy of the Side Panel rather than sharing its parts;
    Task 034 merged the component, this merges the styling.
  - **The privacy policy listed a subset of what is stored.** It omitted the
    theme (Task 034) and the pinned Picker position, and implied Backup exports
    all of it - display preferences are per-browser and deliberately are not in
    the archive.

  `README.md` also described V1 and stopped, so a reader could not learn the
  product has Logical Page Identity, Shared Template Sets, the Field Finder or
  themes. A short "Since V1" section was added; the V1 list is unchanged
  because it is still accurate about V1.

  **Six findings recorded for a decision**, none of them fixed here: the `tabs`
  permission is load-bearing for exactly one thing (reading the current tab's
  origin *before* it is authorized) and needs a listing justification or a
  product change - a Task 033 decision; the 140 kB content script is a
  consequence of Task 028's deliberate removal of `web_accessible_resources`
  and is a known trade, not a bug; lifecycle mutation **cost** is unmeasured
  where its correctness is thoroughly covered; there is no storage-quota story
  (no length cap, raw Chrome quota errors); and Task 034's two cosmetic
  findings stand.

  **Checked and found sound**, recorded so the next review does not re-derive
  it: no `externally_connectable`, so no web page can reach the service worker
  and the only senders are FillNest's own contexts; every request shape-checked
  before dispatch, with three exhaustive type maps that make an unclassified
  new message a compile error; one storage key, one validator on every commit,
  staging for composites, a serialized queue in front; Observations pruned to
  bound Pages so nothing accumulates on its own; no `innerHTML`, `eval`,
  `new Function` or `document.write` anywhere; no `console.*` or `TODO` in
  `src/`; `dist/` untracked and the built package policy-checked. The four
  store blockers `npm run verify:store` reports are all owner-owned and already
  Task 033's.

  `npm run check` passes: typecheck, lint, **57 files / 792 unit tests**, and
  the verified build. The headed Playwright suite passes **46/46**.

- 2026-09-08: **Task 034 - appearance themes, Settings density, and a UI
  review.** Owner-directed, decisions inside the stated scope delegated. The
  full record is `tasks/034-appearance-themes-and-settings-density.md`.

  **A theme system.** Six themes - FillNest Blue, Graphite, Ocean, Forest,
  Plum, Amber - each in light and dark, with a mode preference of System, Light
  or Dark that follows the operating system live. Every colour in
  `side-panel.css`, `popup.css` and `picker-styles.ts` now resolves through one
  vocabulary of about thirty `--fn-` tokens, and a test fails the build if a
  literal colour reappears in any of them.

  A theme chooses an accent and at most a tint for the three background layers;
  the text ramp, the borders and the danger/warning/success families come from
  one neutral ramp per mode that every theme shares. That limit is the point:
  twelve independently authored palettes would be twelve chances to
  reintroduce the contrast failures Task 023's static audit removed by hand.
  `theme-contrast.test.ts` computes the real WCAG ratios for all twelve instead
  - text on every background layer it can sit on, a filled control's own label,
  the switch's on state against its off state, the feedback families - so
  adding a theme means passing that test rather than asking someone to look at
  it. One neutral changed as a result: `text-muted` moved from `#667085` to
  `#5b6577`, which was below 4.5:1 on the hover-raised layer under the tinted
  themes.

  The preference lives in **its own storage key, not `FillNestState`**. It is a
  display preference for this browser profile - no Templates, no Sites, no
  privacy weight - and a Backup restored onto another machine has no business
  repainting that machine. That also keeps it out of the schema version, the
  migration chain, the archive contract and the restore impact preview. Reset
  still clears it, and broadcasts the default so open surfaces stop wearing the
  old palette without a reload.

  The Picker was the interesting surface: it is a Shadow Root on a host
  injected into a page FillNest does not own, so its theme cannot come from
  that page's stylesheets. It is written as inline custom properties onto the
  host element, which survives the Shadow Root's `all: initial` and cannot be
  outweighed by the host page.

  **Settings density.** Every row led with two or three lines of prose, so
  three actions filled the page and the actions were the least prominent thing
  on it. Each row now states what it does in one line; the consequences that
  need spelling out are in the confirmation each action already opens. The
  backup privacy warning is kept - it is a real warning restated nowhere else -
  and, after the owner's review of the layout, now hangs off the Backup action
  as a warning affordance rather than occupying a container of its own. It is
  built as a real control rather than a hover-only decoration: the whole
  warning is its accessible name and the tooltip opens on keyboard focus and on
  tap as well as on hover.

  **UI review.** Three findings fixed: a dead stylesheet
  (`src/ui/shared/surface.css`, imported by nothing, and audited for contrast
  under Task 023); a duplicated `ToggleSwitch` - the Popup carried its own copy,
  which is exactly why its Global switch kept the uninformative accessible name
  after Addendum B5 fixed the Side Panel's - now one shared component; and the
  Picker's width constant, which was declared independently in a third place.
  Two findings are recorded and deliberately not changed: the Side Panel and
  Popup use two different class vocabularies for the same three button roles,
  and their switches are two different sizes. Both are cosmetic, both have real
  regression surface, and both belong in their own bounded change.

  `npm run check` passes: typecheck, lint, **57 files / 792 unit tests**, and
  the verified build. The complete headed Playwright suite passes **46/46**,
  including a new `appearance-theme` spec that drives the real product end to
  end and an added assertion that the Picker's own host carries a complete
  palette. Light and dark were checked visually on Overview, Templates and
  Settings.

  Not evidence: no theme other than the default has been used for real work,
  and nothing here has been seen in a forced-colors session - though that block
  overrides the tokens, so Addendum B4's caveat is unchanged rather than
  widened.

- 2026-09-08: **Task 023 Addendum B5 - the manual VoiceOver and Chrome zoom
  pass is done.** The owner ran the session Addendum B recorded as the one
  thing no automation here could stand in for, and reported sixteen
  observations. Thirteen were real defects and are repaired; three are
  recorded as correct behaviour or a deliberate product position. The full
  finding-by-finding record is in the Task 023 contract, Addendum B5.

  The repairs, grouped by what was actually wrong:

  - **Nothing said what a control was for.** Both Overview switches (and the
    Popup's Global switch) announced only "Active, on, switch"; a Template row
    announced its own text and "collapsed" but never that pressing it shows
    the full text; a Picker Template row never said pressing it inserts. Each
    now has an accessible name or description that says what it does.
  - **The rename affordance was broken twice over.** Addendum B4's icon change
    left `.rename-action` sizing an `img`/`svg` child that no longer exists,
    so the pencil button rendered as a blank circle named only "Rename". The
    button is gone: the name itself is now the control everywhere, matching
    the Picker, which had already solved this. And every rename editor opened
    **empty** - it seeded from the stored alias, undefined until a first
    rename - so it now opens on the name being displayed, selected.
  - **The Site filter was unreachable with VoiceOver's own navigation.** It
    declared `role="listbox"` over children that are checkboxes, so the
    accessibility tree pruned them; Tab reached them, Ctrl+Alt+Arrow could
    not. It is a disclosure over a group now.
  - **Results were announced unreliably, or wrongly, or not at all.** The live
    region was the visible banner, whose new content is a subtree of buttons -
    which is why Reset announced nothing. There is now one dedicated,
    text-only status region, written a beat after the change that produced it.
    It states when Undo is available, and the Undo button's own name says what
    it would undo. Saving an edit announced the version it had just
    **replaced**, because the recoverable action carries the pre-save record
    for Undo; the wording now uses the saved content.
  - **Deleting or saving threw focus out of the extension.** Both remove the
    control the user just pressed, so focus fell to the document and VoiceOver
    read "FillNest web content". Focus is recovered onto the Undo the same
    action produced - only when it was actually lost.
  - **The Picker did not survive zoom.** Its width was a hard 348px, so past
    roughly 250% it was wider than the viewport with its right-hand side
    unreachable (an overlay does not extend the page's scroll range); and a
    pinned Picker rendered from a stored position nothing re-checked, so
    zooming pushed it off-screen for good. Width is now viewport-bounded and a
    pinned position is clamped on every resize, without persisting the clamp.

  Recorded with no change: the Side Panel navigation announcing "Overview,
  button" is correct for buttons carrying `aria-current="page"`;
  Ctrl+Alt+Escape leaving for the browser chrome is VoiceOver's own command,
  not something the panel should intercept; and there is deliberately no
  in-app reduced-motion switch, because Addendum B3 honours the operating
  system's own setting. The Side Panel not zooming with the page is Chrome's
  behaviour for extension side panels and is not ours to change.

  `npm run check` passes: typecheck, lint, **55 files / 692 unit tests**, and
  the verified build. New coverage: Picker viewport geometry and stylesheet
  bounds, the switch accessible names, the rename affordance and its seeded
  editor across the Side Panel, Picker and Sites page, the save result naming
  the saved version, and the text-only announcing region with its focus
  recovery. The Reset announcement is asserted in the headed
  `deletion-safety` spec where the defect actually manifested. The complete
  headed Playwright suite passes: **45/45, no skips**. Four specs asserted the
  old accessible names and were updated to the new ones - the rename trigger,
  its seeded editor, and the result-action name that now carries its result.

  **The owner re-ran the session against the repairs the same day and accepted
  all of them**, confirming by ear the two that were hardest to reason about
  without hearing them: focus lands on Undo after a delete, and Reset
  announces. Task 023's manual accessibility evidence is complete; no finding
  from this pass is open.

  One observation from that confirmation pass is recorded as a boundary rather
  than a defect: **a magnified Picker covers the page content behind it.** It
  is a floating overlay, so at high zoom it is a large fraction of the viewport
  and covers what is behind it. Finding 15 made its own content *reachable* at
  that size, which is the accessibility obligation; not overlapping the page at
  all would need a docked or inline Picker, which is a product decision about
  what the Picker is rather than a repair. It already flips above or below so
  it never covers the Field it is attached to.

- 2026-09-08: An authorized autonomous run completed five pieces of work. The
  owner accepted Tasks 026 and 027 the previous evening and delegated the rest.

  **Task 032 Phase B is complete.** Every command body is now a pure state
  transition. `fillnest-repository.ts` is **6,146 -> 1,337 lines** across Tasks
  031 and 032; `src/storage/` is eleven focused modules. Commit counts are
  unchanged, held by locks written before each family moved, and no existing
  test was modified in any slice. Three commands were reshaped in place into
  equivalent forms before being moved, because hand-writing their transitions
  was the riskier route; `setPickerPositionUnlocked` stays in the Repository as
  eight lines belonging to no family.

  **`BindingRecord.order` is removed** (schema v12 -> v13). Archives written
  before today still carry it and still restore; new ones do not write it.
  `SharedTemplateBindingRecord.order` is unchanged - a Set has no single owning
  Field to key ordinary Binding order off.

  **TypeScript 5.9 and ESLint.** The downgrade from TypeScript 7's native port
  needed one config change, `DOM.Iterable`, and produced zero type errors.
  Lint went 402 findings -> 0 errors, including 91 dead imports most of which
  Phase B had left behind. Two rules are off with reasons stated in the config.
  `npm run lint` is in `npm run check`.

  **Task 024 Addendum A's authorization is withdrawn.** It specified the same
  Template-first sharing path the owner had deferred hours earlier.

  **Task 033 records the 0.2.0 store gate** and executes what needs no product
  or design decision: `npm run package`, `npm run verify:store`, and a privacy
  policy written from the code.

- 2026-09-08: **Six `react-hooks/exhaustive-deps` warnings are open and
  deliberately not resolved.** They are user-visible behaviour decisions in the
  Picker and Side Panel, in code that had just passed hands-on QA. They are
  warnings so they stay visible without blocking, and both the lint config and
  the handoff guide say not to silence them.

- 2026-09-08: A defect that only the headed suite could catch. Removing
  `BindingRecord.order` left the runtime message guard still requiring it, so
  every Undo carrying a Binding back to the service worker was rejected before
  reaching a command - silently. Unit tests call the Repository directly and
  never cross that boundary.
  `tests/unit/binding-message-contract.test.ts` now covers the seam.

- 2026-09-08: Evidence for all of the above: `npm run check` - typecheck, lint
  (0 errors, 8 warnings), documentation conformance across **33 contracts**,
  dead-export verification, **689 unit tests** in 54 files, production build and
  the closed-Shadow-Root gate. Headed Playwright suite **45/45** after every
  slice.


- 2026-09-07: Owner integration decision. `task-032-repository-decomposition`
  keeps its refactor and product commits together; it is not split. Agents
  continue on the branch the previous agent used, because a handoff between
  agents is a token handoff rather than a new line of development. Recorded as
  a durable rule in `docs/agent-handoff.md`. The branch is a strict
  fast-forward of `codex/task-021-shared-template-sets-implementation`, so
  merging it is trivial.

  Task 032 Phase B rules are recorded as Addendum A and remain **unauthorized**:
  one command family per slice, behaviour locks written before each move,
  independent commit and review per family, and stop rather than force a family
  that cannot move without a behaviour change. Composite commit boundaries stay
  as they are; changing them is a product question needing its own Task.

  Settled by measurement: `joinSetAndShare` and `mergeSetsAndShare` perform
  exactly one durable `storage.set` through `runAtomicComposite`. An earlier
  re-audit claim that they commit twice was wrong. Both now carry a
  commit-count lock using the `InMemoryLocalStorage` `setCount` seam, which is
  the reference pattern for Phase B's locks.

  The QA repair plan under `docs/superpowers/plans/` is annotated with what
  actually ran. Three of its steps did not, and are marked `[!]` rather than
  ticked.


- 2026-09-07: Independent re-audit of the QA repair wave on branch
  `task-032-repository-decomposition`. Two defects in the repairs themselves
  were fixed, and one accepted criterion was found unmet.

  Task 027 Addendum E.1: Addendum E removed the reported Bind/Bind icon
  collision by giving `Bind to Shared Set` the supplied `share-network.svg`,
  a three-node graph. `ShareIcon` - `Share this version` - already drew the
  same three-node graph, and the Picker renders the Shared Template Set list
  and the search results together, so both commands can appear at once under
  one picture. Promotion now has its own metaphor. Addendum E's criteria were
  too narrow: comparing asset identifiers proves two icons are different
  files, not that they look different.

  Task 004 Addendum B.1: Addendum B dropped the content runtime's Field
  Context cache on every `BUSINESS_STATE_CHANGED`. That cache is also what
  keeps an SPA-reconstructed Field's identity stable, so an ordinary mutation
  discarded the identity it had just been recorded against. The broadcast now
  states whether stored Page/Field Profiles could have been removed, produced
  by a total mapping over `RuntimeRequest["type"]`.

  Task 004 Addendum B Acceptance Criterion 3 is **not met**, recorded in that
  contract. Setting the new mapping's `RESET_SITE_MAPPINGS_BATCH` entry to
  `false`, so `Clear site data` invalidates nothing, still passes the E2E that
  accepted Addendum B: its Fields are never cached, and the open Picker
  converges through a separate pre-existing path. The reported cross-tab
  scenario therefore has no proven root cause and no evidence of repair. It
  needs the owner's exact steps re-run against this build.

  Addendum B's own unit regression was replaced rather than kept: it passed
  with the production change removed, because a plain Field has a real page
  identity key, is never cached, and re-resolves on every focus either way.

- 2026-09-07: Known flake. `deletion-safety.spec.ts` "Factory Reset" failed
  once - the Reset dialog stayed open past the 5s assertion - and then passed
  in four consecutive full suites and in isolation. Reset now fans out to
  every tab four times (reconcile inject, explicit revocation, activation
  broadcast, business broadcast), so timing under load is the leading
  hypothesis. It was not changed on that hypothesis alone.

- 2026-09-07: Evidence for the above: `npm run check` **677/677** unit tests
  across 54 files, 32 contracts with no drift, no dead exports, production
  build and closed-Shadow-Root gate. Complete headed suite **45/45** on three
  consecutive full runs.


- 2026-09-07: The project owner accepted Task 031 and Task 032 Phase A,
  including Task 032's bounded historical evidence deviation. Phase B remains
  frozen. The owner then approved designs and execution for three hands-on QA
  repairs: Task 009 Addendum A owns immediate live-page teardown after Reset;
  Task 027 Addendum E gives field-only and Shared Set Bind actions distinct
  icons using the supplied local asset; Task 004 Addendum B owns automated
  reproduction and evidence-led repair of cross-tab convergence after Clear
  Site Data. The owner approved the written design for direct implementation;
  execution follows its checked-in test-first plan. QA repair wave is now
  complete: Task 009 Addendum A explicitly revokes live pages during Reset;
  Task 027 Addendum E distinguishes the two Bind audience icons; Task 004
  Addendum B invalidates and re-resolves live Field Context after Clear Site
  Data. Focused regressions and final full checks are recorded below. Task 032
  Phase B remains frozen and unauthorized.

- 2026-09-07: QA repair evidence: focused Reset lifecycle and transaction unit
  tests **14/14**, focused Picker icon test **1/1**, focused content-runtime
  tests **62/62**, Reset E2E **1/1**, and Clear Site Data cross-tab E2E **1/1**.
  The final complete headed Playwright suite is **45/45 passing, no skips**;
  `npm run check` is **675/675** with typecheck, documentation conformance,
  dead-export verification and production build verification passing.

- 2026-09-07: Task 032 Phase A is complete and accepted on branch
  `task-032-repository-decomposition`; Task 032 as a whole remains open. Five
  behaviour-preserving boundaries were extracted and
  `fillnest-repository.ts` is **5,738 → 4,304 lines** for this Task
  (**6,146 → 4,304** across Tasks 031-032). Command bodies remain in the
  repository and Phase B is not authorized; it will be replanned after the
  owner's QA findings are classified. The separate Task 030 production-build
  isolation-test repair is now recorded in its owning contract. Fresh evidence:
  `npm run check` (54 files, 673 unit tests, documentation conformance,
  dead-export check, typecheck and production build) and the complete headed
  E2E suite (**44/44 passing, no skips**). Independent review found no Project
  Standards issues and one Spec P2: commit `29d1739` combined two mechanical
  boundaries without a durable between-slice full-evidence checkpoint. The
  deviation is recorded in the Task contract and explicitly accepted by the
  project owner. Task 031 is also explicitly accepted. Phase B remains a
  separate, unauthorized gate after the owner's QA findings are resolved.

- 2026-09-07: Task 030 (Picker Isolation Architecture) is complete, closing the
  audit's last open P1. The Inline Picker's Shadow Roots now ship **closed**, so
  a host page can no longer read Template content - including the cross-Site
  Search results the audit demonstrated leaking - out of the Picker. The mode is
  a **build-time** constant, not a source edit: the owner's two manual variants
  were refined because a source flip leaves the repository in the wrong state if
  a test run crashes, and because neither would ever have exercised the shipped
  artifact. `npm run build` produces `dist/` (closed, and what hands-on QA
  loads); `npm run build:e2e` produces `dist-e2e/` (open) for Playwright, which
  cannot pierce a closed root. Two gates keep that divergence honest, and both
  were verified non-vacuous: `verify-build.mjs` resolves the mode through the
  minifier - which rewrites string literals as template literals and renames the
  constant - and rejects an open artifact (confirmed by placing the open build
  in `dist/`); and `picker-isolation.spec.ts` loads the real `dist/` artifact to
  assert both halves - the page reaches zero Shadow Roots and never sees the
  Template text, *and* the Picker still opens, searches and inserts, driven
  through page coordinates and the field's own value rather than any
  shadow-piercing locator. Run against the open build that spec fails, which is
  the proof it is testing isolation rather than passing by construction. The
  isolation rule is now stated in `PROJECT.md` (including what FillNest
  deliberately does *not* hide - its presence markers), and the production-parity
  exception is recorded in `AGENTS.md` with instructions not to extend it.
  **Correction to the previous entry:** the "43/43" reported for Addendum D was
  run against a stale `dist` - that `npm run check` had failed at typecheck, so
  the build never ran. Rebuilding surfaced 20 E2E assertions where
  `getByRole("button", { name: "Save" })` had become ambiguous against
  Addendum D's new `Save for this field only`; all now use exact matching.
  Evidence: `npm run check` (54 files, 673 unit tests, docs conformance,
  dead-export check, typecheck, build) and the complete headed Playwright suite,
  **44/44 passing, no skips**.

- 2026-09-07: Task 027 Addendum D is complete. An unshared Field can now save a
  Template as private to itself (`Save for this field only`, alongside the
  ordinary `Save`), so that joining a Shared Template Set later does not share
  it. **This corrects Addendum C.4**, which concluded no such option was needed
  because `Save` already binds to that Field alone. That reasoning judged only
  the audience at save time; the audience that matters is the one that exists
  once the Field joins a Set, where every unmarked Binding is unioned into the
  shared list - a user who meant a Template for one Field had no way to say so
  beforehand and found out only after sharing. It is the same boundary
  Addendum C.2 fixed for a Template already private *inside* a Set; this closes
  the other half. No new mechanism: `CREATE_TEMPLATE_AND_BIND` gained an
  optional `privateToField`, and C.2's rules already keep such a Binding
  private through any Set the Field joins. `Save` stays the default and stays
  unmarked, since Task 021/024's `Link templates` flow exists precisely to
  share ordinary Templates; the private choice is the deliberate exception, and
  its label states the *future* consequence because at save time both look
  identical. Recorded as a follow-up, not assumed: the symmetric case of
  binding an existing searched Template privately on an unshared Field.
  Evidence: `npm run check` (54 files, 673 unit tests, docs conformance,
  dead-export check, typecheck, build) and the complete headed Playwright
  suite, **43/43 passing, no skips**.

- 2026-09-07: Task 031 (Sharing Subsystem Extraction) is complete and accepted
  by the project owner for its
  stated scope, in two behaviour-preserving slices. `src/storage/
  shared-templates.ts` now owns the subsystem's three records, its resolver
  (`effectiveTemplateListForField`, `TemplateRelationRef`, the collapsed entry
  types), four helpers, three record validators, and every stored-data
  invariant behind `assertSharedTemplateInvariants`. It imports nothing from
  `fillnest-repository.ts` - it takes structural state slices rather than
  `FillNestState` - so the dependency runs one way by construction;
  `invalid-stored-data-error.ts` and `value-guards.ts` exist only to make that
  possible. Seven invariants gained a dedicated regression test, because a
  refactor that silently disabled one would otherwise still pass the whole
  suite. Repository: 6,146 → 5,732 lines. **Deliberately left:** the ~30 Set
  and Slot command bodies, which are methods over `this.read`/`commit`/
  `runMutation`. Converting each into a pure state transition touches every
  command and every Undo at once, in the code three audits found fragile,
  where a mistake is a behaviour change rather than a compile error - it is now
  a Task 032 slice, recorded in both contracts. Evidence: `npm run check` (54
  files, 669 unit tests, docs conformance, dead-export check, typecheck, build)
  and the complete headed Playwright suite, **43/43 passing, no skips**. No
  pre-existing test was modified in either slice, which is the acceptance
  condition for a behaviour-preserving refactor.

- 2026-09-07: Task 027 Addendum C is complete, closing the defects the project
  owner's hands-on QA found. **C.1 (blocking):** sharing from a Set that already
  spanned two Sites threw `Field Profile not found in this Site`.
  `addSharedTemplateSetMember` compared the joining Field's Site against the
  Set's *anchor* `siteId`, which never changes, while the Picker computes
  `crossSite` against the *current* Field's Site - two reference points. Once a
  Set spans two Sites, acting from a Field off the anchor Site made every
  same-Site candidate look cross-Site to the repository while nothing sent the
  opt-in. It now compares against the Set's actual member Sites; expanding to a
  genuinely new Site still requires `allowCrossSite`. **C.2 (privacy leak):**
  after Stop sharing and then sharing again, A's private Template reached B.
  Converting a Field-only Slot to a direct Binding lost the fact that it had
  ever been private, so the next Set unioned it into the shared list. Schema
  `10 → 11` adds an optional `BindingRecord.privateToField` marker, set at every
  conversion point (departure, Move, End Set); `createSharedTemplateSet` and
  `addSharedTemplateSetMember` turn a marked Binding into that Field's own
  owner-only Slot instead of an ordinary one, `Share this version` clears it,
  and Backup/Restore round-trips it. Migration is additive - an existing
  Binding has no marker and behaves exactly as before, so nothing is inferred
  retroactively. **C.3:** a Field on the current page could not be found in the
  Finder once a Search query was typed, because `In this page` rendered only
  while the box was empty and `findSimilarFieldCandidates` skips any Field with
  an empty effective Template list (Task 024's accepted rule). `In this page`
  now stays visible, filtered by the query; Task 024's discovery rule is
  untouched. **C.5:** the `Link templates` confirmation said only that the
  operation "affects N fields across M Sites" without saying *what* happens to
  them - the one audience-changing confirmation that failed the review's test
  (can the reader state who will see what, before clicking?). It now states the
  outcome, including that Templates saved for one field only stay private.
  **C.4:** no change needed - for a Field in no Set, `Save` already binds to
  that Field alone; there is no second audience to choose between. Reported to
  the owner with a copy suggestion rather than changed unilaterally.
  **Not a defect:** clearing Site data appeared to delete Templates. A probe
  confirms the records survive with empty Site Affinity - they become Global,
  which a Site filter cannot show. Evidence: `npm run check` (53 files, 662
  unit tests, docs conformance, dead-export check, typecheck, build) and the
  complete headed Playwright suite, **43/43 passing, no skips**.

- 2026-09-07: Task 029 (Authoritative Documentation Reconciliation) is
  complete. `PROJECT.md`'s `0.1.2` release row now names every theme actually
  delivered (Tasks 010-028) and states that complex-control support is the one
  unstarted candidate; it also records that a release row describes what a
  release contains rather than capping what it may contain, scope control
  living in each Task's own acceptance gate. Its edit-scope rule is corrected
  to "actual effective consumers, never Site Affinity count", matching what
  Task 026 shipped, and the Save labels are replaced with the five the product
  renders. `CONTEXT.md`'s Shared Template Set and Shared scope entries describe
  per-Slot resolution instead of "one ordered effective Template list", and
  seven load-bearing terms Tasks 026/027 depend on are registered: Shared
  Template Slot, Override, Exclusion, Field-only relationship, Audience,
  Promotion, Collapse - plus an explicit separation of a Shared Template Set
  from a Template Share Package and from the "team sharing" non-goal. The
  roadmap's own release row and Execution Order are aligned, `README.md` no
  longer makes a per-Task acceptance claim it cannot keep current, and
  `docs/next-version-discussion.md`'s outcome vocabulary is updated.
  **The durable part is Slice 4:** `npm run verify:docs` now runs inside
  `npm run check` and fails the build on three shapes of drift - a control
  label `PROJECT.md` names that no `src/ui/` file renders, a contract linked
  but missing or existing but unlinked, and a roadmap row absent from its
  version's Execution Order. It found four real instances on its first run that
  the manual audit had missed: `Use current field content` (the button reads
  `Use field content`), `Unbind from this field` (the UI reads `Unbind` or
  `Remove from this field`), and Tasks 010-013 missing from the Execution Order
  entirely. Deliberately unimplemented labels are allowed only through a list
  that requires a written reason. Evidence: `npm run check` (51 files, 647 unit
  tests, docs conformance, typecheck, build) and the complete headed Playwright
  suite, **43/43 passing, no skips**.
- 2026-09-07: Task 032's ESLint item was blocked; the project owner chose the
  narrow-check alternative and it is now in place. `npm run verify:exports`
  runs inside `npm run check` and fails on a **dead export** - one that no file
  imports and whose own file never uses it. That is exactly the class the audit
  found (`UndoIcon`, `StaticSurface`, `isRemoveWebsiteAccessResultShape`), all
  three removed by Task 028, so it reports zero today and exists to keep it
  that way. Verified non-vacuous two ways: six unit tests covering the dead,
  imported, over-exported, renamed-import, type-only-import, entry-point, and
  wildcard-re-export cases, plus a live probe - adding a dead export to
  `FillNestIcons.tsx` failed the check, and removing it restored green. Two
  deliberate limits, both stated in the script: it stays quiet for an
  **over-exported** symbol (~47 today, exported but used only in its own file -
  not dead code, and gating on them would need an allow-list that defeats the
  check), and it refuses to answer at all if any file uses `export * from`,
  rather than emitting confident false positives. Also corrected in the Task
  032 contract: downgrading TypeScript would *not* change the approved
  baseline - no governing document pins a version, `tsc` does not participate
  in the build (`noEmit: true`), every `tsconfig` option is TS 5.0-compatible,
  and the only modern syntax used is `satisfies` (TS 4.9). Evidence:
  `npm run check` (52 files, 653 unit tests, docs conformance, dead-export
  check, typecheck, build) and the complete headed Playwright suite, **43/43
  passing, no skips**.
- 2026-09-07: Original blocker record - Task 032's ESLint item is **blocked, not skipped**. The approved
  baseline pins TypeScript `7.0.2`; no released or canary `typescript-eslint`
  supports it (`8.69.0` and `8.69.1-alpha.0` both declare
  `typescript: ">=4.8.4 <6.1.0"`). Installing with `--legacy-peer-deps` would
  put an unsupported parser on TS 7 syntax, and an unreliable linter on a
  codebase whose value is trustworthy verification is worse than none. Three
  ways forward are recorded in the Task 032 contract; all three need the
  project owner's decision, since two of them change the approved baseline.
  No dependency was added and `package.json`/`package-lock.json` are untouched
  by the attempt.

- 2026-09-06: Task 028 Addendum B (Unified Destructive-Operation Policy) is
  complete, from the owner's "Task bugs" review. **Product decision:** typed
  `delete` now guards a *bulk* operation whose result empties the Template
  Library; a deliberate single-Template deletion is targeted and never typed,
  including when it is the last one. The previous rule made deleting your only
  Template demand a typed word through the multi-select path while the
  row-level Delete and the Inline Picker - both `DELETE_TEMPLATE`, which never
  had a gate - did not. `PROJECT.md`'s three affected sentences are corrected
  here rather than deferred to Task 029, so no stable document mandates
  behaviour the code deliberately does not have (audit finding D2's failure
  mode). A count threshold ("more than three Templates") was considered and
  rejected: it decouples the gate from risk, since 2-of-2 destroys everything
  while 4-of-400 does not. **Structural fix:**
  `src/background/destructive-operation-policy.ts` is now the single authority,
  carrying a total mapping over all 79 `RuntimeRequest` types in the same shape
  as `BUSINESS_STATE_BROADCAST` - adding a message without classifying its
  destructive policy is a TypeScript error, not an oversight. Five entry points
  previously decided independently: `DELETE_TEMPLATE` (targeted),
  `DELETE_TEMPLATES` and `DELETE_NEWLY_GLOBAL_TEMPLATES`
  (bulk-empties-library), `RESET_FILLNEST` (`reset`) and
  `RESTORE_BACKUP_ARCHIVE` (`restore`), the last two now reading their required
  word from the table instead of a repeated literal.
  `DELETE_NEWLY_GLOBAL_TEMPLATES` gains the boundary gate it never had - its
  Sites-page sheet already collected a typed word, but nothing enforced it.
  Both Side Panel surfaces now match what the boundary enforces. Evidence:
  `npm run check` (50 files, 640 unit tests, typecheck, build) and the complete
  headed Playwright suite, **43/43 passing, no skips**. Deferred by the owner:
  the Slice 4 content-script size increase stays as-is; the Inline Picker
  Shadow DOM mode remains Task 030's decision.

- 2026-09-06: Task 028 (Recovery And Boundary Hardening) is complete, closing
  audit findings C1, C2, S4, C3 and S3. **C1:** Factory Reset no longer
  requires the store it is about to destroy to be readable.
  `ResetTransactionCoordinator` absorbs `InvalidStoredDataError` into a
  preview marked `businessDataReadable: false` with null counts, and Settings
  states the condition plainly instead of showing numbers it cannot know; any
  other error (a storage-platform failure) still propagates, so a transient
  outage is never presented as corruption. The confirmation token still
  derives from the preview, so a store that becomes readable between preview
  and confirm still fails closed. **C2:** `DELETE_TEMPLATES` now requires an
  extension-page sender and, at the service-worker boundary, exact typed
  `delete` whenever the request would empty the Template Library - judged from
  current state, so unknown ids and duplicates cannot make a partial delete
  look total or the reverse. Partial batch delete is unchanged and carries no
  typed confirmation. The rule now holds "regardless of entry point", matching
  `RESET_FILLNEST` and `RESTORE_BACKUP_ARCHIVE`. **S4:** Field Eligibility
  vetoes national identity numbers (`ssn`, `social security`, `social
  insurance`, `sin`, `nino`, `national insurance`, `national id`, `tax id`,
  `tin`, `passport`), evaluated per evidence source rather than over the
  joined description - a free-text word in one attribute must not excuse an
  identity term in another - with the same free-text exemption the date rules
  use, so "Passport application notes" stays eligible. **C3/S3:** removed the
  dead `UndoIcon`, `StaticSurface`, and `isRemoveWebsiteAccessResultShape`;
  moved the four provided SVGs from `public/` to `src/ui/icons/assets/` and
  inlined them with Vite `?inline`, so `web_accessible_resources` is gone from
  the manifest entirely and the policy gate now rejects the key outright
  rather than policing its contents. That removes one extension-fingerprinting
  probe; the cost is the content-script bundle at 127.31 kB / 30 modules
  (was ~115.7 kB / 26), +2.4 kB gzipped, and four fewer files in the package.
  **One contract amendment during implementation:** Slice 2 originally also
  guarded `DELETE_TEMPLATE`; that was wrong, because the Inline Picker's own
  row-level `Delete template everywhere` legitimately sends it from a content
  script. The headed E2E suite caught the regression
  (`usage-accounting.spec.ts`, `side-panel-live-sync.spec.ts`); the guard was
  reverted, the reason recorded in the service worker, and the Task 028
  contract amended rather than silently corrected. Evidence: `npm run check`
  (50 files, 636 unit tests, typecheck, build) and the complete headed
  Playwright suite, **43/43 passing, no skips**.

- 2026-09-06: Task 027 Addendum B's remaining item - a Picker entry point for
  the `Join Set & Share`/`Merge Sets & Share` composites - is implemented.
  `Share this version`'s confirmation now offers a second choice, `Share with
  a different field…`, alongside the existing `Share with the Set`: it opens
  the same Finder used by `Find similar field` (reusing its compatibility-
  candidate search rather than a new candidate source, since it is already
  scoped to plausible compatible Fields, already excludes the current Field
  and any already-linked one, and already carries the `existingSetId`/
  `crossSite` data the case matrix needs). Selecting a candidate not yet in
  any Set shows a `Join Set & Share` confirmation; selecting one already in a
  different Set shows `Merge Sets & Share`; both name the affected Field/Set
  and member count, state the resulting Set membership change and that every
  ordinary shared Template becomes available in it, default no scope-
  broadening choice, and dispatch `JOIN_SET_AND_SHARE`/`MERGE_SETS_AND_SHARE`
  exactly once behind the existing `sharedActionBusy` disable-while-in-flight
  pattern. Two new `LastAction` cases (`join-set-and-share`,
  `merge-sets-and-share`) wire `Undo` to `UNDO_JOIN_SET_AND_SHARE`/
  `UNDO_MERGE_SETS_AND_SHARE` with the exact stale-safe payload those commands
  require. One small repository addition was needed beyond Addendum B's own
  text: `JoinSetAndShareInput` gained an optional `allowCrossSite` flag
  (threaded into its internal `addSharedTemplateSetMemberUnlocked` call and
  the `JOIN_SET_AND_SHARE` message/guard), because the reused Finder candidate
  list includes cross-Site matches (Task 024) and the composite must honor the
  same explicit opt-in `addSharedTemplateSetMember` already requires - never
  silently permit, never silently forbid. **Left explicitly out of scope**:
  `Share this version` when the owner has no current Set at all
  (`mySharedSet` is null) and wants to share with a specific target Field -
  correctly out of scope, and since verified to be unreachable rather than a
  pending product decision (see the correction in the 2026-09-06 entry
  below). Evidence:
  `npm run typecheck`, `npm test` (49 files, 626 unit tests, up from 616 - one
  new repository regression for the `allowCrossSite` addition and two new
  Inline Picker component tests covering confirmation copy, busy state, exact
  message dispatch, and field/session targeting for both composites), and
  `npm run check` (typecheck, tests, build; content-script bundle unaffected -
  no new repository value import) all pass. `explicit-template-audience-
  scope.spec.ts` gained two headed E2E tests - `Join Set & Share` and `Merge
  Sets & Share`, each covering the confirmation copy, the single dispatch, and
  Undo restoring the pre-operation state exactly - and the complete headed
  Playwright suite passes, **43/43, no skips**. What remains before Addendum B
  can be accepted: the project owner's hands-on QA, and a decision on the
  no-Set-and-cross-Field-target scope question above (in scope for a future
  addendum if the owner wants it covered).
- 2026-09-06: Synced the current Codex Engineering Starter Kit workflow
  updates into FillNest's agent-facing process files. Added the repository-
  local `show-me` skill for Markdown-native visual explanations; recorded the
  explicit authorization requirement before creating, writing, or opening
  explanatory HTML artifacts while preserving normal product UI, source HTML,
  fixture, and ordinary webpage access for implementation/debugging/QA;
  updated the handoff guide, README, `implement`,
  `to-spec`, and `code-review` skills to keep Task Contract acceptance
  separate from execution authorization through explicit `Contract`,
  `Execution`, and `Acceptance` state, to require owning Task/addendum
  coverage for cross-Task repairs, and to close all actionable P0/P1/P2 review
  findings unless explicitly deferred into a documented next gate. Validation
  for this documentation/process
  sync: the changed/new process skills (`code-review`, `implement`,
  `to-spec`, and `show-me`) pass structure validation, project-local
  `agents/openai.yaml` files parse as YAML, and `git diff --check` passes.
  Full historical skill validation is still blocked by pre-existing
  `disable-model-invocation` frontmatter in older unmodified imported skills.
  Follow-up process bugfix: merged the duplicated `Task State` and
  `Authorization Gate` sections in the `to-spec` template into one `Task State
  And Authorization` section so Contract, Execution, and Acceptance status have
  one source of truth. Validation passes for the changed process skills, YAML
  metadata, and `git diff --check`.
- 2026-09-06: A third audit, focused on the Bind and Share commands, found
  five further issues after Addendum A landed; all are fixed with regression
  coverage. **K** `bindTemplateToFieldOnly` had no existing-relationship
  guard, so repeating `Bind to this field` (a double-click before the Search
  row re-renders) produced a duplicate `setId:templateId:owner` pair and the
  commit was rejected with `InvalidStoredDataError`; it is now idempotent for
  the same relationship exactly as its sibling `bindTemplateShared` already
  was, while a different owner's own Field-only relationship to the same
  Template still creates its own slot (A.1 coexistence). **L** `Join Set &
  Share` could not be undone whenever the joining Field brought the same
  Template: the join creates an ordinary slot, so the promotion ran in A.3
  mode 2, and its Undo reinstates the consumed owner-only slot by appending
  it - byte-identical records in a different array order.
  `undoAddSharedTemplateSetMember` compared with `JSON.stringify`, which is
  order-sensitive, and rejected the composite Undo as stale (acceptance 4
  unmet). The merge path was unaffected because its own check already sorted
  by id, so that check is hoisted to a shared `sameSharedBindings` helper and
  reused; it still rejects any genuine change, including a bare promotion.
  **Owner assertion:** `promoteFieldOnlySlot` took no acting Field at all, so
  the contract's "expanded only by an explicit action by its owner" was
  enforced by UI convention rather than by the command. `fieldProfileId` is
  now part of `PROMOTE_FIELD_ONLY_SLOT`, `JOIN_SET_AND_SHARE` and
  `MERGE_SETS_AND_SHARE` (payload guards included) and the repository asserts
  the acting Field owns the named slot. **Dangling private slot:** once a Set
  gained an ordinary slot for a Template a Field still held privately (via
  Merge, or a peer's `Bind to Shared Set`), the collapsed entry reported
  `isFieldOnly: false`, which hid `Share this version` - the only action
  allowed to collapse the two - leaving the private slot unshareable,
  unremovable, and its usage silently pooled into the visible item. The
  resolver now also exposes `fieldOnlySlotId` (the owner-only relation behind
  an entry, independent of whether the entry as a whole is private); both
  surfaces offer `Share this version` for exactly those and target that slot,
  never the collapsed entry's primary relation. Per the project owner's
  2026-09-06 decision this stays an explicit user action - the resolver never
  auto-collapses, keeping A.1's "only Share this version may collapse" rule
  literally true. **Pre-mutation scope disclosure:** `Share this version` was
  one-click on both surfaces and disclosed its scope only afterwards, against
  Task 027's Explicit Scope UI rule ("Scope-changing actions state the
  affected Field or Set and member count before mutation"). Both surfaces now
  confirm first, naming the Set and its member count, and in mode 2 stating
  that the Field's separate private version will be merged into the Set's
  existing shared entry; the confirm control is `Share with the Set`, distinct
  from the row's `Share this version` trigger. The Side Panel uses the shared
  `ModalDialog` with the same focus-restore discipline as the deletion flow.
  Also corrected: `tests/e2e/find-similar-field.spec.ts` still clicked a
  button named `Save a copy for shared fields`, which Task 026 renamed to
  `Save for shared fields` - a stale assertion, not a product defect. This
  was the "known pre-existing, unrelated failure" recorded in the earlier
  entry below; with it corrected the headed suite is green. Evidence: `npm
  run check` (49 files, 616 unit tests, typecheck, build; content-script
  bundle 115.69 kB / 26 modules - still no repository value import) and the
  complete headed Playwright suite, **41/41 passing, no skips**. Hands-on QA
  remains the open gate for Task 027.

- 2026-09-06: Task 027 Addendum A (Relationship-Targeted Remediation) is
  implemented in full across its four slices, fixing all 10 lettered defects
  (A-J) from the second external audit. **A** `unbindTemplateShared` now
  takes `{ setId, slotId }` instead of `{ setId, templateId }`, so it deletes
  exactly one slot instead of every slot for a Template (the message type,
  service-worker pass-through, and both UI call sites moved with it). **B**
  `bindTemplateShared`'s existing-slot short-circuit now matches an ordinary
  slot only, so a peer's owner-only slot for the same Template no longer
  silently no-ops the Bind. **C**/**G** `promoteFieldOnlySlot` gained a
  second "consume" mode (Addendum A.3): when the target Set already shares a
  slot's Template through an ordinary slot, the owner-only slot's usage is
  summed into it and both slot and any of the owner's own field-states on
  either slot are deleted, instead of throwing `InvalidStoredDataError`;
  `mergeSetsAndShare`/`undoMergeSetsAndShare` and
  `joinSetAndShare`/`undoJoinSetAndShare` carry the new `consumedSlot`/
  `previousOrdinarySlot`/`removedFieldStates` fields through so Undo can
  reconstruct and stale-check the exact pre-promotion pair. **D** the
  resolver (`effectiveTemplateListForField`) and the Inline Picker's local
  mirror now collapse every relation resolving to the same Template into one
  entry carrying an ordered `relations` list (new `TemplateRelationRef`
  type), so a Field with both an ordinary and an owner-only slot for one
  Template resolves it once, not twice, and `Share this version` always
  targets the correct primary relation instead of an arbitrarily-picked one.
  **E** `endSharedTemplateSet` now iterates the Set's owner-only slots
  directly and resolves each against its own owner's field state (Override
  converts the Override's Template, Exclusion converts nothing, otherwise the
  slot's base Template) instead of filtering `entry.isFieldOnly`, which the
  resolver deliberately sets `false` for an Override - the old filter
  discarded an overridden owner-only slot's content outright. **F**
  `saveTemplateCopyForSharedSet` now takes `{ setId, slotId, content }` and
  spreads the existing slot record (preserving `ownerFieldProfileId`) instead
  of rebuilding it literal-by-literal; `resolveTemplateEditScope` gained a
  `"shared-field-only"` scope (offering one "Save for this field" button
  wired to the same Set-level copy command, which stays private because it
  targets the owner-only slot) and now excludes a slot the current Field
  cannot see from its effective-use count. **H**/**I** in
  `resetSiteMappingsBatchUnlocked`, the sole-survivor snapshot now skips any
  slot owned by a Field other than the survivor (H), and the "2+ members
  survive" branch now drops every slot owned by a removed member instead of
  leaving its `ownerFieldProfileId` pointing outside the surviving membership
  (I). **J** `addSharedTemplateSetMember`'s snapshot dedupe now matches an
  ordinary slot only, so a joining Field's own Template is never folded into
  a peer's owner-only slot. The merge's Site Affinity update
  (`mergeSharedTemplateSets`) now only affiliates Templates reachable through
  an ordinary slot, so an owner-only slot's private Template no longer gains
  every merged Site's affinity. A pre-existing Task 026 gap surfaced while
  fixing I is recorded as its own bounded repair, not folded into Task 027:
  `resetSiteMappingsBatchUnlocked` never pruned `sharedTemplateFieldStates`
  at all; it now removes rows whose Set was removed, whose own Field was
  cleared, or whose slot no longer exists. One Slice 4 table item (an archive
  owner-membership/slot-reference check) was found already correct against
  current code before any change - `validateCandidateState`'s existing
  membership/slot-reference checks are already reused inside
  `archive-contract.ts`'s parse-time validation and already convert to
  `InvalidBackupArchiveError`, confirmed by a dedicated probe test before
  writing the pinning regression test; no code change was needed there, only
  the pinning test. `tests/unit/task-027-remediation.test.ts` adds one
  regression per lettered defect plus the collapse-provenance and
  promotion-Undo-after-collapse-staleness tests Addendum A.6 calls for (14
  tests total, all independently verified against the pre-fix code by
  tracing the exact lines each defect described before writing its fix).
  `npm run typecheck`, `npm test` (49 files, 610 tests), and `npm run check`
  (adding the build/content-script-bundle-size inspection) all pass; the
  content-script bundle was spot-checked post-build for repository-only
  symbols (`effectiveTemplateListForField`, `validateCandidateState`,
  `runMutation`) and contains none, confirming the Picker's local resolver
  mirror still holds the line Addendum A.5 requires. The full headed
  Playwright E2E suite passes 40/41, with the one known pre-existing,
  unrelated `find-similar-field.spec.ts` failure untouched per A.7;
  `explicit-template-audience-scope.spec.ts` gained a second test covering
  Addendum A.3's "consume" mode and its distinct confirmation copy
  ("merged into the Set's existing shared entry"), alongside the existing
  mode-1 promotion test. The user's hands-on QA acceptance remains the
  outstanding gate.
- 2026-09-06: An external audit of Task 027's initial implementation found 5
  real correctness bugs before the user's hands-on QA began; each was
  independently re-verified against the code (not accepted or dismissed on
  the audit's word alone) and fixed: (1) `removeSharedTemplateSetMember`'s
  "Set survives with 2+ members" branch never removed a departing owner's
  Field-only slot from `sharedTemplateBindings`, leaving an orphaned slot
  whose `ownerFieldProfileId` pointed outside the Set's own membership - the
  very invariant Task 027 added, so the next `read()`/`commit()` would throw
  `InvalidStoredDataError`. (2) `moveSharedTemplateSetMember` converted an
  owner's Field-only slot into a plain direct Binding, but the mover
  simultaneously joins the destination Set in the same commit, and the
  resolver's Set branch never consults direct Bindings for a current Set
  member - the "preserved" Template silently went dormant to its own owner.
  Fixed by migrating the slot itself into the destination Set (same owner)
  instead of downgrading it to a Binding. (3) `endSharedTemplateSet` wiped
  every slot in the ending Set, including owner-only ones, with no
  conversion step at all - an owner's Field-only Template simply vanished
  instead of becoming a direct Binding for its owner, as the contract
  requires; now it does. (4) `mergeSharedTemplateSets` deduped slots purely
  by Template id, so an owner-only slot on one side and an ordinary slot on
  the other for the same Template collided - either silently exposing the
  owner-only relationship to the merged Set, or silently dropping an
  ordinary member's pre-merge access. Owner-only slots now never dedupe with
  anything; the `sharedTemplatePairs` uniqueness invariant is relaxed from
  `setId:templateId` to `setId:templateId:owner` to permit the resulting
  coexistence. (5) The merge Undo staleness check compared
  `id/templateId/usageCount/revision/order` but not `ownerFieldProfileId`;
  `promoteFieldOnlySlot` preserves all of those and only clears the owner,
  so a stale Undo after a promotion would silently succeed and revert it -
  now `ownerFieldProfileId` is part of the comparison. All five fixes ship
  with dedicated regression coverage (new unit tests for the 3+-member
  removal, End Set conversion, both merge-dedup collision directions, and
  the merge-Undo-after-promotion staleness case). `npm run check` (48 files,
  596 tests, typecheck, build) and the full headed Playwright E2E suite pass
  (the one known pre-existing, unrelated `find-similar-field.spec.ts` failure
  aside, 39/40). The audit's remaining points (composite-command atomicity,
  UI/E2E breadth for Join/Merge & Share) were reviewed and are scope
  observations, not correctness defects: both composite commands run inside
  one `runMutation`, so a thrown error aborts before any `commit()` and
  cannot leave partial state.
- 2026-09-05: Fixed a Task 026 Stop sharing regression found in the active
  Chrome profile. A Field's pre-share direct Bindings are intentionally
  dormant while it is a Shared Template Set member; the Stop sharing
  transition incorrectly appended its current effective snapshot to that
  dormant list, resurrecting a superseded or excluded Template. Stop sharing
  now replaces dormant Bindings with the effective list and records the
  displaced Bindings for exact Undo restoration. The typed Picker, Side
  Panel, and runtime Undo path carry that reversible snapshot. Regression
  coverage includes an explicitly excluded superseding shared slot and proves
  that its dormant predecessor never reappears. `npm run typecheck` and
  `npm test` pass (571 unit tests).
- 2026-09-05: Task 026 implementation evidence. Schema v9 additively adds
  `sharedTemplateFieldStates` (Slots/Overrides/Exclusions), validated for id
  uniqueness, referential integrity against Sets/slots/Templates, and
  duplicate-tuple rejection; migration from v8 is additive. New atomic,
  Undo-covered repository commands: `saveTemplateOverrideForField`,
  `excludeSharedTemplateForField`, `createTemplateAndBindSharedFieldOnly`
  (the Picker's "Save only for this field" on a brand-new shared Template).
  `effectiveTemplateListForField` is the single per-slot inherit/override/
  exclude resolver reused by the Picker, Side Panel `This tab` (rebuilt onto
  it, including `notOfferedAnywhere` no longer misreporting a live shared
  Template as unused), insertion, usage accounting, and deletion impact.
  Fixed a real, independently-discovered defect: deleting a Template that
  was a shared slot's own base, or the target of a Field's Override, left a
  dangling `sharedTemplateFieldStates` row and corrupted the very next
  `read()` (`InvalidStoredDataError`) - both single and batch delete now
  clean up dependent Slots/Overrides/Exclusions, and their Undo restores
  them exactly. Cross-Site merge (Task 024) now remaps every Override/
  Exclusion from a deduplicated slot onto the surviving canonical slot,
  Undoable. `resolveTemplateEditScope`'s pre-existing
  `affectsMultipleContexts` calculation is fixed to stop counting Site
  Affinities (a real contract violation of acceptance 4, caught by a
  regression test). Backup/Restore round-trips Slots/Overrides/Exclusions
  through the archive contract and repository validation. `npm run check`
  passes (typecheck, 570 unit tests, build; content-script bundle unchanged
  at ~110 KB/26 modules - Picker code never imports a repository value, only
  types, to avoid re-bloating the content script). The full headed Playwright
  E2E suite passes except one pre-existing, pre-Task-026 failure
  (`find-similar-field.spec.ts`, reproduced identically on the unmodified
  branch, unrelated to this work); a new
  `shared-template-per-field-overrides.spec.ts` E2E covers Save-for-this-
  field, Remove-from-this-field, and both Undos through the real Picker.
  Side Panel `This tab` full shared-set parity (viewing, scope-accurate
  editing, and field-scoped exclude for a Set member) and the cross-Site
  merge remap are covered by new/extended unit tests only, not yet by a
  dedicated headed E2E - remaining acceptance-7 E2E breadth (Side Panel
  scope presentation, Set copy, cross-Site Sets) is the main gap before this
  Task can be marked fully accepted.
- 2026-09-05: The project owner explicitly deferred Task 025's manual
  VoiceOver/live-announcement and Chrome 200%/400% zoom/reflow QA until
  pre-release or post-MCP work, prioritizing core extension behaviour. Task
  025 remains implemented and automatically verified, but is not manually
  accepted.
- 2026-09-05: Shared-set growth now unions the joining independent Field's
  Templates into the shared list, including cross-Site Share in either
  direction and same-Site add-member paths. Direct bindings remain intact;
  ordering, ID deduplication, usage, and all-member Site Affinities are
  preserved. Undo restores the prior Set/list and rejects stale snapshots.
  Tasks 021/024 record the bounded repair. `npm run check` passes: 47 files,
  538 tests, typecheck and verified build. All 6 headed sharing/discovery
  tests pass across the five relevant specs, including three-member
  cross-Site join, Undo, rejoin, and Stop sharing. Independent scoped review
  found no actionable issues. Full unrelated E2E suite was not rerun for
  this bounded repair; the second Site uses the existing seeded-profile
  fixture. User-site hands-on confirmation remains pending. Reload the built
  extension and affected pages; for an already affected group, Stop sharing
  on the joining Field and share again. Existing Sets are not auto-migrated
  because dormant bindings may reflect deliberate shared-list removals.

- 2026-09-05: Finder current-page row hover and page-field preview now share
  the entire row hit area. A headed E2E regression covers hovering the row
  padding specifically, which formerly tinted the Finder without highlighting
  the corresponding page Field. `npm run check` passes (47 test files, 533
  tests, verified build).
- 2026-09-05: A Finder `Locate on page` mouse action no longer leaves its
  previous row visually active after the pointer moves to another Field. The
  page preview remains transient and singular; keyboard activation retains
  its visible focus state. The targeted headed Playwright regression passes.
- 2026-09-05: `In this page` now places its non-selectable `Focused field`
  anchor at the Current Field's actual DOM position when expanded, between its
  preceding and following Field rows. The compact list retains its preceding
  count and following-neighbour orientation. The relevant unit and headed E2E
  checks pass.
- 2026-09-05: Finder Search result metadata is compacted without losing
  disambiguation. Field identity and Template preview remain left-aligned;
  the middle context now shows a bold Site, Page, and only the necessary
  cross-Site purpose caution, with `Share` unchanged on the right.
  `In this page` now anchors at the Current Field and presents following
  Fields in DOM order; expansion keeps that anchor while revealing every
  other Field. A map-pin `Locate on page` button scrolls and transiently
  highlights its candidate without changing the Current Field. `npm run
  check` passes (47 unit files, 533 tests, verified build) and the complete
  headed Playwright suite passes (37/37).
- 2026-09-04: Task 024 post-completion interaction corrections are
  implemented. Side Panel `This tab` and Picker `Share with… → In this page`
  share the current-page hover/focus highlight and Field-first visual model.
  Picker context and current-page rows can explicitly edit the existing User
  Alias, including on-demand Profile creation for a deliberately named live
  Field. Finder uses `Search Fields`. Current-page and Search linking now use
  one create/join/merge scope policy. Template editing derives choices from
  effective direct/Shared relationships; Shared-set copies, deletion/restore,
  and usage accounting preserve dormant direct Bindings and Shared Bindings.
  `npm run check` passes (47 unit files, 531 tests, verified build), and the
  complete headed Playwright extension suite passes (37/37), including real
  current/live Field renaming and Shared-set copy coverage.
- 2026-09-04: Edit affordances are visually standardized on the provided
  `public/pencil.svg` asset, except the text-only Picker/Finder Field-name
  rename buttons. Those names retain visible inset hover, focus, and pressed
  states without a redundant icon. During inline rename, the input leads and
  `Save`/`Cancel` stay on the right; competing Picker sharing actions and the
  Finder row's `Share` action is hidden until editing ends.
- 2026-09-02: `npm run check` passes with TypeScript, 45 unit-test files, 510
  tests, and build-package verification. The complete headed 36-spec
  Playwright extension suite passes, including the six Task 017 lifecycle
  regressions and dedicated fixtures for the Inline Picker Review/Confirm
  flow, the Sites `Stop matching` action, and Shared Template Set creation
  and Site management. Post-implementation QA on Task 025 found and fixed
  a real defect: the Sites page "Delete newly Global Templates" dialog had
  a typed-confirmation input but never focused it on open, focusing Cancel
  instead - see the Task 025 contract for detail.
- Task 023's static contrast audit found and fixed five real WCAG failures
  across `side-panel.css`, `popup.css`, and `picker-styles.ts`: a keyboard
  focus ring at ~1.5:1 (below the 3:1 non-text-contrast minimum), a
  secondary-text gray (`#98a2b3`) and a Picker secondary-text gray
  (`#8791a5`) both at ~2.6-3.2:1 (below the 4.5:1 text minimum) used across
  more than a dozen real informational-text selectors, and a drag-handle
  icon at ~1.7:1. All were replaced with colors already used and passing
  elsewhere in the same stylesheets, with no wording, layout, or mutation
  change - see the Task 023 contract for the full list. Manual VoiceOver and
  real-Chrome-zoom verification was explicitly waived by the project owner
  to move on to Task 024. (That waiver was lifted on 2026-09-08: the session
  was performed and its findings repaired - see Addendum B5 above.)
- Task 024 Slice 2 (discovery and selection) is implemented and tested: a
  new "Find similar field" Target Field Picker in the Inline Picker offers
  Suggested/Search results and a Link/No action per Field, backed by a new
  schema V8 `compatibilityPairDecisions` record and a `findSimilarField
  Candidates` read-only query. Link is same-Site only in this Slice -
  cross-Site candidates are fully discoverable but not yet linkable, since
  that needs the repository's Site-local Shared Template Set invariant
  relaxed, which is Slice 3's scoped work. One new headed E2E spec
  (`find-similar-field.spec.ts`) proves the real end-to-end Suggested-then-
  Link flow - see the Task 024 contract for the full list.
- Task 024 Slice 3 (link commands and recovery) is implemented and tested:
  cross-Site linking and a new `mergeSharedTemplateSets`/`undoMerge
  SharedTemplateSets` command pair complete Link semantics, gated by a new
  `allowCrossSite` flag every existing Task 021 caller omits (unchanged
  Site-local-only behavior) and only Task 024's Link command sets. Found and
  fixed a real pre-existing correctness bug while reviewing what the
  relaxation touches: Site cleanup (`resetSiteMappingsBatch`, used by both
  Clear Site Data and Remove Site) ended a Shared Template Set by checking
  only its own anchor Site, which for a cross-Site Set could either
  silently end sharing for an untouched Site's member or leave a cleared
  member's Field Profile dangling in the Set (a stored-data invariant
  violation). Fixed to shrink/dissolve/end a Set based on which of its
  actual members are on the cleared Site(s), matching the existing manual-
  removal dissolution semantics. One new headed E2E spec
  (`find-similar-field-cross-site.spec.ts`) proves a real cross-Site Shared
  Template Set end to end. An independent review pass afterward found and
  this repository fixed two further real defects: `undoMergeSharedTemplate
  Sets` had no staleness check against a mutation to the merged Set itself
  (violating Task 010's global Undo-invalidation rule), and Site
  management's "Move here" could target a Field whose current Set was
  itself cross-Site-anchored, which the unmodified, deliberately Site-local
  `moveSharedTemplateSetMember` command would then reject. A follow-up
  self-review then found a third: a Shared Template Set's Templates were
  affiliated only with the Set's anchor Site, leaving a newly cross-Site-
  joined Site's own Template visibility silently incomplete - see the Task
  024 contract for the full list.
- Task 024 Slice 1 (compatibility domain and evidence) is implemented and
  unit-tested: `src/compatibility/compatibility-kind.ts` classifies Fields
  from only the generic `autocomplete`/`type` HTML vocabulary (never a
  label, name, id, or site vocabulary), distinguishing Name's given/family/
  full variants and Address's line/level/postal-code/country components;
  `src/compatibility/candidate-ranking.ts` implements the contract's exact
  deterministic ranking and the "exactly one high-confidence candidate"
  automatic-offer rule, with "No" pair decisions kept rankable for Search/
  Browse but excluded from automatic offers. Both modules are pure, with no
  repository/storage/content-script coupling yet - that is Slices 2 and 3.
  30 new synthetic positive/negative tests - see the Task 024 contract.
- Task 021 Slice 1 (domain and persistence) is implemented, unit-tested, and
  independently reviewed with no confirmed violations: `SharedTemplateSetRecord`/
  `SharedTemplateBindingRecord` (schema V7, additive V6-to-V7 migration),
  full relational invariants, and Backup/Restore archive support.
- Task 021 Slice 2 (commands and recovery) is implemented, unit-tested, and
  independently reviewed: atomic create/add/remove/move/end/rename
  set-membership commands and the three Shared-scope Template-list
  mutations, each with its own Undo, wired through the runtime-message
  layer; Clear Site Data/Remove Site now end a Site's Shared Template Sets
  too and report how many. The review found and this repository fixed a
  real defect where undoing a non-ending member removal could put one
  Field in two Shared Template Sets at once if it had rejoined elsewhere
  first - see the Task 021 contract for the full list.
- Task 021 Slice 3 (in-page Picker) is implemented, unit-tested (26 tests
  in `inline-picker.test.tsx`, 6 new), and independently reviewed:
  contextual `Add Fields` create/grow flow, `Stop sharing` for the current
  Field, shared-state indication, and scope-safe `New template`/`Bind`/
  `Unbind` that route to the Shared-scope commands with Shared-Template-
  Set-naming result text, each with its own Undo. The Standards review
  found and this repository fixed a duplicated CSS rule and an
  un-checked-for-exhaustiveness `LastAction` branching pattern (now an
  exhaustive `switch` with `assertNever`, matching `service-worker.ts`'s
  existing pattern).
- Task 021 Slice 4 (Site management and evidence) is implemented,
  unit-tested (8 new tests in `sites-page.test.tsx`, 38 total; one new
  headed E2E spec, 32 specs total), and independently reviewed:
  `Side Panel → Sites → [Site]` gains a nested "Shared Template Sets"
  section - inspect, rename, add/remove/move members (move is the first UI
  caller of Slice 2's `MOVE_SHARED_TEMPLATE_SET_MEMBER`), and end sharing,
  each mutation except rename carrying its own Undo. No new top-level Side
  Panel navigation was added. The Spec review concluded all four Task 021
  slices together satisfy the task's Acceptance section; the Standards
  review found only judgement-call items, four of which this repository
  fixed (an accessibility label on the new row's chevron and its Remove
  buttons, a CSS-duplicate comment, and a response-shape guard for
  consistency). All four Task 021 slices are now implemented and
  independently reviewed.
- The user's own hands-on QA of Task 021 found a real defect (2026-09-02):
  creating a Shared Template Set from a Field that had never been bound to
  anything failed with "Field Profile not found," because such a Field has
  no durable Field Profile until an actual Bind persists one - directly
  contradicting the Confirmed Contract's "Two empty Fields may create a
  Shared Template Set." Fixed by letting `createSharedTemplateSetUnlocked`
  create the current Field's Profile on demand, in the same commit as the
  set, given the same identity data Bind already sends.
- A user-requested cross-feature audit found a second, more serious defect
  (2026-09-02): confirming a Logical Page Match (Task 014/020) could
  silently merge a Shared Template Set member's dormant direct Binding
  into an unrelated canonical Field, leaving the member's own Bindings
  empty while its set membership stayed intact - corrupting what "stop
  sharing" is supposed to restore. Fixed by skipping the per-Field merge
  whenever either Field is a Shared Template Set member; the Rule itself
  still confirms normally.
- A third defect (2026-09-02, reported directly from a real repeating-group
  form): "Add Fields" only ever offered candidates with an already-durable
  Field Profile, so a page's dynamically-added, never-bound Fields (added
  by an "add another" button) never appeared past however many happened to
  already be durable from earlier testing - not a real 2-item limit. Fixed
  by having the content script surface live, never-bound page Fields as
  additional candidates and letting the repository create their durable
  Profiles on demand when actually shared, plus passing the current
  Field's server-resolved `siteId` down to the Picker directly (an
  in-Picker `siteIdentityFromUrl` attempt was reverted after it roughly
  tripled the content script's bundle size by pulling in `tldts-icann`).
  See the Task 021 contract for the full account of every defect.
- A fourth defect (2026-09-02, also reported directly): the Picker's single
  status row multiplexed Field state, action results, and every affordance,
  so any result suppressed the `Shared · N fields` indicator and removed
  `Add Fields`, `Stop sharing`, and `Review` until it cleared - leaving no
  way back to them. Fixed by splitting the row: `.picker-context` now
  persistently shows what the Field is, with its affordances, and a new
  `.picker-result` row carries what just happened with the single Undo.
  Only the result row is a live region. Every Task 010 invariant holds -
  one Picker Undo entry, Field-scoped, no second Undo, silent invalidation
  - and Task 011's one-result rule is Side-Panel-scoped, its Out Of Scope
  explicitly excluding Picker layout, so no contract amendment was needed.
  A stale-`error` defect found in the same inventory (the Picker never
  reset `error` anywhere) was fixed alongside it.
- Two user-requested UX changes landed with those fixes (2026-09-02):
  `Add Fields` now opens at a focused-field DOM window, with `Show all N
  other Fields` revealing the rest; and
  a request to rank Fields by a name thesaurus was declined, since
  "Automatic semantic field matching" is an explicit Task 015 Non-Goal and
  compatibility ranking is Task 024's accepted subject, gated on Task 021
  being accepted. The shortlist's ordering was initially structural only.
- A later Task 021 QA decision (2026-09-02) establishes a focused-field DOM
  window rather than name-token ordering: `Add Fields` keeps the Current Field
  as a fixed anchor and shows following candidates in page order, while the
  complete list remains one click away. Hover/focus temporarily outlines the
  live on-page Field; map-pin `Locate on page` scrolls to the same highlight
  without changing the Current Field. The user also replaced the original
  `Stop sharing` recovery rule: a departing
  Field will retain its dormant direct Bindings and receive a deduplicated
  direct snapshot of the current Shared Template Set list, then remain
  independent. The changes are implemented and passed the user's hands-on QA;
  Task 021 is accepted.
- Task 021 now automatically ends a Shared Template Set when removal would
  leave one member. Both former members keep independent deduplicated Shared
  Template snapshots; undo restores the set atomically. This removes the
  one-member state that hid otherwise eligible Fields from Picker Add Fields.
- Independently reviewed with no confirmed violations: Task 020's Schema V5
  state foundation, the additive V5-to-V6 Page Observation migration, and the
  three repository methods `resolveLogicalPageCandidate`,
  `confirmLogicalPageCandidate`, and `stopLogicalPageMatching`.
- Also independently reviewed on 2026-09-01: Task 020's message layer, Inline
  Picker review UI, Sites `Stop matching` action, Backup/Restore archive
  extension, and Site Data cleanup. All findings are resolved - see the Task
  020 contract for the list, and the Task 010 addendum for the one finding
  that needed another contract amended.
- The user's hands-on verification of the Inline Picker Review/Confirm flow
  and the Sites `Stop matching` action passed on 2026-09-01. Task 020 is
  complete and accepted.

## Defects Found While Completing Task 020

Each changed behaviour outside the new feature, so each is recorded here
rather than only inside the Task 020 contract.

- `RECORD_LOGICAL_PAGE_OBSERVATION` no longer broadcasts
  `BUSINESS_STATE_CHANGED`. The content script re-records an Observation on
  every business broadcast, so recording one could erase an unrelated Picker
  outcome message that had just been shown. No surface displays an
  Observation, so nothing needs to react to one being recorded.
- Clear Site Data and Remove Site now delete a Site's Logical Page Matching
  rules, relationship provenance, and Site-specific key together with its
  other local data, as Task 014 requires. `ResetSiteMappingsExpectedImpact`
  gained `logicalPageRuleCount` so the confirmation sheet can name how many
  rules will stop.
- Backup Archives now carry `logicalPageSiteKeys`, `logicalPageRules`, and
  `logicalPageProvenance`; a Restore previously dropped every confirmed rule
  silently. Opaque Page Observations stay excluded by design. An archive
  containing none of these restores as empty without inferring a rule, so
  older archives stay compatible and `CURRENT_ARCHIVE_VERSION` remains 1.
- Confirming a Logical Page candidate re-identifies the focused Field as the
  canonical one, which remounts the Picker's per-Field state and erased the
  confirmation's own result message. The message is now carried across that
  single transition, keyed to the Field it belongs to.
- The Review dialog's copy was a fixed sentence identical for every
  candidate, found by the user testing past the QA checklist immediately
  after acceptance - not a "migration impact preview" as Task 014 requires.
  It now names the exact Origin/Route Pattern and the specific Templates
  that would become available, computed with the same exact-identity rule
  `confirmLogicalPageCandidate` applies server-side, and states plainly that
  confirming is an ongoing match undoable from Sites > `Stop matching`. See
  the Task 020 contract addendum.

## Known Boundaries

- Task 020 uses the user-approved first-candidate evidence policy: one opaque
  Page Observation may be retained only for a PageProfile with at least one
  direct Binding. It contains exact Origin, normalized Route Pattern, a
  Site-key reference, and Site-specific feature-hash sets only. It is removed
  with the last direct Binding or the owning Site's data; no unbound-page
  observation, raw semantic text, field value, DOM data, or readable
  record-specific URL data is persisted.
- The 3 MiB Archive limit is deliberate; Restore rejects larger archives before mutation.
- V1 has no dedicated automated exact-pixel breakpoint assertions, 100+-Template load test, hostile-host-stylesheet isolation test, or full cross-surface accessibility sweep. These are acknowledged hardening opportunities, not accepted product defects.
- A Rich Text Field's identity is its accessible name, so a site that
  localizes that name loses the Binding when the user changes UI language -
  ChatGPT's composer is labelled "Ask ChatGPT" in English and "问问 ChatGPT" in
  Chinese. The alternative, keying on the ancestor chain, is what Addendum A
  had to remove because an SPA rewrites it on every view change.
- Task 036: Rich Text Field Support, **complete and accepted on 2026-09-09**,
  together with Task 016 Addendum E, Task 024 Addendum B and Task 014 Addendum
  D. The owner accepted with three things explicitly on the record: Addenda A.6
  and A.7 have no fixture coverage and rest on argument plus hands-on re-test;
  a Rich Text Field with no stable attribute is identified by its accessible
  name, so a site that localizes that name loses the Binding; and a Rich Text
  Field's text is read once after each insertion to compute one boolean, which
  is a new, narrow read outside the two cases AGENTS.md otherwise allows. An eligible
  `contenteditable` editing host is now a Field. Two bounded consequences to
  know about: a Rich Text Field's text is read once after each insertion, to
  compute one boolean saying whether the editor kept it (native controls are
  not read at all, and nothing is persisted); and a code editor is separated
  from a prose composer by having switched off all three of `spellcheck`,
  `autocorrect` and `autocapitalize`, because CodeMirror 6 declares the same
  `role="textbox"`/`aria-multiline="true"` a chat composer does.
- A Site's index page and its record pages are not comparable when their
  segment counts differ, so `chatgpt.com/` and `chatgpt.com/c/:record`,
  `claude.ai/new` and `/chat/:record`, and `gemini.google.com/app` and
  `/app/:record` are each two Page Profiles with no Review candidate between
  them. Verified against the real modules on 2026-09-09. Two different
  conversations, by contrast, are already one Page Profile with no confirmation
  needed. Loosening `routeFamily` to bridge the index case was evaluated and
  rejected - it reaches one of the three shapes and makes `/products` and
  `/products/:id` one family. The mitigation is Task 024's Link flow; the
  general fix, manual page pairing, is recorded in the Next-Version Discussion
  Queue as a separate future contract.
- Task 035 R7 is resolved (2026-09-09): one subtree scan per distinct target,
  and one shared `PageFieldSnapshot` per pass instead of a page enumeration per
  Field. A form-heavy page under churn went from +673ms to +35ms.
  `npm run bench:lifecycle` reproduces the numbers.
- Task 027 Addendum B is implemented, pending hands-on QA: the Picker's
  `Share this version` confirmation now offers `Share with a different
  field…`, which reaches `Join Set & Share`/`Merge Sets & Share` through the
  existing Finder, with confirmation copy, busy-state handling, exact Undo,
  and headed E2E coverage. Addendum B recorded one apparent remaining
  boundary - the owner having no Shared Template Set at all while picking a
  cross-Field target. That combination is unreachable, not an open question:
  a Field-only relationship *is* a Shared Template Slot, and Slots exist only
  inside Sets, so a Set-less Field has direct Bindings with no audience to
  broaden. Two independent gates enforce it - `onShareThisVersion` is
  `undefined` when `mySharedSet` is null, and the resolver's non-Set branch
  returns `fieldOnlySlotId: null` for every entry - and the repository
  invariant rejects a Slot whose owner is not a member of its own Set. No
  follow-up addendum is needed.
- Closed by owner decision (2026-09-09), recorded here because the reasoning
  was previously stated twice and wrongly. Adjacent to but distinct from the
  entry above, and owned by Tasks 021/024 rather than 027. Corrected
  2026-09-07, having first been recorded too broadly: single-Template sharing is **already possible** - a Field can
  Search for any Template and Bind it, and because a Binding references the
  Template id rather than a copy, both Fields then resolve the same record and
  a later edit reaches both. What is missing is only the *initiating* entry
  point: A cannot hand one of its Templates to B; B must go and find it.
  `Share with…` and `Link templates` do not fill that gap, because both create
  a Set and union each Field's whole effective Template list. **Decided by the
  project owner on 2026-09-09: FillNest will not add that entry point.** The
  gap is closed as a product decision, not as work to be scheduled; the
  discussion record stays under `Starting A Share From An Unshared Field` in
  the Next-Version Discussion Queue.
- Future features and product decisions are tracked in [Next-Version Discussion Queue](docs/next-version-discussion.md). They are not authorized implementation work.

## Awaiting A Decision

Nothing, as of 2026-09-11. The owner's remaining work before submission -
icons, screenshots, the Gist privacy URL and hands-on QA - is listed in Task
033 Addendum B.

## Next Gate

`0.1.2` has a staged release-local plan through Task 024. Tasks 010-012 and
016-019 are complete and accepted; Task 013 is closed without execution, with
its findings retained through Tasks 016-019. The reliable repeated-instance
positive path remains blocked on a Task 016 evidence addendum.

Task 020 is complete and accepted (2026-09-01): the repository/domain layer,
message layer, Inline Picker Review/Confirm UI, Site-management
`Stop matching` action, and Backup/Restore and Site Data cleanup for rules,
provenance, and Site keys are all implemented, independently reviewed, and
hands-on verified.

Task 015 is accepted (2026-09-01); Task 021 is complete and accepted
(2026-09-02) after delivering all four ordered
slices (domain/persistence, commands/recovery, Picker, Site management/
evidence), each implemented, unit-tested, and independently reviewed with
no unresolved findings and the user's hands-on QA. Complex-control support
evaluation remains separately scoped and must receive its own contract before
execution. Chrome Web Store Beta Readiness is the following `0.2.0` gate.
Task 024's prerequisites are satisfied and its amended contract authorizes
controlled cross-Site Shared Template Set creation, growth, and full-set
merges through explicit Link confirmation. Task 023's bounded accessibility
audit is complete; the Side Panel modal-dialog focus leak its first headed
automation found was repaired under Task 025.

Task 025's shared Side Panel modal-dialog focus lifecycle is implemented and
automatically verified. It preserves every confirmation's content and business
behaviour, contains Tab and Shift+Tab, supports idle Escape cancellation, and
restores trigger focus or an owning fallback.

Task 035's whole-extension review is complete: three defects fixed, six
findings recorded for a decision, and the sound parts written down so the next
review starts from them rather than re-deriving them.

Task 034 adds a chosen appearance - six themes in light and dark, plus System -
across all three surfaces, condenses the Settings copy, and records a UI review
whose two deferred findings (one button-class vocabulary, one switch size) are
the next cosmetic gate.

Task 023's manual VoiceOver and Chrome zoom evidence is complete. The owner
performed that session on 2026-09-08, its sixteen findings are answered in the
Task 023 contract, Addendum B5, and the owner verified the thirteen repairs in
a second session the same day. Unit coverage and the complete headed suite at
45/45 back them. Task 025's own deferred VoiceOver/zoom QA (2026-09-05) is
untouched by this and remains deferred.

Task 014 Addendum C (both slices) and Task 016 Addendum D are hands-on verified
and accepted by the owner on 2026-09-09; the session record is the first entry
under Latest Verified Checks. Nothing from that session is outstanding.

**The agreed order of the remaining work, set by the owner on 2026-09-09:**

1. **`contenteditable` support - `tasks/036-rich-text-field-support.md`,
   complete and accepted on 2026-09-09 after the owner's hands-on QA.** It settles eligibility (declared by `role="textbox"` or an
   accessible name, with grid/code/single-line structures excluded), tiered
   Binding (insertion for every eligible host, Binding only where an accessible
   name gives a stable key), Selection/Range insertion with post-insertion
   verification and no synthetic key events, and a clipboard fallback that is
   written only on an explicit user click. Named AI chat sites are acceptance
   evidence, never code. Task 016 Addendum E and Task 024 Addendum B were
   accepted with it; the contract records what each buys.
2. **Task 035 R7 - lifecycle mutation cost.** Resolved on 2026-09-09: measured,
   then reduced (see Known Boundaries).
3. **Task 033 - Chrome Web Store Beta Readiness.** Deliberately last. Its
   engineering items are done; the rest are owner-blocked on artwork
   (16/32/48/128 plus the 128x128 store icon), at least one 1280x800
   screenshot, approval of the drafted descriptions and permission
   justifications, a hosting location for `docs/privacy-policy.md`, and the
   version bump to `0.2.0`. `npm run verify:store` reports what is still
   missing.

Not scheduled: the `Share with…` initiating entry point (declined 2026-09-09)
and root-level single-segment slug matching (declined 2026-09-09).
