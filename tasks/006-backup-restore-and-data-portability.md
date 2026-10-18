# Task Contract

## Task ID And Name

Task 006 - Backup, Restore And Data Portability

## Goal

Implement a local Backup Archive under `Settings > Data` that exports the complete restorable FillNest dataset and restores it only after strict validation, relationship checks, a visible current-data export recommendation, and an explicit replacement confirmation.

## Stable Product Decisions

- Task 006 begins with a behaviour-preserving Side Panel module split before Backup/Restore UI is added. The split is a maintainability prerequisite, not a redesign.
- The boundary-prep split preserves the current accepted or in-review page designs as they stand when Task 006 starts. It must not use the extraction as a vehicle to rework the Sites page. In particular, Sites-page structure, access toolbar behaviour, the `Active` / `Paused` switch, `Remove access`, `Clear saved fields`, `Saved data, no access`, and Templates deep-link behaviour remain governed by Task 004. Any later Claude Design Sites UI revision must be accepted into Task 004 before Slice 0 treats it as the source behaviour to preserve.
- V1 provides Backup and complete Restore, not merge Import. Product copy must state that Restore replaces FillNest data and is not an Import operation.
- A future Import flow may translate another supported package into a separately validated change plan, but Task 006 creates no unused Import API, merge policy, conflict resolver, placeholder schema, or placeholder UI.
- A Backup Archive contains every durable record required for restore, including Templates, Site Affinity, Site/Page/Field Profiles and the privacy-safe stored evidence from which System Display Labels are derived, the safe Field `documentOrder` ordinal, Bindings, usage counts, User Aliases, Global Activation, per-Permission-Origin Activation preferences, the saved Picker position, field-local manual ordering, and any other implemented durable user-authored organization preference that exists when Backup is implemented. Derived labels themselves are rebuilt rather than duplicated in the Archive.
- It excludes Chrome-granted Website Access, Permission Host Patterns as authorization, rebuildable indexes/caches, telemetry, browser profile data, current navigation, Search queries, filters, selections, expansion state, transient Undo, open sheets/dialogs, and current errors.
- Export is local and user-initiated. FillNest performs no upload or network request.
- Before download, the UI warns that Template content and user-authored aliases may contain private information and that an archive intended for personal backup should not be shared without review.
- Export produces UTF-8 JSON named `fillnest-backup-YYYY-MM-DD.json`. Its top-level envelope contains the exact format discriminator `fillnest-backup`, an integer `archiveVersion`, an ISO `createdAt`, an informational source application version, and a structured payload separated into business data, Activation preferences, and other durable user preferences. Compatibility is determined by `archiveVersion`, not by the application version. The Archive schema is separate from Repository storage schemas; a Repository object must not be downloaded as the archive format directly.
- V1 Archive input and output have a hard UTF-8 limit of **3 MiB**. This is the accepted operational capacity boundary: Restore persists a complete prior-state journal while replacing the current state, and the 3 MiB limit keeps that dual-state peak within the 10 MiB `chrome.storage.local` baseline without `unlimitedStorage`.
- Extension upgrades migrate stored Repository and Activation data through explicit, sequential migrations to their current canonical schemas. Export always emits the current Archive version.
- Restore accepts the current Archive version and older versions for which FillNest contains an explicit sequential migration path. It rejects newer versions and older versions without a complete migration path.
- For a supported Archive version, validation is strict: unknown properties, unknown record kinds, incorrect types, duplicate IDs, duplicate Template/Field Bindings, invalid limits, and every inconsistent relationship reject the entire Archive. Version migration, not ignored data, is the compatibility mechanism.
- Restore decodes and migrates in memory, validates the complete candidate dataset, and only then shows an impact preview. No preview-stage work mutates current data.
- The impact preview shows `Current -> Backup` counts for Templates, Sites/Site Affinities, Page Profiles, Field Profiles, Bindings, aliases, and durable settings. It separately states the Global Activation change, how many currently authorized Permission Origins will become Active or Paused, and that Chrome Website Access is not restored.
- If current FillNest data is non-empty, Restore shows a prominent recommendation to export a current backup before replacement. Export is available within the Restore flow but is optional and does not lock Restore. FillNest must not claim that it can prove whether any earlier browser download was saved.
- Final confirmation requires the user to type exact lowercase `restore`. Confirmation is bound to the previewed current dataset revision/impact token; any intervening accepted mutation invalidates it and requires a new preview.
- Accepted Restore replaces the complete current business dataset, durable preferences, and Activation preferences as one serialized all-or-nothing operation. It does not merge partial records in V1.
- Failed validation, stale confirmation, persistence failure, or interrupted commit leaves the prior complete business and Activation state recoverable. Restart reconciliation must finish or roll back an interrupted transaction without exposing a mixed state.
- Restored data does not grant Website Access or silently request it. Restored Origin Activation without matching Chrome permission is a dormant preference until the user explicitly grants access again.
- After successful Restore, restored Activation applies immediately. Popup, Side Panel, and injected pages refresh from authoritative state; if an already-open page cannot refresh, Restore remains successful and the UI identifies that the page needs reload.
- A future Template Share Package is separate and excluded from V1.

