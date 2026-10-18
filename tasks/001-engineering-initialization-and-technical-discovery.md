# Task Contract

## Task ID And Name

Task 001 - Engineering Initialization And Technical Discovery

## Background

FillNest has an approved product foundation but no application code, package configuration, development commands, or FillNest test evidence. The first engineering task must establish a small production-quality foundation and prove the highest-risk browser-extension behaviours before broader V1 work begins.

The earlier prototype provides read-only evidence that mutation observation, SPA navigation hooks, idempotent injection markers, and compatible input events are viable directions. Its site-specific matchers, selectors, permissions, schemas, and whole-field replacement behaviour are forbidden inputs to FillNest implementation.

The approved engineering choices and their trade-offs are recorded in `docs/adr/0001-engineering-baseline.md`.

## Confirmed Facts

- FillNest is an independent local-first Manifest V3 Chrome Extension.
- V1 uses TypeScript, npm, Vite, Preact, `chrome.storage.local`, Vitest, and Playwright.
- The local `main` branch tracks `origin/main`.
- No FillNest application code, package file, development command, or test command exists yet.
- Users explicitly authorize a Permission Host Pattern for the current Permission Origin and explicitly choose each insertion and Binding.
- Product Site, Permission Origin, Permission Host Pattern, and Fixture Origin are distinct terms defined in `CONTEXT.md`.
- V1 inserts literal plain text at the cursor or replaces selected text only; it does not replace an entire field.
- Field focus shows a FillNest control. The Inline Picker opens only after the user activates that control.
- V1 must support static fields, conditional fields, SPA navigation, and DOM reconstruction.
- Reliable same-Site recognition restores Bindings; uncertain fields are treated as new.
- Creating a Template from a Site must persist that Site as a Site Affinity even though full Site Affinity management is outside this task.
- Task 001 must create production-quality foundations, pass per-slice evidence checkpoints, and stop at an independent review gate.

## Goal

Establish the approved engineering toolchain and deliver one production-quality vertical slice that proves exact-origin authorization, Template persistence, privacy-preserving field handling, Target Field capture, explicit Binding, safe literal insertion, conservative same-page-type recognition, dynamic-field handling, and built-extension validation.

## User Value

The user can validate the essential FillNest promise in a controlled environment: authorize the current Fixture Origin, focus a field, deliberately open the Picker, create and bind a Template, insert it without losing surrounding text, and see the Binding return on another record of the same logical page type, including after conditional or SPA-driven DOM changes.

## Current Behaviour

- The repository contains project-foundation documentation and local skills only.
- No Chrome Extension can be built or loaded.
- No Template, Site Affinity, Binding, Repository, message, permission, or field-recognition behaviour exists.
- No FillNest automated tests exist.

## Expected Behaviour

- An unpacked Manifest V3 extension builds reproducibly with npm and Vite.
- The popup derives one Permission Host Pattern from the active Fixture Origin, reports status with `permissions.contains()`, requests it only from the Enable button's user gesture, and removes it from an explicit Disable action.
- FillNest is inactive before permission, activates the current fixture page after grant, automatically reactivates after an authorized reload or return without reopening the Popup, removes its page UI and behaviour after revoke, and remains inactive after a revoked reload.
- A supported focused field shows exactly one FillNest control; focus alone does not open the Inline Picker.
- Activating the control captures that field as the Target Field and opens exactly one isolated Inline Picker.
- A new Template editor is blank and does not read the Target Field unless the user activates `Use current field content`.
- The user can create one plain-text Template, persist the current Site Affinity, and persist the Template through Repository.
- The user can Bind the Template without inserting it; the Picker remains open.
- A recognized field initially displays only its bound Templates.
- An unrecognized field initially displays an empty state with Create and Search actions and no unbound Template content.
- Selecting a Template inserts literal plain text at the cursor or replaces only selected text, modifies no other field, emits the specified events, never submits the form, closes the Picker, and preserves or restores Target Field focus.
- The Target Field remains the captured field even while focus moves into Picker controls.
- A Binding created on the first of at least three synthetic records restores on an unseen third record whose randomized record ID and record-specific content differ but whose logical page and field are the same.
- An unrelated or ambiguous field inherits no Binding.
- Conditional and SPA-recreated fields work without manual rescanning or duplicated controls, markers, or per-field listeners.
- Persistent behaviour remains correct after a deterministic extension/service-worker restart because no durable state depends on worker memory.
- The extension initiates no network traffic; Playwright-controlled navigation and fixture assets are the only permitted HTTP traffic.

