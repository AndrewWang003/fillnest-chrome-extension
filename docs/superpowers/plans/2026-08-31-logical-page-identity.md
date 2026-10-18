# Logical Page Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Task 014's user-confirmed, same-Origin Logical Page Matching contract without persisting raw page text or silently inheriting a Binding.

**Architecture:** Add a pure recognition module that derives normalized route and keyed semantic signatures, then carry its opaque evidence through the existing content-script/message boundary to a Repository-owned resolver. The Repository owns rule validation, atomic merge/separation, schema migration, and archive state; the Picker and Sites page render only Repository-provided candidates and commands.

**Tech Stack:** Manifest V3, TypeScript, Preact, `chrome.storage.local`, Vitest, headed Playwright.

**Spec:** `tasks/014-logical-page-identity.md`

## Global Constraints

- Matching is exact-Origin only; no external network, remote code, AI, embeddings, selectors, DOM paths, raw page text, or field values. A Page Observation is persisted only after that Page has a direct Binding and contains opaque signatures only.
- Persist semantic text only as Site-specific keyed hashes; never persist raw labels, names, or group text.
- Candidate review is status-strip `Review` inside an opened Inline Picker; dismissal writes nothing and is session-suppressed.
- Route Pattern and both semantic Jaccard scores must be at least `0.85`; exact FieldProfile identity remains mandatory for Binding inheritance.
- Every mutation uses `FillNestRepository` candidate-state validation and fails closed; no Picker Undo is created.
- Persistent project content, source, tests, and user-facing strings remain English.

---

### Task 1: Opaque Route and Semantic Evidence

**Files:**
- Create: `src/recognition/logical-page-matching.ts`
- Modify: `src/recognition/dom-recognition.ts`
- Test: `tests/unit/logical-page-matching.test.ts`

**Interfaces:**
- Produces `LogicalPageEvidence { origin, routePattern, fieldFeatures, groupedFieldFeatures, fieldIdentityKey }`.
- Produces `createSiteKey()`, asynchronous `keyedHash(siteKey, normalizedText)`, and `jaccardSimilarity(left, right)`.
- Consumes `FieldRecognitionMetadata` and eligible `SupportedField` metadata only.

- [x] **Step 1: Write failing unit tests**

```ts
expect(buildRoutePattern("https://forms.test/main/123/form")).toBe("/main/:number/form");
expect(buildRoutePattern("https://forms.test/main/456/form")).toBe("/main/:number/form");
expect(jaccardSimilarity(new Set(["a", "b"]), new Set(["a", "c"]))).toBe(1 / 3);
await expect(keyedHash("site-key", "Applicant email")).resolves.not.toContain("Applicant");
```

- [x] **Step 2: Run the focused test and verify RED**

Run: `npm test -- tests/unit/logical-page-matching.test.ts`

Expected: the module or exports are missing.

- [x] **Step 3: Implement the minimal pure evidence module**

```ts
export function jaccardSimilarity(left: ReadonlySet<string>, right: ReadonlySet<string>): number {
  const union = new Set([...left, ...right]);
  if (union.size === 0) return 1;
  return [...left].filter((value) => right.has(value)).length / union.size;
}
```

Use only normalized numeric/UUID route segments, `URL`, `crypto.subtle`, and generic eligible-field metadata. `keyedHash` returns `Promise<string>` from HMAC-SHA-256; return `null` for ambiguous route data.

- [x] **Step 4: Run focused tests and verify GREEN**

Run: `npm test -- tests/unit/logical-page-matching.test.ts`

Expected: all new route, hashing, group-feature, and threshold tests pass.

### Task 2: Schema V5 and Repository Invariants

**Files:**
- Modify: `src/storage/fillnest-repository.ts`
- Test: `tests/unit/repository-integrity.test.ts`
- Test: `tests/unit/repository.test.ts`

