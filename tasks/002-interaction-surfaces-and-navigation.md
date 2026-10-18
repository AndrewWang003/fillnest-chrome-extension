# Task Contract

## Task ID And Name

Task 002 - Interaction Surfaces And Navigation

## Background

Task 001 proved FillNest's local-first MV3 foundation and single-field Template loop. Its intentionally minimal UI has one current-origin Enable or Disable Popup, a placeholder Options Page, a temporary `F` field control, fixed control dimensions, and basic Inline Picker rows. The next task must establish the coherent interaction surfaces that later management work can extend without repeatedly replacing navigation, state ownership, or layout.

The user selected Chrome's Side Panel as the primary management surface and separated Chrome Website Access from temporary FillNest Active or Pause state. The earlier prototype may be inspected read-only for generic interaction evidence, but FillNest must independently implement its own domain, privacy, permission, and test boundaries.

## Goal

Deliver a complete activation and navigation foundation: remembered Global Activation, remembered per-Permission-Origin Origin Activation, a compact current-origin Popup, a single-action page status control, a real multi-page Side Panel, improved Inline Picker layout, and replaceable icon seams. Remove the placeholder Options Page without implementing the complete Template or Site management scope reserved for Tasks 003 and 004.

## User Value

Users can understand whether FillNest has website access, whether it is globally running, and whether it is active on the current website. They can pause behaviour without losing permission or data, open one lightweight management surface, inspect real Templates and Sites, and use field controls and Picker rows with clearer proportions.

## Stable Product Decisions

### State Model

- Website Access is Chrome permission for one Permission Host Pattern and remains authoritative through the Permissions API.
- Global Activation is remembered as `Active` or `Pause` and controls all page-level FillNest behaviour.
- Origin Activation is remembered as `Active` or `Pause` for one authorized Permission Origin.
- Global Pause preserves Website Access, Origin Activation preferences, Templates, Bindings, Site Affinity, profiles, and all other business data.
- Origin Pause preserves Website Access and business data.
- Origin Pause stops field recognition, field markers, Field Picker controls, Inline Pickers, and every field-level FillNest action while retaining only the gray Page Status Control required for explicit reactivation.
- Global Pause removes every page surface, including the Page Status Control.
- Origin Activation cannot be Active without Website Access.
- Granting Website Access sets that Permission Origin to Active by default.
- Removing Website Access clears Origin Activation for that Permission Origin and preserves business data.
- A fresh installation starts with Global Activation Paused.
- Upgrade migration from the Task 001 installation sets Global Activation Active and every already-granted Permission Origin Active, preserving existing behaviour without requesting new Website Access.
- All migration and state reconciliation are idempotent across extension, browser, and service-worker restart.
- Exact-origin dynamic content-script registration remains aligned to Website Access rather than Origin Activation. On an Origin-Paused reload the script initializes only the lightweight Page Status Control; on Global Pause it initializes no page UI or field behaviour.

### Extension Popup

- Clicking the Chrome toolbar action opens a compact Popup; it does not directly toggle FillNest.
- The Popup displays the full current Permission Origin, including scheme and non-default port.
- It exposes Global Active or Pause.
- An unauthorized origin displays `Not authorized`, an explicit origin-labelled `Allow access` action, and a disabled Origin Activation control showing Pause.
- A successful `Allow access` action grants the current Permission Host Pattern and sets Origin Activation Active in the same user-driven flow.
- An authorized origin exposes Origin Active or Pause without removing permission.
- When Global Activation is Paused, the current-origin preference remains visible but cannot be changed; the Popup explains that FillNest is globally paused.
- The Popup provides one `Open FillNest` action that opens the Side Panel.
- Website Access removal is not a primary Popup action in this Task; it belongs to Task 004 management.
- A non-requestable or unavailable page context displays `Website access unavailable on this page`, omits every executable Website Access and Origin Activation action, and retains usable Global Active or Pause and `Open FillNest` controls.
- Non-requestable contexts include `chrome://` pages, Chrome Web Store and other browser-restricted pages, extension pages, unsupported schemes, missing active tabs, and tabs whose URL is unavailable or cannot produce an HTTP(S) Permission Origin.
- The Popup must distinguish an unsupported context from an unauthorized but requestable HTTP(S) Permission Origin; it must not fabricate an origin or attempt a permission request for the former.

### Page Status Control