## Specification Summary

Build the smallest coherent extension across Popup, Service Worker, Content Script, Inline Picker, Repository, and synthetic test pages. Keep matching deliberately conservative, generic, and randomized-fixture-backed. Implement only the Template, Site Affinity, Page Profile, Field Profile, and Binding data required for the vertical slice. Produce evidence after each slice and a review handoff rather than continuing into broader V1 features.

## Implementation Decisions

- Use npm and commit `package-lock.json`.
- Enable TypeScript strict mode unless a documented tool incompatibility requires approval to change it.
- Use Vite with explicit extension entry points rather than an extension framework.
- Use Preact for Popup and Inline Picker UI required by the slice.
- Render host-page UI inside an extension-owned Shadow Root.
- Use `chrome.storage.local` through a versioned Repository implementation.
- Keep persisted records validated and include `schemaVersion: 1` from the first format.
- Persist Site Affinity as part of the minimal Template creation invariant; defer only its full management UI.
- Keep Permissions and Repository operations in the service worker.
- Keep host-page recognition, Target Field tracking, and DOM insertion in the content script.
- Use typed internal messages and keep domain logic independent of Chrome APIs where practical.
- Treat Repository and message contracts as tested internal boundaries, not permanent public APIs.
- Target the following minimal manifest capability set unless evidence proves a smaller set works:
  - required API permissions: `storage`, `activeTab`, and `scripting`;
  - optional host declarations: `http://*/*` and `https://*/*`;
  - no install-time `host_permissions`, `<all_urls>`, `tabs`, `unlimitedStorage`, or unrelated permissions.
- Derive and request only the current page's Permission Host Pattern, including its explicit effective port, such as `http://127.0.0.1:4173/*`, never the broad optional declaration. If the URL omits a default port, use `80` for HTTP or `443` for HTTPS in the pattern.
- Use `permissions.contains()`, `permissions.request()`, and `permissions.remove()` as the permission authority; do not persist a shadow enabled flag.
- Use dynamic content-script registration with one registration per granted Permission Host Pattern, `persistAcrossSessions: true`, top-frame-only matching, and no broad static `content_scripts.matches`. After a new grant, register the exact pattern and use programmatic injection only to activate the already-open current page. On service-worker startup, reconcile registered scripts against Chrome-granted origins. Listen to `chrome.permissions.onRemoved`; for every removed origin pattern, unregister the corresponding dynamic script, query tab IDs without reading sensitive tab properties, and broadcast an origin-scoped teardown message. Each injected top-frame content script compares the removed pattern with its own derived Permission Host Pattern and tears down only on a match. Popup Disable uses the same revocation path rather than a separate cleanup implementation.
- Task 001 supports top-frame HTML `<textarea>` elements and `<input>` elements whose effective type is `text`, `search`, `email`, `tel`, or `url`. Missing or invalid input types use the browser's effective `text` type. All other element and input types are unsupported in this task.
- Allowlist classification may inspect element type and safety metadata, but excluded fields receive no value read, fingerprint, Field Profile, extension marker, per-field listener, or UI.
- Template editor construction must not access `TargetField.value`. Only the explicit `Use current field content` command may read it.
- Safe insertion changes only the captured Target Field, treats content as literal text, dispatches exactly one bubbling `input` event and one bubbling `change` event, and never submits a form.
- Matcher inputs may use normalized URL structure, stable non-record page structure, supported-field metadata, labels, and DOM relationships.
- Matcher inputs must not use raw record IDs as identity, record-specific names or text, customer data, any field value, or fixture-only selectors/constants.
- Use generic synthetic fixtures with fictional and randomized record-specific data.
- Derive Site identity independently from Permission Origin: normalize the hostname, exclude scheme and port, group synthetic subdomains under their registrable/main domain, and keep different registrable/main domains distinct. For localhost or IP fixtures, use the normalized host itself as the Site identity.
- Reimplement generic dynamic-page mechanisms; do not import or copy the earlier prototype modules.

