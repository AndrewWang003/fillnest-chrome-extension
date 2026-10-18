# FillNest Development Handoff

## Purpose

This guide lets a new coding agent continue FillNest without relying on an
earlier chat. It describes how the project is governed and delivered; it does
not replace the product contract or the current status record.

## Required Reading Order

Read these files in order before planning or editing:

1. [`../CLAUDE.md`](../CLAUDE.md) and [`../AGENTS.md`](../AGENTS.md) for the
   agent entry point and non-negotiable repository rules.
2. [`../DEVELOPMENT.md`](../DEVELOPMENT.md) for the live task status, fixed
   points, verified evidence, known issues, and next gate. Treat it as current
   only after checking `git status --short --branch` yourself.
3. [`../PROJECT.md`](../PROJECT.md) for stable product and technical rules.
4. [`../CONTEXT.md`](../CONTEXT.md) for domain language. Do not introduce a
   competing meaning for an established term.
5. [`adr/0001-engineering-baseline.md`](adr/0001-engineering-baseline.md) and
   any ADR relevant to the intended change.
6. [`../tasks/README.md`](../tasks/README.md), then the current Task Contract.
   A Task Contract is the executable scope and acceptance agreement.
7. The relevant implementation, tests, and prior evidence only after the
   contract is understood.

For Task 013 Generic Form Compatibility Learning, read
[`generic-form-fixture-lessons.md`](generic-form-fixture-lessons.md) after the
Task Contract. It is site-neutral research input, not an implementation
specification or a source of target-site rules.

If these sources conflict, stop rather than guessing. Use this precedence:

1. Explicit current user instruction.
2. `AGENTS.md` safety and working rules.
3. Accepted Task Contract and accepted ADRs.
4. `PROJECT.md` and `CONTEXT.md` stable decisions.
5. `DEVELOPMENT.md` live status and evidence.
6. `README.md` and this guide, which are orientation documents.

> **Authorization stop rule:** Test results, a later commit, or a detailed
> implementation must never be used to infer that a Task or Slice is
> authorized. If `DEVELOPMENT.md`, the roadmap, and the Task Contract disagree
> about a gate, do not edit, commit, or begin a later Task until the user has
> resolved the status and the authoritative files have been reconciled.

## Current Delivery Model

FillNest follows an agentic, evidence-led workflow:

1. Clarify uncertain product decisions before implementation. During a Grill
   round, ask at most three independent ordinary questions, or one complex
   decision question. Record accepted outcomes in the authoritative document.
2. Write or amend a Task Contract for medium or large work. It must define
   scope, exclusions, acceptance criteria, tests, stop conditions, slices, and
   explicit `Contract`, `Execution`, and `Acceptance` state. When relevant it
   also records source provenance, risk and delivery controls, whether a Demo
   should precede implementation, tool and observation readiness, and the
   checkpoint commit policy.
3. Keep contract acceptance separate from permission to implement. Do not
   treat a Draft or accepted-but-unapproved contract as authorization.
4. Use compact Markdown-native visuals when they reduce cognitive load for a
   scope boundary, task contract, test strategy, implementation flow, or review
   finding. HTML explanation artifacts require explicit approval before they
   are created, written, or opened.
