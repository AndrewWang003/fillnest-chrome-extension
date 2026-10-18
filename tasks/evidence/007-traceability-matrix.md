# Task 007 Slice 1 - Integrated Traceability Matrix

Maps every V1 Success Criterion (`PROJECT.md`) and every Acceptance Criteria /
Addendum Criteria sentence in `tasks/001` through `tasks/006` to either an
existing automated test or an explicit declared manual check.

Legend: **Covered** = an existing automated test directly asserts this.
**Partial** = a test exists but leaves a real gap (explained in Evidence).
**Manual** = no automated test exists; declared as a manual check, with a
reason it resists automation.

Test file paths are relative to the repo root. Where a single large e2e test
covers many criteria at once, it is cited repeatedly with the specific
assertion block noted.

## PROJECT.md - Success Criteria

| # | Criterion (quoted/paraphrased) | Evidence | Status |
| - | --- | --- | --- |
| SC1 | Users can explicitly grant/remove Website Access via Permission Host Pattern and independently set Global/Origin Active-Pause; Site stays a separate grouping concept | `tests/unit/activation-authority.test.ts` ("persists Global Pause...", "persists Origin Pause only for a currently authorized Permission Origin"); `tests/e2e/permission-lifecycle.spec.ts` (grant/pause/resume flow); `tests/unit/sites-page.test.tsx` ("is a single switch per address...") | Covered |
| SC2 | Revoking a Permission Host Pattern removes FillNest page UI and stops behaviour without deleting local Site data | `tests/unit/permission-lifecycle.test.ts` ("notifies activation authority after external Website Access cleanup"); `tests/e2e/permission-lifecycle.spec.ts` (externalRemoval block: `expectMarker(primaryPage,false)` + `READ_STATE` unchanged) | Covered |
| SC3 | External revocation via Chrome settings stops FillNest immediately in all already-open tabs for the affected pattern without reload | `tests/e2e/permission-lifecycle.spec.ts` (`removePermissionExternally` then asserts `primaryPage` and `secondPrimaryPage` markers false without reload, `siblingPage` untouched) | Covered |
| SC4 | Reload/return to authorized Origin-Active page while Global Active restores FillNest without reopening Popup; Origin-Paused reload restores only gray Page Status Control | `tests/e2e/permission-lifecycle.spec.ts` (reload assertions after grant, and after `SET_ORIGIN_ACTIVATION: paused` + reload → `expectPageStatus(...,true)` while marker false); `tests/unit/activation-repository.test.ts` ("changes Origin Activation only while Website Access remains granted") | Covered |
| SC5 | Supported static, conditional, and SPA-created fields work without manual rescanning | `tests/e2e/field-first-templates.spec.ts` (live tab tracking, no reload); `tests/e2e/static-field-loop.spec.ts`; `tests/unit/recognition-evidence.test.ts` ("uses only stable field semantics and fails closed for ambiguous fields") — no dedicated unit test for conditional/SPA-created field appearance timing beyond e2e fixtures | Covered |
| SC6 | Controls and listeners are not duplicated after DOM reconstruction or navigation | Task 001 Acceptance Criteria states this requirement explicitly ("SPA navigation and DOM reconstruction create at most one control..."); no unit test title asserts singularity counts directly - covered only via e2e fixture behaviour in `static-field-loop.spec.ts` and `field-first-templates.spec.ts`, which do not explicitly assert "exactly one" control/listener counts in their titles | Partial |
| SC7 | Users can create, edit, delete, search, bind, unbind, and insert Templates | `tests/unit/inline-picker.test.tsx` (create/bind/unbind/save-copy suite); `tests/unit/repository.test.ts` (create/bind/unbind/delete/restore); `tests/unit/template-search.test.ts`; `tests/e2e/side-panel-library.spec.ts`; `tests/e2e/edit-copy-undo.spec.ts` | Covered |
| SC8 | Cursor insertion and selected-text replacement preserve surrounding user content | `tests/unit/apply-text-insertion.test.ts` ("inserts literal text at a captured cursor...", "replaces only the captured selection...") | Covered |
| SC9 | Reliable same-site returning matches restore bound Templates | `tests/unit/repository.test.ts` ("restores a Binding only for the same reliable Page and Field identities"); `tests/unit/recognition-evidence.test.ts` ("maps independently randomized records to one logical page...") | Covered |
| SC10 | Unrecognized fields inherit no Bindings | `tests/unit/recognition-evidence.test.ts` ("fails closed for deep record-name slugs..."); `tests/unit/field-first-view.test.ts` ("is empty when no current-tab Page is resolved") | Covered |
| SC11 | Search does not confuse global availability, Site Affinity, or Field Match | `tests/unit/inline-picker.test.tsx` ("Search shows every literal match, with this Field's bound Templates first and visible Site labels..."); `tests/unit/template-search.test.ts` | Covered |
| SC12 | Eligibility classification may inspect element type/safety metadata, but excluded sensitive/unsupported fields get no value read, fingerprint, Field Profile, marker, listener, control, Picker, or fill | `tests/unit/field-eligibility.test.ts` ("rejects state-based, unsupported, password, payment, and one-time-code fields"); Task 001 acceptance also requires "zero Target Field value reads" instrumentation - no unit test title in this repo directly instruments a read-counter for excluded fields (that instrumentation lives in e2e fixtures per contract, not found among current spec titles) | Partial |
| SC13 | Forms are never automatically submitted | Task 001 AC: "form submit counter remains zero and no navigation occurs" - no test title in `tests/unit` or `tests/e2e` explicitly names a submit-counter assertion; likely embedded as an assertion inside `apply-text-insertion.test.ts` or e2e fixtures but not named as its own test | Manual (declared - no test title names this invariant explicitly; recommend adding an explicit assertion, see Gaps) |
| SC14 | Backup Archives can be validated, exported, and restored without partial corruption | `tests/unit/archive-contract.test.ts` (full validation suite); `tests/unit/backup-export.test.ts`; `tests/unit/backup-restore.test.ts`; `tests/unit/restore-transaction.test.ts`; `tests/e2e/backup-restore.spec.ts` | Covered |
| SC15 | The built extension initiates no HTTP/HTTPS/WebSocket/EventSource requests and includes no remote code; test-runner navigation to a local Fixture Origin is not extension-originated traffic | `tests/unit/manifest-policy.test.ts` ("rejects product network APIs and telemetry markers in built code"); `tests/unit/runtime-network-allowlist.test.ts` (both tests); e2e `monitorRuntimeNetwork` assertions in `permission-lifecycle.spec.ts` ("networkMonitors...violations...toEqual([])") | Covered |
| SC16 | The codebase and test fixtures contain no client-specific content | No automated test scans for this (it is a content/branding review, not a runtime behaviour) | Manual (declared - requires human/textual audit of source and fixtures for client-specific terms; not something a unit/e2e assertion naturally verifies) |

