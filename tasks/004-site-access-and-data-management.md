# Task Contract

## Task ID And Name

Task 004 - Site Access And Data Management

## Background

Task 002 exposes real Sites and Origin Activation state, while Task 003 makes Template relationships understandable. Users still need safe control over exact Chrome Website Access, registrable Site groupings, remembered Site Data, and Templates associated with a Site. These concepts must remain separate so a simple pause or permission removal cannot accidentally destroy user content.

## Goal

Deliver a complete Sites management page that groups exact Permission Origins under registrable Sites, supports independent and multi-select access operations, separates Website Access from Site Data, and clears Site data without implicit Template deletion.

## User Value

Users can pause a website, remove Chrome access, or clear stale Site data while seeing exactly which origins, mappings, aliases, and Template filing relationships will be affected. Ordinary Template management remains on the Templates page.

## Stable Product Decisions

### Site And Permission Origin Structure

- The Sites page groups by registrable Site and lists each full Permission Origin beneath it.
- Scheme, subdomain, and non-default port remain visible in the full Permission Origin.
- Main Site groups and child Permission Origins have independent selection and action controls.
- Default ordering is Site alphabetically, then Permission Origin alphabetically.
- User-authored free-form tags do not apply to Sites in this Task. Filters use status facets such as Authorized, Active, Pause, Has data, and Has Templates.
- Summary content begins with a plain-language sentence and key counts; detailed affected records are expandable.
- The Sites page reuses Task 003's current-tab-priority default expansion pattern at Site granularity: the Site matching the current browser tab starts expanded to its Permission Origins; other Sites start collapsed.
- A Site-level checkbox is a shortcut for selecting all of its child Permission Origins; it carries no independent meaning beyond that selection.

### Everyday Controls

- Active or Pause changes Origin Activation and preserves Website Access and Site Data.
- `Remove access` removes the selected Permission Host Pattern through Chrome, clears Origin Activation, unregisters its script, and tears down its UI in every affected open tab.
- Removing Website Access preserves Site Data, Templates, Bindings, Site Affinity, usage counts, aliases, and any future user-authored organization metadata.
- A short confirmation is sufficient for `Remove access` because it is reversible by granting access again and does not delete business data.
- Main Site and child-origin actions support multi-select, scoped to a single Site's own child Permission Origins; multi-select does not span multiple Sites at once.
- `Select all` and other batch controls apply to every currently filtered Permission Origin, including origins in collapsed Site groups, never to rows hidden by an active status filter. Group collapse is visual disclosure only and must not make first-entry selection unavailable.

### Site Data Action

The current Sites page has one Site-data action: `Clear site data`. It removes
the selected Site's remembered field data and its Template filing relationship;
it never deletes a Template implicitly.

#### Clear site data

- Deletes selected Page Profiles, Field Profiles, Bindings, System Display Labels, and User Aliases.
- Removes the selected Site from every Template's Site Affinity, regardless of
  whether that Template still has a current Binding on the Site.
- Preserves Template records, Template usage totals, Website Access, Global
  Activation, Origin Activation, and any future user-authored organization
  metadata.
- A Template with other Site Affinities remains filed under those other Sites.
  A Template that loses its final Site Affinity becomes Global.
- The result identifies the exact Templates that became Global in this
  operation and offers `Delete N newly Global Templates`. This optional delete
  follows ordinary batch Template deletion and Undo rules; it is not an
  implicit part of clearing Site data.
- The delete offer has the same global invalidation rule as Undo: any
  successful FillNest data, relationship, permission, or settings mutation
  silently removes it. Failed, cancelled, and non-mutating UI actions do not.
- The impact preview includes Page Profile, Field Profile, Binding, page-alias, and field-alias counts.
- The confirmation is bound to an expected impact token. If the mapping counts or alias counts change before execution, the operation fails closed and the user must review the updated summary.
- When selection spans several Sites, the confirmation names every affected Site and states that the operation covers all addresses belonging to each named Site, including addresses not selected.

