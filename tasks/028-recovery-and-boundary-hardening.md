# Task 028 — Recovery And Boundary Hardening

**Version:** `0.1.2 Task 19`
**Status:** Complete on 2026-09-06. All four slices delivered with evidence;
one in-flight contract amendment is recorded in Slice 2. See `DEVELOPMENT.md`.
**Prerequisites:** None. Every slice is independent of Tasks 029–032.
**Source:** `tasks/evidence/whole-extension-audit-2026-09-06.md`, findings C1,
C2, S4, C3, S3.

## Goal

Close the audit findings that are cheap, independently verifiable, and restore
guarantees the product already documents. Nothing here changes a product
decision; each slice makes the implementation match a rule `PROJECT.md` or
`AGENTS.md` already states.

## User Value

A user whose local data becomes unreadable can still return FillNest to a
working state without developer tools. The most destructive operation in the
product is guarded as strictly as its two peers. Fields that carry a national
identity number are left alone, like every other sensitive field.

## Confirmed Product Decisions

- Reset does not need to understand stored data in order to destroy it. When
  the store is unreadable, Reset reports that fact and proceeds; it does not
  refuse.
- An unreadable-store Reset still requires exact typed `reset`, still removes
  Website Access before clearing local data, and still verifies the
  fresh-install end state. Only the impact preview changes.
- Typed `delete` is required only when an operation's final outcome empties
  the Template Library. Partial single and batch deletion keep ordinary
  confirmation, exactly as `PROJECT.md` states.
- Field Eligibility treats a national identity number as sensitive. This is an
  application of `PROJECT.md`'s existing "other sensitive or unsupported
  fields" rule, not a new category.

## Scope

### Slice 1 — Factory Reset survives an unreadable store (finding C1)

`ResetTransactionCoordinator.preview()` calls `businessRepo.read()`, and
`execute()` re-previews, so an `InvalidStoredDataError` makes Reset itself
throw. Task 009's designated escape hatch is unavailable in the one situation
that needs an escape hatch; the only remaining recovery is clearing extension
storage by hand.

- `preview()` distinguishes "read succeeded" from "read failed as
  `InvalidStoredDataError`". A failed read yields an impact preview marked
  unreadable rather than propagating.
- The unreadable preview reports that all local FillNest data will be cleared,
  without fabricating counts it cannot know. Website Access counts remain
  accurate; they come from Chrome, not from the store.
- The confirmation token for an unreadable preview derives from a defined
  sentinel, so `execute()`'s stale-preview check still works and a store that
  becomes readable again between preview and confirm still fails closed.
- Any error other than `InvalidStoredDataError` still propagates. Reset must
  not swallow a storage-platform failure.
- The Settings page states the unreadable condition plainly before the typed
  confirmation.

### Slice 2 — `DELETE_TEMPLATES` boundary guard (finding C2)

`RESET_FILLNEST` and `RESTORE_BACKUP_ARCHIVE` both enforce their typed
confirmation in the service worker and both require an extension-page sender.
`DELETE_TEMPLATES` does neither, despite being the only one of the three that
can empty the Template Library in a single call.

- `DELETE_TEMPLATES` requires `requireExtensionPage(sender)`.
- The service worker enforces typed `delete` **only when the request would
  leave the Template Library empty**, determined from current state at handling
  time rather than trusted from the caller.
