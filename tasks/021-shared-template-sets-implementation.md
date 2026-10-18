# Task 021 — Shared Template Sets Implementation

**Version:** `0.1.2 Task 12`  
**Status:** All four slices implemented, unit-tested, independently
reviewed (Spec and Standards, each with findings resolved before the next
slice began), and passing the full 34-spec headed E2E suite. Four defects
found during the user's hands-on QA are fixed, along with two
user-requested UX changes - see below. The user completed hands-on QA and
accepted the Task on 2026-09-02. Future defects are handled as bounded
follow-up repairs under their owning contract.

## Defect found and fixed during hands-on QA (2026-09-02)

Creating a Shared Template Set from the Picker's "Add Fields" flow failed
with `Field Profile not found: <uuid>` whenever the *current* Field - the
one the user was sharing *from* - had never been bound to a Template
before. Root cause: a Field Profile is only ever durably persisted by an
actual Bind (`bindTemplateUnlocked`/`createTemplateAndBindUnlocked`, via
`prepareBindingProfiles`); `RESOLVE_FIELD_CONTEXT` fabricates an in-memory
`fieldProfileId` for an unrecognized Field but never writes it. The
Picker's "Add Fields" candidate list is (correctly) built only from
already-durable `state.fieldProfiles`, but `confirmAddFields` sent that
possibly-ephemeral current-Field ID as a plain member ID, with no way for
`createSharedTemplateSetUnlocked` to create it - directly contradicting
the Confirmed Contract's own "Two empty Fields may create a Shared
Template Set."

Fixed by extending `CreateSharedTemplateSetInput` with an optional
`newField` (the same identity data `BIND_TEMPLATE`/`CREATE_TEMPLATE_AND_BIND`
already send): `createSharedTemplateSetUnlocked` now creates the Field
(and its Page, if needed) via the same `prepareBindingProfiles` helper
Bind already uses, in the same commit as the set itself, before checking
membership. The Picker now always sends the current Field's identity
data with this shape; the repository only actually creates the Profile if
it doesn't already exist. Covered by a repository unit test seeding a
genuinely-nonexistent Field and a new headed E2E spec
(`shared-template-set-empty-fields.spec.ts`, 33 specs total) that binds
one Field through the real Picker UI and shares from a second Field that
was never bound at all - the exact reported scenario.

## Second defect: Logical Page Matching could silently corrupt a Shared Template Set member (2026-09-02)

The user asked for a specific cross-feature audit: does Shared Template
Sets interact safely with Task 014's Logical Page Matching? It did not.
`confirmLogicalPageCandidateUnlocked` merges an exact-identity-matched
Field pair's direct Bindings (the reviewed page's "source" Field into the
canonical Field) whenever a Logical Page Match is confirmed - and it never
checked whether either Field was a Shared Template Set member. Reproduced
directly: a Field that was already a Shared Template Set member, with a
dormant direct Binding predating its membership, had that Binding silently
merged into an unrelated canonical Field's *active* Bindings the moment an
unrelated Logical Page Match was confirmed - while the Shared Template
Set's own membership list was left completely untouched. The member's own
direct Bindings were then empty. Since "stop sharing" restores exactly a
member's own direct Bindings, ending sharing afterward would have shown
the user nothing, with their Template quietly living on a different Field
they never touched - directly violating "the Shared Template Set is the
only effective Template list for each of its members" and "direct
Bindings remain durable" (Task 015 Accepted Contract).

Fixed by skipping the per-Field-pair Binding merge entirely whenever
either the source or the canonical Field is currently a Shared Template
Set member - the Logical Page Matching Rule itself is still created, and
every other (non-shared) Field pair on the reviewed Page still merges
normally. Covered by a new repository unit test reproducing the exact
scenario found. `npm run check` (42 files, 434 tests, build) and the full
33-spec headed E2E suite still pass.

