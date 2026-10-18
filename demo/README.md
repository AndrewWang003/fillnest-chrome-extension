# FillNest V1 Manual Acceptance Demo

This is the Task 007 Slice 3 "Human Acceptance Package". It reuses the exact
fixture markup already exercised by `tests/e2e/static-field-loop.spec.ts`
(`fixtureHtml()`) rather than a newly built parallel page, per the Task 007
Grill Mode decision recorded in `tasks/007-v1-integrated-acceptance-and-hardening.md`.

## 1. Build the extension

```bash
npm ci
npm run build
```

This produces `dist/`, the unpacked extension directory.

## 2. Load it in Chrome

1. Open `chrome://extensions`.
2. Enable "Developer mode" (top right).
3. Click "Load unpacked" and select the `dist/` directory produced above.
4. Note the extension's ID from the card Chrome shows.

## 3. Serve this demo page over HTTP

Extension content scripts only match `http://`/`https://` origins, not
`file://`, so this page must be served, not opened directly:

```bash
cd demo
python3 -m http.server 8973
```

Then open `http://localhost:8973/manual-review-fixture.html` in the same
Chrome profile.

## 4. Grant Website Access

Click the FillNest toolbar icon and grant Website Access for
`http://localhost:8973`. This is the one interactive permission-request step
Chrome requires; everything after this is FillNest's own UI.

## 5. Manual review checklist

Each item below cites the `PROJECT.md` Success Criterion or accepted V1 rule
it demonstrates. This is intentionally a human, visual walkthrough - the
same behaviors are also asserted by the automated suite
(`npx vitest run`, `npx playwright test`), so this page is for confirming
they *feel* right, not for finding new defects.