## Repository Integrity Prerequisite

Backup cannot be trustworthy if an accepted application mutation can persist a state that the next read or Restore cannot validate. Before Archive export is implemented, Task 006 adds one canonical candidate-state commit gate behind the Repository boundary.

- Every business-data mutation constructs a complete candidate state and passes the same canonical structural, identifier, uniqueness, and relationship validation before storage is written.
- Validation requires unique IDs within each record collection and rejects any cross-collection collision where an unqualified ID would be ambiguous; every Site/Page/Field/Binding relationship must resolve; each Field belongs to its declared Page; and a Template may have at most one Binding to the same Field Profile.
- A failed candidate validation performs no write and emits no successful business-state broadcast.
- Mutation serialization continues to prevent accepted concurrent writes from overwriting one another.
- Backup reads only a canonical validated snapshot. It must refuse export rather than serialize malformed current state as a valid Backup Archive.
- This prerequisite hardens the Task 003 Template/Binding behaviours without reopening Task 001's historical contract or authorizing unrelated schema redesign.

## Side Panel Split Plan

`src/ui/side-panel/SidePanel.tsx` has grown large enough that adding Backup/Restore directly to it would increase risk. Before implementing Backup/Restore behaviour, split it along existing page and flow boundaries while preserving user-visible behaviour.

Target boundaries:

- `SidePanelShell`: top-level navigation, refresh, shared error state, live business/activation loading, and cross-page navigation state.
- `TemplatesPage`: Template Library views, filters, field-first view, edit/delete/undo flows, and Templates-page Site filter deep link handling.
- `SitesPage`: the current Task 004 Sites experience as implemented/accepted before Task 006 starts: Permission Origin rows, selection toolbar, `Active` / `Paused` origin switch, Remove access sheet, Clear saved fields sheet, Saved data/no-access section, and Templates deep-link trigger. Extraction must not add, remove, or redesign Site group labels, row controls, selection behaviour, filters, sheets, or deep links.
- `SettingsPage`: Global Activation and `Settings > Data`, including the future Backup/Restore UI.
- Shared helpers/components only when they remove real duplication already present in the split, such as confirmation sheets, Template row rendering, or local `sendRequest` response guards. Do not create unused generic page frameworks.

Split rules:

- No user-visible behaviour change during the split.
- No Sites UI redesign during the split; if Task 004's newest Sites design is still in review, Slice 0 preserves the latest accepted/in-review behaviour and records any unresolved Task 004 UI question rather than deciding it.
- No schema, Repository, permission, activation, Search, deletion, Backup, or Restore behaviour change during the split.
- Preserve existing tests before adding Backup/Restore tests.
- Keep the first split small enough to review by file boundary: page extraction first, then shared flow extraction only where the extracted pages still duplicate meaningful logic.
- The split is complete when `SidePanel.tsx` is a thin shell and each page module owns only its own UI state and flows.

## Vertical Slices

