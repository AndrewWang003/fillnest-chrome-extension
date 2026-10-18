# Phase One Audit — Final Review

## Scope and fixed point

Audit branch: `fix/phase-one-audit-repairs`; reviewed final commit:
`4327d88226d102f466ec4a49fe1502385dcdd254` (version `0.2.0`).
The review began at `bd221db3d05db923e76502af8b03a86f696f962a` and was
revalidated after the intervening repair commits. Findings below refer to the
final commit, not to defects that have since been repaired.

The requested Phase One review covers current implementation against the
product purpose, PROJECT.md, CONTEXT.md, AGENTS.md, and the owning Tasks
001–038 and their later addenda. Standards/runtime, content/recognition, and
storage/relationships were reviewed independently, with the root reviewing
UI integration and aggregating evidence. This is an audit deliverable, not
acceptance of the release or implementation of the remaining repairs.

## Standards

### R1 — P1: Restore can resume writes after an unrecovered rollback

Location: `src/backup/restore-journal.ts:121–122`.

If the target business write succeeds, the activation write fails, the
business rollback also fails, and writing the journal's `failed` status fails,
the exception occurs before the in-memory `rollbackFailure` latch is set.
The original `in_progress` journal survives, but the running worker does not
block writes after storage becomes available again. A second Restore can
overwrite and delete the recovery journal holding the original data.

This breaches the fail-closed recovery requirement in Task 006 Addenda A/B.
The previous repair covers a failed rollback when the failed-status write
succeeds; it does not cover this additional storage failure. Startup recovery
already handles failure to persist that status more defensively.

Evidence: the actual service-worker fault-injection probe confirms both a
subsequent accepted CREATE_TEMPLATE and replacement/removal of the original
journal by another Restore. See [reproduction and result](residual-runtime-probe-notes.md)
and [probe source](residual-runtime-probe.test.ts.txt).

Repair direction: latch the unrecovered state independently of the journal
status write, retain the recovery evidence, and test repeated storage failure
through the live worker boundary. Owner: Task 006.

## Spec

### C1 — P1: Rich Field contents are read as label metadata

Location: `src/fields/dom-field.ts:153–155`.

For `<label>Message<div contenteditable="true">CONFIDENTIAL EXISTING DRAFT</div></label>`,
the enclosing-label fallback reads the label's entire `textContent`, including
the user's draft. `readSafeMetadata` and `fieldObservedTitle` both return
`MessageCONFIDENTIAL EXISTING DRAFT` without an explicit content-read action.
The title can then be persisted when a Template is created or bound.

This violates Task 036's content-read boundary and Tasks 016/036's safe
eligibility contract. It also makes recognition/eligibility depend on the
draft. This is local unintended reading and possible persistence; no network
transmission was found. Metadata/title contamination is directly probed;
persistence is traced through the current repository path, not separately
tested in browser storage.

