# Task 009 — Factory Reset

## Status

Complete and accepted after automated verification and user hands-on review (2026-08-24).

## Outcome

Settings has one destructive whole-product operation, **Reset FillNest**. It returns the extension to its freshly installed initial state. The existing whole-library Template deletion remains only in Templates.

## Contract

- Reset displays a current impact preview and requires the exact typed confirmation `reset`.
- Exporting a Backup is recommended but never required.
- Reset removes every granted exact Website Access permission and any associated dynamic content-script registration before deleting local business data.
- If any Website Access remains after removal is verified, local data is preserved and Reset reports the remaining origins. It must never report success.
- Once all permissions are verified removed, Reset deletes Templates, Site/Page/Field Profiles, Bindings, aliases, usage, picker preference, dormant preferences, and active activation preferences; Global Activation becomes Paused.
- The result is verified against canonical empty business state, canonical paused activation state, and zero granted Website Access before success is returned.
- A durable reset journal is written before permission removal. A service-worker restart resumes the user-confirmed reset rather than exposing a partial result. An invalid journal fails closed.
- Reset is irreversible. It has no Undo and must not reuse the Template-deletion flow.

## Boundaries

- No Import, sync, account, or remote storage is added.
- Reset does not delete browser downloads, Backup files, or unrelated extension/browser data.
- This contract does not change Restore semantics.

## Acceptance Evidence

- Unit coverage verifies preview staleness, permission-removal failure preserves business data, interruption recovery, and successful reset verification.
- `npm run check` passes (38 unit files / 302 tests and build verification); headed Playwright passes 17/17, including Reset's Settings flow.
- Manual verification confirms the extension has no Website Access, no saved Templates, and opens globally Paused after Reset.
- The user completed the hands-on review and accepted this behavior as the final MVP Reset contract.

---

## Addendum A — Live Page Teardown After Reset (2026-09-07)

**Status:** Complete on 2026-09-07 under this addendum; final evidence is
recorded in `DEVELOPMENT.md`.
**Owner:** Task 009. Reset already owns removal of every Website Access grant
and the verified return to the fresh-install state.

### Reported Defect

After Reset succeeds, the Side Panel correctly reports no Website Access and
Paused global activation, but an already-open authorized page can retain its
Field Control and an operable Picker until the page is reloaded.

The current working root-cause hypothesis is an ordering gap: Reset removes
permissions and then the generic broadcaster enumerates only origins that are
still granted, while `chrome.permissions.onRemoved` cleanup is asynchronous and
is not part of Reset's awaited success boundary. This hypothesis must be proved
by a failing regression before implementation.

### Contract

- Reset success includes convergence of already-open pages for every Origin
  whose Website Access the Reset removed.
- Before Reset reports success, those pages receive a deterministic revocation
  notification and remove the Field Control, open Picker, FillNest markers and
  content-runtime listeners without a reload.
- Chrome's external permission-removal event remains a separate idempotent
  fallback; Reset correctness must not depend on its scheduling.
- Permission removal, journal recovery, rollback/fail-closed behavior and the
  canonical empty-state verification remain unchanged.

### Acceptance Criteria

1. A headed extension test keeps an authorized page open through Reset and
   observes teardown without navigating or reloading it.
2. Reset does not report success until its explicit live-page notification
   attempt is complete; tabs without a receiver do not make the durable Reset
   fail.
3. A later external permission-removal event is harmless and does not recreate
   content UI or data.
4. Existing Reset recovery and permission-lifecycle tests remain passing.
5. `npm run check` and the complete headed E2E suite pass.

### Addendum A Evidence

`PermissionLifecycle.removeAllWebsiteAccess()` now explicitly sends the
idempotent revocation message to all open tabs for the Origins it actually
removed, while Chrome's external `onRemoved` path remains the fallback. Unit
and headed Reset E2E coverage pass; no Reset data or confirmation semantics
changed. Final complete E2E: 45/45.

## Addendum A.1 — Reset Must Tolerate Concurrent Unregistration (2026-09-07)

**Status:** Complete on 2026-09-07 under Addendum A.

### Reported Defect

Reset intermittently failed with the raw Chrome message
`Nonexistent script ID 'fillnest-<id>'`. The Side Panel kept the confirmation
dialog open and showed that message; the whole-product Reset aborted.

Removing a permission has two independent unregistration paths.
`removeAllWebsiteAccess` reconciles registrations itself, and Chrome dispatches
`permissions.onRemoved` on its own schedule, which reconciles again. Both
compute the same stale registration ids, so whichever loses the race asks
Chrome to unregister scripts that are already gone. Addendum A's comment
assumed the duplicate delivery was harmless - true for the revocation message,
which the platform absorbs, and false for unregistration, which propagated.

### How It Was Found

The headed Factory Reset E2E failed twice in eight full suites and never in
isolation, so it was first read as timing under load. It was not. A rejected
Reset leaves the confirmation dialog open exactly as a slow one does, and the
`toHaveCount(0)` assertion could not tell them apart. Asserting the dialog's
own error region first, and reporting its text, named the real cause
immediately.

The unit double hid it too: it deleted whatever ids it was handed. Chrome
rejects the entire batch when any id is unknown and unregisters nothing.

### Contract

- Unregistering a script that is already unregistered is the end state the
  caller asked for and must not fail Reset.
- It must not be absorbed blindly. Because Chrome rejects the whole batch, the
  remaining ids are re-read and retried, so one already-removed id can never
  leave a live registration behind.
- Any other unregistration failure still propagates.
- The in-memory platform double matches Chrome: an unknown id rejects the
  batch and unregisters nothing.

### Acceptance Criteria

1. `removeAllWebsiteAccess` completes when another path already unregistered
   the same scripts, and no registration survives.
2. A batch mixing an already-removed id with a live one still removes the live
   one.
3. A non-race unregistration failure still surfaces.
4. All three fail if the tolerance is removed.
5. `npm run check` and the complete headed E2E suite pass.