- The page status control appears fixed at the bottom-right only when the current Permission Origin has Website Access and Global Activation is Active.
- Gray represents Origin Pause; one trusted click activates that origin.
- Color represents Origin Active; one trusted click pauses that origin.
- It has no menu, split action, secondary button, long press, right-click action, plus, or overflow control.
- Global Pause or Website Access removal removes the control and all field-level FillNest UI from every affected open tab.
- An Origin-Paused reload restores exactly one gray Page Status Control and no field marker, Field Picker control, Inline Picker, field listener, recognition operation, or other field behaviour.
- Position, dragging, and user-configurable size are deferred. Task 002 does not add their settings or schema.

### Side Panel

- Chrome's official Side Panel is the only primary management surface. The placeholder Options Page and its manifest entry are removed.
- The Side Panel can open even when the active page lacks Website Access.
- Navigation contains only implemented destinations: Overview, Templates, Sites, and Settings.
- Overview provides Global Active or Pause, concise status, and basic usage guidance.
- Templates reads real Repository data, lists each Template once by Template Preview, and supports literal body Search and read-only detail viewing. Complete organization and mutation belong to Task 003.
- Sites reads real Repository and Permissions data, groups exact Permission Origins under registrable Sites, and allows basic Origin Active or Pause for authorized origins. Access removal and destructive Site Data operations belong to Task 004.
- Settings contains real Global Activation control and current fixed-behaviour explanations. `Backup & Restore` is not displayed until Task 006 implements it under `Settings > Data`.
- A User page, account copy, future navigation items, and `Coming soon` pages are not displayed.
- Task 002 UI copy uses only `Website access`, `Active`, and `Pause` for the accepted access and activation concepts. `Remove access` is owned by Task 004; Binding actions retain `Bind` and `Unbind`.

### Supported Chrome Version

- Task 002 requires `chrome.sidePanel.open()` from an explicit Popup user gesture and therefore targets Chrome 116 or later.
- The built manifest sets `minimum_chrome_version` to `116`; Task 002 provides no Options Page or older-Chrome runtime fallback.
- The selected Side Panel direction remains proposed until implementation and browser evidence pass. Adding `sidePanel` is the only manifest-capability change this Draft contract may request if later accepted and authorized.

### Partial Failure And Reconciliation

- Chrome permission remains the Website Access authority. Once Chrome grants the Permission Host Pattern, a later persistence, dynamic-registration, or current-tab-injection failure must not be hidden by claiming that the entire activation succeeded.
- A granted origin with missing explicit activation state resolves to the accepted default Origin Active, allowing startup reconciliation to repair an interrupted grant flow.
- If persistence or dynamic registration fails after grant, Website Access remains granted, the UI reports `Access allowed; activation incomplete`, and a user-visible Retry action invokes the same idempotent reconciliation path used at service-worker startup.
- If durable state and registration succeed but immediate injection fails because the tab navigated, closed, or became restricted, the UI reports that access is allowed but the current page could not be started; authorized reload or Retry may activate it without another permission request.
- Retry and startup reconciliation must not duplicate registrations, controls, markers, listeners, or business records and must never broaden the granted Permission Host Pattern.
- Removing permission during an incomplete flow wins over the activation intent and produces the normal external-revocation result.

### Multi-Surface Consistency

- The service worker is the authority for Global Activation, Origin Activation, Website Access reconciliation, and state-change messages.
- A successful state mutation broadcasts a typed state-change notification to open Popup, Side Panel, and injected page contexts; every visible surface re-queries the authoritative snapshot and updates without reload or reopening.
- A newly opened, refocused, or reconnected surface always queries a fresh snapshot so missed messages or service-worker suspension cannot leave durable stale UI.
- Simultaneous actions serialize through the authority. Every surface must converge to the accepted final state, and stale controls cannot overwrite a newer state without a new authoritative mutation.

### Inline Picker And Icons

- The Template text region is enlarged relative to the Task 001 layout.
- Existing contextual Bind or Unbind remains in one stable action position and stays keyboard-accessible.
- Task 002 may improve current action visibility and spacing but does not implement Edit or Delete; Task 003 adds those real actions without placeholders here.
- The field control adapts to ordinary Target Field height within an objective 24-32 CSS pixel square range and retains Task 001 viewport-safe anchoring.
- Toolbar, page status control, and field Picker control use three independent local icon assets or components.
- Final artwork is not selected. Each icon seam must be replaceable without changing business state, permissions, navigation, or persisted schema.
- No icon customization UI, remote asset, speculative icon registry, or brand package enters this Task.

