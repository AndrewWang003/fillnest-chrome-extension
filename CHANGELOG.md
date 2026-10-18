# Changelog

What changed in each version of FillNest, for the people using it. Contracts
and evidence live in `tasks/`; the current development state is in
`DEVELOPMENT.md`.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Version numbers are the manifest's. `0.1.2` was a planning label for the work
between `0.1.1` and the Beta, and was never a released version; that work ships
in `0.2.0`.

## [0.2.0] - Unreleased

The Chrome Web Store Beta candidate (Task 033): Unlisted distribution, not yet
submitted.

### Added

- **Rich text fields.** Chat composers and other `contenteditable` editors
  are Fields: insertion at the caret with no synthetic key events, Binding
  where the field has a stable name, and an explicit copy-to-clipboard
  fallback when an editor refuses the text (Task 036).
- **Shared Template Sets.** Named lists of Templates shared between chosen
  Fields, within a Site or - after an explicit confirmation - across Sites.
  Per-Field Overrides and Exclusions, and Templates kept private to a single
  Field (Tasks 015, 021, 024, 026, 027).
- **Logical Page matching.** After you confirm it, record pages of the same
  kind (`/orders/123`, `/orders/456`) share their Templates; `Stop matching`
  separates them again (Tasks 014, 020).
- **Simplified Chinese**, chosen in Settings or following the browser, with
  every error message in the chosen language (Task 037).
- **Themes**: six themes in light and dark, plus System (Task 034).
- **A movable page status control** that stays where you drag it, and a
  Settings button that puts it back in the bottom-right corner (Task 038).
- **Clearer switches**: the Popup and Overview title each switch for what it
  turns on - Enable FillNest, Enable on this site - explain it in one line, and
  say in one status line what is still needed before FillNest works on the
  page (Task 042).
- **Allow access stands out**: two centred lines, the action above the site,
  with a slow breathing glow until the site is allowed (still for reduced
  motion) (Task 042).
- **A short introduction**: a Getting started card the first time you open
  the Popup, the Picker and the Side Panel, and one line the first time you
  open each page, with `Show tips again` in Settings (Task 042).
- **A feedback address** on Overview, `fillnest.feedback@gmail.com`, with a
  button that copies it (Task 042).
- **Similar-field suggestions** for sharing Templates between Fields, which
  name the Fields and never preview a Template (Task 024).

### Changed

- Template editors stop taking input at the length limit (about 1,000 Chinese
  characters or 3,000 letters), keeping only what fits from a paste (Task 035
  Addendum A).
- Leaving a Shared Template Set (`Leave sharing`, 退出共享) and ending one
  both leave every Field with the Templates it was offered (Task 021
  Addendum B).
- The Picker's `Leave sharing` and `Share with…` are icon buttons, with an
  explanation shown at once on hover and keyboard focus (Task 021 Addendum C).
- Shared Template Sets are managed from a new `Shared Sets` tab in Templates
  (共享模版组), no longer from Sites. A Set shows its shared Templates once,
  then each Field with its Site and Page and only how it differs: its own
  version of a Template, a Template it does not use, or one only it offers.
  Rename a Set or a Field, `Leave sharing` and `End sharing` work there, with
  Undo. `Add or move a Field here` is gone: a Field joins a Set with
  `Share with…` in the Picker (Task 040).
- The Side Panel shows only authorized Sites, and `Remove site` removes a
  Site's access and data together, recoverably (Task 012).
- One result region at the bottom of the Side Panel, with consistent Undo
  (Tasks 010, 011).
- State updates reach only tabs on Sites you authorized; FillNest no longer
  reads the address of every open tab (Task 033 Addendum A) - nor when it
  starts up or access is removed (Addendum E).

### Fixed

- A pinned Picker no longer inserts over text you did not select, in the
  same or another field.
- A Field merged by Logical Page matching can take, lose and delete
  Templates again; Clear Site Data no longer fails after a declined
  suggestion.
- Restore returns every record exactly as backed up, including a private
  Template's privacy and the page status control's position.
- A Restore that cannot roll back is retried at every start and never
  written over; Reset FillNest is the way out, and the Side Panel can reach
  it.
- Shared-set Undo and Clear Site Data keep Overrides, Exclusions and
  privacy; a pending confirmation no longer follows a pinned Picker to
  another Field.
- A Template's full text opens whenever its row hides part of it - more lines
  than the first, or a line cut short - not only past 120 characters. It
  opens level with the row and within the Picker's height, so the pointer
  moves straight across to it, and stays open while the pointer is on it. In a
  window too narrow to fit it beside the Picker, it is 70% see-through until
  the pointer is on it.
- Editing a Template in the Picker opens its own panel, like New template;
  both keep the Picker's size and give the room to the text, and Tab always
  reaches the Save choices.
- Dragging a pinned Picker no longer leaves copies of it on the page, and no
  longer moves focus or selects text on the page it passes over.
- Renaming anything - a Field, a Page or a Shared Template Set - opens on its
  current name in a box wide enough to read it, and doing anything else
  without saving discards the rename.
- While a failed Restore keeps FillNest closed, the language and theme can
  still be changed, and Backup and Restore are no longer offered.
- With Chinese chosen, every surface tells screen readers it is Chinese, and
  the last English phrases - counts, pagination, "Undo is available", the
  length tooltip - are translated, and so is the share Finder's `more…`
  (Task 037 Addendum F).
- Generated Field and Page names ("Text field", "Home") and four Picker
  tooltips now follow the chosen language (Task 040).
- A rich text field's label no longer takes in what you typed into the field
  (Task 039 C1); hash-route pages with different query state are told apart
  (C2); a field that stops being editable loses its FillNest control at once
  (C3).
- An ordinary text box's label no longer takes in the box's own text - what
  the page filled in, or what you typed where the page mirrors it there - as
  its name (Task 039 Addendum A).
- On the Picker's Field list (`Share with…`), a Field no longer stays looking
  selected - its row after a press on `Share` released elsewhere, or its
  outline on the page after the list closes under the pointer (Task 024
  Addendum E).

### Accessibility

- A cross-surface audit and a VoiceOver/zoom session with its repairs; modal
  dialogs contain focus and restore it (Tasks 023, 025).

### Privacy and security

- The Inline Picker's Shadow Roots ship closed (Task 030).
- No `web_accessible_resources`: icons are inlined (Task 028).
- Sensitive fields - passwords, payment, one-time codes and national identity
  numbers - receive no value read, no marker, no listener and no control
  (Tasks 016, 028).
- The privacy policy states every read and write the extension performs
  (`docs/privacy-policy.md`).

## [0.1.1] - 2026-08-24

The accepted V1 validation MVP (Tasks 001-009): single-Field plain-text
Templates with deliberate Search, insertion and Binding; per-Origin Website
Access with Global and per-Site Active or Pause; the Popup, the page status
control and the Side Panel; Template, Site and Settings management; versioned
local Backup and Restore; and Reset FillNest.
