# FillNest Task Roadmap

This roadmap divides the V1 validation product into independently reviewed contracts. A Task may begin only after its contract is accepted and execution is explicitly authorized. Completion requires its own evidence and Spec and Project Standards review gate.

| Task | Contract | Outcome | Status |
| --- | --- | --- | --- |
| 001 | [Engineering Initialization And Technical Discovery](001-engineering-initialization-and-technical-discovery.md) | Proven MV3 foundation and single-field Template loop | Complete and accepted |
| 002 | [Interaction Surfaces And Navigation](002-interaction-surfaces-and-navigation.md) | Activation state, Popup, page status control, Side Panel, and basic real management views | Complete and accepted |
| 003 | [Template Library And Organization](003-template-library-and-organization.md) | Location-based Library views, aliases, usage ordering, field-scoped edit/copy, Undo, Keep Open, and deletion safety | Complete and accepted; 2026-09-11 addenda (pinned insertion selection; flyout, rename editors, pinned drag) accepted after owner QA |
| 004 | [Site Access And Data Management](004-site-access-and-data-management.md) | Permission Origin grouping, access removal, and impact-aware Site Data cleanup | Complete and accepted; Addendum B Criterion 3 stays marked not met, and its unproven cross-tab root cause was closed by owner decision on 2026-09-07 |
| 005 | [Template Discovery And Search](005-template-discovery-and-relevance.md) | Deliberate full-library Picker Search, current-Field-first ordering, and Site Affinity visibility | Complete and accepted |
| 006 | [Backup, Restore And Data Portability](006-backup-restore-and-data-portability.md) | Side Panel boundary prep, Repository integrity gate, then versioned local Backup and atomic Restore | Complete and accepted; Addenda A (lossless Restore, in-session fail-closed) and B (startup retry, Reset as the way out, language while closed) accepted 2026-09-11 after owner QA |
| 007 | [V1 Integrated Acceptance And Hardening](007-v1-integrated-acceptance-and-hardening.md) | Cross-feature production evidence and V1 acceptance handoff | Complete and accepted |
| 008 | [Architecture Maintenance Wave One](008-architecture-maintenance-wave-one.md) | Behaviour-preserving removal of superseded paths and first-wave message/ownership hardening | Complete and accepted |
| 009 | [Factory Reset](009-factory-reset.md) | Verified return to fresh-install local and Website Access state | Complete and accepted |
| 010 / 0.1.2 Task 01 | [Interaction Feedback Consistency](010-interaction-feedback-consistency.md) | Consistent operation outcomes, global Undo invalidation, and Picker Action Outcome Bar | Complete and accepted |
| 011 / 0.1.2 Task 02 | [Side Panel Header And Notification Region](011-side-panel-header-and-notification-region.md) | One global bottom-anchored result region and unified Side Panel Undo presentation | Complete and accepted |
| 012 / 0.1.2 Task 03 | [Sites And Templates Information Architecture](012-sites-templates-information-architecture.md) | Authorized-Sites-only management and rollback-safe Remove site | Complete and accepted |
| 013 / 0.1.2 Task 04 | [Generic Form Compatibility Learning](013-generic-form-compatibility-learning.md) | Conservative, site-neutral form compatibility improvements | Closed without execution; findings retained for future Tasks |
| 014 / 0.1.2 Task 05 | [Logical Page Identity](014-logical-page-identity.md) | User-confirmed, same-Origin logical Page identity across record-specific URLs | Complete and accepted; Addendum E (random-case tokens are records) passed the owner's Copilot QA on 2026-09-11 |
| 015 / 0.1.2 Task 06 | [Share Templates](015-share-templates.md) | Explicit named shared Template lists; Task 024 owns the controlled cross-Site extension | Complete and accepted via Task 021 |
| 016 / 0.1.2 Task 07 | [Eligibility And Lifecycle Contract](016-eligibility-lifecycle-contract.md) | An accepted, site-neutral boundary for the retained Task 013 findings | Complete and accepted |
| 017 / 0.1.2 Task 08 | [Eligibility Lifecycle Fixture Matrix](017-eligibility-lifecycle-fixture-matrix.md) | FillNest-owned synthetic regression cases for the accepted lifecycle boundary | Complete and accepted |
| 018 / 0.1.2 Task 09 | [Generic Eligibility And Lifecycle Improvement](018-generic-eligibility-lifecycle-improvement.md) | Narrow generic classification and content-script lifecycle hardening | Complete and accepted |
| 019 / 0.1.2 Task 10 | [Eligibility Lifecycle Acceptance](019-eligibility-lifecycle-acceptance.md) | Independent hands-on evidence for Task 018 | Complete and accepted |
| 020 / 0.1.2 Task 11 | [Logical Page Identity Implementation](020-logical-page-identity-implementation.md) | Implement the accepted Task 014 identity and migration contract | Complete and accepted |
| 021 / 0.1.2 Task 12 | [Shared Template Sets Implementation](021-shared-template-sets-implementation.md) | Deliver Task 015 in independently reviewed vertical slices | Complete and accepted; Addenda B (leaving and ending keep each Field's list; `Leave sharing`) and C (icon sharing actions) accepted 2026-09-11 after owner QA; Addendum A superseded by Task 040 |
| 022 / 0.1.2 Task 13 | [Current-State Documentation Alignment](022-current-state-documentation-alignment.md) | Evidence-based alignment of current-state documentation | Complete |
| 023 / 0.1.2 Task 14 | [Cross-Surface Accessibility Hardening](023-cross-surface-accessibility-hardening.md) | Audited, bounded accessibility improvements across all extension surfaces | Complete; the owner's VoiceOver/zoom session was performed on 2026-09-08 and its findings answered in Addendum B5 |
| 024 / 0.1.2 Task 15 | [Compatibility Candidate Suggestions](024-compatibility-candidate-suggestions.md) | Explicit Field discovery and controlled local Shared Template Set linking and merges across Sites. Addendum A specified `Share this template with…`; its authorization was withdrawn on 2026-09-08 and it will not be implemented. Addendum B, accepted 2026-09-09, gives rich-text hosts a structural compatibility kind for Task 036; Addendum C, accepted 2026-09-09, gives the automatic offer a surface at last and offers a group of rich-text Fields at once; Addendum E (2026-09-15) stops a Field-list row or its page Field staying selected, accepted after owner re-test | Complete and accepted 2026-09-08 |
| 025 / 0.1.2 Task 16 | [Modal Dialog Accessibility Repair](025-modal-dialog-accessibility-repair.md) | Shared Side Panel confirmation-dialog focus lifecycle and keyboard regressions | Implemented; Addendum A repairs the Escape leak found in the owner's 2026-09-08 QA; final acceptance pending |
| 026 / 0.1.2 Task 17 | [Shared Template Per-Field Overrides](026-shared-template-per-field-overrides.md) | Explicit per-Template field Overrides and Exclusions within Shared Template Sets | Complete and accepted 2026-09-07; criterion 7's broader headed E2E coverage accepted as an open gap |
| 027 / 0.1.2 Task 18 | [Explicit Template Audience Scope](027-explicit-template-audience-scope.md) | Owner-only Template relationships, explicit audience promotion, and unambiguous Bind scope | Complete and accepted 2026-09-07 |
| 028 / 0.1.2 Task 19 | [Recovery And Boundary Hardening](028-recovery-and-boundary-hardening.md) | Factory Reset survives an unreadable store; whole-library delete guarded at the boundary; national-identity Field vetoes; dead code and fingerprinting surface removed | Complete |
| 029 / 0.1.2 Task 20 | [Authoritative Documentation Reconciliation](029-authoritative-documentation-reconciliation.md) | PROJECT.md, CONTEXT.md, and README.md describe the product that exists, with an automated conformance check | Complete |
| 030 / 0.1.2 Task 21 | [Picker Isolation Architecture](030-picker-isolation-architecture.md) | The Inline Picker's Shadow Root ships closed, via a build-time flag with a build gate and a production-build test | Complete |
| 031 / 0.1.2 Task 22 | [Sharing Subsystem Extraction](031-sharing-subsystem-extraction.md) | Shared Template Sets get their own module and stated invariants, reducing the recurring cross-seam defect class | Complete and accepted; command bodies deferred to Task 032 |
| 032 / 0.1.2 Task 23 | [Repository Decomposition](032-repository-decomposition.md) | Continue splitting the 6,000-line repository along AGENTS.md's stated boundaries; add automated static checks | Complete: Phase A accepted 2026-09-07, Phase B complete 2026-09-08; fillnest-repository.ts 6,146 -> 1,337 lines |
| 033 / 0.2.0 | [Chrome Web Store Beta Readiness](033-chrome-web-store-beta-readiness.md) | Packaging, store metadata, privacy policy and a submission gate; no product change | Version `0.2.0` set 2026-09-11; Addendum A (pre-submission audit) and B (owner's submission decisions: Unlisted, Gist privacy URL); C (store check and policy gaps); D (the owner's icon set, 2026-09-15); E (tab addresses on start-up and revocation, a stale-package check, the clipboard sentence) accepted 2026-09-15 after owner QA. Screenshots, the promo tile and submission remain the owner's |
| 034 / 0.1.2 | [Appearance Themes, Settings Density, And A Cross-Surface UI Review](034-appearance-themes-and-settings-density.md) | Six themes in light/dark across all three surfaces, one colour-token vocabulary, condensed Settings copy, and a recorded UI review | Complete 2026-09-08; two cosmetic findings recorded and deferred |
| 035 / 0.1.2 | [Whole-Extension Review](035-whole-extension-review.md) | Owner-requested review of manifest, message boundary, data layer, browser compatibility, accessibility, performance and docs | Complete 2026-09-08; three defects fixed, six findings recorded. R7 resolved 2026-09-09: mutation cost measured and cut twenty-fold. Addendum A (input stops at the content limit) accepted 2026-09-11 after owner QA |
| 038 / 0.2.0 | [A Page Status Control The User Can Move](038-movable-page-status-control.md) | The page status control is dragged where the user wants it and stays there, reusing the pinned Picker's own position machinery | Complete and accepted by the owner 2026-09-10; Addenda A (position in the archive) and B (Settings returns it to its corner) accepted 2026-09-11 |
| 037 / 0.2.0 | [Interface Localization And Simplified Chinese](037-interface-localization.md) | The interface in the reader's own language, English core unchanged: a typed message catalogue per language, a Settings choice, and Simplified Chinese | Complete and accepted by the owner 2026-09-11 after hands-on QA in Chinese; Addenda A-C (gate hardening, 192 strings, one language registry); Addendum D (errors in the chosen language) implemented and its Chinese copy owner-reviewed 2026-09-11; Addendum E (document language, nine strings, a wider gate) accepted 2026-09-15 after owner QA; Addendum F (`more…`, and the gate's lowercase blind spot) implemented 2026-09-15 |
| 036 / 0.1.2 | [Rich Text Field Support](036-rich-text-field-support.md) | `contenteditable` editing hosts become Fields: generic eligibility, Selection/Range insertion with post-insertion verification, tiered Binding, and a consent-gated clipboard fallback | Complete and accepted 2026-09-09; Addenda F, G (peer-removal convergence), H (Tab kept in the Picker), I (a Field present across a navigation came from the Page before) and J (one selection at most; editing like composing) were owner-verified on Copilot, ChatGPT, Claude and Gemini on 2026-09-10 |
| 039 / 0.2.0 | [Phase One Audit Residual Repairs](039-phase-one-audit-residual-repairs.md) | Fail-closed Restore, privacy-safe Rich Field labels, hash-route query identity, and former-host marker teardown | Complete and accepted by the owner 2026-09-11 after hands-on QA; Addendum A (C1's rule for native Fields: a control's text inside a label is never read) accepted 2026-09-15 after owner QA |
| 040 / 0.2.0 | [A Shared Template Sets Tab In Templates](040-shared-template-sets-tab.md) | Shared Template Sets move from Sites to a Templates tab that shows the shared list, each member's differences, and where each member is; Add/Move removed | Accepted 2026-09-11 after owner QA in Chinese |
| 041 / Process | [Development Workflow Refinement](041-development-workflow-refinement.md) | Adapt current general evidence, risk, Demo, readiness, checkpoint, and manual-QA rules without weakening FillNest-specific constraints | Accepted 2026-09-14 after owner review, with six corrections |
| 042 / 0.2.0 | [First-Use Guidance And A Feedback Address](042-first-use-guidance-and-feedback.md) | Start cards on the Popup, Picker and Side Panel, a note on each feature page's first visit, Show tips again, and a copyable feedback address on Overview | Complete and accepted by the owner 2026-09-15 after hands-on QA in Chinese |
| 044 / 0.2.0 | [The Picker Header: The Mark, And Back In The Corner](044-picker-header.md) | The owner's mark in the Picker header; on the Field list, Back and `Share with…` in the top-left corner of a header that stays put while the list scrolls | Accepted 2026-09-15 after owner QA |
| 045 / 0.2.0 | [Scrollbar Space That Does Not Move The UI](045-steady-scrollbar-space.md) | Every scroll container in the Picker and the Side Panel keeps a 10px scrollbar's room at all times, so nothing re-lays out when content starts to scroll | Accepted 2026-09-15 after owner QA |

