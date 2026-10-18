# FillNest Project Foundation

## Project Purpose

FillNest is a local-first Chrome Extension that places user-created plain-text templates next to supported web input fields, so users can reuse text where they type while retaining control over every insertion and binding.

## Problem

Users often repeat similar text across web forms. Whole-form autofill can be too broad, while shortcut-based text expanders require memorized commands and do not retain field context. FillNest provides a quiet, field-aware template workflow without automatic page filling, silent replacement, or submission.

## Target User

People who repeatedly enter similar long-form or contact-like text across multiple websites and want templates organized around the fields where they are used.

## V1 Validation Goal

V1 is a usable validation MVP for sustained local use. It must prove that field-aware templates remain reliable on static pages, conditional forms, and single-page applications. V1 is not required to be Chrome Web Store-ready or commercially complete.

## Product Principles

- The user explicitly authorizes the current Permission Origin through its Permission Host Pattern.
- Website Access, Global Activation, and Origin Activation are separate controls; pausing FillNest never silently revokes Chrome permission or deletes local data.
- The user explicitly chooses every insertion. A Binding is confirmed either by an explicit `Bind` action for an existing Template or by saving a new Template from the current Target Field.
- Default UI is quiet and contextual rather than a global list shown everywhere.
- FillNest does not recommend Templates before the user searches.
- Uncertain field recognition fails closed and treats the field as new.
- Local-first storage does not imply that FillNest knows or guarantees the sensitivity of user-authored template content.

## V1 Product Scope

- Explicit origin-by-origin Website Access through the Extension Popup.
- Remembered Global Activation and per-Permission-Origin Active or Pause controls.
- A persistent page-level status control on authorized origins while FillNest is globally Active.
- A Chrome Side Panel with real Overview, Templates, Sites, and Settings pages as the primary management surface.
- Supported-field detection on static pages, conditional forms, and SPAs.
- A FillNest control shown when a supported field receives focus; the Picker opens only after the user activates that control.
- Inline creation, search, insertion, binding, unbinding, and contextual management.
- A global local Template Library organized by location, Global status, and searchable Template body. User Tags are deferred until there is evidence that users need an extra manual organization layer.
- Many-to-many relationships between Templates and logical fields.
- Conservative same-site Page Profile and Field Profile recognition.
- Deliberate, full-library Inline Picker Search with no Site-scoped mode, with query-matching current-Field Templates first.
- Local Backup Archive export and restore.
- Website permission and website-data management.

## Core Interaction Behaviour

- The field that opens the Inline Picker becomes the Target Field for that interaction.
- Field focus shows the FillNest control but does not open the Inline Picker automatically.
- Activating the control captures the Target Field and opens the Inline Picker; later `activeElement` changes inside the Picker do not retarget insertion.
- Selecting a Template inserts plain text at the cursor or replaces only the user's current text selection.
- While the Picker is open, FillNest preserves both the captured selection semantics and a visible representation of the user's non-empty text selection even when focus moves into Picker controls. The representation must not change field content or retarget insertion and must disappear when the interaction ends.
- V1 does not provide whole-field replacement. Users delete existing field content themselves when required.
- After insertion, the Inline Picker closes and focus remains on or returns to the Target Field.
- `Bind` creates a Binding without inserting content and leaves the Inline Picker open.
- Successfully saving a new Template from a Target Field atomically creates its initial Binding to that field, inserts nothing, and leaves the Inline Picker open with a clear bound state. The user may Unbind it later.
- A recognized field initially shows only its bound Templates.
- An unrecognized field initially shows an empty state with explicit Create and Search actions.
- Entering a non-empty Search query exposes matching Templates from the complete local Template Library while keeping query-matching current-Field bound Templates first. V1 has no Site-scoped Search mode or `Search all templates` disclosure.
- Search is deliberate literal body Search: it trims outer query whitespace and matches case-insensitive substrings without semantic inference or guessed suggestions.
- A new Template editor starts blank. The extension reads the Target Field only after the user explicitly chooses `Use field content`.

## Domain Model

### Template

- A global local record containing required plain-text content.
- Has no required title, category, description, color, or shortcut in V1.
- Does not expose User Tags in the default Task 003 UI. User Tags are deferred until there is evidence that users need an extra manual organization layer.
- Uses its first non-empty line as a derived display preview; the preview is not stored as a title.

### Binding