## Task 001 - Engineering Initialization And Technical Discovery

| Criterion | Evidence | Status |
| --- | --- | --- |
| `npm ci` respects the committed lockfile from a clean dependency state | No test; this is a documented command run manually/in CI | Manual (declared - process/tooling check, not a unit-testable assertion) |
| Documented npm commands typecheck, test, build, run e2e checks | Same as above | Manual (declared - process check) |
| Built manifest is valid MV3 with exactly the approved permissions/optional declarations | `tests/unit/manifest-policy.test.ts` ("rejects required permission drift", "rejects optional host declaration drift", "rejects a non-MV3 manifest") | Covered |
| Built manifest contains no install-time `host_permissions`, broad static `content_scripts.matches`, `<all_urls>`, `tabs`, `unlimitedStorage`, unrelated capability, remote code/asset | `tests/unit/manifest-policy.test.ts` ("rejects install-time host permissions", "rejects statically declared content scripts") | Covered |
| Built-package inspection proves entry points/assets exist and excludes source-only/unrelated files | `tests/unit/manifest-policy.test.ts` ("rejects a package with a missing extension entry", "rejects an unrelated built file") | Covered |
| Fixture server exposes Fixture Origin; tests record origin and derived Permission Host Pattern | `tests/e2e/permission-lifecycle.spec.ts` (`startFixtureServer`, logged `pattern=`) | Covered |
| Derived pattern retains explicit port; sibling origin on same host/scheme different port stays unauthorized | `tests/unit/permission-origin.test.ts` ("keeps an explicit effective port in the exact host pattern"); e2e sibling-origin assertions in `permission-lifecycle.spec.ts` | Covered |
| Before Enable: `permissions.contains()` false, no page UI, no behaviour | `tests/e2e/permission-lifecycle.spec.ts` (`expectMarker(primaryPage, false)` before grant) | Covered |
| Enable requests only current pattern from user gesture; never `http://*/*`/`https://*/*`/`<all_urls>` | `tests/e2e/permission-lifecycle.spec.ts` (`grantOrigin` helper, pattern-specific); no dedicated unit test asserts the negative (never requests wildcard) | Partial |
| After grant, `permissions.contains()` true and FillNest activates without granting another host | `tests/e2e/permission-lifecycle.spec.ts` (`expectPermissionEvidence`) | Covered |
| Reload/navigate-away-return/new-tab auto-activate via persisted exact-pattern dynamic registration | `tests/e2e/permission-lifecycle.spec.ts` (reload + new tab `newPrimaryTab` assertions) | Covered |
| `getRegisteredContentScripts()` proves only exact patterns registered, persist across restart, no broad match | `tests/e2e/permission-lifecycle.spec.ts` (`registrations` check pre/post `context.close()`+relaunch) | Covered |
| Popup provides explicit Disable calling `permissions.remove()` | `tests/unit/permission-lifecycle.test.ts` ("routes Popup Disable through the shared permission-removal cleanup") | Covered |
| `chrome.permissions.onRemoved` is shared cleanup authority; unregisters scripts and broadcasts without reading URL/title | `tests/unit/permission-lifecycle.test.ts` ("reconciles persistent registrations with Chrome-granted origins", "notifies activation authority after external Website Access cleanup") | Covered |
| Every injected top-frame script derives its own pattern and tears down on matching revocation; nonmatching origins stay active | `tests/e2e/permission-lifecycle.spec.ts` (sibling stays active while primary tears down) | Covered |
| External-revocation test: 2 tabs at granted origin + 1 nonmatching, teardown without reload, nonmatching stays active | `tests/e2e/permission-lifecycle.spec.ts` (`primaryPage`, `secondPrimaryPage`, `siblingPage`) | Covered |
| After external revocation: registration absent, `contains()` false, reload stays inactive, business data unchanged | `tests/e2e/permission-lifecycle.spec.ts` (`postRevocationEvidence`, `READ_STATE` equals `preRestartState`) | Covered |
| No persisted boolean is treated as a substitute for Chrome permission state | No test title names this negative invariant directly; implicitly relied upon since all activation tests query `permissions.contains()`/registration state rather than a stored flag | Partial |
| `chrome.storage.local` accessed through Repository boundary, `schemaVersion: 1`, validates records, passes contract tests | `tests/unit/repository.test.ts` ("creates a schema-v1 Template..."); `tests/unit/repository-integrity.test.ts` | Covered |
| Template creation from Fixture Origin persists exactly one current-Site Affinity without Site Affinity UI | `tests/unit/repository.test.ts` ("creates a schema-v1 Template with exactly one current-Site Affinity") | Covered |
| Binding existing Template on new Site adds that Site Affinity exactly once | `tests/unit/repository.test.ts` ("persists one Binding and adds its new Site Affinity without inserting content") | Covered |
| Repeating creation/Binding does not duplicate Site Affinity | Implied by same test plus `repository-integrity.test.ts` duplicate-ID/binding rejections; no test title states "repeating does not duplicate" explicitly | Partial |
| Site-normalization: scheme/port ignored, subdomains share Site, second domain distinct, localhost/IP use normalized host | `tests/unit/site-normalization.test.ts` (all 4 tests) | Covered |
| Durable behaviour tested across fresh instance and deterministic restart; no sleep-based evidence | `tests/e2e/permission-lifecycle.spec.ts` (`context.close()` + relaunch, `postRestartState` equals `preRestartState`) | Covered |
| Restart procedure and pre/post record IDs recorded for repeatability | `tests/e2e/permission-lifecycle.spec.ts` (`console.log(Restart evidence: pre/post Template ID=...)`) | Covered |
| Eligible positive fixtures cover textarea + text/search/email/tel/url (incl. missing/invalid type fallback) | `tests/unit/field-eligibility.test.ts` ("allows only the approved text-like input types and textarea") | Covered |
| Negative fixtures cover unsupported input types and non-input editable-looking elements + sensitive/state exclusions | `tests/unit/field-eligibility.test.ts` ("rejects state-based, unsupported, password, payment, and one-time-code fields") | Covered |
| Creating/opening Template editor yields empty content field | `tests/unit/inline-picker.test.tsx` ("renders a blank Template editor and reads the Target Field only on explicit request") | Covered |
| Instrumented tests prove zero Target Field value reads when no selection captured | `tests/unit/inline-picker.test.tsx` (same test, "reads the Target Field only on explicit request") | Covered |
| `Use current field content` increments read counter and copies value; Picker-open-after-selection exception | `tests/unit/inline-picker.test.tsx` (same test) | Covered |
| Password/payment/OTC/hidden/disabled/read-only/unsupported fields: no read, fingerprint, Field Profile, marker, listener, control, Picker | `tests/unit/field-eligibility.test.ts` ("rejects state-based, unsupported, password, payment, and one-time-code fields") - covers classification; whether *no per-field listener/control is ever attached* for these is asserted more directly in e2e fixtures (`static-field-loop.spec.ts`) than in this unit test's title | Partial |
| No unrelated supported-field value read while another field is targeted | `tests/unit/inline-picker.test.tsx` ("fails closed on Bind and New-template Save when the Target Field is not actionable"); no test title explicitly names "sibling field value never read" | Partial |
| Focusing a supported field shows one control, does not open Picker | `tests/unit/inline-picker.test.tsx` ("keeps Template preview and contextual action in separate stable regions") - adjacent but not a direct title match; `tests/unit/page-status-control.test.tsx` unrelated | Partial |
| Activating control captures Target Field and opens exactly one Picker in Shadow Root | `tests/unit/inline-picker.test.tsx` (general suite assumes this setup); no explicit "exactly one Picker in Shadow Root" test title | Partial |
| Moving focus into Picker controls does not replace Target Field with `document.activeElement` | `tests/unit/inline-picker.test.tsx` ("fails closed on Bind and New-template Save when the Target Field is not actionable") - close but not a direct title | Partial |
| Recognized field initially renders only Templates bound to that Field Profile | `tests/unit/field-first-view.test.ts` ("groups by Field and ranks each Field's own Templates..."); `tests/unit/inline-picker.test.tsx` ("does not show pre-query suggestions for a recognized Field kind") | Covered |
| Unrecognized field renders no Template content, only Create/Search empty-state | `tests/unit/inline-picker.test.tsx` ("uses the real unrecognized state for the empty Field message and still exposes deliberate Search") | Covered |
| Search: non-empty query does case-insensitive literal substring match, only unbound Global/current-Site-Affinity Templates | `tests/unit/template-search.test.ts` ("returns every unbound literal body match after trimming outer query whitespace and ignoring case"); `tests/unit/inline-picker.test.tsx` ("Search shows every literal match...") | Covered |
| Search tests include eligible unbound match, bound-must-not-reappear, nonmatching, ineligible-Site-Affinity cases | `tests/unit/inline-picker.test.tsx` ("Search shows every literal match, with this Field's bound Templates first and visible Site labels for affiliated results") | Covered |
| Creating Template from Target Field atomically persists content+Site Affinity+initial Binding, no insertion, Picker stays open bound | `tests/unit/inline-picker.test.tsx` ("creates a Template already bound and can Unbind it without inserting") | Covered |
| Bind creates only Binding, inserts nothing, Picker stays open bound | Same test as above | Covered |
| Unbind removes only current Binding, preserves Template, inserts nothing, Picker stays open | Same test as above | Covered |
| Cursor insertion preserves exact text before/after cursor | `tests/unit/apply-text-insertion.test.ts` ("inserts literal text at a captured cursor and emits the exact event oracle") | Covered |
| Selected-text insertion replaces only selected range | `tests/unit/apply-text-insertion.test.ts` ("replaces only the captured selection and emits replacement semantics") | Covered |
| HTML/script payload appears literally, creates no element, executes no code | Implied by `apply-text-insertion.test.ts` using literal text-insertion APIs; no test title with an explicit XSS-payload fixture | Partial |
| Only captured Target Field changes; sibling fields retain values, no input/change events | No test title explicitly names a "sibling field unaffected" assertion | Manual/Gap - recommend explicit test (see Gaps) |
| Target Field receives exactly `input` then `change`, no `beforeinput` | `tests/unit/apply-text-insertion.test.ts` ("emits the exact event oracle") | Covered |
| `input` event has correct `inputType`/`data`/`bubbles`/`composed`/`cancelable` | `tests/unit/apply-text-insertion.test.ts` (same, "emits replacement semantics" for `insertReplacementText`) | Covered |
| `change` event has `bubbles:true, composed:false, cancelable:false` | `tests/unit/apply-text-insertion.test.ts` (same) | Covered |
| Form submit counter remains zero, no navigation | No test title names a submit-counter assertion | Manual (declared - likely embedded assertion without a named test; recommend explicit coverage, see Gaps) |
| Picker closes after insertion; Target Field focused with deterministic caret | No unit test title asserts post-insertion caret position/Picker close explicitly; e2e fixtures likely exercise this behaviourally | Partial |
| Positive fixtures use ≥3 randomized records independent of matcher | `tests/unit/recognition-evidence.test.ts` ("maps independently randomized records to one logical page without retaining record data") | Covered |
| Binding on first record restores on unseen third record via stable evidence | `tests/unit/recognition-evidence.test.ts` (same) | Covered |
| Structurally similar negative page / ambiguous field inherits no Binding | `tests/unit/recognition-evidence.test.ts` ("uses only stable field semantics and fails closed for ambiguous fields") | Covered |
| Persisted identity excludes raw record IDs, customer-like names, field values, fixture-only selectors | `tests/unit/recognition-evidence.test.ts` (same); `tests/unit/display-label.test.ts` ("privacy counterexample: never surfaces a residual numeric or UUID-like segment", "...raw customer-like slug") | Covered |
| Field matching uses only allowed evidence | `tests/unit/recognition-evidence.test.ts` ("uses only stable field semantics...") | Covered |
| Conditionally inserted field works after appearing, no manual rescan | `tests/e2e/static-field-loop.spec.ts` (exercises dynamic/static loop); no dedicated unit test title | Partial |
| SPA navigation/DOM reconstruction: at most one control/marker-set/handler per field | `tests/e2e/field-first-templates.spec.ts` (live tab tracking); no explicit "exactly one" count assertion in any test title | Partial |
| Removed/cloned nodes cannot retain stale Target Field/control state | No test title names this directly | Manual/Gap (see Gaps) |
| Hostile stylesheet targets generic elements; computed-style assertions on Picker | `tests/e2e/picker-ux-fixes.spec.ts` ("Picker keyboard highlight has real visible contrast...") - adjacent, not a hostile-CSS test | Partial |
| Positioning uses extension-owned overlay only, no host mutation | No dedicated test title | Manual/Gap |
| Control anchored within 12px of field edge without covering text; Picker anchored within 12px of control | `tests/unit/field-control-geometry.test.ts` ("adapts representative field heights inside the accepted 24-32 pixel range") - covers control size, not the 12px anchor-gap directly | Partial |
| 12px threshold accepted as initial, not frozen | Documentation/process statement, not testable | Manual (declared - a policy statement, not a runtime assertion) |
| Scroll/resize/layout-shift recompute anchor, bounds retained; host sentinels unchanged | No dedicated test title | Manual/Gap |
| Screenshots supplement but are not sole pass criterion | Screenshots exist in `permission-lifecycle.spec.ts` (`.screenshot(...)`) alongside functional assertions - satisfies "not sole criterion" by construction | Covered |
| Static scan finds no `fetch`/`XHR`/`WebSocket`/`EventSource`/remote assets/telemetry in built code | `tests/unit/manifest-policy.test.ts` ("rejects product network APIs and telemetry markers in built code") | Covered |
| Playwright records requests, allows only runner-controlled navigation/fixture assets | `tests/unit/runtime-network-allowlist.test.ts` ("allows only runner-controlled Fixture Origin navigation and assets"); e2e `monitorRuntimeNetwork` | Covered |
| Unexpected HTTP/HTTPS/WS/ES request during extension actions fails test | `tests/unit/runtime-network-allowlist.test.ts` ("rejects remote, realtime, and extension-initiated network activity") | Covered |
| No request from `chrome-extension://` context permitted | Same as above | Covered |
| Task 001 doc/scope items (AGENTS.md/DEVELOPMENT.md accuracy, client-free content, stop-after-evidence) | No automated test; documentation/process/content review | Manual (declared) |