## Cross-Task Boundaries

- Task 001 is historical and must not be retroactively broadened.
- Task 002 establishes the shared UI structure and exposes only real basic behaviour. It does not pre-implement Task 003 or Task 004 management operations.
- Task 002 provides only basic read-only Side Panel body Search, plus documented early Picker/Side Panel row-action deviations. Task 003 owns complete Side Panel Template Library Search, filters, sorts, Template mutations, existing Binding removal, field-scoped edit/copy, Undo, Keep Open formalization, and deletion safety. `Forget this field` and User Tags are deferred from the default V1 UI. New Bindings remain possible only from an Inline Picker with a valid Target Field.
- Task 004 manages Website Access, Origin Activation, Site Data, and destructive site-related operations. Removing access never silently deletes business data.
- Task 005 owns Inline Picker deliberate Search and Site Affinity visibility. It does not duplicate Side Panel library Search. Search never proves field identity or creates a Binding.
- Task 006 begins with behaviour-preserving Side Panel boundary prep, then owns the canonical Repository candidate-state integrity gate required for trustworthy export. It implements complete versioned local Backup Archives and replacement Restore, not merge Import, sharing, or synchronization. The integrity work must preserve Task 003 behaviour without retroactively broadening historical Task 001.
- Task 007 adds evidence and hardening, not new product features.
- Task 008 is post-V1 architecture maintenance only. It preserves accepted product behaviour while removing superseded internal paths and tightening message, authorization, and shared-rule boundaries.
- Task 009 owns whole-product Reset. It does not replace the Templates page's typed whole-library deletion or broaden Backup/Restore into Import.
- Task 010 owns outcome vocabulary, the all-successful-mutations Undo invalidation policy, Picker Action Outcome Bar behavior, and the current Side Panel outcome semantics. Task 011 owns the Side Panel title/header redesign and the final bottom-anchored result-region layout.
- Task 011 consumes Task 010's semantics but does not redefine them. It removes
  the Side Panel bottom Undo/collapse mechanism and moves the existing result
  and Undo presentation into one global region below scrollable Side Panel content.
