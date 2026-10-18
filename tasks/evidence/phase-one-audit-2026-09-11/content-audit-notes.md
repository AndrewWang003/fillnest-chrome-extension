# Content Runtime Audit Evidence

## Fixed Point And Method

Final source inspection and probe rerun: `4327d88226d102f466ec4a49fe1502385dcdd254`.
Initial inspection began at `bd221db3d05db923e76502af8b03a86f696f962a`.
The later Keep Open selection repair (`fd65dda`) is present in the final fixed
point and is not reported below as an outstanding defect.

Reviewed PROJECT.md, CONTEXT.md, AGENTS.md and the relevant requirements and
later addenda in Tasks 003, 014, 016-020, 024, 030, 035, 036 and 038. Review was
source and contract inspection plus narrow executable probes. The root audit
owns the full check-set and browser-suite results; this note does not claim
that those broad gates have passed.

## Confirmed Findings

### C1 — P1: An enclosing label reads a rich Field's existing content as metadata

Source: `src/fields/dom-field.ts:153-155`; `readRichTextMetadata` calls this
helper at line 123, and `fieldObservedTitle` uses it at line 218.

Reproduction markup:

```text
<label>Message<div contenteditable="true">CONFIDENTIAL EXISTING DRAFT</div></label>
```

Calling `readSafeMetadata` returns `accessibleName` equal to
`MessageCONFIDENTIAL EXISTING DRAFT`; `fieldObservedTitle` returns that same
string. This happens without `Use current field content` and without a
selected-text Picker action. Eligibility and page snapshot collection invoke
this helper automatically. The draft also becomes part of the name used in
recognition and may affect eligibility as the user types. If the user creates
or binds an unrelated Template, the display-title path forwards the string as
`fieldObservedTitle`; `src/storage/state-helpers.ts:83-98` stores that title on
the Field Profile. This is a local privacy and identity bug, not evidence of
network transmission.

Ownership: Task 036, Reading Field Content and eligibility acceptance item 3;
Task 016 candidate zero-value-read boundary; AGENTS.md's explicit-action read
rule. Task 036's permitted post-insertion verification does not authorize a
read during eligibility. The same helper's `aria-labelledby` path can include
editable descendants of a referenced element, but only the enclosing-label
case was directly probed.

Evidence: first test in `content-probe.test.ts.txt`. The automatic metadata and
title contamination are executable evidence; persistence is traced through the
current write path, not separately exercised against browser storage.

### C2 — P2: Query state inside hash routes is discarded from Page identity

Source: `src/recognition/recognition-evidence.ts:203-206`, especially the split
that retains only the substring before `?`. `buildPageIdentityKey` reads only
`URL.searchParams`, which does not include the fragment's query string.

Both addresses return exactly `/app/form`:

```text
https://example.test/app#/form?entity=customers
https://example.test/app#/form?entity=invoices
```

These route states can represent different forms. If their Field keys are
equal, they are treated as the same exact Page/Field rather than requiring a
Logical Page confirmation. In an SPA the current-context check also sees no
Page-identity change. This can offer the wrong bound Template list on the
second form. Ordinary pre-fragment queries retain their distinguishing state;
the omission is specific to hash-router query state.

Ownership: Task 014 Addendum C items 4 and 5, and Task 020's conservative
identity requirement. The accepted exception for plain `#section` anchors
does not cover a `#/...?...` application route.

Evidence: second test in `content-probe.test.ts.txt`, executed against the
current identity builder. Wrong-list impact follows from exact-key resolution;
a browser create/bind/navigation flow was not separately run for this case.

### C3 — P2: A rich host that stops being editable retains its extension marker

Source: `src/content/content-script.tsx:1750-1754`. `fieldsWithin` filters nodes
using their *current* `isEditingHost` state. When an existing rich host changes
`contenteditable` to `false`, the mutation is observed but that node no longer
passes the filter, so it never reaches `markCandidate`'s marker-removal branch
at lines 1744-1746.

Reproduction: mount an unfocused named rich Field; wait for
`data-fillnest-field`; set `contenteditable="false"`; after lifecycle
reconciliation the now unsupported element still has `data-fillnest-field`.
Choosing an unfocused Field is deliberate: an active overlay has a separate
per-frame eligibility path, which does not repair this case.

Ownership: Task 016 runtime-state rule explicitly requires immediate marker
removal; Tasks 018 and 036 extend this lifecycle to rich Fields. No unsafe
insertion was demonstrated: the insertion path independently rechecks current
eligibility. The confirmed defect is incomplete zero-touch teardown.

