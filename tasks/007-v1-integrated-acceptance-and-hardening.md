# Task Contract

## Task ID And Name

Task 007 - V1 Integrated Acceptance And Hardening

## Goal

Validate the complete V1 as one production-like local extension, close integration defects and justified production counterexamples, document remaining limitations, and produce the final V1 acceptance handoff without adding new product features.

## Required Evidence Areas

- Fresh install, schema migrations, browser restart, service-worker restart, and malformed stored state.
- Global Activation, Origin Activation, Website Access grant/removal, external revocation, multiple tabs, sibling origins, and public-suffix Sites.
- Static, conditional, SPA-created, reconstructed, and disappearing fields without duplicate UI or listeners.
- Supported, ambiguous, sensitive, special-purpose, and externally controlled fields with no implicit excluded-field reads.
- Create-and-bind, Search, insertion, selection replacement, Edit, copy, Bind, Unbind, deletion, Site cleanup, export, and restore.
- Large Template libraries, concurrent accepted operations, stale impact previews, transaction rollback, and deterministic ordering.
- Keyboard-only operation, visible focus, accessible names, long Template content, viewport edges, hostile page styles/scripts, and replaceable local icon assets.
- Runtime and static proof of no extension-originated network traffic, remote code, telemetry, or unauthorized permissions.
- Privacy inspection proving that persisted identities and System Display Labels exclude record/customer data required to remain transient.
- A persistent manual-demo SPA page or equivalent documented hands-on fixture for final human review.
- Real external-website spot checks of the same generic, evidence-based field-eligibility and recognition rules already accepted in Task 001-005, recorded as a manual verification log. Any defect found this way is fixed only as a generic rule improvement (as Task 005's kebab-case/dotted URL-segment fix was); no site-specific selector, hostname check, or override is added, per `PROJECT.md`'s "Veto rules must be generic" principle and this Task's Forbidden Scope.

## Vertical Slices

| Slice | Outcome | Evidence | Status |
| --- | --- | --- | --- |
| 1. Integrated Matrix | Map every PROJECT success criterion and Task 001-006 invariant to an objective test or declared manual check | `tasks/evidence/007-traceability-matrix.md` - ~97 covered, ~21 partial, ~10 declared-manual across 16 PROJECT.md Success Criteria and all Task 001-006 Acceptance/Addendum Criteria | Complete |
| 2. Production Counterexamples | Add adversarial cases not represented by happy-path fixtures and fix only defects inside accepted V1 rules | Adversarial tests added for the highest-value gaps found in Slice 1: literal HTML/script insertion (no parsing/execution), exact-single-origin permission requests (no wildcard), synthetic non-trusted-event rejection on row actions, exactly-one-control after SPA reconstruction, sibling-field non-interference, a second entire-library-emptying path requiring typed `delete`, and byte-exact `siteAffinities` preservation on last-access revocation - all in `tests/unit/apply-text-insertion.test.ts`, `tests/unit/permission-lifecycle.test.ts`, `tests/unit/content-script-trusted-events.test.ts` (new), `tests/unit/content-script-spa-reconstruction.test.ts` (new), and `tests/unit/side-panel-library.test.tsx`; all passed against current code with no defects found. Real-site evidence recorded in `tasks/evidence/007-real-site-verification-log.md`. Remaining lower-priority gaps from the matrix (exact-pixel viewport breakpoints, adaptive tree expansion at 100+ scale, hostile-stylesheet isolation, a11y sweep across all four surfaces) are declared manual/deferred limitations, recorded in `DEVELOPMENT.md` | Complete |
| 3. Human Acceptance Package | Provide repeatable local install, demo, data-reset, and review instructions | `demo/manual-review-fixture.html` reuses the exact markup from `tests/e2e/static-field-loop.spec.ts`'s `fixtureHtml()` (not a new parallel fixture), served with `demo/README.md` covering build/load/serve/grant/review/reset steps and a checklist tied to specific `PROJECT.md` Success Criteria; smoke-verified to load and run its SPA/conditional/reconstruct handlers cleanly with no console errors | Complete |
| 4. Final Review | Perform independent Spec and Project Standards review at a fixed Git point | Independent adversarial Spec and Project Standards review, run against the working tree ahead of `26fab0b`, found no unresolved P1/P2; highest-risk invariants (excluded-field zero value reads, exact-origin permissions, synthetic-event rejection, Site Affinity preservation, fail-closed Restore recovery) personally re-verified against source. One P3 found and fixed: `DEVELOPMENT.md`'s stale test-count line | Complete |

## Allowed Scope

- Integration fixes and testability improvements required to meet already accepted V1 behaviour.
- Synthetic fixtures, persistent demo pages, accessibility corrections, documentation, and current status.
- Dependency updates only when separately approved and required to fix a demonstrated V1 defect or security issue.

## Forbidden Scope

- New product features, redesigned domain contracts, backend, network services, AI, Contacts, multi-field filling, sharing, sync, accounts, plans, quotas, payments, telemetry, release-store work, or speculative abstractions.
- Weakening an earlier Task acceptance criterion merely to make the integrated suite pass.

## Acceptance Criteria

- Every V1 Success Criterion in `PROJECT.md` has objective passing evidence or an explicit, user-approved manual limitation.
- The complete clean validation sequence passes from the lockfile and a clean build output.
- An adversarial Spec review and a Project Standards review report no unresolved P1/P2 findings.
- `DEVELOPMENT.md` accurately separates verified facts, manual evidence, remaining risks, and deferred work.
- The final handoff identifies the exact Git fixed point and does not claim Chrome Web Store or commercial readiness.

## Stop Conditions

Stop for approval when a failing integrated case requires a product-rule change, scope expansion, permission expansion, dependency change, data migration not covered by an accepted prior contract, or weakening of privacy and explicit-control guarantees.

## Status

Accepted after Grill Mode (2026-08-21, conducted in Chinese at the user's request). Three decisions were resolved:

- **Real-website evidence scope**: the user wants the ability to optimize for specific real websites while keeping the underlying field-discovery architecture generic and self-learning. Resolved as: real external websites are used only as additional evidence input for the existing generic, evidence-based recognition engine (as Task 005's kebab-case/dotted-path fix already did); Task 007 adds no site-specific selector, hostname branch, or override, since that would conflict with `PROJECT.md`'s "Veto rules must be generic" principle and this Task's Forbidden Scope. A genuine site-specific customization capability, if ever wanted, is a separate future product decision outside Task 007.
- **Persistent demo page**: reuse the existing e2e SPA fixture already exercised by automated tests (e.g. `static-field-loop.spec.ts`) rather than building a new parallel fixture, packaged with documented run/reset steps for human review.
- **Final Review process**: reuse the Task 006 audit pattern - a background review pass for breadth, with the highest-severity findings personally re-verified against source before reporting, and only unresolved P1/P2 findings blocking acceptance.

Implementation of the four Vertical Slices is authorized.

**Complete and accepted at `26fab0b` (2026-08-21).** The user explicitly delegated independent decision-making for this Task's implementation, asking for a report of decisions made rather than per-decision confirmation. All four Vertical Slices are complete (see the table above and `DEVELOPMENT.md`'s Task 007 section for the full evidence list). Full verification: `tsc --noEmit` clean, `vitest run` 35 files / 284 tests passing, `npm run build` succeeds (11 verified extension files), `npx playwright test` 16/16 passing. This handoff identifies `26fab0b` as the exact V1 fixed point and does not claim Chrome Web Store or commercial readiness, per this Task's own Acceptance Criteria.
