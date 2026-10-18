# Task 034 — Appearance Themes, Settings Density, And A Cross-Surface UI Review

**Version:** `0.1.2 Task 15`
**Status:** Complete — 2026-09-08. Owner-directed; decisions inside the stated
scope were delegated to the implementing agent.

## Goal

Three things the owner asked for in one pass, because they are the same
surface:

1. A theme system the user chooses from in Settings, taking the earlier prototype's
   generic pattern as UI evidence.
2. Settings' explanatory prose is too long - three actions fill the whole page.
3. A review of the product's UI for anything broken or inconsistent, and the
   cheap fixes that follow from it.

## Scope

- One token vocabulary that every FillNest stylesheet resolves its colours
  through, and a set of palettes for it.
- Persisting the choice, applying it to all three surfaces (Side Panel, Popup,
  Inline Picker), and keeping them in step while they are all open.
- Condensing the Settings copy without losing anything a user needs in order to
  decide.
- Recording the UI review's findings and fixing the ones that are small,
  low-risk and real.

## Non-Goals

- Reworking the visual design itself: spacing, type scale, component shapes and
  the light-mode look are unchanged. The default theme is pixel-identical to
  what shipped.
- A theme editor, custom colours, or per-surface themes.
- Unifying the two button-class vocabularies (see Review Findings, F4).

## What Was Built

### The token vocabulary

`src/ui/theme/theme-tokens.ts` owns about thirty semantic tokens - surfaces,
borders, a text ramp, one accent family, danger/warning/success families, and
the few odds and ends (the switch track and knob, the tooltip's inverse
surface, the shadow colour, the overlay). Every colour in `side-panel.css`,
`popup.css` and `picker-styles.ts` now reads one of them as `var(--fn-…)`;
`theme-system.test.tsx` fails the build if a literal colour reappears in any of
the three.

The mapping was mechanical but not blind: `#fff` and `#172033` each meant two
different things depending on the property they were set on (`color: #fff` is
text on a filled control, `background: #fff` is a surface; `#172033` is body
text as a colour and the tooltip's background as a background), so those were
resolved with the property in hand rather than by find-and-replace.

### The palettes

Six themes - FillNest Blue, Graphite, Ocean, Forest, Plum, Amber - each in
light and dark, and a mode preference of System, Light or Dark. System follows
the operating system live rather than only at load.

**A theme chooses an accent and, at most, a tint for the three background
layers.** The text ramp, the borders and the feedback families come from one
neutral ramp per mode that every theme shares. That is a deliberate limit: the
alternative - twelve independently authored palettes - is twelve chances to
reintroduce exactly the contrast failures Task 023's static audit removed by
hand, and no reviewer is going to re-check 288 colour pairs by eye.

`theme-contrast.test.ts` computes the real WCAG ratios for every theme and mode
instead: 4.5:1 for informational text on every background layer it can sit on,
4.5:1 for a filled control's own label and for the accent used as text, 3:1 for
the switch's on state against its off state (the 1.4.11 obligation Addendum B4
was about), and a floor for the decorative separators. Adding a seventh theme
means passing that test, not asking someone to look at it.

One neutral changed as a result: `text-muted` moved from `#667085` to
`#5b6577`. At the old value it passed on white but fell to 4.05:1 on the
hover-raised layer under the tinted themes. It now clears 4.5:1 everywhere.

### Where the choice lives

Its own storage key, not `FillNestState`.

It is a display preference for this browser profile: it says nothing about
Templates, Sites or Fields, carries no privacy weight, and a Backup Archive
restored onto another machine has no business repainting that machine. Keeping
it out of the business record also keeps it out of the schema version, the
migration chain, the archive contract and the restore impact preview - four
mechanisms that exist to protect data integrity and have nothing to protect
here.

Reset still clears it, and the service worker broadcasts the default afterwards
so open surfaces stop wearing the old palette without needing a reload.

### Reaching all three surfaces

