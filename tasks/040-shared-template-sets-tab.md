# Task 040 — A Shared Template Sets Tab In Templates

**Version:** `0.2.0`
**Contract:** Accepted by the owner on 2026-09-11, with the English tab name
`Shared Sets`.
**Execution:** Authorized by the owner on 2026-09-11, in the three slices below.
**Acceptance:** Accepted by the owner on 2026-09-11 after hands-on QA in
Chinese passed every item (acceptance item 8).
**Owner of the behaviour it replaces:** Task 021 (Slice 4, Site management),
with Task 021 Addendum A (Move ends a Set left with one member).

## Why

The owner's QA on 2026-09-11 found the Shared Template Set block on the Sites
page hard to use:

1. Under a Set's name, the Templates were shown as one line of previews joined
   by `·` - "只给这个输入框 · 猜猜猜 · 得到的". A Field-only relationship's
   Template sat in that line as if every member shared it.
2. `Add or move a Field here` listed the Site's other Fields by derived names
   such as "Text field 2". A user cannot tell which Field on which page such a
   row means.
3. Each member read "Field name · Page name" with nothing saying the second
   part was a Page. On the tested site the Page's derived name was
   "Autocomplete", which read as a Field attribute.
4. Those derived Field and Page names ignored the chosen language: a Chinese
   interface showed "Text field" and "Home".

## Owner Decisions (2026-09-11)

- The block moves out of Sites into a new Templates tab, **Shared Sets**
  (共享模版组) - the owner chose the short English name over the domain term.
- `Add or move a Field here` is removed. Joining a Set is done from the Inline
  Picker's `Share with…`, which already exists.
- **1A.** A Set shows its shared list once, then, under each member Field, how
  that Field differs from it: its Overrides (its own version), its Exclusions
  (a shared Template it does not use), and its Field-only relationships (a
  Template only it offers).
- **2A.** Each member shows its name, Site and Page - for example "邮箱回复框 ·
  example.com › 工单 / 回复" - and its name can be edited there as a Field User
  Alias. No "open this page" link: FillNest stores neither the full address
  nor the subdomain, and replaces record numbers, so such a link would often
  fail or open the wrong page.
- **3A.** The tab offers: rename the Set, rename a member Field, `Leave
  sharing` for a member, and `End sharing`. Templates are edited where they
  are today - `All templates` and the Inline Picker - not here.

## Scope

1. A fourth Templates tab, after `By location`: **Shared Sets** (共享模版组). It
   lists every Set, across all Sites, collapsed by default.
2. A Set's row: its name (renamable in place, as today), then
   `N fields · M Templates · K Sites`. `M` counts the shared list only, not
   Field-only relationships.
3. An expanded Set shows:
   - **Shared Templates**: the Set's ordinary Slots, in Set order, one
     preview per row.
   - **Fields**: each member as `name · Site › Page`, with `Leave sharing`.
     Under it, only what differs from the shared list: "own version of
     <base preview>: <override preview>", "doesn't use: <preview>", and
     "only this field: <preview>" for each Field-only relationship owned by
     it. A member with no difference reads "Uses every shared Template".
   - `End sharing`, as today.
4. `Leave sharing` and `End sharing` keep their existing confirmations,
   results and Undo (Tasks 021, 025; Task 021 Addendum B copy).
5. The Sites page no longer shows Shared Template Sets. Its Clear Site Data
   and Remove Site impact text still names how many Sets they affect.
6. **Move is removed** with its only entry point: the
   `MOVE_SHARED_TEMPLATE_SET_MEMBER` command, its Undo, its Repository
   transition, its message contract, its Sites-page flow and their tests.
   AGENTS.md forbids an unused interface. Task 021 Addendum A is superseded;
   a Set left with one member by `Leave sharing` or Clear Site Data still ends
   (Addendum B, Task 026 Addendum A).
7. Derived Field and Page names use the chosen language wherever the Side
   Panel shows them, not only in this tab.
8. An empty state when there are no Sets: how to create one (`Share with…` in
   the Inline Picker).

## Non-Goals

- No new sharing operation; no change to what a Set, Slot, Override,
  Exclusion or Field-only relationship means, or to Undo semantics.
- No Template editing, deletion or reordering in this tab.
- No "open this page" link, and no new stored data (no URLs, no subdomains).
- No change to the Inline Picker's sharing flows.
- Adding a Field to a Set from the Side Panel.

## Accessibility

- The tab button, each Set's expand control and every action have an
  accessible name that makes sense on its own - "Leave sharing for 邮箱回复框",
  "Rename Set 客服回复组".