Evidence: fourth test in `content-probe.test.ts.txt`, mounting the actual
content script under happy-dom with a Chrome-runtime stub. The test supplies
the browser-like `isContentEditable` getter because the DOM emulator does not
implement inherited editing-host state. A real-Chromium transition was not
separately run for this probe.

## Confirmed Design Limitation, Not An Implementation Contract Violation

`src/insertion/apply-text-insertion.ts:186-190` reports success whenever the
normalized Template text occurs anywhere in the host. A refused second
insertion of `Hello` into a host already containing `Hello` therefore looks
successful and may clear a previous rejection flag without inserting again.
The third probe confirms this ambiguity. Task 036 explicitly specifies a
post-insertion *presence* check and forbids broad pre-read behavior; no stronger
outcome proof was promised. Record this as a product limitation for a future
bounded decision, not as failure to implement the present presence-only rule.

## Coverage Ledger

| Area | Current evidence reviewed | Outcome / boundary |
| --- | --- | --- |
| Native and rich eligibility | `fields/dom-field.ts`, `field-eligibility.ts`; Task 017 matrix and rich-field unit/E2E cases | Allowlists and generic veto paths inspected. C1 and C3 remain. No new website-specific branches found. |
| Dynamic lifecycle and SPA convergence | `content-script.tsx`, Tasks 016/018 and 036 Addenda A/F/G/H/I; native-composer-transition and lifecycle specs | Address/Field convergence, replacement evidence, readonly exception and teardown traced. C3 remains. Task 016's accepted navigation/replacement trade-off was not reclassified as a bug. |
| Field and Page identity | `recognition-evidence.ts`, `dom-recognition.ts`, `logical-page-matching.ts`; Task 014 addenda and page-identity coverage tests | Stable-key migrations and same-Origin keyed evidence traced. C2 remains. Named rich hosts intentionally omit ordinal under Task 036; accepted equivalence is not an accidental collision finding. |
| Logical Page candidate collection | `recordLogicalPageObservation`, `collectOpaqueLogicalPageEvidence`, `resolveLogicalPageCandidateForField` | Bound-page gate, opaque payload, navigation checks and best-effort failure handling inspected. Repository union/separation and archive integrity belong to the root/data lane. |
| Selection and insertion | `apply-text-insertion.ts`, content runtime capture/insert, Task 003 Keep Open, Task 036 insertion | Original cross-Field snapshot issue reproduced in a DOM integration probe; final HEAD contains the owning-field, one-use repair. Root owns its repair regression results. Presence-only verification remains an accepted limitation. |
| Closed Shadow isolation | Build-mode constant, overlay/selection/status roots, trusted click capture, contained UI events, Task 030 production-build test | All three roots share production `closed` build mode. The accepted `dist-e2e` open-root exception and production isolation test are present. No new broad isolation claim beyond these gates. |
| Keyboard and focus hostility | Tab containment, deferred focus exit, real-focus tracking; Task 036 H/J tests | Existing accepted limits retained: asynchronously stolen focus can still close the Picker; page listeners registered earlier on capture paths are not a general security boundary. |
| Movable page status | Task 038 and status positioning/drag/storage code | Shared clamp, threshold, release-time write, reload read and theme-preserving style path inspected. Pointer-only movement is explicitly accepted, not a new accessibility violation. Real assistive technology and high-contrast sessions were not run. |
| Performance | Task 035 R7 measurement record and shared page snapshots | Batched targets/snapshots and idle behavior inspected; no new performance benchmark run. |

## Reproduction Command And Cleanup

The probes intentionally assert observed defective behavior, so a passing run
confirms the finding; it does not mean the behavior is correct. They are kept
as `.txt` to stay outside the default test and TypeScript/ESLint projects.
From the repository root:

```sh
cp tasks/evidence/phase-one-audit-2026-09-11/content-probe.test.ts.txt tasks/evidence/phase-one-audit-2026-09-11/content-probe.test.ts
cp tasks/evidence/phase-one-audit-2026-09-11/content-probe.config.mjs.txt tasks/evidence/phase-one-audit-2026-09-11/content-probe.config.mjs
npx vitest run --config tasks/evidence/phase-one-audit-2026-09-11/content-probe.config.mjs
rm tasks/evidence/phase-one-audit-2026-09-11/content-probe.test.ts tasks/evidence/phase-one-audit-2026-09-11/content-probe.config.mjs
```

Latest run at the final fixed point: 4/4 passed, one file, 389 ms. Temporary
executable copies were removed. No production code was changed in this lane.
