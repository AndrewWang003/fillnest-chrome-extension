# QA State Convergence Repairs

> **Status as executed (recorded 2026-09-07 by a later agent).** `[x]` ran as
> written. `[!]` did not, and the mark is deliberate - ticking them would hide
> the gap.
>
> Task 3's steps 2-4 are the important ones. The plan required proving which
> layer was stale before choosing a fix, and Task 004 Addendum B says the same
> thing in its contract. That was never recorded. The fix that was chosen -
> invalidating the content runtime's Field Context cache - was later measured
> not to change the outcome of the E2E that accepted it, and the unit
> regression written for it passed with the production change removed. The
> reported cross-tab bug therefore has no proven root cause. See
> `tasks/004-site-access-and-data-management.md`, "Addendum B Root Cause -
> Still Unproven".
>
> Task 2 shipped and satisfied its acceptance criteria, but those criteria only
> compared asset identifiers, and the new icon collided with an existing one.
> See Task 027 Addendum E.1.
>
> Task 4 step 2's independent review did not catch either. Both were found by a
> later re-audit.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair live Reset teardown, distinguish the two Bind audience icons, and make Clear Site Data converge across open tabs without reload.

**Architecture:** Keep the three repairs in their owning boundaries. PermissionLifecycle synchronously delivers the same idempotent revocation used by external permission removal; the Picker icon boundary inlines the supplied asset; content runtime invalidates removed persistent Field identities on business-state changes and re-resolves before reuse. Each repair is test-first and separately committed.

**Tech Stack:** TypeScript, Preact, Chrome Manifest V3 APIs, Vitest, Playwright, Vite.

**Spec:** `docs/superpowers/specs/2026-09-07-qa-state-convergence-repairs-design.md`

## Global Constraints

- Preserve Reset journaling, fail-closed behavior and canonical-state verification.
- Preserve Task 027 Template audience and search rules.
- Add no dependency, permission, public extension resource, network use or Task 032 Phase B extraction.
- Existing production Shadow Roots remain closed; headed E2E uses the recorded `dist-e2e` exception only.

---

### Task 1: Reset Live Page Teardown

**Files:**
- Modify: `tests/unit/permission-lifecycle.test.ts`
- Modify: `src/permissions/permission-lifecycle.ts`
- Modify: `tests/e2e/deletion-safety.spec.ts`
- Modify: `tasks/009-factory-reset.md`

**Interfaces:**
- Consumes: `PermissionPlatform.listTabIds()` and `sendRevocation(tabId, patterns)`.
- Produces: `PermissionLifecycle.removeAllWebsiteAccess()` that completes an explicit best-effort revocation delivery before returning removed Origins.

- [x] **Step 1: Write the failing unit test**

Add a case that grants `https://example.test/*`, calls `removeAllWebsiteAccess()`, and expects every enumerated tab to receive `PERMISSION_REVOKED` with that pattern before the returned promise resolves.

- [x] **Step 2: Run the unit test and verify red**

Run: `npx vitest run tests/unit/permission-lifecycle.test.ts`
Expected: FAIL because `removeAllWebsiteAccess` relies only on the unawaited removal event.

- [x] **Step 3: Implement the minimal lifecycle boundary**

Extract an idempotent private delivery helper:

```ts
private async notifyRevokedPatterns(patterns: string[]): Promise<void> {
  const tabIds = await this.platform.listTabIds();
  await Promise.all(tabIds.map((tabId) => this.platform.sendRevocation(tabId, patterns)));
}
```

Call it from `removeAllWebsiteAccess()` after verified removal/reconciliation and reuse it from `handleRemoved()`.

- [x] **Step 4: Add and run the headed regression**

Extend Factory Reset E2E to keep an authorized fixture page and open Picker alive, submit Reset, then assert the active marker and overlay disappear without reload.

Run: `npx playwright test tests/e2e/deletion-safety.spec.ts --grep "Factory Reset"`
Expected: PASS after the fix.

- [x] **Step 5: Verify and commit**

Run: `npx vitest run tests/unit/permission-lifecycle.test.ts tests/unit/reset-transaction.test.ts`

Commit: `fix: tear down live pages during reset`

### Task 2: Distinct Bind Audience Icons

**Files:**
- Create: `src/ui/icons/assets/share-network.svg`
- Modify: `src/ui/icons/FillNestIcons.tsx`
- Modify: `src/ui/picker/InlinePicker.tsx`
- Modify: `tests/unit/inline-picker.test.tsx`
- Modify: `tasks/027-explicit-template-audience-scope.md`