- A user-confirmed relationship between one Template and one Field Profile in one Page Profile.
- Saving a new Template from a Target Field confirms and creates its initial Binding by default; an existing Template still requires an explicit `Bind` action.
- A Template can have many Bindings, and a Field Profile can have many bound Templates.
- Cross-site use requires either explicit Search and explicit Bind, or an
  explicit `Link templates` confirmation under Task 024. Neither path creates
  a relationship automatically.

### Site Affinity

- A soft default-visibility association between a Template and a registrable/main-domain Site.
- Is visually tag-like but remains distinct from descriptive User Tags.
- Is added when a Template is created from a site and when it is bound on a new site.
- May contain multiple Sites.
- No Site Affinity means the Template is Global.
- Does not provide security isolation; deliberate Search can find any Template.
- Is not derived only from current Bindings: ordinary Unbind and field-scoped copy preserve the original Template's Site Affinity. Explicit Site removal operations may remove or transfer the selected Site Affinity according to their impact preview.

### Field Recognition And Discovery

- Field Eligibility first determines whether a control is genuinely intended for user-authored plain text rather than a sensitive, special-purpose, or externally controlled value.
- Field Eligibility uses ordered evidence and high-confidence vetoes; native `type="text"` alone is not conclusive because scripts can enhance a text input into a date picker or another semantic widget.
- A text-like control remains eligible when no high-confidence veto exists; weak or missing metadata alone does not exclude it.
- Veto rules must be generic and evidence-based rather than tied to one website, label, field name, CSS class, or widget library. Representative positive, negative, and ambiguous fixtures must guard against overfitting.
- Field Match Confidence is strictly two-state in V1: reliably recognized or unrecognized.
- A user-confirmed Create or Bind may establish an opaque canonical-path fingerprint for a deep page whose readable path cannot safely be retained. The fingerprint normalizes standard tracking parameters away, is stored only as an opaque local identifier, and is used only for exact same-page Field Match.
- Reliable same-site recognition restores Bindings.
- An unrecognized field inherits no Bindings.
- Template discovery is deliberate Search only and never proves field identity or creates a Binding.
- Template content is not classified for recommendation in V1.
- Other text Templates remain searchable through literal body Search.

## Dynamic Page Behaviour

- FillNest automatically handles supported fields added after initial page load.
- FillNest automatically handles SPA navigation and DOM replacement without requiring a manual rescan.
- Different record IDs may belong to the same logical Page Profile only after
  an explicit user confirmation of same-Origin Route Pattern and local semantic
  evidence. Future reuse remains guarded by that Route Pattern and the same
  semantic thresholds; it never follows from a route match alone.
- For accepted Logical Page Matching, FillNest may locally process eligible
  Field labels, names, and group text, but persists only Site-specific keyed
  hashes rather than raw text. Record-specific values, customer data, field
  values, raw text, selectors, DOM paths, and complete DOM structure must not
  become persistent page identity evidence.
- Scanning, listeners, and UI injection must be idempotent.
- Dynamically created fields use the same recognition and safe-fallback rules as initial fields.

## UI Responsibilities

- Inline Picker: create, search, insert, bind, and perform contextual Template or field actions.
- Extension Popup: control Global Activation, show the full current Permission Origin, request Website Access, control current Origin Activation, and open FillNest management.
- Page Status Control: show and toggle Active or Pause for the current authorized Permission Origin while Global Activation is Active; it does not open a menu or remove Website Access.
- Side Panel: provide the primary Overview, Templates, Sites, and Settings management pages without requiring Website Access for the active page. Overview also shows the current tab's full Permission Origin and Website Access status, and offers the same explicit request-Website-Access action the Popup offers, updating live as the user switches tabs.
- Everyday UI prioritizes Insert and Bind. Destructive or uncommon actions use progressive disclosure.

### Activation Behaviour