## Earlier Prototype Evidence Boundary

Slice 1 must create a short evidence matrix with three columns: `Prototype generic pattern`, `FillNest adaptation`, and `required FillNest test`. Candidate evidence includes active or off state treatment, fixed page control sizing, keyboard search, long-text disclosure, hover overlays, focus treatment, progressive disclosure, and danger confirmation.

The following are forbidden inputs: injected management panels, two-button page controls, Contacts, themes, eye modes, client-specific content, site-specific selectors, direct storage architecture, copied markup, copied CSS, copied schemas, copied permissions, and copied tests.

## Vertical Slices

| Slice | Complete Behaviour | Required Evidence | Status |
| --- | --- | --- | --- |
| 1. Evidence And State Contract | Record the prototype-to-FillNest evidence matrix; define persisted activation state, fresh-install default, upgrade migration, and reconciliation | Read-only evidence notes; migration and state-transition red tests; no application behaviour change before tests; fixed slice checkpoint recorded before Slice 2 | Completed |
| 2. Activation Runtime | Implement Global and Origin Activation across service worker, dynamic registrations, injected tabs, partial failures, restarts, external permission revocation, and concurrent tabs | Unit and built-extension tests for every transition, partial-failure seam, multi-tab teardown/reactivation, restart, unaffected-origin isolation, and fixed slice checkpoint before Slice 3 | Completed |
| 3. Popup And Page Status Control | Deliver the compact Popup and bottom-right single-action page status control | Component accessibility tests and trusted-interaction built-extension flows for requestable, restricted, unavailable, Active, Pause, global Pause, grant, incomplete, retry, revoke, and fixed slice checkpoint before Slice 4 | Completed |
| 4. Side Panel Foundation | Add proposed `sidePanel` and Chrome 116 minimum, remove Options Page, and deliver real Overview, Templates, Sites, and Settings pages through one navigation shell | Manifest/build policy tests, component tests, Repository/Permissions integration tests, direct Side Panel browser evidence, multi-surface convergence, no placeholder destinations, and fixed slice checkpoint before Slice 5 | Completed |
| 5. Picker Layout And Icon Seams | Enlarge Template text, preserve contextual Bind or Unbind, adapt the field control, and add three replaceable local icon seams | Component and browser geometry, pointer, keyboard, accessible-name, hostile-style, viewport assertions, user manual interaction checkpoint, and fixed slice checkpoint before Slice 6 | Completed; manual checkpoint recorded 2026-08-15 in `DEVELOPMENT.md` |
| 6. Integrated Evidence And Review | Re-run complete Task 001 regression and Task 002 state/UI scenarios; update current status; perform Spec and Project Standards review | `npm run check`, `npm run test:e2e`, manifest/package/network inspection, migration evidence, scope diff, manual-acceptance record, and two-axis review | Completed |

No later slice begins until the current slice's exit evidence and fixed Git point are recorded in `DEVELOPMENT.md`. A failed slice is corrected or escalated at that boundary; evidence may not be deferred and accepted only in Slice 6.

## Allowed Scope

- Activation state validation, persistence, migration, reconciliation, and service-worker messages.
- Exact-origin dynamic-registration changes required by Global or Origin Active or Pause.
- Extension Popup UI and its current-origin user flows.
- One page status control with the accepted fixed position and click behaviour.
- Chrome Side Panel entry point, permission, navigation shell, and accepted real basic pages.
- Manifest `minimum_chrome_version: 116` and supported-page-context classification required by the accepted Popup and Side Panel flows.
- Removal of the placeholder Options Page entry point, build entry, policy assertions, tests, and obsolete source.
- Read-only Template and Site queries required for the accepted Side Panel pages.
- Inline Picker layout, existing Bind or Unbind presentation, field-control sizing, accessible UI, and local replaceable icon seams.
- Schema migration strictly required for Global and Origin Activation.
- Tests, fixtures, the earlier prototype evidence notes, directly affected product documentation, and `DEVELOPMENT.md`.

## Forbidden Scope

