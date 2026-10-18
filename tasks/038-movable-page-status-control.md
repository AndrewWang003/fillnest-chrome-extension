# Task 038 — A Page Status Control The User Can Move

**Version:** `0.2.0` (planned for `0.2.1`; delivered before the Beta)
**Status:** **Accepted and implemented on 2026-09-10**, on the owner's explicit
direction to build it and continue straight into Task 037.
**Origin:** The project owner, 2026-09-10: the control in the bottom-right
corner covers page content that matters, and sometimes covers a site's own
controls.

## Goal

Let the user move the page status control out of the way, and have it stay
where they put it.

## User Value

FillNest asks for a permanent corner of every authorized page. Which corner is
free differs by site and by what the person is doing, and today there is no
answer except to live with it. One drag settles it everywhere.

## Confirmed Contract

### Free Position, Clamped

The control is dragged anywhere and remembers its exact position, clamped to
the viewport - the same behaviour the pinned Picker already has, through the
same `clampPickerPosition` helper and the same live-versus-saved split.

Snapping to a corner or an edge was considered. It cannot be dropped anywhere
bad, which is a real advantage given the complaint that started this. It was
not chosen because two floating pieces of FillNest on one page behaving by two
different rules is worse than either rule, and because viewport clamping
already solves the resize case that argues for corners.

**The owner chose this to see it working, having first preferred edge snapping.**
If free positioning turns out to feel worse in use, snapping is a change to one
function, not to the contract's shape - and this note is here so that
conversation starts from what was actually decided rather than from scratch.

### One Position, Not One Per Site

A single stored position, beside the Picker's own. Moving it once puts it
somewhere that works everywhere.

Per-Site positions were considered and rejected on cost rather than merit: a
Site-scoped record has to be understood by Clear Site Data, Remove Site, Backup
and Restore, and Reset FillNest - four accepted paths, each with its own tests -
to buy a precision most people will not use, because they settle on one corner
that is never in the way and stop thinking about it.

### Pointer Only, Deliberately

No keyboard path. The owner judged that moving it by keyboard is not worth
having, and this contract records that as a decision rather than an oversight,
because it is the kind of gap Task 023 exists to notice.

What that means, stated plainly: **a keyboard-only user cannot move this
control.** The mitigation already exists and is not new - the control can be
paused for a Site, or the Site's access removed, and neither needs a pointer.
Its position is also not information: nothing is behind it that FillNest itself
puts there.

### Two Rules That Keep A Drag From Being A Click

- A drag only begins after the pointer has moved past a small threshold.
  Without it, an unsteady click becomes a one-pixel drag and the activation
  toggle stops working for people whose hands are not steady.
- The position is written to storage **once, when the pointer is released** -
  never during the drag. This is what the Picker already does, and for the
  same reason: a drag is one decision, not sixty.

## Non-Goals

- Hiding the control entirely. That is a different feature with its own
  question - how it is summoned back - and the owner has not asked for it.
- Changing what the control does, how it looks, or what it announces.
- Per-Site or per-page positions.
- Moving the Picker's own anchor: it follows its Field, which is the point.

## Acceptance

1. The control can be dragged to any point in the viewport and stays there
   across a reload, a new tab, and a different Site.
2. A click without movement still toggles activation; a drag does not.
3. Resizing the window to smaller than the stored position brings the control
   back into view rather than leaving it off screen.
4. Exactly one storage write per drag, on release.
5. The control keeps its accessible name, its pressed state, its focus ring and
   its reduced-motion behaviour, in both themes.
6. `npm run check` and the complete headed suite pass, plus a headed regression
   that drags the control, reloads, and finds it in the new place.

## What Implementation Found

**The archive had to move too.** The stored position sits beside the Picker's
in the same record, and the Picker's is in a Backup Archive - so leaving this
one out would mean a Backup, Reset and Restore quietly returned the control to
its corner. It is optional in the archive, so every archive written before this
Task restores unchanged and `CURRENT_ARCHIVE_VERSION` does not move.

**The default is still expressed as a corner, not a point.** Until the user
drags it, the control keeps `right`/`bottom` - so it stays in the corner as the
window changes size, instead of being pinned to whatever pixel that corner
happened to be on first load. Only a deliberate drag turns it into a
`top`/`left` point.

**A drag that moved swallows its own click.** A `pointerup` after real movement
is followed by a `click` on the control, which would have toggled activation at
the end of every drag. One capture-phase listener, registered once and removed
after it fires, ends that.

## Stop Conditions

- If a drag threshold cannot be found that keeps the toggle reliable, stop and
  bring back edge snapping: a control that has become hard to press is worse
  than a control in the wrong place.
- If the position cannot be stored beside the Picker's without a Site-scoped
  record, stop: the four cleanup paths that would then need changing are not
  in this contract's scope.

## Addendum A — The Archive Never Carried The Position (2026-09-11)

**Status:** Implemented on 2026-09-11 on the owner's instruction to repair the pre-submission audit's findings; accepted by the owner on 2026-09-11 after hands-on QA.

This contract says the position travels in a Backup Archive beside the
Picker's. The archive type and validator accepted it, but the serializer did
not write it and the parser did not return it, so a Backup, Reset and Restore
returned the control to its corner. Both are repaired under Task 006 Addendum
A, and the worker round-trip test there asserts the position.

## Addendum B — A Way Back To The Corner (2026-09-11)

**Status:** Implemented on 2026-09-11 at the owner's request after hands-on
QA; the owner's re-test passed and it is accepted (2026-09-11).

A control that can be dragged anywhere can be dragged somewhere its owner then
cannot find. Settings now has **FillNest button on pages** with **Move to
bottom right**. It forgets the stored position (`RESET_PAGE_STATUS_POSITION`,
accepted only from FillNest's own pages) and tells every open authorized page,
whose button moves back to the default corner at once, without a reload. The
notification is its own (`PAGE_STATUS_POSITION_RESET`), not a business-state
change, so it clears no Undo and no Picker result. The pinned Picker's position
is untouched. The row is not offered while a failed Restore keeps FillNest
closed (Task 006 Addendum B), because the worker refuses it then.

**Evidence.** `tests/unit/service-worker-runtime.test.ts` (forgets the position,
notifies, refuses a page sender), `tests/unit/side-panel.test.tsx` (the
Settings row), and `tests/e2e/restore-moves-page-status.spec.ts` (an open
page's button returns to its corner in real Chromium).