Repair direction: derive label metadata without consuming editable content,
including editable descendants of referenced labels; retain usable external
label text and tiered Binding behavior. Owner: Task 036, with Task 016's
zero-value-read boundary. [Detailed evidence](content-audit-notes.md#c1--p1-an-enclosing-label-reads-a-rich-fields-existing-content-as-metadata).

### C2 — P2: Hash-route query state collapses distinct Pages

Location: `src/recognition/recognition-evidence.ts:203–206`.

`https://example.test/app#/form?entity=customers` and
`https://example.test/app#/form?entity=invoices` both produce `/app/form`.
The hash parser discards its query while the identity builder reads only the
outer URL query. Distinct forms with equal Field keys therefore resolve as
the same exact Page/Field; the current-context check also misses that SPA
identity change. Offering the wrong bound list follows from exact-key
resolution; a full browser bind/navigation reproduction was not run.

Task 014 Addendum C requires hash routes and unfamiliar semantic query state
to distinguish Pages. The accepted exclusion of ordinary section anchors
does not apply to these application routes.

Repair direction: apply the approved query classification to fragment route
queries without conflating them with outer query state; assess existing
Page-key compatibility before changing persisted identity. Owner: Tasks
014/020. [Detailed evidence](content-audit-notes.md#c2--p2-query-state-inside-hash-routes-is-discarded-from-page-identity).

### C3 — P2: A rich Field that becomes unsupported keeps its marker

Location: `src/content/content-script.tsx:1750–1754`.

After an unfocused rich Field receives `data-fillnest-field`, set its
`contenteditable` attribute to `false`. The lifecycle pass only enumerates
elements that are currently editing hosts, so the former host never reaches
the marker-removal branch. The unsupported element retains the marker.

This violates Task 016's immediate teardown requirement, extended to rich
Fields by Task 036. The real content-script DOM probe confirms the marker
remains; it supplies an inherited editing-state getter missing from happy-dom.
No unsafe insertion was demonstrated, and insertion independently rechecks
eligibility. A real-Chromium transition probe was not run.

Repair direction: reconcile previously marked/tracked hosts even when they
no longer qualify as candidates, including inherited editing-state changes.
Owner: Tasks 016/018/036. [Detailed evidence](content-audit-notes.md#c3--p2-a-rich-host-that-stops-being-editable-retains-its-extension-marker).

## Repaired findings excluded from the current defect list

The original reported A/B/C sharing case has a current repository regression:
`tests/unit/repository.test.ts:2187` covers a joining Field's Template union
for same-Site and cross-Site sharing with exact Undo. Current sharing remains
an explicit local relationship, not sharing data with another person.

| Previously confirmed issue | Current repair evidence / owner |
| --- | --- |
| Pinned Picker selection belongs to a previous Field | Field ownership and one-use selection; Task 003; real-Chromium regression |
| Logical Page merge freezes later Bind/Unbind/Delete | Live Binding lifecycle decoupled from provenance; Task 020 A |
| Site cleanup loses surviving Overrides/Exclusions or privacy | Effective-list snapshots preserve Field-specific states; Task 026 A |
| Private local copy loses audience / pending confirmations follow focus | Private marker retained and Field-change reset; Task 027 F |
| End sharing loses newly shared Templates or duplicates dormant private entries | Each member retains its effective list; Task 021 B; Undo coverage |
| Move leaves a one-member Set | Source dissolution and survivor snapshot; Task 021 A |
| Cross-Site departure Undo rejects non-anchor member | Former-member scope check; Task 024 D |
| Clear Site fails with retained compatibility rejection | Removed-Field decisions pruned; Task 024 D |
| Delete Override then Undo loses relationship | Surviving-slot restoration; Task 026 A |
| Backup/Restore loses position, privacy, title, rejection metadata | Full business-state conversion and archive roundtrip; Tasks 006 A / 038 A |
| Failed Restore has no recovery exit | Startup retry and reachable confirmed Reset; Task 006 B; R1 remains |
| Reset leaves stale language / ordinary errors appear in English | Broadcast and typed localized errors; Task 037 D |

Storage revalidation passed 239 tests across seven files: repository,
shared-set-audit-repairs, logical-page-provenance-lifecycle, archive-contract,
backup-restore, compatibility-decision-cleanup, and service-worker-runtime.
Historical runtime probes in this folder describe repaired defects; they are
not evidence that those defects remain in the final commit.

## Coverage and product-purpose assessment

| Area / owning Tasks | Review and verification boundary |
| --- | --- |
| Foundation, permissions, messages, activation, management, search (001–012) | Manifest/build, worker authorization, serialized mutations, broadcasts, Reset/Remove/Restore, Template CRUD/usage/Undo, panel/settings/picker integration; R1 remains |
| Identity and eligibility (013–020) | Closed Task 013 treated as non-authorized; candidate evidence, exact and logical identity, merge/separation, dynamic host lifecycle and zero-touch rules; C2/C3 remain |
| Sharing and compatibility (015, 021, 024, 026, 027) | Effective lists, create/join/merge/move/leave/end, private audience, overrides/exclusions, promotion, cleanup, exact Undo and UI confirmation lifetime |
| Accessibility and feedback (010/011, 023/025, 034) | Focus/dialog/keyboard and status-region implementation, themes, new sharing icon names/focus tooltips inspected; existing automated cases run; no new assistive-technology or forced-colors session |
| Maintenance and boundaries (022, 028–032) | Source ownership, repository decomposition, validation/migrations, closed production roots and build gates; documentary status discrepancies distinguished from execution authorization |
| Beta readiness and performance (033, 035) | Store gate inspected/run, packaging and production build verified; existing lifecycle performance decision retained; opt-in benchmark not rerun |
| Rich Fields (036) | Metadata/eligibility, selection ownership, insertion, rejection fallback, page focus hostility and SPA convergence; C1/C3 remain |
| Localization and movable status (037/038) | Typed catalogue/error routing, Reset language broadcast, input limit behavior, position persistence/clamping and accepted pointer interaction boundary |

The architecture remains aligned with deliberate single-Field plain-text use,
local storage, explicit access and insertion, and no backend/account/sync/AI
product feature. The review found no new whole-page filling or automatic form
submission path. C1 violates the intended content-reading boundary; R1 violates
the intended recoverable local-data boundary. Passing broad tests does not
override these targeted counterexamples.

## Verification

| Check at final fixed point | Result |
| --- | --- |
| `npm run check` | Passed: 74 files, 1005 unit tests; typecheck, lint, documentation, localization, exports and production build gates |
| `npm run test:e2e` | 71 passed, 1 opt-in benchmark skipped, 2.4 minutes |
| Content counterexample probes | 4/4 confirm observed behavior; one is the accepted limitation below |
| Actual-worker residual Restore probe | 1/1 confirms R1 |
| `npm run verify:store` | Expected nonzero: icons, screenshots and public privacy-policy URL missing |

Counterexample probes assert defective behavior; their passing result means
the defect was reproduced. Source and reproduction recipes are retained as
`.txt` outside the default test/lint projects. No production files were edited
by this final audit pass. Broad-run logs were read from
`/tmp/fillnest-final-audit-check.log` and `/tmp/fillnest-final-audit-e2e.log`;
the durable summary is this table.

## Authorization and ownership

The current work is the requested audit. Existing repairs were assessed
against their owning addenda, not retrospectively authorized by passing tests.
The four current findings are recorded for their next bounded repair gates;
this report does not mark those gates or release acceptance complete.

Owner QA remains distinct from automated evidence. Latest input-cap changes
(Task 035 A), sharing icon controls (Task 021 C), and unclosed repair/addendum
QA must retain their recorded acceptance state. Task 023 B5's owner VoiceOver
and zoom session was completed on 2026-09-08; this does not close Task 025's
separately deferred session.

Documentation observation: tasks/README.md still has historical status text
that conflicts with later records (including Task 023's waived manual QA,
Task 033's pending version bump, and Task 036's pending owner QA). Its deferred
feature lists also predate implemented localization/rich Fields/movable
status. Use the owning addenda and latest explicit owner acceptance; these
index statements are not proof of missing implementation or unauthorized
execution. DEVELOPMENT.md has been condensed with the prior text archived.

## Accepted limitations and remaining release gates

- Rich insertion verification is deliberately presence-only. If the same
  Template already occurs in the host, a refused repeat insertion can look
  successful. Task 036 explicitly accepts that verification design; it is not
  counted as a fifth defect.
- Localized accessible names can change rich-Field identity; index and record
  routes with different segment counts remain separate; root-level unrelated
  slugs are not automatically matched. Existing product decisions stand.
- This review does not certify all websites, real assistive technologies,
  hostile page scripts, or untested failure combinations. Named probe limits
  above and accepted Task 036 A.6/A.7 fixture gaps remain explicit.
- Beta publication still needs owner-provided icons, screenshots and the
  public privacy URL under Task 033 B, plus required QA and resolution of the
  current defects. Version `0.2.0` is already set. Submission was not performed.

Audit complete: Standards has one P1 finding (Restore fail-closed gap); Spec
has three findings, one P1 and two P2 (worst: rich-Field content reading).