## Task 002 - Interaction Surfaces And Navigation

| Criterion | Evidence | Status |
| --- | --- | --- |
| Fresh install: Global Activation Pause, no page UI even after Website Access granted until Active | `tests/unit/activation-repository.test.ts` ("initializes a fresh installation globally Paused with no Origin Activation") | Covered |
| Upgrade preserves Global Active, marks every granted exact origin Active without re-requesting permission | `tests/unit/activation-repository.test.ts` ("migrates a Task 001 update to Active for every exact granted Permission Origin") | Covered |
| Migration runs once logically, safe to repeat, preserves Task 001 records byte-for-byte except schema envelope, survives worker restart | `tests/unit/repository.test.ts` ("migrates schema-v1 data through v2, v3, and v4 with neutral usage counts, revisions, and Binding order, once and idempotently") | Covered |
| Global Pause tears down all page UI/field behaviour across every injected tab without removing Website Access/registration/Origin prefs | `tests/e2e/permission-lifecycle.spec.ts` (`SET_GLOBAL_ACTIVATION: paused` across `primaryPage`, `secondPrimaryPage`, `siblingPage`) | Covered |
| Returning Global Active restores only origins whose Origin Activation preference is Active | `tests/unit/activation-repository.test.ts` ("reconciles granted origins while preserving existing Pause and dormant preferences") | Covered |
| Origin Pause removes field-level markers/listeners/actions in every open tab for that origin, retains one gray Page Status Control, persists after reload/restart, no cross-origin effect | `tests/e2e/permission-lifecycle.spec.ts` (`SET_ORIGIN_ACTIVATION: paused` block, `expectPageStatus(...,true)` while marker false) | Covered |
| External Chrome permission removal clears origin activation, removes registration/page UI, leaves business data unchanged | `tests/e2e/permission-lifecycle.spec.ts` (`removePermissionExternally` block) | Covered |
| Popup states/actions match Stable Product Decisions, always display full Permission Origin | `tests/unit/popup.test.tsx` ("shows explicit Website Access and disabled Origin Activation on an unauthorized origin") | Covered |
| Restricted/unsupported/missing-tab/missing-URL contexts retain Global state + `Open FillNest`, no fabricated origin, no executable access action | `tests/unit/popup.test.tsx` ("keeps Global Activation and Open FillNest on a restricted page without access actions") | Covered |
| Permission request originates from origin-labelled Popup action; no page control before grant | `tests/e2e/permission-lifecycle.spec.ts` (`grantOrigin` via Popup, `expectMarker` false beforehand) | Covered |
| Page status control appears/colors/toggles/persists/disappears per accepted state matrix; only trusted interaction invokes it | `tests/unit/page-status-control.test.tsx` ("exposes one explicit Active or Pause action without a menu"); e2e toggling in `permission-lifecycle.spec.ts` | Covered |
| `Open FillNest` opens Side Panel from user gesture without requesting Website Access | `tests/e2e/permission-lifecycle.spec.ts` (`Open FillNest` click → side panel context check, no permission prompt) | Covered |
| Overview/Templates/Sites/Settings render real data; no empty future destination | `tests/unit/side-panel.test.tsx` ("navigates among real Overview, Templates, Sites, and Settings data") | Covered |
| Templates Search is literal body Search, no relevance/recommendation | `tests/unit/library-views.test.ts` ("filters by literal Template body Search only") | Covered |
| Sites never conflates registrable Site, exact Permission Origin, Website Access, Origin Activation | `tests/unit/site-projection.test.ts` (grouping tests); `tests/unit/sites-page.test.tsx` ("opens on By site by default...") | Covered |
| Built manifest includes only user-selected `sidePanel` addition, removes `options_page`, retains optional host permissions | `tests/unit/manifest-policy.test.ts` ("rejects Options Page and Chrome versions below 116") | Covered |
| Built manifest sets `minimum_chrome_version: 116`; `Open FillNest` exercised from real user gesture | `tests/unit/manifest-policy.test.ts` (same test); `tests/e2e/permission-lifecycle.spec.ts` (real click) | Covered |
| Injected failures at permission/persistence/registration/injection seams produce defined non-success UI, retain justified state, recover via idempotent Retry/startup | `tests/unit/activation-authority.test.ts` ("reports a post-grant persistence failure without hiding granted Website Access", "reports registration and injection failures at their completed-step boundary") | Covered |
| Post-grant failure never re-requests permission when already granted, never silently revokes | `tests/unit/activation-authority.test.ts` ("reports a post-grant persistence failure without hiding granted Website Access") | Covered |
| Every concurrent visible surface (Side Panel, Page Status Controls, Popup) converges to one authoritative state after mutation, without reload; Popup always fresh on open | `tests/unit/business-state-broadcast.test.ts` ("broadcasts a Business state change for every handled business mutation"); e2e multi-tab convergence in `permission-lifecycle.spec.ts` | Covered |
| Surface that misses a notification (suspended) converges on next open/focus/visibility/reconnect | No dedicated test title for a *missed-then-reconnect* scenario; broadcast tests assume delivery, not recovery-from-miss | Partial |
| Popup/Page Status Control/Side Panel nav/Picker actions: accessible names, visible keyboard focus, usable keyboard order | `tests/unit/inline-picker.test.tsx` ("supports Arrow selection and Enter-to-insert without degrading text entry into Search"); `tests/e2e/picker-ux-fixes.spec.ts` ("Picker keyboard highlight has real visible contrast..."); no single test asserts accessible names across all four surfaces together | Partial |
| Hover/keyboard focus never reflows Template row or obscures content | `tests/unit/side-panel-library.test.tsx` (row action tests, e.g. "expands a Template row to show its full text on click...") - adjacent, no explicit hover/focus reflow assertion | Partial |
| Adaptive field control 24-32px on short/ordinary/tall fields, preserves 12px anchor gap | `tests/unit/field-control-geometry.test.ts` ("adapts representative field heights inside the accepted 24-32 pixel range", "fails safely for non-finite geometry") | Covered |
| Host styles cannot alter FillNest surfaces; FillNest changes no host style/attrs beyond Task 001 markers | No dedicated unit test; likely covered only by e2e fixture visual assertions, none titled for this specifically | Manual/Gap |
| No network traffic, no remote assets | `tests/unit/runtime-network-allowlist.test.ts`; `tests/unit/manifest-policy.test.ts` | Covered |
| All Task 001 built-extension flows remain passing | Regression coverage is the whole Task 001 test suite remaining green; no single test named for this | Covered (via full suite) |

