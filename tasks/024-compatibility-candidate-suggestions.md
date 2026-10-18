# Task 024 — Compatibility Candidate Suggestions

**Version:** `0.1.2 Task 15`  
**Status:** **Complete and accepted by the project owner on 2026-09-08.** The owner reported that this Task's behaviour was exercised throughout the hands-on QA of Tasks 025, 026 and 027, with every defect found there filed and repaired, and judged it accepted on that basis rather than through a separate QA pass.

**Original status:** Implemented — all four Slices complete 2026-09-02; hands-on QA
and final acceptance remaining
**Prerequisites:** Tasks 019, 020, and 021 must be complete and accepted.

## Goal

Let users discover another Field that may use the same Templates, then make a
clear, deliberate linking decision. The feature offers local, explainable
compatibility suggestions without guessing a relationship into existence.

## User Value

Users can reuse useful Template lists across related Fields, including across
Sites when they deliberately choose to do so, without having to remember every
previous Page and Field manually. Automatic suggestions save time only when
their evidence is strong; Search and Browse retain user control when it is not.

## Confirmed Contract

### Scope, Identity, And Privacy

- This Task adds a third, separate capability: compatibility candidates and
  the only authorized cross-Site Shared Template Set extension. It does not
  redefine exact Field identity, logical Page identity, or repeated
  FieldInstance resolution.
- The compatibility engine is local, deterministic, generic, and explainable.
  It may inspect eligible Field metadata and stored FillNest records, but never
  reads a webpage Field value, uses a network service, uses an AI model,
  embeddings, telemetry, or automatic learning.
- Existing sensitive and Eligibility-vetoed Fields are never suggested and
  never exposed as linkable Search or Browse results.
- Candidate rules must not depend on a named Site, record URL, field label,
  selector, schema, or business vocabulary from a target website.
- Explicit user decisions are per candidate Field pair only. Confirm creates
  the defined relationship, `No` records that the pair must not be
  automatically re-offered, and a plain dismissal suppresses the current
  automatic offer. A dismissed pair is re-offered if the user subsequently
  uses one of that candidate's Template previews in the normal Picker. These
  decisions do not train or change the compatibility engine globally.

### Candidate Availability And Ranking

- A Field is discoverable in `Find similar field` only when it has a non-empty
  effective Template list. That list may be direct or supplied by a Shared
  Template Set; a formerly empty Field becomes discoverable after it joins a
  set.
- An empty Current Field may still open `Find similar field` and link a
  discoverable source Field. A still-empty Field is never a source result.
- Automatic Suggested results appear only when there is exactly one
  high-confidence candidate. Insufficient or tied evidence produces no
  automatic offer and leaves the user with explicit Search and Browse.
- Cross-Site automatic suggestions are limited to well-defined simple semantic
  Fields: Name (with incompatible variants such as full, given, and family
  names distinguished), Email, Phone, and Address (with address components
  distinguished). Complex or weakly canonical Fields may receive a
  same-Site suggestion only when evidence is sufficiently strong; they are
  never automatically suggested across Sites.
- Candidate ordering is deterministic: compatibility evidence, existing
  effective-list usage count, existing update or creation time, System Display
  Label alphabetically, then opaque FieldProfile ID. The feature creates no
  new counters or timestamps solely to rank candidates.

### Discovery UI

- `Find similar field` opens a Target Field Picker. Its persistent header
  identifies the non-selectable Current Field; every result is a target Field,
  never an individual Template.
- The Picker has three discovery modes that produce one target-result model:
  Suggested Fields, Search, and progressive Browse. It is not a Template
  Library, Tree Browser, or insertion surface.
- Suggested results show at most five genuinely useful candidates. Search is
  local and may match stored Template content, Field label, canonical meaning,
  group or subject label, Page label, Site label, and known generic aliases.
  Search and Browse may expose any non-vetoed Field across Sites, including
  complex Fields; explicit intent is not limited by the automatic-recommendation
  policy.
- Each compact Field result shows a disambiguating Field identity, restrained
  Site/Page context, at most two truncated Template previews, total count, and
  one concise reason or warning. Template previews in this Target Field Picker
  are recognition-only and cannot insert content.
- Search result rows avoid duplicating their Site/Page context. The Field
  identity and Template preview remain on the left; a middle context label
  shows the **Site** followed by the Page, plus the concise cross-Site caution
  where relevant; the `Share` action remains on the right. The Site
  name itself communicates that a result is external, so no separate
  “Different Site” label is rendered.
- Browse is progressive (`Site → Page → Group where available → Field`), not
  an expanded tree. The Current Field never appears as a result. Already-linked
  targets are clearly shown as linked and cannot be linked again.
- Search has keyboard focus on open; keyboard users can navigate results,
  activate the Link action, and close with Escape.
- The ordinary Field Picker remains distinct. Its automatic candidate preview
  may render source Templates at reduced emphasis and allow a deliberate
  one-off insertion. That insertion does not Confirm, Bind, share, or otherwise
  create a relationship.

### Link Semantics

- The visible action is `Link templates`. It is the ordinary explicit
  confirmation; only an action that joins or merges an existing multi-Field
  Shared Template Set requires an additional scope confirmation.
- Same-Site linking uses Task 015 Shared Template Set semantics. Cross-Site
  linking extends those same semantics: if neither Field is shared, create one
  Set from their deduplicated union; if one is shared, add the other; and if
  both belong to distinct Sets, merge their complete memberships and effective
  lists. The result may span Sites.
- A link that grows or merges a Set requires a scope confirmation naming the
  affected Field and Site counts. A merge retains the Current Field Set's
  custom name, removes the other Set, and gives every member the deduplicated
  ordered union. The operation is never partial: Name1–Name2 and Name3–Name4
  become one four-member Set when any member from each Set is linked.
- The Shared Set is a local, bidirectional relationship: subsequent `New
  template`, `Bind existing`, and `Unbind` mutations affect every member,
  including members on other Sites. `Stop sharing`, Site cleanup, automatic
  one-member dissolution, global Template edits/deletion, and Undo retain the
  existing Task 015 semantics for all affected members.
- A manually selected cross-Site complex Field shows a lightweight warning that
  the Fields are on different Sites and may have different purposes. The Link
  action remains one explicit operation unless it grows or merges an existing
  Shared Template Set, in which case the required scope confirmation applies.
- Cross-Site linking never copies a Template entity, creates a network link,
  reads a webpage value, or enables a Set to grow across Sites without another
  explicit Link confirmation.

### Recovery, Contacts, And Boundaries

- Every Link operation is atomic and provides one Undo that restores the full
  pre-command relationship state, including pre-merge set membership, names,
  and ordered bindings. Task 010's global rule remains absolute: any later
  successful FillNest data, setting, or relationship mutation invalidates it.