### Sites Page Access-Only Simplification (Addendum, 2026-08-20 - Remediation In Progress)

This addendum **replaces** an earlier same-day Draft addendum ("Clean Up Sheet Redesign", commit `63a05fd`), which proposed keeping Template deletion on the Sites page behind a checkbox and a radio. A subsequent design handoff reversed that direction entirely. The earlier Draft was never accepted and is superseded in full; nothing in it survives.

This addendum records the newer Sites-page direction currently under remediation review. It is not Task 004 re-acceptance until final regression evidence, two-axis audit, and user hands-on review are complete.

#### Governing rule

**Nothing on the Sites page deletes a Template as part of Website Access.** The
only exception is the explicit, optional `Delete N newly Global Templates`
follow-up produced by `Clear site data`; it uses ordinary batch-delete and Undo
safeguards. Every other Template deletion - site-only, shared, or everywhere -
lives on the Templates page.

This is a hard invariant, not a default, because `chrome.permissions` grants are revocable from outside the extension - which is exactly what `PermissionLifecycle`'s `onRemoved` listener (`src/platform/chrome-permission-platform.ts`, `src/permissions/permission-lifecycle.ts`) exists to handle. If Template deletion shared a trigger with "access removed", the externally-revoked path and the user-clicked path would either diverge or destroy data the user never agreed to lose. Access is reversible; deletion is not; they must not share a trigger.

#### Historical accepted baseline superseded by this remediation

The 2026-08-19 accepted Task 004 implementation included two Sites-page Template deletion flows: `Remove site and site-only templates` and `Delete related templates everywhere`. Those flows are now historical evidence only. They are not part of the current implementation target and must not be used to justify any Sites-page Template mutation.

- No Sites-page action deletes Templates implicitly or offers `Also remove access for these Permission Origins`. `Clear site data` may explicitly offer ordinary batch deletion only for the exact Templates it has just made Global.
- Deleting a Site's Templates is done on the Templates page through its Site filter and ordinary Template deletion rules.
- The old `Advanced site actions` disclosure is superseded. One Site-scoped data action remains: `Clear site data`.

`Reset site mappings` is renamed **`Clear site data`** in the UI. Everyday access controls are retained. Outcome-Based Destructive Safety governs Templates-page deletion; Settings owns only Task 009's separate Factory Reset.

#### Sites page target state

- **One flat list of Permission Origins**, not Sites. No expandable Site cards, no nested address list, no view switcher. The header count reads granted addresses.
- Ordering: current tab's Site first, then Sites alphabetically, addresses adjacent to their own Site.
- A Site id prints **once** above its first row as a light group label - the only place Site identity appears - carrying `N Templates →` (deep link, below) and the Site's remembered-data counts (`3 pages · 4 fields`). Counts sit here because their scope is per-Site, matching the label.
- Status filter narrows to `Active` / `Paused`. The `noAccess` facet no longer applies to an address list; zero-origin Sites move to their own section (below).
- A toolbar above the list carries select-all, `N of M selected`, **`Remove access`**, and **`Clear site data`**.
- Per row: checkbox, origin (mono, single line, ellipsis - **not** `overflow-wrap: anywhere`), status line, then one real `Active` / `Paused` switch. Removing access is intentionally a toolbar action: selecting a single row then choosing `Remove access` is the single-address path, and selecting several rows is the batch path.
- Current-tab pinning and the `.site-row.current` treatment apply to the row.

#### `Clear site data` scope (decided 2026-08-20; revised 2026-08-25)

The user asked for `Clear mappings` beside `Remove access` in the selection toolbar, explicitly as an experiment ("try this then we see if it works or not"). The shipped label is `Clear site data`. This creates a granularity mismatch that must be resolved, not left implicit: `Remove access` acts on selected **origins**; clearing Site data acts on **Sites**. A flat-list selection can span several Sites.