## Third defect: "Add Fields" only offered the first two dynamically-added Fields on a page (2026-09-02)

The user reported this directly, testing a real repeating-group form (a
page with a button that adds more same-kind Fields, e.g. more "Next of
Kin" entries): only the first two dynamically-added Fields could be
shared; every later one silently never appeared as an "Add Fields"
candidate at all. Root cause, in two parts:

1. `addFieldCandidates` (Picker) and `sharedSiteCandidates` (Site
   management) only ever drew candidates from already-durable
   `state.fieldProfiles` - a Field only gets a durable Field Profile from
   an actual Bind, so a page's freshly-added, never-touched Fields had no
   way to appear as candidates at all, no matter how many there were.
   (The first two "worked" in the reported case only because they
   happened to already be durable from earlier testing before this bug
   was filed - not because of any 2-item limit in the code itself.)
2. Fixing (1) surfaced a second, narrower gap: `addSharedTemplateSetMember`
   (used to grow an *existing* set) had no on-demand Field Profile
   creation the way `createSharedTemplateSet` already did after the first
   defect fix - so a genuinely-never-bound Field still couldn't be added
   to a set that already existed.

Fixed by having the content script scan the live page for every other
reliably identified Field (via the same `readDomRecognitionEvidence` the
extension already uses for Field identity) and pass those - Fields with no
stored Profile at all - to the Picker as additional "Add Fields"
candidates, merged with the existing storage-backed ones and deduplicated
against them. Selecting a live-only candidate now fabricates a Field ID
client-side and supplies its identity data as a `newFields`/`newField`
entry, so the repository can create its durable Profile in the same
commit as the set change - `CreateSharedTemplateSetInput.newField` (a
single entry, from the first defect fix) is now `newFields` (a list, since
more than one selected candidate can be new at once), and
`AddSharedTemplateSetMemberInput` gained the same on-demand-creation
support `createSharedTemplateSet` already had.

A related fix was needed to make this work at all: `addFieldCandidates`
previously could only determine "which Site is this" by looking up the
*current* Field's own (possibly non-existent) Page Profile, so a Picker
opened from a Field that had never been bound to anything couldn't
resolve a Site and returned zero candidates regardless of this fix. Fixed
by passing the already server-resolved `siteId` (from
`RESOLVE_FIELD_CONTEXT`, which always returns one) down as a new Picker
prop, rather than resolving it client-side - an initial attempt to
resolve it via `siteIdentityFromUrl(location.href)` directly in the
Picker was reverted after it pulled its `tldts-icann` dependency into the
content script bundle, roughly tripling its size (81 KB → 250 KB); the
server-resolved value needs no extra bundle weight at all.

Covered by two new repository unit tests (on-demand creation for both
`createSharedTemplateSet` and `addSharedTemplateSetMember`), a new Picker
unit test selecting the 3rd of several never-bound candidates specifically
(not just the first two), and a new headed E2E spec
(`shared-template-set-dynamic-fields.spec.ts`) with a real "add another
Field" button generating Fields and sharing with the last one - the exact
reported scenario. `npm run check` (42 files, 437 tests, build) and the
full 34-spec headed E2E suite pass.

## Fourth defect: one Picker status row multiplexed state, results, and every affordance (2026-09-02)

Reported by the user: after sharing and then saving a Template, "one
notification will cover others" and there was "no other way, or it is too
difficult to find the way," back to what was covered. Confirmed as a
functional defect, not just crowding: `.picker-context` was a single slot
with a five-branch priority cascade, and both affordance groups were
gated on `!visibleOutcome`. So **any** result - a bind, an unbind, a save,
a share - suppressed the `Shared · N fields` indicator *and* removed
`Add Fields`, `Stop sharing`, and `Review` entirely until the result
cleared, which for an undoable result only happens on a Field change or
the next mutation broadcast. No accepted contract required that
suppression.

Fixed by separating the two kinds of information the row was
multiplexing. The persistent row (`.picker-context`) now always shows what
the Field *is* - invalid / candidate / shared / following focus - with its
affordances, and never yields to a result. A new transient row
(`.picker-result`) carries what just *happened*, with the single Undo and
the `Delete template` follow-up, and appears only when there is a result.
Only the result row is a live region: ambient state is readable content,
not something to re-announce, which also keeps existing single-match
`getByRole("status")` E2E assertions valid.

This preserves every Task 010 invariant: exactly one Undo entry in the
Picker (now the result row, still the sole "Action Outcome Bar"; the
header stays Undo-free), still Field-scoped and surviving same-Field
close/reopen, still no second Undo after a successful Undo, still
silently invalidated. Task 011's one-result rule is textually scoped to
the Side Panel and its Out Of Scope explicitly excludes "Changing Picker
layout or behavior," so the Picker split needed no contract amendment.

A third, separate defect was found while inventorying the region and
fixed alongside it: the Picker's `error` had no reset anywhere in the
file, so a single failed action left a stale `role="alert"` stacked above
every later result until the Picker was destroyed. It is now cleared when
the next action begins and when the Field changes.

Deliberately not done: a notification history or log. The product's own
model is one current result per surface, and `CONTEXT.md` defines Picker
Undo as "not persistent history"; the reported problem was state and
affordances being buried by results, which the split addresses directly.
Successive results still replace each other, which Task 010 requires -
only the latest action is undoable.

## Add Fields shortlist (2026-09-02)

Also reported: "Add Fields" listed every Field on the page at once. It now
opens from the Current Field's position in the page: a non-selectable
`Focused field` anchor is followed by the next four Fields in DOM order, with
an explicit count of Fields before it and a `Show all N other Fields` control
for the complete list. Expanding preserves the focused-field anchor at the
top while the candidates themselves are shown in full DOM order. A Field the
user has already ticked stays visible even if it falls outside the shortlist,
so collapsing can never silently drop a selection.

The ordering is deliberately structural only (which page a Field is on,
its position on that page, and the Current Field as a visible anchor). It
does not compare Field names or meanings. The user asked whether to introduce
a thesaurus to rank Fields by name similarity; that is declined here, because
"Automatic semantic field matching" is an explicit Task 015 Non-Goal.

## QA addendum: candidate choice and non-lossy departure (2026-09-02)

The initial name-token selection aid is superseded by the focused-field
window above. `Add Fields` remains an explicit, same-Site selection surface:
candidate presentation follows DOM order only, never field-name similarity,
business vocabulary, or compatibility scoring. The feature does not select a
candidate, create a relationship, use a thesaurus, read a Field value, or
replace Task 024's separate compatibility discovery contract.

To make repeated names understandable, hover and keyboard focus on a
current-page candidate must temporarily identify its actual eligible Field
with an extension-owned theme-colored outline/glow. The outline is removed
on focus/hover exit, picker or Add Fields close, Field change, and content
runtime teardown. It is unavailable for a candidate not currently on the
page; no DOM information is persisted.

Each current-page candidate also exposes a compact `map-pin.svg` `Locate on
page` button immediately left of `Share`. It scrolls the corresponding Field
into view and applies the same transient extension-owned highlight, but never
focuses that webpage Field or changes the Picker's Current Field.

The user also replaced the original departure rule: `Stop sharing` must no
longer merely reveal a member's dormant direct Bindings. It atomically retains
all of those Bindings and adds a deduplicated direct-Binding snapshot of the
Shared Template Set's current ordered list. The departed Field becomes
independent, so its later mutations cannot affect the remaining Shared
Template Set and later Shared mutations cannot affect it. Undo removes only
the newly-created snapshot Bindings and restores the exact former membership
state. This applies equally to Picker and Sites management removal flows.

When removing a member from a two-Field set would leave one member, the set
ends automatically. Both Fields retain their own direct Bindings plus a
deduplicated snapshot of the former Shared list, so neither remains trapped
in a meaningless one-member Shared state. Undo removes both snapshots and
restores the former set atomically.

Slice 1 (domain and persistence) is complete and independently reviewed
against Spec and Project Standards on 2026-09-01, with no confirmed
violations.

Slice 2 (commands and recovery) is complete: atomic create (enforcing the
two-Field-at-creation floor Slice 1 could not), add member, remove member
(also used for the Picker's future "stop sharing"), move member (atomic
leave-and-join), end set, rename, and the three Shared-scope Template-list
mutations (new Template, bind existing, unbind) - each with its own Undo
following the project's snapshot-based pattern, wired through the typed
runtime-message layer with `BUSINESS_STATE_BROADCAST` entries. Clear Site
Data/Remove Site now end a Site's Shared Template Sets together with its
other local data (`sharedTemplateSetCount` added to the expected-impact
preview; `ResetSiteMappingsResult.endedSharedTemplateSetCount` reports how
many sets ended, per the Confirmed Contract). Ending sharing never strips
a Template's Site Affinity (the same rule an ordinary Unbind already
follows), so `newlyGlobalTemplates` is always empty from these paths in
V1's actual mechanics.