- Structured Contact Info and confirmed multi-Field filling remain a separate
  future capability. Candidate matching only connects Fields to plain-text
  Template lists; it must not infer a person, build a Contact record, or fill
  related Fields automatically.

## Explicit Non-Goals

- Automatic creation of a Shared Template Set or Binding without a user Link
  action.
- Cross-Site sharing without an explicit `Link templates` action, external or
  account-based synchronization, import refresh, or retained import
  provenance.
- A Template-centric relationship picker, automatic Template insertion from
  the Target Field Picker, or a full tree browser.
- Site-specific compatibility rules, machine learning, remote services,
  telemetry, or value-based semantic inference.
- Structured Contacts, personal profile inference, multi-Field filling,
  Repeat Context resolution, Conditional Template Scopes, or changes to
  existing Eligibility vetoes.

## Slices

1. **Compatibility domain and evidence:** define the generic, local candidate
   evidence model, contradictions, deterministic ranking, pair decisions, and
   synthetic positive/negative evaluation fixtures without webpage value reads.
2. **Discovery and selection:** implement the accessible Target Field Picker,
   Suggested/Search/Browse result model, local stored-Template search,
   privacy-safe previews, and automatic-offer/Dismiss/No behavior.
3. **Link commands and recovery:** implement Site-local and cross-Site Shared
   Set creation, growth, and complete-set merges; scope confirmations, atomic
   Undo, and persistence/Backup/Restore validation.
4. **Integration evidence and acceptance:** cover lifecycle eligibility,
   direct-versus-shared effective lists, cross-Site shared propagation and
   departure, keyboard operation, no-value-read evidence, regression checks,
   independent review, and hands-on QA.

## Slice 1 Evidence (2026-09-02)

Implemented `src/compatibility/compatibility-kind.ts` and
`src/compatibility/candidate-ranking.ts` - pure domain modules with no
repository, storage, or content-script coupling, per the Slice's own scope
("without webpage value reads"). Persistence for "No" pair decisions and
the Target Field Picker/Link commands that consume this evidence are Slices
2/3, not this one.

- **Kind classification is deliberately narrower than the existing
  `classifySemanticKind`** (used for Field identity in
  `src/recognition/recognition-evidence.ts`), which inspects `label`,
  `ariaLabel`, `name`, and `id` - exactly the "field label... business
  vocabulary from a target website" the Confirmed Contract forbids as
  candidate-rule evidence. `classifyCompatibilityKind` instead reads only
  the generic, standards-defined `autocomplete` token and effective input
  `type`, distinguishing Name's given/family/full variants and Address's
  line1/line2/level1/level2/postal-code/country components as the contract
  requires, with an `other`-token bucket for structural-but-non-reliable
  matches and an `unclassified` bucket (no generic evidence at all) that
  never matches, even against itself.
- **Ranking is the exact deterministic order the contract specifies:**
  evidence match, then usage count descending, then most recent of
  update/creation time descending, then System Display Label alphabetically,
  then opaque FieldProfile ID - no new counters or timestamps. Label is used
  only for this final ordering tiebreak, never for matching (matching is
  `autocomplete`/`type` only, matching the point above).
- **High confidence and cross-Site eligibility are separated from ranking
  order:** a same-Site match of any kind (including `other`) can be high
  confidence; a cross-Site match is high confidence only for the four
  reliable Name/Email/Phone/Address kinds, per `isReliableCrossSiteKind`.
  `other`-kind and `unclassified` matches are same-Site only or never
  automatic, respectively.
- **Pair decisions (the "contradictions" this Slice defines):** a `"no"`
  decision on a pair is looked up order-independently and marks that pair
  `decided` without removing it from the ranked list - it is excluded only
  from `selectAutomaticSuggestion`'s output, since Search and Browse must
  still be able to surface a "No"-decided Field on explicit user intent.
  `selectAutomaticSuggestion` returns a Field only when it is the single
  high-confidence, undecided candidate; zero or multiple ties both return
  nothing, leaving Search/Browse as the explicit path.
- **Synthetic positive/negative fixtures:** `tests/unit/compatibility-kind.test.ts`
  (14 tests) and `tests/unit/candidate-ranking.test.ts` (16 tests, each
  explicitly tagged `[positive]`/`[negative]` in its description) cover every
  rule above, including: same-Site vs. cross-Site `other`-kind matching,
  cross-Site reliable-kind matching, Name-variant and Address-component
  non-matching, full deterministic tie-break ordering, "No"-decided pairs
  remaining rankable but never automatic, and automatic-suggestion ties
  producing no offer. `npm run check` (TypeScript, 44 files / 470 unit tests,
  build) passes; the new modules are not yet imported anywhere, so the
  built bundle sizes are unchanged.

## Slice 2 Evidence (2026-09-02)

Implemented discovery/selection end to end: schema, repository, messages,
and a working Picker UI, deliberately scoped to same-Site Link only - a
genuine cross-Site or two-existing-Set merge Link, and its own scope
confirmation, is Slice 3's new work, not reused early.

- **Schema V8** (`src/storage/fillnest-repository.ts`): added
  `CompatibilityPairDecisionRecord` (`id`, `fieldProfileIdA`,
  `fieldProfileIdB`, `createdAt`) and `compatibilityPairDecisions: []` to
  `FillNestState`, with an additive V7-to-V8 migration, a validator
  (rejects a self-pair, a pair naming an unknown Field, or the same
  unordered pair recorded twice regardless of which side is A/B), and
  Backup/Restore support in `src/backup/archive-contract.ts` (an archive
  with none of this data restores with no decisions, matching the same
  backward-compatible pattern Task 015 used for Shared Template Sets).
- **`findSimilarFieldCandidates` (read-only query).** Resolves a Field's
  "kind" without any new schema field or webpage re-read: `identityKey`
  (`src/recognition/recognition-evidence.ts`) is a plain, unhashed JSON blob
  that already durably stores the generic `type`/`autocomplete` HTML
  vocabulary from the moment a Field was first recognized - Slice 1's
  `classifyCompatibilityKind` reads exactly those two fields back out via
  the new `parseGenericFieldTypeEvidence` (`src/compatibility/field-type-
  evidence.ts`), so every already-stored Field is classifiable with zero
  migration. A Field's effective Template list (direct or Shared Set) is
  resolved by a new `effectiveTemplateListForField` helper reused for both
  discoverability ("a Field is discoverable only when it has a non-empty
  effective Template list") and the ranking tiebreak's own "existing update
  or creation time" (read from the effective list's own Templates, never a
  new per-Field timestamp - the Confirmed Contract explicitly forbids
  adding one). Returns each candidate enriched with Site/Page labels, up to
  two privacy-safe truncated Template previews (recognition-only, 80 chars,
  never full content), a total count, and whether it is already linked to
  the Current Field's own Shared Template Set.