## Task 003 - Template Library And Organization

| Criterion | Evidence | Status |
| --- | --- | --- |
| Each Library view correct at 0/1/10/≥100 Templates | `tests/unit/library-views.test.ts` ("remains correct with zero, one, and ten Templates") - covers 0/1/10 but not the ≥100-Template case named explicitly | Partial |
| `Quiet Location Navigator` hierarchy/Search/actions/aliases/Undo usable at 360/420/600px widths, no horizontal scroll/clipping | No unit test asserts specific pixel widths; e2e `side-panel-library.spec.ts` exercises the views but titles don't name viewport widths | Manual/Gap |
| Location tree derived from Bindings, never duplicates Global Templates into tree | `tests/unit/library-views.test.ts` ("uses persisted document order instead of a mutable alias label" - `buildLocationTree` suite) | Covered |
| Location-tree counts use distinct Template records, no inflation from multiple descendant Bindings | Implied by `buildLocationTree` tests; no explicit "counts don't inflate" test title | Partial |
| Adaptive tree expansion deterministic, tested, doesn't overwhelm large libraries | No dedicated test title | Manual/Gap |
| System Display Labels contain no randomized IDs/slugs/query values/raw titles/field values | `tests/unit/display-label.test.ts` ("privacy counterexample: never surfaces a residual numeric or UUID-like segment", "...raw customer-like slug", "...raw name/id attributes") | Covered |
| User Alias changes survive restart, change no identity/recognition/relevance/Binding | `tests/unit/repository.test.ts` ("sets and clears a Page Profile alias without affecting identity or recognition", "sets and clears a Field Profile alias without affecting identity or recognition") | Covered |
| Search/filters compose deterministically; clearing restores default ordering | `tests/unit/library-views.test.ts` ("composes filters deterministically and clearing them restores default ordering") | Covered |
| Usage increments only after confirmed successful insertion, not lost under concurrency | `tests/unit/repository.test.ts` ("records a bound insertion by incrementing both Template total and Binding usage exactly once", "serializes concurrent insertions so no increment is lost") | Covered |
| Binding usage restored by Undo Unbind/Undo Delete, reset to 0 after Rebind, unaffected by ordinary edits | `tests/unit/repository.test.ts` ("rebinding after Unbind starts the new Binding's usage count back at 0...", "Delete Undo (restoreTemplate) restores the exact prior usage counts, not zeros", "editing a Template's content never changes its usage counts") | Covered |
| Template Preview ignores leading whitespace/blank lines, uses first non-empty line | `tests/unit/template-preview.test.ts` (all 6 tests) | Covered |
| Picker rows fixed-height, clamp to two lines, no overflow | No dedicated unit test title (a layout/CSS concern); e2e `picker-ux-fixes.spec.ts` is adjacent but not this specific assertion | Manual/Gap |
| Full-text flyouts stay inside viewport (ordinary + Keep Open) | No dedicated test title | Manual/Gap |
| Picker keyboard selection follows Arrow/Enter, doesn't degrade Search text entry | `tests/unit/inline-picker.test.tsx` ("supports Arrow selection and Enter-to-insert without degrading text entry into Search") | Covered |
| Row actions don't reflow rows, keyboard accessible, reject synthetic host-page activation | No dedicated test title for "reject synthetic activation"; `tests/unit/side-panel-library.test.tsx` covers row actions generally | Partial |
| Delete visually associated with row, separated from ordinary actions | No dedicated test title (visual/layout concern) | Manual/Gap |
| Side Panel never creates a Binding; Inline Picker Bind always uses captured Target Field | `tests/unit/sites-page.test.tsx` ("never sends a Template mutation from any Sites-page interaction") covers Sites page only; Side-Panel-specific "never creates a Binding" isn't separately titled, though `side-panel-library.test.tsx` tests (rename, delete, reorder) never exercise binding creation | Partial |
| Edit and field-copy preserve relationship invariants, never infer Page/Site-level copy scope | `tests/unit/repository.test.ts` ("saveTemplateCopyForField carries over the original Binding's order..."); `tests/e2e/edit-copy-undo.spec.ts` ("field-scoped copy preserves the original elsewhere and Undo reverts it...") | Covered |
| Undo is single-last-action, interface-scoped, non-persistent, fails closed on conflict; Picker Undo Field-scoped, Side Panel Undo follows feedback-bar rules, never leaks into Picker | `tests/e2e/picker-undo-persistence.spec.ts` ("Picker Undo survives visiting a different Field and returning, as long as nothing new happened there"); `tests/e2e/edit-copy-undo.spec.ts` ("...a stale Save Undo fails closed with a clear error") | Covered |
| Delete Undo restores complete Template+Binding state incl. usage/timestamps | `tests/unit/repository.test.ts` ("Delete Undo (restoreTemplate) restores the exact prior usage counts, not zeros") | Covered |
| Confirmation strength matches destructive outcome; entire-library path requires exact typed `delete` | `tests/unit/side-panel-library.test.tsx` ("Deleting the entire Template Library (via 'Delete all templates' in Settings) requires exact typed lowercase delete") | Covered |
| Failed validation/persistence leaves prior state unchanged | `tests/unit/repository-integrity.test.ts` ("prevents writes to storage when candidate state fails validation") | Covered |
| Task 001/002 permission/privacy/activation/selection/insertion/UI-isolation/no-network guarantees remain passing | Regression via full existing suites | Covered (via full suite) |