## Interface Classification

### User-Observable Behaviour

The permission lifecycle, control and Picker opening behaviour, blank editor, explicit field read, recognized and unrecognized Picker states, Bind-only behaviour, safe insertion, focus outcome, dynamic-field handling, and fail-closed matching are acceptance-level product behaviour. Changing them requires product approval.

### Stable Domain Contracts

Template, Site Affinity, Page Profile, Field Profile, Binding, Target Field, field-recognition outcome, and `schemaVersion` semantics must agree with `PROJECT.md` and `CONTEXT.md`. Persisted-data compatibility changes require an explicit migration decision.

### Internal And Test Interfaces

Repository method shapes, typed message shapes, module boundaries below the documented runtime ownership, fixture route names, DOM selectors owned by synthetic fixtures, and test helpers may change within this task when their tests and callers change together. They are not public APIs and do not require approval unless the change affects user behaviour, stable domain semantics, persisted compatibility, approved scope, or the engineering baseline.

### Verified Project Commands

The task must establish reproducible npm commands for development, typechecking, unit/component tests, building, and built-extension end-to-end tests. Only commands actually run successfully may be added to `AGENTS.md` or reported as verified in `DEVELOPMENT.md`.

## Vertical Slices And Evidence Checkpoints

Task 001 remains one contract, but each slice has its own evidence checkpoint. Do not begin the next slice while the current slice has an unresolved acceptance failure or requires scope expansion.

| Slice | Complete Behaviour | Required Evidence | Exit Condition | Status |
| --- | --- | --- | --- | --- |
| 1. Toolchain And Package | Install, typecheck, test, and build the minimal extension | Clean `npm ci`; successful typecheck, unit-test, and build commands; built-manifest and package-file inspection | Reproducible build has only approved capabilities, no remote code, and no unresolved entry-point failure | Completed |
| 2. Permission And Persistence | Enable and disable one Fixture Origin and persist a versioned Template with Site Affinity | Permission API tests for contains/request/remove/onRemoved and explicit-port pattern; sibling-port denial; dynamic-registration inspection; granted reload/return/new-tab activation; Popup and external revocation across multiple open tabs; revoked reload denial; Site-normalization and Repository contract tests; deterministic fresh-worker/service-instance readback | Chrome is the permission authority, only the exact origin auto-activates, every revocation path immediately removes affected page behaviour without deleting data, and durable state survives restart | Completed |
| 3. Privacy And Static Field Loop | Show control, deliberately open Picker, create, Search, Bind, and safely insert | Full supported-field allowlist fixtures; instrumented value-read counters; excluded-field scan assertions; recognized/unrecognized Picker and functional Search tests; literal HTML/script payload test; sibling-field and submit counters; complete event oracle, focus, and positioning assertions | No implicit value read, no excluded-field profiling, Search is functional, Site Affinity persists, Bind stays open, and insertion satisfies every safety invariant | Completed |
| 4. Recognition And Dynamic Pages | Restore a Binding on the same logical page type and handle conditional or SPA-recreated fields | Randomized positive records, unseen third record, similar negative page, persisted-identity inspection, dynamic insertion, SPA navigation, DOM reconstruction, and duplicate marker/listener assertions | Matching uses only allowed stable evidence, false inheritance stays closed, and dynamic behaviour is idempotent | Completed |
| 5. System Evidence And Handoff | Validate cross-context behaviour and document results | Playwright built-extension run, deterministic lifecycle restart, computed-style isolation assertions, runtime network allowlist assertion, static network-capability scan, full command log, and scope diff | All evidence is recorded, no P1 contract breach remains, and work stops for independent review | Completed |

