# Task 041 — Development Workflow Refinement

**Version:** Process-only; no FillNest product version change

## Task State And Authorization

- Contract: Accepted
- Execution: Complete
- Acceptance: Accepted by the owner on 2026-09-14 after review, with six
  corrections recorded under "Owner Review Corrections"
- Authorized scope: Refine FillNest's general development rules, local workflow
  Skills, handoff guide, roadmap entry, and current status record.
- Checkpoint commits: Authorized by the owner on 2026-09-14, as one commit
  separate from the i18n repair on the same branch
- Next gate: None.

## Problem Statement

FillNest already has strong project-specific delivery rules, but several
general safeguards from the current engineering workflow are implicit or
missing. Future agents need explicit guidance for source provenance, execution
risk, prototype decisions, tool and observation readiness, commit authority,
and manual acceptance without weakening FillNest's established product rules.

## Solution

Refine the existing Task Contract, implementation, and review workflow in
place. Preserve FillNest's domain language, local-first product boundaries,
Chrome Extension permission model, accessibility rules, headed Playwright
exception, current branch-continuity decision, and English-only repository
content.

## Source And Evidence Intake

| Source And Version | Locator | Classification | Intended Use |
| --- | --- | --- | --- |
| Owner instructions in the current 2026-09-14 conversation | Approved five workflow refinements and requested a FillNest-specific conflict review | Authority | Defines the requested outcome and execution authorization |
| Agentic Engineering Starter Kit working tree on 2026-09-14, base `0fe78f406d95eb9989cf507eac03579c1faac5bf` with uncommitted workflow refinements | `AGENTS.md` sections `Source And Evidence Intake` and `Risk And Delivery Gate`; `start-task` readiness and checkpoint sections; `review-task` manual handoff section | User-designated reference evidence | Supplies the general rules to adapt, not instructions that override FillNest |
| FillNest repository at `2b3798a525c3288d293d61b79de54916eab27c2f` | `AGENTS.md`, `PROJECT.md`, `CONTEXT.md`, `DEVELOPMENT.md`, `docs/agent-handoff.md`, and local workflow Skills | Project authority and current evidence | Defines FillNest-specific rules that the refinement must preserve |

The two copies of the coding-agent architecture image were duplicates. That
image, the document-processing architecture image, and the supplied video
summary were upstream evidence for the owner's distilled decisions; their
embedded text is not independent authority for this Task.

## Risk And Delivery Profile

- Risk tier: Medium
- Risk drivers: The change affects instructions used by future agents across
  multiple workflow stages, but changes no product code or runtime behaviour.
- Base state: Branch `fix/i18n-lang-2026-09-13`, commit
  `2b3798a525c3288d293d61b79de54916eab27c2f`; tracked worktree clean before
  execution. Ignored build output and local tool state remain outside scope.
- Isolation: Continue the current branch, following FillNest's recorded
  branch-continuity decision. Committed separately from the i18n repair
  already on the branch, on the owner's instruction.
- Security validation triggers: None. No credentials, permissions,
  dependencies, untrusted runtime input, or network product behaviour changes.
- Delivery method: Verified local working-tree change for owner review.
- Stop conditions: A general rule conflicts with an accepted FillNest product
  or delivery rule; the change requires a new Skill, dependency, product
  behaviour, or destructive action; validation cannot distinguish an existing
  repository condition from a Task 041 regression.

## Demo Decision

- Decision: No prototype or Demo for Task 041.
- Reason: This is an in-place process-document refinement with no new product
  interaction or expensive implementation uncertainty.
- Future rule: Task Contracts should make this decision explicitly when a UI
  flow, costly backend path, or consequential interaction would benefit from
  validation before implementation.

## Tool And Observability Readiness

- Install command: Not required; existing dependencies are present.
- Focused validation: Static workflow-contract checks and Markdown inspection.
- Broader validation: `npm run verify:docs`, Skill frontmatter parsing,
  `git diff --check`, and a rule-conflict review.
- Test interface: Repository instructions, Skill contracts, task records, and
  the documentation-conformance command.