## Task 004 - Site Access And Data Management (incl. Addendum)

| Criterion | Evidence | Status |
| --- | --- | --- |
| Unrelated public-suffix Sites separate; subdomains group under registrable Site, exact origins keep independent state | `tests/unit/site-normalization.test.ts` ("keeps unrelated multi-label public-suffix Sites separate"); `tests/unit/site-projection.test.ts` ("groups subdomains and distinct ports under one registrable Site while keeping origins distinct", "keeps unrelated public-suffix Sites separate") | Covered |
| Every displayed count equals dry-run result; confirmed operation applies exactly that result or nothing | `tests/unit/repository.test.ts` ("resetSiteMappings' actual scope always matches computeResetSiteMappingsImpact's preview for the same state..."); `tests/unit/site-projection.test.ts` ("counts only the target Site's Page Profiles, Field Profiles, Bindings, and aliases") | Covered |
| Pause and Remove access never alter business records | `tests/unit/sites-page.test.tsx` ("never sends a Template mutation from any Sites-page interaction") | Covered |
| Removing a parent Site's access removes only selected child patterns, not unselected/unrelated origins | `tests/unit/sites-page.test.tsx` ("selects across Sites and removes access for exactly the selected origins") | Covered |
| Reset site mappings retains Templates, Site Affinity, permissions, activation prefs, future metadata exactly | `tests/unit/repository.test.ts` ("resetSiteMappings removes the Site's Page/Field Profiles, Bindings, and aliases while preserving Templates, Site Affinity, and other Sites"); `tests/e2e/reset-site-mappings.spec.ts` | Covered |
| No current Task 004 action mutates Site Affinity | `tests/unit/repository.test.ts` (resetSiteMappings tests preserve Site Affinity); `tests/unit/sites-page.test.tsx` ("revoking a Site's last access never rewrites... Templates to Global" is the addendum item below, closely related) | Covered |
| Site-affiliated Templates remain filed under Site after Website Access removal | `tests/unit/sites-page.test.tsx` ("survives an external revocation with Templates intact and the Site moved to the no-access section") | Covered |
| Every path that empties the Template Library requires typed `delete`; no partial path does | `tests/unit/side-panel-library.test.tsx` ("Deleting the entire Template Library... requires exact typed lowercase delete") - covers the Settings path; whether *every* library-emptying path (e.g. bulk multi-select of all templates) also requires typed `delete` isn't separately titled | Partial |
| Concurrent accepted operations serialize without silent data loss; stale impact summaries can't execute after source state changes | `tests/unit/repository.test.ts` ("resetSiteMappings fails closed when the confirmed impact changed before execution", "resetSiteMappingsBatch fails closed without partially clearing any Site when one confirmed impact is stale"); `tests/unit/serialized-operation-queue.test.ts` | Covered |
| Task 001-003 privacy/access/UI/insertion/no-network guarantees remain passing | Regression via full existing suites | Covered (via full suite) |
| **Addendum:** No Sites-page code path reaches Template/Binding mutation message types | `tests/unit/sites-page.test.tsx` ("never sends a Template mutation from any Sites-page interaction") | Covered |
| **Addendum:** External revocation via `onRemoved` leaves Templates/Site Affinity/Profiles untouched; Site still appears in `Saved data, no access` | `tests/unit/sites-page.test.tsx` ("survives an external revocation with Templates intact and the Site moved to the no-access section") | Covered |
| **Addendum:** Re-granting access to a revoked origin restores stored activation preference | `tests/unit/activation-repository.test.ts` ("preserves dormant preferences in repository and updates management snapshot after Chrome Website Access removal"); `tests/unit/restore-transaction.test.ts` ("preserves dormant origins and clears revoked origins properly") | Covered |
| **Addendum:** Site whose last origin is revoked while it is the current tab still renders in no-access section without crash | `tests/unit/sites-page.test.tsx` ("keeps a Site holding data but no granted address visible in Saved data, no access") - close but doesn't explicitly name the "current-tab pinning" crash scenario; `tests/unit/sites-page.test.tsx` ("pins the current browser tab's Site first...") is the pinning feature test, not the crash-safety combination | Partial |
| **Addendum:** `Clear saved fields` on multi-Site selection clears exactly those Sites atomically, confirmation names every Site, states it covers unselected addresses too | `tests/unit/sites-page.test.tsx` ("clears mappings for the distinct Sites of the selection, naming them and warning it covers unselected addresses") | Covered |
| **Addendum:** Revoking a Site's last access never rewrites its Templates to Global; `siteAffinities` preserved exactly | `tests/unit/sites-page.test.tsx` ("survives an external revocation with Templates intact...") - implies preservation but doesn't explicitly assert `siteAffinities` are byte-identical pre/post in its title | Partial |
| **Addendum:** Templates Site filter returns union not intersection; multi-affinity Template appears exactly once | `tests/unit/side-panel-library.test.tsx` ("the Site filter multi-selects with union matching, chips, backspace-removal, and disables under Global only"); `tests/unit/library-views.test.ts` ("filters by the union of several Site Affinities") | Covered |
| **Addendum:** Remove-access deep link lands on Templates page with Site filter applied, no new runtime message type | `tests/unit/sites-page.test.tsx` ("hands off to the Templates page with that Site's filter already applied") | Covered |