Each checkpoint must record exact commands, outcomes, failures, deviations, and unresolved hypotheses in `DEVELOPMENT.md` or Task 001 review evidence before the next slice begins.

## Allowed Scope

- `package.json`, `package-lock.json`, TypeScript, Vite, Vitest, and Playwright configuration.
- Manifest V3 source and build support required by this task.
- Minimal Popup, Service Worker, Content Script, Inline Picker, domain, validation, Repository, permission, and message modules.
- Minimal Template, Site Affinity, Page Profile, Field Profile, and Binding persistence required by the slice.
- Minimal styles and extension icons or placeholders needed to load and test the extension.
- Generic static and SPA fixture pages with fictional, randomized data and instrumentation counters.
- Unit, contract, component, and built-extension tests for the vertical slice.
- Updates to `AGENTS.md`, `DEVELOPMENT.md`, Task 001 status, and Task 001 review evidence required to record verified commands and results.

## Forbidden Scope

- Full User Tag or Site Affinity management UI.
- General Template Relevance or Search All ranking algorithms.
- Complete Template Library CRUD or Options Page batch management.
- Backup Archive implementation, restore UI, or migration beyond the first schema.
- Website-data bulk deletion flows.
- Template Share Packages.
- Plans, quotas, accounts, payments, sync, teams, backend services, or network-dependent product features.
- AI, model APIs, embeddings, semantic search, or vector storage.
- Structured Contacts or multi-field filling.
- Full visual-design system or release-ready polish.
- Chrome Web Store preparation or publishing.
- client-specific selectors, terminology, permissions, schemas, copied markup, or tests.
- `iframe`, page Shadow DOM, or `contenteditable` support.
- Changes to the earlier prototype repositories.
- Record IDs, customer names, field values, or fixture-only constants as matcher identity evidence.
- Silent Target Field reads, automatic Picker opening on focus, automatic Binding, whole-field replacement, multi-field filling, or form submission.
- Fetch, XMLHttpRequest, WebSocket, EventSource, remote assets, telemetry, or any extension-originated network request.

## Acceptance Criteria

### Toolchain And Build

- `npm ci` respects the committed lockfile from a clean dependency state.
- Documented npm commands typecheck, test, build, and run the required end-to-end checks.
- The built manifest is valid MV3 and contains exactly the approved required permissions and broad optional declarations documented in this contract, unless a smaller evidence-backed set is adopted and documented during the task.
- The built manifest contains no install-time `host_permissions`, broad static `content_scripts.matches`, `<all_urls>`, `tabs`, `unlimitedStorage`, unrelated capability, remote code, or remote asset.
- Built-package inspection proves all declared entry points and referenced assets exist and excludes source-only or unrelated files.

### Permission Lifecycle

- The fixture server exposes a concrete Fixture Origin, and tests record both that origin and the exact Permission Host Pattern derived from it.
- The derived Permission Host Pattern contains the Fixture Origin's explicit effective port. A sibling Fixture Origin on the same host and scheme but a different port remains unauthorized, receives no injection or FillNest UI, and makes `permissions.contains()` return false for its own pattern.
- Before Enable, `permissions.contains()` is false, no FillNest page UI exists, and no page behaviour is active.
- The Enable button requests only the current Permission Host Pattern from its user gesture; it never requests `http://*/*`, `https://*/*`, or `<all_urls>` at runtime.
- After grant, `permissions.contains()` is true and FillNest activates on the current fixture page without granting another host.
- Reloading the granted Fixture Origin, navigating away and returning, and opening a new tab at that origin automatically activate FillNest through the persisted exact-pattern dynamic registration without reopening the Popup or requesting permission again.
- Tests inspect `getRegisteredContentScripts()` and prove that only exact granted patterns are registered, registrations persist across the tested browser restart, and no broad static or dynamic match exists.
- The Popup provides an explicit Disable action that calls `permissions.remove()` for the current Permission Host Pattern.
- `chrome.permissions.onRemoved` is the shared cleanup authority for Popup Disable and permission removal performed through Chrome settings. It unregisters every removed exact-pattern dynamic script and broadcasts the removed patterns to all existing tab IDs without requesting or reading URL, title, or other sensitive tab properties.
- Every already-injected top-frame content script derives its own current Permission Host Pattern and, on a matching revocation message, immediately removes its control, Picker, extension-owned markers, observers, and per-field behaviour. Nonmatching authorized origins remain active.
- An external-revocation test opens at least two injected tabs at the granted Fixture Origin plus one independently authorized nonmatching origin, removes the first permission without invoking Popup Disable, and proves both affected tabs tear down without reload while the nonmatching tab remains active.
- After external revocation, the removed dynamic registration is absent, `permissions.contains()` is false, reload remains inactive, and local Site, Template, Site Affinity, Profile, and Binding data remains unchanged.
- No persisted boolean is treated as a substitute for Chrome permission state.

