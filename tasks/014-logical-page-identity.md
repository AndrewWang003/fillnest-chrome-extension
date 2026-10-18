# Task 014 — Logical Page Identity

**Version:** `0.1.2 Task 05`
**Status:** Complete and accepted — 2026-08-31
**Implementation:** Task 020 is planned and requires separate execution authorization.

## Problem To Resolve

The same logical form can occur at multiple record-specific URLs within one
Origin. FillNest lets the user confirm when those URLs represent the same
logical Page, so strictly matching Fields can reuse existing Bindings without
broad URL guessing or raw page-data retention.

## Boundary

This is a generic identity task, not a Share Templates implementation task.
It defines the evidence, user review, migration, separation, archive, and
regression boundaries before Task 020 may change PageProfile or FieldProfile
identity. It is a prerequisite for Task 015 and Task 021.

## Accepted Contract

### Identity Evidence And Privacy Boundary

- Matching is limited to one exact Origin. Rules are managed, backed up, and
  cleared with their parent Site, but never match across subdomains, schemes,
  or ports.
- A candidate requires an identical normalized Route Pattern. V1 recognizes
  only high-confidence dynamic path segments, including numeric and UUID
  identifiers. Readable arbitrary path segments are never generalized as IDs.
- For eligible Fields only, FillNest may process control type, standard
  `autocomplete` semantics, label text, field-name text, and group/subject
  text to construct local semantic features. It never reads field values for
  this purpose, retains no raw source text, and never stores complete DOM,
  HTML, selectors, or DOM paths.
- Text evidence is normalized in memory and persisted only as Site-specific
  keyed hashes. The representation is not human-readable and is not reusable
  across Sites. The Site-specific key and hashes are local business data and
  travel only in a user-initiated Backup Archive.
- To make a first candidate available after browser or service-worker restart,
  FillNest may retain one opaque Page Observation for a PageProfile that
  already has at least one direct Binding. An Observation contains only the
  exact Origin, normalized Route Pattern, Site-key reference, and the two
  Site-specific hash sets; it never contains raw text, field values, DOM data,
  readable record-specific URL data, or evidence for an unbound page. Removing
  its last direct Binding removes the Observation.
- A candidate additionally requires Jaccard similarity of at least `0.85` for
  both the Field semantic-feature set and the group-qualified Field
  semantic-feature set. Field order is not evidence. Route equality without
  both thresholds is insufficient.
- Record-specific values, customer data, field values, raw labels, raw names,
  raw group text, and full DOM structure are not persistent identity evidence.

### Candidate Review And Rule Creation

- A high-confidence candidate is surfaced only when the currently opened
  Inline Picker has at least one strictly matching Field with an existing
  Binding that could immediately become available.
- The Picker status strip presents the candidate with a `Review` action. It
  does not interrupt page load or ordinary browsing. Selecting `Review` opens
  an extension-owned confirmation dialog with the migration impact preview.
- Choosing not to review or dismissing the dialog writes no rule and performs
  no migration. The same page session is not prompted repeatedly.
- Confirming creates a Site-managed, Origin-scoped rule for the Route Pattern
  and its semantic evidence. A later page applies the rule automatically only
  when it has the same Route Pattern and again meets both `0.85` semantic
  thresholds. A route match alone never reuses a Binding.

### Field Resolution And Atomic Merge

- Page confirmation never makes similarly named or nearby Fields equivalent.
  Only Fields whose existing strict FieldProfile identity matches exactly may
  merge or inherit a Binding. All other Fields remain independent.
- Confirmation is one atomic candidate-state migration. Before confirmation,
  the existing PageProfiles, FieldProfiles, and Bindings remain unchanged.
  Any invalid, stale, or failed candidate preserves the complete prior state.
- For each exactly matched Field, direct Binding Template IDs merge as a
  union. Duplicate Template IDs become one Binding; distinct Template IDs are
  retained. A duplicate Binding's usage counts are added. Template global
  usage counts are never added or changed by this migration.
- The merged Field returns to established automatic Binding-usage ordering
  unless the implementation can preserve a valid explicit user ordering under
  canonical Repository invariants. It must never silently discard a Template
  or choose one conflicting list as authoritative.
- A successful confirmation invalidates any prior transient Undo under Task
  010 and creates no Inline Picker Undo.

### Stop Matching And Relationship Separation

- Site management exposes each confirmed Logical Page Matching rule and a
  `Stop matching` action.