- A new installation starts with Global Activation Paused.
- An upgrade from the Task 001 data model preserves existing behaviour by migrating Global Activation to Active and every already-authorized Permission Origin to Active without requesting new access.
- Granting Website Access activates that Permission Origin by default. A user can later Pause it without revoking access.
- Global Pause hides and stops all page-level FillNest UI and behaviour while preserving Website Access, Origin Activation preferences, and business data.
- Origin Pause stops field recognition, field markers, Field Picker controls, Inline Pickers, and field-level behaviour for that Permission Origin across its open tabs while preserving the single gray Page Status Control needed to reactivate it. The paused state and lightweight control survive reload, browser restart, and service-worker restart.
- Global Pause removes every FillNest page surface, including the Page Status Control. It may leave an authorized origin's lightweight content-script registration in place so a later Global Active transition can restore the correct accepted UI without requesting Website Access again.
- External Chrome permission revocation clears Origin Activation for that Permission Origin, unregisters its dynamic script, and immediately tears down its existing page UI without deleting business data. The explicit Sites-page `Remove site` operation is different: it deliberately clears the reviewed Site Data and Site Affinity before removing the selected Website Access, with rollback if permission removal fails.
- An unauthorized Permission Origin exposes no page control, Inline Picker, or Page Status Control. Access is requested only from an explicit user action on the Extension Popup or the Side Panel Overview page - both surfaces request access through the same underlying implementation, never a duplicated one.

### Side Panel Information Architecture

- `Overview` contains common status and controls.
- `Templates` begins as a real searchable view of stored Templates and later owns complete Template organization and management.
- `Sites` begins as a real view of Sites, Permission Origins, Website Access, and Origin Activation and later owns access and Site mapping cleanup. It does not delete Templates.
- `Settings` contains real implemented settings; Backup and Restore live under `Settings > Data` when Task 006 implements them.
- User, account, plan, and quota pages are not shown in V1. Navigation may remain structurally extensible without placeholder pages, settings, schema, or product copy.
- Only implemented destinations appear in navigation.

## Edit And Delete Behaviour

- `Unbind` removes one Binding for a Field's own direct Binding. For a Shared Template Set Slot the same row action reads `Remove from this field`, because it records that Field's Exclusion of the Slot rather than deleting anything the other members rely on.
- `Forget this field` is deferred from the default V1 UI and may return later as an advanced cleanup or debugging feature.
- Ordinary `Delete template everywhere` removes a Template and all of its Bindings immediately, then exposes Undo. A bulk operation whose final outcome removes the entire Template Library additionally requires exact typed `delete`.
- Template edit scope is calculated from **actual effective consumers** - direct
  Bindings, Shared Template Set Slots, and per-Field Overrides - and never from
  the number of Site Affinities. A Template accumulates Site Affinity history
  independently of how many Fields actually use it. (Corrected 2026-09-07: this
  document previously said "multiple Bindings or Site Affinities", which Task
  026 removed as a contract violation and pinned with a regression test.)
- The Save choices a Template edit offers depend on that scope and on the
  Current Field's own relationship to the Template:
  - `Save everywhere` - the Template itself changes, for every relationship
    that uses it. Offered alone when the Current Field has no relationship
    narrow enough to split, and named `Save` when only one consumer exists.
  - `Save a copy here` - for a Field's own direct Binding. Creates a new
    Template for that Field only, moves that Field's Binding to the copy, gives
    the copy only the current Site Affinity, and starts the copy's Template and
    Binding usage at `0`.
  - `Save for shared fields` - for a Shared Template Set member editing a Slot
    it inherits. Changes that Slot's base Template for the whole Set, keeping
    the Slot's identity so every member Override and Exclusion survives.
  - `Save for this field` - for a Shared Template Set member. Creates that
    Field's own Override of the Slot, leaving every other member on the base.
  - `Share with the Set` - not a Save. It is the confirmation for
    `Share this version`, which broadens a Field-only relationship's audience
    and changes no content.
- Website management separates Website Access from Template deletion. `Remove site` deliberately removes reviewed Site Data and Site Affinity together with Website Access, but never deletes a Template automatically; a Template that loses its last affinity becomes Global and may be explicitly deleted afterward.
- Batch global deletion uses a separate danger flow and displays cross-site impact. It requires the user to type `delete` when it would empty the Template Library.

### Template Organization

