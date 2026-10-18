# Task Contract

## Task ID And Name

Task 003 - Template Library And Organization

## Background

Task 002 completed the activation and navigation foundation and, by explicit user direction, also delivered early pieces of Template row management: Inline Picker global search, icon row actions, and Picker/Side Panel Edit and Delete seams. Those early changes are accepted as existing implementation input, but they do not complete the Template Library.

Task 003 now owns the remaining Template organization and safety layer: location-based library structure, Global and All Templates views, deterministic ordering, usage accounting, safe labels and aliases, field-scoped edit/copy decisions, Undo, refined Picker keyboard and floating behaviour, and destructive-operation boundaries.

## Goal

Deliver a complete local Template Library experience across the Side Panel and Inline Picker without adding category/tag burden: `By location`, `Global`, and `All templates` views; privacy-safe labels and optional aliases; usage-based ordering; field-scoped edit/copy; contextual Bind or Unbind; Delete everywhere with immediate Undo; batch deletion; and entire-library deletion protection.

## User Value

Users can find Templates by the website, page, and field where they remember using them; keep Global Templates separate from location-bound Templates; edit shared content intentionally; undo dangerous changes; disconnect a Template from one field without deleting it; and understand high-impact deletion before permanently removing the whole library.

## Stable Product Decisions

### Scope Relative To Task 002

- Task 003 is rewritten around the remaining scope rather than redoing Task 002.
- Existing Task 002 deviations for Picker and Side Panel Edit/Delete row actions are treated as implementation input that must be reviewed, corrected, and formalized in this Task.
- The 2026-08-16 audit found further uncommitted `src/` changes beyond the committed Task 002 deviation (Picker keyboard selection, a Pin/Keep Open control, and a partial Undo/restore mechanism) sitting in the working tree while this contract is Draft. This code is **not** authorized implementation input and must not be used to infer that any Task 003 slice is authorized; per the handoff guide's authorization stop rule, a later commit or a detailed implementation must never define the contract retroactively. Its concrete conflicts with this contract were recorded in `DEVELOPMENT.md` under "Task 003 Pre-Contract Implementation Conflicts" and reviewed item-by-item with the user (2026-08-16), who explicitly directed fixing 11 of them (plus accepting one, the keyboard focus model, as-is); that bounded, explicitly-authorized remediation has since been applied to the same code. This still does **not** constitute Task 003 slice authorization: the code remains uncommitted, has no automated coverage for its Keep Open-specific behaviour, still lacks the revision-based Undo invalidation mechanics this contract requires, and was never formally delivered as a reviewed vertical slice. No Task 003 slice may be treated as started until the user separately authorizes one.
- Task 003 does not authorize Task 004 Site Data cleanup, Task 005 relevance, Task 006 Backup/Restore, or any backend/network feature.

### Views And Navigation

- `By location` is a Binding-based tree: Site, Page Profile, Field Profile, then bound Templates.
- A Template may appear in multiple tree locations because it may have multiple Bindings.
- Global Templates never appear in `By location`.
- The `Global only` filter (in `All templates`) narrows the list to Templates with no Site Affinity, plus any Template that currently has no live Bindings at all even if it still carries a Site Affinity left over from before it was unbound. (Revised 2026-08-17: this was originally its own `Global` tab; see "Selected Side Panel Design Direction" above. Broadened the same day, also at the user's direction, to include the no-live-Bindings case - Site Affinity is not automatically cleared on Unbind, so without this a Template could sit fully unbound yet still be excluded from "available everywhere" filtering. See `DEVELOPMENT.md`'s corresponding dated entry.)
- `All templates` lists every Template exactly once.
- `All templates` supports literal Template body Search, Site Affinity, Global only, Bound or Unbound filters, and system sorts. Task 003 does not implement User Tags UI.
- Task 003 owns Side Panel Template Library Search, filters, sorts, Template mutations, existing Binding removal, aliases, and batch Template deletion.
- Task 003 does not change Inline Picker discovery logic owned by Task 005.
- Inline Picker search ownership is split by kind, not by surface: Task 003 only regression-protects the literal substring matching behaviour the Task 002 deviation already introduced (matching Template body text across the full library once the user types a query, with no ranking beyond the accepted default ordering) so existing tests keep passing while the rest of this contract's Picker formalization (Slice 3) proceeds. Task 005 remains the sole owner of deliberate Inline Picker Search and Site Affinity visibility. Task 003 must not add ranking, ordering changes, or new visibility rules to Picker search beyond this regression protection.
- `All templates` (including when narrowed by the `Global only` filter) does not offer Bind because no valid Target Field exists in the Side Panel.
- `By location` may Unbind an existing Binding but cannot create a new Binding.
- New Bindings are created only from the actual webpage Inline Picker while a valid Target Field is captured.

### Selected Side Panel Design Direction

- The user selected the `Quiet Location Navigator` direction for the Task 003 Side Panel Template Library. The behavioural rules in this contract are the complete design authority; implementation does not depend on an external concept image or pixel-perfect reproduction.
- Task 003 preserves the accepted Task 002 FillNest shell and its Overview, Templates, Sites, and Settings navigation. It does not redesign unrelated destinations.
- `Templates` opens to `All templates` by default. `All templates` and `By location` remain two equally reachable views without adding category or tag navigation. The earlier separate `Global` view is folded into an `All templates` `Global only` filter toggle rather than a standalone tab, so a user narrowing to zero-Site-Affinity Templates and a user narrowing to any other filter combination (Site, Bound/Unbound, Search) use the same composable filter row. (Revised 2026-08-17 at the user's direction; see `DEVELOPMENT.md`'s corresponding dated entry for the full rationale and evidence.)
- `By location` is location-first and optimized for a narrow Chrome Side Panel. Site, Page Profile, and Field Profile nodes form one quiet expandable hierarchy rather than nested cards.
- Site and Page nodes sort alphabetically by their current privacy-safe display label. Template leaves use the accepted Binding-usage ordering unless the user selects another available system sort.
- Field nodes sort by the last safely observed supported-field DOM position, not by their display label or User Alias. The stored `documentOrder` is a non-negative ordinal only; it contains no raw URL, selector, label, or field value. Existing Fields without an observed ordinal retain stable persisted order until the user next binds a Template on that Field, when FillNest records its current page position.
- `This tab` uses the same Field DOM ordering rule as `By location`; neither System Display Labels, Observed Field Titles, nor User Alias edits may reorder Field nodes.
- A visible Search control filters the location tree using literal Template body text, System Display Labels, and User Aliases. Search never uses identity keys, raw URLs, record data, field values, Template Relevance, or inferred semantics.
- Each expanded node may show a count of distinct Template records below that node. The count must not double-count one Template merely because it has multiple descendant Bindings.
- Template rows use a compact two-line Preview with lightweight separators. They do not become individual cards and do not reserve a permanently empty action column. Clicking a row's Preview text toggles it in place to show the full Template content, then back to the two-line Preview on a second click; this never opens a separate overlay or duplicates the content elsewhere on the page. (Added 2026-08-17.)
- Edit and contextual Unbind remain ordinary secondary actions. `Delete template everywhere` stays visually separated as the destructive row action. The Side Panel never presents Bind.
- Page and Field aliases are renamed inline and preserve the user's tree expansion and scroll position after Save or Cancel.
- Side Panel Undo appears as one non-modal bottom feedback bar containing the exact completed operation and one `Undo` action. It must not obscure the active row, navigation, Search, or destructive confirmation controls.
- The selected direction must remain usable without horizontal scrolling or clipped controls at representative Side Panel widths of 360, 420, and 600 CSS pixels.

