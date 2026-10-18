# Task 007 Slice 2 - Real External-Website Verification Log

Per the Task 007 Grill Mode decision (2026-08-21, recorded in the Task 007
contract's `## Status`): real external websites are used only as additional
evidence input for the existing generic, evidence-based recognition and
eligibility engine. Any defect found through this log is fixed as a generic
rule improvement, never as a site-specific selector, hostname branch, or
override. This log is cumulative and expected to grow over time as more
real-site spot checks are performed; it is not a one-time fixed-size
deliverable.

Methodology note: because this sandboxed environment has no interactive OS
accessibility-permission dialog for granting a fresh Chrome Website Access
grant against a real external origin, real-site checks use the existing
`manifest.json` `host_permissions` pre-seed technique already used by this
project's own e2e fixtures - the real host is written into `manifest.json`
temporarily, the extension context is launched once to let Chrome record the
grant, then the manifest is restored to its normal permission-less baseline.
This is a test-authoring technique only; the shipped extension never
declares broad or pre-granted host permissions (see `tests/unit/manifest-policy.test.ts`
and `tests/unit/runtime-network-allowlist.test.ts`).

## Entries

### 2026-08-21 - demoqa.com/text-box and qaautomationlabs.com/testing/form.php

**Trigger**: user report during Task 005 hands-on testing - "when I create a
template for a field, I can see the template. But when I select another
field then back to the former one, then I can only see the template from
the search function and cannot find it in the template area."

**Scenario reproduced**: both sites use kebab-case or dotted URL path
segments (`/text-box`, `/testing/form.php`). `buildPageIdentityKey`'s path
normalization (`src/recognition/recognition-evidence.ts`) blanket-rejected
any path segment containing a hyphen, underscore, or dot, treating the whole
page identity as unrecoverable (`null`) on refocus. This silently dropped
Binding recognition for any page whose URL uses ordinary kebab-case routing
- a very common real-world pattern, not represented in the project's
existing synthetic e2e fixtures (which use simple single-word path
segments).

**Root cause**: `normalizePathSegment` used `/^[a-z]+$/u` after rejecting
any hyphen/underscore, rather than distinguishing "a record-name slug" (which
must still fail closed) from "an ordinary static route word" (which should
not).

**Fix (generic rule, not site-specific)**: `normalizePathSegment` now accepts
`/^[a-z][a-z_.-]*$/u` for a segment with no digit; a record-name *slug* next
to `edit`/`view`/`details`/`profile` is still rejected, but by
`buildPageIdentityKey`'s own lookahead check against the following segment,
not by blanket-rejecting punctuation. No hostname, path, or site identifier
for either site appears anywhere in the fix.

**Verification**: `tests/unit/recognition-evidence.test.ts` was extended with
a regression suite (`sign-up`, `contact-us`, `text-box`, `testing/form.php`
now resolve; `customers/morgan-reed/edit` still correctly returns `null`).
Manually re-verified against both live sites via Playwright against the
real, currently-published pages after the fix landed - Binding recognition
survives refocus on both.

**Status**: Fixed and committed (`4898bbe`). Covered going forward by the
automated regression suite above, not by an ongoing dependency on either
site staying reachable or unchanged.

## Coverage note for Task 007 acceptance

This log currently documents one confirmed real-world defect and its
generic-rule fix, found through real-site spot-checking during Task 005.
No further real-site defects have been found as of this Task 007 pass.
Task 007's Slice 2 automated adversarial-fixture work (see
`tests/unit/apply-text-insertion.test.ts`, `tests/unit/permission-lifecycle.test.ts`,
`tests/unit/content-script-trusted-events.test.ts`,
`tests/unit/content-script-spa-reconstruction.test.ts`,
`tests/unit/side-panel-library.test.tsx`) covers the adversarial cases
identified as gaps in `tasks/evidence/007-traceability-matrix.md`; this log
covers the complementary "real site, not just synthetic fixture" evidence
requirement without expanding scope into an open-ended website compatibility
matrix, which is explicitly not a V1 goal.