## Task 005 - Template Discovery And Relevance

| Criterion | Evidence | Status |
| --- | --- | --- |
| Recognized Field initially renders only its bound Templates | `tests/unit/field-first-view.test.ts` ("groups by Field and ranks each Field's own Templates by persisted order, ascending") | Covered |
| Unrecognized Field renders no Template content, tells user to create/Search | `tests/unit/inline-picker.test.tsx` ("uses the real unrecognized state for the empty Field message and still exposes deliberate Search") | Covered |
| No pre-query recommendation or `Suggested` group | `tests/unit/inline-picker.test.tsx` ("does not show pre-query suggestions for a recognized Field kind") | Covered |
| Non-empty query finds every unbound Template whose body contains the case-insensitive, trimmed query across complete library | `tests/unit/template-search.test.ts` ("returns every unbound literal body match after trimming outer query whitespace and ignoring case"); `tests/unit/inline-picker.test.tsx` ("Search remains full-library even on a Field nothing has ever been bound to yet") | Covered |
| Query-matching current-Field Templates remain visually first while Search active | `tests/unit/inline-picker.test.tsx` ("orders both This field and All templates results by the accepted default (usage descending), and Search also filters This field") | Covered |
| Search results expose Bind only as explicit action, never create Binding on display | `tests/unit/inline-picker.test.tsx` (create/bind/unbind suite - Bind is a separate explicit action throughout) | Covered |
| Affiliated rows in `All matching Templates` show visible, AT-readable Site Affinity badges; Global/`This field` rows do not | `tests/unit/inline-picker.test.tsx` ("shows the Site Affinity badge primary Site plus count for a Template spanning more than one Site"); `tests/unit/template-site-badge.test.ts` (badge computation suite) | Covered |
| Same-site Binding restoration exclusively controlled by Field Match Confidence | `tests/unit/recognition-evidence.test.ts` ("uses only stable field semantics and fails closed for ambiguous fields"); `tests/unit/repository.test.ts` ("restores a Binding only for the same reliable Page and Field identities") | Covered |
| Task 001-004 privacy/activation/management/insertion/no-network behaviour remains passing | Regression via full existing suites, plus the specific kebab-case/dotted-path fix: `tests/unit/recognition-evidence.test.ts` ("recognizes real-world kebab-case and dotted static path segments, not just single words") | Covered |