- The Template Library provides `By location`, `Global`, and `All templates` views.
- `By location` is a Binding-based tree of Site, Page Profile, Field Profile, and bound Templates. Global Templates do not appear in this tree.
- System Display Labels use privacy-safe stable evidence. Optional User Aliases improve recognition but never affect identity or matching.
- `All templates` lists every Template once and supports body Search, Site Affinity, Global, Bound or Unbound filters, and system sorts. User Tags are deferred.
- Default Template ordering is successful insertion count descending, then Template Preview alphabetically, then stable Template ID.
- A Field's Template order remains automatic until the user manually reorders that Field's Templates. After manual reorder, that Field's order is user-maintained; other Fields that were never manually reordered continue using automatic usage count plus Template Preview ordering.
- Successful insertion increments the Template's total usage count and, when insertion came through a Binding, that Binding's usage count. Search-only unbound insertion increments only the Template total.
- Inline Picker Template rows reveal Edit, contextual Bind or Unbind, and Delete actions on pointer hover or keyboard focus without changing row layout or hiding the entire Template Preview. Delete remains visually separated from ordinary actions but still belongs to the row.
- Picker Undo is a field-scoped single-last-action safety mechanism for key Template operations. It is not a persistent history and fails closed when later data changes conflict.
- Picker Keep Open keeps the menu visible, allows header dragging, persists one global floating position, and does not change ordinary field-near Picker placement when Keep Open is off.
- New Bindings can be created only from an Inline Picker with a valid Target Field. Management views may remove existing Bindings but cannot bind to a remembered or inferred field.

### Site Management

- The Sites page groups exact Permission Origins under their registrable Site while preserving independent access and activation controls for every origin.
- Everyday actions are Active or Pause and Remove site.
- Clearing Site data deletes the selected Page Profiles, Field Profiles, Bindings, System Display Labels, and User Aliases, and removes that Site from every affected Template's Site Affinity while preserving Template records and Website Access.
- The Sites page never deletes Templates implicitly. Clear Site data may offer the ordinary deletion flow for the exact Templates newly made Global; Site Affinity remains unchanged when Website Access alone is revoked.
- Template deletion by Site is performed from the Templates page through its Site filter and ordinary Template deletion rules.
- Typed `delete` guards a **bulk** operation whose final result deletes the
  entire Template Library, regardless of entry point. Deleting a single
  Template is a targeted deletion and never requires typing `delete`,
  including when it is the last remaining Template; Undo is its safety net,
  as it already is for the row-level and Inline Picker Delete actions.
  Partial single or batch deletion likewise uses confirmation but never typed
  `delete`. (Amended 2026-09-06 by Task 028 Addendum B: requiring a typed word
  to delete your only Template is disproportionate, and the previous rule made
  single deletion behave differently depending on the surface used.)

## Backup And Future Sharing

- A V1 Backup Archive is a versioned UTF-8 JSON export containing the complete local business dataset, durable user preferences, Global Activation, and per-Permission-Origin Activation preferences required to restore one user's FillNest state. Its format discriminator and Archive version are authoritative; the source application version is informational only.
- Chrome-granted Website Access, Permission Host Patterns as authorization, rebuildable indexes/caches, ephemeral UI state, and browser profile data are excluded.
- Repository storage schemas and the Backup Archive schema evolve independently. Extension upgrades migrate stored data to the current canonical schema; new exports always use the current Archive version; Restore accepts only the current version and older versions with explicit sequential migrations.
- Restore is complete replacement, not merge Import. It strictly validates the complete migrated Archive, its IDs, uniqueness constraints, safety limits, and relationships before showing a category-by-category impact summary.
- When current data is non-empty, Restore prominently recommends exporting a current backup before replacement but does not require an export or download action. Confirmation remains bound to the previewed current dataset revision, and exact typed `restore` remains mandatory, so intervening mutations fail closed.
- Restore replaces business data, durable preferences, and Activation preferences as one serialized all-or-nothing operation. Failed validation, stale confirmation, persistence failure, or interrupted commit preserves or recovers the prior complete state.
- Restored Activation applies immediately where Chrome Website Access already exists. An Origin preference without matching permission remains dormant, and Restore never grants or requests permission.
- A future Import flow is separate from Restore. The current architecture may separate decoding, migration, validation, preview, and commit for present correctness, but V1 adds no unused Import API, merge policy, conflict resolver, or placeholder UI.
- A future Template Share Package is distinct from a Backup Archive and will contain only explicitly selected shareable Template data.

## Post-MVP Release Path

This is the accepted product sequencing after V1. A version heading does not authorize implementation: each substantial body of work still requires its own accepted Task Contract and evidence gate.