| Slice | Outcome | Evidence | Status |
| --- | --- | --- | --- |
| 0. Side Panel Boundary Prep | Split `SidePanel.tsx` into shell, page modules, and only necessary shared components without behaviour changes, preserving the current Task 004 Sites design exactly | Existing unit/e2e regression plus diff review proving no product behaviour changed, including Sites-page regression evidence | Completed & Verified |
| 1. Repository Integrity | Add the canonical candidate-state commit gate and uniqueness/relationship invariants without changing accepted product behaviour | Mutation matrix, malformed candidate, duplicate ID/Binding, concurrency, no-write, and no-broadcast tests | Completed & Verified |
| 2. Archive Contract | Define the independent versioned JSON Archive schema, version-bound gating (rejects newer versions and versions below 1), strict validators, evidence-based safety limits, and privacy boundary | Deterministic round-trip, version-gate (rejects newer/below-1), malformed, oversized, unknown-field, duplicate-ID, and relationship tests | Completed & Verified |
| 3. Export | Add local JSON download with summary and privacy warning | Byte-stable fixture with fixed metadata, canonical-snapshot, filename, UI, package, and no-network evidence | Completed & Verified |
| 4. Restore | Add export recommendation, detailed preview, exact `restore`, stale-impact protection, cross-state atomic replacement, reconciliation, and failure recovery | Corruption, stale-state, concurrency, interrupted-commit, rollback, restart, activation, and browser tests | Completed & Verified |
| 5. Review | Run full regression and two-axis review | Complete check set, user hands-on review, and updated `DEVELOPMENT.md` | Completed & Accepted |

## Forbidden Scope

- Merge Import, sharing, import from another person's share package, cloud storage, sync, compression dependencies, encryption/key management, accounts, plans, payments, telemetry, network upload, or automatic scheduled backup.
- Exporting Chrome permission as if it could be restored.
- Partial or best-effort mutation after any validation failure.
- Ignoring unknown Archive data, restoring only the valid subset, or exposing a raw Repository state as an Archive.
- Persistent internal pre-Restore snapshots or an Undo Restore history in V1.
- Unused future Import interfaces, merge/conflict abstractions, placeholder settings, or placeholder data models.
- Redesigning the Side Panel shell, changing navigation, changing Templates/Sites behaviour, resolving open Sites UI design questions, or introducing a generic page framework during the boundary-prep split.

## Acceptance Criteria

- A valid export restored into an empty compatible profile reproduces the complete business dataset, durable user preferences, Global Activation, and per-Origin Activation preferences.
- Current stored data migrates to the current canonical schema on extension upgrade, and every new export uses the current Archive version.
- Current and explicitly supported older Archives round-trip through migration without losing any defined data; newer, unsupported, or partially understood Archives change nothing.
- Permission state remains governed by Chrome and is neither exported as authorization nor silently requested during restore.
- Invalid, unsupported, truncated, oversized, malicious, unknown-field, duplicate-ID, duplicate-Binding, or relationally inconsistent Archives change nothing.
- Every accepted Repository mutation passes candidate-state validation before write; failure preserves the prior state and sends no success broadcast.
- The impact preview accurately states replacement counts, Activation effects on currently authorized origins, the Website Access exclusion, and that existing local data will be replaced.
- Non-empty current data shows the export recommendation; Restore requires a current impact token and exact typed `restore`, but no export token or download gate.
- Restore serializes against all affected Repository/Activation mutations and either commits the complete validated state or preserves the prior complete state, including across service-worker interruption and restart.
- Successful Restore immediately reconciles extension surfaces and authorized open pages; unreachable pages are reported as needing reload.
- Exported content contains no rebuildable cache or unexpected browser/page data.
- All prior privacy, permission, management, insertion, and no-network checks remain passing.

## Stop Conditions

Stop for approval if implementation requires network access, a new archive/compression dependency, merge semantics, permission restoration, encryption/key decisions, sharing, changes to accepted domain identity, or a product quota rather than an evidence-based malicious-input safety limit.

## Status

Completed & accepted (2026-08-21). The accepted V1 capacity boundary is 3 MiB. Automated verification covers the byte boundary and both import/export enforcement; the user completed hands-on review of the product flow.

