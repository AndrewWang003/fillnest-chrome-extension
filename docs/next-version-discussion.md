# Next-Version Discussion Queue

This is a discussion queue, not authorization to implement any item.

## Readable Path Segments As Logical Page Record Identity

**Largely superseded by Task 014 Addendum C (2026-09-09).** A record-name slug
before an action word is now `:record`, and comparability is a route family
rather than exact pattern equality, so the reported case is recognized when the
addresses share a literal segment. What remains open is only the root-level
case, recorded separately under `Root-Level Single-Segment Slugs`. The original
entry is kept below because its reasoning is what the new floor implements.

- **Not a defect in Task 020.** Found during the user's hands-on verification
  of Logical Page Matching (2026-09-01): `/static/andrew/1.1 Initial
  Information.html` and `/static/eve/1.1 Initial Information.html` never
  offer a Review candidate, while `/static/123/...` and `/static/234/...` do.
  This is `buildRoutePattern` (`src/recognition/logical-page-matching.ts`)
  working exactly as the accepted Task 014 contract specifies: "V1 recognizes
  only high-confidence dynamic path segments, including numeric and UUID
  identifiers. Readable arbitrary path segments are never generalized as
  IDs." A lowercase word is kept as literal static route text, never
  generalized to `:record`, precisely because a word is not reliably a
  record identifier the way a number or UUID is - it is equally likely to be
  a genuinely static page (`/static/pricing/...`), and generalizing it risks
  treating two unrelated static pages as "the same logical page" purely
  because their path happens to be a word. The user has not confirmed
  whether this narrower behaviour should change; it is recorded here rather
  than decided unilaterally.
- If a future workflow genuinely uses name-like or word-like slugs as record
  identifiers, decide what actually distinguishes "this segment identifies a
  record" from "this segment is a static page name" before recognizing any
  wider pattern - a wrong generalization here is a same-page misidentification,
  not merely a missed match, and the existing Field/semantic thresholds
  (0.85 Jaccard on both sets) exist to guard against exactly that failure
  mode at the matching stage, not the route-recognition stage.
- Any such widening needs its own Grill round and contract amendment to Task
  014, not an unreviewed change to `buildRoutePattern`; it changes an
  explicit, accepted privacy/conservatism boundary, not an implementation
  detail.

## Root-Level Single-Segment Slugs

**Declined by the project owner on 2026-09-09 after hands-on QA of Task 014
Addendum C.** The current behaviour stays exactly as it is.

- **Reported.** On `demo.nopcommerce.com`,
  `/nike-sb-zoom-stefan-janoski-medium-mint` and
  `/nike-floral-roshe-customized-running-shoes` are never offered as the same
  Logical Page, and no Review candidate appears at all.
- **Why.** Both addresses are one segment below the root, so they share no
  literal segment. `routeFamily` requires at least one shared literal segment
  before two addresses are even comparable
  (`src/recognition/logical-page-matching.ts`). The same mechanism succeeds on
  `/careers/<slug>`, `/apply-job/?job_title=<value>`, and
  `/jobs/<slug>/apply`, all verified in the same session, because each shares
  a literal segment.
- **Why widening it is worse than the gap it closes.** Removing the floor makes
  every root-level page on a Site one route family: `/login`, `/register`,
  `/contact`, `/about`. The similarity thresholds do not rescue this. Password
  fields are excluded from eligibility, so a login page and a registration page
  can both reduce to a single email Field - an exact signature match, above
  both `0.85` thresholds. FillNest would then actively offer the confirmation,
  and a user who accepts it gets one page's Templates on the other,
  permanently. The floor exists to prevent precisely that.
- **Scope of the gap.** Sites that flatten record pages to the root, typically
  e-commerce product pages. Those pages carry no form worth a Template, which
  is why the owner judged the trade acceptable.
- Any future attempt needs a different discriminator than "one differing
  segment" - something that distinguishes a flat record page from a flat static
  page - plus its own Grill round and a Task 014 contract amendment.