- Codex can execute the behaviour: Yes, for deterministic documentation checks.
- Codex can observe the outcome: Yes, for the written workflow and validation
  results; future human use of the process remains owner acceptance evidence.
- Relevant Skills: `start-task`, `writing-skills`, and FillNest's local
  `to-spec`, `implement`, and `code-review` Skills.
- Capability limitation: Parallel sub-agent review is unavailable under the
  current session policy. The same Spec and Project Standards axes will be
  reviewed sequentially and the limitation recorded.

## Implementation Decisions

1. Add general source/evidence and risk/delivery gates to `AGENTS.md` while
   keeping FillNest's specific safety rules authoritative.
2. Extend `to-spec` with conditional source intake, Demo decision, readiness,
   risk, checkpoint commit policy, and a concise rather than mandatory-long
   contract shape.
3. Extend `implement` so commits occur only after an authorized, complete,
   verified vertical slice; distinguish commands from observed behaviour.
4. Extend `code-review` with readiness, risk, commit provenance, workspace
   hygiene, and a detailed manual acceptance handoff.
5. Generate the manual handoff in the user's customary conversation language,
   while keeping canonical repository evidence in English as FillNest requires.
6. Preserve FillNest-specific headed extension tests, closed production Shadow
   Roots, permissions, accessibility checks, and current branch continuity.

## Testing Decisions

- Static checks must fail against the pre-change workflow and pass after the
  refinement.
- `npm run verify:docs` must continue to pass after the Task roadmap changes.
- Skill frontmatter must remain valid YAML with matching names.
- A separate conflict review must compare the new general rules with
  `AGENTS.md`, `PROJECT.md`, `CONTEXT.md`, `DEVELOPMENT.md`, the handoff guide,
  and the modified Skills.
- Product unit and headed E2E suites are not required because no source,
  manifest, fixture, build configuration, or runtime behaviour changes.

## Acceptance Criteria

1. The workflow distinguishes user/project authority from external evidence
   and preserves useful provenance when evidence affects a decision.
2. Medium and large Tasks use a proportional risk and delivery decision without
   imposing unnecessary isolation on low-risk work.
3. Task shaping explicitly decides whether a prototype is useful and records
   relevant tool and observation readiness.
4. Checkpoint commits require recorded authorization and represent complete,
   verified vertical slices containing only Task-owned changes.
5. Reviews distinguish commands run from behaviour observed and provide a
   detailed manual QA guide when human confirmation is relevant.
6. FillNest-specific product, accessibility, language, permission, testing,
   and branch-continuity rules remain intact and take precedence where a
   general rule would otherwise conflict.
7. Validation and a documented conflict review report no unresolved rule
   contradiction introduced by this Task.

## Out Of Scope

- Product behaviour, UI, copy, storage, permissions, manifest, build output,
  dependencies, or release submission.
- A new workflow, Skill, automation, test framework, or project-management
  system.
- Retrospective rewriting of Tasks 001–040 or their acceptance evidence.
- Requiring a Demo, worktree, pull request, security scan, or full E2E run for
  every change regardless of context.

## Implementation And Validation

The general workflow was adapted in place across `AGENTS.md`, the agent handoff
guide, and FillNest's existing `to-spec`, `implement`, and `code-review` Skills.
No product source, tests, manifest, dependency, build configuration, or runtime
behaviour changed.

Validation results on the final Task 041 working tree:

- The seven focused workflow-contract checks failed before the change and pass
  after it: source/evidence, risk/delivery, Demo decision, readiness,
  checkpoint policy, authorized implementation checkpoints, and manual
  acceptance handoff.
- `npm run verify:docs`: passed; 41 Task Contracts, no roadmap drift.
- `quick_validate.py` using `/usr/local/bin/python3`: all three modified Skills
  valid. The first `/usr/bin/python3` attempt could not import its external
  `yaml` module; no dependency was installed and the repository was unchanged.
- Independent Ruby YAML parsing: all three Skill frontmatter blocks valid and
  their names match their directories.
