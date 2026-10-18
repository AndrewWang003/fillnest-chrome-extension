# Task 012 — Sites And Templates Information Architecture

**Version:** `0.1.2 Task 03`
**Status:** Complete and accepted — 2026-08-25

## Goal

Make the separate Sites and Templates destinations understandable without
retaining a confusing historical `No Access` Site state in the Sites page.

## Confirmed Decisions

- Sites and Templates remain separate destinations. Sites owns currently
  authorized Website Access and Origin Activation; Templates owns Template
  discovery and deletion.
- Sites displays only Sites with one or more currently authorized Permission
  Origins. It contains no `No Access`, `Saved data, no access`, or dormant
  historical-Site section.
- `Clear site data` remains an independent action. It removes the selected
  Site's Page Profiles, Field Profiles, Bindings, labels, aliases, and Site
  Affinity while retaining Website Access.
- `Remove site` replaces the Sites-page `Remove access` action. One explicit
  confirmation invokes one protected operation: clear the selected Site Data
  and Site Affinity, then remove the selected Permission Origins' Website
  Access. It never deletes a Template automatically.
- Before changing data, the operation validates the displayed impact and saves
  an exact local rollback snapshot. Chrome permission removal is attempted
  only after local cleanup. If it fails, FillNest restores the snapshot and
  reports failure; success is reported only after both steps complete.
- A Template losing its last Site Affinity becomes Global. The success result
  presents the existing explicit `Delete` follow-up for exactly those newly
  Global Templates, with its existing Undo; Templates with other affinities
  remain filed under those Sites.
- External Chrome permission revocation remains non-destructive. It silently
  removes Website Access and may leave historical local data, but does not
  cause that Site to appear in Sites.

## Scope

### In Scope

- Sites projections, Site-page wording, empty states, and deep links needed
  for the authorized-Sites-only view.
- A single-confirmation, rollback-safe `Remove site` transaction spanning
  local Site Data cleanup and Chrome permission removal.
- Exact impact validation, rollback/failure handling, result feedback, and
  existing newly-Global delete/Undo follow-up.
- Runtime message, Repository, service-worker, unit/component, and headed
  extension evidence directly required by that transaction.
- Updates to the superseded Task 004 rules, PROJECT, CONTEXT, roadmap, and
  DEVELOPMENT current state.

### Out Of Scope

- Merging Sites and Templates, Site Affinity editing, Templates-page deletion
  redesign, new Template data, permission guessing, storing raw URLs, or a
  direct re-authorize action for a historical Site.
- Changing Pause behavior, external Chrome-revocation semantics, Backup /
  Restore, Reset, Picker behavior, or any network/account feature.

## Acceptance Criteria

- A Site with no authorized Permission Origin is absent from both Sites views,
  even when it retains Templates or saved mappings after external revocation.
- `Clear site data` remains available for authorized Sites and preserves
  Website Access exactly as before.
- `Remove site` has one confirmation and either applies the exact reviewed
  cleanup plus requested permission removal, or restores local data and
  reports failure. It never reports partial success.
- The result names both effects, and offers the exact newly-Global Template
  follow-up only when applicable; no Template is automatically deleted.
- Selected origins from unrelated Sites and unselected origins are untouched.
- Existing Template deep links for authorized Sites, external-revocation
  safety, exact-origin permission behavior, and all prior checks remain valid.

## Required Evidence

- Repository tests for reviewed-impact staleness, multi-Site isolation, and
  rollback after simulated permission failure.
- Component tests for absent historical Sites, one-confirmation copy, result
  follow-up, and focus/status behavior.
- Headed extension regression covering success and failure paths, followed by
  Spec and Project Standards review and hands-on user review.

## Current Evidence

- `npm run check` passed on 2026-08-25 with TypeScript, 39 unit test files,
  318 tests, build, and package verification.
- The full headed extension regression passed on 2026-08-25 (17/17), including
  authorized Remove site cleanup and hidden historical-Site behavior.
- The user reviewed the implementation and completed hands-on acceptance on
  2026-08-25.