Independently reviewed against Spec and Project Standards on 2026-09-01.
The review found and this repository fixed two real defects before Slice 3
began: `undoRemoveSharedTemplateSetMember`'s non-ending-removal branch
could put one Field in two Shared Template Sets at once if it had rejoined
elsewhere before Undo ran (now checked globally, with a regression test),
and `resetSiteMappingsBatch`'s result silently dropped the ended-set count
the contract requires reporting (now added). A `StaleUndoError` wording
inconsistency and a duplicated Field/Page/Site-match lookup (now a shared
`resolveSiteMatchedField`/`isFieldSharedElsewhere` helper pair) were also
fixed. `npm run check` (42 files, 419 tests, build) and the full 31-spec
headed E2E suite passed on 2026-09-01.

Slice 3 (in-page Picker) is implemented: the Picker now derives the
current Field's Shared Template Set membership directly from the state it
already fetches, so no new content-script wiring was needed for shared-
state indication or scope-safe Template operations. `Add Fields` (a new
Picker mode) lists every other reliably identified same-Site Field, either
creating a new set (enforcing the two-Field floor) or growing the current
one; `Stop sharing` removes the current Field only. While shared, the
effective Template list comes only from the set's ordered shared Bindings
- dormant direct Bindings never appear - and `New template`, `Bind`, and
`Unbind` route to the Shared-scope commands with result text that names
the Shared Template Set and its Field count, per the Confirmed Contract.
All six new Picker actions (create, add member, stop sharing, and the
three Shared-scope Template mutations) carry their own Undo through the
existing `LastAction`/`undo()` mechanism. 26 unit tests in
`inline-picker.test.tsx` cover this (6 new). `npm run check` (42 files,
424 tests, build) and the full 31-spec headed E2E suite passed on
2026-09-02 - no new E2E fixture was added for this slice; dedicated
headed-extension coverage for Shared Template Sets is Slice 4's own
"regression coverage" requirement.