Resolved: `Clear site data` acts on **the distinct Sites of the current selection**. Its confirmation must name those Sites explicitly and state that it covers **all** of each named Site's addresses, including any not selected. Both toolbar buttons therefore act on "what you selected", differing only in granularity, and the confirmation makes the widening explicit rather than silent.

If the selection spans several Sites, the confirmed action must execute as one atomic batch: first verify every Site's expected impact from the confirmation, then either clear all confirmed Sites' saved-field mappings in one serialized repository mutation or clear none. A stale impact for any one Site fails the whole batch closed and requires the user to review updated counts.

This placement is provisional and is to be re-evaluated against the built result before acceptance.

#### Two gaps a flat list creates

- **Zero-origin Sites have no row.** A Site with Templates, Page Profiles, or Field Profiles while having no granted access must remain manageable in the collapsed `Saved data, no access (N)` section. A bare Site record with neither access nor saved data is not displayed. Each saved-data row has a `NO ACCESS` pill, a Templates deep link, and, when mappings or Template Affinity exist, `Clear site data`; that action preserves Template records and follows the ordinary impact-confirmation contract.
- **Revoking access never rewrites Site Affinity.** A Site with zero granted origins is a supported state, so Templates keep their `siteAffinities` and are *not* migrated to Global on revocation.

#### Remove-access sheet

Replaces `RemoveAccessConfirm`, reusing the existing `.clean-up-sheet` bottom-sheet geometry. It states which origins are affected, that FillNest stops working there, that N Templates stay in the library still filed under that Site, and that access can be granted again from the field control. It carries a `Manage these N Templates →` deep link.

- Template count is `templates.filter(t => t.siteAffinities.includes(siteId)).length`.
- When a selection spans more than one Site, or the Site has no Templates, drop the count sentence and the deep link and use a neutral "Your Templates and saved data stay untouched." with `Open Templates →`.
- The deep link opens the Templates page with the Site filter pre-applied. Implemented by lifting Templates filter state to `SidePanel` or routing a pending-filter through the existing destination switch - **no new runtime message.**

#### Templates page

`Delete everywhere` gets **no dedicated flow** (decided 2026-08-20). The Templates page already provides the whole capability: multi-select Site filter → select all → batch `DELETE_TEMPLATES`, with whole-library detection and typed-`delete` already implemented. Routing through it keeps the selection visible before commit, which is the point of the deep link. `computeDeleteRelatedEverywhereImpact` is therefore deleted rather than moved.

The multi-select Site filter itself (union semantics in `listAllTemplates`, the `aria-multiselectable` popover, in-field removable labels, Backspace-removes-last, the union hint line) **already shipped on 2026-08-19** and is in scope for verification only, not re-implementation.

### Outcome-Based Destructive Safety

- This "Outcome-Based Destructive Safety" section governs Template deletion outcomes wherever they are initiated. The Sites page may initiate only the explicit newly-Global follow-up defined in `Clear site data`; otherwise the active Template-deletion authority is Task 003's Delete And Batch Delete section plus the Templates/Settings UI that implements it.
- Any entry point whose final result deletes the entire Template Library requires exact typed `delete`.
- A dedicated `Delete all templates` action always requires typed `delete`.
- Multi-select does not bypass entire-library detection.
- Site Data deletion and Template deletion remain separately named and summarized. No current Sites-page intent combines them.

## Vertical Slices