- **Field detection, no autofill**: focus `text-field`, `email-field`,
  `tel-field`, `url-field`, `search-field`, `textarea-field` - the FillNest
  control should appear next to each on focus, but nothing is filled until
  you explicitly open the Picker and choose a Template (PROJECT.md: "Field
  focus shows the FillNest control but does not open the Inline Picker
  automatically").
- **Excluded fields get no control at all**: focus `password-field`,
  `hidden-field` (not focusable, skip), `payment-field`, `otp-field`,
  `section-otp-field`, `readonly-field`, `disabled-field` - no FillNest
  control should appear on any of these (PROJECT.md eligibility vetoes).
- **Ambiguous/controlled fields fail closed**: `controlled-date-field`,
  `controlled-country-field`, `implicit-country-field`,
  `script-date-picker`, `spinbutton-field` are enhanced/role-controlled text
  inputs - confirm FillNest treats them conservatively (either excluded or
  clearly still plain-text, never triggering the native picker/calendar
  widgets those pages might otherwise show).
- **Cursor insertion and selection replacement**: create a Template from
  `create-field`, place the cursor mid-`replace-field` value and select the
  word `SELECT`, then insert - only the selection is replaced, surrounding
  text is untouched (PROJECT.md SC8).
- **Sibling non-interference**: insert into `bind-field`; confirm
  `sibling-field`'s value is unchanged.
- **Hostile page styles don't leak in**: this page's stylesheet forces
  `!important` colors/fonts on every button/input/div - the FillNest Picker,
  its Shadow Root, and the field control should render with FillNest's own
  styling, unaffected by the host page's rules.
- **No accidental submission**: focus any field, insert a Template, and
  press Enter inside the Picker's search box - the host `<form>` must never
  submit (open DevTools console and check `window.submitCount` stays `0`).
- **Conditional field**: click "Reveal conditional field" - the newly
  created field should be immediately usable with FillNest with no reload.
- **SPA-style reconstruction**: click "Navigate SPA" - the URL changes via
  `pushState` and the email field is replaced with a new DOM node; refocus
  it and confirm exactly one FillNest control appears (no duplicates) and,
  if this same logical field/page was recognized before, its prior Bindings
  still show.
- **DOM reconstruction**: click "Reconstruct form" and confirm the same -
  exactly one control, no duplicate listeners (check `window.eventLogs`
  doesn't show doubled entries for the same interaction).
- **Editable div is out of scope**: `editable-div` (a `contenteditable`)
  should show no FillNest control (`PROJECT.md` V1 Non-Goals: no
  `contenteditable` support).

## 6. Reset between review passes

FillNest's data lives entirely in `chrome.storage.local` for this extension
instance. To reset to a clean state between review passes:

- Extension Settings page → Data → Restore, using a known-empty Backup
  Archive, or
- `chrome://extensions` → remove and re-"Load unpacked" the extension
  (this clears its storage entirely), or
- Open the extension's **own** service worker console (not a regular page's
  DevTools console) and run `chrome.storage.local.clear()`: on
  `chrome://extensions`, find the FillNest card and click its blue
  "service worker" link - this opens a separate DevTools window whose title
  bar reads `service-worker.js`. Running the same command in an ordinary
  webpage's console fails with `Cannot read properties of undefined
  (reading 'local')`, because `chrome.storage` is only available in an
  extension's own contexts, not on arbitrary web pages.

Removing/reloading the unpacked extension does not affect the granted
Website Access permission for `http://localhost:8973`, since Chrome tracks
that separately from extension storage.

## 7. Known limitations for this review pass

See `DEVELOPMENT.md`'s Task 007 section for the current list of declared
manual-only checks and deferred lower-priority items (exact-pixel viewport
breakpoints, adaptive Template-tree expansion at 100+ Templates, and a
uniform accessible-name/keyboard-order sweep across all four UI surfaces).
These are not defects; they are acknowledged scope boundaries for V1.

## 8. Phase One audit QA fixture (2026-09-11)

`phase-one-audit-qa.html` is the hands-on fixture for Task 039's content
checks (C1 label metadata, C2 hash-route queries, C3 a host that stops being
editable). Serve it the same way as above and open
`http://localhost:8973/phase-one-audit-qa.html`. Each section states what it
checks. The expected outcomes were verified against the built extension in
real Chromium on 2026-09-11 before being handed over:

- C1: the Picker names the field "Support reply", never the draft inside it.
- C2: a Template saved on `#/orders?tab=open` is offered again on that route
  and on its `utm_source` variant, and not on `#/orders?tab=closed`.
- C3: locking the box removes FillNest's control and its
  `data-fillnest-field` marker at once.

The Restore checks (Task 006 Addenda A/B, Task 039 R1) cannot be triggered
from a page: they need a storage failure. They are exercised by writing a
journal from the service worker's DevTools console and restarting the
browser; use a separate Chrome profile, because the lock check ends in Reset
FillNest.

## 9. Picker header and scrollbar QA fixture (2026-09-15)

`picker-header-scroll-qa.html` is the hands-on fixture for Task 044 (the mark
in the Picker header; Back in its top-left corner on the Field list) and Task
045 (scroll containers keep their scrollbar's room). Serve it the same way and
open `http://localhost:8973/picker-header-scroll-qa.html`. Its twenty ordinary
Fields make the Picker's Field list long enough to scroll, with "Customer
reply" in the middle so that some Fields come before it.

## 10. Store screenshot page (2026-09-16)

`screenshot-form.html` exists to be photographed, not tested, and it does two
jobs at once: it is the page FillNest would have, carrying the product's own
mark, tagline and three claims, and it is the form the Picker opens on. The
templates to put in its two Fields describe what the extension does, so a
screenshot of the Picker shows the interface and says what it is for.

Three rules keep the page from stealing its own shot: warm paper and brand ink
against FillNest's cool blue-grey; the brand red in the mark and nowhere else,
so the panel's blue is the only other saturated colour; and the column held
left of centre, because the field button sits outside a field's right edge and
the panel opens to the right of it - that space is left empty on purpose.

Serve it the same way and open `http://localhost:8973/screenshot-form.html`.