**Independent audit remediation (2026-08-21):**

- Restore journal validation now uses the canonical Repository and Activation validators. An invalid or failed journal remains intact and blocks normal operation rather than allowing a potentially mixed state to receive further mutations. This is intentionally fail-closed; recovery handling beyond preserving the evidence is not a V1 data-reset feature.
- `ENABLE_SITE` is two-phase: it starts Chrome's permission request immediately in the originating click stack, then queues durable activation work behind startup recovery. This preserves the required user gesture without allowing persistence to race Restore recovery.
- Export had no byte-size check symmetric with import's - a dataset within all count/length limits could still produce a pretty-printed archive that this same extension's own Restore would then reject as oversized. Fixed in `serializeBackupArchive`.
- The restore file picker read the entire selected file into memory before any size check ran. Fixed: `file.size` is now checked before `file.text()`.

Slice 2's evidence line previously claimed migration tests that don't exist - `migrateAndValidateArchive` only gates version bounds (there is one Archive version, so there is nothing to migrate from yet); the doc comment and the Vertical Slices table have been corrected to describe version-bound gating rather than sequential migration. Building unused migration machinery ahead of a second Archive version would itself be scope creep.

The same remediation also:

- The confirmation/safety tokens used a 32-bit DJB2 hash, not cryptographically collision-resistant. Fixed: `restore-impact.ts` now derives every token from `crypto.subtle.digest("SHA-256", ...)`; the affected functions are now async.
- `Binding.order` uniqueness within a Field was documented but not a validated invariant, and the order-assignment helper computed a plain count rather than a max+1, so unbinding a non-last Binding and then binding a new one could silently collide. Fixed: `validateCandidateInvariants` now rejects a duplicate `order` per Field, and `nextBindingOrder` now derives from the existing max.
- Validation error messages echoed unbounded archive content (property names, values) directly into thrown errors. Fixed: `archive-contract.ts` truncates any echoed value to 64 characters before interpolating it into an error message.
- `site.id` and `template.siteAffinities` had no explicit length/count cap independent of the overall envelope byte limit. Fixed: added `MAX_SITE_ID_LENGTH` (255) and `MAX_SITE_AFFINITIES_PER_TEMPLATE` (1,000) checks in `validateLimits`.

**Hands-on remediation (2026-08-21):** Safety-backup gating is replaced by an optional, visible export recommendation because a browser download performed before opening Restore cannot be reliably detected. The stale impact token remains mandatory; its error and Archive-validation errors must render inside the Restore surface as well as at the Settings entry point, so an open sheet never hides the reason an action was rejected. Archive Field Profiles carry the privacy-safe `documentOrder` ordinal.

The remediation is covered by updated Restore, Archive, Repository, and queue tests. Full verification: `tsc --noEmit` clean, `vitest run` 273/273 passing, `npm run build` succeeds, and headed E2E passes 16/16.

## Addendum A — Restore Dropped Fields, And A Failed Rollback Did Not Stop The Worker (2026-09-11)

**Status:** Implemented on 2026-09-11 on the owner's instruction to repair the pre-submission audit's findings; accepted by the owner on 2026-09-11 after hands-on QA.

**Defect 1: Restore rebuilt records in a second, hand-written copy.** The
service worker mapped the parsed archive to state field by field, separately
from the archive module. Each field added to a record since then was exported
and parsed, then dropped by that copy: a Binding's `privateToField` (Task 027
Addendum C.2, so a Restore re-opened the private-Template leak that addendum
closed), a Field's `observedTitle` and `insertionRejected` (Task 036). The page
status control's position (Task 038) was dropped earlier still, by the
archive's own serializer and parser. **Repair:** `businessStateFromArchive` in
`src/backup/archive-contract.ts` is now the only place an archive becomes
state, and it passes the validated payload through whole. The serializer and
parser carry `pageStatusPosition`. `CURRENT_ARCHIVE_VERSION` does not move:
every field involved was already optional.