### Repository And Worker Lifecycle

- `chrome.storage.local` is accessed through the Repository boundary, uses `schemaVersion: 1`, validates records, and passes contract tests.
- Template creation from the Fixture Origin persists exactly one current-Site Affinity without requiring Site Affinity management UI.
- Binding an existing Template on a new Site adds that Site Affinity exactly once.
- Repeating creation or Binding operations does not duplicate the same Site Affinity.
- Site-normalization tests prove that scheme and port do not affect Site identity, synthetic subdomains under one registrable/main domain share a Site, and a second synthetic registrable/main domain produces a distinct Site. Localhost and IP fixtures use their normalized host as the Site identity.
- Durable behaviour is tested across a fresh service instance and a deterministic extension/service-worker restart; an arbitrary sleep is not accepted as lifecycle evidence.
- The restart procedure and observed pre/post record IDs are recorded so the result can be repeated.

### Privacy And Field Eligibility

- Eligible positive fixtures cover `<textarea>` and every supported effective input type: `text` (including missing or invalid type fallback), `search`, `email`, `tel`, and `url`.
- Negative fixtures cover representative unsupported input types and non-input editable-looking elements in addition to the explicit sensitive and state-based exclusions below.
- Creating or opening the Template editor yields an empty content field.
- Instrumented tests prove opening the control, Picker, and editor causes zero Target Field value reads when no text selection was captured.
- Activating `Use current field content` increments the Target Field value-read counter and copies its current value into the editor. Opening the Picker after the user captured a non-empty selection may instead increment it exactly once solely for the temporary selection representation defined in the remediation amendment; that value is not persisted.
- Password, payment, one-time-code, hidden, disabled, read-only, and deliberately unsupported fixture fields receive no value read, fingerprint, Field Profile, extension marker, per-field listener, control, or Picker.
- No unrelated supported-field value is read while another field is targeted.

### Picker And Binding

- Focusing a supported field shows one FillNest control and does not open the Inline Picker.
- Activating that control captures the Target Field and opens exactly one Picker inside an extension-owned Shadow Root.
- Moving focus into Picker controls does not replace the captured Target Field with `document.activeElement`.
- A recognized field initially renders only Templates bound to that Field Profile.
- An unrecognized field initially renders no Template content and exposes only the confirmed empty-state Create and Search actions.
- Activating Search opens a search input without showing guessed results. A non-empty query performs case-insensitive literal substring matching against Template body text and displays only unbound Templates that are Global or have the current Site Affinity; an eligible matching result can be inserted by selecting its content or bound with its separate Bind action.
- Search tests include one eligible unbound match, one bound Template that must not reappear as an unbound result, one nonmatching Template, and one Template whose Site Affinity is ineligible. General ranking, pre-query suggestions, tag weighting, and `Search all templates` remain outside Task 001.
- Creating a Template from the Target Field atomically persists literal content, the current Site Affinity, and its initial Binding without inserting content; the Picker stays open and shows the Template as bound.
- Bind creates only the Binding, inserts nothing, and leaves the Picker open with a clear bound state.
- Unbind removes only the current Binding, preserves the Template, inserts nothing, and leaves the Picker open with clear feedback.

### Safe Insertion

