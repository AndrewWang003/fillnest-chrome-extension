# FillNest Context

FillNest provides user-controlled, field-aware plain-text templates inside authorized websites. This glossary defines the product language independently of implementation details.

## Template Language

**Template**:
A reusable plain-text record in the user's global local library.
_Avoid_: Snippet, saved answer, autofill value

**Template Preview**:
A derived, shortened view of a Template's first non-empty line used for identification in lists.
_Avoid_: Title, template name

**User Tag**:
Deferred optional user-authored metadata that may later help organize and search Templates. User Tags are not part of the default Task 003 UI.
_Avoid_: Category, Site Affinity

## Website And Field Language

**Site**:
A user-recognizable website group based on a registrable or main domain. Scheme, port, and subdomain do not create different Sites; different registrable or main domains do.
_Avoid_: Exact origin, host permission

**Permission Origin**:
The concrete browser origin of the current page for which the user is considering access.
_Avoid_: Site, Page Profile

**Permission Host Pattern**:
The Chrome match-pattern representation requested, checked, or removed through the Permissions API for one Permission Origin.
_Avoid_: Site, Site Affinity

**Website Access**:
The user-facing expression for whether Chrome has granted FillNest the Permission Host Pattern for a Permission Origin. Website Access is independent of whether FillNest is currently Active or Paused there.
_Avoid_: Site state, FillNest activation

**Global Activation**:
The remembered top-level Active or Pause state for FillNest page behaviour. Global Pause suppresses every FillNest page surface while preserving Website Access, Origin Activation preferences, and business data.
_Avoid_: Website Access, permission removal

**Origin Activation**:
The remembered Active or Pause state for field-level FillNest behaviour on one authorized Permission Origin. Origin Pause may retain only the Page Status Control needed for explicit reactivation; it cannot be Active without Website Access and is distinct from Site Affinity.
_Avoid_: Website Access, Site Affinity, Site state

**Fixture Origin**:
The concrete local origin that serves a synthetic test page, including its scheme, host, and port.
_Avoid_: Site, production website

**Site Affinity**:
A soft association that helps users understand where a Template was created or used. It is not access control and deliberate Search can find affiliated Templates across Sites.
_Avoid_: Site restriction, site-only Template, security boundary

**Rich Text Field**:
An eligible `contenteditable` editing host, treated as one Field. It qualifies
only by declaring itself through `role="textbox"` or an accessible name, and
never through a site-specific selector or editor identity. FillNest reads and
inserts plain text only.
_Avoid_: Rich text editor, WYSIWYG, composer, chat box

**Insertion Rejection**:
The remembered fact that one Field's editor did not accept an insertion. It is
a single boolean on that Field, recording no Template, page content or reason,
cleared by the next successful insertion. It causes FillNest to offer a
clipboard copy up front; it never causes FillNest to write the clipboard.
_Avoid_: Insertion error, failed field, blocked site

**Page Profile**:
A persistent representation of one logical page type within a Site, independent of record-specific identifiers.
_Avoid_: Exact URL, browser tab

**Logical Page Matching Rule**:
A user-confirmed, Origin-scoped rule that recognizes a normalized Route Pattern
and local semantic signatures as one Page Profile. It persists only
Site-specific keyed hashes of eligible Field evidence, never raw page text,
field values, selectors, DOM paths, or complete DOM structure.
_Avoid_: URL wildcard, automatic semantic recommendation, cross-Origin rule

**Field Profile**:
A persistent representation of one logical supported field within a Page Profile.
_Avoid_: DOM node, current input element

**Target Field**:
The supported field that opened the current Inline Picker interaction and receives an explicitly selected insertion.
_Avoid_: Active element, current field

**Binding**:
A user-confirmed relationship between one Template and one Field Profile. Saving a new Template from a Target Field confirms and creates its initial Binding by default; the user may later Unbind it.
_Avoid_: Automatic match, recommendation

**Shared Template Set**:
A user-created, named group of Field Profiles that share one ordered list of
Shared Template Slots. Members resolve that list individually - see Shared
scope - so a Set is not a guarantee that every member sees the same Templates.
Task 021 creates and manages Site-local Sets; Task 024 may explicitly extend a
Set across Sites through `Link templates`. Membership is always explicit; it is
never inferred from a URL, label, name, ID, or DOM similarity. A Field belongs
to at most one Shared Template Set at a time. Distinct from a Template Share
Package, which is a `0.2.1` user-to-user artifact, and from "team sharing",
which is a V1 non-goal: a Shared Template Set is local and joins Fields, not
people.
_Avoid_: Automatic field group, semantic match, Logical Page Matching Rule, team sharing