- Expanding a Set does not move focus; the result of Leave or End goes through
  the existing result region; dialogs reuse Task 025's focus lifecycle.
- Previews are text, not colour or icon alone; differences are worded, not
  only styled.

## Acceptance

1. The Templates page has a fourth tab listing every Set; the Sites page lists
   none.
2. An expanded Set shows its shared list once, and under each member exactly
   its Overrides, Exclusions and Field-only relationships. A Field-only
   Template never appears in the shared list.
3. Each member shows `name · Site › Page`, with the name editable as a Field
   User Alias.
4. Rename Set, Leave sharing and End sharing work from the tab with their
   existing confirmations, results and Undo.
5. No `Add or move a Field here`; Move and its Undo no longer exist in code,
   messages or tests.
6. Derived Field and Page names follow the chosen language in the Side Panel.
7. Every new string is in both catalogues; `verify:i18n` passes.
8. `npm run check` and the complete headed Playwright suite pass; the owner's
   hands-on QA in Chinese passes.

## Validation

- Component tests for the tab: the shared list, each difference kind, the
  empty state, and a cross-Site Set's Site count.
- A test that a Field-only relationship appears under its owner and not in the
  shared list.
- Existing Leave/End sharing tests moved from the Sites page to the tab.
- A headed spec replacing `shared-template-sets-management.spec.ts`'s Sites
  path: rename, Leave sharing with Undo, and End sharing from the new tab.
- `verify:exports` proves Move's removal left nothing behind.

## Slices

1. **Remove Move** and its Sites-page flow, with its tests. Behaviour change:
   none remaining, since the entry point goes in slice 3.
2. **The tab**, read-only: list, counts, shared list, member rows, differences,
   empty state, localized derived names.
3. **Actions and the move off Sites**: rename, Leave, End, Field alias;
   remove the Sites-page block; headed spec.

## Stop Conditions

- Showing a difference requires data the Repository does not already hold.
- Leave or End sharing cannot reuse the existing confirmation and Undo
  unchanged.
- Removing Move breaks any other caller.

## Found During Implementation

- **Scope item 7 reached further than the Side Panel.** Making the language a
  required argument of `deriveFieldDisplayLabel`/`derivePageDisplayLabel`
  turned every caller that defaulted to English into a compile error. Besides
  the Sites page, that was the `By location` tree and the `This page` Field
  cards (`buildLocationTree`, `buildFieldFirstView`), and the Inline Picker's
  share Finder, which showed the service worker's candidate names. The
  service worker still derives English names, deliberately, as search and
  sort keys; the Finder now derives what it shows in the reader's language.
- **Four more English strings in the Chinese Picker**, found in the same
  pass: the fallback name "this field", and three instant tooltips written as
  `data-tooltip` literals ("Locate on page", "Remove from this field",
  "Delete template everywhere"). `verify:i18n` now reads `data-tooltip`, which
  is how the three were found.
- **The delete follow-up moved with its callers.** Leave and End sharing offer
  to delete Templates they made Global, and so does Clear Site Data. That
  flow, with its whole-Library typed confirmation (Task 028 Addendum B), is
  now one hook (`useNewlyGlobalDeletion`) used by both the Sites page and the
  tab, instead of living only in the Sites page.
- **Focus after a confirmed action.** The control that opened Leave or End
  sharing is gone once it succeeds, so focus returns to the `Shared Sets` tab
  button.
- **Accessible names.** A Set's rename control reads "Rename Set <name>"
  (`AliasLabel` gained an optional `triggerLabel`); each member's is
  "Rename <field>", and its Leave button "Leave sharing for <field>".

## Implementation Evidence

- Unit: `tests/unit/shared-set-view.test.ts` (the view model: shared list,
  per-member differences, Field-only under its owner, Site count, order);
  `tests/unit/shared-sets-view.test.tsx` (the tab in Chinese: summary,
  locations, differences, empty state); `tests/unit/shared-sets-tab.test.tsx`
  (rename Set, rename Field, Leave with result and Undo, Leave that ends the
  Set, the delete follow-up, End with Undo, End with an unreadable result, no
  Add, and the Sites page listing no Set). The Sites page's Shared Set tests
  moved there.
- Headed: `tests/e2e/shared-template-sets-management.spec.ts` (rename, Leave
  sharing's dialog focus lifecycle, result, Undo) and
  `tests/e2e/end-sharing-from-shared-sets.spec.ts` (End sharing, English and
  Chinese), both from the tab.