- Cursor insertion preserves the exact text before and after the cursor.
- Selected-text insertion replaces only the selected range and preserves all other text.
- A payload containing HTML tags, event-handler attributes, and script text appears literally in the Target Field; it creates no element and executes no code.
- Only the captured Target Field changes. Instrumented sibling fields retain their exact values and receive no input or change event.
- The Target Field receives exactly two events in order: first one `InputEvent` named `input`, then one plain `Event` named `change`; no synthetic `beforeinput` event is dispatched.
- The `input` event has `inputType: "insertText"` for cursor insertion or `inputType: "insertReplacementText"` for selected-text replacement, `data` equal to the inserted Template content, `bubbles: true`, `composed: true`, and `cancelable: false`.
- The `change` event has `bubbles: true`, `composed: false`, and `cancelable: false`.
- The form submit counter remains zero and no navigation occurs.
- The Picker closes after insertion, and the Target Field is focused with a deterministic post-insertion selection/caret position asserted by the test.

### Matching And Dynamic Pages

- Positive fixtures use at least three records whose IDs, customer-like names, and record-specific content are randomized independently of the matcher.
- A Binding created on the first record restores on the unseen third record when stable Page Profile and Field Profile evidence matches.
- A structurally similar negative page and an ambiguous field inherit no Binding.
- Tests inspect persisted identity material and prove it excludes raw record IDs, customer-like names, field values, and fixture-only selectors/constants.
- Field matching uses only the allowed evidence listed in this contract.
- A conditionally inserted field works after it appears without manual rescan.
- SPA navigation and DOM reconstruction create at most one control, one extension marker set, and one effective handler for each supported field.
- Removed or cloned nodes cannot retain stale FillNest Target Field or control state.

### Style Isolation

- A hostile fixture stylesheet targets generic elements such as `button`, `input`, and common class names.
- Computed-style assertions prove defined Picker properties retain their extension values under the hostile stylesheet.
- Positioning uses only extension-owned overlay elements and must not mutate style, class, or layout attributes on the Target Field, its ancestors, or host-page sentinels.
- In each tested viewport, the visible control is anchored within 12 CSS pixels of one edge of the Target Field without covering its editable text area, and the Picker is anchored within 12 CSS pixels of the control while remaining inside the viewport when its dimensions permit.
- The 12 CSS pixel maximum is accepted for Task 001 as an initial objective test threshold, not a permanently frozen product interface. A later reviewed task may change it when implementation evidence or product needs justify the change.
- Scroll, resize, and fixture layout-shift tests recompute the anchor and retain those bounds. Computed styles and attributes on host-page sentinels are identical before and after control and Picker mount.
- Screenshots may supplement these assertions but are not the sole pass criterion.

### No-Network Behaviour

- A static scan of built extension code finds no product use of `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, remote URL assets, or telemetry libraries.
- Playwright records browser requests and allows only runner-controlled navigation and fixture assets from the documented Fixture Origin.
- Any unexpected HTTP, HTTPS, WebSocket, or EventSource request during extension actions fails the test.
- No request initiated by a `chrome-extension://` context is permitted.

### Documentation And Scope

- Commands or results added or updated by Task 001 in `AGENTS.md` and `DEVELOPMENT.md` come only from checks actually run during Task 001; existing legitimate content remains intact.
- Exact commands, outcomes, skipped checks, deviations, and remaining risks are recorded.
- The built extension and fixtures contain no client-specific content.
- Work stops after evidence and handoff; broader V1 implementation requires a separately reviewed contract.

## Required Validation