**Shared scope**:
The state of a Field Profile that is a Shared Template Set member. Its effective
Template list is the Set's Slots resolved one Slot at a time against that
Field's own Override or Exclusion, with owner-only Slots resolved by their owner
alone. Its own direct Bindings become dormant rather than deleted, and become
effective again if the Field leaves or the Set ends - which is why a Set member
cannot hold a private Template as a direct Binding, and uses a Field-only
relationship instead.
_Avoid_: Merged Bindings, combined list, one list per Set

**Shared Template Slot**:
One entry in a Shared Template Set's ordered list, holding a base Template and
its own stable identity. The Slot, not the Template, is what members resolve
against, so a Set-level Template swap preserves every Override and Exclusion
keyed to that Slot.
_Avoid_: Shared Binding as a Template reference, Set membership row

**Override**:
One member Field's own replacement Template for one Slot. It changes what that
Field resolves for that Slot and nothing else; every other member stays on the
Slot's base.
_Avoid_: Fork, branch, local copy

**Exclusion**:
One member Field's decision that one Slot resolves to nothing for it. The Slot
and its base Template are untouched for every other member.
_Avoid_: Unbind, delete, hide

**Field-only relationship**:
A Shared Template Slot with one owner Field, resolved by that owner alone and
invisible to every other member - in their Picker, Side Panel, Search, Finder,
and Bind actions alike. Its audience never widens through a membership or
environment change; only its owner can widen it, through Promotion. Because it
is a Slot, it exists only inside a Set: a Field with no Set holds ordinary
direct Bindings, which have no audience to widen.
_Avoid_: Private Template, field-only Template, restricted Template

**Audience**:
The set of Fields that can resolve a Template through one particular
relationship. Audience belongs to the relationship - a Binding, a Slot, or a
Field-only Slot - never to the Template record, which stays reusable content.
The same Template may be one Field's Field-only Slot, another Set's ordinary
Slot, and a third Field's direct Binding at the same time.
_Avoid_: Template visibility, template permission, private flag

**Promotion**:
The explicit `Share this version` action by which an owner widens a Field-only
relationship into an ordinary Shared Template Slot. It is the only action
allowed to do so; membership operations never do. When the Set already holds an
ordinary Slot for the same Template, Promotion collapses the two, folding the
Field-only Slot's usage into the surviving Slot.
_Avoid_: Make normal, unlock, publish

**Collapse**:
Presenting the several relationships a single Field may hold to one Template as
one visible item, while retaining each relationship's provenance so an action
still targets a specific one. A Field never sees the same Template twice.
_Avoid_: Deduplicate, merge Templates

**System Display Label**:
A privacy-safe, human-readable label derived from stable Page Profile or Field Profile evidence for management views. It never participates in identity or matching.
_Avoid_: Identity key, raw URL, page title

**User Alias**:
An optional user-authored display name for a Page Profile or Field Profile. It changes presentation only and never changes identity or matching.
_Avoid_: Identity key, User Tag

**Global Template**:
A Template with no Site Affinity. It is listed separately from the Binding-based location tree and remains eligible for deliberate Search on authorized websites.
_Avoid_: Automatically recommended Template, unrestricted Binding

## Recognition And Discovery Language

**Field Eligibility**:
The decision about whether a page control is genuinely a user-authored plain-text destination rather than a sensitive, special-purpose, or externally controlled value widget. A text-like control is eligible by default unless ordered evidence provides a high-confidence veto.
_Avoid_: Field Match Confidence, text input type

**Field Match Confidence**:
The decision about whether the current field is reliably the same logical field as a stored Field Profile. V1 treats the result as recognized or unrecognized.
_Avoid_: Template score, fuzzy Binding

**Observed Field Title**:
The local display title captured only when the user explicitly creates or binds a Template on that Field. It is derived from the page's associated label, `aria-label`, placeholder, name, or id in that order. It improves management readability but never participates in Field Match, Binding resolution, recommendation, or insertion.
_Avoid_: Field identity, User Alias

**Template Discovery**:
The user's deliberate act of finding Templates through full-library literal body Search. Discovery trims only outer query whitespace and uses case-insensitive substring matching; it never identifies a field, predicts a field's content, or creates a Binding.
_Avoid_: Template Relevance, Field Match Confidence, automatic Binding

**Inline Picker**:
The contextual FillNest interface opened when the user activates the FillNest control for a supported Target Field.
_Avoid_: Autofill panel, whole-page assistant