Independently reviewed against Spec and Project Standards on 2026-09-02.
Spec review found no confirmed violations. The Standards review found two
issues, both fixed: `.picker-context-shared`/`.picker-context-candidate`
declared byte-identical colors under two separate rules (now one combined
selector), and `undo()`/`undoLabel()`/`outcomeForAction()`'s `LastAction`
branching ended in an unguarded fallback that TypeScript could not check
for exhaustiveness (now exhaustive `switch` statements with the same
`assertNever` pattern `service-worker.ts` already uses, so a future
`LastAction` variant added without updating all three functions fails to
compile instead of silently misrouting).

Slice 4 (Site management and evidence) is implemented: `Side Panel → Sites
→ [Site]` gains a nested "Shared Template Sets" section (both the by-site
and flat address views, mirroring the Task 020 Logical Page Matching rule
precedent exactly) that inspects each set's members and effective
Template list, renames it inline (reusing `AliasLabel`), removes one
member (confirmed, reporting whether it ended the set), adds an unshared
Field directly, moves a Field already in a different Site-local set with
an explicit leave-and-join confirmation (the first UI caller of
`MOVE_SHARED_TEMPLATE_SET_MEMBER`, built in Slice 2 but unused until now),
and ends a set outright via a danger-styled confirmation. Every mutation
except rename carries its own Undo through the Side Panel's existing
notification-action mechanism. No new top-level Side Panel navigation was
added, per the Confirmed Contract. 8 new unit tests in
`sites-page.test.tsx` (38 total) and one new headed E2E spec
(`shared-template-sets-management.spec.ts`, 32 specs total) cover rename,
remove-member (both ending and non-ending), add-member, move-member, and
end-sharing. `npm run check` (42 files, 432 tests, build) and the full
32-spec headed E2E suite passed on 2026-09-02.