## Task 006 - Backup, Restore And Data Portability

| Criterion | Evidence | Status |
| --- | --- | --- |
| Valid export restored into empty compatible profile reproduces complete business dataset, durable prefs, Global/Origin Activation prefs | `tests/e2e/backup-restore.spec.ts` ("Export JSON archive with rich bindings/profiles/identityKeys, optional backup reminder, typed confirmation, and full data restoration") | Covered |
| Stored data migrates to current canonical schema on upgrade; every new export uses current Archive version | `tests/unit/archive-contract.test.ts` ("creates a canonical, deterministically sorted archive including identityKey"); `tests/unit/repository.test.ts` (schema migration suite) | Covered |
| Current and explicitly supported older Archives round-trip via migration without loss; newer/unsupported/partial Archives change nothing | `tests/unit/archive-contract.test.ts` ("rejects unsupported archive versions"); no explicit test title for a *successful* older-supported-version round-trip beyond current version | Partial |
| Permission state neither exported as authorization nor silently requested during restore | `tests/unit/backup-export.test.ts` ("excludes transient runtime state and non-durable properties from the archive"); `tests/unit/backup-restore.test.ts` (impact preview mentions "Website Access exclusion" per AC below) | Covered |
| Invalid/unsupported/truncated/oversized/malicious/unknown-field/duplicate-ID/duplicate-Binding/relationally inconsistent Archives change nothing | `tests/unit/archive-contract.test.ts` (full rejection suite: unknown properties, oversized content, oversized Site id, Site Affinity limit, unsupported versions, invalid dates) | Covered |
| Every accepted Repository mutation passes candidate-state validation before write; failure preserves prior state, no success broadcast | `tests/unit/repository-integrity.test.ts` ("prevents writes to storage when candidate state fails validation") | Covered |
| Impact preview accurately states replacement counts, Activation effects, Website Access exclusion, existing-data-replaced notice | `tests/unit/backup-restore.test.ts` ("accurately computes impact counts between current and backup state") | Covered |
| Non-empty current data shows export recommendation; Restore requires current impact token + typed `restore`, no export token/download gate | `tests/unit/backup-restore.test.ts` ("reports non-empty current data for the optional backup reminder", "binds confirmation token to target archive content", "invalidates confirmation token when current identityKey or granted origins mutate") | Covered |
| Restore serializes against affected mutations, commits complete state or preserves prior state, incl. across worker interruption/restart | `tests/unit/restore-transaction.test.ts` ("atomically replaces business and activation state when all writes succeed", "rolls back business state when activation write fails...", "recovers and restores consistent prior state after simulated worker interruption / crash") | Covered |
| Successful Restore reconciles extension surfaces and authorized open pages; unreachable pages reported as needing reload | `tests/e2e/backup-restore.spec.ts` (full restore flow); no unit test title names the "unreachable pages reported as needing reload" sub-case specifically | Partial |
| Exported content contains no rebuildable cache or unexpected browser/page data | `tests/unit/backup-export.test.ts` ("excludes transient runtime state and non-durable properties from the archive") | Covered |
| All prior privacy/permission/management/insertion/no-network checks remain passing | Regression via full existing suites | Covered (via full suite) |