- Stopping a rule removes only future automatic matching behaviour and
  atomically separates every observed page/field relationship recorded for
  that rule. It is not a destructive restoration of historical lists.
- Each separated exact Field retains the complete merged direct Binding
  Template-ID union. The corresponding Binding usage count is copied in full
  to each resulting Field; Template global usage remains unchanged. Templates
  themselves are neither duplicated nor deleted.
- The operation fails closed if the relationship provenance cannot form a
  valid candidate state. It invalidates prior transient Undo and provides no
  separate Picker Undo.

### Migration, Backup, Restore, And Cleanup

- Rule creation, merge, automatic reuse, separation, Site-data clearing,
  Site removal, Reset, and Restore use the canonical Repository candidate-state
  validation path and are all-or-nothing.
- Backup Archives include matching rules, Site-specific keyed hashes, semantic
  signatures, and relationship provenance required for separation. Restore
  validates them in memory with the complete business dataset; any invalid
  record, hash format, relationship, or invariant rejects the entire Restore
  without changing current data.
- Older archives with no Logical Page Matching data restore their existing
  exact Page and Field records without inferring or creating a rule.
- Clear Site Data, Remove Site, and Reset remove the affected matching rules,
  signatures, and provenance together with the Site's other local data.

### Synthetic Evidence Contract

Task 020 must add FillNest-owned synthetic fixtures and regression coverage
for all of the following. No production or test behaviour may depend on a
specific external website, real customer record, or copied selector.

1. Numeric and UUID Route Pattern positive cases, including field reordering
   and limited optional-field variation.
2. Same-route low-similarity, group-mismatch, and different-route negative
   cases, each proving that no candidate or Binding inheritance occurs.
3. Status-strip `Review`, no-write dismissal, confirmation preview, and
   confirmed future reuse only after both semantic thresholds pass.
4. Exact-Field-only Binding migration, Binding Template-ID union, duplicate
   Binding usage addition, and unchanged Template global usage.
5. Rule separation that preserves the merged Binding union and copies Binding
   usage to each separated Field.
6. Stale confirmation, malformed provenance, candidate-state failure, and
   persistence interruption rollback.
7. New-format Backup/Restore validation, old-archive compatibility, and Site
   cleanup/Reset removal of matching data.

## Explicit Non-Goals

- Cross-Origin or cross-Site matching.
- Matching from route strings alone, low-confidence similarity, raw URL
  similarity, full HTML, DOM tree edit distance, embeddings, MinHash, LLMs,
  or remote services.
- Saving raw labels, names, group text, field values, selectors, DOM paths, or
  complete page structure as identity data.
- Per-Field manual candidate matching, automatic whole-page filling, Shared
  Template Sets, or a generic semantic recommendation feature.

## Bounded Early Repair

The accepted narrow repair recognizes a generic numbered static document
filename only as a hashed route segment. It restores the pre-existing
user-confirmed Binding after refresh without retaining the readable filename.
It does not itself infer that different URLs are the same Logical Page or
substitute for the Task 020 implementation of this contract.

## Addendum C — Page Recognition Coverage (2026-09-09)

**Status:** Slice 1 complete. Owner-directed after a hands-on review of how
FillNest recognizes "the same page at a different address".

### Why

The owner's framing: *similar address, same page, therefore the same page* -
because reusing a saved Template on a page like one you have used before is the
product. Measured against real URL shapes, the implementation did not do that,
and the reason was worse than under-matching.

`buildPageIdentityKey` returned `null` for any address it could not fully
classify. `resolveFieldContext` treats a `null` key as *brand new page*: it
mints a fresh Page and Field Profile. So on those sites a Template saved on a
page was orphaned by **the next reload of the identical address**, not merely by
a different record. Reproduced against the real repository before the change:

```
Stripe-style id page:  visit 1 bind -> visit 2, same URL -> recognized: false, 0 offered
numeric id page:       bind on /customers/12345 -> /customers/99999 -> recognized: true, 1 offered
```

The Logical Page mechanism could not rescue those pages either: candidates are
gated on `isDynamicLogicalPageRoutePattern`, and `buildRoutePattern` returned
`null` for the same addresses. So recognition was excellent for one identifier
shape and absent for the rest, with nothing in the interface saying so.