| Slice | Complete Behaviour | Required Evidence | Status |
| --- | --- | --- | --- |
| 1. Site Projection And Impact Model | Build deterministic Site/Permission Origin projections, status facets, Template classification, and dry-run impact summaries | Domain tests across subdomains, ports, multi-site Templates, missing permissions, and malformed data | Complete |
| 2. Everyday Access Controls | Deliver Active or Pause, Remove access, main/child selection, and multi-select without data deletion | Permissions, dynamic-registration, multi-tab, restart, and component/browser tests | Complete |
| 3. Reset Site Mappings | Atomically remove selected profiles, Bindings, labels, and aliases while retaining unrelated and preserved data | Repository transaction, alias-count, shared-record, rollback, and browser evidence | Complete |
| Historical 4. Remove Site Intent | Superseded 2026-08-19 Sites-page Template deletion flow | Retained only as historical accepted evidence | Superseded |
| Historical 5. Delete Related Everywhere | Superseded 2026-08-19 Sites-page Template deletion flow | Retained only as historical accepted evidence | Superseded |
| Historical 6. Integrated Evidence And Review | Review of the original accepted Task 004 scope | Retained only as historical accepted evidence | Superseded |
| 7. Sites Page Access-Only Simplification | Delete every Sites-page Template-deletion path; rebuild Sites as a flat Permission Origin list with group labels, a select-all toolbar, and the `Saved data, no access` section | Tests that external revocation leaves Templates intact, that a zero-origin Site still renders, and that no Sites-page path can reach `DELETE_TEMPLATES` | Remediation in review |
| 8. Remove-Access Sheet And Templates Deep Link | Replace `RemoveAccessConfirm` with the new sheet; deep-link into Templates with the Site filter pre-applied, without a new runtime message | Single-Site, multi-Site, and zero-Template copy paths; deep-link applies the filter; union-filter and re-grant regression tests | Remediation in review |
| 9. Impact Token And Final Review | Bind `Clear site data` confirmation to the previewed impact; run full regression, two-axis review, and user hands-on review | Stale-impact fail-closed tests, complete check set, headed E2E, and updated `DEVELOPMENT.md` | Remediation in review |

## Allowed Scope

- Site and Permission Origin projections from Repository and Chrome Permissions state.
- Origin Active or Pause and Website Access removal using the accepted Task 002 lifecycle.
- Status filters, main/child selection, multi-select, impact calculation, and confirmation UI.
- Repository operations for access-safe Site mapping cleanup.
- Templates-page Site filtering and ordinary Template deletion verification; the narrow Sites-page newly-Global deletion follow-up defined above.
- Tests, fixtures, directly affected documentation, and `DEVELOPMENT.md`.

## Forbidden Scope

- Conflating Site, Permission Origin, Permission Host Pattern, Site Affinity, or Site Data.
- Deleting business data as a side effect of Pause or Remove access.
- Binding Templates from the Side Panel.
- Adding Site free-form tags, raw browsing history, raw URL storage, telemetry, network calls, sync, accounts, plans, payments, quotas, AI, Contacts, sharing, Backup, or Restore.
- Weakening Chrome external-revocation handling or exact-origin registration.
- Any Sites-page Template deletion except the explicit newly-Global follow-up defined above, or any implicit conversion/re-filing caused by access removal.

## Acceptance Criteria

- Unrelated public-suffix Sites remain separate; subdomains group under the correct registrable Site while exact origins retain independent state and access.
- Every displayed count equals the dry-run operation result and the confirmed operation applies exactly that result or nothing.
- Pause and Remove access never alter business records.
- Removing a parent Site's access removes only its selected child Permission Host Patterns and does not touch unselected or unrelated origins.
- Clear site data retains Template records, permissions, activation preferences, and future user-authored organization metadata while removing the selected Site Affinity exactly as defined.
- Site-affiliated Templates remain filed under that Site after Website Access removal.
- Every path that empties the Template Library requires typed `delete`; no partial path does.
- Concurrent accepted operations serialize without silent data loss; stale impact summaries cannot execute after their source state changes without recalculation.
- Task 001-003 privacy, access, UI, insertion, and no-network guarantees remain passing.

### Addendum Criteria (Sites Page Access-Only Simplification, 2026-08-20)

These accompany the addendum above and replace the struck Remove-site / Delete-related-everywhere criteria.