## Manual Page Pairing

**Raised during the Task 036 grill, 2026-09-09. Not authorized; recorded as its
own future contract rather than folded into Task 036.**

- **The problem.** Two Page Profiles on one Site can be genuinely the same page
  to the user while being incomparable to the route mechanism, because their
  segment counts differ: `chatgpt.com/` and `/c/:record`, `claude.ai/new` and
  `/chat/:record`, `gemini.google.com/app` and `/app/:record`. No Review
  candidate is offered, because comparability is the gate that produces the
  offer.
- **Why not loosen `routeFamily`.** A "differs by one trailing segment" rule
  reaches only the third shape, and it makes a list page and a detail page one
  family - `/products` and `/products/:id` - which can both reduce to a single
  search box and produce a confident, wrong offer. Evaluated and rejected in
  Task 036.
- **The shape of the fix.** Let the user declare two Page Profiles equivalent,
  explicitly, choosing the other page from the Pages they already have Bindings
  on within the same Origin. No inference of any kind, so no false-match risk,
  and it is useful on every Site rather than on chat sites.
- **What it would need.** A new rule kind - an alias between two page
  identities, distinct from the existing Route Pattern rule - with its own
  entry in Backup, Clear Site Data, Remove Site and `Stop matching`; a place in
  the UI to create and see it; and a decision about whether an alias composes
  with a confirmed Route Pattern rule or stands alone.
- **The interim answer** is Task 024's `Link templates`, which reaches the same
  practical result at Field granularity with one explicit confirmation.

## One Composer Identity Per AI Site

**Asked by the project owner on 2026-09-09, after Task 036's QA.** Not
authorized; recorded as a product question.

- **What was observed.** On Claude, the new-conversation page, Chat and Cowork
  each behave correctly and each shares Templates within itself - but they are
  three Page Profiles, so they are three Fields with three Template lists. The
  owner's point: most people want the same prompts in all three.
- **What already works.** `Share with…` links any two of them in one explicit
  confirmation, and once linked they share for good. The owner used it
  successfully on both Claude and Gemini.
- **Why the automatic offer fades.** Task 024 offers a link automatically only
  when there is exactly **one** high-confidence candidate. With three composers
  on one Site the second link has two candidates, so the offer goes quiet -
  precisely as the user accumulates the Fields they most want linked.
- **The option worth considering.** When every high-confidence candidate on a
  Site is a rich-text host, offer them **as a group**: "link this composer with
  the others you have used on this site?", one confirmation, all of them. That
  keeps the rule the product is built on - FillNest never guesses a
  relationship into existence - while removing the part that does not scale.
  It needs a Task 024 addendum.
- **What must not happen.** Linking them silently. Two Fields on two pages are
  the same Field only because a person says so; that is the whole basis of the
  Shared Template Set design, and of the Logical Page confirmation before it.

## Shared Conversation Prompt Field

- Evaluate a dedicated, opt-in **Conversation Prompt Field** scope for user-authored message composers on conversational AI websites, such as GPT and Gemini. This is a product scope, not a rule that every `textarea` on those websites is eligible.
- A Conversation Prompt Template must be one shared logical field across supported conversation websites: a Template deliberately bound there is available in the same Conversation Prompt Field on every supported conversation website, rather than creating separate Site-specific bindings.
- Define an explicit support allowlist, an eligibility contract for ordinary message composers versus search boxes, code editors, attachment captions, hidden textareas, and rich-text editors, plus behavior when an interface changes. Unknown controls must fail closed and receive no marker, listener, or value read.
- Preserve the current privacy boundary: recognize the control from structural and accessibility metadata only; do not read, persist, or infer from a user's conversation, draft, selection, prompt, or submitted message. Filling remains a deliberate single-field insertion and never sends a message.
- Decide user-facing ownership and management: whether Conversation Prompt Templates appear as a dedicated location in Templates, how users bind/unbind or delete them, how the shared field is represented in backup/restore, and how it coexists with Global Templates without duplicate results.
- Validate keyboard navigation, accessible announcement, dynamic composer replacement, multi-tab behavior, signed-out pages, and supported-page regression fixtures before authorizing implementation.