- Task 014 owns user-confirmed, same-Origin logical-Page identity across
  record-specific URLs. It permits only the accepted normalized Route Pattern
  and Site-specific keyed semantic hashes; it must not retain raw page text,
  values, selectors, DOM paths, complete DOM structure, or site-specific rules.
- Task 015 owns explicit Shared Template Set semantics. Task 024 is the only
  authorized controlled extension from Site-local membership to cross-Site
  membership through explicit Link confirmation; neither Task redefines Task
  014 identity, Task 010 Undo semantics, Task 011 result presentation, Task
  012 Site cleanup, or Task 006 Backup/Restore replacement.
- Tasks 016–019 retain the useful, site-neutral observations from closed Task
  013 without reopening it. Task 016 establishes the accepted boundary; Task
  017 supplies synthetic evidence; Task 018 is the only implementation task;
  Task 019 is independent acceptance.
- Task 020 implements only the identity contract accepted through Task 014.
  Task 021 implements only the Shared Template Set contract accepted through
  Task 015, in four ordered slices.
- Task 022 changes current-state documentation only when repository evidence
  proves an inconsistency. Task 023 is an accessibility audit and bounded
  follow-up work, not a visual redesign or a general hardening bucket.
- Task 024 adds compatibility candidates only after lifecycle, logical-Page
  identity, and Shared Template Sets are accepted product capabilities. Its
  explicit-Link cross-Site extension preserves Shared Template Set membership
  and recovery invariants, and it keeps future Contacts and multi-Field
  filling separate.