The Side Panel and the Popup apply the palette to `document.documentElement`
before their first render, so no surface ever paints unstyled while the stored
preference is being read.

The Picker is the interesting one. It is a Shadow Root on a host element
injected into a page FillNest does not own, so the theme cannot arrive through
that page's stylesheets. It is written as inline custom properties onto the
host element instead: inline needs no stylesheet insertion, survives the Shadow
Root's `all: initial`, and cannot be outweighed by anything the host page
declares. The content script holds the current preference at module scope
because the Picker host and the page-status host are created at different times
by different scopes, and whichever appears next must already know the theme
rather than paint a default and correct itself.

A change made in Settings reaches every open surface through one
`APPEARANCE_CHANGED` broadcast. It is its own notification rather than a
business-state change: a repaint must not invalidate a pending Undo somewhere
else for a change that touched no data.

### Settings density

Every row led with two or three lines of prose, so three actions filled the
page and the actions themselves were the least prominent thing on it. Each row
now carries one line that says what it does. Nothing was deleted that a user
needs in order to decide - the consequences that genuinely need spelling out
are in the confirmation each action already opens, which is where the deciding
happens.

The privacy point about backups is kept, deliberately. It is a real warning and
it is not restated anywhere else.

Its placement was settled by the owner on review: it hangs off the Backup
action as a warning affordance rather than occupying a container of its own,
because it belongs to that one action and only matters at the moment of
exporting. That is a hover affordance, so it is built as a real control rather
than a hover-only decoration - the whole warning is its accessible name, and
the tooltip opens on keyboard focus and on tap as well as on hover. Nobody has
to own a mouse to read it, and a screen reader announces it in full.

## Repaired After The Owner's Hands-On Pass (2026-09-08)

Two defects the owner found by using the themed build, both of them the same
kind of miss: a rule written for a shape that no longer exists.