5. Deliver vertical slices. For each slice, add a failing test where practical,
   implement the smallest compliant change, and run its exit evidence. Create
   and record a Git checkpoint only when commits are authorized (the owner's
   explicit instruction or the Task Contract's policy), the slice is complete
   and verified, and the diff contains only Task-owned changes. Otherwise record the slice as verified but uncommitted. Update
   `DEVELOPMENT.md` only when task status, acceptance gates, known risks,
   verified checks, or next steps change.
6. Stop and ask for direction if evidence disproves the contract, a new product
   decision is needed, scope expands, a major dependency/runtime boundary
   changes, or acceptance criteria cannot be met as written.
7. After the final slice, run independent reviews against both the Task
   Contract (**Spec**) and the enduring project rules (**Project Standards**).
   Resolve all actionable P0, P1, and P2 findings before acceptance, unless
   the user explicitly defers them into a documented next gate.
8. Record the final evidence, skipped checks, limitations, and next step in
   `DEVELOPMENT.md`. Do not claim completion without evidence.
9. When human confirmation is relevant, hand the owner a detailed checklist
   and test guide in their customary conversation language. Keep canonical
   repository evidence in English and leave acceptance pending until the owner
   reports the result or explicitly accepts documented limitations.

Task 002 has a contract-specific manual interaction checkpoint. Its current
status and any gate must be taken from `DEVELOPMENT.md` and the Task 002
contract, not inferred from this guide.

## Engineering Boundaries

FillNest is a local-first Chrome Extension. The following boundaries are
especially important:

- Use Manifest V3, TypeScript, Preact, Vite, npm with `package-lock.json`,
  `chrome.storage.local`, a service-worker-owned Repository/Permissions
  boundary, typed cross-context messages, Vitest, and Playwright. A baseline
  change needs user approval and implementation evidence.
- Stay local-only in V1: no backend, remote code, network product feature, AI,
  model API, embeddings, semantic/vector search, accounts, sync, sharing,
  payment, subscriptions, plans, quotas, or entitlement enforcement.
- Never request `<all_urls>` at install time. Website access is optional
  HTTP(S) permission with exact-origin dynamic registration. Do not add broad
  static content-script matches or a `tabs` permission without approval.
- Preserve user control: do not fill whole pages, replace a whole field
  automatically, submit forms, insert HTML, or execute Template content.
- Do not create, write, or open an explanatory HTML artifact for the user
  without explicit approval for that specific HTML action. Prefer Markdown,
  tables, Mermaid, trees, pseudocode, and diff-shaped sketches. This does not
  restrict opening product UI, source HTML, test fixtures, or ordinary web
  pages for implementation, debugging, or QA.
- Do not read a field value unless the user explicitly chooses `Use current
  field content`, or opens the Picker after selecting non-empty text. The
  latter is temporary display-only and must never be persisted.
- Excluded sensitive or unsupported fields receive no value read, fingerprint,
  Field Profile, extension marker, field listener, UI, or fill behaviour.
- Use the earlier prototype only as read-only generic UI/technical evidence. Never
  copy its product-specific selectors, terminology, matching rules, host
  permissions, schema, or tests into FillNest.

Read the complete wording and exceptions in `AGENTS.md`, `PROJECT.md`, and
`CONTEXT.md`; this section is a safety summary, not a substitute.

## Implementation And Test Workflow

Start each change with inspection:

```sh
git status --short --branch
git log --oneline -8
rg --files src tests tasks docs
```

Preserve unrelated or pre-existing worktree changes. Do not reset, checkout,
discard, or fold them into a commit without clear authorization.

Before implementation, record only the readiness information the Task needs:
the install, development, test, build, and launch commands; the interface
through which the real result will be observed; required fixtures, accounts,
permissions, browsers, or services; relevant available or missing Skills; and
behaviour that will remain unverified. Running `npm run build` is not evidence
that a Popup, Side Panel, content script, permission prompt, or host-page
interaction was exercised and observed.

For a new or materially changed interaction, decide during Task shaping whether
a disposable Demo would reduce expensive uncertainty before implementation.
Record `Not needed` when the existing product and testing seams already make
the behaviour clear. A Demo validates a decision; it does not become production
scope or implementation authority by itself.

For a bug fix or feature with observable behaviour:

1. Identify the responsible Task and the exact acceptance rule.
2. Add the smallest focused failing unit/component/browser test.
3. Run it to prove the red state.
4. Implement the smallest change that turns it green.
5. Refactor only while the relevant tests remain green.
6. Run the required slice and regression checks.

Core commands:

```sh
npm ci
npm run dev -- --host 127.0.0.1
npm run typecheck
npm test
npm run build
npm run check
npm run test:e2e
git diff --check
```

`npm run check` runs type checking, unit tests, and build inspection. The
headed Playwright suite is required for built-extension integration evidence;
it uses a persistent testing profile because browser permission prompts cannot
be completed headlessly. Do not change production optional-host policy merely
to simplify automation. Record a skipped check and its reason rather than
silently omitting it.

## Repository-Local Skills

When the agent platform can use local skills, read the applicable full
`SKILL.md` before acting:

| Situation | Skill |
| --- | --- |
| Product ambiguity, high-impact decision, Task Contract shaping, or explicit Grill Mode request | `.agents/skills/grill-mode/SKILL.md` |
| Lightweight plan stress-test that does not need durable documentation | `.agents/skills/grilling/SKILL.md` |
| Make scope, flow, test strategy, or review findings easier to understand visually | `.agents/skills/show-me/SKILL.md` |
| Test-first feature or bug fix | `.agents/skills/tdd/SKILL.md` |
| Contract or implementation review | `.agents/skills/code-review/SKILL.md` |
| Domain terminology or architecture decision | `.agents/skills/domain-modeling/SKILL.md` |
| Turn a decision into a task contract | `.agents/skills/to-spec/SKILL.md` |
| Implement an accepted task | `.agents/skills/implement/SKILL.md` |

If work on one Task uncovers and fixes a bug owned by another Task's behaviour,
update the owning Task Contract or add a bounded addendum in the same handoff.
Do not let a bug-fix commit silently redefine another Task's accepted scope.

If the platform does not support these skills, follow the equivalent workflow
described in the source files and this guide. Skills never override user
instructions, `AGENTS.md`, or an accepted Task Contract.

## Git And Documentation Discipline

- Keep commits small, intentional, and scoped to a completed slice or approved
  remediation. A commit needs the owner's explicit instruction in the
  conversation or a Task Contract's recorded checkpoint policy; run relevant
  evidence and inspect diff ownership before committing.
- Accessibility is part of Definition of Done for any surface change, not a
  separate pass. `AGENTS.md` lists what a changed control needs.
  `tasks/023-cross-surface-accessibility-hardening.md` Addendum B records what
  is already verified, so a re-audit need not re-litigate it, and three open
  findings that need a real assistive-technology, high-contrast or zoom
  session.
- `npm run check` runs lint. `react-hooks/exhaustive-deps` is an error: every
  finding was resolved and the rule raised on 2026-09-08 (`4fa51e4`). Do not
  silence a new finding, and do not change hook dependencies to clear one
  without saying which user-visible behaviour that changes.
- Push only after confirming the branch and remote target. Record meaningful
  fixed points and evidence in `DEVELOPMENT.md`.
- Continue on the branch the previous agent used. A handoff between agents is
  almost always a token handoff - the next agent is continuing one body of
  work, not starting an independent line of development - so it does not get
  its own branch, and an existing branch is not split to separate one agent's
  commits from another's. A separate branch or worktree needs a stated reason
  of its own, such as protecting a `dist/` build the user is actively testing
  by hand. Refactor and product commits may share a branch; keep them
  separable by commit instead. (Owner decision, 2026-09-07.)
- The one standing exception is `main`, the release line, which the owner has
  worked from since 2026-09-11. Work that starts on `main` moves to a task
  branch before its first commit, and is merged and pushed to `main` only when
  the owner asks.
- A change to `docs/privacy-policy.md` is not finished until the public copy
  the store listing points at is republished from `npm run policy:public` and
  recorded in `docs/privacy-policy-published.json`. `npm run verify:store`
  reports the drift (Task 033 Addendum F).
- Use English for persistent content: code, comments, tests, task records,
  docs, logs, commits, and product text.
- `DEVELOPMENT.md` is the sole living status document. Keep it concise and
  current. Update it when task status, acceptance gates, known risks, verified
  checks, or next steps change; keep slice history in Task records, durable
  evidence, Git, or release notes.
- Update `README.md` only for public orientation. Update `tasks/README.md`
  when roadmap status or cross-Task ownership changes. Do not duplicate stable
  product rules across documents.
- Before handing off, state what changed, evidence run, skipped checks, known
  limits, and the exact next gate.

## Handoff Checklist

Before another agent begins work, it should be able to answer all of these
from repository files:

- What Task is authorized, and which slice is currently allowed?
- What fixed point and evidence support the current state?
- What risk tier, delivery controls, and checkpoint commit policy apply?
- Can the required behaviour be executed and directly observed, and what
  remains unverified?
- What user decision or manual checkpoint still gates progress?
- Which product rules cannot be weakened?
- Which tests are required, and which have been skipped with a reason?
- Is the worktree clean? If not, who owns the existing changes?

If any answer is unclear, pause and ask the user rather than reconstructing
intent from source code alone.