- Task 025 owns only the common Side Panel confirmation-dialog focus lifecycle
  identified by Task 023. It must preserve every owning Task's confirmation
  content and mutation semantics.
- Task 026 owns the only authorized relaxation of the Task 015/021 invariant
  that every Shared Template Set member receives the same complete Template
  list. It adds explicit per-Template Override and Exclusion states without
  adding version-control, automatic restoration, or changing Task 024's
  explicit cross-Site Link semantics.
- Task 027 owns Field-only relationship visibility and explicit audience
  promotion. It preserves Task 026 Overrides/Exclusions as separate
  per-slot states, replaces no accepted Task 024 cross-Site confirmation, and
  does not retroactively reinterpret legacy exclusion records.

- Tasks 028-032 originate from the 2026-09-06 whole-extension audit
  (`evidence/whole-extension-audit-2026-09-06.md`). Task 028 fixes only
  findings that restore a guarantee an existing document already states; it
  makes no product decision. Task 029 owns every documentation conflict and
  must not change behaviour. Task 030 owns the Inline Picker's isolation model
  and is the only Task permitted to change it - Task 028 explicitly does not
  pre-empt it. Task 031 extracts the sharing subsystem and Task 032 continues
  the same decomposition; both are behaviour-preserving refactors, and a
  required behaviour change is a stop condition in each.