| Version | Release purpose | Planned scope |
| --- | --- | --- |
| `0.1.1` | MVP closure | Record final hands-on acceptance and the stable post-MVP baseline. |
| `0.1.2` | Pre-Beta usability and compatibility | Interaction feedback consistency; Side Panel header and notification region; Sites/Templates information architecture; generic form compatibility learning; the eligibility and lifecycle contract, its fixture matrix, improvement and acceptance; Logical Page Identity and its implementation; Shared Template Sets, their controlled cross-Site linking, per-Field Overrides and Exclusions, and explicit Template audience scope; cross-surface accessibility hardening and the modal-dialog repair; current-state documentation alignment; and recovery and destructive-operation boundary hardening. `tasks/README.md` maps each theme to its contract. The one unstarted `0.1.2` candidate is complex-control support: `contenteditable` or combobox support must not block Beta if its separate safety contract cannot be accepted. |
| `0.2.0` | Chrome Web Store Beta | Final release identity and assets, Store listing, privacy disclosures, permission justifications, release-candidate regression, and private tester distribution. |
| `0.2.1` | Product capability expansion | Shared Conversation Prompt Field; Contacts and confirmed multi-field fill; Parameterized Templates; Template Share Packages and Import; and advanced organization capabilities. |
| `1.0.0` | Account platform | Accounts, sync, encryption, recovery, and any related team or commercial platform capability, subject to a new architecture and privacy baseline. |
| `2.0.0` | Agent-assisted form completion | A separately designed and reviewed Agent-Assisted Form Completion Bridge, including its external-data, consent, security, and explicit-application model. |

The next authorized product-development gate is `0.1.2`, not Chrome Web Store Beta. The detailed candidate list and unresolved decisions remain in `docs/next-version-discussion.md`.

A release row records what a release contains, not a ceiling on what it may
contain. Scope control lives in each Task Contract and its acceptance gate,
which is where it has actually operated. This was made explicit on 2026-09-07,
after the whole-extension audit found `0.1.2` described by five themes here
while `tasks/README.md` listed eighteen accepted contracts under it; the owner
confirmed the scope had legitimately expanded and that this document had simply
failed to track it.

## Approved Technical Baseline

- Chrome Extension Manifest V3.
- TypeScript.
- npm with `package-lock.json`.
- Vite with explicit extension entry points.
- Preact for Inline Picker, Extension Popup, and extension-page UI.
- An extension-owned Shadow Root for Inline Picker style isolation.
- `chrome.storage.local` behind a Repository interface.
- `schemaVersion` from the first persisted format.
- A service worker for Permissions, Repository access, and durable business operations.
- Content scripts for page recognition, Target Field tracking, and safe DOM insertion.
- Exact-origin dynamic content-script registration for authorized reload and return behaviour, with programmatic injection only for immediate activation of the already-open page.
- Typed messages between extension contexts.
- `tldts-icann` for offline registrable-domain Site identity using the ICANN Public Suffix List.
- Vitest for fast logic, contract, and component tests.
- Playwright with real Chromium for built-extension behaviour.

## Selected But Unimplemented Direction

- Chrome's Side Panel is the selected primary management direction and ADR 0002 records the trade-off.
- Task 002 proposes adding the `sidePanel` manifest capability, setting `minimum_chrome_version` to `116`, and removing the legacy Options Page.
- This direction is not part of the Approved Technical Baseline until Task 002 implementation is separately authorized, completed, and supported by current build and browser evidence.
- If Task 002 evidence cannot support this direction as written, work stops for user review rather than silently retaining two management surfaces or adding a fallback.

## Constraints

