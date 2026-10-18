# Task 045 — Scrollbar Space That Does Not Move The UI

**Version:** `0.2.0`

## Task State And Authorization

- Contract: Requested by the owner on 2026-09-15 ("请查看所有可能出现滚动条的页面。
  然后直接修复") after QA
- Execution: Authorized by the owner on 2026-09-15
- Acceptance: Accepted by the owner on 2026-09-15 after hands-on QA with
  `demo/picker-header-scroll-qa.html`
- Authorized slice or scope: Every FillNest surface that can scroll
- Next gate: None; the Task is complete.

## Problem Statement

When a page had many Fields, or a Field many Templates, the Picker grew a
scrollbar, and the scrollbar took its width from the content: everything in
the Picker re-laid out and the UI jumped. The Side Panel did the same. The
owner asked for the scrollbar's room to be kept on the right, so the layout
is the same whether a surface scrolls or not.

Measured before the fix, in the headed browser: the Picker's Search box went
from 318px to 303px, and the Side Panel's content from 1248px to 1233px (in a
tab), the moment either began to scroll.

## Every Surface That Can Scroll

| Surface | Scroll container | Fix |
| --- | --- | --- |
| Picker | the Picker panel (`.picker`) | stable gutter; right padding 4px |
| Picker | its context and result rows, Field list header | end at the gutter; right padding 4px |
| Picker | the full-text flyout (`.preview-flyout`) | stable gutter; right padding 1px |
| Picker, Side Panel | every text box (`textarea`) | stable gutter; right padding 0 |
| Side Panel | the page area (`.panel-content`) | stable gutter; right padding 6px |
| Side Panel | the Site filter menu | stable gutter; 4px wider, right padding 0 |
| Side Panel | the bottom sheet (`.clean-up-sheet`) | stable gutter; right padding 6px |
| Side Panel | the keep-as-global list | stable gutter; right padding 0 |
| Popup | the document | none needed - see below |

## Contract

- Every scroll container declares `scrollbar-gutter: stable`: the scrollbar's
  room is kept whether or not the content overflows, so nothing re-lays out
  when it starts to.
- The scrollbar is drawn 10px wide everywhere (`src/ui/shared/scrollbars.css`:
  a transparent track, a 6px rounded thumb in the theme's strong border
  colour, darker on hover, `CanvasText` in forced-colours mode). Left to the
  system it is 0px (a macOS overlay), 15px or 17px, and no right padding could
  suit all three. With 10px, each container's right padding is its left
  padding less 10px, so the content sits evenly between the edges and keeps
  the width it had before.
- The sheet is imported by the Popup and the Side Panel and read into the
  Picker's Shadow Root, where it styles only the Picker's own elements, never
  the host page's.
- The Picker's tinted rows (the Field context and the last result) end where
  the scrollbar's room begins, with or without a scrollbar, instead of
  running to the Picker's right edge.
- **The Popup.** Measured through `chrome.action.openPopup()`: Chrome shows no
  scrollbar in a Popup that fits, and widens the Popup window by the
  scrollbar's width when its content passes the 600px limit, so the Popup's
  content never re-lays out. It needs no gutter; it takes the shared sheet
  only so a scrollbar, when there is one, looks like the rest.

## Evidence

- `tests/e2e/scrollbar-gutter.spec.ts` (headed): the Side Panel's page area,
  the Picker and the Picker's editor keep their content width, and a real
  control keeps its width, when made to overflow. Failed before the fix on
  both surfaces with the numbers above.
- `tests/unit/scrollbar-gutter.test.ts`: every stylesheet rule that scrolls
  declares a stable gutter, and each surface gets the shared scrollbar, so
  the next scroll container cannot miss it.
- Screenshots of the Picker (Templates, Field list, Field list scrolled) and
  of the Side Panel scrolling and not, compared by eye.