## Post-MVP Release Sequence

| Version | Goal | Scope boundary |
| --- | --- | --- |
| `0.1.1` | MVP closure | Accepted post-MVP baseline; no new feature scope. |
| `0.1.2` | Pre-Beta usability and compatibility | The accepted contracts listed above as `0.1.2 Task 01`-`Task 23`, which reach beyond the Next-Version Discussion Queue's original items 1-5. Each has its own bounded contract and acceptance gate. Complex-control support is the one unstarted candidate and may be deferred without blocking Beta. |
| `0.2.0` | Chrome Web Store Beta | Store readiness and private test distribution (Task 033). It is also the first versioned build of everything after `0.1.1`: the `0.1.2` contracts above, and Tasks 036-039. Tasks 037 and 038 were planned for `0.2.1` and were delivered before submission instead, at the owner's direction; localization therefore ships with the Beta, and the store listing's Chinese text is prepared outside the repository. See `CHANGELOG.md`. |
| `0.2.1` | Capability expansion | Items 6-9 and 11 from the Next-Version Discussion Queue, after Beta evidence. |
| `1.0.0` | Account platform | Item 12: accounts, sync, encryption, and related platform capability. |
| `2.0.0` | Agent-assisted workflow | Item 10: the Agent-Assisted Form Completion Bridge. |

## 0.1.2 Execution Order

The task numbers preserve history; this is the mandatory development order.
Tasks marked **decision gate** require explicit contract acceptance before the
next implementation task begins.