- **`recordCompatibilityPairNo`** persists a "No" decision, is idempotent
  (recording the same unordered pair twice returns the existing decision
  rather than duplicating it), and rejects a self-pair or an unknown Field
  before ever touching storage.
- **Target Field Picker UI** (`src/ui/picker/InlinePicker.tsx`), reached
  from a new "Find similar field" button next to "Add Fields"/"Stop
  sharing": a persistent header naming the Current Field; a Suggested
  section (the sole automatic candidate, when one exists); a Search input
  with keyboard focus on open, matching Field label, Page label, Site
  label, and Template preview text locally over the one query response (no
  further round trips); and a Link/No action per row. Template previews
  here are recognition-only and never insert - the ordinary Picker remains
  the only insertion surface, unchanged.
- **Link semantics (same-Site only in this Slice):** reuses Task 015's
  existing `CREATE_SHARED_TEMPLATE_SET`/`ADD_SHARED_TEMPLATE_SET_MEMBER`
  commands unchanged - if the Current Field is not yet shared, create a Set
  from the pair; if it already is, add the candidate as a member. A
  cross-Site candidate is fully discoverable (ranked, previewed, searchable)
  but its row shows "Different Site" instead of a working Link action,
  since actually linking it - or merging two already-distinct Sets - needs
  the repository's own Site-local invariant relaxed, which is Slice 3's
  explicitly-scoped new work, not something to reuse from an existing
  same-Site-only command.
- **Tests:** 3 new `findSimilarFieldCandidates`/`recordCompatibilityPairNo`
  repository test groups (discoverability, confidence tiers, alreadyLinked,
  suggestion ties, "No" exclusion, idempotency, error paths), 2 new
  Backup/Restore round-trip/backward-compat/invariant tests, 3 new Picker
  component tests (Suggested + Link, No, cross-Site non-linkable), and one
  new headed E2E regression (`tests/e2e/find-similar-field.spec.ts`)
  proving the real end-to-end flow: bind two Fields with matching generic
  `autocomplete="email"` evidence, open Find similar field, confirm the
  sole match is Suggested, Link, and verify one Shared Template Set with
  both members and both original direct Bindings surviving as dormant.
  `npm run check` (TypeScript, 45 files / 495 unit tests, build) and the
  complete headed suite (35/35 specs) pass.

## Slice 3 Evidence (2026-09-02)

Implemented cross-Site linking and the two-existing-Sets merge, completing
Link semantics end to end.

- **Site-local invariant relaxed, not removed.** `validateCandidateInvariants`
  no longer requires every Shared Template Set member's own Page to match
  the Set's `siteId` (that field is now purely an anchor/display label for
  Site management, documented as such in the repository). The *creation*
  guard stays in force by default: `createSharedTemplateSet` and
  `addSharedTemplateSetMember` both still reject a cross-Site combination
  unless the caller explicitly passes a new `allowCrossSite: true` flag -
  every existing caller (Task 021's own Add Fields flow) omits it and keeps
  the exact Site-local-only behavior it always had; only Task 024's new Link
  command ever sets it.
- **`mergeSharedTemplateSets` / `undoMergeSharedTemplateSets`** (new
  repository commands): retains the "keep" Set's (the Current Field's own
  Set) id and name, deletes the "remove" Set, and gives every member the
  deduplicated ordered union - a Template shared by both Sets keeps the
  keep-Set's own Binding identity with usage counts summed; one exclusive to
  the removed Set gets a fresh Binding now owned by the surviving Set. Undo
  is a full snapshot restore (both original Sets, names, memberships, and
  Binding lists) passed back by the client, the same pattern every other
  Shared Template Set Undo in this codebase already uses.
- **Picker Link logic** now covers all four cases the Confirmed Contract
  describes: neither Field shared (create), one shared (add the other to
  it - the CROSS-SITE add path calls the same `ADD_SHARED_TEMPLATE_SET_
  MEMBER` command as same-Site, just with `allowCrossSite: true`), and both
  already in distinct Sets (merge). A cross-Site candidate is no longer
  blocked - it shows the Confirmed Contract's required "lightweight warning
  that the Fields are on different Sites" alongside a working Link button.