A survey of twenty-eight real-world address shapes produced `null` for UUIDv7
(now several databases' default), Mongo ObjectIds, Stripe-style prefixed ids,
Salesforce ids, nanoid/base62 tokens, Jira and Linear issue keys, record-name
slugs, WordPress `post.php?post=…&action=edit`, `?tab=billing`, `?page=2`, and
every hash-routed application.

### What Changed

**1. Every address gets an identity.** A segment or query value that cannot be
classified is **hashed** rather than rejected - the technique this file already
used for numbered document filenames, for the same reason: the key stays stable
and opaque, and no readable text reaches storage. This alone fixes "identical
address forgets", which was the severe half of the defect.

**2. The identifier alphabet is wider.** `:record` now also covers any UUID
version (not just v1-v5), long hex runs (Mongo ObjectId, git sha), prefixed
opaque ids (`cus_…`), and issue keys (`PROJ-123`). A random-looking
alphanumeric token needs ten characters and genuinely interleaved digits, so
that a product name like `office365` stays a route rather than collapsing with
`office2019`.

**3. A record-name slug before an action word is the record.**
`/customers/morgan-reed/edit` and `/customers/alex-kim/edit` are now one page.
This previously rejected the whole address; `:record` retains strictly less than
that rejection did, since it keeps no readable text at all.

**4. Query parameters no longer cost an address its identity.** The key stays
readable when it is an ordinary identifier - a query key is chosen by whoever
built the site - and the value, where a person's own data would appear, is
hashed unless it is one of the known route words. Per-visit noise (session,
token, timestamp, cache-buster) is dropped, as tracking parameters already were.

**5. Route-shaped fragments count.** `location.pathname` excludes the fragment,
so every page of a hash-routed application collapsed onto one identity -
`/app#/customers/12` and `/app#/settings` were the same Page Profile. This is
the one place the file **over**-matched. A `#/...` fragment is now part of the
address; a plain `#section` anchor is not, because that is a position within one
page.

**6. `buildRoutePattern` mirrors all of it**, so Logical Page matching can run
at all on those sites. `:number` and `:uuid` are **frozen** - a confirmed Rule
stores this string and is matched by exact equality - so new shapes take their
own `:id` token rather than being folded into the existing two.

### Migration Safety

The change is **additive**: every address that produced a key before produces
the byte-identical key now, and only addresses that produced `null` gained one.
A stored Page Profile is found by exact key match, so anything else would
silently orphan Bindings that already exist. `page-identity-coverage.test.ts`
freezes twenty-four keys and five route patterns against exactly that.

The one exception is hash-routed addresses, whose key necessarily changes
because it previously ignored the part that identified the page. That is the
correctness fix in item 5, and it affects only addresses with a `#/` fragment.

### Result

Across the same twenty-eight shapes: **no address produces `null`**, and the
route families offered to Logical Page matching went from four to ten. What
remains stable-but-not-generalizing - a bare nanoid, a slug with a year, an
Airtable base - keeps its own address's memory and can still be generalized by
the user through Logical Page confirmation once Slice 2 lands.

### Slice 2 — Comparability Is A Route Family (2026-09-09)

Slice 1 gave every address an identity. Slice 2 makes the field-similarity
recovery - the owner's "compare what I am looking at against Page 1, and if it
is the same show me T1" - reachable at all, **keeping the confirmation step**.
The owner chose that explicitly: a similarity judgement can be wrong, and being
wrong means showing one page's Templates on another; one confirmation is cheap
and permanent.

**The gate is gone.** Observations were recorded, and candidates offered, only
for an address whose pattern already spelled `:number` or `:uuid`. On every
other site there was never anything stored to compare against, so the mechanism
could not run even in principle.

**Comparability is now a route *family* rather than an identical pattern.** Two
addresses are one family when they have the same shape and differ in at most one
position - which is exactly what `:number` and `:uuid` already expressed,
generalized to a position the pattern builder could not name. So
`/jobs/data-analyst/apply` and `/jobs/senior-engineer/apply` are comparable,
where before they were two unrelated strings.

The floor that keeps this from meaning nothing is **at least one shared literal
segment**. Shared wildcards do not count: `/orders/:number` and
`/customers/:number` have a position in common that matches anything, which is
not structure - they are an order and a customer. Without any floor, `/contact`
and `/about` would be one family on the strength of having nothing in common.

Nothing here decides two pages are the same. It decides only that they are close
enough to be *compared*; both Jaccard thresholds and the user's confirmation
still stand between this and any match.

**A confirmed Rule stores the family, and is matched by pattern.** It used to
store the address the user happened to be standing on and be matched by string
equality - so a Rule covered only the address that created it unless that
address already carried a wildcard. A Rule now stores the generalized pattern
(`/jobs/:id/apply`) and is matched segment-wise with its own wildcards standing
for any value. That is a superset of equality, so every Rule confirmed before
this keeps working unchanged.

**The stored-state validator followed.** A Route Pattern no longer has to
contain a dynamic segment - a Rule confirmed between two all-static patterns is
now legitimate - and `:id` and `seg-v1:<hash>` segments are admitted. The shape
check itself is unchanged and still rejects anything carrying raw address text.

Verified end to end against the real repository, which is the owner's scenario:

```
bind T1 on /jobs/data-analyst/apply
open /jobs/senior-engineer/apply   -> candidate offered, not taken
confirm once                       -> Rule "/jobs/:id/apply", T1 offered
open /jobs/product-manager/apply   -> recognized, never asked again, T1 offered
open /employers/contact            -> not offered (no shared structure)
```

### Acceptance Criteria (Slice 2)

6. A sibling page differing in one segment is offered as a candidate, and is
   not matched without the user's confirmation.
7. One confirmation covers the whole route family, including addresses never
   visited.
8. A page with no structural overlap is not offered, however similar its fields.
9. Every Rule confirmed before this change still matches its own addresses.

### Acceptance Criteria

1. No real-world address shape produces a `null` identity key.
2. Every address that produced a key before produces the identical key,
   asserted by a frozen corpus.
3. `:number` and `:uuid` are unchanged in route patterns.
4. No readable path segment or query value appears in any key.
5. Two addresses that differ only by record collapse to one key for every
   identifier shape in the survey; addresses that are genuinely different pages
   do not.


## Addendum D — Advertising And App-Version Parameters Are Not Page Identity

**Status:** **Complete and accepted on 2026-09-09** with Task 036, whose QA
found it.
**Origin:** The owner's ChatGPT and Gemini recordings, 2026-09-09.

### The Defect

A Template bound on ChatGPT's new-conversation page was never offered there
again, while every conversation page behaved perfectly. The owner's recording
of the Field's own evidence showed it byte-identical throughout, so the Field
was not the variable - the address was.

The owner had reached ChatGPT from a search advertisement, so that page's
address carried fifteen parameters: `utm_source`, `utm_medium`,
`utm_campaign`, an eight-member `c_*` campaign family, `gad_source`,
`gad_campaignid`, `gbraid` and `gclid`. `buildPageIdentityKey` hashes an
unfamiliar query value into the identity, so the advertised `/` and the plain
`/` returned to later were two Page Profiles. Gemini's advertised address
carries the same shape plus `is_sa`, two `-min-version` parameters and Apple's
`pt`/`mt`/`ct` campaign triple.

The existing tracking list covered `utm_*`, `gclid`, `dclid`, `fbclid`,
`msclkid` and `mc_*` - the right idea, and too short to survive a real arrival.

### The Change

The list now covers the documented advertising, analytics and app-version
parameters: the `utm_*`, `gad_*` and `mc_*` prefixes, any `*-min-version`, the
click identifiers (`gclid`, `gclsrc`, `dclid`, `gbraid`, `wbraid`, `fbclid`,
`msclkid`, `ttclid`, `twclid`, `yclid`, `igshid`, `epik`, `rdt_cid`,
`li_fat_id`, `s_kwcid`), the analytics cookies (`_ga`, `_gl`), the generic
campaign identifiers (`campaign_id`, `ad_id`, `adgroup_id`, `creative_id`,
`keyword_id` and their compact spellings), `is_sa`, and the `c_*` campaign
family.

Apple's `pt`/`mt`/`ct` triple is dropped **only when all three appear
together**. Individually they are two-letter keys an application could mean
anything by; together they are the campaign link's own signature.

Verified: ChatGPT's advertised address and Gemini's both now reduce to exactly
the identity of their clean equivalents.

### What Did Not Change

An unfamiliar parameter still counts towards identity. `?entity=customers` and
`?entity=invoices` are genuinely two pages, and that judgement is the reason
this list is a denylist of documented names rather than an allowlist of
recognized ones.

### Migration

A Page Profile stored under an address that carried one of the newly listed
parameters is orphaned - its Templates survive and stay findable by Search, but
they are no longer that page's. This affects only pages a user reached through
an advertising or analytics link, which is the case the change exists to fix.


## Addendum E — Random Tokens With Fewer Than Two Digits

**Status:** Implemented with automated evidence on 2026-09-10; passed the
owner's hands-on QA on Copilot on 2026-09-11 (a Template bound in one
conversation is offered in another).
**Origin:** Task 036's Copilot recording. One conversation address,
`/chats/YJerjMvianTgauYwww3zU`, was a separate Page, so Templates bound in
other conversations were never offered there.