- Keep V1 local-only and functional without a backend or network requests.
- Do not include remote code.
- Do not request `<all_urls>` at install time.
- Use optional origin-specific host permissions requested from a user gesture.
- Treat Chrome's Permissions API as the authority for granted website access.
- Keep the product Site, current Permission Origin, Chrome Permission Host Pattern, and local Fixture Origin as separate concepts.
- Use `permissions.request()`, `permissions.contains()`, and `permissions.remove()` for explicit Website Access grant, status, and removal. Active or Pause is a separate FillNest state and must not masquerade as permission removal.
- Treat `permissions.onRemoved` as an immediate revocation signal whether access was removed through FillNest or Chrome settings; unregister affected dynamic scripts and tear down FillNest in every already-injected affected tab.
- Register content scripts dynamically only for exact granted Permission Host Patterns; do not use broad static `content_scripts.matches`.
- Support a conservative allowlist of text-like inputs and `textarea` elements.
- Determine Field Eligibility from ordered native, semantic, structural, and controller evidence; high-confidence sensitive or special-purpose evidence vetoes generic text-like evidence.
- Default text-like controls to eligible when no high-confidence veto is present.
- Exclude password, payment, one-time-code, hidden, disabled, read-only, and other sensitive or unsupported fields.
- Host-page scripts cannot substitute synthetic events for the user's explicit Picker actions; action handlers accept only trusted browser events.
- Page identity excludes opaque query data and fails closed when route structure may contain non-numeric record slugs or customer-like data.
- Do not read existing field values except after the explicit `Use field content` action or after the user opens the Picker with a non-empty selection, when a transient non-persisted read may render the required selection representation.
- Treat Template content as plain text; never insert HTML or execute scripts from it.
- Never fill a whole page, replace an entire field automatically, or submit a form.
- Dispatch compatible native input events after insertion when required.
- Keep persistent business data behind Repository and validation boundaries.
- Serialize service-worker Repository mutations so concurrently accepted operations cannot overwrite one another.
- Keep extension UI isolated from host-page styles.
- **Picker isolation rule.** The Inline Picker's Shadow Roots ship `closed`. A
  host page must not be able to read what the Picker displays: it renders
  Template content, and Search is deliberately full-library and cross-Site, so
  an open root lets a page read Templates belonging to other Sites. FillNest
  does *not* claim to hide its presence - `data-fillnest-extension-active` and
  the control's host element remain visible to the page by design. The mode is
  fixed at build time, `scripts/verify-build.mjs` fails any production build
  that is not closed, and one E2E test runs against the shipped artifact to
  prove both that the page cannot reach the Picker and that the Picker still
  works.
- Keep all persistent project content in English.

## V1 Non-Goals

- Backend services or network-dependent features.
- User accounts, sync, team sharing, subscriptions, payments, plan enforcement, or quotas.
- AI, model APIs, embeddings, semantic search, or vector storage.
- Structured Contact records or multi-field Contact filling.
- Automatic cross-site Binding.
- Whole-page autofill, automatic submission, or automatic whole-field replacement.
- `iframe`, page Shadow DOM, or `contenteditable` support.
- client-specific selectors, terminology, matching rules, host permissions, or tests.
- Chrome Web Store release readiness.
- Full localization behaviour.

## Success Criteria

- Users can explicitly grant or remove Website Access for the current Permission Origin through its Permission Host Pattern and independently set Global and Origin Active or Pause; a product Site remains a separate data-grouping concept.
- Revoking a Permission Host Pattern removes FillNest page UI and stops FillNest behaviour for the affected page without deleting local Site data.
- External revocation through Chrome settings stops FillNest immediately in all already-open tabs for the affected Permission Host Pattern without requiring reload.
- Reloading or returning to an authorized, Origin-Active Permission Origin while Global Activation is Active restores FillNest without reopening the Popup or requesting permission again; an Origin-Paused reload restores only the gray Page Status Control.
- Supported static, conditional, and SPA-created fields work without manual rescanning.
- Controls and listeners are not duplicated after DOM reconstruction or navigation.
- Users can create, edit, delete, search, bind, unbind, and insert Templates.
- Cursor insertion and selected-text replacement preserve surrounding user content.
- Reliable same-site returning matches restore bound Templates.
- Unrecognized fields inherit no Bindings.
- When a user explicitly Create/Binds a Template, FillNest may persist that Field's observed title for local management display only. The title priority is associated `label`, `aria-label`, `placeholder`, `name`, then `id`; it never participates in identity, matching, recommendation, or insertion. Field nodes in `This tab` and `By location` retain DOM order regardless of observed title or User Alias edits.
- Search does not confuse global availability, Site Affinity, or Field Match.
- Eligibility classification may inspect element type and safety metadata, but excluded sensitive or unsupported fields receive no value read, fingerprint, Field Profile, extension marker, per-field listener, control, Picker, or fill.
- Forms are never automatically submitted.
- Backup Archives can be validated, exported, and restored without partial corruption.
- The built extension initiates no HTTP, HTTPS, WebSocket, or EventSource requests and includes no remote code; test-runner navigation to a local Fixture Origin is not extension-originated traffic.
- The codebase and test fixtures contain no client-specific content.

## Confirmed Decisions

- The working product name is FillNest.
- FillNest is an independent, industry-neutral project.
- V1 is a usable validation MVP, not a public commercial release.
- The approved technical baseline is listed above.
- The rationale and trade-offs for the approved baseline are recorded in `docs/adr/0001-engineering-baseline.md`.
- DEVELOPMENT.md is the single current project-status document.
- The earlier prototype may be inspected as technical evidence, but FillNest must reimplement generic behaviour independently.
- The earlier prototype UI evidence may inform generic layout, state, accessibility, progressive-disclosure, and keyboard patterns. Every adopted pattern must be mapped to a FillNest behaviour and test; injected panels, product-specific selectors, schemas, and terminology are not transferable.