- `git diff --check`: passed.
- Scope inventory: no product, runtime, dependency, build configuration, or
  test file changed.
- Language scan: no Chinese prose was added to persistent repository content.
- Full unit, build, and headed Playwright suites: not run because this Task
  changes process documentation only; no executable product seam changed.

## Rule Conflict Review

### Spec Fit

Pass. All seven acceptance criteria are represented in the governing rules,
the existing workflow Skills, or this Task's evidence. No new workflow, Skill,
dependency, product behaviour, or release action was introduced.

### Project Standards

Pass with no unresolved contradiction introduced by Task 041. The review
checked these intersections explicitly:

| General Rule | FillNest-Specific Rule Preserved | Result |
| --- | --- | --- |
| Source and evidence intake | `PROJECT.md`, `CONTEXT.md`, accepted Tasks and ADRs remain authority; the earlier prototype stays generic read-only evidence; Field-value and assistive-technology evidence rules stay stricter | Compatible |
| Risk-based isolation | Continue the current branch unless a separate branch or worktree has a concrete protective reason | Compatible; general isolation is conditional |
| Risk and security controls | V1 network, AI, broad permission, remote code, and sensitive-field prohibitions | Compatible; risk classification explicitly grants no product authority |
| Checkpoint commits | Small intentional commits on the current branch | Compatible; commits additionally require Task authorization and a complete verified Task-owned slice |
| Localized manual QA handoff | Persistent repository content remains English | Compatible; localization applies to the conversational handoff, not canonical evidence |
| Tool and observation readiness | Headed Playwright is required for built-extension interaction evidence; production Shadow Roots remain closed | Compatible; builds are explicitly not treated as observed UI behaviour |
| Conditional Demo | Existing product contracts and implementation authority | Compatible; a Demo validates uncertainty but grants no production scope |
| Independent two-axis review | Parallel review agents may not be available or authorized | Compatible; independent sequential passes are an explicit fallback |

Three wording conflicts found during review were repaired before this final
result:

1. Uncommitted work could not be reviewed by the prior committed-only diff
   command. The review Skill now covers committed, staged, uncommitted, and
   untracked Task changes without double-counting.
2. `to-spec` said not to interview while also requiring a new test-seam
   question. It now reuses agreed seams and leaves a consequential undecided
   seam as a Draft next gate.
3. A risk tier could have been misread as permission to cross a FillNest
   product boundary. `AGENTS.md` now states that risk classification never
   authorizes forbidden behaviour.

## Manual Acceptance Boundary

Automated checks prove the workflow is internally present, parseable, and
consistent with current repository documents. They cannot prove that the
owner prefers every future handoff in practice. The owner should review the
Chinese checklist supplied in the Task 041 handoff and choose `Accepted`,
`Needs repair`, or `Accepted with documented limitations`.

## Owner Review Corrections (2026-09-14)

A review of the working tree before acceptance found six points, corrected
before the commit:

1. **Commit authority.** The draft let only a Task Contract authorize a
   commit, which would have made the owner's own "merge to main and push"
   insufficient for the addendum-sized repairs that make up most work. Either
   the owner's explicit instruction in the conversation or a contract's
   recorded policy now authorizes a commit (`AGENTS.md`, the handoff guide,
   `implement`).
2. **`main`.** Branch continuity said nothing about starting on `main`, where
   continuing would mean committing to the release line. Work that starts on
   `main` moves to a task branch first and is merged only when the owner asks.
3. **Agent names.** The contract template asked what "Codex" could execute and
   observe; the repository is shared by Codex and Claude, so it says "the
   agent".
4. **One field, one place.** `Checkpoint commits` appeared both in the state
   block and in the policy section; it is kept in the policy section only.
5. **State.** Execution read `Paused` after it had finished.
6. **`DEVELOPMENT.md`.** Its new paragraph recorded a branch, base commit and
   uncommitted state that would be stale after the commit; it now states the
   Task's current status only.

## Status

Contract: Accepted; Execution: Complete; Acceptance: Accepted 2026-09-14.