**T1. The page-status control never changed colour.** It has **its own**
Shadow-Root stylesheet, in `PageStatusControl.tsx` - a fourth sheet this task
did not tokenize. Its host was already themed (the content script registers it
alongside the Picker's), but the stylesheet held hard-coded hex, so the control
floating on every authorized page stayed light under every theme. Tokenized
now, and the "no literal colour" test lists all four sheets rather than three -
the check that would have caught it.

Its paused state needed a token pair of its own rather than reusing the
switch's: `control-off` is a bare track, far too light to put a white glyph on.
`muted-fill` / `on-muted-fill` are a filled control with a legible foreground,
and the contrast test now asserts that pair.

**T2. The Field Finder's Locate action rendered as an empty button.** Its rule
was `.find-similar-locate img { width: 14px; height: 14px }`. Addendum B4
replaced every provided-asset `<img>` with a masked `<span>`, so the selector
matched nothing and the glyph had no size at all - invisible in both modes,
though dark is where it was noticed. This is the identical defect Addendum B5
found on the Side Panel's rename action; this was the one place that pass did
not reach.

The product now renders no `<img>` anywhere, so a surviving `img` rule is
always this bug. A test asserts none of the four stylesheets contains one.

## Modularized After The Owner Asked (2026-09-08)

The owner asked whether the theme could be structured so that adding one is
easy and nothing gets missed. It could, and the shape now enforces it rather
than asking anyone to remember.

**Adding a theme is one file and one line.** `src/ui/theme/themes/` holds one
file per theme; `themes/index.ts` is the registry. `ThemeId` is **derived from
that array** rather than declared beside it, so there is no second list to keep
in step - the previous shape had a hand-maintained `THEME_IDS` that a new theme
could silently miss. `THEME_IDS`, `isThemeId`, `findTheme`, the Settings
chooser and the contrast test all read from the one array.

**A new token cannot be half-defined.** `token-names.ts` names every `--fn-`
property once, as data, and the types are derived from it. Both neutral ramps
are typed as total records over those names, so adding a name is a **compile
error** until light and dark both supply it. `AccentPalette` is a total record
over the accent names, so a theme cannot omit one either.

**Two more ways a token could be silently wrong are now tested.** A
`var(--fn-typo)` resolves to nothing and the declaration is simply dropped - no
error, no colour - and a token nobody reads still has to be defined in both
ramps and still has to pass the contrast test. One test now compares the
declared vocabulary against every `var(--fn-…)` in all four stylesheets, in
both directions.

That test found three real ones on its first run, all artifacts of the original
mechanical conversion: destructive buttons took their label colour from
`on-accent` rather than `on-danger`, the Picker's tooltips from `on-accent`
rather than `on-inverse-surface`, and the modal backdrop was a shadow tint
rather than `overlay`. In light mode each happened to look right; in dark mode
each was a colour chosen for a different surface. All three now use the token
that names what they are.

`neutral-ramp.ts` holds the two shared ramps, `theme-tokens.ts` stays the
public surface and re-exports everything, so no import anywhere changed.

## Review Findings

**F1. A dead stylesheet.** `src/ui/shared/surface.css` was imported by nothing
and its `.surface` class used by nothing. Task 023's contrast audit had
carefully audited it. Removed.

**F2. Two switch components.** The Popup carried its own copy of `ToggleSwitch`
alongside the Side Panel's. That is why the Popup's Global switch still had the
uninformative accessible name after Task 023 Addendum B5 fixed the Side
Panel's - one fix, two components. Now one component in `src/ui/shared/`,
imported by both. It lives there rather than in `SidePanelShared` so the Popup
does not pull the Side Panel's repository types and dialog machinery into its
bundle.

**F3. The Picker's width was a constant in three places.** The stylesheet, the
anchored placement in the content script, and a second `clampPickerPosition`
in the content script all carried `348` independently. Addendum B5 had already
made two of them agree; the third is folded in now, and the content script's
clamp delegates to the shared one.

**F4. Two button vocabularies - recorded, not changed.** The Side Panel styles
its buttons `.primary` / `.secondary` / `.danger`; the Popup styles the same
three roles `.primary-button` / `.secondary-button` / `.compact-button`. They
are two names for one thing and they should converge. Not done here: it is a
wide, purely cosmetic rename across two stylesheets and every call site, with
real regression surface in the E2E suite's name-based locators and no
user-visible gain. It belongs in its own bounded change.

**F5. The two switch sizes differ between surfaces - recorded, not changed.**
The Popup's switch is 18px on a 40px track; the Side Panel's is 22px. This
reads as density appropriate to each surface rather than a defect, but it is
undocumented, and now that one component renders both it is worth deciding
deliberately rather than inheriting.

## Acceptance Criteria

1. No FillNest stylesheet contains a literal colour; a test enforces it.
2. Every theme and mode passes computed WCAG ratios for text, filled controls,
   the switch's on/off distinction, and the feedback families.
3. The choice persists, reaches the Side Panel, the Popup and the Inline
   Picker, and updates every open surface without a reload.
4. `system` follows the operating system live.
5. Reset returns the palette to the default along with everything else, and the
   preference is absent from the Backup Archive and the schema.
6. The default theme in light mode is what shipped before this task.
7. Settings states each action in one line and keeps the backup privacy
   warning, reachable by keyboard and screen reader as well as by hover.

## Evidence

`npm run check` passes: typecheck, lint, **57 files / 792 unit tests**, and the
verified build. The complete headed Playwright suite passes **46/46**,
including a new `appearance-theme` spec that drives the real product - choose a
theme in Settings, confirm the Side Panel repaints, confirm the choice survives
a reload, confirm a Popup opened afterwards wears it, then Reset and confirm
the default returns - and an added assertion in `picker-isolation` that the
Picker's own host carries a complete palette.

Light and dark were checked visually on Overview, Templates and Settings.

Not evidence: no theme other than the default has been used for real work, and
nothing here has been checked in a forced-colors session (Addendum B4's own
caveat is unchanged - the `forced-colors` block overrides the tokens, so it is
unaffected by this task).