## Agent-Assisted Form Completion Bridge

- Explore a post-Beta, separately authorized product mode in which a user can deliberately send a reviewed form-structure snapshot to an external coding or AI agent, such as Codex, receive a versioned structured completion plan, and choose whether to apply that plan to the current page. This is not part of the current local-only product, Chrome Web Store Beta, or V1 field workflow.
- Treat the integration as a bridge protocol rather than arbitrary JSON or executable instructions. A returned plan must identify its protocol version and each intended target, use plain-text values only, be strictly validated against the current eligible Fields, and never execute page or remote code.
- Evaluate three delivery architectures before choosing one: a user-installed local companion bridge; a cloud relay/API with explicit authentication and privacy responsibilities; or a user-mediated export/import of the plan. Do not assume that an interactive Codex surface is a stable direct browser API.
- Preserve a deliberate approval boundary: the user reviews the current-page impact and explicitly applies it. The Bridge must not submit a form, trigger hidden actions, alter non-approved Fields, or continue after the page, Field eligibility, or form revision changes.
- Define the data-disclosure boundary before any prototype. The unresolved choice is whether the Agent receives only user-selected Field metadata, explicitly selected current values, or broader page/form content. No page content, Field values, credentials, sensitive information, or conversation text may leave the browser before this decision, a clear user disclosure, and affirmative consent.
- Require a threat model and a failure model: endpoint authorization, replay protection, expiry, response provenance, schema validation, stale-form detection, partial failures, cancellation, auditability local to the user, and safe behavior when the agent, relay, or local bridge is unavailable.
- Any chosen network or companion architecture changes the current local-only/no-network baseline and Chrome Web Store privacy posture. It requires a dedicated Task Contract, current policy review, consent and privacy-policy design, security review, and independent end-to-end tests before implementation.

## Interaction Feedback Consistency

- Inventory every user-visible Template mutation, removal, deletion, Undo, confirmation, and completion feedback across the Inline Picker, Templates Side Panel, Sites, and Settings before changing individual labels.
- Define one Action Outcome Bar vocabulary for reversible Template operations: Bind, Save everywhere, Save a copy here, Save for shared fields, Save for this field, Remove from this field, Delete template everywhere, batch deletion, and Undo. Each message must state the real scope and, where useful, the Template preview.
- Decide whether the Picker's Action Outcome Bar becomes its sole Undo entry. If so, it must retain the current cross-field Undo guarantee by explicitly naming the Field that owns an available prior action; a field change cannot silently make Undo unreachable.
- Align Side Panel Undo feedback with the same scope language and icon semantics while retaining a layout that cannot obscure panel controls. `Collapse Undo bar`, not `Hide this notification`, must describe a collapsible Undo affordance.
- Standardize non-Undo completion feedback for Remove access, Clear saved fields, Restore, and Reset. Short notices may remain, but destructive or replacement operations need a result visible in their originating Settings/Sites area until the user leaves or begins a related operation.
- Keep state controls distinct from notifications: Global Activation, Origin Activation, and Page Status Control communicate their current state through their own controls, not through Undo or one-shot completion messages.

## Side Panel Header And Notification Region

- Evaluate removing the standalone `FillNest` title/header from the top of the Side Panel to recover vertical space.
- Evaluate placing a non-interactive FillNest app icon at the left edge of the existing navigation bar. It must not be presented as a button or create an undisclosed navigation action.
- Reserve one notification/result region below scrollable Side Panel content, anchored at the bottom of the panel, for Side Panel-originated operations. Its relationship with the Interaction Feedback Consistency work must be explicit: this region may show non-Undo completion notices, while reversible Template operations retain the defined Action Outcome Bar/Undo treatment rather than producing duplicate messages.
- Validate narrow Side Panel widths, keyboard order, screen-reader announcements, focus restoration after a confirmation sheet closes, and the interaction between this region and a collapsed/expanded Undo affordance.