**Interfaces:**
- Adds `LogicalPageSiteKeyRecord`, `LogicalPageRuleRecord`, `LogicalPageProvenanceRecord`, and V5 state collections.
- Adds `ResolveLogicalPageCandidateInput` and a result that distinguishes recognized context from a user-reviewable candidate.
- Consumes opaque evidence from Task 1; never accepts raw semantic text.

- [x] **Step 1: Write failing migration and validation tests**

```ts
expect(await repository.read()).toMatchObject({ schemaVersion: 5, logicalPageSiteKeys: [], logicalPageRules: [], logicalPageProvenance: [] });
expect(() => validateCandidateState({ ...state, logicalPageRules: [{ origin: "bad" }] })).toThrow();
```

- [x] **Step 2: Verify RED**

Run: `npm test -- tests/unit/repository.test.ts tests/unit/repository-integrity.test.ts`

Expected: V5 fields and rule invariant validation are absent.

- [x] **Step 3: Implement V4-to-V5 migration and invariant checks**

```ts
function migrateV4ToV5(value: Record<string, unknown>): Record<string, unknown> {
  return { ...value, schemaVersion: 5, logicalPageSiteKeys: [], logicalPageRules: [], logicalPageProvenance: [] };
}
```

Validate canonical Origin, Site membership, unique Site-key/rule/provenance IDs, encoded HMAC key/hash format, Page/Field/Binding relationships, and no provenance across Origins.

- [x] **Step 4: Verify GREEN**

Run: `npm test -- tests/unit/repository.test.ts tests/unit/repository-integrity.test.ts`

Expected: legacy migration preserves all prior records and malformed matching state is rejected without a write.

### Task 3: Page Observations, Candidate Resolution, and Confirmed Atomic Merge

**Files:**
- Modify: `src/storage/fillnest-repository.ts`
- Test: `tests/unit/repository.test.ts`

**Interfaces:**
- Adds an additive V5-to-V6 migration and `LogicalPageObservationRecord`.
  An Observation is persisted only for a PageProfile with a direct Binding;
  it contains one Site-key reference, exact Origin, normalized Route Pattern,
  and the two opaque feature sets.
- Adds `resolveLogicalPageContext(input)` and `confirmLogicalPageCandidate(input)`.
- `confirmLogicalPageCandidate` returns canonical Page/Field IDs plus the merged Binding IDs.

The V5-to-V6 migration and bounded Observation invariants are complete and
independently reviewed. The remaining steps in this task cover candidate
resolution and confirmation only.

- [ ] **Step 1: Write failing Repository tests**

```ts
const candidate = await repository.resolveLogicalPageContext(evidenceForRecord456);
expect(candidate.candidate).toMatchObject({ reviewRequired: true });
const result = await repository.confirmLogicalPageCandidate({ candidateId: candidate.candidate.id });
expect(result.mergedBindingTemplateIds).toEqual(["template-a", "template-b"]);
```

Include tests for V5-to-V6 preservation; the last-direct-Binding Observation
boundary; both `0.85` thresholds; exact-Field-only inheritance; same-Template
Binding usage addition; unchanged Template total usage; stale candidate
rejection; and a no-write dismissal.

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/unit/repository.test.ts`

Expected: resolver and confirm command do not exist.

- [ ] **Step 3: Implement one Repository transaction**

```ts
return this.runMutation(async () => {
  const state = await this.read();
  const candidate = resolveCandidateOrThrow(state, input);
  const next = mergeExactFieldBindings(state, candidate, this.dependencies);
  return this.commit(next);
});
```

Only merge exact Field identity keys. Union Template IDs, add duplicate Binding usage counts, retain Template records, and rely on `commit` for all-or-nothing validation.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- tests/unit/repository.test.ts`

Expected: merge semantics and rejection cases pass with a single persisted candidate state.

### Task 4: Rule Reuse and Stop-Matching Separation

**Files:**
- Modify: `src/storage/fillnest-repository.ts`
- Test: `tests/unit/repository.test.ts`

**Interfaces:**
- Adds `stopLogicalPageMatching({ ruleId })`.
- Existing context resolution returns canonical IDs only when the stored rule's Origin, Route Pattern, and both current signatures pass.