## Summary Counts

- **Covered:** ~97
- **Partial:** ~21
- **Manual (declared):** ~10

(Counts are approximate row totals across all tables above; see individual
rows for exact status and reasoning.)

## Gaps Found

Criteria below have no automated test today and are not obviously manual-only
(i.e., they plausibly *could* be automated) — candidates for Task 007 Slice 2:

1. **Sibling-field non-interference on insertion** (Task 001 Safe Insertion) - "Only the captured Target Field changes. Instrumented sibling fields retain their exact values and receive no input or change event." No test title asserts this; `apply-text-insertion.test.ts` tests only the target field's own event oracle. Should add an instrumented-sibling-field assertion.
2. **Form submit counter remains zero, no navigation** (Task 001 Safe Insertion / PROJECT SC13) - No test title names a submit-counter or navigation assertion anywhere in the suite.
3. **XSS/HTML-payload literal-insertion test** (Task 001 Safe Insertion) - "A payload containing HTML tags, event-handler attributes, and script text appears literally... creates no element and executes no code." No test title uses such a payload fixture.
4. **Stale DOM node / cloned-node teardown** (Task 001 Matching And Dynamic Pages) - "Removed or cloned nodes cannot retain stale FillNest Target Field or control state." No dedicated test.
5. **Style-isolation / hostile-stylesheet computed-style assertions** (Task 001 Style Isolation) - No test constructs a hostile stylesheet and asserts computed Picker properties survive it, nor asserts host-page sentinel styles/attributes are unchanged before/after mount.
6. **Anchor recomputation on scroll/resize/layout-shift** (Task 001 Style Isolation) - No test recomputes and re-asserts the 12px anchor bounds after a scroll/resize/layout-shift event.
7. **"Exactly one control/marker-set/handler" counts after SPA navigation/DOM reconstruction** (Task 001 Matching And Dynamic Pages, PROJECT SC6) - e2e fixtures exercise dynamic pages but no test explicitly counts DOM nodes/listeners to assert singularity.
8. **No-wildcard-permission-request negative assertion** (Task 001 Permission Lifecycle) - No unit test directly asserts the Enable action's `permissions.request()` call never includes `http://*/*`/`https://*/*`/`<all_urls>`; only positive-path e2e evidence exists.
9. **"No persisted boolean substitutes for Chrome permission state"** (Task 001 Permission Lifecycle) - An architectural invariant with no direct negative test (e.g., asserting no such flag is read as an authority source).
10. **Missed-notification convergence on reconnect** (Task 002 Failure And Synchronization) - "A surface that misses a notification because it was suspended converges on its next open, focus, visibility, or reconnect snapshot." No test simulates a suspended/missed-broadcast surface and asserts convergence on next open.
11. **Accessible names/keyboard order across all four surfaces together** (Task 002 Layout/Accessibility) - Partial coverage exists per-surface (Picker keyboard nav, Popup roles) but no single test asserts accessible names and keyboard order uniformly across Popup + Page Status Control + Side Panel nav + Picker.
12. **Host-style immutability beyond Task 001 markers** (Task 002 Layout/Accessibility) - "FillNest changes no host element style or attributes beyond Task 001's accepted markers." No dedicated before/after DOM-attribute-diff test.
13. **Viewport-width usability at 360/420/600px** (Task 003) - No test parametrizes Side Panel width and asserts no horizontal scroll/clipping at those exact widths.
14. **Location-tree count non-inflation with multiple descendant Bindings** (Task 003) - No test title explicitly creates one Template with multiple descendant Bindings and asserts the tree count stays at 1.
15. **Adaptive tree expansion at scale (non-overwhelming large libraries)** (Task 003) - No dedicated test; `library-views.test.ts` tests correctness at 0/1/10 Templates but not tree-expansion behavior at "at least one hundred" Templates.
16. **Picker row fixed-height/two-line clamp/no-overflow and full-text-flyout viewport containment** (Task 003) - Layout assertions with no test coverage found.
17. **Row actions reject synthetic host-page activation** (Task 003) - No test simulates a synthetic (non-trusted) click/dispatch on a row action and asserts it's ignored.
18. **"Every entire-library-emptying path requires typed delete"** (Task 004) - Only the Settings "Delete all templates" path is tested; other paths that could functionally empty the library (e.g., selecting literally all Templates in a multi-select delete) aren't tested for requiring the same typed-`delete` gate.
19. **Current-tab-pinning crash safety when last origin of the pinned Site is revoked** (Task 004 Addendum) - The pinning feature and the revoked-Site-rendering feature are each tested separately, but not their intersection (crash safety when both conditions hold simultaneously).
20. **`siteAffinities` byte-exact preservation on last-access revocation** (Task 004 Addendum) - Existing test confirms Templates remain visible/intact but does not explicitly diff `siteAffinities` before/after.
21. **Older-supported-Archive-version successful round-trip** (Task 006) - Rejection of unsupported/newer versions is tested; a positive round-trip test for an older *still-supported* schema version is not evidenced.
22. **"Unreachable pages reported as needing reload" after Restore** (Task 006) - The e2e restore flow tests full reconciliation but not the specific case of a page the extension cannot reach, needing a reload notice.

Declared **manual-only** checks (not gaps - inherently resist automation):
process/tooling checks (`npm ci`, documented command execution), the client-content
audit (SC16), the 12px-threshold-is-not-frozen policy statement, and any
requirement whose evidence is fundamentally a human visual/textual judgment
call not yet backed by a named test.