- Run the finalized npm typecheck command.
- Run Vitest tests for domain logic, validation, Repository contracts, permissions, matching fixtures, privacy reads, field eligibility, insertion semantics, and required Preact behaviour.
- Build the extension from a clean output directory.
- Inspect the built manifest, entry points, assets, capability set, and packaged file list.
- Inspect static and dynamic content-script matches and prove that only exact granted Permission Host Patterns are registered at runtime.
- Run Playwright with a persistent context and Playwright's bundled Chromium against the static and SPA Fixture Origin.
- Exercise the authorized origin, a same-host sibling port, granted reload/return/new-tab flows, Popup Disable, direct permission removal outside the Popup flow, immediate multi-tab teardown, unaffected-origin isolation, and revoked reload flow.
- Execute the per-slice evidence listed in the Vertical Slices table and Acceptance Criteria.
- Use a deterministic worker or extension restart method; do not treat a long sleep as proof of lifecycle behaviour.
- Assert computed style values for both Picker and host-page sentinels.
- Record and enforce the runtime network allowlist.
- Run `git diff --check`.
- Record exact verified commands and outcomes in `DEVELOPMENT.md` before leaving each slice.

Use a one-behaviour-at-a-time red-green loop for pure domain, validation, Repository, permission, matcher, privacy, and insertion logic. Add browser-level tests incrementally as each observable extension behaviour becomes available.

## Stop Conditions

Stop the current slice and request direction when:

- an acceptance criterion requires a product-rule change;
- a new major dependency, permission, host capability, or runtime boundary is required;
- exact-origin activation cannot work without broader access than this contract permits;
- matcher success requires record-specific or fixture-specific evidence;
- privacy instrumentation detects an implicit field-value read;
- dynamic-page handling cannot remain idempotent without a broader architecture change;
- deterministic worker restart or network assertions cannot be implemented reliably in the current environment;
- the task must enter a forbidden feature area;
- the implementation would change files outside Allowed Scope.

Do not continue by weakening, skipping, or silently reinterpreting the failing criterion.

## Approval-Required Situations

- Scope must expand materially.
- A destructive action is required.
- A major dependency must be introduced or replaced.
- The approved technical baseline must change.
- A required or optional manifest capability must expand.
- User-observable behaviour or a stable domain contract must change unexpectedly.
- Persisted-data compatibility must change unexpectedly.
- The task conflicts with `PROJECT.md`, `CONTEXT.md`, `AGENTS.md`, or ADR 0001.
- Acceptance criteria cannot be satisfied as written.
- Existing files outside Allowed Scope must change.
- The implementation would require site-specific selectors or reading unrelated field values.

Internal Repository methods, typed message shapes, fixture route names, and test helpers may be refactored inside this task without approval when their tests and callers change together and no condition above is triggered.

## Assumptions

- A local synthetic fixture server can exercise the required browser behaviours without becoming a product backend.
- A narrow Template, Site Affinity, and Binding data model is sufficient for the vertical slice.
- Chrome optional host permissions can be tested against one local Fixture Origin and one exact Permission Host Pattern.
- The earlier prototype findings are useful as mechanism evidence but not as transferable production code.

## Working Hypotheses

- Vite can produce all required MV3 entry points without a dedicated extension framework.
- The proposed `storage`, `activeTab`, and `scripting` capability set is sufficient for immediate current-page activation without broader host access.
- `chrome.storage.local` is sufficient for the vertical slice and representative V1 sizing.
- Service-worker-owned Repository access and typed messages remain reliable across deterministic lifecycle restart.
- An extension-owned Shadow Root provides sufficient style isolation and workable focus behaviour.
- URL normalization plus stable, non-record-specific structure can distinguish randomized same-type pages from unrelated or ambiguous pages.
- Mutation observation, SPA navigation hooks, focus handling, and idempotent markers can support dynamic fields without periodic full-page rescans.
- Native value setters plus exactly one bubbling `input` and `change` event can preserve fixture-controlled-field behaviour while implementing cursor and selection insertion.
- Playwright's bundled Chromium can load and validate the built MV3 extension consistently in this environment.

## Open Questions

- No open product-design question is known; execution still requires explicit user authorization.
- Exact directory names, allowed matcher signal weights, debounce values, internal message shapes, and fixture route names may be chosen during implementation if they remain inside this contract and are supported by tests.
- The proposed manifest capability set remains a working hypothesis until Slice 2 proves immediate activation and revocation. It may be reduced without approval; it may not be expanded without approval.

## Review Gate

After implementation, perform an independent review against:

- every slice checkpoint and acceptance criterion in this contract;
- `PROJECT.md`, `CONTEXT.md`, `AGENTS.md`, and ADR 0001;
- genericity and absence of earlier-prototype or client-specific assumptions;
- build, privacy, matcher, permission, lifecycle, network, and browser evidence;
- scope control and remaining working hypotheses.

Do not begin broader V1 implementation until the review is complete and the user approves the next task contract.

## Status

Complete - Slices 1 through 5 and both remediation amendments are implemented, pass the complete automated validation set, and pass final independent Spec and Project Standards re-review with no remaining P1/P2 findings. The user accepted Task 001 on 2026-08-13 without performing separate hands-on testing; that unperformed manual validation is recorded as a remaining evidence limitation rather than an unresolved acceptance gate.

## User Acceptance Remediation Amendment

The following corrections are part of Task 001 completion:

- Field Eligibility must use generic ordered evidence and high-confidence vetoes to reject script-enhanced special-purpose controls such as text-backed date pickers. It must not encode Selenium-specific names, labels, classes, routes, or widget-library rules. Positive, negative, and ambiguous fixtures must prove that ordinary text-like controls remain eligible and date-related words alone do not cause exclusion.
- Saving a new Template from a Target Field must atomically create its initial Binding without inserting content. The Picker remains open and presents the new Template as bound.
- A bound Template must expose a minimal `Unbind` action for the current Field Profile. Unbind removes only that Binding, does not delete or edit the Template, inserts nothing, and leaves the Picker open with clear feedback.
- When the user captured a non-empty selection before opening the Picker, the Target Field must retain a visible, non-destructive representation of that selected range while focus is inside the Picker. This explicit action permits one transient Target Field value read solely to render the non-persisted representation. The representation must not alter the field value, selection boundaries, Target Field identity, surrounding page content, or final insertion semantics, and it must be removed when the Picker closes or the Target Field becomes ineligible or disconnected.

The following work is explicitly deferred and is not a Task 001 completion blocker:

- A persistent manual SPA demonstration page.
- The earlier prototype UI reference study.
- Popup settings navigation, complete Options Page management, Edit, Delete, hover or overflow row actions, final FillNest icon design, and adaptive control sizing. These belong to the independent Task 002 UI Interaction And Management contract.

## Production Counterexample Remediation Amendment

The following corrections are Task 001 acceptance prerequisites:

- Only trusted browser events may activate FillNest control, Create, Search, Use-current-content, Save, Bind, Unbind, or insertion actions. Synthetic host-page events must produce no business operation, field read, insertion, or Binding change.
- Site identity must use an offline ICANN Public Suffix List implementation so subdomains share a registrable domain while unrelated `co.uk`, `com.au`, and equivalent multi-label public-suffix Sites remain distinct. Localhost and IP behaviour remains unchanged.
- Page identity must not persist customer-like route slugs or opaque query values. Uncertain routes fail closed; record tokens embedded in otherwise stable route structure must not collapse unrelated structures to one generic Page identity.
- Sensitive-field classification must tokenize valid `autocomplete` lists and include visible label evidence. OTP and payment controls receive no FillNest marker, listener, UI, value read, or behaviour.
- Service-worker-owned Repository mutations must serialize concurrent accepted operations so no Template, Binding, Site Affinity, or profile update is silently overwritten.
- Picker positioning must choose below or above the control according to available viewport space, clamp within the viewport, and retain the accepted maximum 12 CSS pixel anchoring gap when space permits.

## Post-acceptance Field Eligibility Amendment — Generic Date Widgets

Text-backed date widgets remain unsupported even when they omit native `type="date"`, ARIA calendar wiring, or an associated native label. The generic veto accepts only high-confidence evidence: an explicit generic date-widget declaration (`data-provide` whose value denotes a date/calendar widget), or an unambiguous date-of-birth semantic in safe metadata. Ambiguous ordinary free-text fields such as `start-date` and date-related notes remain eligible. No hostname, route, class name, widget-library name, or product-specific selector may be used.