- **Scope confirmation**, exactly where the Confirmed Contract requires it
  ("only an action that joins or merges an existing multi-Field Shared
  Template Set") and nowhere else: a brand-new 2-member Set links in one
  click; joining or merging an *existing* Set (same-Site or cross-Site)
  shows an inline confirmation naming the resulting Field and Site counts,
  computed from the Picker's own already-loaded state, before executing.
- **A real, independently-found-and-fixed correctness bug in existing Task
  012/021 Site cleanup code**, discovered while reviewing what the
  cross-Site relaxation touches: `resetSiteMappingsBatch` (Clear Site Data
  and Remove Site both route through it) ended a Shared Template Set purely
  by checking whether its own anchor `siteId` matched a cleared Site. For a
  cross-Site Set this was doubly wrong - clearing an unrelated Site while
  the anchor Site's members stayed untouched would silently end the whole
  Set anyway, while clearing the Set's own anchor Site while an unrelated
  member survived elsewhere would leave that member's Field Profile
  dangling in the Set, which fails `validateCandidateInvariants` on the
  very commit performing the clear. Fixed to mirror the exact automatic-
  dissolution semantics a manual single-member removal already uses: a
  cleared Site removes only its own members from a Set (shrinking it if 2+
  remain, dissolving it - restoring the sole survivor's own direct Binding -
  if only 1 would remain, ending it outright if 0 would remain).
  `deriveResetSiteMappingsImpact`'s preview count and the Sites-page
  "Clear site data" confirmation copy were both corrected to match ("This
  also removes this Site from N Shared Template Set(s); a Set only ends
  entirely if no linked Field remains on another Site").
- **Tests:** 4 new command-level cross-Site create/add/merge/undo-merge
  repository tests, 4 new Site-cleanup regression tests (shrink, dissolve-
  with-survivor-restore, full-end, impact-preview accuracy) proving the bug
  above is fixed, 2 new Picker component tests (cross-Site Link, merge scope
  confirmation), and one new headed E2E regression
  (`find-similar-field-cross-site.spec.ts`) proving a real cross-Site
  Shared Template Set is created end to end through the built extension
  (a second Site's discoverable Field is seeded directly into storage, the
  same technique the existing Shared Template Set Site-management spec
  already uses, since two local fixture servers can't produce two genuinely
  different registrable Sites without DNS setup).

### Independent Review (2026-09-02)

A second pass (fresh from this implementation, reviewing the repository
invariant relaxation, the merge command, and the Site-cleanup fix
specifically) found and this repository fixed two further real defects
before acceptance:

- **[High] `undoMergeSharedTemplateSets` had no staleness check against a
  mutation to the merged Set itself** - only that it still existed and the
  removed Set hadn't reappeared. Task 010's global rule ("any later
  successful mutation invalidates a pending Undo") was violated: adding a
  further member, a new shared Template, or a rename to the merged Set after
  the merge but before Undo would be silently discarded, restoring the stale
  pre-merge snapshot on top of it. Fixed by carrying the merged Set's own
  exact post-merge snapshot (name, membership, and Binding list) through to
  the Undo request and comparing it against current stored state before
  restoring - the same defense-in-depth every other Shared Template Set
  Undo in this codebase already has, which this one had skipped.
- **[Medium-High] Site management's "Move here" could target a Field whose
  current Set is itself cross-Site-anchored**, producing a broken action:
  `sharedSiteCandidates` (Sites page) found a candidate's current Set with
  no Site check, but `moveSharedTemplateSetMember` (an existing Task 015/021
  command, deliberately not extended for cross-Site use) still rejects a
  cross-Site move outright. Fixed by excluding such a candidate from Site
  management's Add/Move list entirely - that surface stays Site-local only,
  as designed; cross-Site linking is reachable only through the Picker's
  Find similar field.

A further self-review pass afterward, prompted by the pattern of the two
findings above, checked every place a Template's `siteAffinities` are
touched for the same class of gap and found one: **[Medium] a Shared
Template Set's Templates were affiliated only with the Set's anchor
`siteId`**, in `createSharedTemplateSetUnlocked` (a brand-new Template),
`bindTemplateSharedUnlocked` (an existing Template bound in), and
`addSharedTemplateSetMemberUnlocked` (an existing member's cross-Site join).
This was always correct pre-Task-024 (every member was necessarily on the
Set's one Site), but incomplete once a cross-Site create/add/merge can bring
in a Site a shared Template had never been affiliated with - leaving that
Template's own Site-scoped visibility (Templates-page Site filtering, "used
by N Sites" bookkeeping) silently incomplete for the newly joined Site, even
though the Shared Template Set itself was otherwise correct. Fixed by a new
`memberSiteIdsForSharedSet` helper and applying it (plus the equivalent fix
in `mergeSharedTemplateSetsUnlocked`) everywhere a Shared Template Set's
effective list gains a Template or a Site.

`npm run check` (TypeScript, 45 files / 510 unit tests, build) and the
complete headed suite (36/36 specs) pass with all three fixes and their
regression tests included.

## Slice 4 Evidence (2026-09-02)

Consolidating what Slices 1-3 already produced against Slice 4's own scope
("lifecycle eligibility, direct-versus-shared effective lists, cross-Site
shared propagation and departure, keyboard operation, no-value-read
evidence, regression checks, independent review, and hands-on QA"):

- **Lifecycle eligibility:** a `FieldProfileRecord` is only ever persisted
  through an actual Bind (`prepareBindingProfiles`, reused by every Task
  024 on-demand-creation path), which itself only runs for a Field that
  already passed `classifyField`'s eligibility gate at recognition time
  (`src/fields/field-eligibility.ts`, via `asSupportedField`). No stored
  Field is ever vetoed/sensitive by construction, so the discoverable pool
  `findSimilarFieldCandidates` builds from `state.fieldProfiles` needs no
  separate veto check of its own - already true from Slice 1's design, not
  new work.
- **Direct-versus-shared effective lists:** `effectiveTemplateListForField`
  is the one place this is resolved (Slice 2), reused unchanged by ranking,
  discoverability, and previews; covered by repository and Picker tests
  throughout Slices 1-3.
- **Cross-Site shared propagation and departure:** propagation (`New
  template`/`Bind existing`/`Unbind` on a Shared Template Set) was already
  Site-agnostic before Task 024 (these commands operate purely on `setId`),
  confirmed by the Slice 3 review; the Site-affinity fix above closes the
  one real gap found. Departure (`Stop sharing`, Site cleanup, automatic
  one-member dissolution) is exercised for cross-Site Sets by the Site-
  cleanup regression tests and the merge Undo tests.
- **Keyboard operation:** Search receives focus when the Target Field
  Picker opens; every result and action is an ordinary `<button>`, reachable
  by Tab; Escape closes the Picker via the same existing global handler
  Task 021's Add Fields flow already relies on (content-script.tsx) - no
  Task-024-specific keyboard path needed inventing.
- **No-value-read evidence:** `classifyCompatibilityKind` accepts only
  `{ effectiveType, autocomplete }` - both generic, standards-defined HTML
  vocabulary - and Slice 1's test suite asserts it never reads label/name/id
  evidence. Search matches only already-loaded Field label, Page/Site
  label, and Template preview text already present in the one
  `findSimilarFieldCandidates` response - it never re-reads the page.
- **Regression checks:** `npm run check` (TypeScript, 45 files / 510 unit
  tests, build) and the complete headed suite (36/36 specs) pass after every
  change through all four Slices.
- **Independent review:** the Slice 3 pass (repository invariants, merge
  command, Site-cleanup fix) found two real defects, both fixed with
  regression tests; a follow-up self-review pass found and fixed a third
  (Site-affinity propagation). No open findings remain.
- **Hands-on QA:** not yet performed. Per this repository's established
  acceptance pattern (Task 021's own real hands-on QA found three defects
  no automated review caught), this is the one remaining gate before
  acceptance - see the note to the project owner for a starting checklist.

## Interaction Addendum — Current-Page Recognition (2026-09-04)

The current-page Field rows exposed by the ordinary Picker's `Share with…`
flow and the Side Panel Templates `This tab` view describe the same local
Field targets. To make repeated or similarly named Fields recognisable
without reading webpage values:

- Hovering a `This tab` Field card, or moving keyboard focus within it,
  applies the existing transient theme highlight to its corresponding
  eligible Field in the active page. Leaving the card, moving focus away,
  changing view, or closing the Side Panel clears it. A page without an
  active content script is a safe no-op.
- Picker `In this page` rows use the same Field-first information hierarchy:
  an optional disclosure chevron before the label, a compact numeric
  saved-Template badge whose hover hint explains its count, and an optional
  read-only disclosure of ordered Template previews. An unbound live Field
  has a zero badge and remains a valid sharing target.
- The disclosure is recognition-only. It cannot insert, edit, delete,
  reorder, persist a Field Profile, or read a webpage Field value. Its
  Template preview text is static: hovering it does not highlight a page
  Field or expose a sharing action. Cross-page and cross-Site Search results
  remain compact candidate rows.

## Interaction Addendum — Field Naming And Unified Link Scope (2026-09-04)

- The focused Field's persistent Picker context row exposes its displayed name
  as a text-only native rename button. `Share with… → In this page` exposes
  the same control for each Field row. Field-name rename controls deliberately
  omit an Edit icon because their bordered inset/depressed hover, keyboard
  focus, and pressed treatment is the complete visual affordance. Other Edit
  actions across FillNest continue to use the provided `pencil.svg` asset with
  an action-specific accessible name.
- While a Field name is being edited, its input expands first and `Save` then
  `Cancel` remain together on the right in matching visual and keyboard order.
  The Picker context's sharing actions, including `Share with…`, and the
  corresponding Finder row's `Share` action is absent until editing
  ends. This prevents mutually exclusive rename/share actions from competing
  in the same row.
- Hover,
  keyboard focus, and press show a bordered inset/depressed treatment so the
  name is recognisably editable without relying on color alone. Both controls
  edit the existing optional **User Alias**; they do not introduce a second
  name concept.
- Explicitly naming a reliably identified live Field may create its local
  Field Profile on demand even when it has no Template. This is an intentional
  persistence boundary chosen by the user, not passive recognition or
  disclosure: it stores only the same identity/display evidence already
  allowed at explicit Bind, never the Field value. Clearing the alias restores
  the System/Observed label. An alias never changes identity, compatibility,
  ranking, Binding, or DOM order.
- The Finder input is named `Search Fields`. Ordinary Template discovery keeps
  the separate `Search templates` name.
- `In this page` and explicit Search use one Link policy. A Field in the
  Current Field's own Set is already linked and is omitted. An independent
  Field can create or join a relationship. A Field in another Set remains
  visible and can merge the two Sets. Joining or merging any existing
  multi-Field Set always shows the same affected-Field/Site scope confirmation,
  regardless of whether the user reached it through `In this page` or Search.
- Current-page saved-Template counts and disclosures always show the Field's
  effective list: Shared Bindings for a Shared member, direct Bindings
  otherwise. Their disclosed Template previews are static text and have no
  hover/focus treatment suggesting that they can be edited or selected.
- `In this page` is a DOM-order orientation list. Its compact form reports the
  number of Fields before the Current Field, then shows the Current Field and
  following candidates. When expanded, it renders every preceding Field, the
  non-selectable `Focused field` anchor at its actual DOM position, and every
  following Field. The Current Field is never fixed at the top of an expanded
  list.
- A current-page candidate's Finder-row hover and its page-field highlight use
  the same complete row hit area, including row padding and actions. They
  begin and clear together; the Finder must not show a candidate as hovered
  before the corresponding eligible page Field is highlighted.
- A current-page Finder candidate offers `Locate on page` immediately left of
  `Share`, using the provided `map-pin.svg` icon and a hover/focus tooltip.
  It smoothly scrolls the eligible webpage Field into view and applies the
  extension-owned transient highlight without focusing it or changing the
  Picker's Current Field.

## Acceptance Criteria

- Automatic results are generic, deterministic, explainable, high-confidence,
  and never create a relationship without `Link templates`.
- Search and Browse remain available when suggestions are absent and can find
  non-vetoed complex Fields across Sites through explicit user intent.
- The Target Field Picker never inserts a Template; ordinary Picker insertion
  never creates a relationship.
- Same-Site linking preserves all Task 015 Shared Template Set invariants,
  including merge, scope wording, dormant direct bindings, and recovery.
- Cross-Site linking creates or grows one explicit local Shared Template Set;
  its Template-list mutations propagate to every member, but it has no network
  synchronization, copied Template entity, automatic membership, or retained
  external provenance.
- Empty Fields are not Finder sources until they receive a non-empty effective
  list; they can still initiate a Link from their own Picker.
- Contact Info remains absent from the implementation and no candidate behavior
  infers or automatically fills personal data.
- Synthetic and extension evidence proves hard veto exclusion, no webpage value
  reads, deterministic ties, no automatic relationship creation, correct
  cross-Site propagation and departure, atomic Undo, and relevant keyboard
  flows. `npm run check`,
  headed extension regression, Spec review, Standards review, and hands-on QA
  pass before acceptance.

## Bounded Repair — Preserve Templates When Growing A Set (2026-09-05)

Authorized by the user's reported A/B shared-set plus independent C defect
and request to repair adjacent sharing defects. Adding an independent Field
must atomically union its direct Template bindings into the destination Set,
including same-Site Add Fields and Site management and Task 024 links in either
direction. Keep existing shared order, append new Template IDs in direct order,
deduplicate by Template ID, sum overlapping usage as on creation, and preserve
direct bindings unchanged. Affiliate every resulting Template with every member
Site. Dormant direct bindings of existing members stay excluded.

Undo must restore the exact prior Set membership and ordered shared bindings,
including usage/revisions, and reject a changed post-add Set or list. Stop
sharing continues to preserve direct bindings plus the current shared snapshot.
No migration re-exposes dormant bindings in existing Sets: users may have
intentionally unbound those Templates while sharing. Existing affected Fields
can Stop sharing and share again after the repair. No schema, permission,
matching, move-between-sets, or baseline changes are authorized by this repair.

Verification: focused failing-first same/cross-Site regression, full check set,
headed cross-Site Picker join/Undo/departure regression, and independent review.

Repair evidence: the two same/cross-Site regressions first failed with the
joining Template absent, then passed. Final `npm run check`: 47 files / 538
tests, typecheck and verified build pass. Six headed cases across all five
sharing/discovery specs pass, including a real Picker three-member cross-Site
join, Undo, rejoin and departure (second Site seeded by the existing fixture).
Stale Undo after rename, member removal, and later shared Template creation
is covered. Independent scoped code review found no actionable issues. Full
unrelated E2E suite was not rerun; real-site user verification remains pending.

---

# Addendum A — Share One Template With Another Field

**Status:** **Authorization withdrawn by the project owner on 2026-09-08. Not
implemented and not to be implemented.** Accepted and authorized on 2026-09-07;
withdrawn the following day.

The contract below is kept as the record of what was specified and why it was
dropped. It is not a backlog item: implementing it needs a fresh decision, not
a resumption of this one.

## Why It Was Withdrawn

It described the same capability the owner had already deferred hours earlier
while reviewing `Share this version` - letting a Field initiate sharing one of
its Templates instead of waiting for the other Field to search for it. Two
decisions on the same day pointed opposite ways, so the owner resolved them in
favour of the deferral.

The reasoning recorded then still applies: demand for a Template-first sharing
path is unproven, and it would add a second mental model - "share this Template
with a Field" alongside "share this Field's Templates" - for one outcome. See
`docs/next-version-discussion.md`, "Starting A Share From An Unshared Field",
which remains the live record of the idea.

Nothing that exists depends on this addendum. Single-Template sharing already
works in the receiving direction: a Field can Search for any Template and Bind
it, and because a Binding references the Template id rather than a copy, both
Fields resolve the same record.
**Owner:** Task 024. It established the A-initiated, cross-Field, explicitly
confirmed operation and owns the Finder this reuses. Task 021 Set semantics and
Task 027 audience semantics are consumed unchanged, not redefined.

## Goal

Let a Field hand **one** of its Templates to another Field, without creating a
Shared Template Set and without sharing anything else.

## The Actual Gap

Single-Template sharing already works, and this addendum does not add it: a
Field can Search for any Template and Bind it, and because a Binding references
the Template id rather than a copy, both Fields then resolve the same record - a
later edit reaches both.

What is missing is only the **initiating** direction. A cannot hand one of its
Templates to B; B has to go and find it. `Share with…` (Task 021) and
`Link templates` (Task 024) do not fill that gap: both create a Set and union
each Field's whole effective Template list, so B would receive everything A has
and A would receive everything B has.

## Confirmed Product Decisions

- The operation gives the target Field access to exactly one Template. It never
  creates, joins, or merges a Shared Template Set, and never changes any other
  Field's Templates.
- **The target's own state decides the mechanism**, and both mechanisms already
  exist:
  - Target **not** in a Set - a direct Binding for that Field.
  - Target **already in a Set** - an owner-only Slot in the target's own Set,
    owned by the target. A direct Binding would be dormant for a Set member
    (Task 015/021: a member's direct Bindings are dormant), so it would silently
    do nothing; the owner-only Slot is visible to the target and to no other
    member of its Set.
- **Audience stays a property of the relationship, never of the Template.** A
  Template-level `field-only` flag was reconsidered on 2026-09-07 and rejected
  again: it cannot express one Template held simultaneously as one Field's
  private Slot, another Set's ordinary Slot, and a third Field's direct
  Binding; and it would block a Field that independently Searched and found
  that Template from Binding it, contradicting Task 005. This restates Task
  027's existing Non-Goal rather than reopening it.
- **The operation acts on a Field that is not present.** The project owner
  accepted this on 2026-09-07, on the precedent that `Link templates` already
  changes a target Field's membership from the initiator's Picker behind an
  explicit confirmation. The confirmation must therefore name the target Field
  and state the exact audience.

## Scope

### Entry point

An action on the Inline Picker's own Template rows - `Share this template
with…` - that opens the existing Task 024 Finder to choose the target Field.
It reuses the Finder wholesale, including its Search-only cross-page discovery
and its existing candidate ranking. It adds no new discovery surface.

### Confirmation copy

One confirmation, before any mutation, naming the target and the resulting
audience:

- Target not in a Set: that the Template is added to that Field alone.
- Target in a Set: that only that Field will see it, and that the other members
  of its Set will not - stating the Set's name and its member count, so the
  disclosure matches the Explicit Scope UI rule Task 027 already applies to
  `Share this version`.

### Repository surface

The owner-only branch needs **no new command**: `bindTemplateToFieldOnly`
already takes `{ setId, fieldProfileId, templateId }`, validates that the Field
is a member of that Set, and is idempotent for the same relationship
(Task 028 Addendum B).

The unshared branch needs **one small addition**, and this is the only new
repository surface in this addendum. `bindTemplate` extends
`BindingTargetInput`, which requires `pageUrl` and derives the Site from it -
it is built for binding the *current* Target Field. The Picker does not know
the page URL of a Field on another page. Either:

- add a command that takes `{ templateId, fieldProfileId }` and resolves the
  Page Profile and Site from stored state, the way `bindTemplateToFieldOnly`
  already does; or
- relax `bindTemplate` so `pageUrl` is optional when the Field Profile already
  exists.

The first is preferred: it keeps `bindTemplate`'s on-demand profile creation
untouched, and it makes "bind to an existing, remote Field" a distinct
operation that cannot silently create profiles.

A Finder candidate with no durable Field Profile (`durable: false`, found live
on the current page) is on the current page by definition, so the existing
on-demand creation path already covers it.

### Undo

Both branches already have Undo: `UNDO_BIND` and
`UNDO_BIND_TEMPLATE_TO_FIELD_ONLY`. The operation records one Undo entry.

## Explicit Non-Goals

- Creating, joining, merging, or ending a Shared Template Set.
- Any Template-level audience flag or restricted Template type (Task 027
  Non-Goal, reaffirmed above).
- Sharing more than one Template per operation.
- Copying Template content. Both Fields resolve the same Template record.
- Changing what the Finder discovers, how it ranks, or the `No` pair decision.
- Any change to `Share this version`, `Join Set & Share`, or
  `Merge Sets & Share`.

## Acceptance Criteria

1. From A's Picker, sharing Template T with an unshared Field B gives B a
   direct Binding to T and changes nothing else. A keeps its own Templates; B
   keeps its own; no Set is created.
2. Sharing T with a Field B that belongs to Set S creates an owner-only Slot in
   S owned by B. B resolves T; no other member of S does, before or after.
3. No mutation occurs until the confirmation is accepted, and the confirmation
   names the target Field and - for case 2 - S and its member count.
4. Repeating the operation for the same Template and target is idempotent on
   both branches, and reports that the target already has it rather than
   creating a second relationship.
5. Undo restores the pre-operation state exactly on both branches, and one
   operation produces exactly one Undo entry.
6. Sharing T with a Field that already resolves T through any relationship is
   refused or reported as already present, never silently duplicated.
7. Unit tests cover both branches, the idempotence cases, the Undo cases, and
   the target-in-a-Set audience assertion (that peers do not resolve T). Headed
   E2E covers both branches end to end from the Picker.
8. `npm run check` and the complete headed E2E suite pass.

## Expected Implementation Slices

1. The unshared branch: the new repository command, its Undo, and unit
   coverage.
2. The Picker entry point, the Finder reuse, and the confirmation copy for both
   branches.
3. The owner-only branch wired to the existing command, with the peer-audience
   assertion.
4. Headed E2E for both branches, and the evidence record.

## Stop Conditions

- If the unshared branch cannot be expressed without touching Set semantics,
  stop: that would mean this is not the bounded operation it is scoped as.
- If the confirmation cannot state the exact audience for the target-in-a-Set
  case, stop rather than shipping a vaguer disclosure - the whole point of the
  owner-only branch is that the audience is knowable and narrow.

## Addendum B — A Structural Compatibility Kind For Rich-Text Hosts

**Status:** **Complete and accepted on 2026-09-09** with its parent Task 036. A rich-text editing host reports the structural
`effectiveType` `contenteditable`, and `classifyCompatibilityKind` maps that to
`other: rich-text` **before** consulting the `autocomplete` map - see the note
on `autocomplete="off"` below.
**Origin:** Task 036 (Rich Text Field Support) grill, decision Q11.
**Requested by:** the project owner, 2026-09-09.

Numbered B at the owner's direction on 2026-09-09: Addendum A specified
`Share this template with…`, whose authorization was withdrawn on 2026-09-08
without implementation. That record stands unedited; this is an unrelated
change.

### The Gap

`classifyCompatibilityKind` reads two standards-defined vocabularies: the
`autocomplete` token and the effective input `type`. That choice is
deliberate - this Task's Confirmed Contract forbids candidate rules that depend
on a site-authored label, `name` or `id`.

A rich-text editing host has neither vocabulary. It classifies as
`unclassified`, `compatibilityKindsMatch` rejects `unclassified` outright, and
so a rich-text Field can never produce an automatic suggestion. It remains
findable through `Find similar field`, which is Search and Browse on explicit
user intent.

The concrete cost, from the Task 036 evidence: on `chatgpt.com` the
new-conversation page and the conversation page are two Page Profiles that
cannot be compared by route. The composer on each is the same control, and the
existing Link flow is exactly the right answer - but the user has to know to go
looking for it.

### The Change

A rich-text editing host reports a **structural** effective type, so it reaches
the existing `other` branch and carries the token `rich-text`.

This uses no site-authored vocabulary. "This control is a rich-text editing
host" is a structural fact about the element in the same family as "this
control is `type="email"`", which is what the `effectiveType` input already
carries. No label, `name`, `id` or accessible name participates.

Every existing rule then applies unchanged:

- `other` is **same-Site only**. `isReliableCrossSiteKind` excludes it, so no
  cross-Site automatic suggestion is possible for a rich-text host.
- `selectAutomaticSuggestion` offers a suggestion only when there is **exactly
  one** high-confidence candidate. A Site with two or more rich-text Fields
  produces no automatic offer at all.
- A `No` decision on a pair prevents it from being offered again.

### The Resulting Behaviour

A user binds a Template in a conversation composer, then opens the
new-conversation page. It is the same Site, and there is exactly one rich-text
candidate, so the Picker offers the link. One confirmation, and both composers
carry the same effective Template list from then on.

### The Cost, Stated Plainly

On a Site with exactly two rich-text Fields serving different purposes - an
admin console with an article body and a notes box, say - the user gets one
automatic offer that is wrong. `No` dismisses it permanently for that pair. The
offer creates nothing on its own; only a confirmation does.

This was weighed against leaving rich-text hosts on manual discovery only, and
the owner chose the offer: its worst case is one refusable prompt, while the
alternative's cost is that the capability exists and is not found.

### One Thing Implementation Changed

The structural token is computed **ahead of** the `autocomplete` map, not after
it. A composer commonly carries `autocomplete="off"` - the owner's capture of
ChatGPT's shows exactly that - and the `other` branch would otherwise have
taken that literally, matching the composer with every unrelated control on the
site that also opts out of autofill. An autofill hint on a prose editor is not
a meaningful signature; "rich-text editing host" is.

### Acceptance

1. Two rich-text Fields on one Site, with exactly one candidate, produce an
   automatic suggestion.
2. Three or more rich-text Fields on one Site produce none.
3. No rich-text Field ever produces a cross-Site automatic suggestion.
4. A `No` decision suppresses re-offering, per the existing rule.
5. No label, `name`, `id` or accessible name enters the compatibility
   classifier.

## Addendum C — Offering A Group Of Rich-Text Fields At Once (Draft)

**Status:** **Accepted and implemented on 2026-09-09.**
**Origin:** The project owner, after Task 036's QA: "most people want the same
prompts in all three".
**Amends:** this Task's Confirmed Contract, which is why it is an addendum
rather than an implementation detail.

### The Rule It Changes

The Confirmed Contract says:

> Automatic Suggested results appear only when there is exactly one
> high-confidence candidate. Insufficient or tied evidence produces no
> automatic offer and leaves the user with explicit Search and Browse.

That rule is right for the case it was written for. Two candidates of the same
generic kind - two `email` Fields on two pages - are genuinely ambiguous, and
guessing between them would be exactly the kind of invention this product
refuses.

It is wrong for one case, and the owner found it. On `claude.ai` the
new-conversation page, Chat and Cowork each carry a composer. They are three
Page Profiles, so three Fields, so three Template lists. `Share with…` links
any two of them in one confirmation - the owner did it successfully - but the
**automatic** offer goes quiet from the second link onward, because by then
there are two candidates. The suggestion disappears precisely as the user
accumulates the Fields they most want linked.

### The Change

When **every** high-confidence, non-`No`-decided candidate on the Site carries
the kind `other: rich-text`, they are offered **as a group**: one suggestion
naming all of them, one confirmation, all linked.

Nothing here names a site. "Rich-text editing host" is the structural kind
Addendum B already established from the element itself, and this rule reads the
same way on a chat application, an admin console with several prose editors, or
anything else built the same way. A site allowlist was asked for and is
refused, for the reason `AGENTS.md` gives and for the practical one: it fails
silently at the next redesign.

### Why This Case Is Not The Ambiguity The Original Rule Guards

Two `email` Fields are two candidates for **one** answer - the user wants one
of them, and we cannot tell which. Three composers are not a choice at all: the
user wants all of them, and linking is not exclusive. Offering a group is
therefore not a guess between candidates; it is the same single question asked
about a set.

The floor stays where it was: **nothing is linked without an explicit
confirmation**, and the confirmation names every Field it would join.

### Bounded, So That Undo Stays Exact

The group offer applies **only when none of the candidates already belongs to a
Shared Template Set**, the current Field included.

That is not timidity, it is atomicity. `CREATE_SHARED_TEMPLATE_SET` already
accepts a list of Field Profile ids and has one Undo, so a Set-less group is a
single command, a single mutation and a single exact Undo - the standard every
other operation in this product meets. A group spanning existing Sets would be
a sequence of adds and merges with separate Undos, and a half-undone link is
worse than no offer.

When any candidate is already in a Set, behaviour is exactly today's: a single
high-confidence candidate produces the ordinary offer, anything else produces
none, and `Share with…`, Search and Browse remain. The user reaches the same
result in more steps.

### Declining

A `No` on a group records the pair decision for **every** pair it contained, so
the group is not re-offered one member at a time afterwards. A plain dismissal
suppresses the current offer only, as it does today.

### What Implementation Found: The Offer Had No Surface At All

The premise of this addendum was that the automatic offer "goes quiet from the
second link onward". That was too kind. `suggestedFieldProfileId` was computed
by `findSimilarFieldCandidates` and **returned to nobody**: no surface in the
extension read it, in any candidate count. The Confirmed Contract's automatic
Suggested result has never been shown to a user.

So this addendum does two things rather than one, and the second is a repair of
this Task rather than a change to it: the offer is given a surface, and that
surface presents a group when the group rule applies and the ordinary single
candidate when it does not. Without the single case a user with exactly two
composers would still see nothing, which is the common first state.

The offer appears in the Picker's list view and **names Fields only - never a
Template preview**. Recommending Templates before a deliberate Search is the
one thing this product does not do, and an offer that previewed the Templates
it would bring would be exactly that.

It yields to a Logical Page candidate: two questions at once is nagging.

### Acceptance

1. Three or more Set-less rich-text Fields on one Site, with no `No` between
   them, produce one grouped automatic suggestion naming each Field.
2. Confirming creates one Shared Template Set containing all of them, in one
   mutation, with one Undo that restores every Field to what it had.
3. `No` prevents the group and every pair inside it from being offered again.
4. If any candidate already belongs to a Set, no group is offered and today's
   behaviour is unchanged.
5. A mixed pool - one rich-text host and one `email` Field - produces no group;
   the grouping applies only when every candidate is a rich-text host.
6. No cross-Site group is ever offered: `other` remains same-Site only.
7. No site name, domain or selector appears in the implementation.

### C.1 — Names A Person Can Recognize

**Reported by the owner after the first successful group link, 2026-09-09:** it
worked, one click shared everything - and the Fields were listed by a name
taken from the page's markup, which the user has never seen. "Most people have
no idea what that name means, so it misleads them."

Three changes, all display only. None touches identity: the accessible name
remains a Rich Text Field's key, and what changes is what is *shown*.

**A Rich Text Field's title prefers its placeholder.** The placeholder is the
one name the user has actually read - it is printed in the empty box. An
accessible name is written for assistive technology and often says something
else: Gemini's box shows `Ask Gemini` and tells a screen reader `Enter a prompt
for Gemini`. The accessible name stays as the fallback.

**The offer says where each box is.** A derived Field name can be unfamiliar,
and the page it lives on is often the more recognizable half, so each entry
reads `<field> (<page>)` when the two differ.

**The rename affordance says what it is naming, in words that assume nothing.**
Most people have never heard a text box called a "field", and nothing on screen
explained why naming one would matter:

| | Before | After |
| --- | --- | --- |
| Trigger tooltip | `Rename field` | `Rename this box. Only you see this name.` |
| Trigger name | `Rename field "X"` | `Rename this box, currently named "X"` |
| Input name | `Name for X` | `Name for this box` |
| The same, in a list of other Fields | `Rename field "X"` | `Rename "X"` |
| Hint | none | `Names the box you are typing in. Only you see this name; FillNest shows it wherever it offers this box's Templates.` |

The hint appears only on the Field the user is typing in, where the question
arises. A rename row inside a list of other Fields already has its context, and
says which Field it renames rather than "this box" - which would be a lie
there. The word "field" leaves that row too; it is simply `Rename "X"`.

An E2E caught the difference the moment it was got wrong, by asking for the
row's rename control by name.

### C.2 — Two Defects In C, Both From The Same Blind Spot

**Reported by the owner, 2026-09-10**, on a Rich Text Field showing "This
editor has no stable identity, so a Template can be inserted here but not
remembered": a share confirmation appeared and stayed there however many times
Share was pressed.

**Sharing is a form of remembering, and C did not know it.** A link creates a
durable Field Profile and puts it in a Shared Template Set. A Field that cannot
carry a Binding cannot carry that either - so the offer, and `Share with…`
beside it, were being shown on the one Field where they cannot hold. Both are
now unavailable there, for the reason already on screen, and the offer is not
even fetched.

**And the confirmation was asked where nobody could see it.** The scope
confirmation renders only in the Finder; C's offer lives in the list. A single
candidate needing confirmation therefore set a `pendingLink` that nothing
rendered: the click did nothing visible and the offer stayed put, which is
exactly what the owner saw. The single-candidate path now opens the Finder on
the same candidates first, so the question is in front of the person being
asked it. A completed link also retires the offer, which it failed to do.

The two share a blind spot: C was designed around the group case on a normal
Field, and neither the tiered-Binding Field nor the single-candidate
confirmation was walked through end to end.

### Stop Conditions

- If the grouped confirmation cannot name every Field it would link, stop. An
  unnamed audience is the defect Task 027 Addendum E was written to fix.
- If the link cannot be one mutation with one Undo, stop and ship nothing: the
  bounded scope above exists precisely so that it can be.

## Addendum D — A Remembered No, And Undo Across Sites (2026-09-11)

**Status:** Implemented on 2026-09-11 on the owner's instruction to repair the pre-submission audit's findings; the owner's hands-on QA is pending.

**Defect 1.** A remembered "No" names two Fields. Clear Site Data and Remove
Site deleted Fields without deleting the decisions naming them, so the
integrity check refused the whole cleanup for any Site where the user had ever
answered No. **Repair:** the cleanup removes those decisions with their Field.

**Defect 2.** Undoing `Stop sharing` in a two-member cross-Site Set compared
the departing Field's Site with the Set's anchor Site, a check from before
cross-Site Sets existed. Every Undo from the other Site was refused, and the
member left behind was never checked at all. **Repair:** every former member
must still exist and belong to no other Set.

**Evidence.** `tests/unit/compatibility-decision-cleanup.test.ts`,
`tests/unit/shared-set-audit-repairs.test.ts`.

## Addendum E — A Field Left Looking Selected (2026-09-15)

**Status:** Implemented on 2026-09-15 after the owner met the defect during
the hands-on QA of Tasks 044 and 045; accepted by the owner the same day after
a re-test of both paths and of keyboard focus.

This repairs the rule above that "a current-page candidate's Finder-row hover
and its page-field highlight ... begin and clear together". On the Picker's
Field list (`Share with…`), a Field could be left looking selected for good in
two ways, both reproduced in real Chromium before the repair:

**Defect 1 - the page Field stays outlined.** A row's page highlight was
cleared only by that row's own `mouseleave` or `blur`. When the list went away
while the pointer rested on a row - `Back` pressed from the keyboard, or a
confirmation opening in the list's place - that row received neither, and its
page Field stayed outlined until the Picker closed. **Repair:** the Picker
remembers which row it last highlighted; after every render, a row no longer
drawn takes its highlight with it (`highlightFieldRow` in `InlinePicker.tsx`).

**Defect 2 - the row stays painted.** A press on a row's `Share`, dragged off
and released elsewhere, is no click, so nothing is shared, but the button keeps
the focus the press gave it. The Picker painted a row as selected on
`:focus-within`, so that row stayed highlighted wherever the pointer went.
**Repair:** a Picker row other than a Template row is painted for focus only
when the keyboard put it there (`:has(:focus-visible)`), as `Locate on page`
already refused to leave a mouse-clicked row looking active. Keyboard focus
still paints its row, and the forced-colours rule follows the same selector.
Template rows are unchanged: Task 036 Addendum J deliberately highlights the
row that holds focus, whatever put it there.

**Evidence.** Each failed before the repair:

- `tests/e2e/field-list-highlight.spec.ts` (headed): after keyboard `Back`
  from a hovered row, the page Field carries no highlight; after a pressed
  `Share` dragged off and released, nothing is shared and the row is not
  painted; `Tab` still paints the next row.
- `tests/unit/inline-picker.test.tsx` (three "page highlight" tests): the
  highlight clears when keyboard `Back`, a direct share, or a confirmation
  takes the hovered row away.
- `tests/e2e/shared-template-set-dynamic-fields.spec.ts` now also checks that
  a shared Field is not left outlined.