- [ ] **Step 1: Write failing reuse and separation tests**

```ts
expect((await repository.resolveLogicalPageContext(matchingFutureEvidence)).recognized).toBe(true);
await repository.stopLogicalPageMatching({ ruleId: "rule-1" });
expect(bindingsFor("field-a").map((b) => b.templateId)).toEqual(["i", "o", "p", "j", "k", "l"]);
expect(bindingsFor("field-b").map((b) => b.templateId)).toEqual(["i", "o", "p", "j", "k", "l"]);
```

Assert copied full Binding usage on both separated Fields, unchanged Template usage, and rollback when provenance is malformed.

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/unit/repository.test.ts`

Expected: future reuse and separation methods are absent.

- [ ] **Step 3: Implement rule resolution and separation**

Use provenance to restore page/field relationships, copy the post-merge direct Binding union to each separated exact Field, delete the rule and provenance atomically, and reject malformed history before committing.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- tests/unit/repository.test.ts tests/unit/repository-integrity.test.ts`

Expected: rule reuse, separation, and malformed-provenance rollback pass.

### Task 5: Archive, Reset, and Site Cleanup Compatibility

**Files:**
- Modify: `src/backup/archive-contract.ts`
- Modify: `src/storage/fillnest-repository.ts`
- Test: `tests/unit/archive-contract.test.ts`
- Test: `tests/unit/backup-restore.test.ts`
- Test: `tests/unit/reset-transaction.test.ts`
- Test: `tests/unit/remove-site-transaction.test.ts`

**Interfaces:**
- Archive version 2 serializes V5 matching collections.
- V1 archive input migrates to V2 with empty matching collections.

- [ ] **Step 1: Write failing archive tests**

```ts
expect(parseAndValidateBackupArchive(serializeBackupArchive(state))).toMatchObject({ archiveVersion: 2 });
expect(parseAndValidateBackupArchive(legacyV1Json).payload.business.logicalPageRules).toEqual([]);
expect(() => parseAndValidateBackupArchive(invalidProvenanceJson)).toThrow(InvalidBackupArchiveError);
```

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/unit/archive-contract.test.ts tests/unit/backup-restore.test.ts`

Expected: archive V2 fields and migration are absent.

- [ ] **Step 3: Implement strict V1-to-V2 archive migration and cleanup**

Extend archive allow-lists, canonicalization, limits, and conversion to use V5 validation. Ensure Reset, Clear Site Data, and Remove Site remove matching rules/signatures/provenance belonging to the affected Site.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- tests/unit/archive-contract.test.ts tests/unit/backup-restore.test.ts tests/unit/reset-transaction.test.ts tests/unit/remove-site-transaction.test.ts`

Expected: current round-trip, legacy archive compatibility, invalid full-restore rejection, and matching-data cleanup pass.

### Task 6: Authorized Messages and Content-Script Evidence

**Files:**
- Modify: `src/messages/runtime-messages.ts`
- Modify: `src/background/service-worker.ts`
- Modify: `src/recognition/dom-recognition.ts`
- Modify: `src/content/content-script.tsx`
- Test: `tests/unit/message-authorization.test.ts`
- Test: `tests/unit/content-script-spa-reconstruction.test.ts`

**Interfaces:**
- Adds typed `RESOLVE_LOGICAL_PAGE_CONTEXT`, `CONFIRM_LOGICAL_PAGE_CANDIDATE`, and `STOP_LOGICAL_PAGE_MATCHING` requests.
- Content script receives only opaque candidate/result data and resolves its current Target through the service worker.

- [ ] **Step 1: Write failing message and content tests**

```ts
expect(isRuntimeRequest({ type: "CONFIRM_LOGICAL_PAGE_CANDIDATE", candidateId: "candidate-1" })).toBe(true);
expect(isRuntimeRequest({ type: "CONFIRM_LOGICAL_PAGE_CANDIDATE", candidateId: 1 })).toBe(false);
```