### The Defect

The random-token rule in `isRecordIdentifierShape` requires at least two
digits. Copilot's conversation ids are 21 base62 characters; about one in eight
has fewer than two digits, so its segment was hashed as its own route. About
one in forty has no digit at all.

### Decision

The owner chose option 2 of four (keep, lengthen-and-loosen, use letter case,
manual page pairing) on 2026-09-10, and asked for a second rule built on their
own observation: an identifier is a random mix of digits and upper- and
lower-case letters, while a different page's segment is made of meaningful
words.

### Contract

One rule is added; every existing rule is unchanged. A segment is a record when,
read **as written** (before the address is lower-cased):

- it is at least 16 characters of letters and digits only, with both upper-
  and lower-case letters;
- it is **not word-shaped** - not camelCase or PascalCase, where every capital
  after the first character starts a run of lower-case letters or digits; and
- its **lower-case runs are short**: their mean length is under 3.

The last condition is what separates a random token from a readable segment
that merely breaks camelCase. Acronyms do that (`SSOConfiguration`,
`ExportToPDFReport`), but the words around them keep long lower-case runs;
random base62 averages under two letters per run.

It applies to Page identity and to Logical Page route patterns alike.

### Revised After Independent Review (2026-09-10)

The first implementation, `e0e7384`, had two rules and no run-length
condition. The Spec review measured it: 16 of 22 readable mixed-case segments
(`SSOConfiguration`, `LDAPConfiguration`, `DirectXShaderCompiler`, ...) became
records, so `/Settings/SSOConfiguration` and `/Settings/LDAPConfiguration` were
one Page. Its second rule - one digit is enough in a long single-case token -
merged readable slugs such as `html5bestpractices` and `css3flexboxtutorial`,
and helped no mixed-case id at all. That rule was removed, which departs from
the letter of the owner's option 2; its purpose, the one-digit Copilot id, is
met by the rule above.