**Defect 2: fail-closed only at startup.** A Restore whose rollback failed
left a `failed` journal holding the prior data, but the running worker went on
accepting writes, and a second Restore overwrote that journal: the only copy
of the user's prior data. **Repair:** the coordinator remembers a failed
rollback, and the worker refuses every further request in that session,
exactly as it does when it finds a failed journal at startup.

**Open, not changed here:** a `failed` journal blocks the extension until the
journal is removed, and nothing in the product removes it. That is this
contract's original fail-closed design. How the user gets out of it is a
product decision for the owner.

**Evidence.** `tests/unit/service-worker-runtime.test.ts` runs the real service
worker: a Restore must return every business record exactly as backed up, and
an injected rollback failure must block the next write.

**Repaired after the owner's QA (2026-09-11).** A Restore put the page status
control's position back in storage, but an open page kept its control where
it was until reloaded: the content script read the position once, when the
control first appeared, and the Picker's saved position the same way. Restore,
Reset and Clear Site Data announce a change that invalidates Field identities;
an open page now re-reads both positions on that announcement.
`tests/e2e/restore-moves-page-status.spec.ts` failed before the repair.

## Addendum B — A Way Out Of A Failed Restore (2026-09-11)

**Status:** Decided by the project owner on 2026-09-11 and implemented the same day; accepted by the owner on 2026-09-11 after hands-on QA. Points 4 and 5 came from that QA and passed its re-test.

**The gap.** Addendum A made a failed rollback fail closed in the running
worker too. A `failed` journal then blocked every request, even after a
browser restart, and nothing in the product removed it. The user's only exit
was uninstalling, which deletes the data the journal existed to protect. The
Side Panel could not even reach Settings: it showed the error above
"Loading FillNest…" forever.

**Owner decision.**

1. **Retry at every startup.** A rollback fails because storage failed at
   that moment. The worker now retries a `failed` journal each time it
   starts, as it already did for an `in_progress` one. When the retry
   succeeds, the prior data is back, the journal is removed, and FillNest
   works normally.
2. **Reset FillNest is the way out.** While a journal cannot be rolled back,
   every request fails with the coded error `restore-recovery-blocked`, which
   names both exits: restart the browser to retry, or Reset FillNest to start
   over, which deletes all FillNest data. Only `GET_RESET_PREVIEW`,
   `RESET_FILLNEST`, `GET_LANGUAGE` and `GET_APPEARANCE` stay available. A
   completed Reset removes the journal and starts FillNest normally.
3. **The Side Panel stays usable.** When it cannot load FillNest's data it
   shows the error and the Settings page, where Reset lives, instead of
   loading forever. This also covers Task 028's unreadable-store case, whose
   escape hatch was Reset but which the panel likewise never reached.

4. **The Popup still opens the Side Panel.** Found in the owner's QA on
   2026-09-11: the Side Panel is reached only through the Popup, and the
   Popup's error state showed the message alone, so point 3's way out could
   not be reached at all. The error state now keeps `Open FillNest`.

5. **The language and theme still change.** Found in the owner's QA on
   2026-09-11: the locked Settings page offered Restore, which the worker
   refuses, and a language choice that did nothing. Someone locked out in a
   language they cannot read must be able to pick one they can, so
   `SET_LANGUAGE` and `SET_APPEARANCE` now stay available too - neither is
   part of the data the journal protects. The error follows the chosen
   language, and Backup and Restore are not shown while FillNest is closed.
   Restore does not restore Chrome Website Access in any state (Stable Product
   Decisions above), which the owner judged acceptable the same day.

**Evidence.** `tests/unit/service-worker-runtime.test.ts` ("a failed Restore
journal found at startup"), `tests/unit/restore-transaction.test.ts`,
`tests/unit/side-panel.test.tsx` ("offers Settings and Reset when FillNest
cannot load its data", "offers only language, theme and Reset"), and `tests/unit/popup.test.tsx` ("still opens
FillNest when it reports an error"). The locked Popup was also checked in real
Chromium after a browser restart; an earlier browser check had opened the Side
Panel page directly, which is how the gap was missed.
