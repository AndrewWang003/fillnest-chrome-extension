# Task Contract

## Task ID And Name

Task 005 - Template Discovery And Search

## Goal

Complete deliberate Inline Picker Template discovery without automatic recommendation. A recognized Field shows its own bound Templates first. A Field with no saved match shows no guessed content. When the user types a Search query, the Picker searches the whole local Template Library by literal Template body and lets the user explicitly insert or bind any matching Template.

## Stable Product Decisions

- Recognized Fields initially show only Templates bound to that Field.
- Unrecognized Fields initially show no Template content and no recommendation. They provide explicit `New template` and Search actions.
- There is no pre-query suggestion list in V1.
- The Picker does not classify Template content as name, phone, postal code, address, email, website, or any other semantic kind for recommendation.
- Search starts only after the user enters a non-empty query. It is literal body Search: outer query whitespace is ignored, comparison is case-insensitive substring matching, and Template content is neither rewritten nor semantically classified.
- Search always and directly covers the complete local Template Library, including Global Templates, current-Site Templates, and Templates associated with other Sites. V1 has no Site-scoped Search mode, filtering, or secondary `Search all templates` disclosure.
- Search results do not create or restore Bindings. Binding remains an explicit user action from the real Inline Picker Target Field.
- When a bound Template matches the non-empty query, it remains in the `This field` group above all other matching Templates.
- Other matching Templates render in a single `All matching Templates` group ordered by the accepted default Template ordering.
- Site Affinity is shown as a visible, accessible row badge only for affiliated results in `All matching Templates`; the `This field` group already establishes its local context. A one-Site Template shows that Site; a multi-Site Template shows the Site with the highest aggregate live-Binding usage plus a count of its other affiliated Sites. Ties resolve by Site identity alphabetically.
- Global Templates have no Site Affinity badge.
- Site Affinity is a filing and default-visibility concept, not access control. Revoking Website Access does not rewrite Site Affinity and does not make a Template Global.
- Task 005 does not mutate the Site Affinity lifecycle. Create, Bind, Unbind, copy, and explicit Site/Data operations remain owned by their accepted Tasks.

## Vertical Slices

| Slice | Outcome | Evidence | Status |
| --- | --- | --- | --- |
| 1. Search Contract Remediation | Remove recommendation and cross-site relevance from the Task 005 contract and project rules | Contract and roadmap diff | Complete |
| 2. Picker Search Remediation | Remove pre-query recommendations; make typed Search full-library literal Search with current Field results first | Component and built-extension tests | Complete |
| 3. Site Affinity Visibility | Make Site Affinity badges visible and accessible for affiliated Search results | Domain and component tests | Complete |
| 4. Review | Run regression, production counterexamples, and two-axis review | Complete check set and updated `DEVELOPMENT.md` | Complete |

## Forbidden Scope

- Structured Contacts, multi-field filling, whole-page filling, automatic Binding, generalized semantic inference, fuzzy identity, AI, embeddings, vector search, network lookups, telemetry, or remote ranking.
- Field-value reads for classification or recommendation.
- Template-content semantic classification for recommendation.
- Treating `Global` as a relevance score.
- Treating Site Affinity as security isolation or as Website Access.
- Replacing or duplicating Task 003's Side Panel library management queries.

## Acceptance Criteria

- A recognized Field initially renders only its bound Templates.
- An unrecognized Field initially renders no Template content and tells the user to create a Template or Search existing Templates.
- No pre-query recommendation or `Suggested` group exists.
- A non-empty query finds every unbound Template whose body contains the case-insensitive, outer-whitespace-trimmed query across the complete local library.
- Query-matching current-Field Templates remain visually first while Search is active.
- Search results expose Bind only as an explicit action and never create a Binding on display.
- Affiliated rows in `All matching Templates` expose visible, assistive-technology-readable Site Affinity badges; Global and `This field` rows do not show this badge.
- Same-site Binding restoration remains exclusively controlled by Field Match Confidence.
- Task 001-004 privacy, activation, management, insertion, and no-network behaviour remains passing.

## Stop Conditions

Stop for approval if useful discovery appears to require field-value reads, raw customer data, generalized semantic inference, a new dependency, AI, network access, or expansion beyond single-field Templates.

## Status

**Complete and accepted (2026-08-21).** The previously accepted Task 005 relevance direction is superseded by the user's explicit decision: FillNest does not recommend Templates for a Field. Search is deliberate and full-library; query-matching current-Field Templates appear first. The old contact-like relevance classifier, pre-query suggestion UI, and `Search all templates` disclosure have been removed. The remediation passed its targeted audit and regression checks, and the user completed hands-on review and accepted the Task.

**Post-acceptance Field Match recovery addendum (2026-08-24).** Real-site testing found that a user-confirmed Binding could disappear from `This field` after the Picker closed and reopened while still being discoverable by literal Search. The affected Templates and Bindings were stored correctly; Field Match failed because either a standard campaign query parameter made an otherwise static Page identity unavailable, or an eligible Field had no `id`, `name`, `autocomplete`, or semantic kind. The recovery rule is deliberately narrow: standard campaign identifiers (`utm_*`, `gclid`, `dclid`, `fbclid`, `msclkid`, and `mc_*`) are ignored for Page identity, while every unknown query key still fails closed. For a static recognized Page only, an otherwise unlabelled supported Field may use an exact privacy-safe structural identity comprising tag, effective type, normalized structural ancestors, ordinal among equivalent supported Fields, and the page's total supported-Field count. It stores no field value, label text, placeholder text, record value, or customer data. A changed structural key is unrecognized; it inherits no Binding and still exposes only Create and deliberate Search. This repair restores only a user-confirmed Binding whose complete Page and Field identities exactly match, never a recommendation or inferred Binding.

**Field Match follow-up (2026-08-24).** Two further real-site cases refined the same bounded rule. Equivalent unlabelled Fields use their ordinal *among matching predecessors*, not the first equivalent Field's ordinal; this prevents adjacent controls such as Name and Email from sharing one Field Profile. A deep route whose path cannot safely be persisted as a Page identity remains unrecognized across a document reload, but an unchanged DOM Field on that exact currently loaded page retains its user-confirmed context for the life of that document. Closing and reopening the Picker, or focusing another Field and returning, therefore restores its Binding without turning route text, query values, record data, or labels into durable identity. Navigation, DOM replacement, a changed Field identity, or a different URL discards this memory and remains fail-closed.

**Canonical deep-page and observed-title decision (2026-08-24).** The user explicitly selected convenience with bounded local privacy trade-offs. A user-confirmed Create or Bind may persist an opaque fingerprint of the canonical path (standard tracking parameters excluded) for a deep page otherwise rejected as readable identity evidence; direct and campaign-link visits to that same path must resolve to the same Page Profile. The readable path is never stored. At the same explicit Create/Bind boundary, FillNest stores an Observed Field Title for management display only, prioritizing associated `label`, `aria-label`, placeholder, name, then id. This title may contain page-provided text, is backed up as local business data, and never participates in identity, Field Match, Search ranking, recommendation, or insertion. `This tab` and `By location` Field nodes always sort by stored DOM order, regardless of title or User Alias edits.