Independently reviewed against Spec and Project Standards on 2026-09-02.
Spec review found no confirmed violations, and explicitly concluded that
this slice, combined with the three prior ones, satisfies Task 021's full
Acceptance section (invariants trace correctly end-to-end from Picker
through Site management; each slice has its own tests and review
evidence). The Standards review found only judgement-call items, four of
which were fixed: the Shared Template Set row's expand/collapse chevron
now carries an explicit `aria-label` (a `TreeNodeRow` addition, additive
and opt-in, so the Site-group and Logical Page rule rows that already
relied on structural identification are unaffected); the cross-stylesheet
CSS duplicate between `side-panel.css` and `picker-styles.ts` now has a
comment explaining it is deliberate; each member's "Remove" button now
carries a specific `aria-label` (fixing both an accessibility gap and a
test that had to work around ambiguous same-labeled buttons); and
`addSharedMember` now validates its response shape like its sibling
handlers already did.

All four slices are now implemented, unit-tested, and independently
reviewed. What remains before acceptance is the user's hands-on QA, per
this task's own Acceptance section.

## Goal

Deliver the accepted Site-local Shared Template Set contract from Task 015 in
four independently verified slices.

## Required Order

1. **Domain and persistence:** validated model, invariants, migration, archive
   support, and unit coverage.
2. **Commands and recovery:** atomic membership/list mutations, site cleanup,
   Undo, and result wording.
3. **Picker:** contextual creation and status plus scope-safe current-Field
   actions.
4. **Site management and evidence:** nested management, confirmations,
   accessibility, regression, review, and hands-on QA.

## Invariants

- Sets are Site-local; one Field has at most one effective set; direct bindings
  remain durable but dormant for a set member.
- Cross-Site/duplicate/dangling relationships and invalid ordering are rejected
  or atomically rolled back.
- Shared mutations and Undo affect the complete set relationship state; Global
  Templates are never silently deleted.

## Non-Goals

- Cross-site/user sharing, sync, automatic matching, automatic page filling,
  or mixing direct and shared lists.

## Acceptance

- Each slice has its own tests and review evidence before the next begins.
- Reset, site cleanup/removal, Backup/Restore, and Undo invalidation preserve
  all invariants.
- Full checks, headed E2E, accessibility review, and hands-on QA have passed.

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

## Addendum A — Moving Out Of A Two-Member Set Ends It (2026-09-11)

**Superseded by Task 040 (2026-09-11):** Move no longer exists. The owner removed
its only entry point, the Sites page's `Add or move a Field here`, and the
command went with it. What follows is the record of the behaviour while it
existed.

**Status:** Implemented on 2026-09-11; superseded the same day by Task 040, which removed Move. A Set left with one member by `Leave sharing` or Clear Site Data still ends, which the owner's QA of Addendum B and Task 040 covered.

