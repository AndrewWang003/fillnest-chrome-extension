# Task 023 — Cross-Surface Accessibility Hardening

**Version:** `0.1.2 Task 14`  
**Status:** Complete — 2026-09-02. Manual VoiceOver/zoom verification was
explicitly waived by the project owner; see Remaining Evidence.

## Goal

Perform a bounded accessibility audit across the Inline Picker, Popup, and Side
Panel, then create only the smallest evidence-backed follow-up repairs.

## Scope

- Audit keyboard focus paths, semantics, notification/Undo announcement,
  zoom, and critical extension E2E flows against WCAG and Chrome-extension
  operability guidance.
- Report each finding with severity, reproduction, expected result, and a
  bounded repair proposal. Record explicit coverage if no finding is observed.

## Non-Goals

- Visual redesign, full automated certification, 100+-Template load testing,
  hostile-host-style isolation, or fragile pixel-perfect breakpoint work.

## Acceptance

- Keyboard, ARIA/screen-reader, zoom, and critical E2E evidence is complete.
- Each failure becomes a separately scoped repair task; this audit does not
  silently expand product scope.

## Automated Evidence (2026-09-02)

- The complete headed extension suite passes: 34/34 specifications. Unit
  coverage passes: 42 files and 439 tests. The existing suite already covers
  core Picker keyboard navigation, Picker Escape closure, notification/Undo
  rendering, Popup activation controls, and the critical Site-management
  mutations.
- A real headed-extension probe reproduced a modal focus escape: open the
  Sites-page `Stop sharing` confirmation, focus its final action, then press
  Tab twice. The active element is no longer contained by the element declared
  `role="dialog" aria-modal="true"`. This is a confirmed keyboard-operability
  failure, not a theoretical semantic concern.
- Root cause: the seven Site-management confirmations and the Settings reset
  and restore confirmations declare modal semantics independently, but share
  no focus-entry, focus-trap, focus-restoration, or Escape-close behaviour.
  The Picker has its own Escape closure and is not part of this finding.

### Required Follow-Up

Create a separately scoped modal-dialog accessibility repair before changing
production behaviour. It must provide one reusable dialog focus-management
pattern for every Side Panel confirmation, restore focus to the invoking
control on close, close on Escape when no destructive mutation is in flight,
and add headed keyboard regressions. The repair must not redesign any
confirmation wording or alter its mutation semantics.

- Automated: Side Panel modal keyboard lifecycle is now repaired and verified
  in the real headed extension: ordinary dialogs enter on Cancel, typed
  dialogs enter on their input, Tab wraps, Escape cancels without mutation,
  and focus returns to the trigger. The complete headed suite remains 34/34.
  Popup and Picker existing keyboard paths remain covered by their dedicated
  headed flows; no new automated failure was observed.