## Contacts And Confirmed Multi-Field Fill

- Decide the Contact schema: which named values exist, whether users can add custom values, and how Contact records are created, edited, deleted, backed up, and restored.
- Define Contact Field recognition as a conservative, privacy-preserving role classification. It must not read field values, make recommendations from page content, or fill a field that is not part of the confirmed Contact interaction.
- Decide the explicit confirmation boundary: selecting a Contact may prepare multiple recognized Contact Fields, but the user must be able to review the exact target fields and values before one deliberate fill action. No whole-page automatic fill or form submission is implied.
- Define partial and failure behaviour: unsupported, sensitive, ambiguous, disconnected, or externally controlled fields must fail closed without changing any other field. The user must receive a clear outcome for every requested field.
- Establish interaction and data boundaries with existing Templates: a Contact is a structured record, not a parsed plain-text Template; existing Template, Binding, and Search behaviour must remain intact.

## Parameterized Templates

- Define a Parameterized Template as literal text plus user-authored variable slots, rendered as plain text only after the user supplies values in an extension-owned interface. It must never interpret Template content as HTML or executable code.
- Decide slot syntax, labels, required/optional values, validation, default values, cancellation, keyboard traversal (including Tab and Shift+Tab), accessibility, and whether values remain only in the current interaction or can be deliberately saved.
- The initial interaction candidate is: the user chooses a Parameterized Template in the Inline Picker; FillNest displays its slots as extension-owned text inputs; after review, the user selects **Fill** to insert one rendered value into the current Target Field. This is not automatic multi-field filling.
- Define safe rendering, cursor/selection insertion, Undo, event dispatch, and failure semantics before implementation. The system must not insert partial output if a required slot is invalid or the Target Field becomes ineligible.

## Custom Control Support

- Decide whether a React-style multi-select combobox can ever be a valid Template destination. Its typed search text may not become a submitted value, so any support needs a widget-agnostic commit, insertion, safety, and undo contract.
- Decide whether and how to support `contenteditable` editors. The current insertion model relies on native input/textarea selection APIs; rich-text support requires separate security, selection, event, and undo rules.

## Sites And Templates Information Architecture

- Revisit the meaning and presentation of `No Access`. A Site can retain Templates and Site Affinity after Chrome Website Access is removed; this is intentional but may be confusing in a Sites-first view.
- Evaluate whether Sites and Templates should remain separate destinations or become a unified management surface. The evaluation must compare reduced navigation against preserving clear distinctions among Template ownership, Site Affinity, exact Permission Origin Website Access, and Origin Activation.
- Do not merge pages merely to hide `No Access`; any design must preserve safe Template deletion, explicit Website Access changes, and the current access/data separation.

## Generic Form Compatibility Learning

- Use authorized, local, or synthetic form fixtures, including the existing
  client-style simulated pages, as adversarial compatibility evidence for
  future generic FillNest capabilities.
- Treat findings as reusable problem classes, such as dynamic field creation,
  repeated labels, conditional sections, framework re-renders, field matching
  ambiguity, and grouped fields. Do not encode a site name, page identifier,
  branded terminology, DOM selector, or page-specific schema into generic
  product logic merely because it solves one fixture.
- Any future improvement must be expressed through site-neutral signals and
  conservative, fail-closed rules. A behavior that cannot be justified by more
  than one independent page or fixture remains an experiment, not a product
  matching rule.
- The purpose is to improve robustness across websites without turning FillNest
  into a branch tailored to any one named service.

## Repeated Record Context And Conditional Template Scopes