**Picker Undo**:
A field-scoped, interface-scoped, single-last-action reversal for key Template operations in the Inline Picker. It is not persistent history and fails closed when later accepted data changes conflict.
_Avoid_: Version history, backup, restore

**Keep Open**:
An Inline Picker mode that keeps the Picker visible while the user works, allows header dragging, and uses one global floating Picker position. Ordinary Picker mode still opens next to the Target Field.
_Avoid_: Pin as data binding, saved field position

## Management Language

**Extension Popup**:
The compact interface opened from the Chrome toolbar for Global Activation, current Permission Origin access and activation, and entry to FillNest management.
_Avoid_: Side Panel, Options Page

**Side Panel**:
FillNest's primary management surface for Overview, Templates, Sites, and Settings. It is available independently of Website Access for the current page.
_Avoid_: Options Page, Inline Picker

**Page Status Control**:
The single page-level control that displays and toggles Origin Activation on an authorized Permission Origin while Global Activation is Active.
_Avoid_: Field Picker control, Extension Popup, Website Access action

**Site Data**:
The local Site, Page Profile, Field Profile, Binding, Logical Page Matching
rule, semantic signature, relationship provenance, display-label, and alias
records associated with a Site. `Clear site data` removes it while retaining
Website Access. The explicit `Remove site` flow deliberately clears it before
revoking Website Access; neither action automatically deletes Template records.
_Avoid_: Website Access, all related Templates

## Data Portability Language

**Backup Archive**:
A versioned local JSON export of one user's complete restorable FillNest business data, durable preferences, and remembered Activation preferences. It never represents Chrome-granted Website Access.
_Avoid_: Template Share Package, Import package, sync data, permission backup

**Restore**:
The validated all-or-nothing replacement of current FillNest data and applicable preferences from a compatible Backup Archive. Restore is not a merge and does not grant Website Access.
_Avoid_: Import, merge, permission restore

**Import**:
A deferred post-MVP operation that may add or merge supported external data after a separate validation and conflict-resolution flow. No Import API, schema, or UI exists in V1.
_Avoid_: Restore, Backup Archive

**Template Share Package**:
A future export containing only explicitly selected Template data intended for another person.
_Avoid_: Backup Archive

## Simplified Chinese Glossary

Task 037. The Chinese half of the terms above. `src/i18n/messages.zh-Hans.ts`
follows this table; nothing else in the repository contains Chinese prose.

| English | 中文 | Note |
| --- | --- | --- |
| Template | 模版 | |
| Field | **输入框** | Never 字段 - see below |
| Site | 网站 | |
| Page | 页面 | |
| Binding / Bind | 绑定 | |
| Shared Template Set | 共享模版组 | 集合 reads mathematical |
| Insert | 插入 | |
| Inline Picker | 模版面板 | Not a literal "picker" |
| Side Panel | 侧边栏 | |
| Website Access | 网站授权 | |
| Backup / Restore | 备份 / 还原 | |
| Reset FillNest | 重置 FillNest | The product's name stays English |

**`Field → 输入框` is the load-bearing entry.** Task 024 Addendum C.1 found
that "field" is jargon ordinary people do not know, and changed the English to
say "box". Translating it as 字段 - a harder technical term than the English it
replaces - would rebuild that defect in a second language. A unit test asserts
字段 appears in no message.

A word the **user** typed is never translated, and neither is a word taken from
a web page: Template content, user-given names, Site names, page names, and a
Field's name derived from page markup all stay exactly as they are.

## Future Language

**Contact**:
A future user-authored structured record containing explicitly named contact values. A Contact is not a plain-text Template; selecting one Contact may prepare only the user-visible fields that were deliberately recognized and confirmed for that Contact interaction. It is outside V1.
_Avoid_: Multi-field Template, parsed Template, automatic contact inference

**Contact Field**:
A field role explicitly recognized for a Contact interaction, such as name, email, or phone. Recognition must not read or infer the field's existing value, and it never authorizes filling a non-confirmed field.
_Avoid_: Semantic recommendation, unrestricted field match

**Parameterized Template**:
A future Template form containing literal text and user-authored variable slots. The user supplies slot values in an extension-owned interaction before explicitly inserting the rendered plain-text result into one Target Field. It is outside V1.
_Avoid_: HTML Template, executable Template, form autofill

**Conversation Prompt Field**:
A future, opt-in logical field representing the user-authored message composer on a specifically supported conversational AI website. It may be shared across those supported websites only when the user deliberately creates or binds a Template there; it does not read, infer from, or send conversation content. It is outside V1.
_Avoid_: All textareas, chat history, automatic prompt suggestion, whole-message submission
