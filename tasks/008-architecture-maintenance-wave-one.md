# Task Contract

## Task ID And Name

Task 008 - Architecture Maintenance Wave One

## Goal

Remove superseded internal paths and establish small, testable single sources of truth at high-risk extension boundaries without changing accepted V1 product behaviour, persisted data, archive formats, permissions, or user-visible UI.

## Context

An architecture audit at fixed point `bee1113` found that the V1 structure is sound, but identified dead code left by superseded flows and a small number of unprotected message and ownership seams. The audit is evidence, not a product specification. This contract narrows the authorized work to the first four low-risk stages that were independently reviewable.

## Stable Decisions

- This Task is behaviour-preserving architecture maintenance. It must not add a product feature, alter a user flow, change Website Access, alter a persisted schema, or change the Backup Archive contract.
- The production Website Access grant flow remains two-phase: `requestWebsiteAccess` starts in the originating user-action stack; only the durable completion work queues behind recovery. No single-phase compatibility API remains solely for tests.
- Runtime request routing must fail at compile time when a new `RuntimeRequest` variant has no handler. It must never report an unhandled request as a successful `undefined` response.
- Sender authorization remains as strict as the accepted V1 implementation: privileged changes require an extension page, except Origin Activation may come from the matching authorized page context. Tests must exercise both allowed and rejected paths.
- Exact Permission Origin pattern parsing has one pure, IPv6-safe canonical implementation. Consumers must preserve existing canonical origin and registration behaviour.
- The definition of a Template filed under a Site has one shared pure implementation. Sites-page deep-link counts and Templates-page destination counts must remain identical for every current state.
- The Task corrects the stale `PROJECT.md` Restore wording: when current data is non-empty, Restore shows a prominent export recommendation but does not require an export/download action. A current impact preview and exact typed `restore` remain mandatory.

## Vertical Slices

| Slice | Outcome | Evidence | Status |
| --- | --- | --- | --- |
| 0. Superseded API Removal | Complete the in-progress removal of retired site-enable/runtime paths and update tests to cover the real two-phase grant sequence | Call-site search proves no retired production or test-only API remains; permission unit/e2e suites pass | Completed & Verified |
| 1. Dead Site Classification Removal | Remove the unreachable Site-template classification cluster and unused projection fields, retaining only live Site projection behaviour | Focused projection and Sites tests; Sites e2e regression | Completed & Verified |
| 2. Message Boundary Hardening | Make runtime routing exhaustive and add direct sender-authorization and two-phase ordering tests through a testable boundary | Compile-time exhaustiveness proof plus focused unit tests and permission e2e regression | Completed & Verified |
| 3. Shared Canonical Rules | Consolidate exact-origin pattern parsing and per-Site Template counts behind pure shared helpers | Canonical-pattern, Site count/deep-link, permission, and Sites regressions | Completed & Verified |
| 4. Review | Run full validation and independent Spec and Project Standards review | `npm run check`, `npm run test:e2e`, `git diff --check`, and two-axis review | Completed & Accepted |

## Explicitly Deferred

- Correlating runtime request and response types with a result map.
- Further splitting `TemplatesPage.tsx` or moving shared Side Panel primitives.
- Restructuring the sensitive-field eligibility expression.
- Consolidating content-script mutable interaction state.
- Extracting Archive-to-Repository-state mapping.
- Any changes to Chrome permissions, manifest capabilities, supported-field eligibility, recognition thresholds, host/page selectors, UI design, or Restore semantics beyond the documentation correction above.

## Acceptance Criteria

- No reachable source or test code depends on the retired one-phase Website Access API, retired site-enable runtime requests, or single-site mapping wrapper.
- The real two-phase grant ordering remains tested: permission request starts before queued durable completion, and a sibling Permission Origin remains ungranted.
- Dead Site classification code and unused projection values are removed without changing Site rendering, cleanup impacts, or Template Site Affinity behaviour.
- An unhandled `RuntimeRequest` variant is a compile-time failure; sender authorization rejects unprivileged contexts and preserves accepted matching-origin behaviour.
- Exact-origin parsing produces the same canonical results for all accepted existing patterns, including explicit ports and IPv6 where supported.
- Site Template counts used by Sites and Templates are derived from one helper and match for Global, multi-affinity, bound, and unbound Templates.
- Restore documentation consistently describes a visible, optional export recommendation; no document claims an export/download gate remains.
- All prior V1 checks remain passing and the final review reports no unresolved P1/P2 findings.

## Forbidden Scope

- Product features, product-flow changes, schema migrations, Archive version changes, import/merge semantics, permission expansion, dependencies, network activity, telemetry, UI redesign, or speculative abstractions.
- Deleting a path merely because its immediate production caller is absent without first proving it is not an accepted test, recovery, or compatibility boundary.

## Stop Conditions

Stop for user approval if a proposed consolidation changes canonical Permission Origin output, displayed Site counts, test fixture semantics, runtime message wire shape, sender authorization, or any accepted V1 behaviour.

## Status

Completed and accepted (2026-08-23). The implementation removed the retired paths, dead Site classification cluster, and unused projection values; it added a testable sender-authorization boundary, exhaustive queued-message routing, shared exact-origin parsing, and shared Site Template counting. Verification passed: `npm run check` (36 unit files / 292 tests and 11 build files), headed E2E (16/16), and `git diff --check`. Final Spec and Project Standards review found no unresolved P1/P2 findings.