**Defect.** `Stop sharing` on a two-member Set ends it and gives both Fields
their own lists, as this contract requires. `Move`, which the contract
describes as an atomic leave-and-join, left the source Set persisted with one
member.

**Rule.** A Move that leaves the source Set with one member ends that Set. The
member left behind keeps its effective list as direct Bindings, through the
same conversion `Stop sharing` uses (`effectiveListAsDirectBindings`). Undo
restores the Set, its slots, every Override and Exclusion, and that member's
former dormant Bindings. It is refused if that member has since joined another
Set or changed its Bindings. The Sites page says the source Set ended.

**Evidence.** `tests/unit/shared-set-audit-repairs.test.ts`. Two existing
repository tests had used a two-member source Set to exercise a *surviving*
source; they now use three members.

## Addendum B — Leaving And Ending Both Keep What Each Field Offered (2026-09-11)

**Status:** Decided by the project owner on 2026-09-11 and implemented the same day; accepted by the owner on 2026-09-11 after hands-on QA.

**The inconsistency.** Leaving a Set (`Stop sharing`) gave the departing Field
its effective list. Ending the Set (`End sharing`) returned every member to its
dormant pre-sharing list. A Template added while the Set was shared therefore
stayed on both Fields after one action and on neither after the other. It
remained in the Library, but was offered nowhere.

**Owner decision.** Leaving and ending both leave each Field with every
Template it was offered, as its own direct Bindings: its effective list, with
its Overrides, Exclusions and Field-only privacy. Both use the same conversion,
`effectiveListAsDirectBindings`, as a Move that ends its Set (Addendum A) and
Clear Site Data's survivor (Task 026 Addendum A). This supersedes Task 015's
"Leaving or ending sharing removes only the relevant shared relationships"
for ending: ending now also converts.

Undo of `End sharing` restores the Set, its slots, every Override and
Exclusion, and each member's former dormant Bindings. It is refused once any
member's Bindings have changed since, rather than discarding that change.

**Copy.** The confirmation and result text for leaving and ending said "each
field's own saved Templates become available again". That was already untrue
for leaving after Task 026, and is now untrue for both, so it now says each
Field keeps every Template it offers. At the owner's request the Chinese label
for leaving a Set is 退出共享 rather than 停止共享: the Field leaves and the
Set may continue. The owner then renamed the English label to `Leave sharing`,
with its result and Undo text, for the same reason.

**Evidence.** `tests/unit/shared-set-audit-repairs.test.ts` ("End sharing
keeps what each member was offered"); two repository tests that pinned the old
End result were updated to the decision.

## Addendum C — Icon Buttons For The Picker's Sharing Actions (2026-09-11)

**Status:** Requested by the project owner on 2026-09-11 and implemented the same day; presentation only; accepted by the owner on 2026-09-11 after hands-on QA.

The Picker header's `Leave sharing` and `Share with…` text buttons took the room
the Field's name needs. At the owner's request they are icon buttons, drawn
from owner-supplied assets inlined like the others:

- `Leave sharing` uses `sign-out.svg`, mirrored so its arrow points left, as
  the owner asked.
- `Share with…` uses `share.svg`. The owner's first choice, `share-network.svg`,
  is `Bind to Shared Set`'s glyph, which a Set member's Search results show at
  the same time; two different commands must not look alike (Task 027
  Addendum E.1). The owner chose a separate glyph.
- Each button keeps its name as its accessible name. Its explanation appears
  immediately on hover and on keyboard focus, below the button so the top of
  the scrolling Picker does not clip it, and is the button's accessible
  description.

No command, confirmation or behaviour changes.

**Evidence.** `tests/unit/icon-seams.test.tsx` (assets and the mirroring),
`tests/unit/inline-picker-field-change.test.tsx` (names, descriptions and
tooltips). Checked visually in real Chromium in Chinese and English.