- **Deferred.** Treat repeated-record identity and conditional Template
  selection as two separate future capabilities. Neither is part of Shared
  Templates, and neither may be added opportunistically to that Task.
- A repeated form block can create several concrete occurrences of the same
  logical fields at runtime. Keep `FieldProfile` (what logical field this is)
  separate from `FieldInstance` (which concrete occurrence is currently on the
  rendered page) and from a generic `Repeat Context` (which instances belong
  to one repeated record).
- Deliver this capability in three separately testable stages: (1) Repeated
  FieldInstance Resolution, (2) Repeat Context Resolution, then (3)
  Conditional Template Scopes. Do not entangle the three failure modes in one
  feature.
- **Repeated FieldInstance Resolution** must map a newly added, removed,
  reordered, or re-rendered concrete field to an existing FieldProfile only
  when the generic evidence is reliable. Dynamic row indexes may be structural
  evidence, but are never sufficient on their own and are never persistent
  identity. Ambiguous structure must not inherit a Binding or active scope.
- **Repeat Context Resolution** must determine which different FieldInstances
  belong to one repeated record, without leaving stale controls or associating
  one row's field with another row's data. It is required for Conditional
  Template Scopes but not for ordinary Shared Template resolution.
- A dynamically added repeated group should resolve each of its fields to the
  existing logical FieldProfile only when that identity is reliable. If a
  FieldProfile belongs to a Shared Template Set, every reliably matched
  instance of that FieldProfile uses that set; the relationship is never
  persisted against a temporary row index or one DOM instance. An unresolved
  new instance fails closed rather than breaking or widening the Shared Set.
- This allows a user to share a logical field in the first visible group with
  another logical field while later-added groups continue to work: the sharing
  relationship attaches to FieldProfiles, not to "first row" elements. It does
  not imply that unrelated fields within a repeated group share Templates.
- The same visible label is not enough for a FieldProfile. A reliable profile
  must include sufficient logical-page and structural context to distinguish,
  for example, two different repeated collections that both contain a `Name`
  field. Attribute normalization, labels, local structure, and structural
  fingerprints are candidates for generic evidence; none alone authorizes an
  unsafe reuse.
- Keep persistent and runtime state strictly separate. Persistent data may
  contain FieldProfiles, direct bindings, Shared memberships, and future
  Conditional Rules. Runtime-only data contains FieldInstances, Repeat Context
  instances, DOM references, current ordering, row indexes, and current
  controller values. Runtime data must never become a long-lived Template
  Binding identity.
- The first narrow product boundary is profile-wide scope only: all reliably
  matched instances of one FieldProfile use the same direct or Shared effective
  scope. Do not support a different Shared Template Set for the first, second,
  or third occurrence of the same logical field. A site-provided stable record
  identity, if ever needed for per-record persistence, requires a separate
  future decision and contract.
- **Deferred User-Confirmed Repeat Reuse Rule.** A normal manual Create or
  Bind must never silently become a rule for future repeated instances. A
  later, separately contracted capability may let the user explicitly confirm
  that a Template scope should also apply to future members of one named,
  reliably identified repeat family. It must define the durable scope,
  confirmation wording, management and revocation UI, relationship precedence,
  Undo, Backup/Restore, Reset, and fail-closed behaviour when a new instance
  cannot be resolved to that family. It is not an alternative to generic
  Repeated FieldInstance Resolution and must not be inferred from one manual
  Binding.
- Conditional Template Scopes are a later capability for a different problem:
  a user explicitly declares that one enumerated controller Field controls
  which Template list is active for one or more dependent Fields in the
  **same** Repeat Context. The feature must not infer that semantic relationship
  from labels, values, DOM proximity, field names, or a website-specific rule.
- The future persistent relationship is conceptually: `controller
  FieldProfile + stable option identity + dependent FieldProfile → conditional
  Template scope`. Runtime resolution additionally pairs the dependent
  FieldInstance only with the controller FieldInstance in its own Repeat
  Context.