- No Sites-page code path can reach `DELETE_TEMPLATES`, `DELETE_TEMPLATE`, `REMOVE_SITE`, `UPDATE_TEMPLATE`, `CREATE_TEMPLATE`, `CREATE_TEMPLATE_AND_BIND`, `BIND_TEMPLATE`, `UNBIND_TEMPLATE`, `RESTORE_TEMPLATE`, `RESTORE_TEMPLATES`, `SAVE_TEMPLATE_COPY_FOR_FIELD`, or any other Template/Binding mutation, except `DELETE_NEWLY_GLOBAL_TEMPLATES` and its ordinary `RESTORE_TEMPLATES` Undo after a `Clear site data` result. Enforced by test, not only by review.
- An external revocation through `chrome.permissions.onRemoved` leaves every Template, Site Affinity, Page Profile, and Field Profile untouched, and the affected Site still appears in the `Saved data, no access` section.
- Re-granting access to a previously revoked origin restores it with its stored activation preference, which `activation-repository` already persists across grants.
- A Site whose last origin is revoked *while it is the current tab* still renders, in the no-access section, without a crash from the current-tab pinning path.
- `Clear saved fields` on a selection spanning several Sites clears exactly those Sites' mappings as one atomic batch, its confirmation names every affected Site, and it states that all of each Site's addresses are covered - including addresses not selected.
- Revoking a Site's last access never rewrites that Site's Templates to Global; their `siteAffinities` are preserved exactly.
- The Templates Site filter returns the **union** of the selected Sites, not the intersection, and a Template with affinity to two selected Sites appears exactly once.
- The remove-access deep link lands on the Templates page with the Site filter already applied, and introduces no new runtime message type.

## Stop Conditions

Stop for approval if Chrome cannot remove selected exact origins independently, the requested cleanup cannot be expressed atomically, operation safety would require storing raw sensitive URLs, a stale impact summary cannot be invalidated reliably, or implementation enters Backup, sharing, accounts, or other later scope.

---

## Addendum B — Live Context Convergence After Clear Site Data (2026-09-07)

**Status:** Complete on 2026-09-07 under this addendum; final evidence is
recorded in `DEVELOPMENT.md`.
**Owner:** Task 004 owns `Clear site data`. Shared Template Set records in the
regression scenario retain Task 027's audience rules; this addendum does not
change those rules.

### Reported Defect

With Site 1 and Site 2 open in separate tabs, clearing Site 2 data and then
recreating Site 2 Fields, a Shared Template Set and Template T2 can leave Site
1 unable to find T2 until a page reload.

The exact stale layer is not yet proven. Candidate boundaries are the
content-script Field Context cache, the business-state broadcast, and the
already-open Picker's state refresh. No production fix may be chosen until an
automated reproduction distinguishes them.

### Contract

- `Clear site data` remains atomic and retains Website Access, activation and
  Template records under its existing rules.
- Every authorized live page must converge without reload after the clear and
  after subsequent mutations on another tab.
- A Field Context whose backing Page or Field Profile was removed must not be
  reused as authoritative after the clear. The next interaction re-resolves
  current context through the existing service-worker-owned Repository path.
- An already-open Picker and a Picker closed during the clear then reopened
  both read the latest committed business state.
- Search visibility continues to follow Task 027 audience rules. Owner-only
  Templates remain hidden from unrelated Fields; the repair must not broaden
  their audience merely to make the regression pass.

### Acceptance Criteria

1. A two-Origin headed E2E test performs clear, reconstruction and Site 1
   search without reloading either page.
2. The test covers both an already-open Site 1 Picker and a Picker reopened
   after the clear.
3. Evidence separately asserts durable Repository state, message-driven Picker
   refresh and re-resolution of a removed Field Context so the root cause is
   not inferred only from the final UI.