- Post-implementation QA on Task 025 found and fixed one further keyboard
  finding: `WholeLibraryNewlyGlobalDeleteSheet` (Sites page "Delete newly
  Global Templates" dialog) had a typed-confirmation input but never focused
  it on open, contradicting Task 025's own acceptance criterion. Fixed with
  a regression test - see the Task 025 contract for detail.

### Static Contrast Audit (2026-09-02)

A code-level review of every text/icon color declared in `side-panel.css`,
`popup.css`, `surface.css`, and `picker-styles.ts` against WCAG 1.4.3
(Contrast Minimum, AA, 4.5:1 for normal text) and 1.4.11 (Non-text Contrast,
AA, 3:1 for required UI components/graphical objects), computed against each
element's actual background. Findings, each a minimal single-property color
change with no wording, layout, or mutation-semantics change:

- **Keyboard focus indicator (all Side Panel and Popup controls).**
  `button:focus-visible, input:focus-visible` and the toggle-switch focus
  ring used `rgb(49 87 213 / 28%)`, which computes to roughly 1.5:1 against
  a white surface - far below the 3:1 non-text-contrast minimum, meaning the
  keyboard focus ring was nearly invisible on the very surfaces keyboard
  users rely on it most. Raised to `/ 75%` (~3.65:1) in `side-panel.css` and
  `popup.css`; the translucent-halo look is unchanged, only strengthened.
- **Secondary/count/label text using `#98a2b3`.** This gray computes to
  ~2.57:1 against white, failing 4.5:1, and was used for real informational
  text: `.search-union-hint`, `.site-filter-menu-header` label, `.sites-
  pagination`, `.field-first-count`, `.field-card-count`, `.not-offered-
  anywhere-count`, `.field-first-footnote`, and the keyboard-focusable
  `.rename-action` icon (revealed on Tab focus, so a keyboard user would
  focus directly onto low-contrast content). Replaced with `#667085`
  (~4.97:1), the app's own already-passing secondary-text color used
  elsewhere for the same role (e.g. `.tree-node-count`). The two genuinely
  `:disabled`/`aria-disabled="true"` usages of `#98a2b3` are unchanged -
  WCAG contrast requirements do not apply to disabled controls.
- **Field-reorder drag-handle icon.** `.field-first-drag-handle` rested at
  `#c3c9d4` (~1.66:1 against white), well under the 3:1 minimum for a
  graphical control a sighted user needs to notice to discover the reorder
  affordance. Changed to `#516078` (~6.37:1), matching the sibling
  `.field-first-option .action` icon color already used one rule below it.
- **Picker secondary text using `#8791a5`.** ~3.17:1 against white, failing
  4.5:1 for real text: `.shared-field-candidate-page` (the page label next
  to a Shared Template Set candidate), `.group-heading`, `.keyboard-hint`,
  and `.preview-flyout-label`. Replaced with `#667085` (~4.97:1), matching
  the color already used for `.picker header .close` and `.picker .site-
  badge` in the same file.

All four fixes verified with `npm run check` (TypeScript, 42 files / 440
unit tests, build) and the complete headed 34/34 Playwright suite - both
before the CSS existed as a risk and after the fix, with no functional or
visual-regression test asserting the old color values.

### Remaining Evidence

- Manual: VoiceOver reading order and live-region announcements, plus actual
  Chrome zoom/reflow at 200% and 400%, require a real assistive-technology or
  browser-zoom session that this environment cannot perform (no VoiceOver
  control surface, and the available browser automation cannot load an
  unpacked MV3 extension with live `chrome.*` APIs). The project owner
  explicitly waived this manual pass on 2026-09-02 to move on to Task 024;
  it was not silently dropped. If it is picked up later, the checklist is:
  Side Panel (all three tabs, every confirmation dialog, the result region),
  Popup, and the Picker on a real page, at 100%/200%/400% zoom and with
  VoiceOver on, confirming no two-dimensional scrolling, no lost or
  truncated controls, and a sensible reading/announcement order.

## Addendum B — Re-Audit After Tasks 024-033 (2026-09-08)

**Status:** Audit complete; two repairs made under this addendum, three
findings recorded as open with their reasons.

The original audit is dated 2026-09-02. Tasks 024 to 033 then added the Field
Finder, Shared Template Set surfaces, the promotion confirmation, and converted
the inline confirmations to modal dialogs. This re-audits what changed and
re-checks the whole surface for the categories the first pass did not cover.

### What Is Already Right

Recorded so a later audit does not re-litigate it:

- Every modal dialog carries `role="dialog"`, `aria-modal`, `aria-labelledby`,
  contains Tab and Shift+Tab, cancels on Escape, and restores focus to its
  trigger (Task 025, and Addendum A there).
- Actions hidden at `opacity: 0` until hover all have a matching
  `:focus-within` or `:focus-visible` rule, so a keyboard user sees what a
  mouse user sees. This was the shape of the original audit's drag-handle
  finding and it has not regressed.
- `:focus-visible` outlines exist on buttons, inputs, the toggle switch and
  Picker rows.
- Notifications use `role="status"` with `aria-live="polite"` and
  `aria-atomic`; errors use `role="alert"`.
- Every icon-only button has an `aria-label`. Tooltips via `data-tooltip` are
  decoration on top of a real accessible name, never a substitute.
- The Picker's Shadow Root being `closed` does not affect assistive
  technology: `closed` restricts scripted access, not the accessibility tree.

### Repaired Under This Addendum

**B1. `aria-activedescendant` promised a pattern that does not exist.** The
Search box carried `aria-activedescendant` pointing at the highlighted row, but
nothing in the Picker had `role="combobox"`, `listbox` or `option`, so the
attribute was inert - assistive technology ignores it outside that pattern.
Adding the pattern would have been the wrong repair: the rows contain their own
buttons (Edit, Bind, Unbind, Delete), and ARIA forbids interactive descendants
inside `role="option"`. The Picker already moves **real** keyboard focus onto
the highlighted row, which is what actually announces it, so the attribute is
removed rather than propped up.

**B2. An ambiguous accessible name.** The Field Finder's label expander was
named only `more…`, which out of context says nothing about what it expands. It
now names the field whose label it reveals.

### Open Findings

**B6. Hook dependency findings - all resolved 2026-09-08.** Enabling
`react-hooks/exhaustive-deps` reported eight findings. On a first pass these
were left as warnings on the reasoning that resolving them meant adding the
missing dependency, which would change when the effects run. That reasoning was
wrong for every one of them: adding the dependency was never the correct fix.

- Two broadcast listeners (`InlinePicker`, `SidePanel`) are registered once for
  the surface's lifetime while their callers are recreated each render. Adding
  them would have torn the listener down and re-registered it on every render.
  They now read the current function through a ref: one registration, never a
  stale call.
- Three per-render allocations - `?? []`, a comparator built from literal
  constants, and an unmemoised `searchResults` - were defeating three
  downstream `useMemo`s entirely. The first two are module-level constants now;
  `searchResults` is memoised with dependencies ESLint verifies rather than
  ones chosen by hand.
- The highlight reconciliation read its own state from the closure. Depending
  on `highlightedId` would have re-run it on every arrow key, which is not what
  it is for. It reads the current value through the setter instead.
- `initialFocusRef` is a ref object, so listing it changes nothing about when
  the effect runs.
- The pending-site-filter effect must apply once per pending value, so its
  callback must not be a dependency - re-running would clobber a filter the
  user had since set. Ref again.

The rule is now `error`. Nothing about behaviour changed; what changed is that
the next stale closure cannot be added silently.

**B3. `prefers-reduced-motion` support - added 2026-09-08.** All four
stylesheets now honour it: the Side Panel, the Popup, the Picker's shadow
stylesheet, and the page-status control's own shadow stylesheet.

Every transition in the project is a short opacity, background or transform
tween, so suppressing them keeps each **end state** exactly as it was and only
removes the movement between states. A toggle thumb jumps to its position
instead of sliding; a hover-revealed action appears at once. Nothing becomes
unreachable, invisible or ambiguous, which is why this was safe to do without a
reduced-motion session to check against.

The rule is the conventional near-zero-duration override rather than
`transition: none`, so a transition-end handler would still fire if one were
ever added.

**B4. `forced-colors` support - repaired 2026-09-08, unverified visually.**
The owner has no Windows machine and asked for the remedial changes to be made
from the specification rather than left open.

What was wrong: colours were hard-coded hex throughout, and forced-colors mode
replaces every colour and drops `box-shadow`. Two things were genuinely
broken rather than merely plain.

- The Website Access switch distinguished on from off by **track colour
  alone**. Both become the same system colour, so a user could not tell whether
  a Site was authorized. The thumb was white on a track that also becomes a
  system colour, so the position cue could vanish too.
- The provided icon assets carry `fill="#000000"` and were rendered as `<img>`.
  Forced-colors does not recolour image content, so on a dark high-contrast
  theme they were black on black. They are now a masked span over
  `currentColor`, which is a system colour in forced-colors mode - and which
  incidentally makes them behave like the hand-drawn inline SVG icons in normal
  mode too.

Also restated with borders and system colour keywords: selected navigation and
filter states, focus outlines, destructive buttons, the highlighted Picker row
(whose inset `box-shadow` cue is dropped entirely), and cards separated only by
a tinted background.

Every rule is inside `@media (forced-colors: active)` and therefore cannot
affect normal rendering. Each adds a distinction rather than removing one.

**This is unverified.** It follows the documented behaviour of forced-colors
and the system colour keywords; nobody has looked at it in a real
high-contrast session. If one becomes possible, check the toggle, the icons,
the selected tab and the highlighted Picker row first - those are the four this
repair is actually about.

**B5. The manual pass the owner waived on 2026-09-02 - performed 2026-09-08.**
The owner ran it with VoiceOver and Chrome zoom and reported sixteen
observations. They are answered in Addendum B5 below.

### Acceptance Criteria

1. `aria-activedescendant` is gone, and the focus-moving behaviour it shadowed
   is asserted by a test.
2. The label expander names what it expands.
3. B4's repair is scoped entirely to `@media (forced-colors: active)` and the
   icon change is covered by the icon-seam tests.
4. B3 is implemented across all four stylesheets. B4 is recorded as
   repaired-but-unverified rather than as done. B5 is no longer open: the
   owner performed that session on 2026-09-08 and its findings are answered in
   Addendum B5.


## Addendum B5 — The Manual VoiceOver And Zoom Pass (2026-09-08)

**Status:** Complete and owner-verified — 2026-09-08. Sixteen observations;
thirteen were real defects and are repaired here, three are recorded as
correct behaviour or a deliberate product position with no change made. The
owner re-ran the session against the repairs and accepted all of them,
including the two the repairs were hardest to reason about without hearing
them: focus lands on Undo after a delete, and Reset announces.

This is the session Addendum B recorded as the one thing no automation in this
environment could stand in for. It found more than the code review did, and
most of what it found was invisible to a sighted mouse user - which is the
point of running it.

### Repaired

**1. Both Overview switches announced only their own state.** The visible label
of an activation switch is `Active` or `Paused`, and that was also its
accessible name, so VoiceOver said "Active, on, switch" - true of every switch
in the product and therefore identifying none of them. The Global switch is now
named `FillNest active everywhere` and the per-site switch
`FillNest active on <origin>`; the visible state text stays exactly as it was
and is hidden from assistive technology rather than announced twice. The
Popup's Global switch had the same defect and the same repair. The Popup's own
per-site switch already read "Active on this site" and is unchanged.

**2. The rename button had lost its glyph, and never said what it renamed.**
Every Side Panel rename affordance was the name plus a separate circular
pencil button. B4 (2026-09-08) replaced the provided-asset `<img>` with a
masked span, but `.rename-action`'s CSS still sized only an `img`/`svg` child -
so the button rendered at zero glyph size: a blank circle to a sighted user,
and "Rename, button" with no object to a screen-reader user.

Rather than restore the glyph, the affordance now matches the Picker, which had
already solved this: **the name itself is the control**, with the Picker's own
hover/focus/pressed depth cues, and an accessible name of `Rename <name>`. One
control instead of two, it says what it renames, and the hover treatment is
what tells a sighted user the name is interactive. This covers every reported
site - Templates > This tab, Templates > By location, and the Sites page's
Shared Template Set names - because all of them render the same `AliasLabel`.

**3. Every rename editor opened empty.** Renaming is editing an existing name,
but both the Side Panel and the Picker seeded the input from the stored user
alias, which is undefined for any Field, Page or Set that has never been
renamed - the common case. The user was handed a blank box under a row that
plainly had a name. Both now open on the name being displayed, with the text
selected, so replacing it is still one keystroke and editing part of it is
possible at all. Saving a value that equals what the editor was seeded with is
treated as a cancel, so this cannot silently store an alias that merely
restates the derived label.

**5. The Site filter could not be reached with VoiceOver's own navigation.**
The open Site filter declared `role="listbox"`, but its children are checkboxes
inside labels, not `role="option"`. A listbox prunes non-option children from
the accessibility tree, so Ctrl+Alt+Arrow could not reach a single Site even
though Tab still moved DOM focus onto the checkboxes - exactly the reported
asymmetry. It is a disclosure button over a group of checkboxes, so it now says
that: `role="group"` with a label, and `aria-haspopup="true"` on the trigger.

**8. "Expanded button" on a Template row.** The row's text button is a genuine
disclosure between the preview and the full text, so `aria-expanded` is
correct; what was missing is that nothing said what pressing it does, because
the Template text is the button's accessible name. It now carries a `title`,
which becomes the accessible *description* alongside that name rather than
replacing it: "…, collapsed, button, Show the full Template text".

**9. Deleting a Template threw focus out of the extension.** Deleting removes
the row that holds the Delete button the user just pressed, so the browser
dropped focus onto the document and VoiceOver read "FillNest web content". The
Side Panel now detects that focus was actually lost - and only then - and moves
it to the Undo button the same action just produced. Saving an edit had the
same defect and is fixed by the same recovery.

**10. The save result named the version it had just replaced.** Editing
"Hobart" to "Hobart Street" announced `Saved "Hobart" everywhere it is used`.
The recoverable action carries the **pre-save** Template because Undo has to
restore it, and the result line was being built from that same record. It now
carries `savedContent` as well and the wording uses it. The Undo outcome still
names the old version, which is correct - that is what Undo restores.

**11 and 12. The live region did not reliably announce.** These are one defect.
The announcing region *was* the visible result banner, whose new content is a
subtree of buttons; VoiceOver announces an added interactive subtree
unreliably. That is why Reset - which closes its sheet and restores focus to
the `Reset FillNest` button - announced nothing but that button's own name.

There is now one dedicated, visually hidden, **text-only** status region. It is
emptied and refilled a beat after the change that produced it, because a live
region announces a mutation it observes after it already exists, and these
results arrive with exactly the mutations that swallow a same-frame update: a
sheet closing, a row disappearing, focus being restored. Clearing first also
makes two identical results in a row two announcements.

The announced string now states that Undo exists ("… Undo is available."), and
the Undo button's own accessible name says what it would undo, since reached by
keyboard or by the focus recovery above it is the only thing the user hears.

**13. A Picker Template row announced only its text.** Same shape as finding 8:
the Template text is the button's name, so nothing said pressing it inserts.
`title` now supplies "Insert this Template into the field" as the description,
keeping the repeat-insertion hint where it applied.

**14. A pinned Picker did not come back on zoom.** A pinned Picker renders from
a stored position that nothing re-checked against the viewport. Browser zoom
shrinks the viewport measured in CSS pixels, so zooming pushed it off-screen -
and because the stored value never changed, it stayed there. It is now clamped
into the viewport on mount and on every resize. The clamped value is not
persisted: a transient zoom must not overwrite the position the user chose.
This also stops a drag from leaving the Picker off-screen. (The Side Panel not
zooming with the page is Chrome's own behaviour - extension side panels are not
subject to page zoom - and is not something this project can change.)

**15. Past ~250% zoom the Picker was wider than the viewport.** Its width was a
hard `348px` in the stylesheet, repeated as a literal in the placement maths.
An absolutely/fixed-positioned overlay does not extend the page's scroll range,
so its right-hand side was unreachable rather than merely off-screen. Width is
now `min(348px, calc(100vw - 16px))`, and the placement maths asks a shared
`pickerWidthWithin()` for the real width instead of assuming one.

### Recorded, No Change

**4. The Side Panel navigation announces "Overview, button".** Correct. These
are buttons that switch the panel's content in place, and the selected one
carries `aria-current="page"`, which VoiceOver announces. Making them a tab
list would be a lie: the content region is not a tab panel and does not
maintain per-tab focus.

**6. Ctrl+Alt+Escape leaves for the browser chrome.** That is VoiceOver's own
"escape / go back" command, not an extension shortcut. With no dialog or group
to escape out of, VoiceOver moves the cursor out of the web area. Nothing in
the Side Panel intercepts that combination and nothing should.

**16. There is no in-app reduced-motion switch.** Deliberate. B3 honours the
operating system's own `prefers-reduced-motion` setting across all four
stylesheets, which is the setting a user has already made once for every
application. A second, product-local copy of that preference would be one more
thing to keep in sync and one more place for the two to disagree. Adding one
is a product decision, not an accessibility gap.

### Recorded As A Boundary, Not A Defect

**A magnified Picker covers page content behind it.** Raised by the owner in
the confirmation pass, and agreed as inherent rather than open. The Picker is a
floating overlay: at high zoom it is a large fraction of the viewport, so it
covers whatever is behind it. Finding 15 is why its content is now *reachable*
at that size, which is the accessibility obligation; not overlapping the page
at all is a different thing, and only a different layout could give it - a
docked or inline panel, which is a product decision about what the Picker is,
not a repair to what it currently is. It already avoids covering the one thing
that would break the interaction: it flips above or below so it never sits on
the Field it is attached to, or on a highlighted Finder candidate.

### Consequential Note

The static contrast audit above lists `.rename-action`'s icon colour among its
fixes. That rule no longer exists: finding 2 removed the control it styled. The
audit entry is left as written because it is a dated record of what was true
then, not a live description of the stylesheet.

### Evidence

`npm run check` passes (typecheck, lint, 55 files / 703 unit tests, verified
build) and the complete headed Playwright suite passes 45/45 with no skips.
New coverage: Picker viewport geometry and stylesheet bounds, the switch
accessible names, the rename affordance and its seeded editor across all three
surfaces, the save result naming the saved version, and the text-only
announcing region with its focus recovery. Four headed specs asserted the old
accessible names and were updated.

The repairs were reasoned from the accessibility tree and asserted in tests,
then confirmed by the owner in a second VoiceOver session on 2026-09-08. No
finding remains open.

### Acceptance Criteria

1. Every generic-labelled switch has an accessible name that says what it
   activates, asserted by a test.
2. One rename affordance across the Side Panel and the Picker: the name is the
   control, it names what it renames, and its editor opens on the current name.
   An unchanged value does not write an alias.
3. The Site filter's open menu exposes its Sites to assistive-technology
   navigation, not only to Tab.
4. There is exactly one announcing region in the Side Panel, it is text-only,
   and it states when Undo is available.
5. An action that destroys the focused control leaves focus inside the Side
   Panel.
6. A result never names the version an edit replaced.
7. The Picker fits the viewport at any zoom level, and a pinned Picker is
   clamped back into it when the viewport changes.