**Interfaces:**
- Consumes: owner-supplied `public/share-network.svg` and existing `ProvidedAssetIcon`.
- Produces: `BindSharedSetIcon(props: IconProps)` using the inlined `share-network.svg` asset.

- [x] **Step 1: Write the failing component assertion**

In the existing dual-Bind test, assert:

```ts
expect(fieldButton.querySelector('[data-fillnest-asset="plugs-connected.svg"]')).not.toBeNull();
expect(setButton.querySelector('[data-fillnest-asset="share-network.svg"]')).not.toBeNull();
```

- [x] **Step 2: Run the focused test and verify red**

Run: `npx vitest run tests/unit/inline-picker.test.tsx -t "offer 'Bind to this field' and 'Bind to Shared Set'"`
Expected: FAIL because both buttons use `plugs-connected.svg`.

- [x] **Step 3: Add the asset and component**

Copy the approved SVG source into the source asset directory, import it with `?inline`, register it in `PROVIDED_ICON_DATA_URLS`, and export `BindSharedSetIcon`.

- [x] **Step 4: Use the component only for Shared Set Bind**

Render `BindSharedSetIcon` when `onBindToFieldOnly` makes `onBind` mean `Bind to Shared Set`; retain `BindIcon` for every field-only Bind.

- [ ] **Step 5: Verify and commit**

Run the focused unit file and `npm run build`; verify the manifest still exposes no web-accessible resources.

Commit: `fix: distinguish shared set bind icon`

### Task 3: Clear Site Data Cross-Tab Convergence

**Files:**
- Modify: `tests/unit/content-script-spa-reconstruction.test.ts` or add a focused content-runtime test beside it
- Modify: `tests/e2e/reset-site-mappings.spec.ts`
- Modify: `src/content/content-script.tsx`
- Modify: `tasks/004-site-access-and-data-management.md`

**Interfaces:**
- Consumes: `BUSINESS_STATE_CHANGED`, `resolveFieldContext(evidence)`, and the document-lifetime Field Context cache.
- Produces: an invalidation/re-resolution boundary preventing deleted Page/Field Profile IDs from being reused after an external business mutation.

- [x] **Step 1: Write the two-Origin failing E2E**

Keep Site 1 and Site 2 open, establish B/C/Set2/T2, clear Site 2, reconstruct without reload, and assert ordinary T2 is searchable from Site 1. Run once with Site 1 Picker open and once reopened. Assert owner-only T2 stays hidden.

- [!] **Step 2: Run the focused E2E and capture the failing checkpoint** - NOT DONE

Run: `npx playwright test tests/e2e/reset-site-mappings.spec.ts`
Expected: FAIL without reload; record whether Repository state, broadcast refresh, or Field Context identity is stale.

- [!] **Step 3: Add a focused red unit regression for the proved boundary** - NOT DONE

Drive `BUSINESS_STATE_CHANGED` after a cached recognized context and assert the next focus/data operation invokes `RESOLVE_FIELD_CONTEXT` again rather than reusing the deleted identity.

- [!] **Step 4: Implement only the proved invalidation** - NOT DONE

If the context hypothesis is confirmed, replace the immutable cache with an epoch-resettable cache and make the focused Field re-resolve before its next mutation/render. Do not alter search filtering or owner-only visibility.

- [ ] **Step 5: Verify and commit**

Run the focused content-runtime tests and the two-Origin E2E.

Commit: `fix: refresh field context after site data clear`

### Task 4: Integrated Verification And Handoff

**Files:**
- Modify: `DEVELOPMENT.md`
- Modify: the three owning contracts with final root causes and evidence

**Interfaces:**
- Consumes: Tasks 1–3 at green commits.
- Produces: accepted implementation evidence without authorizing Task 032 Phase B.

- [x] **Step 1: Run static and complete automated checks**

Run: `git diff --check`, `npm run check`, the production Picker isolation test, and `npm run test:e2e`.

- [!] **Step 2: Run independent review** - PARTIAL

Review against the approved spec and project standards; resolve every actionable P0-P2 or record an explicit owner deferral.

- [x] **Step 3: Update durable status and commit**

Record exact root causes, test counts, skipped checks and remaining risks in the owning contracts and `DEVELOPMENT.md`.

Commit: `docs: record QA state convergence evidence`