- Template Edit, copy, User Tag management, usage ordering, complete location tree, destructive Template actions, or batch Template management.
- Website Access removal, multi-select Site operations, Site Data reset, site-related Template deletion, or other Task 004 destructive flows.
- Relevance-ranking changes, Backup or Restore, sharing, Contacts, multi-field filling, accounts, User pages, plans, quotas, payments, sync, telemetry, AI, or network features.
- Final brand artwork, user-selectable icons, configurable page-control position, dragging, or size.
- Broad host permissions, `tabs` permission, static broad content-script matches, or a second complete Options Page.
- An older-Chrome Options Page fallback or silent degradation of `Open FillNest`.
- Placeholder pages, placeholder actions, unused future data models, or speculative public interfaces.
- Any regression to Task 001 permission, privacy, eligibility, recognition, Target Field, selection, insertion, or no-network rules.

## Acceptance Criteria

### State And Migration

- A fresh installation persists or resolves Global Activation as Pause and injects no page-level FillNest UI even after Website Access is granted until Global Activation becomes Active.
- An upgrade from Task 001 preserves Global Active behaviour and marks every already-granted exact Permission Origin Active without issuing a permission request.
- Migration runs once logically, is safe to repeat, preserves all Task 001 business records byte-for-byte except the intentional schema envelope change, and survives worker restart.
- Global Pause tears down all FillNest page UI and field behaviour across every injected tab without removing Website Access, exact-origin registration, or Origin Activation preferences.
- Returning Global Activation to Active restores only authorized origins whose Origin Activation preference is Active.
- Origin Pause removes every field-level marker, control, Picker, listener, recognition operation, and action in every open tab for that exact Permission Origin while retaining exactly one gray Page Status Control per page; it remains paused after reload/restart and does not affect sibling origins or the registrable Site's other origins.
- External Chrome permission removal immediately clears that origin's activation, removes its dynamic registration and all page UI, and leaves all business data unchanged.

### Interaction Surfaces

- Popup states and actions exactly match the Stable Product Decisions and always display the full Permission Origin.
- Restricted, unsupported, missing-tab, and missing-URL contexts retain Global Active or Pause and `Open FillNest`, display no fabricated Permission Origin, and expose no executable Website Access or Origin Activation action.
- Permission request originates from the explicit origin-labelled Popup action and no page control exists before grant.
- The page status control appears, colors, toggles, persists, and disappears exactly according to the accepted state matrix; only trusted interaction can invoke it.
- `Open FillNest` opens the official Side Panel from a user gesture without requesting current-page Website Access.
- Overview, Templates, Sites, and Settings each render real data or controls; no empty future destination is visible.
- Templates Search is literal body Search and does not introduce relevance or automatic recommendation.
- Sites never conflates registrable Site, exact Permission Origin, Website Access, or Origin Activation.
- The built manifest includes only the user-selected, contract-proposed `sidePanel` capability in addition to the accepted Task 001 capabilities, removes `options_page`, and retains optional origin-specific host permissions.
- The built manifest sets `minimum_chrome_version` to `116`; `Open FillNest` is exercised from a real extension user gesture.

### Failure And Synchronization

- Injected failures at permission-success/persistence-failure, persistence-success/registration-failure, and registration-success/injection-failure seams produce the defined non-success UI, retain only the state justified by completed steps, and recover through the idempotent Retry/startup path.
- A post-grant failure never requests permission again when `permissions.contains()` is already true and never silently revokes the granted Permission Host Pattern.
- Every browser-concurrent visible surface, including the Side Panel and Page Status Controls in multiple tabs, updates to one authoritative Global and Origin state after a mutation without reload. The Popup also updates while Chrome keeps it mounted and always renders a fresh authoritative snapshot each time it opens.
- A surface that misses a notification because it was suspended converges on its next open, focus, visibility, or reconnect snapshot.

### Layout, Accessibility, And Safety

- Popup, page status control, Side Panel navigation, and Inline Picker actions have accessible names, visible keyboard focus, and usable keyboard order.
- Pointer hover and keyboard focus never reflow a Template row or permanently obscure its content.
- The adaptive field control remains between 24 and 32 CSS pixels on representative short, ordinary, and tall supported fields and preserves the accepted maximum 12 CSS pixel anchor gap when space permits.
- Host styles cannot alter FillNest surfaces, and FillNest changes no host element style or attributes beyond Task 001's accepted markers.
- The extension initiates no network traffic and contains no remote assets.
- All Task 001 built-extension flows remain passing.

## Required Validation

