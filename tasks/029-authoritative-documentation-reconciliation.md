# Task 029 — Authoritative Documentation Reconciliation

**Version:** `0.1.2 Task 20`
**Status:** Complete on 2026-09-07. All six slices delivered with evidence.
See `DEVELOPMENT.md`.
**Prerequisites:** None for the documentation work. The conformance check in
Slice 4 should land after Task 028, so it validates the final button labels.
**Source:** `tasks/evidence/whole-extension-audit-2026-09-06.md`, findings
D1–D6.

## Goal

Make `PROJECT.md`, `CONTEXT.md`, `tasks/README.md`, and `README.md` describe
the product that exists. `docs/agent-handoff.md` ranks `PROJECT.md` and
`CONTEXT.md` above `DEVELOPMENT.md` and instructs an agent to **stop rather
than guess** when they conflict. Four live conflicts currently make that stop
rule fire on the most active area of the codebase.

## User Value

Indirect but real: every future change to FillNest starts by reading these
documents. While they disagree with the product, each new agent either stops,
or guesses and encodes the wrong rule. Task 026 shipped a fix for behaviour
`PROJECT.md` still mandates; a stale label in the same area silently disabled
an E2E test that was then recorded for weeks as a "known pre-existing
failure."

## Confirmed Product Decisions

- **The `0.1.2` release scope legitimately expanded** (project owner,
  2026-09-06). Tasks 014–027 were each governed by their own accepted contract
  and evidence gate; what failed was `PROJECT.md` tracking them. The `0.1.2`
  release row is therefore rewritten to describe what was actually built and
  accepted, rather than treating the work as unauthorized.
- A consequence the owner accepted: the release row becomes a record of what a
  release contains rather than a constraint on what it may contain. Scope
  control continues to live in per-Task contracts and their acceptance gates,
  which is where it has actually operated.
- Documentation drift of this kind is treated as a defect class with an
  automated check, not as a periodic manual cleanup. Task 022 attempted the
  manual approach and missed all four conflicts below.

## Scope

### Slice 1 — `PROJECT.md` release scope (finding D1)

`tasks/README.md` labels eighteen contracts `0.1.2 Task 01`–`Task 18`
(Tasks 010–027). `PROJECT.md`'s `0.1.2` row names five themes covering roughly
Tasks 010–013.

- Rewrite the `0.1.2` row to name every theme actually delivered: interaction
  feedback consistency; Side Panel header and notification region;
  Sites/Templates information architecture; generic form compatibility
  learning; eligibility and lifecycle contract, fixtures, improvement and
  acceptance; Logical Page Identity and its implementation; Shared Template
  Sets, their cross-Site linking, per-Field Overrides, and explicit audience
  scope; cross-surface accessibility hardening; and current-state
  documentation alignment.
- State explicitly that complex `contenteditable`/combobox support remains
  the one unstarted `0.1.2` candidate, so its absence is not read as an
  omission.
- Do not restate per-Task rules in `PROJECT.md`. The row names themes and
  points at `tasks/README.md`.

### Slice 2 — `PROJECT.md` edit-scope and label rules (findings D2, D3)

- `PROJECT.md:153` states scope choices follow from "multiple Bindings **or
  Site Affinities**". Task 026 removed the Site Affinity term as a contract
  violation, with a regression test pinning the opposite. Correct the rule to
  match: scope is calculated from actual effective consumers — direct
  Bindings, Shared Template Set slots, and Overrides — never Site Affinity
  count.
- Replace the documented `Save a copy for this field` with the labels the
  product ships: `Save everywhere`, `Save a copy here`, `Save for shared
  fields`, `Save for this field`, and `Share with the Set`. Describe what each
  scope does, since the names alone no longer disambiguate.

### Slice 3 — `CONTEXT.md` domain language (finding D4)

Two definitions are now false, and seven load-bearing terms are unregistered.

- **Shared Template Set** — remove "share one ordered effective Template
  list". A Set holds an ordered list of Slots; members resolve it individually.