- Start narrowly if authorized: one enumerated controller (`select` or radio
  group) per rule, one conditional controller per dependent field, and no
  boolean expressions, free-text conditions, nested rules, or automatic
  semantic discovery.
- Changing a controller option may switch which Templates the Picker offers;
  it must never alter existing webpage content or automatically migrate,
  copy, merge, or delete Template data. An empty controller or an option with
  no mapping must safely fall back to the Field's normal effective scope.
- The exact priority between Conditional, Shared, and Direct scopes, the
  handling of a controller change while a Picker is open, Site Data cleanup,
  Backup/Restore, Undo, and user-facing configuration must be settled through
  a dedicated Grill Mode contract. A candidate V1 precedence to evaluate is
  `Conditional → Shared → Direct`, with no mixed lists in one Picker.
- Required first Grill question: how can FillNest prove that a dependent
  FieldInstance is paired with exactly one controller FieldInstance in the
  same repeated record, including dynamic DOM changes, while remaining generic
  and failing closed on ambiguity?

## Starting A Share From An Unshared Field

**Deferred by the owner on 2026-09-07 after hands-on QA of Task 027.** The
current behaviour stays exactly as it is. This is recorded as a possible future
feature, not an accepted gap.

### What Exists Today

`Share this version` promotes a Field-only relationship into an ordinary
Shared Template Slot. It appears on a Template row only when both conditions
hold:

1. the current Field is already a member of a Shared Template Set, and
2. that Field owns a Field-only relationship for that Template.

The reachable path is therefore: put the Field in a Set (`Share with…`), give
it a private version (`Save for this field` in the Set's compose view, or
`Bind to this field` from search), and the row then offers `Share this
version`, whose confirmation offers `Share with the Set` and `Share with a
different field…`.

### What Was Reported

The owner looked for `Share this version` on a plain, unshared Field that had
just had a Template created on it, and did not find it. That is the designed
behaviour - such a Field has neither a Set nor a Field-only relationship - but
it is not discoverable from where the owner was standing.

### The Deferred Scenario

Site 1, Page 1, Field A. Field A is in no Shared Template Set. The user creates
Template T on Field A, decides it should also be available on Field B, and
wants to start that from T's own row rather than from the Field.

Today the user must:

1. Recognise that sharing begins from the Field, not the Template.
2. Use `Share with…` in the Picker header to open the Field Finder.
3. Choose Field B, which creates the Set and shares Field A's Templates.

A future version could instead offer, from T's own row on an unshared Field, a
single action that opens the Field Finder with T already in hand, creates the
Set with the chosen target, and shares only T.

### Why It Was Deferred, In The Owner's Words

Two reasons, both of which are product judgements rather than technical ones:

- Users may simply not need it. The Field-first path already works, and
  demand for a Template-first path is unproven.
- Going from a Template to a Field and then sharing is not obviously a simpler
  route. It adds a second mental model - "share this Template with a Field"
  alongside "share this Field's Templates" - and two models for one outcome may
  cost more than the shortcut saves.

### A Second Decision Pointed The Other Way

Task 024 Addendum A, accepted and authorized the same day, specified exactly
this capability under the name `Share this template with…`. Its authorization
was withdrawn on 2026-09-08 so the two decisions agree. That contract remains
in `tasks/024-compatibility-candidate-suggestions.md` as the record of what was
specified; this section is the live one.

### What Any Future Implementation Must Not Do

- It must not change audience semantics. A Template on an unshared Field is
  visible to that Field alone until an explicit share, and Task 027 Addendum D
  keeps a `Save for this field only` Template private even after the Field
  later joins a Set.
- It must not make `Share this version` appear on a Field with no Set and no
  Field-only relationship. That row would have nothing to promote.
- It needs its own bounded contract before implementation, including whether
  the new action creates a Set implicitly and what its Undo restores.
