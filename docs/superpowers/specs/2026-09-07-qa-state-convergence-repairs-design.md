# QA State Convergence Repairs Design

**Date:** 2026-09-07
**Status:** Approved for direct implementation by the project owner on
2026-09-07.
**Owning contracts:** Task 009 Addendum A, Task 004 Addendum B, and Task 027
Addendum E.

## Goal

Repair the three reported QA failures without mixing behavior changes into
Task 032 repository decomposition: Reset must tear down live pages, the two
Bind audiences must have distinct icons, and pages must converge after Clear
Site Data and reconstruction without a reload.

## Work Boundaries

The work is three independently reviewable slices. Each starts with a failing
regression, implements only the proved root cause, runs its focused checks and
commits before the next slice. Task 032 Phase B remains frozen throughout.

### Slice 1 — Reset Live Teardown

The Reset transaction already captures the granted Origins in its journal.
Use that durable operation context to make live-page notification part of the
awaited Reset success path instead of re-enumerating only post-removal grants.
The notification is best-effort per tab but deterministic as a completed
attempt: a missing receiver cannot roll durable Reset data back, while an
available content runtime must receive the same idempotent revocation message
used for external permission removal.

The regression keeps a production-like extension page open, performs Reset,
and observes removal of its control, Picker and markers without navigation.

### Slice 2 — Bind Audience Icons

Move the owner-supplied `public/share-network.svg` into
`src/ui/icons/assets/share-network.svg`, import it with Vite's existing
`?inline` boundary, and expose a focused icon component for the Shared Set Bind
action. Keep the existing Bind component for the field-only action. The image
inside each native button remains decorative because the button's accessible
name communicates the action.

No manifest resource exposure or new dependency is permitted. Component tests
assert both semantic labels and different `data-fillnest-asset` values.

### Slice 3 — Clear Site Data Convergence

First reproduce the full two-Origin sequence and inspect three checkpoints:
the committed Repository state, delivery of `BUSINESS_STATE_CHANGED`, and the
Field Context used by the next Site 2 interaction. Test both open and reopened
Site 1 Pickers.

The leading hypothesis is that the content script's document-lifetime
`fieldContexts` cache survives deletion of the profiles it names. A business
state change currently refreshes Picker state but does not explicitly
invalidate or re-resolve that cache. If the failing test proves this, introduce
a content-runtime context epoch (or equivalent invalidation boundary), then
re-resolve the focused Field before its next data operation. Do not clear DOM
recognition evidence or broaden Template search visibility. If evidence points
to broadcast delivery or Picker refresh instead, repair that proved boundary
and record the corrected root cause in the owning contract.

The regression uses an ordinary Shared Set T2 for positive cross-Site search
and an owner-only T2 as the negative audience control.

## Error And Recovery Behavior

- Reset preserves its journaled, fail-closed durable transaction. Live-page
  delivery failures are reported only through existing unreachable-tab
  handling and never resurrect permissions or data.
- Clear Site Data stays atomic. A refresh failure leaves the committed state
  authoritative; the next Picker open re-reads it and no stale cache may write
  deleted identities back as if they were current.
- UI icon loading is compile-time. A missing asset must fail the build rather
  than fall back to a misleading glyph.

## Verification

Each slice requires a red/green focused test and `git diff --check`. The final
gate is `npm run check`, the production-build Picker isolation test, the full
headed E2E suite, and independent Spec plus Project Standards review with all
P0-P2 findings resolved or explicitly deferred by the owner.

## Non-Goals

- No Task 032 Phase B command extraction.
- No change to Reset's destructive scope or confirmation.
- No change to Template audiences, search ranking or Site Affinity.
- No new permissions, dependencies, public extension assets or network use.
- No redesign of `Share this version`; its reported discoverability concern is
  evaluated separately using its existing owner-only precondition.
