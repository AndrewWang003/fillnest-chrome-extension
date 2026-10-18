# Task 044 — The Picker Header: The Mark, And Back In The Corner

**Version:** `0.2.0`

## Task State And Authorization

- Contract: Proposed to the owner on 2026-09-15 and accepted the same day
  ("好啊 你实施一下看看")
- Execution: Authorized by the owner on 2026-09-15
- Acceptance: Accepted by the owner on 2026-09-15 after hands-on QA with
  `demo/picker-header-scroll-qa.html`
- Authorized slice or scope: The whole Task, below
- Next gate: None; the Task is complete.

## Problem Statement

The Inline Picker's header said "FillNest" in text only, while the toolbar,
the Popup and the Side Panel now show the owner's mark (Task 033 Addendum D).
The Picker is drawn on pages FillNest does not own, so it should say whose
panel it is as plainly as the rest of the product does.

The one Picker page with a Back - the Field list reached from `Share with…`
or `Share with a different field…` (Task 024) - put Back at the bottom of a
list that can run to every Field on the page, so leaving it meant scrolling to
the end.

## Owner Decisions (2026-09-15)

1. **The mark in the Picker.** A small mark before "FillNest" in the header,
   not a large logo. Its ink follows the Picker's theme; its bar is the brand
   red.
2. **Back in the top-left corner, on the page that has one.** On the Field
   list, Back takes the header's leading place, followed by the page's name;
   Keep open and Close stay on the right. The bottom Back goes.
3. **Cancel stays where it is.** New template and Edit keep Cancel beside
   Save, and every confirmation keeps Cancel beside its action: those are one
   decision each, not navigation.

## Contract

- On the Templates, the header leads with `BrandIcon` (Task 033 Addendum D)
  and "FillNest"; there is no Back.
- On the Field list the header leads with a `Back` button - a chevron and the
  word, accessible name "Back" / "返回" - and the title `Share with…` /
  `共享给…`. Only one Back exists in the Picker.
- Back goes up one level: from a scope confirmation (`Share Templates with …?`,
  `Join Set & Share`, `Merge Sets & Share`) to the Field list it came from,
  and from the Field list to the Templates, where Search takes focus as
  before. It is unavailable while a sharing action is running, as the old
  Back was.
- On the Field list the header stays at the top of the Picker while the list
  scrolls (sticky, with its own ground), so Back is always reachable. The
  context row below it starts 4px lower there, since it can no longer tuck
  under a header with a ground; nothing in the header moves between pages.
- Header buttons do not start a pinned Picker's drag, as before.

## Evidence

- `tests/unit/inline-picker.test.tsx` ("Task 044"): from a scope
  confirmation, Back returns to the Field list, and again to the Templates;
  one Back only. Failed before the change.
- `tests/e2e/picker-header.spec.ts` (headed): the mark and its red bar on the
  Templates; Back and the title on the Field list with Search focused; Back
  still inside the Picker's top after scrolling the list to its end (failed
  before the sticky header); Back returns to the Templates with Search
  focused. Screenshots in `output/playwright/task044-*.png`.
- Checked by screenshot in dark mode and in Chinese.