- A partial delete carries no typed confirmation and is unaffected.
- ~~`DELETE_TEMPLATE` (single) receives the same sender guard for
  consistency.~~ **Amended during implementation, 2026-09-06.** This was
  wrong. The Inline Picker exposes `Delete template everywhere` on its own
  Template rows, which `PROJECT.md` requires ("Inline Picker Template rows
  reveal Edit, contextual Bind or Unbind, and Delete actions"), so
  `DELETE_TEMPLATE` legitimately arrives from a content script. Adding the
  guard broke that flow; the headed E2E suite caught it
  (`usage-accounting.spec.ts`, `side-panel-live-sync.spec.ts`).
  `DELETE_TEMPLATE` therefore keeps no sender guard, and the reason is
  recorded in the service worker so it is not "tidied up" later.
  `DELETE_TEMPLATES` (batch) is dispatched only from the Side Panel and keeps
  its guard.

### Slice 3 — National identity vetoes (finding S4)

`isSensitive` in `src/fields/field-eligibility.ts` covers passwords, OTP/2FA,
card data, bank identifiers, API keys, and tokens. It has no rule for national
identity numbers, so `<input type="text" name="ssn">` is classified supported
and receives a Field Profile, an extension marker, a focus listener, and UI.

- Add generic, evidence-based terms: `ssn`, `social security`,
  `social insurance`, `sin`, `nino`, `national insurance`, `national id`,
  `tax id`, `tin`, `passport`.
- Terms must be site-neutral and word-bounded, consistent with the existing
  rules. No selector, label text, or widget library from any specific site.
- Fixtures follow Task 017's matrix: positive cases, negative cases that must
  stay eligible (`passport notes`, `tax id explanation` free-text), and
  ambiguous cases.

### Slice 4 — Dead code and fingerprinting surface (findings C3, S3)

- Remove `UndoIcon` (`src/ui/icons/FillNestIcons.tsx`), `StaticSurface`
  (`src/ui/shared/StaticSurface.tsx`, whole file), and
  `isRemoveWebsiteAccessResultShape` (`src/ui/side-panel/SidePanelShared.tsx`).
  Each is referenced nowhere but its own definition; `AGENTS.md` forbids
  unused interfaces.
- Inline the four `public/*.svg` icons as `data:` URIs at their use sites and
  delete the `web_accessible_resources` block from `public/manifest.json`.
  This removes one extension-fingerprinting signal at no functional cost.
- Tighten `scripts/lib/manifest-policy.mjs` to assert that
  `web_accessible_resources` is **absent**, replacing the current rule that
  validates its contents.

## Explicit Non-Goals

- The Inline Picker's Shadow Root isolation model (audit finding S1). That is
  Task 030 and must not be pre-empted here.
- The `tabs` permission (finding S2). It belongs to a `0.2.0` Store-readiness
  task with its own justification.
- Any documentation reconciliation (Task 029).
- Any repository decomposition (Tasks 031, 032).
- Broadening or narrowing Field Eligibility beyond the identity-number terms
  named above.

## Acceptance Criteria

1. Given a store no migration recognizes, `GET_RESET_PREVIEW` returns an
   impact preview marked unreadable, and `RESET_FILLNEST` with typed `reset`
   and that preview's token completes and verifies the fresh-install state.
2. A storage-platform failure during Reset still propagates and does not
   present as an unreadable store.
3. `DELETE_TEMPLATES` from a non-extension-page sender is refused.
   `DELETE_TEMPLATE` is not, so the Picker's own row-level Delete keeps
   working (see the Slice 2 amendment).
4. `DELETE_TEMPLATES` that would empty the Template Library is refused without
   exact typed `delete`, and accepted with it. A partial delete is unaffected
   and requires no typed confirmation.
5. A field whose name, id, `aria-label`, or label denotes a national identity
   number is classified `sensitive` and receives no Field Profile, marker,
   listener, or UI. Free-text fields whose labels merely mention those words
   remain eligible.
6. The built package declares no `web_accessible_resources`, and the manifest
   policy gate fails if one is reintroduced.
7. `npm run check` and the complete headed E2E suite pass.

## Expected Implementation Slices

1. Reset recovery, its preview/token contract, and the Settings copy.
2. `DELETE_TEMPLATES` sender guard and conditional typed-`delete` enforcement.
3. Field Eligibility identity-number vetoes and fixtures.
4. Dead-export removal, icon inlining, manifest policy tightening.

Each slice records its own `npm run check` evidence before the next begins;
the full headed E2E suite runs once at the end of Slice 4.

---

# Addendum B — Unified Destructive-Operation Policy

**Status:** Accepted and authorized on 2026-09-06 by the project owner, from
the "Task bugs" review of Task 028. Bounded successor to Slice 2.

## Confirmed Product Decisions

- **Typed `delete` applies to a bulk operation whose result empties the
  Template Library.** A deliberate single-Template deletion is a targeted
  deletion and never requires typing - including when it is the last Template.
  This supersedes `PROJECT.md`'s "any operation whose final result deletes the
  entire Template Library requires typing `delete`, regardless of entry point."
- Rationale, from the owner's review: demanding a typed word to delete your
  only Template is disproportionate, and it made single deletion behave
  differently depending on the surface used. The row-level Delete and the
  Picker's own Delete never asked for it; only a one-item multi-select did.
- A count threshold (for example "more than three Templates") was considered
  and rejected: it decouples the gate from risk. Deleting 2-of-2 destroys
  everything with no gate, while deleting 4-of-400 demands one.
- Undo remains the safety net for a targeted single deletion, as it already is
  for the row-level and Picker paths.

## Scope

### B.1 — One destructive-operation inventory

Five entry points each decided independently what counts as destructive:
`DELETE_TEMPLATE`, `DELETE_TEMPLATES`, `DELETE_NEWLY_GLOBAL_TEMPLATES`,
`RESET_FILLNEST`, `RESTORE_BACKUP_ARCHIVE`. Nothing forced a new destructive
message to declare a policy at all.

`src/background/destructive-operation-policy.ts` becomes the single authority,
carrying a **total mapping over every `RuntimeRequest["type"]`**, in the same
shape as `business-state-broadcast.ts`. Adding a runtime message without
declaring its destructive policy becomes a TypeScript error, not an oversight.

Declared policies:

- `none` — not destructive.
- `targeted` — a deliberate single-object deletion; never typed.
- `bulk-empties-library` — typed `delete` when the operation removes more than
  one Template and the result empties the Library.
- `typed` with a required word — Reset (`reset`) and Restore (`restore`).

### B.2 — Apply the new rule

- `assertBulkDeleteConfirmation` replaces `assertBatchDeleteConfirmation`:
  emptiness is still derived from repository state at handling time, and a
  one-Template request is now always targeted.
- `DELETE_NEWLY_GLOBAL_TEMPLATES` is routed through the same rule. It could
  already empty the Library from the Sites page and had no boundary gate; its
  Side Panel sheet already collects a typed word, so only enforcement was
  missing.
- `RESET_FILLNEST` and `RESTORE_BACKUP_ARCHIVE` keep their behaviour but read
  their required word from the table instead of a literal, so the inventory is
  the single source.
- The Templates page stops demanding a typed word for a one-item selection, so
  the dialog matches what the boundary enforces.

### B.3 — `PROJECT.md`

The two sentences stating the superseded rule are corrected here rather than
deferred to Task 029, because leaving them would recreate audit finding D2 -
a stable document mandating behaviour the code deliberately does not have.
Task 029 does not need to revisit them.

## Explicit Non-Goals

- The Inline Picker isolation model (Task 030).
- Any change to what Undo covers.
- Reset and Restore confirmation words, previews, or tokens.

## Acceptance Criteria

1. Deleting a single Template never requires a typed word, on any surface,
   including when it is the last Template.
2. A bulk delete that empties the Library requires exact typed `delete`, judged
   from repository state at handling time.
3. `DELETE_NEWLY_GLOBAL_TEMPLATES` is subject to the same rule at the
   service-worker boundary.
4. Adding a new `RuntimeRequest` variant without a destructive policy fails
   type checking.
5. `PROJECT.md` states the rule the code implements.
6. `npm run check` and the complete headed E2E suite pass.