4. The test proves an ordinary/shared T2 becomes searchable and an owner-only
   T2 remains unavailable to an unrelated Field.
5. `npm run check` and the complete headed E2E suite pass.

### Addendum B Evidence

The content runtime now invalidates its document-lifetime Field Context cache
and re-resolves the focused Field on `BUSINESS_STATE_CHANGED`, preventing a
cleared Page/Field identity from being reused. The new two-Origin E2E proves
clear, reconstruction and cross-tab Search converge without either page being
reloaded. The focused unit test proves re-resolution is triggered by the
business-state notification. Final complete E2E: 45/45.

## Addendum B Root Cause — Still Unproven (2026-09-07)

**Status:** Addendum B's Acceptance Criterion 3 is **not met**. Criteria 1, 2,
4 and 5 are met. Recorded here rather than silently carried as complete.

Addendum B states outright that "the exact stale layer is not yet proven" and
that "no production fix may be chosen until an automated reproduction
distinguishes them". That reproduction was never recorded, and the fix that was
chosen - invalidating the content runtime's Field Context cache - does not
change the outcome of the test that accepted it.

Measured on 2026-09-07: with `FIELD_IDENTITY_INVALIDATION.RESET_SITE_MAPPINGS_BATCH`
set to `false`, so `Clear site data` performs no invalidation at all, the
two-Origin E2E still passes. The reason is visible in the code: the cache is
only consulted when `freshCandidates.has(field) || pageIdentityKey === null`,
and the test's Fields are ordinary Fields on a real path, so they are never
cached and re-resolve on every focus regardless. The already-open Picker
converges through a separate, pre-existing path - it re-reads state on any
`StateChangeNotification`.

So the E2E proves the product converges; it does not prove why, and it would
have passed before Addendum B's production change. What that change did
demonstrably alter is the SPA-reconstruction guarantee, which is why
Addendum B.1 exists.

The narrowed invalidation is kept: a change that can delete a stored Page or
Field Profile should not leave a live page holding it. It is correct by
construction rather than by measurement, and it is now scoped so it cannot
damage anything else.

### What Remains

The owner's reported scenario is not yet reproduced under automation. It
differs from the accepted test in ways that were never eliminated: it builds a
Shared Template Set across two Fields on Site 2, clears through the Sites page
rather than the runtime harness, and searches from a Site 1 Picker that was
already open. Re-running the owner's exact steps against the repaired build is
the next evidence, not another test written around the current one.

## Addendum B Root Cause — Closed By Owner Decision (2026-09-08)

The project owner decided not to pursue the unproven root cause further: the
reported behaviour no longer reproduces in hands-on QA, and it may have been a
mistake in the original manual steps. If it resurfaces - reported by the owner
or by a user - it is repaired then.

This closes the item deliberately. It is not an oversight, and a later agent
should not reopen it on its own initiative. What remains recorded above stands:
the invalidation that shipped was measured not to change the outcome of the
test that accepted it, and the criterion it was supposed to satisfy is still
marked not met.

## Addendum B.1 — Invalidate Only What The Change Can Remove (2026-09-07)

**Status:** Complete on 2026-09-07 under Addendum B.

Addendum B invalidated the content runtime's document-lifetime Field Context
cache on every `BUSINESS_STATE_CHANGED`. That cache has a second job: it is the
only thing that keeps an SPA-reconstructed Field's identity stable within a
document. Such a Field is a fresh candidate, resolves with no field identity
key, and so is issued a new Field Profile id on every re-resolution. Dropping
the cache after an ordinary mutation therefore discarded the identity that
mutation had just been recorded against - the Binding the user had made a
moment earlier stopped being found, with no Site Data cleared anywhere.

Addendum B's criterion 3 was met by a unit test that could not observe either
behaviour. A plain Field has a real page identity key, is never cached, and
re-resolves on every focus whether or not the cache is cleared, so the test
passed with the fix removed.

### Contract