- Use one-behaviour-at-a-time red-green tests for migration, state transitions, message operations, manifest policy, and component behaviour.
- Run typecheck, unit/component tests, a clean build, build inspection, and `git diff --check` after each completed slice.
- Run headed built-extension tests against at least two exact Permission Origins and multiple tabs for grant, Global Pause, Origin Pause, reload, restart, and external revoke.
- Validate fresh install separately from schema-v1 upgrade using isolated persistent Chromium profiles.
- Exercise the real Side Panel, not a direct substitute page alone.
- Exercise `chrome://`, a Chrome Web Store or equivalent restricted page, an extension page, missing tab/URL seams, and an ordinary unauthorized HTTP(S) page as distinct Popup contexts.
- Inject deterministic failures after permission grant, persistence, dynamic registration, and immediate injection, then prove Retry and startup reconciliation.
- Keep the Side Panel and at least two page controls open while state changes originate from each long-lived accepted surface; assert deterministic convergence. Exercise the real Popup on every state, verify fresh state on reopen, and component-test its live subscription while mounted without assuming Chrome keeps a toolbar Popup open after focus moves elsewhere.
- Inspect the final package for permissions, entry points, remote assets, network capabilities, and obsolete Options Page artifacts.
- Record exact commands, outcomes, skipped checks, deviations, and remaining risks in `DEVELOPMENT.md`.

## Manual Interaction Checkpoint

After Slice 5 automated evidence and before Slice 6 review, the user performs a short hands-on review of Popup density, access-versus-activation wording, gray/color Page Status Control meaning, Side Panel navigation and page usefulness, Template-row readability, and field-control proportion on representative pages. Task 002 cannot be marked complete unless this review is recorded or the user explicitly waives it and `DEVELOPMENT.md` records the evidence limitation.

## Stop Conditions

Stop and request approval if implementation requires a permission other than the contract-proposed `sidePanel` addition, a new production dependency, a broader host scope, a `tabs` permission, a different migration outcome, a new user-observable destination, a Task 003 or Task 004 operation, or any weakening of Task 001 guarantees.

Do not bypass a failed Side Panel browser test with a direct extension-page test, silently preserve the Options Page as a second management UI, or add placeholder functionality to satisfy navigation assertions.

## Post-Acceptance Bounded Repair (2026-09-03)

Chrome may start the Manifest V3 service worker before `onInstalled` has
persisted Activation state. The startup path intentionally defers absent or
legacy-invalid Activation state to the existing installation initialization
path, but it previously logged the expected absent-state case as a
service-worker boot failure before recognizing it. The bounded repair
suppresses that premature bootstrap diagnostic; absent and legacy-invalid
state continue through the existing installation initialization path, and
every unrelated recovery failure remains logged and fail-closed. It does not change activation state,
permissions, initialization, or user-visible behaviour.

## Review Gate

After all slices pass, review independently against this contract and against `PROJECT.md`, `CONTEXT.md`, `AGENTS.md`, ADR 0001, and ADR 0002. Review Spec and Project Standards separately. Adversarial cases must include stale worker state, multiple open tabs, sibling origins, external permission removal, hostile page styles/scripts, schema-v1 migration, and empty or malformed stored data.

## Status

Complete and Accepted - Slices 1-6 implementation, automated evidence, and review are committed through `15bbf57`, and `029a678`. The required user manual interaction checkpoint was completed by the user on 2026-08-15 against the `029a678` build; the resulting Template-row readability fixes are recorded in `DEVELOPMENT.md`'s Documented Scope Deviations and Manual Interaction Checkpoint Record sections. Task 002 is accepted; Task 003 is not thereby authorized and needs its own contract or explicit direction before work begins.

Note: the Inline Picker Edit/Delete/global-search actions and the Side Panel Edit/Delete/inline-expand actions delivered under this Task pre-implement pieces of Task 003 (Template Edit/Delete) and Task 005 (Search All Templates), which are outside this contract's Allowed Scope and listed under its Forbidden Scope. This was an explicit, documented user decision rather than a contract amendment; see `DEVELOPMENT.md` for the full record. Task 003 and Task 005 still own their remaining scope.

**Post-acceptance Overview and feedback addendum (2026-08-22).** Two user-requested additions to the Overview page, resolved after a short Grill Mode round on the notification design:

- **Overview per-current-page Active/Pause.** Overview's accepted scope ("Global Active or Pause, concise status, and basic usage guidance") gains a current-tab Origin Active/Pause control, mirroring the control the Popup already offers for the same Permission Origin. This does not add a new entry point in the sense that matters: it reads and writes the exact same `SET_ORIGIN_ACTIVATION` message and shared `ACTIVATION_STATE_CHANGED` broadcast subscription the Popup, Sites page, and floating Page Status Control already use, rather than a parallel state model.
- **Transient action notifications.** A user report that several destructive/impactful Side Panel actions complete with no visible confirmation (most concretely, Restore's outcome could go unnoticed) is resolved as a small shared notification: a message appears for 4 seconds, is manually dismissible, and - if it carries further detail - can be clicked to expand that detail inline before it disappears. Scope decision (Grill Mode, 2026-08-22): this coexists with, and does not replace, the existing Side Panel Undo bar. Save/Bind/Unbind/Delete keep using the Undo bar, which already gives durable, actionable feedback for those operations; the notification system is reserved for actions that currently give no feedback at all once their confirmation sheet closes (Remove access, Clear saved fields) and for Restore's outcome, unifying it out of its page-local, differently-timed notice into the same shared mechanism the user's original report was about.

**Product rule change (2026-08-22): Website Access can now also be requested from the Side Panel Overview page.** The user explicitly asked for Overview to show the same "Current website" section the Popup shows - origin, access status, and an `Allow access to {origin}` action when unauthorized - specifically so switching tabs updates this in the Side Panel without reopening the Popup. This supersedes the narrower decision directly above (and this contract's original "permission request originates from the explicit origin-labelled Popup action... no page control exists before grant" line): Website Access requests are no longer Popup-exclusive. `PROJECT.md`'s Activation Behaviour and UI Responsibilities sections are updated to match. This remains a single code path, not a duplicated one: `Popup.tsx` and `SidePanel.tsx`'s Overview both render the same `CurrentWebsiteAccess` component (`src/ui/shared/CurrentWebsiteAccess.tsx`) and call the same `useWebsiteAccessRequest` hook (`src/ui/shared/website-access-request.ts`), which issues the same `ENABLE_SITE`/`RETRY_SITE_ACTIVATION` messages Popup always used - deliberately extracted into one shared implementation specifically because the user had already flagged the risk of two surfaces drifting apart on the same underlying function (see the floating-icon/Popup-sync investigation above). The click that triggers the request remains a genuine user gesture in both surfaces (Side Panel button clicks are user gestures the same way Popup button clicks are), so Chrome's `chrome.permissions.request` gesture requirement is unaffected.

**Post-acceptance Page Status hover correction (2026-08-24).** A user observed a gray Page Status Control exposing a blue layer underneath on hover. Its state color remains owned exclusively by activation: gray Pause and blue Active change only after the trusted click toggles that state. Hover keeps the button stationary and preserves its background color, while a short border-and-shadow transition provides interaction affordance. The previous upward transform is removed, so hover cannot reveal a second layer beneath the button. This changes no activation state, trusted-click requirement, accessible name, or control count.

**Post-acceptance Settings simplification (2026-08-24).** Global Activation is controlled only from Overview. Settings no longer duplicates the Global Activation switch or the Page Status Control explanatory note. This removes redundant UI only; the current-page Page Status Control and Overview controls retain their accepted activation behaviour.

**Manifest permission change (2026-08-22): `activeTab` replaced by `tabs`.** Testing the addendum above found that a persistently-open Side Panel does not benefit from `activeTab` the way the Popup does: `activeTab` only grants tab-URL visibility for the tab that was active at the moment the extension was explicitly invoked (a toolbar click), not for whichever tab the user later switches to while the Side Panel stays open. Overview would therefore silently show "This page does not support FillNest" for a real, ordinary website the user had just switched to, rather than the intended "Allow access to {origin}". This is a genuine capability gap, not a coding defect, and the fix requires a broader permission - flagged to the user explicitly as a privacy trade-off before changing it, since it lets the extension passively see the URL of any open tab at any time, not only tabs it already has host permission for (it still grants no ability to read page content, inject scripts, or act on a site without the separate, unchanged `permissions.request()` grant). **The user explicitly chose to add `tabs`** over keeping `activeTab` and accepting the display gap. `manifest.json`'s `permissions` is now `scripting, sidePanel, storage, tabs`; `scripts/lib/manifest-policy.mjs`'s required-permission policy gate is updated to match, so a future drift back to a different permission set fails the same automated check that caught the original set. This supersedes Task 001's original `storage, activeTab, scripting` baseline note for this one permission only; nothing else about Task 001's historical record changes.