Add a content fixture proving a candidate does not add a control, read a field value, or inherit a Binding until the user confirms it.

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/unit/message-authorization.test.ts tests/unit/content-script-spa-reconstruction.test.ts`

Expected: new requests and candidate state do not exist.

- [ ] **Step 3: Implement typed bridge with sender authorization**

Authorize confirmation from the content script's current Origin, require extension-page authorization for Site management separation, and broadcast only after a successful Repository mutation.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- tests/unit/message-authorization.test.ts tests/unit/content-script-spa-reconstruction.test.ts`

Expected: invalid request shapes fail closed and content receives only typed opaque state.

### Task 7: Picker Review and Site Rule Management

**Files:**
- Modify: `src/ui/picker/InlinePicker.tsx`
- Modify: `src/ui/picker/picker-styles.ts`
- Modify: `src/content/content-script.tsx`
- Modify: `src/ui/side-panel/SitesPage.tsx`
- Modify: `src/ui/side-panel/side-panel.css`
- Test: `tests/unit/inline-picker.test.tsx`
- Test: `tests/unit/sites-page.test.tsx`

**Interfaces:**
- Extends `InlinePicker` props with `logicalPageCandidate`, `onReviewLogicalPageCandidate`, and `onDismissLogicalPageCandidate`.
- Adds Site-management rule rows with `Stop matching` confirmation.

- [ ] **Step 1: Write failing UI tests**

```tsx
expect(screen.getByRole("button", { name: "Review possible matching page" })).toBeInTheDocument();
await user.click(screen.getByRole("button", { name: "Review possible matching page" }));
expect(screen.getByRole("dialog", { name: "Review logical page match" })).toBeInTheDocument();
```

Test dismissal suppresses the candidate for the current Picker session and Site management confirmation invokes only `STOP_LOGICAL_PAGE_MATCHING`.

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/unit/inline-picker.test.tsx tests/unit/sites-page.test.tsx`

Expected: Review action, dialog, and managed rule row are absent.

- [ ] **Step 3: Implement minimal accessible UI**

Render `Review` in the existing Picker status strip only for Repository-provided candidates. Use an extension-owned modal with an impact summary, Confirm and Not now actions, focus restoration, and no raw semantic text. Add a Site row with a confirmed `Stop matching` action.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- tests/unit/inline-picker.test.tsx tests/unit/sites-page.test.tsx`

Expected: keyboard-accessible review, no-write dismissal, confirmation, and managed separation affordance pass.

### Task 8: Synthetic E2E Corpus, Documentation, and Final Verification

**Files:**
- Create: `tests/fixtures/logical-page-identity.ts`
- Modify: `tests/helpers/synthetic-lifecycle-server.ts`
- Create: `tests/e2e/logical-page-identity.spec.ts`
- Modify: `DEVELOPMENT.md`

**Interfaces:**
- Synthetic routes serve numeric and UUID record URLs, route-match negatives, group mismatch, optional-field variation, and stable exact Field fixtures.

- [ ] **Step 1: Write the failing headed E2E specifications**

```ts
test("SPEC-014-POS-01: confirmation makes a later matching record show the bound Template", async ({ context }) => {
  // Bind on record 123, review/confirm on 456, then open 789 and assert the Template is visible.
});
```

Add separate specifications for cancellation, group mismatch, low similarity, relationship separation, Backup/Restore, and no duplicate controls across navigation.

- [ ] **Step 2: Verify RED**

Run: `npm run test:e2e -- tests/e2e/logical-page-identity.spec.ts`

Expected: the status-strip Review flow and matching-state persistence do not yet exist.

- [ ] **Step 3: Complete only the fixture hooks required by the accepted corpus**

Serve generic FillNest-owned forms; do not encode a customer sample or external-site selector.

- [ ] **Step 4: Verify GREEN and final gates**

Run: `npm run check && npm run test:e2e && git diff --check`

Expected: full typecheck, unit suite, build, headed extension suite, and whitespace check pass. Update `DEVELOPMENT.md` with the actual check output and any remaining hands-on QA gate.