- `BUSINESS_STATE_CHANGED` states whether the change could have removed stored
  Page or Field Profiles. Only such a change may invalidate a held identity.
- The producing side is a total mapping over `RuntimeRequest["type"]`
  (`FIELD_IDENTITY_INVALIDATION`), so a new request variant without an entry is
  a compile error rather than a silent gap. `Clear site data`, `Remove site`,
  Reset and Restore invalidate; nothing else does.
- Addendum B's convergence guarantees are unchanged: every authorized live page
  still converges without reload after a clear.

### Acceptance Criteria

1. A cached reconstructed Field keeps its identity across an ordinary mutation.
2. The same Field re-resolves when the change could have removed profiles.
3. Both assertions fail if the gate is removed, and the pre-existing
   Addendum B unit test is replaced rather than kept alongside them.
4. `npm run check` and the complete headed E2E suite pass.

## Review Gate

Review Spec and Project Standards separately. Adversarial review must include sibling subdomains and ports, multi-select that equals the entire library, concurrent edits during confirmation, shared Templates across several Sites, no-permission Site Data, permission removal through Chrome settings, malformed relationships, rollback failure, and keyboard-only destructive flows.

## Status

**Original Task 004 complete and accepted; current access-only remediation in review.** The original draft contract was audited against `PROJECT.md` and Task 003 (one cross-document inconsistency found and fixed: 8 remaining references to typed `DELETE` corrected to the shipped lowercase `delete`). The open product decisions were then resolved through a Grill Mode Q&A (2026-08-17, conducted in Chinese at the user's request): multi-select was scoped to a single Site's own child Permission Origins; the Sites page reused Task 003's current-tab-priority default expansion pattern at Site granularity; and `Select all`/batch controls applied only to the currently filtered and visible row set. Two natural extrapolations of these answers were also recorded without requiring separate questions: a Site-level checkbox was a shortcut for selecting its child Permission Origins, and the original Advanced Site Actions were always single-Site-scoped. The user confirmed the Q&A was complete and, in the same message, accepted that original contract and authorized implementation of all six original Vertical Slices continuously, without per-slice confirmation.

All six Vertical Slices were implemented and the Slice 6 mandatory integrated review (Spec, Project Standards, and the full adversarial Review Gate list) completed with no unresolved findings; see `DEVELOPMENT.md`'s "Task 004 Slice 6: Integrated Evidence And Review" for the full write-up.

The Sites page was subsequently redesigned twice outside this contract (design-canvas-driven work, each separately authorized by the user; see `DEVELOPMENT.md`'s "Sites Page Redesign" and multi-select Site filter sections), which superseded one of this contract's own Grill Mode decisions - "No Search box is added to the Sites page for this Task" - the later redesign added one, per the user's explicit newer instruction. A 2026-08-19 re-audit of every other acceptance criterion against the resulting current page found and fixed one real regression (the current-tab Site had silently stopped auto-expanding); see `DEVELOPMENT.md`'s "Task 004 Status Audit And Two Fixes (2026-08-19)". **The user then reviewed the current build and confirmed acceptance (2026-08-19): "I have audit task4, it can mark as Finished."**

**Access-only remediation in review (2026-08-20): Sites Page Access-Only Simplification.** Recorded above as Slices 7-9. It supersedes the original `Remove site and site-only templates` and `Delete related templates everywhere` flows, rebuilding Sites as a flat Permission Origin list and moving ordinary Template deletion to the Templates page. The user accepted the later 2026-08-25 `Clear site data` exception: it removes selected Site Affinity and may offer deletion only for the exact Templates newly made Global, with ordinary deletion and Undo safeguards.

This addendum **replaces an earlier same-day Draft addendum** ("Clean Up Sheet Redesign", commit `63a05fd`), written from the user's Task 005 QA feedback, which proposed the opposite - keeping Template deletion on the Sites page behind a checkbox and a radio. A later design handoff reversed that direction. The earlier Draft was never accepted; it is superseded in full and none of it survives.

Three open decisions were resolved with the user on 2026-08-20 before the addendum was written: `Clear saved fields` moves beside `Remove access` in the selection toolbar (explicitly provisional - "try this then we see if it works or not"); remembered-data counts move to the Site group label; and the dedicated delete-everywhere flow is dropped in favour of the Templates page's already-shipped Site filter plus batch delete. Final acceptance requires regression evidence, two-axis audit, and user hands-on review of the new Sites page.

**Superseded by Task 012 (2026-08-25).** The historical `No Access` / `Saved data, no access` display and the access-only `Remove access` action are no longer current product behavior. Task 012 keeps `Clear site data` as an independent, access-preserving action, but replaces the explicit Sites-page removal action with one-confirmation `Remove site`: it clears the reviewed Site Data and Site Affinity, then removes selected Website Access with exact local rollback on permission failure. It never automatically deletes Templates; the existing newly-Global explicit delete follow-up remains the sole exception to the Sites page's ordinary no-Template-deletion boundary. External Chrome permission revocation remains non-destructive, but historical Sites are not displayed.

**Post-acceptance no-access display parity addendum (2026-08-22).** The user reported that once a Site's access is removed and its saved fields cleared, its `Saved data, no access` row (in the flat `All addresses` view) shows only a `NO ACCESS` pill with no remaining action, and asked whether the row is necessary and how a user is meant to act on it.

This permanence is by design, not a defect: `PROJECT.md` and this contract's own governing rule make Site Affinity sticky - a Site with a Template still keeps that Template filed under it regardless of access state, and the Sites page itself is never allowed to delete, convert, or re-file a Template (see "Governing rule" above). The only way to make such a row stop appearing is to change that Template's own Site Affinity (typically by deleting the Template, or a future per-Template Site Affinity edit, which remains out of scope - "Selected multi-site affinity management beyond automatic affinity creation" is an explicit `PROJECT.md` Deferred Decision), and that action belongs on the Templates page, not here.

The real gap found: the `By site` grouped view's no-access rows already carry an `N Templates →` deep link to the Templates page filtered by that Site (via `onOpenTemplatesForSite`), but the flat view's `Saved data, no access` section never did - once `Clear saved fields` had nothing left to clear, that row had no remaining action or path to the Templates page at all. Resolved: the flat view's dormant/no-access rows now carry the same `N Templates →` deep link as the grouped view, for parity and discoverability. This is a UI consistency fix, not a new deletion capability; the Sites page still never deletes, converts, or re-files a Template.

**Post-acceptance `Clear saved fields` confirm-button wording addendum (2026-08-22).** The user reported that the `ClearMappingsSheet`'s confirm button repeats the exact same label as the row action that opened it ("Clear saved fields" twice), which reads as a possible duplicate or malfunction rather than a confirmation step. Fixed: the sheet's confirm button now reads `Confirm`, matching the sheet's own already-stated title (`Clear saved fields for N Site(s)?`) and body copy, so the button's job (confirm this specific, already-described action) is distinguishable from the row action that opened it. `RemoveAccessSheet`'s confirm button intentionally keeps its repeated `Remove access` label, since it was not reported as confusing and the "click the same action again to confirm" pattern is otherwise an accepted convention in this UI - this addendum narrows the fix to the one label the user identified as unclear, rather than renaming every confirm button in the product.

Separately investigated: a report that clicking `Clear saved fields` "a second time" had no effect. `confirmClearMappings` already surfaces `response.error` through `onError` on any failure (including a stale-impact rejection), so a failure is not silently swallowed in current source; a click producing no visible change is more likely explained by the row's `Clear saved fields` button correctly disappearing once `pageProfileCount` reaches `0` (nothing left to clear) than by the confirm action failing silently. No code defect was found or changed for this specific symptom.