1. Task 010 → Task 011 (Task 011 consumes Task 010's outcome semantics and
   must not redefine them) → Task 012.
2. Task 013 ran in parallel and was closed without execution; its findings feed
   Tasks 016-019.
3. Task 016 **decision gate** → Task 017 → Task 018 → Task 019.
4. Task 014 **decision gate** → Task 020.
5. Task 015 **decision gate** → Task 021 (domain/persistence →
   commands/recovery → Picker → Site management/evidence).
6. Task 022 after an accepted feature task, once current-state evidence has
   changed.
7. Task 023 after Task 021 or another accepted cross-surface UI change.
8. Task 024 after accepted Tasks 019, 020, and 021. It requires its own
   contract acceptance before implementation.
9. Task 025 is a required Task 023 follow-up and executes before Task 023 can
   be accepted; it does not block Task 024 by prerequisite, but the roadmap
   prioritizes it before further cross-surface UI expansion.
10. Task 026 after accepted Task 021, then Task 027 after Task 026. Both are
   bounded successors within the Shared Template Sets contract line.
11. Task 028 **decision gate**, then Task 029 **decision gate**. Neither
   depends on the other; Task 029's conformance slice lands after Task 028 so
   it validates final control labels.
12. Task 030 **decision gate** is research only and may run in parallel with
    Tasks 028 and 029. Its implementation requires a separate contract.
13. Task 031 after Task 028, with Task 030's decision known. Task 032 after
    Task 031, by the project owner's explicit sequencing.

## Required Before Launch

Not deferred: these are wanted in the product before it ships, and each needs
its own accepted contract before any code is written.

- **Rich-text and chat input support.** Requested by the owner on 2026-09-09
  after hands-on testing. FillNest currently attaches only to `<input>` and
  `<textarea>`, which is why the Markdown and JSON editors on
  `vue-typescript-admin-template` work - both are textarea-backed - and why the
  ChatGPT, Claude and Gemini composers do not: all three are `contenteditable`
  rich-text nodes, which `README.md` lists among the V1 exclusions.

  **Owned by Task 036, accepted and implemented 2026-09-09**, together with
  Task 016 Addendum E (accessible-name evidence for DOM-replacement recovery)
  and Task 024 Addendum B (a structural compatibility kind for rich-text
  hosts). The owner's hands-on QA of the named AI chat targets passed on
  2026-09-09 and 2026-09-10.

  The owner's case for it: people ask the same questions in the same shape over
  and over, and a reusable Template is exactly what that wants - including
  user-written prompt fragments appended to whatever they are typing.

  It is a whole contract, not a small change, and at minimum has to settle:
  insertion through Selection/Range rather than `selectionStart`, so that a
  document-model editor (ProseMirror, Lexical, Quill) accepts the text instead
  of overwriting it on its next render; Field identity without `name`, `id` or
  `autocomplete` to key on; re-derived sensitive-field exclusions, since none of
  the current signals apply; and how any of it stays generic, because
  per-editor or per-site selectors are forbidden by `AGENTS.md` and
  `PROJECT.md`. The three composers are three different editors, so "support
  these three sites" and "support rich text" are different projects, and only
  the second is allowed here.

## Deferred Beyond V1

- Structured Contacts and multi-field filling.
- Parameterized Templates with user-supplied variable slots.
- Template Share Packages and person-to-person sharing.
- Cloud sync, encryption, accounts, User pages, plans, quotas, payments, and entitlement enforcement.
- Advanced settings, including page-status-control size. (Dragging and a remembered position shipped in Task 038.)
- User Tags UI and search-result match highlighting.
- `Forget this field` as an advanced cleanup/debugging feature.
- Final release branding and public release. (Chrome Web Store Beta preparation is Task 033; localization shipped in Task 037.)
- See [Next-Version Discussion Queue](../docs/next-version-discussion.md) for custom-control support, the Sites/Templates information-architecture review, and the post-Beta Agent-Assisted Form Completion Bridge exploration.