### Location Tree Defaults

- `By location` defaults to current-page-aware expansion (revised 2026-08-17 at the user's direction, superseding the original library-size-tiered default below, then narrowed the same day from Site-level to Page-level scoping after the Site-level version still read as cluttered; see `DEVELOPMENT.md`'s corresponding dated entries for rationale and evidence): the Site matching the browser's current tab opens (revealing its Page rows), but only the one Page matching the current tab's own page identity (the same derivation content scripts use to recognize a page) opens down to Field level; every sibling Page under that Site, and every other Site, stays collapsed to just its own name. If the current tab matches no known Site, or matches a Site but no specific Page within it (an unrecognized page, a Page with no Bindings, or the tab's URL cannot be read), the tree opens no further than that partial match allows - collapsed to Site names only if nothing matches at all. This default is computed once when the Side Panel's Templates page first loads data; it does not re-run on every tab switch or every live data change while the panel stays open, so as not to override a user's own manual expand/collapse choices made since.
- `By location` tree nodes can be expanded or collapsed by the user at any level, and manual choices are preserved across data refreshes (including a live update landing from another surface) for the remainder of the session.
- Superseded original rule, kept here for history: adaptive expansion previously scaled by total library size alone (small libraries defaulted open to Field level, larger to Page level, very large to Site level, with 20/200 as the tuned thresholds). This produced a fully-expanded tree by default for any small library regardless of relevance, which the user found cluttered; the current-page-aware rule above replaces it.

### Labels And Privacy

- Each Page Profile and Field Profile receives a System Display Label generated from privacy-safe stable evidence.
- A safe route such as `/customers/:record/edit` may display `Customers / Edit`; record IDs, customer-like slugs, opaque query values, field values, and raw page titles are excluded by default.
- A Field Profile uses a stable semantic label when safe and otherwise displays `Text field`.
- When the user explicitly creates or binds a Template, FillNest stores the observed webpage Field title for local display, using associated `label`, `aria-label`, placeholder, name, then id. This deliberate capture may contain page-provided text and is included in local Backup Archives; it is never collected during ordinary focus, never used for Field Match, and is overridden visually by a User Alias.
- Users may assign an optional User Alias to a Page Profile or Field Profile.
- Alias editing uses inline rename on double-click, not a separate detail page. Double-click is one entry point among several, not the only one: a focusable `Rename` action (icon or menu item, reachable by Tab) must also be present on the row, and pressing `Enter` or `F2` while that row or its `Rename` action has focus opens the same inline rename control. All three entry points open identical inline editing behaviour and must be independently reachable without a pointer.
- Saving an empty alias removes the alias and restores the System Display Label.
- System Display Labels and User Aliases never participate in identity, Field Match Confidence, Template Relevance, or Binding resolution.
- Task 003 does not automatically persist full URLs, raw page titles, customer names, field values, or other record-like data for display labels.

### Migration And Storage

- Task 003 increments `schemaVersion` by one over the current Task 002 baseline. Migration runs once, forward-only, inside the existing service-worker-owned Repository migration path, and is idempotent if re-run against already-migrated data.
- Existing Template records receive `totalUsageCount: 0` and existing Binding records receive `usageCount: 0` on migration; this is a neutral starting point and does not imply or synthesize historical usage.
- Existing Page Profile and Field Profile records receive a computed System Display Label on first read after migration (derived the same way a newly created Profile's label would be, from the same privacy-safe stable evidence already stored); no raw data is newly captured to produce it. Migration does not set a User Alias for any existing record; `userAlias` defaults to absent/`null` and is treated exactly like a record that has never had an alias assigned.
- The durable floating Picker position (Keep Open) is a new top-level schema field owned by Task 003, scoped globally (one value, not per-Site or per-Field, matching the "one global user setting" rule above). Legacy data has no prior value, so migration leaves it unset, which FillNest treats as "no saved position" (fall back to ordinary near-field placement until the user drags the Picker once in Keep Open mode).
- The floating position setting is included in Task 006 Backup Archives as ordinary business-data configuration, consistent with `PROJECT.md`'s definition of a Backup Archive as the complete local business dataset required for restore; it is not Chrome-granted permission state and not a rebuildable index or cache.
- Template Preview is explicitly derived, in-memory display data computed from `Template.content` at render/query time. It is never persisted, never migrated, and never included in a Backup Archive as its own field; only the underlying `Template.content` it is derived from is persisted and backed up.
- Undo state itself remains non-persistent and is not part of migration, schema, or Backup, consistent with the existing Undo rules above.

### Preview And Full Text Display

- Template Preview is derived from the first non-empty line after trimming leading whitespace and blank lines.
- Template Preview is not a stored title and does not add title/category/description metadata.
- Picker rows show at most two stable lines and must not overflow, resize unpredictably, or let text collide with action icons.
- Long Template content may show a full-text flyout on pointer hover or keyboard focus.
- The flyout must position itself within the viewport. It may appear right, left, below, or above the Picker depending on available space.
- A known Task 003 bug to fix: when the Picker is kept open/floating, the flyout currently appears to the right of the menu and can be outside the browser viewport.
- Search match highlighting is deferred to a future UI/discovery task and must be recorded as deferred rather than implemented in Task 003.

### Ordering And Usage

- Default Template ordering is successful insertion count descending, then Template Preview alphabetically, then stable Template ID.
- `All templates` uses Template total usage count.
- `This field` and `By location` use Binding usage count for the relevant Field Profile.
- A successful insertion increments the Template's total usage count exactly once.
- If insertion uses a Binding, that Binding's usage count also increments exactly once.
- An unbound Search insertion increments only the Template total.
- Failed, cancelled, blocked, or purely management operations increment nothing.
- Edit changes update `updatedAt` only when Template content actually changes.
- Alternative sorts include alphabetical, created time, updated time, and usage. Each defaults to the conventional direction for that kind (alphabetical ascending A-Z; created time and updated time newest-first descending; usage count descending), and the user can reverse the active sort's direction. Alphabetical comparison uses locale-aware, case-insensitive ordering (`localeCompare` with a fixed `"en"` locale and numeric collation off, matching the English-only content rule) so casing and locale never produce a different order than the same content typed differently. Every sort's complete tie-breaker sequence, applied in order until a difference is found, is: (1) the sort's own key, (2) Template Preview alphabetically (same locale rule), (3) stable Template ID. This matches and extends the default-ordering tie-breaker already defined above so every available sort remains fully deterministic.
- A Field's own Template list is ranked automatically by that Field's Binding usage count descending, then Template Preview alphabetically, then stable Template ID. (Manual reordering was removed on 2026-09-07; see the Automatic Only addendum.)
- There is no user-maintained ordering mode. Every Field is ordered automatically by the rule above. (Removed 2026-09-07.)
- Manual ordering is scoped to one Field Profile. It never changes Template total usage count, Site Affinity, other Fields' Binding order, `All templates` ordering, or `By location` Site/Page/Field node ordering.
- A future explicit `Reset to automatic order` affordance may return a manually ordered Field to automatic ordering, but it is not required unless the UI exposes it. Without that affordance, the user's manual order remains authoritative for that Field.
- Ordinary Unbind deletes the Binding and its field-local usage weight.
- Rebinding the same Template to the same Field creates a new Binding with usage count `0`.
- Template total usage count is not reset by Unbind or Rebind.

### Inline Picker Search And Keyboard Behaviour

- The Inline Picker keeps Search visible in the main list view.
- Search receives focus when the Picker opens.
- `This field` remains the top group and shows Templates already bound to the Target Field.
- `All templates` appears only when the user has entered a non-empty Search query.
- `All templates` shows matching Templates that are not already shown in `This field`.
- Search filters visible content without duplicating the same Template across `This field` and `All templates`.
- A bound Template shows Unbind. An unbound matching Template shows Bind.
- Arrow and Enter behaviour creates a real Picker selection, not page scrolling:
  - the first `ArrowDown` from Search selects the first visible Template row;
  - `ArrowUp` from the first Template row returns to Search;
  - `ArrowDown` from the last Template row stays on the last row;
  - `Enter` inserts the selected Template when a Template row is selected;
  - typing while a Template row is selected returns focus to Search and appends the typed character.
- Focus model: Search is the single DOM-focused control for the row list; Template row "selection" during Arrow navigation is a virtual highlight (`aria-activedescendant` on Search pointing at the highlighted row's ID) rather than moving real DOM focus onto the row, so typing always reaches Search without an extra step. A row remains independently reachable by `Tab` for its own Edit, Bind/Unbind, and Delete actions (see Template Row Actions); when a row has real `Tab` focus rather than virtual highlight, Arrow keys behave as ordinary browser navigation within that row's controls, not list selection, and `Escape` returns focus to Search without closing the Picker.
- Row action keyboard navigation: from a highlighted or `Tab`-focused row, `Tab` cycles through that row's visible actions in a fixed order (Edit, then Bind or Unbind, then Delete); every action is reachable this way without requiring hover.
- IME composition: while an IME composition is active in Search (`isComposing` true, or the key event is the IME's own `Enter`/`229` keycode confirming composition), `Enter` confirms the composition text only and must never insert a Template, even if a row is highlighted. A Template is inserted by `Enter` only after composition has ended.
- Modifier and dead keys: `Enter` combined with `Shift`, `Ctrl`, `Alt`, or `Meta` does not insert a Template (reserved for future shortcuts and to avoid accidental insertion from OS-level key combinations); dead keys and other non-committing key sequences used to compose a character do not trigger Arrow-style row navigation.
- Insert still follows the Task 001/002 rules: plain text only, cursor insertion or selected-text replacement only, no whole-field replacement, no automatic submit.

### Template Row Actions

- Picker and applicable Side Panel rows reveal Edit, contextual Bind or Unbind, and Delete actions on pointer hover and keyboard focus.
- Bind appears only when the Template is not bound to the current Target Field. Unbind appears when it is bound.
- Edit and Delete are always available for a Template when that surface allows Template mutation.
- Delete means `Delete template everywhere`, never "remove from this field".
- If the user wants a Template removed only from one Field, the correct operation is Unbind.
- Row actions must not reflow rows, hide the full Preview permanently, or create layout collision.
- Delete remains visually inside the row but is separated from the ordinary Edit and Bind/Unbind group by clear spacing.
- Every icon has an accessible name, tooltip, visible focus, and a non-hover keyboard path.
- Host-page synthetic events cannot activate Template operations.

### Edit And Copy

- Edit opens inside the Picker when initiated from the Picker and returns to the prior list state on Save or Cancel.
- Edit does not read current field content. Reading current field content remains limited to explicit Template creation.
- Edit starts with the current Template content.
- Saving is disabled when the trimmed content is empty or the content is unchanged.
- Editing a Template with one Binding may save directly to the Template.
- Editing a Template with multiple Bindings or multiple Site Affinities offers explicit choices:
  - `Save everywhere`;
  - `Save a copy for this field` — Picker-only, because it requires a live captured Target Field to attach the new copy's Binding to. The Side Panel has no Target Field (Side Panel Bind is out of scope by the "Views And Navigation" rules above), so Side Panel Edit offers only `Save everywhere` regardless of Binding or Site Affinity count. A future Binding-selection workflow could let the Side Panel choose which existing Binding to move to a copy, but that is not part of Task 003 and is not implied by this contract.
- The user-facing copy may be refined, but it must preserve the same meaning: one action changes the original everywhere, and the other (Picker-only) creates a field-local copy.
- `Save everywhere` updates the original Template content everywhere it is bound.
- `Save a copy for this field` creates a new Template from the edited content, moves only the current Field's Binding to the new Template, and leaves every other Binding on the original.
- The new field copy receives only the current Field's Site Affinity.
- The original Template does not automatically lose Site Affinity when a field-level copy is created.
- New copy Template usage count and new Binding usage count both start at `0`.
- Edit never inserts content and never creates an inferred Binding.

**Post-acceptance Shared Template Set edit correction (2026-09-04).** The
Picker determines edit choices from effective relationships, not raw storage
rows. A direct Binding belonging to a Shared Template Set member is dormant
and does not count as a use while that membership exists. A Template found by
Search but not currently effective for the Target Field cannot offer a local
copy because there is no current relationship to split; it offers only `Save
everywhere`. When the Target Field belongs to a Shared Template Set, the
Picker's scoped alternative is `Save a copy for shared fields`: it creates one
new Template and replaces that Set's Shared Binding at the same order, so every
member receives the copy while all other effective users remain on the
original. The new Template carries the member Sites' affinities; its Template
and Shared Binding usage counts start at zero. Dormant direct Bindings remain
untouched. Undo deletes the unchanged copy and restores the original Shared
Binding, and fails closed after any later copy edit, use, Bind, or other
relationship change.

Template deletion and usage accounting follow the same effective-relationship
rule. Delete removes and Undo restores both direct Bindings and Shared
Bindings. Inserting through a Shared member increments the Template and the
effective Shared Binding, never that member's dormant direct Binding. Single
and batch deletion result text counts distinct affected Fields, including all
members represented by a deleted Shared Binding.

### Undo

- Undo is a Task 003 safety foundation, not a persistent version history.
- Picker Undo is scoped to the Inline Picker and the Field where the operation happened. Side Panel Undo is scoped to the Side Panel and is not Field-scoped unless the completed operation itself targeted one existing Binding.
- The Picker has one always-visible Undo icon in the header, ordered before Keep Open and Close.
- Undo is visually disabled and gray when no undoable operation exists, but it remains focusable (`aria-disabled="true"`, not the native `disabled` attribute) and does not activate on click, Enter, or Space in that state. Its accessible label or tooltip explains that no undo is available so keyboard and screen-reader users can discover the reason without relying on hover.
- Undo is active and visually emphasized when an undoable operation exists; hover or focus shows the exact operation, such as `Undo delete "Preview"`.
- Picker Undo remains available after the Picker closes and reopens for the same Field, until a new key data operation replaces it or the context becomes invalid.
- Opening another Field's Picker does not expose the previous Field's Undo. Performing a key data operation in another Field replaces the previous Undo.
- Side Panel Undo uses the selected non-modal bottom feedback bar. It remains available while navigating among Task 003 Template Library views until another Side Panel key data operation replaces it or its source state becomes invalid.
- Undo is never shared between Picker and Side Panel.
- Picker Undo covers successful Save, Bind, Unbind, Delete, and `Save a copy for this field`. Side Panel Undo covers successful Save, Unbind, Delete, and batch Delete. Opening Edit, Insert, Search, Cancel, focus movement, filtering, sorting, and navigation do not enter Undo.
- Bind Undo removes the just-created Binding.
- Unbind Undo restores the removed Binding and its Binding usage count.
- Delete Undo restores the full prior Template state, including Template content, Site Affinity, total usage, timestamps, every deleted direct Binding, and every deleted Shared Binding with their usage counts.
- `Save everywhere` Undo restores the previous Template content and metadata if no later conflicting data change occurred.
- `Save a copy for this field` Undo deletes the new copy and restores the current Field's Binding and related relationships to the pre-copy state.
- Undo fails closed if the related data changed after the undoable operation. It shows a clear error and does not guess, merge, or overwrite later accepted changes.
- Testable invalidation mechanics: every Template and Binding mutation increments that record's `revision` counter (or equivalent monotonic stamp) as part of the same atomic write that performs the mutation. A pending undoable operation captures the pre-mutation record `revision`(s) it depends on. Undo is valid only while every captured `revision` still matches the current stored `revision` for that record (or, for Delete Undo, while no record now exists at that Template ID). Any accepted write to a captured record between the original operation and the Undo attempt invalidates that Undo, "a new key data operation" (Picker) or "another Side Panel key data operation" (Side Panel) means any of the operations listed as Undo-eligible above happening again for a scope that would replace the current pending Undo, and "context becomes invalid" means the field/page/Site scope the Undo depends on no longer resolves (Field Profile or Page Profile removed, Site removed, or a captured Binding's endpoints no longer exist).
  - Undo invalidation matrix by mutation type:
    - `Save everywhere`: invalid if the Template's `revision` changed (any later edit, copy split, or delete/restore of that Template).
    - `Save a copy for this field`: invalid if the new copy Template no longer exists, or if the current Field's Binding was moved or removed after the copy was created.
    - `Bind`: invalid if the created Binding no longer exists (already unbound or its Template deleted).
    - `Unbind`: invalid if the Template was deleted after the Unbind, or if a new Binding already exists for the same Template and Field (Rebind), since restoring the old Binding would create a duplicate.
    - `Delete`: invalid if a Template with the same ID was already restored or recreated (would collide), or if a Page Profile or Field Profile a captured Binding depends on was removed by a later accepted Task 004 operation.
    - `Delete` (batch, Side Panel): invalid per-Template using the same rule as single Delete; a partially valid batch Undo restores only the still-valid subset and reports which records could not be restored.

### Delete And Batch Delete

- Ordinary single Template Delete does not require a pre-confirmation because Undo is the immediate safety mechanism. This is the canonical, project-wide policy for a single or partial Template deletion, stated in `PROJECT.md`'s "Edit And Delete Behaviour" section. Task 004's newer Sites Page Access-Only Simplification moves Site-related Template deletion back to the Templates page, so Task 003's Delete/Undo rules are the authority for ordinary single and batch Template deletion everywhere in the product.
- Because an ordinary Delete has no pre-confirmation, its safety depends entirely on Undo being reliable and discoverable: Undo must be an always-visible header control (not a transient toast that can be missed), its disabled state must be reachable and explained without a pointer, and its invalidation rules must be narrow and precisely defined rather than vague, so it does not silently expire while the user is still in the same interaction. The always-visible Undo requirement above and the invalidation matrix above exist specifically to make this the sufficient safety mechanism the "no pre-confirmation" policy assumes.
- After ordinary Delete, the Template is removed from the visible list immediately and the corresponding interface Undo becomes active.
- Any operation whose final outcome removes the entire Template Library requires exact typed `delete`, regardless of entry point.
- A dedicated `Delete all templates` action always requires typed `delete`. (Revised 2026-08-17 at the user's direction: the required word is lowercase `delete`, not `DELETE` — case sensitivity itself was never the point, only requiring the user to deliberately type the word.)

### Task 009 addendum — Settings duplicate retired

The dedicated whole-library action is now exposed only through the Templates page. Settings must not duplicate Template deletion; it owns the separate Task 009 Factory Reset operation.

### 2026-08-25 remediation addendum — mutually exclusive Templates editors

Manual verification of Task 010 found that a Page or Field alias editor could
remain open while a Template-content editor was opened in `This tab`. This is a
presentation-state defect in Task 003's Templates editing surface, not a change
to Template, Binding, Site, Page Profile, or Field Profile data rules.

- At most one inline editor may be active across the Templates page: a Page
  alias, a Field alias, or Template content.
- Starting any other edit cancels the currently open editor and discards its
  unsaved draft. It never auto-saves that draft.
- Escape and Cancel retain their existing discard behaviour.
- This addendum changes no persistence, matching, alias semantics, or Undo
  eligibility; it only makes the existing editing surface mutually exclusive.
- Multi-select deletion is supported in `All templates`, including while narrowed by the `Global only` filter or any other filter combination.
- `By location` supports single Template Delete and Unbind, but not broad multi-select node deletion in Task 003.
- Multi-select deletion shows a combined impact summary and uses ordinary confirmation unless the final result removes every Template record.
- Impact summaries for destructive operations show affected counts in collapsed state and can expand to list affected Site, Page, and Field labels.
- Deleting a Template removes the Template and all of its Bindings atomically. It does not remove Page Profiles, Field Profiles, Sites, Website Access, or activation state unless a later Task 004 operation explicitly does so.

### Keep Open And Floating Picker

- The current Pin concept remains, but the user-facing behaviour is `Keep open`: the Picker stays open while the user works.
- The existing icon may remain until final artwork is chosen.
- In Keep Open mode, clicking outside the Picker does not close it.
- In Keep Open mode, Escape and Close still close the Picker.
- In Keep Open mode, insertion does not close the Picker. In ordinary mode, insertion closes the Picker.
- The per-field FillNest control icon (the small control that opens the Picker on demand) remains visible on the current Target Field while Keep Open is active, the same as in ordinary mode. It is not hidden merely because the Picker is already open; it stays available both as a consistent per-field marker and as a way to bring the Picker back if it is ever lost for any reason.
- When the user focuses a new eligible Field in Keep Open mode, the Picker content switches to the new Field while retaining its floating position.
- When the user focuses a password, payment, one-time-code, hidden, disabled, read-only, or otherwise unsupported or excluded field while Keep Open is active, FillNest immediately clears the previous Target Field so no captured Target Field remains, keeps the Picker's last valid content visible but disables insertion and Bind (both fail closed if attempted against a cleared Target Field), and never reads the new field's value, attaches a listener to it, creates a Field Profile for it, or shows any per-field UI on it. This mirrors the existing Field Eligibility exclusion rules; Keep Open never grants a sensitive or unsupported field behaviour it would not otherwise receive.
- If the previously captured Target Field is removed from the DOM (including through SPA navigation or a framework re-render) while Keep Open is active, FillNest treats this the same as an invalid Target Field: it is cleared immediately, insertion and Bind fail closed, and no stale reference is retained or reused.
- On page navigation (a new document load, not an in-page SPA route change that preserves the existing document), Keep Open does not persist the Picker into the new page; the Target Field is cleared and the Picker closes, consistent with the Inline Picker being scoped to one page's DOM. The saved floating position itself is a global setting and survives navigation for the next time Keep Open is used.
- Keep Open mode allows dragging the Picker by its header only.
- The floating position is one global user setting, shared across websites and fields.
- Dragging saves the last position when Keep Open is turned off or the Picker is closed.
- The live rendered position is always clamped to stay fully within the current viewport — both when a previously saved position no longer fits (e.g. after a viewport resize) and continuously while the user is actively dragging the Picker, so the Picker can never be dragged or restored to a position that renders outside the browser window. This clamp is applied only to the live/rendered position and never overwrites the saved position; the saved position is updated only at the defined save points above (drag-end, Keep Open turned off, Picker closed), using the clamped value at that moment.
- Ordinary non-Keep-Open Picker interactions still open next to the Target Field. The saved floating position is used only while Keep Open is active.
- Because Keep Open keeps the Picker mounted after Insert (unlike ordinary mode, which closes it), a Template the user already inserted stays one click away, and an accidental repeat click on long content can go unnoticed. (Added 2026-08-17 at the user's direction.) FillNest tracks how many times each Template has been inserted into the current Field this Picker session (reset when the Field changes); once a Template has been inserted twice or more into the same Field, its row is visibly flagged and a status message states the exact count. This is a visibility safeguard, not a block — repeated insertion of the same content into the same Field can be intentional, so Insert is never prevented or silently altered.

### Explicitly Deferred

- User Tags UI, tag filters, tag management, tag rename/merge, and tag batch assignment.
- `Forget this field` default UI. It may return later as an advanced cleanup/debugging feature.
- Search match highlighting.
- Structured Contacts and multi-field filling.
- Full URL/title capture for display labels.
- Binding from Side Panel, remembered fields, aliases, or tree selection.
- Site Data cleanup and Website Access removal, which belong to Task 004.
- Inline Picker relevance and Search All Templates ranking, which belong to Task 005.

## Vertical Slices

| Slice | Complete Behaviour | Required Evidence | Status |
| --- | --- | --- | --- |
| 1. Schema, Migration, And Labels | Add compatible usage counts, safe System Display Labels, optional User Aliases, validators, migration, and derived Preview rules | Migration, malformed-data, preview trimming, alias, privacy counterexample, and invariant tests | Complete |
| 2. Library Views | Deliver By location, Global, and All templates with real data, adaptive expansion, filters, deterministic ordering, aliases, and accessible navigation | Repository projection tests, component tests, large-library fixtures, and Side Panel browser evidence | Complete |
| 3. Picker Menu Formalization | Formalize Search-first Picker, keyboard selection, row-action grouping, full-text flyout, Keep Open dragging, and floating position persistence | Component, geometry, keyboard, viewport, persistence, and headed built-extension evidence | Complete |
| 4. Usage Accounting | Increment Template and Binding usage only after successful insertion and preserve/reset counts exactly as defined across Bind, Unbind, Rebind, Edit, Copy, Delete, and Undo | Unit, concurrency, retry/idempotency, blocked-insertion, and built-extension evidence | Complete |
| 5. Edit, Copy, And Undo | Deliver field-scoped edit/copy decisions, Picker Undo, and the selected Side Panel bottom Undo feedback | Repository atomicity, stale-undo, relationship invariant, component, responsive Side Panel, and browser-flow tests | Complete |
| 6. Deletion Safety | Deliver ordinary Delete with immediate Undo, multi-select deletion, impact summaries, and exact `delete` boundary for entire-library outcomes | Impact calculation, transaction rollback, full-restore, exact `delete` boundary, and browser evidence | Complete |
| 7. Integrated Evidence And Review | Run regression, privacy, accessibility, keyboard, hostile-page, concurrency, network, and two-axis review | Complete checks, scope diff, objective screenshots as supplemental evidence, and updated `DEVELOPMENT.md` | Complete |

Task 003's scope spans migration, tree navigation, Search, usage tracking, Edit/Copy, two separate Undo systems, batch deletion, Picker keyboard behaviour, Keep Open, dragging, and floating-position geometry. Given that breadth, a mandatory fixed-point two-axis (Spec and Project Standards) review gate runs after Slice 4 (Usage Accounting) and before Slice 5 (Edit, Copy, And Undo) begins, in addition to the final Slice 7 review. This mid-point gate exists specifically to catch relationship-invariant and safety-boundary problems before the mutation/Undo slices compound them, and its findings must be resolved before Slice 5 starts.

## Allowed Scope

- Schema migration required for usage counts, System Display Labels, User Aliases, Preview derivation, and floating Picker position. Undo state itself remains non-persistent.
- Repository operations and projections for Library views, edit/copy, Bind/Unbind, Delete, batch Delete, and Undo.
- Side Panel Template Library pages and directly related shared components.
- Inline Picker menu, keyboard, row action, flyout, Keep Open, and floating-position behaviour.
- Plain-text edit, field-scoped copy, Unbind, Delete everywhere, impact calculation, and Template deletion.
- Tests, fixtures, directly affected documentation, and `DEVELOPMENT.md`.

## Forbidden Scope

- User Tags UI or tag management.
- `Forget this field` UI.
- Binding from Side Panel, remembered fields, aliases, or tree selection.
- Website Access removal, Origin Activation redesign, Site Data reset, or Task 004 site-cleanup flows.
- New relevance classification, AI, semantic search, Contacts, multi-field filling, Backup or Restore, sharing, sync, accounts, plans, quotas, payments, telemetry, or network features.
- Automatic raw URL, page-title, record-value, customer-name, or field-value persistence for display labels.
- Titles, categories, descriptions, colors, shortcuts, favorites, or other unapproved Template metadata.
- Whole-field replacement, automatic insertion, form submission, or a second management surface.

## Acceptance Criteria

- Each Library view includes exactly the records defined above and remains correct with zero, one, ten, and at least one hundred Templates.
- The selected `Quiet Location Navigator` hierarchy, Search, row actions, inline aliases, and Side Panel Undo feedback remain usable without horizontal scrolling or clipped controls at 360, 420, and 600 CSS pixel Side Panel widths.
- The location tree is derived from Bindings and never duplicates Global Templates into the tree.
- Location-tree counts use distinct Template records and do not inflate when one Template has multiple descendant Bindings.
- Adaptive tree expansion is deterministic, tested, and does not overwhelm large libraries.
- System Display Labels contain no randomized record IDs, customer-like slugs, opaque query values, raw titles, or field values in adversarial fixtures.
- User Alias changes survive restart and change no identity key, recognition result, relevance result, or Binding.
- Search and filters compose deterministically; clearing them restores the accepted default ordering.
- Usage increments occur only after confirmed successful insertion and cannot be lost under concurrent accepted operations.
- Binding usage is restored by Undo Unbind, restored by Undo Delete, reset to `0` after a new Rebind, and not affected by ordinary Template edits.
- Template Preview ignores leading whitespace and blank lines and uses the first non-empty line.
- Picker rows remain fixed-height, clamp to two lines, and never allow text or actions to overflow each other.
- Full-text flyouts stay inside the viewport in ordinary and Keep Open modes.
- Picker keyboard selection follows the accepted Arrow/Enter behaviour and does not degrade text entry into Search.
- Row actions do not reflow rows, remain keyboard accessible, and reject synthetic host-page activation.
- Delete is visually associated with its row while clearly separated from ordinary actions.
- Side Panel never creates a Binding; an Inline Picker Bind always uses the current captured Target Field.
- Edit and field-copy preserve relationship invariants and never infer Page or Site-level copy scope.
- Undo is single-last-action, interface-scoped, non-persistent, and fails closed when later data changes conflict. Picker Undo is Field-scoped; Side Panel Undo follows the selected feedback-bar rules and never leaks into the Picker.
- Delete Undo restores complete Template and Binding state, including usage and timestamps.
- Confirmation strength is determined by final destructive outcome, and every entire-library path requires exact typed `delete`.
- Failed validation or persistence leaves the prior complete state unchanged.
- Task 001 and Task 002 permission, privacy, activation, selection, insertion, UI-isolation, and no-network guarantees remain passing.

## Stop Conditions

Stop for approval if safe display labels require storing raw sensitive page data, field-copy cannot preserve relationships atomically, Undo requires persistent history, usage accounting requires telemetry or network storage, a management surface would need to infer a Target Field, or implementation enters Task 004 or later scope.

## Review Gate

Review Spec and Project Standards separately. Adversarial review must include large libraries, duplicate previews, multi-site Templates, Global Templates with many uses, concurrent insertions and mutations, unsafe URL/title examples, stale Undo, full-library deletion through every entry point, keyboard-only operation, hostile page scripts/styles, viewport-constrained flyouts, and Keep Open dragging across small and large viewports.

## Status

**Complete and Accepted.** Grill Mode decisions through Q90, the 2026-08-16 two-axis audit's P1/P2 findings, and a same-day re-audit's three further findings (stale authorization-boundary wording, unspecified field-control-button visibility during Keep Open, and drag-clamp wording that did not explicitly cover live dragging) are all resolved in this text. The user accepted this contract on 2026-08-16 and separately authorized implementation the same day. All 7 Vertical Slices were completed (see `DEVELOPMENT.md` for evidence), including the mandatory mid-point two-axis review gate after Slice 4 (6 findings, all fixed) and the final Slice 7 integrated review (2 findings, all fixed, plus one resolved ambiguity). Three further rounds of user-directed post-review fixes across the Side Panel and Picker (2026-08-17) are also recorded in `DEVELOPMENT.md`. **The user reviewed the built extension and confirmed it (2026-08-17): "I have checked all the functions which you built, all good. No obvious errors."** This closes Task 003 with no further outstanding items.

**Post-acceptance ordering addendum (2026-08-21). SUPERSEDED 2026-09-07 - manual ordering was removed; see the Automatic Only addendum below.** Field-local manual ordering is now documented above: a Field remains automatically ordered until the user manually reorders that Field's Template list; after that, the Field's order is user-maintained while other untouched Fields remain automatic. This addendum records the product contract for a bounded follow-up/remediation and does not reopen unrelated Task 003 scope.

**Post-acceptance Side Panel Undo bar addendum (2026-08-22).** The user reported the Side Panel Undo bar, implemented as `position: fixed` spanning the panel width at the bottom edge, can cover row content or controls in a narrow panel - a direct defect against this contract's own line 58 requirement that it "must not obscure the active row, navigation, Search, or destructive confirmation controls." Resolved as a minimize/restore control, not the user's alternative hover-reveal suggestion (a thin hover-trigger zone at the panel's bottom edge is unreliable on touch/trackpad input and risks accidental triggers in a narrow panel, so a click-based control was chosen instead):

- The Undo bar gains a small collapse control (a chevron) alongside the existing `Undo` button. Clicking it collapses the full bar into a small round handle pinned to the bottom-right corner, not the full-width bar.
- The collapsed handle is a distinct, deliberately quieter visual state (smaller, lighter shadow, partially transparent) so the user can tell at a glance that an Undo is available-but-hidden versus actively presented. Clicking the handle restores the full bar.
- Collapsing is purely a display state. It does not invalidate, consume, or extend the underlying Undo capability - the existing revision-based invalidation rules above are unchanged and unaffected by whether the bar is currently shown or collapsed.
- Whenever `lastAction` changes to a new completed operation (a new Undo becomes available, replacing any prior one per the existing "another Side Panel key data operation replaces it" rule), the bar always returns to its full, expanded state - a new completed operation is worth resurfacing even if the user had collapsed the previous one.
- This does not change Undo's availability, invalidation, or scope rules above; it only adds a user-controlled visibility toggle for the existing bar to bring the implementation into compliance with the pre-existing "must not obscure" requirement.

**Post-acceptance Repository integrity remediation note (2026-08-21).** Task 006 owns a pre-Backup canonical candidate-state commit gate because reliable Backup cannot depend on each mutation independently preserving storage invariants. That hardening must regression-protect every Task 003 Template, Page Profile, Field Profile, Binding, ordering, usage, Edit/Copy, Delete, and Undo behaviour; reject duplicate identities, duplicate Template/Field Bindings, and inconsistent relationships before write; and preserve the prior complete state on failure. This note records cross-Task ownership and does not authorize Backup/Restore work inside Task 003 or reopen its accepted product scope.

**Post-acceptance ordering remediation (2026-08-21).** User Alias edits must never reorder Fields. `documentOrder` is added as the bounded durable Field Profile metadata described above and is included in Task 006 Archives. This is a corrective extension of the accepted By-location ordering rule, not a new discovery or matching feature.

**Post-acceptance Picker removal clarity addendum (2026-08-24).** The user identified that the technically distinct `Unbind` and `Delete` actions are too easy to confuse after editing a shared Template or making a field-local copy. The Picker retains the same data operations and existing Undo semantics, but changes their presentation:

- The bound-row remove icon has the accessible name and immediate hover label **`Remove from this field`**. It uses a remove-from-field icon rather than the former broken-link icon.
- The row delete icon has the accessible name and immediate hover label **`Delete template everywhere`** and remains visibly dangerous in red. It deletes the Template from the library and every Field to which it is bound.
- The Picker always displays one compact operation-context strip. In its neutral state it names the current Field and says `following focus`. After a completed mutation, it remains visible with an outcome-specific color and text rather than relying on a transient notification.
- Removing a Template from one Field reports either its remaining number of other Fields, or that it is now in Global templates. In the latter case the strip offers the existing Undo plus an explicit `Delete template` follow-up. This makes the otherwise invisible Global Template consequence reviewable without changing the default non-destructive action.
- Delete reports the exact number of Fields removed together with library deletion and offers Undo. Field change, Picker close, Undo completion, or a subsequent accepted operation returns the strip to neutral context.

## Addendum — Field-Local Ordering: Automatic Only (2026-09-07)

**Status:** Complete on 2026-09-07. **Supersedes the post-acceptance ordering
addendum of 2026-08-21**, which allowed a Field to become user-arranged. Manual
ordering is removed from the product by owner decision.

### What Was Found

The owner dragged a Field's Templates into a new order in the Side Panel; the
Picker for that same Field showed no change, before or after a reload. Nothing
about the accepted rule had actually been built, and the two surfaces
disagreed:

- The Picker sorted by the **Template's total usage across every Field** and
  never read `BindingRecord.order`, so a manual reorder was invisible there
  permanently.
- The Side Panel sorted purely by `BindingRecord.order` and never applied the
  automatic rule.
- `effectiveTemplateListForField` returned direct Bindings in storage-array
  order, which a reorder never touches - it rewrites `order` - so the manual
  order was absent from the Field's own effective list before any UI sorted it.

### Decision

Rather than build the two-mode rule, the owner removed manual ordering. A
Field's Template list is ranked automatically and is not user-arrangeable.

### Contract

- A Field's own Template list is ranked by **that Field's own Binding usage
  count** descending, then Template Preview alphabetically, then stable
  Template ID. Never by the Template's total across every Field: two Fields
  sharing a Template can legitimately rank it very differently.
- `orderFieldTemplateEntries` is the only implementation. The Picker and the
  Side Panel both call it, so the surfaces cannot drift apart again.
- There is no drag handle, no `REORDER_FIELD_BINDINGS` command, and no stored
  "user arranged this" marker.
- The Side Panel Templates page's own sort choices (`Usage`, `Alphabetical`,
  ...) are unchanged and still rank by Template totals. That is the
  library-wide list, where the total is the right measure.

### Schema

`v11 -> v12` exists and is kept. It was briefly defined as adding a
`manuallyOrdered` marker for the two-mode rule; the feature was removed the
same day, before release, so v12 carries no new field. The bump is not reverted
because a store may already have been written at v12 during that window and
must stay readable; any marker such a store holds is dropped on read, since
`validateFieldProfile` copies only fields it knows.

`BindingRecord.order` is retained. Nothing displays by it now - it gives every
caller the same deterministic sequence regardless of storage-array layout.
Removing it is a separate change: it appears in Backup Archives and in every
Binding fixture, and does not belong in a feature removal.

### Acceptance Criteria

1. No surface offers a reorder affordance, and the command no longer exists in
   the message contract, the Repository, or the total mappings over
   `RuntimeRequest`.
2. A Field's list is ranked by its own Binding usage on both surfaces,
   asserted with Binding usage and Template totals deliberately opposed so the
   test cannot pass under the old Picker rule.
3. `npm run check` and the complete headed E2E suite pass.

## Addendum — Field-Local Ordering Was Never Implemented (2026-09-07)

**Status:** Complete on 2026-09-07. Repairs the post-acceptance ordering
addendum above, which was documented but not built.

### Reported Defect

The owner dragged a Field's Templates into a new order in the Side Panel. The
Picker for that same Field showed no change, before or after a page reload.

Neither half of the accepted ordering rule was implemented, and the two
surfaces disagreed with each other:

- The Picker sorted the Field's list by the **Template's total usage count
  across every Field**. It never read `BindingRecord.order`, so a manual
  reorder was invisible there permanently.
- The Side Panel sorted purely by `BindingRecord.order`, and never applied the
  automatic rule at all.
- `effectiveTemplateListForField` returned direct Bindings in storage-array
  order. `reorderFieldBindings` rewrites `order` and does not move array
  entries, so the Field's manual order was absent from its own effective list
  even before any UI sorted it.

### Contract

The rule is the one already accepted above, now actually enforced:

- Before its first explicit reorder, a Field is ordered automatically by **its
  own Binding usage count** descending, then Template Preview alphabetically,
  then stable Template ID.
- After an explicit reorder, the Field is user-maintained and renders in the
  saved order.
- `FieldProfileRecord.manuallyOrdered` records which state a Field is in.
  `BindingRecord.order` cannot express it: every Binding is assigned an order
  when it is created, so the orders alone never distinguish "the user arranged
  these" from "this is the sequence they were bound in".
- One function, `orderFieldTemplateEntries`, is the only implementation. Both
  the Picker and the Side Panel call it, so the two surfaces cannot drift
  apart again.

### Schema

`v11 -> v12` adds the optional marker. No existing Field receives it: a Field
reordered before this version is indistinguishable from one that was not, and
inferring the flag would silently freeze an automatic Field's order. Such a
Field returns to automatic ordering until its next deliberate reorder, which
is the recoverable direction of the two.

### Acceptance Criteria

1. An explicit reorder marks the Field user-maintained; binding, unbinding and
   inserting do not.
2. A reorder that restores the original order still leaves the Field
   user-maintained.
3. The Field's effective Template list carries its saved order.
4. An automatically-ordered Field ranks by its own Binding usage, not by the
   Template's total - asserted with the two deliberately opposed, so the test
   cannot pass under the old rule.
5. `npm run check` and the complete headed E2E suite pass.

### Not Done

Ordering choices exposed in the Side Panel Templates page (`Usage`,
`Alphabetical`, ...) still rank by Template totals. That is the library-wide
list, where the Template's total is the right measure; only a Field's own list
follows the rule above.

## Addendum — BindingRecord.order Removed (2026-09-08)

**Status:** Complete on 2026-09-08 by owner decision. Follows the Automatic Only
addendum, which left the field stored but read by nothing.

`BindingRecord.order` existed to carry field-local manual ordering. With that
feature removed, no surface displayed by it, so it was a stored field nothing
read - the kind of placeholder data model `AGENTS.md` forbids.

### What Changed

- `order` is gone from `BindingRecord`, its validator, and the per-Field
  order-uniqueness invariant.
- `nextBindingOrder` is gone. Nothing assigns an order to a new Binding.
- Where a deterministic sequence is still needed - the effective Template list,
  the Side Panel's Field rows, the Picker's candidate preview - the Binding id
  supplies it. The order a user *sees* is decided by
  `orderFieldTemplateEntries`, which ranks by that Field's own usage.
- `SharedTemplateBindingRecord.order` is **unchanged**. A Shared Template Set
  has no single owning Field to key ordinary Binding order off, so slot order
  is the Set's own sequence and stays, invariant included.

### Backup Archive Compatibility

Every archive written before this date carries a Binding `order`. The archive
validator keeps it in the allowed-property set and still range-checks it when
present, so those archives restore unchanged; the value is then dropped by
`validateBinding`, which copies only fields it knows. New archives do not write
it.

### Schema

`v12 -> v13`. The migration is a version bump: `validateBinding` already drops
an unknown stored `order` on the first read. The version exists so the number
states that the shape changed.

### Tests

Three tests were removed rather than adapted, because they asserted the
assignment behaviour itself and would otherwise have asserted nothing: that a
new Binding takes the next order for its Field, that unbinding a non-last
Binding does not create a colliding order, and that a field-scoped copy keeps
the original's rank.


## Addendum — Picker Selection And Editing (2026-09-10)

**Owning change:** Task 036 Addendum J, after the owner's Copilot QA.
**Status:** implemented; the owner decided the Enter rule below.

- **No row is selected on open.** This restates "the first `ArrowDown` from
  Search selects the first visible Template row"; the implementation had
  selected the first row by default, so the first `ArrowDown` reached the
  second.
- **Enter in Search** inserts the selected Template, or the first visible
  Template when none is selected (owner decision, 2026-09-10: type a filter,
  press Enter).
- **At most one row is shown as selected.** Selection follows focus, and a
  pointer that actually moves over a row; a row appearing under a resting
  pointer is not selected. Arrow keys count from the focused row.
- **Editing a Template hides Search and New template**, like composing a new
  one; the editor takes the focus, and Search gets it back when Save or Cancel
  ends the edit. This narrows "The Inline Picker keeps Search visible in the
  main list view" to the list view while no Template is being edited.

## Addendum — The Selection An Insertion Replaces (2026-09-11)

**Status:** Implemented on 2026-09-11 on the owner's instruction to repair the pre-submission audit's findings; accepted by the owner on 2026-09-11 after hands-on QA.

**Defect.** Clicking the Field Control read the Field's selection once, as
offsets, and the content script kept those offsets for the life of the page.
A pinned (`Keep open`) Picker then applied them to every later insertion: the
second insertion into the same Field overwrote the first one, and an insertion
into a *different* Field replaced that Field's text between the first Field's
offsets. Text the user never selected was destroyed, which the user-control
rule forbids.

**Rule.** A captured selection belongs to the Field it was read from and to one
insertion. It is consumed by that insertion, and it is dropped when the user
places their own caret by focusing a Field. Without one, the text goes in at
the Field's own live caret. Opening the Picker from the Field Control still
captures the selection exactly as before, so the unpinned flow is unchanged.

**Known limit.** A pinned Picker over a Rich Text Field, after the user clicks
into the editor and then onto a Picker row, inserts at the editor's end if the
click moved the document selection out of the editor. That is Task 036's
documented fallback, not an overwrite.

**Evidence.** `tests/unit/content-script-insertion-selection.test.ts` mounts the
real content script; both cases fail without the change.

## Addendum — Owner QA Of 2026-09-11: The Flyout And Rename Editors

**Status:** Implemented on 2026-09-11 from the owner's hands-on QA; the
owner's re-test passed on 2026-09-11 and the addendum is accepted. Items
1c-1f (2026-09-14) and the 2026-09-15 result wrap were accepted after the
owner's QA on 2026-09-15.

**1. The full-text flyout closed before the pointer reached it.** The flyout
sits beside the Picker, and it followed the highlighted row. Moving the pointer
toward it left the list, which cleared the highlight and closed it first, so a
long Template's text could not be scrolled or read. When the pointer leaves the
list, the flyout now keeps the Template it was showing for 400 ms, and stays
open while the pointer is over it; leaving the flyout closes it. Keyboard
focus behaves as before.

**1a. The flyout opened only past 120 characters.** A row shows only a
Template's first non-empty line, clamped to one or two lines. A shorter
Template with more lines than that, or whose line the clamp cut short, hid the
rest with no way to read it. The flyout now opens whenever the row hides part
of the text: the Template has lines after the one shown, or the shown line
overflows its clamp (measured in the page, since it depends on the width). A
Template the row shows in full gets none.

**1b. The flyout sat level with the Picker's top.** Reaching it from a lower
row meant moving up as well as across. It now sits level with the row it
belongs to, still beside the Picker - right when there is room, else left - so
the pointer reaches it by moving straight across. It is never taller than the
Picker (at most 300 px, scrolling inside), and its top and bottom stay within
the Picker's: a tall flyout beside a low row moves up only as far as its
measured height needs. It follows its row when the list scrolls. This refines
the flyout geometry rule above.

**1c. In a narrow window the flyout hid the Picker (owner QA, 2026-09-14).**
When neither side of the Picker has room, the flyout has to lie over it. Only
then is it see-through - 70%, after the owner found 50% still hid the text
behind it - so the Picker reads through it; it turns solid while the pointer is
on it to read, and see-through again when the pointer leaves. Beside the Picker it is solid as before. A reduced-motion
preference drops the fade.

**1d. Editing is a panel of its own (owner QA, 2026-09-14).** Edit used to
open an editor inside the Template's row: a small box, under which the
full-text flyout could lie. It now opens its own panel, as New template does -
the list, Search and New template step aside, and Cancel or Save brings them
back with focus in Search - and the flyout never shows while it is open. This
extends Task 036 Addendum J's "editing works like composing".

**1e. New template and Edit keep the Picker's size.** Both measure the Picker
as it was in the list and keep that height, giving the room to the text box.
Only a list shorter than a usable editor (text box at least 96 px) makes them
taller.

**1f. Save choices stay in the Tab order.** A Save that cannot act yet -
nothing typed, nothing changed, too long - was a `disabled` button, which drops
out of the Tab order: Tab from the text went straight to Cancel, and with two
Save choices both seemed missing. They are now `aria-disabled`: reachable,
announced as unavailable, and inert until the text can be saved. On a plain
page the owner's exact sequence did not reproduce; this is the one cause that
produces it, and the change makes Tab order the same whatever the state.

**4. Dragging a pinned Picker drew copies of it.** Past the viewport edge the
Picker re-clamps its position from an effect and reports it to the content
script, which re-rendered the whole overlay synchronously from inside that
effect. Preact then inserted a new Picker rather than updating the old one,
leaving a trail of copies that could not be closed - 25 in the headed check
before the repair. A live drag position is now drawn on the next animation
frame, at most once per frame; a dropped position is still drawn at once.

**5. Pressing the header to drag did what a press on the page does.** It took
focus out of the Picker and started a text selection that followed the pointer
across the page's Fields for the whole drag. The press is now the drag and
nothing else: focus stays where it was in the Picker and no text is selected.

**2. Every rename editor follows one rule.** Renaming is editing: the editor
opens on the name shown (Task 023 Addendum B5 (3)). Doing anything else
without saving discards the rename - a press outside the editor, or focus
moving to another control. Focus leaving the window does not. Task 036
Addendum A.3 had applied this to the Picker's Field name for the actions it
listed; it now applies to every press in the Picker, and to every Side Panel
rename (`This tab`, `By location`, `Shared Sets`). The mutually exclusive
editors rule above is unchanged.

**3. A rename editor takes the room it needs.** In `Shared Sets` the editor
was squeezed between the Set's summary or a Field's location and its buttons,
and showed one or two letters of the name it opened on - which read as an
empty box. Side Panel editors are at least 240 px wide where the row allows,
the input at least 8 em, and in `Shared Sets` the row's other contents step
aside while the editor is open, as the Picker's Field name editor already does.

**Evidence.** `tests/unit/inline-picker.test.tsx` (the flyout's linger and
hover, a short multi-line Template, none for a whole one; a press elsewhere
discards a Picker rename), `tests/e2e/picker-full-text-flyout.spec.ts` (a
multi-line, a clamped and a whole Template in real Chromium; the flyout level
with its row, within the Picker's top and bottom, and reached by a straight
horizontal move; in a 420 px window, 70% see-through over the Picker and
solid under the pointer), `tests/unit/picker-edit-panel.test.tsx` (the Edit
panel, no flyout over it, a focusable unavailable Save that saves nothing),
and `tests/e2e/picker-selection-and-edit.spec.ts` (New template and Edit keep
the list height with a text box of at least 96 px; Tab from the editor reaches
Save everywhere, Save a copy here, then Cancel before anything changed), `tests/e2e/pinned-picker-drag.spec.ts` (a pinned Picker
dragged across ten Fields and against the viewport edge leaves one Picker, no
Field focused, focus unmoved and no selection; it fails without either
repair) and
`tests/unit/alias-label.test.tsx` (seeded, discarded by a press or a focus
move elsewhere, kept for its own Save and a window blur). Widths were checked
in real Chromium at a 360 px panel: 162-173 px inputs, down from about 15 px.