## Delivery Roadmap

1. **Task 001 - Engineering Initialization And Technical Discovery**: complete and accepted.
2. **Task 002 - Interaction Surfaces And Navigation**: establish activation state, Popup, Page Status Control, Side Panel foundation, basic real pages, and adaptable icon and layout seams.
3. **Task 003 - Template Library And Organization**: deliver location-based Library views, safe labels and aliases, usage ordering, field-scoped Edit and copy, Undo, Keep Open formalization, Unbind, and deletion safety.
4. **Task 004 - Site Access And Data Management**: deliver Site and Permission Origin grouping, access removal, multi-select operations, and impact-aware Site Data cleanup.
5. **Task 005 - Template Discovery And Search**: complete deliberate Inline Picker Search, current-Field-first ordering, and Site Affinity visibility without recommendation or automatic Binding.
6. **Task 006 - Backup, Restore And Data Portability**: first split the Side Panel along existing page boundaries without behaviour change, add the canonical Repository candidate-state integrity gate, then implement validated versioned local Backup Archives and atomic replacement Restore under `Settings > Data`.
7. **Task 007 - V1 Integrated Acceptance And Hardening**: validate the complete V1 across permissions, static and dynamic pages, privacy, storage, UI, and production counterexamples.
8. **Task 008 - Architecture Maintenance Wave One**: preserve V1 behaviour while removing superseded internal paths and tightening first-wave message, authorization, and shared-rule boundaries.

Each Task has an independent contract and evidence gate. Acceptance of this roadmap does not authorize implementation of a Draft Task.

## Assumptions

- A registrable/main-domain grouping will be understandable enough for Site Affinity and Page Profile behaviour while Chrome remains the authority for actual host permissions.
- A focused first vertical slice can validate the technical baseline before full V1 implementation.
- The initial project structure should remain lightweight and add documentation only when it has a clear current purpose.

## Working Hypotheses

- `chrome.storage.local` will fit representative V1 Template, Profile, Binding, and Backup data without requesting `unlimitedStorage`.
- Vite can produce stable Manifest V3 entry points without a dedicated extension framework.
- Service-worker-owned persistence and typed messages will remain reliable across worker suspension and restart.
- URL normalization plus stable, non-record-specific page structure can identify same-site page types conservatively.
- Stable field attributes, labels, structure, and confirmed Binding history can support strict two-state field recognition.
- Deliberate literal Search can remain useful without Template-content recommendation or generalized semantic inference.
- Mutation observation, navigation hooks, focus handling, and idempotent markers can support dynamic pages without broad periodic rescans.
- Native setters and compatible input events can support controlled fields while preserving cursor and selection semantics.
- An extension-owned Shadow Root will isolate the Inline Picker without blocking required positioning and focus behaviour.
- Playwright can provide repeatable built-extension tests for optional permissions, SPA navigation, and dynamic fields.
- V1 can avoid hard-coded Template limits so a future entitlement policy can be added without changing Template identity or persistence, while adding no unused plan or quota API now.

## Deferred Decisions

- Detailed Field Eligibility signals, evidence priorities, veto rules, and fallback diagnostics.
- Detailed field-matching signals, thresholds, and fallback diagnostics beyond strict two-state behaviour.
- Search query ranking and weighting beyond the confirmed visibility rules.
- Advanced Template metadata such as title, category, description, and color.
- Optional `Bind and insert` and automatic editor prefill settings.
- Selected multi-site affinity management beyond automatic affinity creation.
- Commercial plans, quotas, accounts, payments, and entitlement infrastructure.
- Template Share Packages.
- Structured Contacts and user-confirmed multi-field filling.
- Cloud sync, encryption, and key recovery.
- Final Chrome Web Store name, domain, trademark review, and release readiness.
- Final Toolbar, Page Status Control, and Field Picker icon artwork. Each surface has an independent replaceable local asset boundary; V1 does not add an icon-customization setting.
- User-configurable Page Status Control position, dragging, and size.
- Advanced settings and any future User page.
- Shortcuts, favorites, recent Templates, and semantic or AI-assisted features.