Measured over two million random 21-character base62 ids and the same 22
readable segments:

| Version | Random ids missed | Readable segments taken as records |
| --- | --- | --- |
| Before this Addendum | 12.5% (1 in 8) | 0 |
| `e0e7384` | 0.17% (1 in 590) | 16 |
| This contract | 1.0% (1 in 100) | 0 |

### Consequences, Stated Plainly

- A Page Profile stored under the old hashed segment for such an address is no
  longer found: those addresses now join `:record`. Its Templates stay in the
  library and are found by Search; a Binding made only on that one address
  must be made again. No migration is possible - the stored key is a hash of
  the segment, which cannot be re-classified.
- The same holds for a **confirmed Logical Page Rule** whose stored pattern
  kept such a segment as a hashed literal: it no longer matches, and the user
  confirms the pages again when offered.
- Such an address now has record evidence, which the rest of
  `buildPageIdentityKey` already treats as it does for any record: the
  `id`/`name`/`customer`/`record` query keys are dropped, and an address of
  three or more segments keeps its readable route words instead of becoming
  one opaque hash. Only route words reach the key, as for every other record
  address.
- About one random mixed-case id in a hundred is still missed - mostly those
  that happen to be word-shaped or have long lower-case runs.

### Acceptance

1. `/chats/YJerjMvianTgauYwww3zU` and `/chats/9d3HfAW8hanR1ENuCNrKt` are one Page
   and one route family; so is a digit-free random token such as
   `hKQzmPwRtyvBnXcLsDfGA`.
2. Readable camelCase and PascalCase segments, acronym-bearing ones such as
   `SSOConfiguration`, `office365`-shaped segments and lower-case one-digit
   slugs stay apart, for Page identity and route patterns.
3. Every frozen key and frozen route in `page-identity-coverage.test.ts` is
   unchanged.
4. `npm run check` and the complete headed Playwright suite pass.

### Evidence

`tests/unit/page-identity-coverage.test.ts`: the two random-token cases fail
before this Addendum and pass with it; the keep-apart case fails against
`e0e7384` and passes with this contract; every frozen key and route is
unchanged.