- **Shared scope** — a member's effective list is the Set's Slots resolved
  per-Slot against that Field's own Override or Exclusion, with owner-only
  Slots visible to exactly one member.
- Register, with `_Avoid_` lines in the existing style: **Shared Template
  Slot**, **Override**, **Exclusion**, **Field-only relationship**,
  **Audience**, **Promotion** (`Share this version`), and **Collapse**.
- Disambiguate **Shared Template Set** (local, Field-to-Field, in V1) from
  **Template Share Package** (user-to-user, `0.2.1`) and from the V1 non-goal
  "team sharing", which the shared vocabulary currently blurs.

### Slice 4 — Make drift a build failure (new)

A conformance script wired into `npm run check`:

- Every user-facing control label quoted in `PROJECT.md` exists as a rendered
  label in `src/ui/`.
- Every `0.1.2 Task NN` entry in `tasks/README.md` maps to a theme named in
  `PROJECT.md`'s release row for that version.
- Every Task contract file referenced by `tasks/README.md` exists, and every
  contract file in `tasks/` is referenced.

The check reports what drifted; it does not rewrite anything.

### Slice 5 — `tasks/README.md` internal drift (found while planning)

The same `0.1.2` conflict exists inside the roadmap itself, in two more places
the audit did not reach:

- Its **Post-MVP Release Sequence** table describes `0.1.2` as "Items 1-5 from
  the Next-Version Discussion Queue" — the same narrow scope `PROJECT.md`
  states, contradicting the eighteen `0.1.2 Task NN` rows in the table directly
  above it.
- Its **`0.1.2` Execution Order** list stopped at Task 025, omitting Tasks 026
  and 027 entirely. Entries for Tasks 026–032 were added while planning this
  Task; the omission is recorded here so the conformance check in Slice 4
  covers execution-order completeness too.

Slice 4's check must therefore assert three things, not two: every roadmap row
maps to a release theme, every contract file is referenced, **and** every
roadmap row appears in the execution order for its version.

### Slice 6 — Smaller staleness (findings D5, D6)

- `README.md:70–72` claims Task 020 is "the most recently accepted". Replace
  the per-Task claim with a pointer to `DEVELOPMENT.md`, so this line cannot
  go stale again.
- `package.json` and `public/manifest.json` both declare `0.1.1` while the
  tree carries eighteen `0.1.2` tasks. Decide and record the version the
  `0.1.2` train ships under, and extend the manifest policy gate to assert
  manifest and `package.json` agree.

## Explicit Non-Goals

- Any code behaviour change. Slices 1–3 and 5 are documentation; Slice 4 adds
  a check and a script, not a product change.
- Re-opening, re-authorizing, or re-litigating any accepted Task.
- Rewriting `DEVELOPMENT.md`'s history. It is a current-state document; the
  audit record lives in `tasks/evidence/`.
- Introducing a new domain term that no shipped behaviour uses.

## Acceptance Criteria

1. `PROJECT.md`'s `0.1.2` row names a theme for every Task 010–027, and names
   the one unstarted candidate.
2. `PROJECT.md` no longer states any rule the code contradicts. Specifically,
   its edit-scope rule matches `resolveTemplateEditScope`, and every control
   label it names exists in `src/ui/`.
3. `CONTEXT.md` defines every term Tasks 026 and 027 rely on, and its Shared
   Template Set and Shared scope entries describe per-Slot resolution.
4. A deliberately introduced drift — a `PROJECT.md` label that no UI renders,
   or a `tasks/README.md` entry with no matching release theme — fails
   `npm run check`.
5. `README.md` makes no per-Task acceptance claim.
6. `npm run check` passes. The headed E2E suite is unaffected and is run once
   as a regression guard.

## Expected Implementation Slices

1. `PROJECT.md` release scope.
2. `PROJECT.md` edit-scope rule and save-scope labels.
3. `CONTEXT.md` domain language.
4. Conformance script and `npm run check` wiring.
5. `tasks/README.md` release-sequence and execution-order alignment.
6. `README.md` and version alignment.

Slice 4 lands after Task 028 so it validates final labels.
