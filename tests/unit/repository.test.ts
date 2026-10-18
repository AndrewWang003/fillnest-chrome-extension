import { describe, expect, it } from "vitest";

import { computeResetSiteMappingsImpact } from "../../src/sites/site-projection";
import {
  effectiveTemplateListForField,
  FillNestRepository,
  InvalidStoredDataError,
  LogicalPageSeparationError,
  StaleImpactError,
  StaleLogicalPageCandidateError,
  StaleUndoError,
  type LocalStorageArea,
} from "../../src/storage/fillnest-repository";

class InMemoryLocalStorage implements LocalStorageArea {
  readonly values: Record<string, unknown> = {};
  setCount = 0;

  async get(key: string): Promise<Record<string, unknown>> {
    return key in this.values ? { [key]: this.values[key] } : {};
  }

  async set(items: Record<string, unknown>): Promise<void> {
    this.setCount += 1;
    Object.assign(this.values, structuredClone(items));
  }

  async remove(key: string): Promise<void> {
    delete this.values[key];
  }
}

describe("FillNestRepository", () => {
  it("creates one opaque Logical Page Site key per Site", async () => {
    const storage = new InMemoryLocalStorage();
    const ids = ["site-key-example", "site-key-other"];
    const repository = new FillNestRepository(storage, {
      createId: () => ids.shift() ?? "unexpected-id",
      now: () => "2026-09-01T00:00:00.000Z",
    });

    const first = await repository.getOrCreateLogicalPageSiteKey("https://forms.example.test/customers/123");
    const repeated = await repository.getOrCreateLogicalPageSiteKey("https://records.example.test/customers/456");
    const other = await repository.getOrCreateLogicalPageSiteKey("https://forms.other.test/customers/123");

    expect(first.siteId).toBe("example.test");
    expect(first.siteKeyId).toBe("site-key-example");
    expect(repeated).toEqual(first);
    expect(other.siteId).toBe("other.test");
    expect(other.encodedHmacKey).not.toBe(first.encodedHmacKey);
    expect(first.encodedHmacKey).toMatch(/^hmac-sha256-v1:[A-Za-z0-9_-]{43}$/u);
  });

  it("records opaque Observation evidence only for a directly bound Page", async () => {
    const storage = new InMemoryLocalStorage();
    const ids = ["template-1", "binding-1", "site-key-example", "observation-1"];
    const repository = new FillNestRepository(storage, {
      createId: () => ids.shift() ?? "unexpected-id",
      now: () => "2026-09-01T00:00:00.000Z",
    });
    await repository.createTemplateAndBind({
      content: "Reply",
      pageUrl: "https://forms.example.test/customers/123",
      pageProfileId: "page-1",
      fieldProfileId: "field-1",
      pageIdentityKey: "/customers/:record",
      fieldIdentityKey: '{"name":"email"}',
    });
    const key = await repository.getOrCreateLogicalPageSiteKey("https://forms.example.test/customers/123");

    await repository.recordLogicalPageObservation({
      pageUrl: "https://forms.example.test/customers/123",
      pageProfileId: "page-1",
      siteKeyId: key.siteKeyId,
      evidence: {
        origin: "https://forms.example.test",
        routePattern: "/customers/:number",
        fieldFeatures: new Set(["a".repeat(64)]),
        groupedFieldFeatures: new Set(["b".repeat(64)]),
        fieldIdentityKey: '{"name":"email"}',
      },
    });

    await expect(repository.read()).resolves.toMatchObject({
      logicalPageObservations: [{
        id: "observation-1",
        pageProfileId: "page-1",
        siteKeyId: "site-key-example",
        routePattern: "/customers/:number",
      }],
    });
  });

  it("rejects Observation evidence whose Route Pattern differs from its page URL", async () => {
    const storage = new InMemoryLocalStorage();
    const repository = new FillNestRepository(storage, {
      createId: () => "id",
      now: () => "2026-09-01T00:00:00.000Z",
    });
    await repository.replaceState({
      schemaVersion: 13,
      compatibilityPairDecisions: [],
      sites: [{ id: "example.test" }],
      templates: [{ id: "template-1", content: "Reply", siteAffinities: ["example.test"], createdAt: "x", updatedAt: "x", totalUsageCount: 0, revision: 0 }],
      pageProfiles: [{ id: "page-1", siteId: "example.test" }],
      fieldProfiles: [{ id: "field-1", pageProfileId: "page-1" }],
      bindings: [{ id: "binding-1", templateId: "template-1", pageProfileId: "page-1", fieldProfileId: "field-1", createdAt: "x", usageCount: 0, revision: 0}],
      logicalPageSiteKeys: [{ id: "site-key-1", siteId: "example.test", encodedHmacKey: "hmac-sha256-v1:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" }],
      logicalPageRules: [],
      logicalPageProvenance: [],
      logicalPageObservations: [],
      sharedTemplateSets: [],
      sharedTemplateBindings: [],
      sharedTemplateFieldStates: [],
      pickerPosition: null,
      pageStatusPosition: null,
    });

    await expect(repository.recordLogicalPageObservation({
      pageUrl: "https://forms.example.test/customers/123",
      pageProfileId: "page-1",
      siteKeyId: "site-key-1",
      evidence: {
        origin: "https://forms.example.test",
        routePattern: "/orders/:number",
        fieldFeatures: new Set(["a".repeat(64)]),
        groupedFieldFeatures: new Set(["b".repeat(64)]),
        fieldIdentityKey: null,
      },
    })).rejects.toThrow("matching Site evidence");
  });

  it("removes a Page Observation when Unbind removes its last direct Binding", async () => {
    const storage = new InMemoryLocalStorage();
    const repository = new FillNestRepository(storage);
    await repository.replaceState({
      schemaVersion: 13,
      compatibilityPairDecisions: [],
      sites: [{ id: "example.test" }],
      templates: [{ id: "template-1", content: "Reply", siteAffinities: ["example.test"], createdAt: "x", updatedAt: "x", totalUsageCount: 0, revision: 0 }],
      pageProfiles: [{ id: "page-1", siteId: "example.test" }],
      fieldProfiles: [{ id: "field-1", pageProfileId: "page-1" }],
      bindings: [{ id: "binding-1", templateId: "template-1", pageProfileId: "page-1", fieldProfileId: "field-1", createdAt: "x", usageCount: 0, revision: 0}],
      logicalPageSiteKeys: [{ id: "site-key-1", siteId: "example.test", encodedHmacKey: "hmac-sha256-v1:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" }],
      logicalPageRules: [],
      logicalPageProvenance: [],
      logicalPageObservations: [{ id: "observation-1", siteId: "example.test", siteKeyId: "site-key-1", origin: "https://forms.example.test", routePattern: "/customers/:number", fieldFeatureHashes: ["a".repeat(64)], groupedFieldFeatureHashes: ["b".repeat(64)], pageProfileId: "page-1" }],
      sharedTemplateSets: [],
      sharedTemplateBindings: [],
      sharedTemplateFieldStates: [],
      pickerPosition: null,
      pageStatusPosition: null,
    });

    await expect(repository.unbindTemplate({ templateId: "template-1", fieldProfileId: "field-1" })).resolves.toBe(true);
    await expect(repository.read()).resolves.toMatchObject({ bindings: [], logicalPageObservations: [] });
  });

  const baseLogicalPageState = {
    schemaVersion: 13 as const,
    compatibilityPairDecisions: [],
    sites: [{ id: "example.test" }],
    templates: [{ id: "template-1", content: "Reply", siteAffinities: ["example.test"], createdAt: "x", updatedAt: "x", totalUsageCount: 0, revision: 0 }],
    pageProfiles: [{ id: "page-1", siteId: "example.test", identityKey: "/customers/123" }],
    fieldProfiles: [{ id: "field-1", pageProfileId: "page-1", identityKey: "field-x" }],
    bindings: [{ id: "binding-1", templateId: "template-1", pageProfileId: "page-1", fieldProfileId: "field-1", createdAt: "x", usageCount: 0, revision: 0 }],
    logicalPageSiteKeys: [{ id: "site-key-1", siteId: "example.test", encodedHmacKey: "hmac-sha256-v1:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" }],
    logicalPageRules: [] as never[],
    logicalPageProvenance: [] as never[],
    logicalPageObservations: [] as never[],
    sharedTemplateSets: [] as never[],
    sharedTemplateBindings: [] as never[],
    sharedTemplateFieldStates: [] as never[],
    pickerPosition: null,
    pageStatusPosition: null,
  };

  const logicalPageEvidence = {
    origin: "https://forms.example.test",
    routePattern: "/customers/:number",
    fieldFeatures: new Set(["a".repeat(64)]),
    groupedFieldFeatures: new Set(["b".repeat(64)]),
    fieldIdentityKey: "field-x",
  };

  it("resolves a Logical Page candidate as recognized when a confirmed Rule meets both similarity thresholds", async () => {
    const storage = new InMemoryLocalStorage();
    const repository = new FillNestRepository(storage);
    await repository.replaceState({
      ...baseLogicalPageState,
      logicalPageRules: [{
        id: "rule-1",
        siteId: "example.test",
        siteKeyId: "site-key-1",
        origin: "https://forms.example.test",
        routePattern: "/customers/:number",
        fieldFeatureHashes: ["a".repeat(64)],
        groupedFieldFeatureHashes: ["b".repeat(64)],
        pageProfileId: "page-1",
      }],
    });

    await expect(
      repository.resolveLogicalPageCandidate({ evidence: logicalPageEvidence }),
    ).resolves.toEqual({
      siteId: "example.test",
      pageProfileId: "page-1",
      fieldProfileId: "field-1",
      recognized: true,
      candidate: null,
    });
  });

  it("rejects an ambiguous Logical Page Rule match rather than auto-applying either candidate", async () => {
    const storage = new InMemoryLocalStorage();
    const ids = ["fallback-page", "fallback-field"];
    const repository = new FillNestRepository(storage, {
      createId: () => ids.shift() ?? "unexpected-id",
      now: () => "2026-09-01T00:00:00.000Z",
    });
    await repository.replaceState({
      ...baseLogicalPageState,
      pageProfiles: [
        ...baseLogicalPageState.pageProfiles,
        { id: "page-2", siteId: "example.test", identityKey: "/customers/456" },
      ],
      logicalPageRules: [
        {
          id: "rule-1",
          siteId: "example.test",
          siteKeyId: "site-key-1",
          origin: "https://forms.example.test",
          routePattern: "/customers/:number",
          fieldFeatureHashes: ["a".repeat(64)],
          groupedFieldFeatureHashes: ["b".repeat(64)],
          pageProfileId: "page-1",
        },
        {
          id: "rule-2",
          siteId: "example.test",
          siteKeyId: "site-key-1",
          origin: "https://forms.example.test",
          routePattern: "/customers/:number",
          fieldFeatureHashes: ["a".repeat(64)],
          groupedFieldFeatureHashes: ["b".repeat(64)],
          pageProfileId: "page-2",
        },
      ],
    });

    await expect(
      repository.resolveLogicalPageCandidate({ evidence: logicalPageEvidence }),
    ).resolves.toEqual({
      siteId: "example.test",
      pageProfileId: "fallback-page",
      fieldProfileId: "fallback-field",
      recognized: false,
      candidate: null,
    });
  });

  it("surfaces a reviewable candidate from a qualifying Observation with an exactly matching bound Field", async () => {
    const storage = new InMemoryLocalStorage();
    const ids = ["new-page", "new-field", "candidate-1", "rule-1"];
    const repository = new FillNestRepository(storage, {
      createId: () => ids.shift() ?? "unexpected-id",
      now: () => "2026-09-01T00:00:00.000Z",
    });
    await repository.replaceState({
      ...baseLogicalPageState,
      logicalPageObservations: [{
        id: "observation-1",
        siteId: "example.test",
        siteKeyId: "site-key-1",
        origin: "https://forms.example.test",
        routePattern: "/customers/:number",
        fieldFeatureHashes: ["a".repeat(64)],
        groupedFieldFeatureHashes: ["b".repeat(64)],
        pageProfileId: "page-1",
      }],
    });

    await expect(
      repository.resolveLogicalPageCandidate({ evidence: logicalPageEvidence }),
    ).resolves.toEqual({
      siteId: "example.test",
      pageProfileId: "new-page",
      fieldProfileId: "new-field",
      recognized: false,
      candidate: {
        id: "candidate-1",
        ruleId: "rule-1",
        canonicalPageProfileId: "page-1",
        reviewRequired: true,
      },
    });
  });

  it("does not surface a candidate when the matching Observation's Page has no exactly matching bound Field", async () => {
    const storage = new InMemoryLocalStorage();
    const repository = new FillNestRepository(storage);
    await repository.replaceState({
      ...baseLogicalPageState,
      fieldProfiles: [{ id: "field-1", pageProfileId: "page-1", identityKey: "different-field" }],
      logicalPageObservations: [{
        id: "observation-1",
        siteId: "example.test",
        siteKeyId: "site-key-1",
        origin: "https://forms.example.test",
        routePattern: "/customers/:number",
        fieldFeatureHashes: ["a".repeat(64)],
        groupedFieldFeatureHashes: ["b".repeat(64)],
        pageProfileId: "page-1",
      }],
    });

    await expect(
      repository.resolveLogicalPageCandidate({ evidence: logicalPageEvidence }),
    ).resolves.toMatchObject({ recognized: false, candidate: null });
  });

  it("rejects a candidate below the Field semantic similarity threshold", async () => {
    const storage = new InMemoryLocalStorage();
    const repository = new FillNestRepository(storage);
    await repository.replaceState({
      ...baseLogicalPageState,
      logicalPageObservations: [{
        id: "observation-1",
        siteId: "example.test",
        siteKeyId: "site-key-1",
        origin: "https://forms.example.test",
        routePattern: "/customers/:number",
        fieldFeatureHashes: ["a".repeat(64)],
        groupedFieldFeatureHashes: ["b".repeat(64)],
        pageProfileId: "page-1",
      }],
    });

    await expect(
      repository.resolveLogicalPageCandidate({
        evidence: {
          ...logicalPageEvidence,
          fieldFeatures: new Set(["a".repeat(64), "c".repeat(64), "d".repeat(64), "e".repeat(64)]),
        },
      }),
    ).resolves.toMatchObject({ recognized: false, candidate: null });
  });

  it("rejects a candidate whose group-qualified Field similarity falls below threshold even when Field similarity is exact", async () => {
    const storage = new InMemoryLocalStorage();
    const repository = new FillNestRepository(storage);
    await repository.replaceState({
      ...baseLogicalPageState,
      logicalPageObservations: [{
        id: "observation-1",
        siteId: "example.test",
        siteKeyId: "site-key-1",
        origin: "https://forms.example.test",
        routePattern: "/customers/:number",
        fieldFeatureHashes: ["a".repeat(64)],
        groupedFieldFeatureHashes: ["b".repeat(64)],
        pageProfileId: "page-1",
      }],
    });

    await expect(
      repository.resolveLogicalPageCandidate({
        evidence: {
          ...logicalPageEvidence,
          groupedFieldFeatures: new Set(["b".repeat(64), "f".repeat(64), "1".repeat(64), "2".repeat(64)]),
        },
      }),
    ).resolves.toMatchObject({ recognized: false, candidate: null });
  });

  it("rejects a candidate whose Route Pattern differs, even with identical semantic evidence", async () => {
    const storage = new InMemoryLocalStorage();
    const repository = new FillNestRepository(storage);
    await repository.replaceState({
      ...baseLogicalPageState,
      logicalPageObservations: [{
        id: "observation-1",
        siteId: "example.test",
        siteKeyId: "site-key-1",
        origin: "https://forms.example.test",
        // A different Route Pattern from logicalPageEvidence's "/customers/:number" -
        // route equality is required regardless of how similar the semantic
        // evidence is (Task 014 Accepted Contract: "Route equality without
        // both thresholds is insufficient", and a route match is likewise
        // never sufficient on its own).
        routePattern: "/orders/:number",
        fieldFeatureHashes: ["a".repeat(64)],
        groupedFieldFeatureHashes: ["b".repeat(64)],
        pageProfileId: "page-1",
      }],
    });

    await expect(
      repository.resolveLogicalPageCandidate({ evidence: logicalPageEvidence }),
    ).resolves.toMatchObject({ recognized: false, candidate: null });
  });

  it("rejects an ambiguous Observation match across two already-bound Pages", async () => {
    const storage = new InMemoryLocalStorage();
    const repository = new FillNestRepository(storage);
    await repository.replaceState({
      ...baseLogicalPageState,
      pageProfiles: [
        ...baseLogicalPageState.pageProfiles,
        { id: "page-2", siteId: "example.test", identityKey: "/customers/456" },
      ],
      fieldProfiles: [
        ...baseLogicalPageState.fieldProfiles,
        { id: "field-2", pageProfileId: "page-2", identityKey: "field-x" },
      ],
      bindings: [
        ...baseLogicalPageState.bindings,
        { id: "binding-2", templateId: "template-1", pageProfileId: "page-2", fieldProfileId: "field-2", createdAt: "x", usageCount: 0, revision: 0 },
      ],
      logicalPageObservations: [
        {
          id: "observation-1",
          siteId: "example.test",
          siteKeyId: "site-key-1",
          origin: "https://forms.example.test",
          routePattern: "/customers/:number",
          fieldFeatureHashes: ["a".repeat(64)],
          groupedFieldFeatureHashes: ["b".repeat(64)],
          pageProfileId: "page-1",
        },
        {
          id: "observation-2",
          siteId: "example.test",
          siteKeyId: "site-key-1",
          origin: "https://forms.example.test",
          routePattern: "/customers/:number",
          fieldFeatureHashes: ["a".repeat(64)],
          groupedFieldFeatureHashes: ["b".repeat(64)],
          pageProfileId: "page-2",
        },
      ],
    });

    await expect(
      repository.resolveLogicalPageCandidate({ evidence: logicalPageEvidence }),
    ).resolves.toMatchObject({ recognized: false, candidate: null });
  });

  it("confirms a Logical Page candidate by creating a Rule when the reviewed Page has no prior existing PageProfile", async () => {
    const storage = new InMemoryLocalStorage();
    const repository = new FillNestRepository(storage);
    await repository.replaceState({
      ...baseLogicalPageState,
      logicalPageObservations: [{
        id: "observation-1",
        siteId: "example.test",
        siteKeyId: "site-key-1",
        origin: "https://forms.example.test",
        routePattern: "/customers/:number",
        fieldFeatureHashes: ["a".repeat(64)],
        groupedFieldFeatureHashes: ["b".repeat(64)],
        pageProfileId: "page-1",
      }],
    });

    await expect(
      repository.confirmLogicalPageCandidate({
        ruleId: "rule-1",
        canonicalPageProfileId: "page-1",
        pageIdentityKey: null,
        evidence: logicalPageEvidence,
      }),
    ).resolves.toEqual({
      siteId: "example.test",
      pageProfileId: "page-1",
      fieldProfileId: "field-1",
      recognized: true,
    });

    const state = await repository.read();
    expect(state.logicalPageRules).toEqual([{
      id: "rule-1",
      siteId: "example.test",
      siteKeyId: "site-key-1",
      origin: "https://forms.example.test",
      routePattern: "/customers/:number",
      fieldFeatureHashes: ["a".repeat(64)],
      groupedFieldFeatureHashes: ["b".repeat(64)],
      pageProfileId: "page-1",
    }]);
    expect(state.logicalPageProvenance).toEqual([]);
    expect(state.bindings).toEqual(baseLogicalPageState.bindings);
  });

  it("atomically merges exactly matching Fields' Bindings as a Template-ID union when confirming a candidate for an already-existing Page", async () => {
    const storage = new InMemoryLocalStorage();
    const ids = ["provenance-1"];
    const repository = new FillNestRepository(storage, {
      createId: () => ids.shift() ?? "unexpected-id",
      now: () => "2026-09-01T00:00:00.000Z",
    });
    await repository.replaceState({
      ...baseLogicalPageState,
      templates: [
        ...baseLogicalPageState.templates,
        { id: "template-2", content: "Bye", siteAffinities: ["example.test"], createdAt: "x", updatedAt: "x", totalUsageCount: 9, revision: 0 },
      ],
      bindings: [
        { id: "binding-1", templateId: "template-1", pageProfileId: "page-1", fieldProfileId: "field-1", createdAt: "x", usageCount: 2, revision: 0},
      ],
      pageProfiles: [
        ...baseLogicalPageState.pageProfiles,
        { id: "page-2", siteId: "example.test", identityKey: "/customers/456" },
      ],
      fieldProfiles: [
        ...baseLogicalPageState.fieldProfiles,
        { id: "field-2", pageProfileId: "page-2", identityKey: "field-x" },
      ],
      logicalPageObservations: [{
        id: "observation-1",
        siteId: "example.test",
        siteKeyId: "site-key-1",
        origin: "https://forms.example.test",
        routePattern: "/customers/:number",
        fieldFeatureHashes: ["a".repeat(64)],
        groupedFieldFeatureHashes: ["b".repeat(64)],
        pageProfileId: "page-1",
      }],
    });
    // The reviewed Page's exact-Field bindings: one duplicate Template ID
    // (must merge into one Binding with usage counts added) and one distinct
    // Template ID (must be retained as its own Binding).
    await repository.replaceState({
      ...(await repository.read()),
      bindings: [
        { id: "binding-1", templateId: "template-1", pageProfileId: "page-1", fieldProfileId: "field-1", createdAt: "x", usageCount: 2, revision: 0},
        { id: "source-binding-1", templateId: "template-1", pageProfileId: "page-2", fieldProfileId: "field-2", createdAt: "x", usageCount: 3, revision: 0},
        { id: "source-binding-2", templateId: "template-2", pageProfileId: "page-2", fieldProfileId: "field-2", createdAt: "x", usageCount: 5, revision: 0},
      ],
    });

    const resolution = await repository.confirmLogicalPageCandidate({
      ruleId: "rule-1",
      canonicalPageProfileId: "page-1",
      pageIdentityKey: "/customers/456",
      evidence: logicalPageEvidence,
    });
    expect(resolution).toEqual({
      siteId: "example.test",
      pageProfileId: "page-1",
      fieldProfileId: "field-1",
      recognized: true,
    });

    const state = await repository.read();
    const canonicalBindings = state.bindings
      .filter((binding) => binding.fieldProfileId === "field-1")
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    expect(canonicalBindings).toEqual([
      { id: "binding-1", templateId: "template-1", pageProfileId: "page-1", fieldProfileId: "field-1", createdAt: "x", usageCount: 5, revision: 0 },
      { id: "source-binding-2", templateId: "template-2", pageProfileId: "page-1", fieldProfileId: "field-1", createdAt: "x", usageCount: 5, revision: 0 },
    ]);
    // The reviewed Field's own Bindings were absorbed into the canonical
    // Field, not duplicated - and no Template's global usage count moved.
    expect(state.bindings.some((binding) => binding.fieldProfileId === "field-2")).toBe(false);
    expect(state.templates.find((t) => t.id === "template-2")?.totalUsageCount).toBe(9);

    expect(state.logicalPageProvenance).toEqual([{
      id: "provenance-1",
      ruleId: "rule-1",
      origin: "https://forms.example.test",
      sourcePageProfileId: "page-2",
      canonicalPageProfileId: "page-1",
      fieldMappings: [{
        sourceFieldProfileId: "field-2",
        canonicalFieldProfileId: "field-1",
        bindingIds: ["binding-1", "source-binding-2"],
      }],
    }]);
  });

  it("never merges a Shared Template Set member's direct Bindings when confirming a Logical Page candidate (Task 021 cross-feature regression)", async () => {
    // A Shared Template Set member's direct Bindings must stay exactly as
    // they are while it is a member - merging one away here would silently
    // corrupt what "stop sharing" is supposed to restore, since the set
    // membership itself is left completely untouched by this operation.
    const storage = new InMemoryLocalStorage();
    const ids = ["provenance-1"];
    const repository = new FillNestRepository(storage, {
      createId: () => ids.shift() ?? "unexpected-id",
      now: () => "2026-09-01T00:00:00.000Z",
    });
    await repository.replaceState({
      ...baseLogicalPageState,
      bindings: [
        { id: "binding-1", templateId: "template-1", pageProfileId: "page-1", fieldProfileId: "field-1", createdAt: "x", usageCount: 5, revision: 0},
      ],
      pageProfiles: [
        ...baseLogicalPageState.pageProfiles,
        { id: "page-2", siteId: "example.test", identityKey: "/customers/456" },
      ],
      fieldProfiles: [
        ...baseLogicalPageState.fieldProfiles,
        { id: "field-2", pageProfileId: "page-2", identityKey: "field-x" },
        { id: "field-partner", pageProfileId: "page-2", identityKey: "field-y" },
      ],
      logicalPageObservations: [{
        id: "observation-1",
        siteId: "example.test",
        siteKeyId: "site-key-1",
        origin: "https://forms.example.test",
        routePattern: "/customers/:number",
        fieldFeatureHashes: ["a".repeat(64)],
        groupedFieldFeatureHashes: ["b".repeat(64)],
        pageProfileId: "page-1",
      }],
      sharedTemplateSets: [
        { id: "set-1", siteId: "example.test", name: "Shared", memberFieldProfileIds: ["field-2", "field-partner"] },
      ],
    });
    await repository.replaceState({
      ...(await repository.read()),
      bindings: [
        { id: "binding-1", templateId: "template-1", pageProfileId: "page-1", fieldProfileId: "field-1", createdAt: "x", usageCount: 5, revision: 0},
        { id: "source-binding-1", templateId: "template-1", pageProfileId: "page-2", fieldProfileId: "field-2", createdAt: "x", usageCount: 3, revision: 0},
      ],
    });

    const resolution = await repository.confirmLogicalPageCandidate({
      ruleId: "rule-1",
      canonicalPageProfileId: "page-1",
      pageIdentityKey: "/customers/456",
      evidence: logicalPageEvidence,
    });
    // The Rule itself is still confirmed - only this one Field pair's merge
    // is skipped.
    expect(resolution).toEqual({
      siteId: "example.test",
      pageProfileId: "page-1",
      fieldProfileId: "field-1",
      recognized: true,
    });

    const state = await repository.read();
    expect(state.bindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "binding-1", fieldProfileId: "field-1", usageCount: 5 }),
        expect.objectContaining({ id: "source-binding-1", fieldProfileId: "field-2", usageCount: 3 }),
      ]),
    );
    expect(state.bindings).toHaveLength(2);
    expect(state.sharedTemplateSets).toEqual([
      { id: "set-1", siteId: "example.test", name: "Shared", memberFieldProfileIds: ["field-2", "field-partner"] },
    ]);
    // No provenance entry was recorded for the skipped Field pair.
    expect(state.logicalPageProvenance).toEqual([]);
  });

  it("leaves a non-matching Field on the reviewed Page independent when confirming a Logical Page candidate", async () => {
    const storage = new InMemoryLocalStorage();
    const repository = new FillNestRepository(storage);
    await repository.replaceState({
      ...baseLogicalPageState,
      pageProfiles: [
        ...baseLogicalPageState.pageProfiles,
        { id: "page-2", siteId: "example.test", identityKey: "/customers/456" },
      ],
      fieldProfiles: [
        ...baseLogicalPageState.fieldProfiles,
        { id: "field-2", pageProfileId: "page-2", identityKey: "field-x" },
        { id: "field-3", pageProfileId: "page-2", identityKey: "unrelated-field" },
      ],
      bindings: [
        ...baseLogicalPageState.bindings,
        { id: "binding-2", templateId: "template-1", pageProfileId: "page-2", fieldProfileId: "field-2", createdAt: "x", usageCount: 0, revision: 0 },
        { id: "binding-3", templateId: "template-1", pageProfileId: "page-2", fieldProfileId: "field-3", createdAt: "x", usageCount: 0, revision: 0 },
      ],
      logicalPageObservations: [{
        id: "observation-1",
        siteId: "example.test",
        siteKeyId: "site-key-1",
        origin: "https://forms.example.test",
        routePattern: "/customers/:number",
        fieldFeatureHashes: ["a".repeat(64)],
        groupedFieldFeatureHashes: ["b".repeat(64)],
        pageProfileId: "page-1",
      }],
    });

    await repository.confirmLogicalPageCandidate({
      ruleId: "rule-1",
      canonicalPageProfileId: "page-1",
      pageIdentityKey: "/customers/456",
      evidence: logicalPageEvidence,
    });

    const state = await repository.read();
    expect(state.bindings.find((binding) => binding.id === "binding-3")).toEqual({
      id: "binding-3", templateId: "template-1", pageProfileId: "page-2", fieldProfileId: "field-3", createdAt: "x", usageCount: 0, revision: 0,
    });
    expect(state.fieldProfiles.some((field) => field.id === "field-3")).toBe(true);
  });

  it("rejects confirmation and changes nothing when a Rule already covers the Route Pattern", async () => {
    const storage = new InMemoryLocalStorage();
    const repository = new FillNestRepository(storage);
    const priorState = {
      ...baseLogicalPageState,
      logicalPageRules: [{
        id: "existing-rule",
        siteId: "example.test",
        siteKeyId: "site-key-1",
        origin: "https://forms.example.test",
        routePattern: "/customers/:number",
        fieldFeatureHashes: ["a".repeat(64)],
        groupedFieldFeatureHashes: ["b".repeat(64)],
        pageProfileId: "page-1",
      }],
      logicalPageObservations: [{
        id: "observation-1",
        siteId: "example.test",
        siteKeyId: "site-key-1",
        origin: "https://forms.example.test",
        routePattern: "/customers/:number",
        fieldFeatureHashes: ["a".repeat(64)],
        groupedFieldFeatureHashes: ["b".repeat(64)],
        pageProfileId: "page-1",
      }],
    };
    await repository.replaceState(priorState);

    await expect(
      repository.confirmLogicalPageCandidate({
        ruleId: "rule-2",
        canonicalPageProfileId: "page-1",
        pageIdentityKey: null,
        evidence: logicalPageEvidence,
      }),
    ).rejects.toThrow("already covers this Route Pattern");

    await expect(repository.read()).resolves.toEqual(priorState);
  });

  it("rejects confirmation and changes nothing when the candidate Observation no longer meets both thresholds", async () => {
    const storage = new InMemoryLocalStorage();
    const repository = new FillNestRepository(storage);
    const priorState = {
      ...baseLogicalPageState,
      logicalPageObservations: [{
        id: "observation-1",
        siteId: "example.test",
        siteKeyId: "site-key-1",
        origin: "https://forms.example.test",
        routePattern: "/customers/:number",
        fieldFeatureHashes: ["9".repeat(64)],
        groupedFieldFeatureHashes: ["b".repeat(64)],
        pageProfileId: "page-1",
      }],
    };
    await repository.replaceState(priorState);

    await expect(
      repository.confirmLogicalPageCandidate({
        ruleId: "rule-1",
        canonicalPageProfileId: "page-1",
        pageIdentityKey: null,
        evidence: logicalPageEvidence,
      }),
    ).rejects.toThrow(StaleLogicalPageCandidateError);

    await expect(repository.read()).resolves.toEqual(priorState);
  });

  it("leaves the persisted state intact when confirming a candidate is interrupted mid-write", async () => {
    class InterruptibleLocalStorage extends InMemoryLocalStorage {
      failNextSet = false;

      override async set(items: Record<string, unknown>): Promise<void> {
        if (this.failNextSet) {
          this.failNextSet = false;
          throw new Error("simulated persistence interruption");
        }
        return super.set(items);
      }
    }

    const storage = new InterruptibleLocalStorage();
    const repository = new FillNestRepository(storage);
    const priorState = {
      ...baseLogicalPageState,
      logicalPageObservations: [{
        id: "observation-1",
        siteId: "example.test",
        siteKeyId: "site-key-1",
        origin: "https://forms.example.test",
        routePattern: "/customers/:number",
        fieldFeatureHashes: ["a".repeat(64)],
        groupedFieldFeatureHashes: ["b".repeat(64)],
        pageProfileId: "page-1",
      }],
    };
    await repository.replaceState(priorState);

    storage.failNextSet = true;
    await expect(
      repository.confirmLogicalPageCandidate({
        ruleId: "rule-1",
        canonicalPageProfileId: "page-1",
        pageIdentityKey: null,
        evidence: logicalPageEvidence,
      }),
    ).rejects.toThrow("simulated persistence interruption");

    await expect(repository.read()).resolves.toEqual(priorState);
  });

  it("Stop matching removes the Rule and separates its merged relationship into an independent, usage-copied Binding", async () => {
    const storage = new InMemoryLocalStorage();
    const ids = ["separated-binding-1", "separated-binding-2"];
    const repository = new FillNestRepository(storage, {
      createId: () => ids.shift() ?? "unexpected-id",
      now: () => "2026-09-01T01:00:00.000Z",
    });
    await repository.replaceState({
      ...baseLogicalPageState,
      templates: [
        ...baseLogicalPageState.templates,
        { id: "template-2", content: "Bye", siteAffinities: ["example.test"], createdAt: "x", updatedAt: "x", totalUsageCount: 9, revision: 0 },
      ],
      pageProfiles: [
        ...baseLogicalPageState.pageProfiles,
        { id: "page-2", siteId: "example.test", identityKey: "/customers/456" },
      ],
      fieldProfiles: [
        ...baseLogicalPageState.fieldProfiles,
        { id: "field-2", pageProfileId: "page-2", identityKey: "field-x" },
      ],
      bindings: [
        { id: "binding-1", templateId: "template-1", pageProfileId: "page-1", fieldProfileId: "field-1", createdAt: "x", usageCount: 5, revision: 0},
        { id: "source-binding-2", templateId: "template-2", pageProfileId: "page-1", fieldProfileId: "field-1", createdAt: "x", usageCount: 5, revision: 0},
      ],
      logicalPageRules: [{
        id: "rule-1",
        siteId: "example.test",
        siteKeyId: "site-key-1",
        origin: "https://forms.example.test",
        routePattern: "/customers/:number",
        fieldFeatureHashes: ["a".repeat(64)],
        groupedFieldFeatureHashes: ["b".repeat(64)],
        pageProfileId: "page-1",
      }],
      logicalPageProvenance: [{
        id: "provenance-1",
        ruleId: "rule-1",
        origin: "https://forms.example.test",
        sourcePageProfileId: "page-2",
        canonicalPageProfileId: "page-1",
        fieldMappings: [{
          sourceFieldProfileId: "field-2",
          canonicalFieldProfileId: "field-1",
          bindingIds: ["binding-1", "source-binding-2"],
        }],
      }],
    });

    await expect(repository.stopLogicalPageMatching({ ruleId: "rule-1" })).resolves.toEqual({
      separatedFieldProfileIds: ["field-2"],
    });

    const state = await repository.read();
    expect(state.logicalPageRules).toEqual([]);
    expect(state.logicalPageProvenance).toEqual([]);
    // The canonical Field's own Bindings are untouched.
    expect(state.bindings.filter((binding) => binding.fieldProfileId === "field-1")).toEqual([
      { id: "binding-1", templateId: "template-1", pageProfileId: "page-1", fieldProfileId: "field-1", createdAt: "x", usageCount: 5, revision: 0 },
      { id: "source-binding-2", templateId: "template-2", pageProfileId: "page-1", fieldProfileId: "field-1", createdAt: "x", usageCount: 5, revision: 0 },
    ]);
    // The separated Field gets its own fresh, independent copy with the
    // Binding usage count copied in full - Templates are never duplicated.
    const separated = state.bindings
      .filter((binding) => binding.fieldProfileId === "field-2")
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    expect(separated).toEqual([
      { id: "separated-binding-1", templateId: "template-1", pageProfileId: "page-2", fieldProfileId: "field-2", createdAt: "2026-09-01T01:00:00.000Z", usageCount: 5, revision: 0 },
      { id: "separated-binding-2", templateId: "template-2", pageProfileId: "page-2", fieldProfileId: "field-2", createdAt: "2026-09-01T01:00:00.000Z", usageCount: 5, revision: 0 },
    ]);
    expect(state.templates.find((t) => t.id === "template-2")?.totalUsageCount).toBe(9);
  });

  it("Stop matching on a rule with no recorded provenance removes only the Rule", async () => {
    const storage = new InMemoryLocalStorage();
    const repository = new FillNestRepository(storage);
    await repository.replaceState({
      ...baseLogicalPageState,
      logicalPageRules: [{
        id: "rule-1",
        siteId: "example.test",
        siteKeyId: "site-key-1",
        origin: "https://forms.example.test",
        routePattern: "/customers/:number",
        fieldFeatureHashes: ["a".repeat(64)],
        groupedFieldFeatureHashes: ["b".repeat(64)],
        pageProfileId: "page-1",
      }],
    });

    await expect(repository.stopLogicalPageMatching({ ruleId: "rule-1" })).resolves.toEqual({
      separatedFieldProfileIds: [],
    });

    const state = await repository.read();
    expect(state.logicalPageRules).toEqual([]);
    expect(state.bindings).toEqual(baseLogicalPageState.bindings);
  });

  it("Stop matching fails closed and changes nothing when the rule does not exist", async () => {
    const storage = new InMemoryLocalStorage();
    const repository = new FillNestRepository(storage);
    await repository.replaceState(baseLogicalPageState);

    await expect(repository.stopLogicalPageMatching({ ruleId: "missing-rule" })).rejects.toThrow(
      LogicalPageSeparationError,
    );
    await expect(repository.read()).resolves.toEqual(baseLogicalPageState);
  });

  it("Stop matching fails closed on malformed provenance without writing over the corrupted record", async () => {
    // The repository's candidate-state invariants already reject dangling
    // provenance on every legitimate commit, so a source Page, source Field,
    // or merged Binding can only go missing through storage corruption
    // (e.g. a hand-edited or externally damaged record) bypassing the
    // repository entirely, as simulated here by writing raw storage.
    const storage = new InMemoryLocalStorage();
    const repository = new FillNestRepository(storage);
    await repository.replaceState({
      ...baseLogicalPageState,
      logicalPageRules: [{
        id: "rule-1",
        siteId: "example.test",
        siteKeyId: "site-key-1",
        origin: "https://forms.example.test",
        routePattern: "/customers/:number",
        fieldFeatureHashes: ["a".repeat(64)],
        groupedFieldFeatureHashes: ["b".repeat(64)],
        pageProfileId: "page-1",
      }],
    });

    const corrupted = {
      ...structuredClone(storage.values.fillnestState as Record<string, unknown>),
      logicalPageProvenance: [{
        id: "provenance-1",
        ruleId: "rule-1",
        origin: "https://forms.example.test",
        sourcePageProfileId: "page-missing",
        canonicalPageProfileId: "page-1",
        fieldMappings: [{
          sourceFieldProfileId: "field-1",
          canonicalFieldProfileId: "field-1",
          bindingIds: ["binding-1"],
        }],
      }],
    };
    storage.values.fillnestState = corrupted;

    await expect(repository.stopLogicalPageMatching({ ruleId: "rule-1" })).rejects.toThrow(
      InvalidStoredDataError,
    );
    expect(storage.values.fillnestState).toEqual(corrupted);
  });

  it("Stop matching leaves the persisted Rule intact when the storage write is interrupted", async () => {
    class InterruptibleLocalStorage extends InMemoryLocalStorage {
      failNextSet = false;

      override async set(items: Record<string, unknown>): Promise<void> {
        if (this.failNextSet) {
          this.failNextSet = false;
          throw new Error("simulated persistence interruption");
        }
        return super.set(items);
      }
    }

    const storage = new InterruptibleLocalStorage();
    const repository = new FillNestRepository(storage);
    const priorState = {
      ...baseLogicalPageState,
      logicalPageRules: [{
        id: "rule-1",
        siteId: "example.test",
        siteKeyId: "site-key-1",
        origin: "https://forms.example.test",
        routePattern: "/customers/:number",
        fieldFeatureHashes: ["a".repeat(64)],
        groupedFieldFeatureHashes: ["b".repeat(64)],
        pageProfileId: "page-1",
      }],
    };
    await repository.replaceState(priorState);

    storage.failNextSet = true;
    await expect(repository.stopLogicalPageMatching({ ruleId: "rule-1" })).rejects.toThrow(
      "simulated persistence interruption",
    );
    await expect(repository.read()).resolves.toEqual(priorState);
  });

  it("migrates schema-v5 records additively to V6 Page Observations", async () => {
    const storage = new InMemoryLocalStorage();
    storage.values.fillnestState = {
      schemaVersion: 5,
      sites: [{ id: "example.test" }],
      templates: [],
      pageProfiles: [{ id: "page-existing", siteId: "example.test" }],
      fieldProfiles: [{ id: "field-existing", pageProfileId: "page-existing" }],
      bindings: [],
      logicalPageSiteKeys: [],
      logicalPageRules: [],
      logicalPageProvenance: [],
      pickerPosition: null,
      pageStatusPosition: null,
    };
    const repository = new FillNestRepository(storage);

    await expect(repository.read()).resolves.toMatchObject({
      schemaVersion: 13,
      compatibilityPairDecisions: [],
      pageProfiles: [{ id: "page-existing", siteId: "example.test" }],
      fieldProfiles: [{ id: "field-existing", pageProfileId: "page-existing" }],
      logicalPageObservations: [],
      sharedTemplateSets: [],
      sharedTemplateBindings: [],
      sharedTemplateFieldStates: [],
    });
    expect(storage.setCount).toBe(1);
  });

  it("migrates schema-v6 records additively to V7 Shared Template Sets", async () => {
    const storage = new InMemoryLocalStorage();
    storage.values.fillnestState = {
      schemaVersion: 6,
      sites: [{ id: "example.test" }],
      templates: [],
      pageProfiles: [{ id: "page-existing", siteId: "example.test" }],
      fieldProfiles: [{ id: "field-existing", pageProfileId: "page-existing" }],
      bindings: [],
      logicalPageSiteKeys: [],
      logicalPageRules: [],
      logicalPageProvenance: [],
      logicalPageObservations: [],
      pickerPosition: null,
      pageStatusPosition: null,
    };
    const repository = new FillNestRepository(storage);

    await expect(repository.read()).resolves.toMatchObject({
      schemaVersion: 13,
      compatibilityPairDecisions: [],
      pageProfiles: [{ id: "page-existing", siteId: "example.test" }],
      fieldProfiles: [{ id: "field-existing", pageProfileId: "page-existing" }],
      sharedTemplateSets: [],
      sharedTemplateBindings: [],
      sharedTemplateFieldStates: [],
    });
    expect(storage.setCount).toBe(1);
  });

  it("migrates schema-v7 records additively to V8 Compatibility pair decisions, preserving existing V7 data", async () => {
    const storage = new InMemoryLocalStorage();
    storage.values.fillnestState = {
      schemaVersion: 7,
      sites: [{ id: "example.test" }],
      templates: [],
      pageProfiles: [
        { id: "page-1", siteId: "example.test" },
        { id: "page-2", siteId: "example.test" },
      ],
      fieldProfiles: [
        { id: "field-1", pageProfileId: "page-1" },
        { id: "field-2", pageProfileId: "page-2" },
      ],
      bindings: [],
      logicalPageSiteKeys: [],
      logicalPageRules: [],
      logicalPageProvenance: [],
      logicalPageObservations: [],
      sharedTemplateSets: [{ id: "set-1", siteId: "example.test", name: "Existing set", memberFieldProfileIds: ["field-1", "field-2"] }],
      sharedTemplateBindings: [],
      pickerPosition: null,
      pageStatusPosition: null,
    };
    const repository = new FillNestRepository(storage);

    await expect(repository.read()).resolves.toMatchObject({
      schemaVersion: 13,
      compatibilityPairDecisions: [],
      sharedTemplateSets: [{ id: "set-1", siteId: "example.test", name: "Existing set", memberFieldProfileIds: ["field-1", "field-2"] }],
      sharedTemplateFieldStates: [],
    });
    expect(storage.setCount).toBe(1);
  });

  it("migrates schema-v8 records additively to V9 Shared Template Field States, preserving existing V8 data", async () => {
    const storage = new InMemoryLocalStorage();
    storage.values.fillnestState = {
      schemaVersion: 8,
      sites: [{ id: "example.test" }],
      templates: [],
      pageProfiles: [{ id: "page-1", siteId: "example.test" }],
      fieldProfiles: [{ id: "field-1", pageProfileId: "page-1" }],
      bindings: [],
      logicalPageSiteKeys: [],
      logicalPageRules: [],
      logicalPageProvenance: [],
      logicalPageObservations: [],
      sharedTemplateSets: [],
      sharedTemplateBindings: [],
      compatibilityPairDecisions: [],
      pickerPosition: null,
      pageStatusPosition: null,
    };
    const repository = new FillNestRepository(storage);

    await expect(repository.read()).resolves.toMatchObject({
      schemaVersion: 13,
      sharedTemplateFieldStates: [],
      fieldProfiles: [{ id: "field-1", pageProfileId: "page-1" }],
    });
    expect(storage.setCount).toBe(1);
  });

  it("migrates schema-v9 records additively to V10, preserving existing V9 Shared Template Bindings without an ownerFieldProfileId", async () => {
    const storage = new InMemoryLocalStorage();
    storage.values.fillnestState = {
      schemaVersion: 9,
      sites: [{ id: "example.test" }],
      templates: [
        { id: "template-1", content: "Shared", siteAffinities: ["example.test"], createdAt: "x", updatedAt: "x", totalUsageCount: 0, revision: 0 },
      ],
      pageProfiles: [
        { id: "page-1", siteId: "example.test" },
        { id: "page-2", siteId: "example.test" },
      ],
      fieldProfiles: [
        { id: "field-1", pageProfileId: "page-1" },
        { id: "field-2", pageProfileId: "page-2" },
      ],
      bindings: [],
      logicalPageSiteKeys: [],
      logicalPageRules: [],
      logicalPageProvenance: [],
      logicalPageObservations: [],
      sharedTemplateSets: [
        { id: "set-1", siteId: "example.test", name: "Existing set", memberFieldProfileIds: ["field-1", "field-2"] },
      ],
      sharedTemplateBindings: [
        { id: "slot-1", setId: "set-1", templateId: "template-1", usageCount: 0, revision: 0, order: 0 },
      ],
      sharedTemplateFieldStates: [],
      compatibilityPairDecisions: [],
      pickerPosition: null,
      pageStatusPosition: null,
    };
    const repository = new FillNestRepository(storage);

    await expect(repository.read()).resolves.toMatchObject({
      schemaVersion: 13,
      sharedTemplateBindings: [
        { id: "slot-1", setId: "set-1", templateId: "template-1", usageCount: 0, revision: 0, order: 0 },
      ],
    });
    expect(storage.setCount).toBe(1);
  });

  describe("Shared Template Set invariants (Task 015 Accepted Contract)", () => {
    const sharedBaseState = {
      ...baseLogicalPageState,
      pageProfiles: [
        ...baseLogicalPageState.pageProfiles,
        { id: "page-2", siteId: "example.test", identityKey: "/orders/1" },
        { id: "page-other-site", siteId: "other.test", identityKey: "/profile" },
      ],
      fieldProfiles: [
        ...baseLogicalPageState.fieldProfiles,
        { id: "field-2", pageProfileId: "page-2", identityKey: "field-y" },
        { id: "field-other-site", pageProfileId: "page-other-site", identityKey: "field-z" },
      ],
      sites: [...baseLogicalPageState.sites, { id: "other.test" }],
      templates: [
        ...baseLogicalPageState.templates,
        { id: "template-2", content: "Second", siteAffinities: ["example.test"], createdAt: "x", updatedAt: "x", totalUsageCount: 0, revision: 0 },
      ],
    };

    it("accepts a valid Shared Template Set spanning two Site-local Fields with distinct Template Bindings", async () => {
      const storage = new InMemoryLocalStorage();
      const repository = new FillNestRepository(storage);
      const state = {
        ...sharedBaseState,
        sharedTemplateSets: [{ id: "set-1", siteId: "example.test", name: "Contact fields", memberFieldProfileIds: ["field-1", "field-2"] }],
        sharedTemplateBindings: [
          { id: "shared-binding-1", setId: "set-1", templateId: "template-1", usageCount: 0, revision: 0, order: 0 },
          { id: "shared-binding-2", setId: "set-1", templateId: "template-2", usageCount: 0, revision: 0, order: 1 },
        ],
      };
      await expect(repository.replaceState(state)).resolves.toEqual(state);
    });

    // Task 024 Confirmed Contract: "Task 024 is the only authorized
    // controlled extension from Site-local membership to cross-Site
    // membership through explicit Link confirmation" - the storage layer
    // now accepts a cross-Site Shared Template Set as valid data (the
    // Command layer, exercised in the "Cross-Site linking" describe block
    // below, is what actually gates *creating* one on an explicit
    // `allowCrossSite` flag; every other command omits it and keeps the
    // Site-local-only behavior this test used to check for).
    it("accepts a Shared Template Set whose member Field belongs to a different Site", async () => {
      const storage = new InMemoryLocalStorage();
      const repository = new FillNestRepository(storage);
      const state = {
        ...sharedBaseState,
        sharedTemplateSets: [{ id: "set-1", siteId: "example.test", name: "Cross-site", memberFieldProfileIds: ["field-1", "field-other-site"] }],
        sharedTemplateBindings: [],
        sharedTemplateFieldStates: [],
      };
      await expect(repository.replaceState(state)).resolves.toEqual(state);
    });

    it("rejects a Field Profile that belongs to two Shared Template Sets at once", async () => {
      const storage = new InMemoryLocalStorage();
      const repository = new FillNestRepository(storage);
      await expect(
        repository.replaceState({
          ...sharedBaseState,
          sharedTemplateSets: [
            { id: "set-1", siteId: "example.test", name: "First", memberFieldProfileIds: ["field-1", "field-2"] },
            { id: "set-2", siteId: "example.test", name: "Second", memberFieldProfileIds: ["field-1"] },
          ],
          sharedTemplateBindings: [],
          sharedTemplateFieldStates: [],
        }),
      ).rejects.toThrow(InvalidStoredDataError);
    });

    it("rejects a Shared Template Set with no members", async () => {
      const storage = new InMemoryLocalStorage();
      const repository = new FillNestRepository(storage);
      await expect(
        repository.replaceState({
          ...sharedBaseState,
          sharedTemplateSets: [{ id: "set-1", siteId: "example.test", name: "Empty", memberFieldProfileIds: [] }],
          sharedTemplateBindings: [],
          sharedTemplateFieldStates: [],
        }),
      ).rejects.toThrow(InvalidStoredDataError);
    });

    it("rejects a Shared Template Set referencing a Field that does not exist", async () => {
      const storage = new InMemoryLocalStorage();
      const repository = new FillNestRepository(storage);
      await expect(
        repository.replaceState({
          ...sharedBaseState,
          sharedTemplateSets: [{ id: "set-1", siteId: "example.test", name: "Dangling", memberFieldProfileIds: ["field-1", "field-missing"] }],
          sharedTemplateBindings: [],
          sharedTemplateFieldStates: [],
        }),
      ).rejects.toThrow(InvalidStoredDataError);
    });

    it("rejects a Shared Template Binding with a duplicate Template ID within the same set", async () => {
      const storage = new InMemoryLocalStorage();
      const repository = new FillNestRepository(storage);
      await expect(
        repository.replaceState({
          ...sharedBaseState,
          sharedTemplateSets: [{ id: "set-1", siteId: "example.test", name: "Contact fields", memberFieldProfileIds: ["field-1", "field-2"] }],
          sharedTemplateBindings: [
            { id: "shared-binding-1", setId: "set-1", templateId: "template-1", usageCount: 0, revision: 0, order: 0 },
            { id: "shared-binding-2", setId: "set-1", templateId: "template-1", usageCount: 0, revision: 0, order: 1 },
          ],
        }),
      ).rejects.toThrow(InvalidStoredDataError);
    });

    it("rejects a Shared Template Binding order collision within the same set", async () => {
      const storage = new InMemoryLocalStorage();
      const repository = new FillNestRepository(storage);
      await expect(
        repository.replaceState({
          ...sharedBaseState,
          sharedTemplateSets: [{ id: "set-1", siteId: "example.test", name: "Contact fields", memberFieldProfileIds: ["field-1", "field-2"] }],
          sharedTemplateBindings: [
            { id: "shared-binding-1", setId: "set-1", templateId: "template-1", usageCount: 0, revision: 0, order: 0 },
            { id: "shared-binding-2", setId: "set-1", templateId: "template-2", usageCount: 0, revision: 0, order: 0 },
          ],
        }),
      ).rejects.toThrow(InvalidStoredDataError);
    });

    it("rejects a Shared Template Binding referencing a Set that does not exist", async () => {
      const storage = new InMemoryLocalStorage();
      const repository = new FillNestRepository(storage);
      await expect(
        repository.replaceState({
          ...sharedBaseState,
          sharedTemplateSets: [],
          sharedTemplateBindings: [
            { id: "shared-binding-1", setId: "set-missing", templateId: "template-1", usageCount: 0, revision: 0, order: 0 },
          ],
        }),
      ).rejects.toThrow(InvalidStoredDataError);
    });

    it("rejects a Shared Template Binding referencing a Template that does not exist", async () => {
      const storage = new InMemoryLocalStorage();
      const repository = new FillNestRepository(storage);
      await expect(
        repository.replaceState({
          ...sharedBaseState,
          sharedTemplateSets: [{ id: "set-1", siteId: "example.test", name: "Contact fields", memberFieldProfileIds: ["field-1", "field-2"] }],
          sharedTemplateBindings: [
            { id: "shared-binding-1", setId: "set-1", templateId: "template-missing", usageCount: 0, revision: 0, order: 0 },
          ],
        }),
      ).rejects.toThrow(InvalidStoredDataError);
    });
  });

  describe("Compatibility pair decision invariants (Task 024 Slice 2)", () => {
    it("accepts a valid 'No' pair decision between two real Fields", async () => {
      const storage = new InMemoryLocalStorage();
      const repository = new FillNestRepository(storage);
      const state = {
        ...baseLogicalPageState,
        fieldProfiles: [
          ...baseLogicalPageState.fieldProfiles,
          { id: "field-2", pageProfileId: "page-1" },
        ],
        compatibilityPairDecisions: [
          { id: "decision-1", fieldProfileIdA: "field-1", fieldProfileIdB: "field-2", createdAt: "2026-09-02T00:00:00.000Z" },
        ],
      };
      await expect(repository.replaceState(state)).resolves.toEqual(state);
    });

    it("rejects a pair decision referencing a Field Profile that does not exist", async () => {
      const storage = new InMemoryLocalStorage();
      const repository = new FillNestRepository(storage);
      await expect(
        repository.replaceState({
          ...baseLogicalPageState,
          compatibilityPairDecisions: [
            { id: "decision-1", fieldProfileIdA: "field-1", fieldProfileIdB: "field-missing", createdAt: "2026-09-02T00:00:00.000Z" },
          ],
        }),
      ).rejects.toThrow(InvalidStoredDataError);
    });

    it("rejects a pair decision naming the same Field on both sides", async () => {
      const storage = new InMemoryLocalStorage();
      const repository = new FillNestRepository(storage);
      await expect(
        repository.replaceState({
          ...baseLogicalPageState,
          compatibilityPairDecisions: [
            { id: "decision-1", fieldProfileIdA: "field-1", fieldProfileIdB: "field-1", createdAt: "2026-09-02T00:00:00.000Z" },
          ],
        }),
      ).rejects.toThrow(InvalidStoredDataError);
    });

    it("rejects the same unordered Field pair recorded twice, regardless of which side is A or B", async () => {
      const storage = new InMemoryLocalStorage();
      const repository = new FillNestRepository(storage);
      await expect(
        repository.replaceState({
          ...baseLogicalPageState,
          fieldProfiles: [
            ...baseLogicalPageState.fieldProfiles,
            { id: "field-2", pageProfileId: "page-1" },
          ],
          compatibilityPairDecisions: [
            { id: "decision-1", fieldProfileIdA: "field-1", fieldProfileIdB: "field-2", createdAt: "2026-09-02T00:00:00.000Z" },
            { id: "decision-2", fieldProfileIdA: "field-2", fieldProfileIdB: "field-1", createdAt: "2026-09-02T00:00:00.000Z" },
          ],
        }),
      ).rejects.toThrow(InvalidStoredDataError);
    });
  });

  describe("findSimilarFieldCandidates / recordCompatibilityPairNo (Task 024 Slice 2)", () => {
    function identityKey(type: string, autocomplete: string): string {
      return JSON.stringify({ tag: "input", type, name: "", id: "", autocomplete, semanticKind: "", form: "", ancestors: [], ordinal: 0 });
    }

    const compatibilityBaseState = {
      ...baseLogicalPageState,
      sites: [{ id: "example.test" }, { id: "other.test" }],
      pageProfiles: [
        { id: "page-1", siteId: "example.test", identityKey: "/profile" },
        { id: "page-2", siteId: "other.test", identityKey: "/billing" },
      ],
      fieldProfiles: [
        { id: "field-source", pageProfileId: "page-1", identityKey: identityKey("email", "email"), observedTitle: "Source email" },
        { id: "field-same-site-match", pageProfileId: "page-1", identityKey: identityKey("email", "email"), observedTitle: "Same-site match" },
        { id: "field-cross-site-match", pageProfileId: "page-2", identityKey: identityKey("email", "email"), observedTitle: "Cross-site match" },
        { id: "field-not-discoverable", pageProfileId: "page-1", identityKey: identityKey("email", "email"), observedTitle: "No templates yet" },
        { id: "field-already-linked", pageProfileId: "page-1", identityKey: identityKey("email", "email"), observedTitle: "Already linked" },
      ],
      templates: [
        { id: "template-1", content: "Reply", siteAffinities: ["example.test"], createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", totalUsageCount: 0, revision: 0 },
      ],
      bindings: [
        { id: "binding-same-site", templateId: "template-1", pageProfileId: "page-1", fieldProfileId: "field-same-site-match", createdAt: "x", usageCount: 0, revision: 0 },
        { id: "binding-cross-site", templateId: "template-1", pageProfileId: "page-2", fieldProfileId: "field-cross-site-match", createdAt: "x", usageCount: 0, revision: 0 },
      ],
      sharedTemplateSets: [
        { id: "set-1", siteId: "example.test", name: "Existing set", memberFieldProfileIds: ["field-source", "field-already-linked"] },
      ],
      sharedTemplateBindings: [
        { id: "shared-binding-1", setId: "set-1", templateId: "template-1", usageCount: 0, revision: 0, order: 0 },
      ],
    };

    it("offers only discoverable Fields (a non-empty effective Template list), never the Current Field itself", async () => {
      const storage = new InMemoryLocalStorage();
      const repository = new FillNestRepository(storage);
      await repository.replaceState(compatibilityBaseState);

      const result = await repository.findSimilarFieldCandidates({ fieldProfileId: "field-source" });
      const ids = result.candidates.map((candidate) => candidate.fieldProfileId).sort();
      expect(ids).toEqual(["field-already-linked", "field-cross-site-match", "field-same-site-match"]);
    });

    it("marks a same-Site kind match high confidence and a cross-Site reliable-kind match also high confidence", async () => {
      const storage = new InMemoryLocalStorage();
      const repository = new FillNestRepository(storage);
      await repository.replaceState(compatibilityBaseState);

      const result = await repository.findSimilarFieldCandidates({ fieldProfileId: "field-source" });
      const sameSite = result.candidates.find((candidate) => candidate.fieldProfileId === "field-same-site-match");
      const crossSite = result.candidates.find((candidate) => candidate.fieldProfileId === "field-cross-site-match");
      expect(sameSite).toMatchObject({ crossSite: false, highConfidence: true, templateCount: 1, templatePreviews: ["Reply"] });
      expect(crossSite).toMatchObject({ crossSite: true, highConfidence: true, siteLabel: "other.test" });
    });

    it("marks a Field already sharing the Current Field's Shared Template Set as alreadyLinked", async () => {
      const storage = new InMemoryLocalStorage();
      const repository = new FillNestRepository(storage);
      await repository.replaceState(compatibilityBaseState);

      const result = await repository.findSimilarFieldCandidates({ fieldProfileId: "field-source" });
      const linked = result.candidates.find((candidate) => candidate.fieldProfileId === "field-already-linked");
      expect(linked).toMatchObject({ alreadyLinked: true });
    });

    it("offers no automatic suggestion when more than one candidate is equally high confidence", async () => {
      const storage = new InMemoryLocalStorage();
      const repository = new FillNestRepository(storage);
      await repository.replaceState(compatibilityBaseState);

      const result = await repository.findSimilarFieldCandidates({ fieldProfileId: "field-source" });
      // Three high-confidence email matches (already-linked, same-site,
      // cross-site) tie, so no single automatic Suggested Field appears.
      expect(result.suggestedFieldProfileId).toBeNull();
    });

    it("offers the sole automatic suggestion once only one high-confidence candidate remains", async () => {
      const storage = new InMemoryLocalStorage();
      const repository = new FillNestRepository(storage);
      await repository.replaceState({
        ...compatibilityBaseState,
        fieldProfiles: compatibilityBaseState.fieldProfiles.filter(
          (field) => field.id !== "field-cross-site-match" && field.id !== "field-already-linked",
        ),
        bindings: compatibilityBaseState.bindings.filter((binding) => binding.fieldProfileId !== "field-cross-site-match"),
        sharedTemplateSets: [],
        sharedTemplateBindings: [],
        sharedTemplateFieldStates: [],
      });

      const result = await repository.findSimilarFieldCandidates({ fieldProfileId: "field-source" });
      expect(result.suggestedFieldProfileId).toBe("field-same-site-match");
    });

    it("throws for an unknown Current Field with no newField evidence", async () => {
      const storage = new InMemoryLocalStorage();
      const repository = new FillNestRepository(storage);
      await repository.replaceState(compatibilityBaseState);
      await expect(repository.findSimilarFieldCandidates({ fieldProfileId: "missing" })).rejects.toThrow();
    });

    it("evaluates an empty Current Field (never bound, no durable Field Profile) using newField evidence, without persisting it", async () => {
      const storage = new InMemoryLocalStorage();
      const repository = new FillNestRepository(storage);
      await repository.replaceState(compatibilityBaseState);

      const result = await repository.findSimilarFieldCandidates({
        fieldProfileId: "field-never-bound",
        newField: {
          pageUrl: "https://example.test/profile",
          pageProfileId: "page-1",
          fieldProfileId: "field-never-bound",
          fieldIdentityKey: identityKey("email", "email"),
        },
      });

      const ids = result.candidates.map((candidate) => candidate.fieldProfileId).sort();
      expect(ids).toEqual(["field-already-linked", "field-cross-site-match", "field-same-site-match", "field-source"]);
      expect(result.currentFieldLabel).toBeTruthy();

      const state = await repository.read();
      expect(state.fieldProfiles.some((field) => field.id === "field-never-bound")).toBe(false);
    });

    it("records a 'No' pair decision and excludes that pair from future automatic suggestions", async () => {
      const storage = new InMemoryLocalStorage();
      const repository = new FillNestRepository(storage);
      await repository.replaceState({
        ...compatibilityBaseState,
        fieldProfiles: compatibilityBaseState.fieldProfiles.filter(
          (field) => field.id !== "field-cross-site-match" && field.id !== "field-already-linked",
        ),
        bindings: compatibilityBaseState.bindings.filter((binding) => binding.fieldProfileId !== "field-cross-site-match"),
        sharedTemplateSets: [],
        sharedTemplateBindings: [],
        sharedTemplateFieldStates: [],
      });

      await repository.recordCompatibilityPairNo({ fieldProfileIdA: "field-source", fieldProfileIdB: "field-same-site-match" });
      const result = await repository.findSimilarFieldCandidates({ fieldProfileId: "field-source" });
      expect(result.suggestedFieldProfileId).toBeNull();
      const candidate = result.candidates.find((c) => c.fieldProfileId === "field-same-site-match");
      expect(candidate).toMatchObject({ decided: true, highConfidence: true });
    });

    it("is idempotent: recording the same 'No' pair twice does not create a duplicate decision", async () => {
      const storage = new InMemoryLocalStorage();
      const repository = new FillNestRepository(storage);
      await repository.replaceState(compatibilityBaseState);

      const first = await repository.recordCompatibilityPairNo({ fieldProfileIdA: "field-source", fieldProfileIdB: "field-same-site-match" });
      const second = await repository.recordCompatibilityPairNo({ fieldProfileIdA: "field-same-site-match", fieldProfileIdB: "field-source" });
      expect(second).toEqual(first);
      const state = await repository.read();
      expect(state.compatibilityPairDecisions).toHaveLength(1);
    });

    it("rejects recording a pair decision for a Field paired with itself", async () => {
      const storage = new InMemoryLocalStorage();
      const repository = new FillNestRepository(storage);
      await repository.replaceState(compatibilityBaseState);
      await expect(
        repository.recordCompatibilityPairNo({ fieldProfileIdA: "field-source", fieldProfileIdB: "field-source" }),
      ).rejects.toThrow();
    });

    it("rejects recording a pair decision referencing an unknown Field", async () => {
      const storage = new InMemoryLocalStorage();
      const repository = new FillNestRepository(storage);
      await repository.replaceState(compatibilityBaseState);
      await expect(
        repository.recordCompatibilityPairNo({ fieldProfileIdA: "field-source", fieldProfileIdB: "missing" }),
      ).rejects.toThrow();
    });
  });

  describe("Shared Template Set commands (Task 021 Slice 2)", () => {
    const sharedBaseState = {
      ...baseLogicalPageState,
      pageProfiles: [
        ...baseLogicalPageState.pageProfiles,
        { id: "page-2", siteId: "example.test", identityKey: "/orders/1" },
        { id: "page-other-site", siteId: "other.test", identityKey: "/profile" },
      ],
      fieldProfiles: [
        ...baseLogicalPageState.fieldProfiles,
        { id: "field-2", pageProfileId: "page-2", identityKey: "field-y" },
        { id: "field-other-site", pageProfileId: "page-other-site", identityKey: "field-z" },
      ],
      sites: [...baseLogicalPageState.sites, { id: "other.test" }],
      templates: [
        ...baseLogicalPageState.templates,
        { id: "template-2", content: "Second", siteAffinities: ["example.test"], createdAt: "x", updatedAt: "x", totalUsageCount: 0, revision: 0 },
      ],
      bindings: [
        { id: "binding-1", templateId: "template-1", pageProfileId: "page-1", fieldProfileId: "field-1", createdAt: "x", usageCount: 3, revision: 0 },
        { id: "binding-2", templateId: "template-1", pageProfileId: "page-2", fieldProfileId: "field-2", createdAt: "x", usageCount: 2, revision: 0 },
        { id: "binding-3", templateId: "template-2", pageProfileId: "page-2", fieldProfileId: "field-2", createdAt: "x", usageCount: 0, revision: 0 },
      ],
    };

    it("creates a Shared Template Set that unions members' direct Templates by ID, summing usage, and leaves direct Bindings intact but dormant", async () => {
      const storage = new InMemoryLocalStorage();
      const repository = new FillNestRepository(storage, {
        createId: () => "set-1",
        now: () => "2026-09-01T00:00:00.000Z",
      });
      await repository.replaceState(sharedBaseState);

      const ids = ["set-1", "shared-binding-1", "shared-binding-2"];
      const repositoryWithIds = new FillNestRepository(storage, {
        createId: () => ids.shift() ?? "unexpected-id",
        now: () => "2026-09-01T00:00:00.000Z",
      });
      const result = await repositoryWithIds.createSharedTemplateSet({
        fieldProfileIds: ["field-1", "field-2"],
      });

      expect(result.set).toEqual({
        id: "set-1",
        siteId: "example.test",
        name: "Shared Template Set 1",
        memberFieldProfileIds: ["field-1", "field-2"],
      });
      expect(result.sharedBindings).toEqual([
        { id: "shared-binding-1", setId: "set-1", templateId: "template-1", usageCount: 5, revision: 0, order: 0 },
        { id: "shared-binding-2", setId: "set-1", templateId: "template-2", usageCount: 0, revision: 0, order: 1 },
      ]);
      // Direct Bindings are untouched - dormancy is derived from membership, not stored.
      await expect(repository.read()).resolves.toMatchObject({ bindings: sharedBaseState.bindings });
    });

    it("rejects creating a Shared Template Set with fewer than two Fields", async () => {
      const storage = new InMemoryLocalStorage();
      const repository = new FillNestRepository(storage);
      await repository.replaceState(sharedBaseState);
      await expect(
        repository.createSharedTemplateSet({ fieldProfileIds: ["field-1"] }),
      ).rejects.toThrow("at least two Fields");
    });

    it("rejects creating a Shared Template Set spanning two Sites", async () => {
      const storage = new InMemoryLocalStorage();
      const repository = new FillNestRepository(storage);
      await repository.replaceState(sharedBaseState);
      await expect(
        repository.createSharedTemplateSet({ fieldProfileIds: ["field-1", "field-other-site"] }),
      ).rejects.toThrow("cannot contain Fields from different Sites");
    });

    it("rejects creating a Shared Template Set when a Field already belongs to one", async () => {
      const storage = new InMemoryLocalStorage();
      const repository = new FillNestRepository(storage);
      await repository.replaceState({
        ...sharedBaseState,
        sharedTemplateSets: [{ id: "set-1", siteId: "example.test", name: "Existing", memberFieldProfileIds: ["field-1", "field-2"] }],
      });
      await expect(
        repository.createSharedTemplateSet({ fieldProfileIds: ["field-1", "field-2"] }),
      ).rejects.toThrow("already belongs to a Shared Template Set");
    });

    it("creates a durable Field Profile on demand for an empty current Field with no prior Binding", async () => {
      // Regression: a Field that has never been bound to anything has no
      // durable Field Profile (only Bind/Create-and-Bind ever persist one),
      // so createSharedTemplateSet must be able to create it in the same
      // commit - otherwise "Two empty Fields may create a Shared Template
      // Set" (Task 015 Accepted Contract) fails with "Field Profile not
      // found" the moment a never-bound Field tries to share from itself.
      const storage = new InMemoryLocalStorage();
      let nextId = 0;
      const repository = new FillNestRepository(storage, {
        createId: () => `generated-${nextId++}`,
        now: () => "2026-09-02T00:00:00.000Z",
      });
      await repository.replaceState(sharedBaseState);

      const result = await repository.createSharedTemplateSet({
        fieldProfileIds: ["field-empty-anchor", "field-2"],
        newFields: [
          {
            pageUrl: "https://forms.example.test/new-record",
            pageProfileId: "field-empty-anchor-page",
            fieldProfileId: "field-empty-anchor",
            pageIdentityKey: "/new-record",
            fieldIdentityKey: "field-empty",
          },
        ],
      });

      expect(result.set.memberFieldProfileIds).toEqual(["field-empty-anchor", "field-2"]);
      await expect(repository.read()).resolves.toMatchObject({
        pageProfiles: expect.arrayContaining([
          expect.objectContaining({ id: "field-empty-anchor-page", siteId: "example.test" }),
        ]),
        fieldProfiles: expect.arrayContaining([
          expect.objectContaining({ id: "field-empty-anchor", pageProfileId: "field-empty-anchor-page" }),
        ]),
        sharedTemplateSets: [expect.objectContaining({ memberFieldProfileIds: ["field-empty-anchor", "field-2"] })],
      });
    });

    it("undoes a Shared Template Set creation, and fails closed once it no longer exists", async () => {
      const storage = new InMemoryLocalStorage();
      const ids = ["set-1", "shared-binding-1", "shared-binding-2"];
      const repository = new FillNestRepository(storage, {
        createId: () => ids.shift() ?? "unexpected-id",
        now: () => "2026-09-01T00:00:00.000Z",
      });
      await repository.replaceState(sharedBaseState);
      await repository.createSharedTemplateSet({ fieldProfileIds: ["field-1", "field-2"] });

      await repository.undoCreateSharedTemplateSet({ setId: "set-1" });
      await expect(repository.read()).resolves.toMatchObject({ sharedTemplateSets: [], sharedTemplateBindings: [] });
      await expect(repository.undoCreateSharedTemplateSet({ setId: "set-1" })).rejects.toThrow(StaleUndoError);
    });

    it("adds a Field to an existing Shared Template Set, and undoes the add", async () => {
      const storage = new InMemoryLocalStorage();
      const repository = new FillNestRepository(storage);
      await repository.replaceState({
        ...sharedBaseState,
        sharedTemplateSets: [{ id: "set-1", siteId: "example.test", name: "Contact fields", memberFieldProfileIds: ["field-1"] }],
      });

      const added = await repository.addSharedTemplateSetMember({ setId: "set-1", fieldProfileId: "field-2" });
      expect(added.memberFieldProfileIds).toEqual(["field-1", "field-2"]);

      await repository.undoAddSharedTemplateSetMember({ setId: "set-1", fieldProfileId: "field-2", ...added.undo });
      await expect(repository.read()).resolves.toMatchObject({
        sharedTemplateSets: [{ id: "set-1", memberFieldProfileIds: ["field-1"] }],
      });
      await expect(
        repository.undoAddSharedTemplateSetMember({ setId: "set-1", fieldProfileId: "field-2", ...added.undo }),
      ).rejects.toThrow(StaleUndoError);
    });

    it("creates a durable Field Profile on demand when adding an empty Field to an existing Shared Template Set", async () => {
      // Regression: a Field discovered live on a page after a Shared
      // Template Set already exists (e.g. one of several fields added by a
      // page's own "add another" button) is just as likely to have never
      // been bound to anything as the Field that created the set - Add
      // Fields must be able to grow the set with it too, not only create.
      const storage = new InMemoryLocalStorage();
      let nextId = 0;
      const repository = new FillNestRepository(storage, {
        createId: () => `generated-${nextId++}`,
        now: () => "2026-09-02T00:00:00.000Z",
      });
      await repository.replaceState({
        ...sharedBaseState,
        sharedTemplateSets: [{ id: "set-1", siteId: "example.test", name: "Contact fields", memberFieldProfileIds: ["field-1"] }],
      });

      const updated = await repository.addSharedTemplateSetMember({
        setId: "set-1",
        fieldProfileId: "field-empty-3",
        newField: {
          pageUrl: "https://forms.example.test/customers/123",
          pageProfileId: "page-1",
          fieldProfileId: "field-empty-3",
          fieldIdentityKey: "field-empty-3-key",
        },
      });
      expect(updated.memberFieldProfileIds).toEqual(["field-1", "field-empty-3"]);
      await expect(repository.read()).resolves.toMatchObject({
        fieldProfiles: expect.arrayContaining([
          expect.objectContaining({ id: "field-empty-3", pageProfileId: "page-1" }),
        ]),
      });
    });

    it("rejects adding a Field from a different Site, or one already shared elsewhere", async () => {
      const storage = new InMemoryLocalStorage();
      const repository = new FillNestRepository(storage);
      await repository.replaceState({
        ...sharedBaseState,
        sharedTemplateSets: [
          { id: "set-1", siteId: "example.test", name: "First", memberFieldProfileIds: ["field-1"] },
          { id: "set-2", siteId: "example.test", name: "Second", memberFieldProfileIds: ["field-2"] },
        ],
      });

      await expect(
        repository.addSharedTemplateSetMember({ setId: "set-1", fieldProfileId: "field-other-site" }),
      ).rejects.toThrow("not found in this Site");
      await expect(
        repository.addSharedTemplateSetMember({ setId: "set-1", fieldProfileId: "field-2" }),
      ).rejects.toThrow("already belongs to a Shared Template Set");
    });

    it("automatically ends a two-member set, snapshots both Fields, and undoes the removal", async () => {
      const storage = new InMemoryLocalStorage();
      let snapshotId = 3;
      const repository = new FillNestRepository(storage, {
        createId: () => `snapshot-binding-${snapshotId++}`,
        now: () => "2026-09-02T00:00:00.000Z",
      });
      await repository.replaceState({
        ...sharedBaseState,
        templates: [...sharedBaseState.templates, { id: "template-3", content: "Shared only", siteAffinities: ["example.test"], createdAt: "x", updatedAt: "x", totalUsageCount: 0, revision: 0 }],
        sharedTemplateSets: [{ id: "set-1", siteId: "example.test", name: "Contact fields", memberFieldProfileIds: ["field-1", "field-2"] }],
        sharedTemplateBindings: [
          { id: "shared-binding-1", setId: "set-1", templateId: "template-1", usageCount: 0, revision: 0, order: 0 },
          { id: "shared-binding-3", setId: "set-1", templateId: "template-3", usageCount: 0, revision: 0, order: 1 },
        ],
      });

      const result = await repository.removeSharedTemplateSetMember({ setId: "set-1", fieldProfileId: "field-2" });
      expect(result).toEqual(expect.objectContaining({
        ended: true,
        set: null,
        newlyGlobalTemplates: [],
        snapshotBindings: expect.arrayContaining([
          expect.objectContaining({ fieldProfileId: "field-1", templateId: "template-1" }),
          expect.objectContaining({ fieldProfileId: "field-1", templateId: "template-3" }),
          expect.objectContaining({ fieldProfileId: "field-2", templateId: "template-1" }),
          expect.objectContaining({ fieldProfileId: "field-2", templateId: "template-3" }),
        ]),
        dormantBindings: expect.arrayContaining([
          expect.objectContaining({ id: "binding-1" }),
          expect.objectContaining({ id: "binding-2" }),
          expect.objectContaining({ id: "binding-3" }),
        ]),
        removedFieldStates: [],
      }));

      const stateAfterStopSharing = await repository.read();
      expect(stateAfterStopSharing.bindings).toEqual(expect.arrayContaining([
        expect.objectContaining({ fieldProfileId: "field-2", templateId: "template-1" }),
        expect.objectContaining({ fieldProfileId: "field-2", templateId: "template-3" }),
      ]));
      // Dormant direct Bindings are deliberately replaced, not mixed into
      // the post-stop-sharing effective list.
      expect(stateAfterStopSharing.bindings).toEqual(expect.not.arrayContaining([
        expect.objectContaining({ id: "binding-2" }),
        expect.objectContaining({ id: "binding-3" }),
      ]));

      await repository.undoRemoveSharedTemplateSetMember({
        fieldProfileId: "field-2",
        set: { id: "set-1", siteId: "example.test", name: "Contact fields", memberFieldProfileIds: ["field-1", "field-2"] },
        endedSharedBindings: [],
        snapshotBindings: result.snapshotBindings,
        dormantBindings: result.dormantBindings,
        removedOwnedSlots: [],
        removedFieldStates: [],
      });
      await expect(repository.read()).resolves.toMatchObject({
        sharedTemplateSets: [{ id: "set-1", memberFieldProfileIds: ["field-1", "field-2"] }],
        bindings: expect.not.arrayContaining([expect.objectContaining({ id: "snapshot-binding-3" })]),
      });
    });

    it("stops sharing with only the departing Field's effective Templates, not its dormant pre-share Bindings", async () => {
      const storage = new InMemoryLocalStorage();
      const ids = ["snapshot-binding-1"];
      const repository = new FillNestRepository(storage, {
        createId: () => ids.shift() ?? "unexpected-id",
        now: () => "2026-09-05T00:00:00.000Z",
      });
      await repository.replaceState({
        ...sharedBaseState,
        fieldProfiles: [...sharedBaseState.fieldProfiles, { id: "field-3", pageProfileId: "page-1", identityKey: "field-z" }],
        sharedTemplateSets: [{
          id: "set-1",
          siteId: "example.test",
          name: "Contact fields",
          memberFieldProfileIds: ["field-1", "field-2", "field-3"],
        }],
        sharedTemplateBindings: [
          // The Set's current first slot superseded field-1's former direct
          // template-1 binding. field-1 has explicitly excluded it.
          { id: "slot-superseding", setId: "set-1", templateId: "template-2", usageCount: 0, revision: 0, order: 0 },
        ],
        sharedTemplateFieldStates: [
          { id: "exclude-superseding", setId: "set-1", slotId: "slot-superseding", fieldProfileId: "field-1", mode: "exclude" },
        ],
      });

      await repository.removeSharedTemplateSetMember({ setId: "set-1", fieldProfileId: "field-1" });

      const state = await repository.read();
      // template-1 was dormant while field-1 was shared; it was not in the
      // effective list and must not be resurrected after Stop sharing.
      expect(state.bindings.filter((binding) => binding.fieldProfileId === "field-1")).toEqual([]);
    });

    it("fails closed undoing a non-ending removal once the departed Field has joined a different set", async () => {
      const storage = new InMemoryLocalStorage();
      const repository = new FillNestRepository(storage);
      const preRemovalSet = { id: "set-1", siteId: "example.test", name: "Contact fields", memberFieldProfileIds: ["field-1", "field-2"] };
      await repository.replaceState({
        ...sharedBaseState,
        sharedTemplateSets: [preRemovalSet, { id: "set-2", siteId: "example.test", name: "Other", memberFieldProfileIds: ["field-other"] }],
        fieldProfiles: [...sharedBaseState.fieldProfiles, { id: "field-other", pageProfileId: "page-1" }],
      });

      await repository.removeSharedTemplateSetMember({ setId: "set-1", fieldProfileId: "field-2" });
      // Field-2 joins a different set before the Undo below runs.
      await repository.addSharedTemplateSetMember({ setId: "set-2", fieldProfileId: "field-2" });

      await expect(
        repository.undoRemoveSharedTemplateSetMember({
          fieldProfileId: "field-2",
          set: preRemovalSet,
          endedSharedBindings: [],
          snapshotBindings: [],
          dormantBindings: [],
          removedOwnedSlots: [],
          removedFieldStates: [],
        }),
      ).rejects.toThrow(StaleUndoError);
      // Field-2 must not end up a member of both sets.
      await expect(repository.read()).resolves.toMatchObject({
        sharedTemplateSets: [expect.objectContaining({ id: "set-2", memberFieldProfileIds: ["field-other", "field-2"] })],
      });
    });

    it("removing the last member ends the set and its shared Bindings, and Undo recreates them exactly", async () => {
      const storage = new InMemoryLocalStorage();
      const repository = new FillNestRepository(storage);
      const set = { id: "set-1", siteId: "example.test", name: "Contact fields", memberFieldProfileIds: ["field-1"] };
      const sharedBindings = [{ id: "shared-binding-1", setId: "set-1", templateId: "template-1", usageCount: 0, revision: 0, order: 0 }];
      await repository.replaceState({ ...sharedBaseState, sharedTemplateSets: [set], sharedTemplateBindings: sharedBindings });

      const result = await repository.removeSharedTemplateSetMember({ setId: "set-1", fieldProfileId: "field-1" });
      expect(result).toEqual(expect.objectContaining({
        ended: true,
        set: null,
        newlyGlobalTemplates: [],
        snapshotBindings: [expect.objectContaining({ fieldProfileId: "field-1", templateId: "template-1" })],
        dormantBindings: [expect.objectContaining({ id: "binding-1" })],
        removedFieldStates: [],
      }));
      await expect(repository.read()).resolves.toMatchObject({ sharedTemplateSets: [], sharedTemplateBindings: [] });

      await repository.undoRemoveSharedTemplateSetMember({
        fieldProfileId: "field-1",
        set,
        endedSharedBindings: sharedBindings,
        snapshotBindings: result.snapshotBindings,
        dormantBindings: result.dormantBindings,
        removedOwnedSlots: [],
        removedFieldStates: [],
      });
      await expect(repository.read()).resolves.toMatchObject({ sharedTemplateSets: [set], sharedTemplateBindings: sharedBindings });

      // Fails closed once the Field is shared again elsewhere.
      await repository.removeSharedTemplateSetMember({ setId: "set-1", fieldProfileId: "field-1" });
      await repository.createSharedTemplateSet({ fieldProfileIds: ["field-1", "field-2"] });
      await expect(
        repository.undoRemoveSharedTemplateSetMember({
          fieldProfileId: "field-1",
          set,
          endedSharedBindings: sharedBindings,
          snapshotBindings: result.snapshotBindings,
          dormantBindings: result.dormantBindings,
          removedOwnedSlots: [],
          removedFieldStates: [],
        }),
      ).rejects.toThrow(StaleUndoError);
    });

    it("ends a Shared Template Set outright, and Undo recreates it and its shared Bindings", async () => {
      const storage = new InMemoryLocalStorage();
      const repository = new FillNestRepository(storage);
      const set = { id: "set-1", siteId: "example.test", name: "Contact fields", memberFieldProfileIds: ["field-1", "field-2"] };
      const sharedBindings = [{ id: "shared-binding-1", setId: "set-1", templateId: "template-1", usageCount: 0, revision: 0, order: 0 }];
      await repository.replaceState({ ...sharedBaseState, sharedTemplateSets: [set], sharedTemplateBindings: sharedBindings });

      const result = await repository.endSharedTemplateSet({ setId: "set-1" });
      expect(result).toEqual(
        expect.objectContaining({ memberFieldProfileIds: ["field-1", "field-2"], newlyGlobalTemplates: [], endedFieldStates: [] }),
      );
      // Task 021 Addendum B: every member keeps the Template it was offered.
      expect(result.convertedBindings.map((binding) => [binding.fieldProfileId, binding.templateId])).toEqual([
        ["field-1", "template-1"],
        ["field-2", "template-1"],
      ]);
      await expect(repository.read()).resolves.toMatchObject({ sharedTemplateSets: [], sharedTemplateBindings: [] });

      const undo = {
        set,
        sharedBindings,
        endedFieldStates: [],
        convertedBindings: result.convertedBindings,
        dormantBindings: result.dormantBindings,
      };
      await repository.undoEndSharedTemplateSet(undo);
      await expect(repository.read()).resolves.toMatchObject({ sharedTemplateSets: [set], sharedTemplateBindings: sharedBindings });
      await expect(repository.undoEndSharedTemplateSet(undo)).rejects.toThrow(StaleUndoError);
    });

    it("renames a Shared Template Set and rejects an empty name", async () => {
      const storage = new InMemoryLocalStorage();
      const repository = new FillNestRepository(storage);
      await repository.replaceState({
        ...sharedBaseState,
        sharedTemplateSets: [{ id: "set-1", siteId: "example.test", name: "Old name", memberFieldProfileIds: ["field-1", "field-2"] }],
      });

      await expect(
        repository.renameSharedTemplateSet({ setId: "set-1", name: "Household bills" }),
      ).resolves.toMatchObject({ name: "Household bills" });
      await expect(repository.renameSharedTemplateSet({ setId: "set-1", name: "   " })).rejects.toThrow(
        "cannot be empty",
      );
    });

    it("creates a new Template directly in a Shared Template Set's effective list, and undoes it", async () => {
      const storage = new InMemoryLocalStorage();
      const ids = ["new-template", "shared-binding-new"];
      const repository = new FillNestRepository(storage, {
        createId: () => ids.shift() ?? "unexpected-id",
        now: () => "2026-09-01T00:00:00.000Z",
      });
      await repository.replaceState({
        ...sharedBaseState,
        sharedTemplateSets: [{ id: "set-1", siteId: "example.test", name: "Contact fields", memberFieldProfileIds: ["field-1", "field-2"] }],
      });

      const created = await repository.createTemplateAndBindShared({ setId: "set-1", content: "Shared reply" });
      expect(created.template).toMatchObject({ id: "new-template", content: "Shared reply", siteAffinities: ["example.test"] });
      expect(created.sharedBinding).toEqual({ id: "shared-binding-new", setId: "set-1", templateId: "new-template", usageCount: 0, revision: 0, order: 0 });

      await repository.undoCreateTemplateAndBindShared({ setId: "set-1", sharedBindingId: "shared-binding-new", templateId: "new-template" });
      await expect(repository.read()).resolves.toMatchObject({ sharedTemplateBindings: [] });
      expect((await repository.read()).templates.some((template) => template.id === "new-template")).toBe(false);
    });

    it("binds an existing Template into a Shared Template Set idempotently, and undoes the bind", async () => {
      const storage = new InMemoryLocalStorage();
      const ids = ["shared-binding-1"];
      const repository = new FillNestRepository(storage, {
        createId: () => ids.shift() ?? "unexpected-id",
        now: () => "2026-09-01T00:00:00.000Z",
      });
      await repository.replaceState({
        ...sharedBaseState,
        sharedTemplateSets: [{ id: "set-1", siteId: "example.test", name: "Contact fields", memberFieldProfileIds: ["field-1", "field-2"] }],
      });

      const bound = await repository.bindTemplateShared({ setId: "set-1", templateId: "template-2" });
      expect(bound).toEqual({ id: "shared-binding-1", setId: "set-1", templateId: "template-2", usageCount: 0, revision: 0, order: 0 });

      // Idempotent: binding the same Template again returns the existing shared Binding unchanged.
      await expect(repository.bindTemplateShared({ setId: "set-1", templateId: "template-2" })).resolves.toEqual(bound);

      await repository.undoBindTemplateShared({ sharedBindingId: "shared-binding-1" });
      await expect(repository.read()).resolves.toMatchObject({ sharedTemplateBindings: [] });
      await expect(repository.undoBindTemplateShared({ sharedBindingId: "shared-binding-1" })).rejects.toThrow(StaleUndoError);
    });

    it("unbinds a Template from a Shared Template Set's effective list, and undoes the unbind", async () => {
      const storage = new InMemoryLocalStorage();
      const repository = new FillNestRepository(storage);
      const sharedBinding = { id: "shared-binding-1", setId: "set-1", templateId: "template-2", usageCount: 4, revision: 0, order: 0 };
      await repository.replaceState({
        ...sharedBaseState,
        sharedTemplateSets: [{ id: "set-1", siteId: "example.test", name: "Contact fields", memberFieldProfileIds: ["field-1", "field-2"] }],
        sharedTemplateBindings: [sharedBinding],
      });

      await expect(repository.unbindTemplateShared({ setId: "set-1", slotId: "shared-binding-1" })).resolves.toEqual({
        sharedBinding,
        fieldStates: [],
      });
      await expect(repository.unbindTemplateShared({ setId: "set-1", slotId: "shared-binding-1" })).resolves.toBe(false);
      await expect(repository.read()).resolves.toMatchObject({ sharedTemplateBindings: [] });

    await repository.undoUnbindTemplateShared({ sharedBinding, fieldStates: [] });
      await expect(repository.read()).resolves.toMatchObject({ sharedTemplateBindings: [sharedBinding] });
    await expect(repository.undoUnbindTemplateShared({ sharedBinding, fieldStates: [] })).rejects.toThrow(StaleUndoError);
    });

    it("Clear Site Data ends a Site's Shared Template Sets together with its other local data", async () => {
      const storage = new InMemoryLocalStorage();
      const repository = new FillNestRepository(storage);
      const set = { id: "set-1", siteId: "example.test", name: "Contact fields", memberFieldProfileIds: ["field-1", "field-2"] };
      const sharedBindings = [{ id: "shared-binding-1", setId: "set-1", templateId: "template-1", usageCount: 0, revision: 0, order: 0 }];
      await repository.replaceState({ ...sharedBaseState, sharedTemplateSets: [set], sharedTemplateBindings: sharedBindings });

      const impact = computeResetSiteMappingsImpact(await repository.read(), "example.test");
      expect(impact.sharedTemplateSetCount).toBe(1);

      const result = await repository.resetSiteMappingsBatch({ sites: [{ siteId: "example.test" }] });
      expect(result.didMutate).toBe(true);
      expect(result.endedSharedTemplateSetCount).toBe(1);
      await expect(repository.read()).resolves.toMatchObject({ sharedTemplateSets: [], sharedTemplateBindings: [] });
    });
  });

  describe("Cross-Site linking and merge (Task 024 Slice 3)", () => {
    const sharedBaseState = {
      ...baseLogicalPageState,
      pageProfiles: [
        ...baseLogicalPageState.pageProfiles,
        { id: "page-2", siteId: "example.test", identityKey: "/orders/1" },
        { id: "page-other-site", siteId: "other.test", identityKey: "/profile" },
      ],
      fieldProfiles: [
        ...baseLogicalPageState.fieldProfiles,
        { id: "field-2", pageProfileId: "page-2", identityKey: "field-y" },
        { id: "field-other-site", pageProfileId: "page-other-site", identityKey: "field-z" },
      ],
      sites: [...baseLogicalPageState.sites, { id: "other.test" }],
    };

    it.each([false, true])("unions a joining Field's Templates without hiding them (cross-Site: %s), with exact Undo", async (crossSite) => {
      const repository = new FillNestRepository(new InMemoryLocalStorage());
      const joiningId = crossSite ? "field-other-site" : "field-2";
      const joiningPage = crossSite ? "page-other-site" : "page-2";
      const before = {
        ...sharedBaseState,
        fieldProfiles: [...sharedBaseState.fieldProfiles, { id: "field-peer", pageProfileId: "page-1", identityKey: "peer" }],
        templates: [
          { id: "template-a", content: "A", siteAffinities: ["example.test"], createdAt: "x", updatedAt: "x", totalUsageCount: 0, revision: 0 },
          { id: "template-c", content: "C", siteAffinities: [crossSite ? "other.test" : "example.test"], createdAt: "x", updatedAt: "x", totalUsageCount: 0, revision: 0 },
        ],
        bindings: [
          { id: "direct-c", templateId: "template-c", pageProfileId: joiningPage, fieldProfileId: joiningId, createdAt: "x", usageCount: 3, revision: 0 },
          { id: "direct-overlap", templateId: "template-a", pageProfileId: joiningPage, fieldProfileId: joiningId, createdAt: "x", usageCount: 2, revision: 0 },
        ],
        sharedTemplateSets: [{ id: "set-a", siteId: "example.test", name: "AB", memberFieldProfileIds: ["field-1", "field-peer"] }],
        sharedTemplateBindings: [{ id: "shared-a", setId: "set-a", templateId: "template-a", usageCount: 5, revision: 0, order: 0 }],
      };
      await repository.replaceState(before);
      const added = await repository.addSharedTemplateSetMember({ setId: "set-a", fieldProfileId: joiningId, allowCrossSite: crossSite });
      const after = await repository.read();
      expect(after.sharedTemplateBindings.map((binding) => binding.templateId)).toEqual(["template-a", "template-c"]);
      expect(after.sharedTemplateBindings.map((binding) => binding.usageCount)).toEqual([7, 3]);
      expect(after.bindings).toEqual(before.bindings);
      expect(after.templates.find((template) => template.id === "template-c")?.siteAffinities).toContain("example.test");
      await repository.undoAddSharedTemplateSetMember({ setId: "set-a", fieldProfileId: joiningId, ...added.undo });
      const restored = await repository.read();
      expect(restored.sharedTemplateBindings).toEqual(before.sharedTemplateBindings);
      expect(restored.sharedTemplateSets).toEqual(before.sharedTemplateSets);
      expect(restored.bindings).toEqual(before.bindings);
    });

    it.each(["rename", "membership", "bindings"])("rejects add-member Undo after later %s changes", async (change) => {
      const repository = new FillNestRepository(new InMemoryLocalStorage());
      await repository.replaceState(sharedBaseState);
      const created = await repository.createSharedTemplateSet({ fieldProfileIds: ["field-1", "field-2"] });
      const added = await repository.addSharedTemplateSetMember({ setId: created.set.id, fieldProfileId: "field-other-site", allowCrossSite: true });
      if (change === "rename") await repository.renameSharedTemplateSet({ setId: created.set.id, name: "Changed" });
      if (change === "membership") await repository.removeSharedTemplateSetMember({ setId: created.set.id, fieldProfileId: "field-2" });
      if (change === "bindings") await repository.createTemplateAndBindShared({ setId: created.set.id, content: "Later shared Template" });
      const changed = await repository.read();
      await expect(repository.undoAddSharedTemplateSetMember({ setId: created.set.id, fieldProfileId: "field-other-site", ...added.undo })).rejects.toThrow(StaleUndoError);
      expect(await repository.read()).toEqual(changed);
    });

    it("still rejects a cross-Site Shared Template Set by default (allowCrossSite omitted)", async () => {
      const storage = new InMemoryLocalStorage();
      const repository = new FillNestRepository(storage);
      await repository.replaceState(sharedBaseState);
      await expect(
        repository.createSharedTemplateSet({ fieldProfileIds: ["field-1", "field-other-site"] }),
      ).rejects.toThrow("cannot contain Fields from different Sites");
    });

    it("creates a cross-Site Shared Template Set when allowCrossSite is explicitly set", async () => {
      const storage = new InMemoryLocalStorage();
      let nextId = 0;
      const repository = new FillNestRepository(storage, {
        createId: () => `id-${nextId++}`,
        now: () => "2026-09-02T00:00:00.000Z",
      });
      await repository.replaceState(sharedBaseState);
      const result = await repository.createSharedTemplateSet({
        fieldProfileIds: ["field-1", "field-other-site"],
        allowCrossSite: true,
      });
      expect(result.set.memberFieldProfileIds).toEqual(["field-1", "field-other-site"]);
      // The anchor `siteId` is the first-resolved member's Site - purely a
      // Site-management display label, not an enforced membership boundary.
      expect(result.set.siteId).toBe("example.test");
    });

    it("still rejects adding a cross-Site member by default, but allows it with allowCrossSite", async () => {
      const storage = new InMemoryLocalStorage();
      const repository = new FillNestRepository(storage);
      await repository.replaceState({
        ...sharedBaseState,
        sharedTemplateSets: [{ id: "set-1", siteId: "example.test", name: "First", memberFieldProfileIds: ["field-1"] }],
      });
      await expect(
        repository.addSharedTemplateSetMember({ setId: "set-1", fieldProfileId: "field-other-site" }),
      ).rejects.toThrow("not found in this Site");
      const updated = await repository.addSharedTemplateSetMember({
        setId: "set-1",
        fieldProfileId: "field-other-site",
        allowCrossSite: true,
      });
      expect(updated.memberFieldProfileIds).toEqual(["field-1", "field-other-site"]);
    });

    // Regression: a Shared Template Set's own Templates used to be
    // affiliated only with the Set's anchor Site (`set.siteId`) - correct
    // before Task 024, when every member was always on that one Site, but
    // incomplete once a cross-Site add brings in a Site the Template had
    // never been affiliated with.
    it("affiliates an existing shared Template with a newly added cross-Site member's Site", async () => {
      const storage = new InMemoryLocalStorage();
      const repository = new FillNestRepository(storage, { createId: () => "unused", now: () => "2026-09-02T00:00:00.000Z" });
      await repository.replaceState({
        ...sharedBaseState,
        templates: [
          { id: "template-1", content: "Reply", siteAffinities: ["example.test"], createdAt: "x", updatedAt: "x", totalUsageCount: 0, revision: 0 },
        ],
        sharedTemplateSets: [{ id: "set-1", siteId: "example.test", name: "First", memberFieldProfileIds: ["field-1"] }],
        sharedTemplateBindings: [
          { id: "shared-binding-1", setId: "set-1", templateId: "template-1", usageCount: 0, revision: 0, order: 0 },
        ],
      });

      await repository.addSharedTemplateSetMember({
        setId: "set-1",
        fieldProfileId: "field-other-site",
        allowCrossSite: true,
      });

      const state = await repository.read();
      expect(state.templates[0]).toMatchObject({
        id: "template-1",
        siteAffinities: expect.arrayContaining(["example.test", "other.test"]),
        revision: 1,
      });
      expect(state.sites.map((site) => site.id).sort()).toEqual(["example.test", "other.test"]);
    });

    it("affiliates a Template unioned into a cross-Site create with every member's Site", async () => {
      const storage = new InMemoryLocalStorage();
      const repository = new FillNestRepository(storage);
      await repository.replaceState({
        ...sharedBaseState,
        templates: [
          { id: "template-1", content: "Reply", siteAffinities: ["example.test"], createdAt: "x", updatedAt: "x", totalUsageCount: 0, revision: 0 },
        ],
        bindings: [
          { id: "binding-1", templateId: "template-1", pageProfileId: "page-1", fieldProfileId: "field-1", createdAt: "x", usageCount: 0, revision: 0},
        ],
      });

      await repository.createSharedTemplateSet({
        fieldProfileIds: ["field-1", "field-other-site"],
        allowCrossSite: true,
      });

      const state = await repository.read();
      expect(state.templates[0]).toMatchObject({
        id: "template-1",
        siteAffinities: expect.arrayContaining(["example.test", "other.test"]),
      });
    });

    it("merges two distinct Shared Template Sets into one, retaining the keep-Set's name and deduplicating members and Templates", async () => {
      const storage = new InMemoryLocalStorage();
      const state = {
        ...sharedBaseState,
        templates: [
          { id: "template-1", content: "First", siteAffinities: ["example.test"], createdAt: "x", updatedAt: "x", totalUsageCount: 0, revision: 0 },
          { id: "template-2", content: "Second", siteAffinities: ["other.test"], createdAt: "x", updatedAt: "x", totalUsageCount: 0, revision: 0 },
          { id: "template-shared", content: "Shared by both", siteAffinities: ["example.test", "other.test"], createdAt: "x", updatedAt: "x", totalUsageCount: 0, revision: 0 },
        ],
        sharedTemplateSets: [
          { id: "keep-set", siteId: "example.test", name: "Keep me", memberFieldProfileIds: ["field-1", "field-2"] },
          { id: "remove-set", siteId: "other.test", name: "Remove me", memberFieldProfileIds: ["field-other-site"] },
        ],
        sharedTemplateBindings: [
          { id: "keep-binding-1", setId: "keep-set", templateId: "template-1", usageCount: 2, revision: 0, order: 0 },
          { id: "keep-binding-2", setId: "keep-set", templateId: "template-shared", usageCount: 1, revision: 0, order: 1 },
          { id: "remove-binding-1", setId: "remove-set", templateId: "template-2", usageCount: 5, revision: 0, order: 0 },
          { id: "remove-binding-2", setId: "remove-set", templateId: "template-shared", usageCount: 3, revision: 0, order: 1 },
        ],
      };
      const repository = new FillNestRepository(storage, {
        createId: () => "merged-binding-template-2",
        now: () => "2026-09-02T00:00:00.000Z",
      });
      await repository.replaceState(state);

      const result = await repository.mergeSharedTemplateSets({ keepSetId: "keep-set", removeSetId: "remove-set" });

      expect(result.set).toEqual({
        id: "keep-set",
        siteId: "example.test",
        name: "Keep me",
        memberFieldProfileIds: ["field-1", "field-2", "field-other-site"],
      });
      const finalState = await repository.read();
      expect(finalState.sharedTemplateSets).toEqual([result.set]);
      const finalBindings = [...finalState.sharedTemplateBindings].sort((a, b) => a.order - b.order);
      expect(finalBindings).toEqual([
        { id: "keep-binding-1", setId: "keep-set", templateId: "template-1", usageCount: 2, revision: 0, order: 0 },
        // Shared by both original Sets: keeps the keep-Set's own Binding
        // identity, usage counts summed (1 + 3).
        { id: "keep-binding-2", setId: "keep-set", templateId: "template-shared", usageCount: 4, revision: 0, order: 1 },
        // Exclusive to the removed Set: a fresh Binding now owned by keep-set.
        { id: "merged-binding-template-2", setId: "keep-set", templateId: "template-2", usageCount: 5, revision: 0, order: 2 },
      ]);
    });

    // Task 026 acceptance 6: "When a cross-Site merge deduplicates the same
    // base Template from both Sets, the Current Field Set's slot is the
    // canonical surviving slot... Every Override and Exclusion from the
    // merged-away slot is atomically remapped to the canonical slot."
    it("remaps the removed Set's Overrides and Exclusions onto the canonical surviving slot for both a deduplicated and an exclusive Template", async () => {
      const storage = new InMemoryLocalStorage();
      const state = {
        ...sharedBaseState,
        templates: [
          { id: "template-1", content: "First", siteAffinities: ["example.test"], createdAt: "x", updatedAt: "x", totalUsageCount: 0, revision: 0 },
          { id: "template-2", content: "Second", siteAffinities: ["other.test"], createdAt: "x", updatedAt: "x", totalUsageCount: 0, revision: 0 },
          { id: "template-shared", content: "Shared by both", siteAffinities: ["example.test", "other.test"], createdAt: "x", updatedAt: "x", totalUsageCount: 0, revision: 0 },
          { id: "override-template", content: "field-other-site's own version", siteAffinities: ["other.test"], createdAt: "x", updatedAt: "x", totalUsageCount: 0, revision: 0 },
        ],
        sharedTemplateSets: [
          { id: "keep-set", siteId: "example.test", name: "Keep me", memberFieldProfileIds: ["field-1", "field-2"] },
          { id: "remove-set", siteId: "other.test", name: "Remove me", memberFieldProfileIds: ["field-other-site"] },
        ],
        sharedTemplateBindings: [
          { id: "keep-binding-1", setId: "keep-set", templateId: "template-1", usageCount: 2, revision: 0, order: 0 },
          { id: "keep-binding-2", setId: "keep-set", templateId: "template-shared", usageCount: 1, revision: 0, order: 1 },
          { id: "remove-binding-1", setId: "remove-set", templateId: "template-2", usageCount: 5, revision: 0, order: 0 },
          { id: "remove-binding-2", setId: "remove-set", templateId: "template-shared", usageCount: 3, revision: 0, order: 1 },
        ],
        sharedTemplateFieldStates: [
          // field-other-site excludes the deduplicated "template-shared" slot.
          { id: "state-exclude-shared", setId: "remove-set", slotId: "remove-binding-2", fieldProfileId: "field-other-site", mode: "exclude" as const },
          // field-other-site overrides the removed Set's own exclusive slot.
          {
            id: "state-override-exclusive",
            setId: "remove-set",
            slotId: "remove-binding-1",
            fieldProfileId: "field-other-site",
            mode: "override" as const,
            templateId: "override-template",
            usageCount: 0,
            revision: 0,
          },
          // A keep-Set member's own pre-existing Exclusion must survive
          // untouched - the merge never owns keep-Set slots.
          { id: "state-keep-untouched", setId: "keep-set", slotId: "keep-binding-1", fieldProfileId: "field-1", mode: "exclude" as const },
        ],
      };
      const repository = new FillNestRepository(storage, {
        createId: () => "merged-binding-template-2",
        now: () => "2026-09-02T00:00:00.000Z",
      });
      await repository.replaceState(state);

      const result = await repository.mergeSharedTemplateSets({ keepSetId: "keep-set", removeSetId: "remove-set" });

      const finalState = await repository.read();
      expect([...finalState.sharedTemplateFieldStates].sort((a, b) => a.id.localeCompare(b.id))).toEqual([
        { id: "state-exclude-shared", setId: "keep-set", slotId: "keep-binding-2", fieldProfileId: "field-other-site", mode: "exclude" },
        {
          id: "state-override-exclusive",
          setId: "keep-set",
          slotId: "merged-binding-template-2",
          fieldProfileId: "field-other-site",
          mode: "override",
          templateId: "override-template",
          usageCount: 0,
          revision: 0,
        },
        { id: "state-keep-untouched", setId: "keep-set", slotId: "keep-binding-1", fieldProfileId: "field-1", mode: "exclude" },
      ].sort((a, b) => a.id.localeCompare(b.id)));

      // No duplicate effective row for the deduplicated Template, and every
      // remapped relationship actually takes effect post-merge.
      const fieldOtherSiteList = effectiveTemplateListForField(finalState, "field-other-site");
      // Inherits keep-set's own "template-1" slot untouched, its own
      // Override in place of the exclusive "template-2" slot, and excludes
      // the deduplicated "template-shared" slot entirely.
      expect(fieldOtherSiteList.templateIds.sort()).toEqual(["override-template", "template-1"].sort());
      expect(fieldOtherSiteList.entries.filter((entry) => entry.templateId === "template-shared")).toHaveLength(0);

      const field1List = effectiveTemplateListForField(finalState, "field-1");
      expect(field1List.templateIds.sort()).toEqual(["template-2", "template-shared"].sort());

      expect(result.remappedFieldStates.map((entry) => entry.id).sort()).toEqual(["state-exclude-shared", "state-override-exclusive"]);
      expect(result.previousRemovedSetFieldStates.map((entry) => entry.id).sort()).toEqual(["state-exclude-shared", "state-override-exclusive"]);
    });

    it("Undo of a merge with remapped Overrides/Exclusions restores their exact pre-merge setId and slotId", async () => {
      const storage = new InMemoryLocalStorage();
      const state = {
        ...sharedBaseState,
        templates: [
          { id: "template-1", content: "First", siteAffinities: ["example.test"], createdAt: "x", updatedAt: "x", totalUsageCount: 0, revision: 0 },
          { id: "template-shared", content: "Shared by both", siteAffinities: ["example.test", "other.test"], createdAt: "x", updatedAt: "x", totalUsageCount: 0, revision: 0 },
        ],
        sharedTemplateSets: [
          { id: "keep-set", siteId: "example.test", name: "Keep me", memberFieldProfileIds: ["field-1"] },
          { id: "remove-set", siteId: "other.test", name: "Remove me", memberFieldProfileIds: ["field-other-site"] },
        ],
        sharedTemplateBindings: [
          { id: "keep-binding-1", setId: "keep-set", templateId: "template-shared", usageCount: 1, revision: 0, order: 0 },
          { id: "remove-binding-1", setId: "remove-set", templateId: "template-shared", usageCount: 3, revision: 0, order: 0 },
        ],
        sharedTemplateFieldStates: [
          { id: "state-exclude-shared", setId: "remove-set", slotId: "remove-binding-1", fieldProfileId: "field-other-site", mode: "exclude" as const },
        ],
      };
      const repository = new FillNestRepository(storage, { createId: () => "unused", now: () => "2026-09-02T00:00:00.000Z" });
      await repository.replaceState(state);

      const merged = await repository.mergeSharedTemplateSets({ keepSetId: "keep-set", removeSetId: "remove-set" });
      await repository.undoMergeSharedTemplateSets({
        mergedSet: merged.set,
        mergedSetBindings: merged.bindings,
        previousKeepSet: merged.previousKeepSet,
        previousKeepSetBindings: merged.previousKeepSetBindings,
        removedSet: merged.removedSet,
        removedSetBindings: merged.removedSetBindings,
        remappedFieldStates: merged.remappedFieldStates,
        previousRemovedSetFieldStates: merged.previousRemovedSetFieldStates,
      });

      const restored = await repository.read();
      expect(restored.sharedTemplateFieldStates).toEqual(state.sharedTemplateFieldStates);
    });

    it("undoes a merge, fully restoring both original Sets, their names, members, and Binding lists", async () => {
      const storage = new InMemoryLocalStorage();
      const state = {
        ...sharedBaseState,
        templates: [
          { id: "template-1", content: "First", siteAffinities: ["example.test"], createdAt: "x", updatedAt: "x", totalUsageCount: 0, revision: 0 },
          { id: "template-2", content: "Second", siteAffinities: ["other.test"], createdAt: "x", updatedAt: "x", totalUsageCount: 0, revision: 0 },
        ],
        sharedTemplateSets: [
          { id: "keep-set", siteId: "example.test", name: "Keep me", memberFieldProfileIds: ["field-1", "field-2"] },
          { id: "remove-set", siteId: "other.test", name: "Remove me", memberFieldProfileIds: ["field-other-site"] },
        ],
        sharedTemplateBindings: [
          { id: "keep-binding-1", setId: "keep-set", templateId: "template-1", usageCount: 2, revision: 0, order: 0 },
          { id: "remove-binding-1", setId: "remove-set", templateId: "template-2", usageCount: 5, revision: 0, order: 0 },
        ],
      };
      const repository = new FillNestRepository(storage, { createId: () => "unused", now: () => "2026-09-02T00:00:00.000Z" });
      await repository.replaceState(state);

      const merged = await repository.mergeSharedTemplateSets({ keepSetId: "keep-set", removeSetId: "remove-set" });
      await repository.undoMergeSharedTemplateSets({
        mergedSet: merged.set,
        mergedSetBindings: merged.bindings,
        previousKeepSet: merged.previousKeepSet,
        previousKeepSetBindings: merged.previousKeepSetBindings,
        removedSet: merged.removedSet,
        removedSetBindings: merged.removedSetBindings,
        remappedFieldStates: merged.remappedFieldStates,
        previousRemovedSetFieldStates: merged.previousRemovedSetFieldStates,
      });

      const restored = await repository.read();
      expect([...restored.sharedTemplateSets].sort((a, b) => a.id.localeCompare(b.id))).toEqual(
        [...state.sharedTemplateSets].sort((a, b) => a.id.localeCompare(b.id)),
      );
      expect([...restored.sharedTemplateBindings].sort((a, b) => a.id.localeCompare(b.id))).toEqual(
        [...state.sharedTemplateBindings].sort((a, b) => a.id.localeCompare(b.id)),
      );
    });

    it("rejects an Undo Merge once the merged Set no longer exists (stale)", async () => {
      const storage = new InMemoryLocalStorage();
      const state = {
        ...sharedBaseState,
        sharedTemplateSets: [
          { id: "keep-set", siteId: "example.test", name: "Keep me", memberFieldProfileIds: ["field-1", "field-2"] },
          { id: "remove-set", siteId: "other.test", name: "Remove me", memberFieldProfileIds: ["field-other-site"] },
        ],
        sharedTemplateBindings: [],
        sharedTemplateFieldStates: [],
      };
      const repository = new FillNestRepository(storage);
      await repository.replaceState(state);
      const merged = await repository.mergeSharedTemplateSets({ keepSetId: "keep-set", removeSetId: "remove-set" });
      // The merged Set is ended entirely before Undo is attempted.
      await repository.endSharedTemplateSet({ setId: merged.set.id });

      await expect(
        repository.undoMergeSharedTemplateSets({
          mergedSet: merged.set,
          mergedSetBindings: merged.bindings,
          previousKeepSet: merged.previousKeepSet,
          previousKeepSetBindings: merged.previousKeepSetBindings,
          removedSet: merged.removedSet,
          removedSetBindings: merged.removedSetBindings,
          remappedFieldStates: merged.remappedFieldStates,
          previousRemovedSetFieldStates: merged.previousRemovedSetFieldStates,
        }),
      ).rejects.toThrow(StaleUndoError);
    });

    // Regression (independent review finding): the merged Set surviving
    // under the same id was previously the only staleness check - a further
    // mutation to it after the merge (a new member added, a Template
    // added/removed, a rename) would be silently discarded by Undo, which
    // would restore the stale pre-merge snapshot on top of it.
    it("rejects an Undo Merge once the merged Set has been mutated since the merge (a member was added)", async () => {
      const storage = new InMemoryLocalStorage();
      const state = {
        ...sharedBaseState,
        fieldProfiles: [
          ...sharedBaseState.fieldProfiles,
          { id: "field-fourth", pageProfileId: "page-1", identityKey: "field-q" },
        ],
        sharedTemplateSets: [
          { id: "keep-set", siteId: "example.test", name: "Keep me", memberFieldProfileIds: ["field-1", "field-2"] },
          { id: "remove-set", siteId: "other.test", name: "Remove me", memberFieldProfileIds: ["field-other-site"] },
        ],
        sharedTemplateBindings: [],
        sharedTemplateFieldStates: [],
      };
      const repository = new FillNestRepository(storage);
      await repository.replaceState(state);
      const merged = await repository.mergeSharedTemplateSets({ keepSetId: "keep-set", removeSetId: "remove-set" });

      // A further member is added to the merged Set after the merge, before
      // Undo is attempted - simulating the user growing the Set further
      // (e.g. through Site management's own "Add") in between.
      await repository.addSharedTemplateSetMember({ setId: merged.set.id, fieldProfileId: "field-fourth" });

      await expect(
        repository.undoMergeSharedTemplateSets({
          mergedSet: merged.set,
          mergedSetBindings: merged.bindings,
          previousKeepSet: merged.previousKeepSet,
          previousKeepSetBindings: merged.previousKeepSetBindings,
          removedSet: merged.removedSet,
          removedSetBindings: merged.removedSetBindings,
          remappedFieldStates: merged.remappedFieldStates,
          previousRemovedSetFieldStates: merged.previousRemovedSetFieldStates,
        }),
      ).rejects.toThrow(StaleUndoError);

      // The intervening add must survive untouched - not be silently
      // discarded by a "successful" stale Undo.
      const finalState = await repository.read();
      expect(finalState.sharedTemplateSets).toEqual([
        { ...merged.set, memberFieldProfileIds: [...merged.set.memberFieldProfileIds, "field-fourth"] },
      ]);
    });

    // Regression: clearing one Site of a cross-Site Set used to be keyed off
    // the Set's own anchor `siteId` alone - either silently ending sharing
    // for an unrelated Site's member (if the anchor was cleared) or leaving
    // a cleared member's now-deleted Field Profile dangling in the Set,
    // which would fail `validateCandidateInvariants` on the very commit that
    // performed the clear. Found and fixed during this Slice's own review.
    describe("Site cleanup on a cross-Site Shared Template Set", () => {
      function crossSiteState() {
        return {
          ...sharedBaseState,
          fieldProfiles: [
            ...sharedBaseState.fieldProfiles,
            { id: "field-third", pageProfileId: "page-1", identityKey: "field-w" },
            { id: "field-other-site-2", pageProfileId: "page-other-site", identityKey: "field-v" },
          ],
          templates: [
            { id: "template-1", content: "Shared", siteAffinities: ["example.test", "other.test"], createdAt: "x", updatedAt: "x", totalUsageCount: 0, revision: 0 },
          ],
        };
      }

      it("shrinks (not ends) a cross-Site Set when the cleared Site still leaves 2+ members elsewhere", async () => {
        const storage = new InMemoryLocalStorage();
        const state = {
          ...crossSiteState(),
          sharedTemplateSets: [
            { id: "set-1", siteId: "example.test", name: "Cross-site", memberFieldProfileIds: ["field-1", "field-third", "field-other-site", "field-other-site-2"] },
          ],
          sharedTemplateBindings: [
            { id: "shared-binding-1", setId: "set-1", templateId: "template-1", usageCount: 0, revision: 0, order: 0 },
          ],
        };
        const repository = new FillNestRepository(storage);
        await repository.replaceState(state);

        const result = await repository.resetSiteMappingsBatch({ sites: [{ siteId: "example.test" }] });
        expect(result.endedSharedTemplateSetCount).toBe(0);
        const finalState = await repository.read();
        expect(finalState.sharedTemplateSets).toEqual([
          { id: "set-1", siteId: "example.test", name: "Cross-site", memberFieldProfileIds: ["field-other-site", "field-other-site-2"] },
        ]);
        // The shared Binding survives untouched - the Set is still alive.
        expect(finalState.sharedTemplateBindings).toHaveLength(1);
      });

      it("dissolves a cross-Site Set when clearing a Site leaves exactly one member, restoring that survivor's direct Binding", async () => {
        const storage = new InMemoryLocalStorage();
        let nextId = 0;
        const repository = new FillNestRepository(storage, { createId: () => `restored-${nextId++}`, now: () => "2026-09-02T00:00:00.000Z" });
        const state = {
          ...crossSiteState(),
          sharedTemplateSets: [
            { id: "set-1", siteId: "example.test", name: "Cross-site", memberFieldProfileIds: ["field-1", "field-other-site"] },
          ],
          sharedTemplateBindings: [
            { id: "shared-binding-1", setId: "set-1", templateId: "template-1", usageCount: 4, revision: 0, order: 0 },
          ],
        };
        await repository.replaceState(state);

        const result = await repository.resetSiteMappingsBatch({ sites: [{ siteId: "example.test" }] });
        expect(result.endedSharedTemplateSetCount).toBe(1);
        const finalState = await repository.read();
        expect(finalState.sharedTemplateSets).toEqual([]);
        expect(finalState.sharedTemplateBindings).toEqual([]);
        // field-other-site (on other.test, untouched by clearing example.test)
        // gets its own direct Binding back for the Template it was sharing.
        expect(finalState.bindings).toContainEqual(
          expect.objectContaining({ fieldProfileId: "field-other-site", templateId: "template-1", usageCount: 4 }),
        );
      });

      it("ends a cross-Site Set entirely only when every member was on the cleared Site(s)", async () => {
        const storage = new InMemoryLocalStorage();
        const state = {
          ...crossSiteState(),
          sharedTemplateSets: [
            { id: "set-1", siteId: "example.test", name: "Same-site only", memberFieldProfileIds: ["field-1", "field-third"] },
          ],
          sharedTemplateBindings: [
            { id: "shared-binding-1", setId: "set-1", templateId: "template-1", usageCount: 0, revision: 0, order: 0 },
          ],
        };
        const repository = new FillNestRepository(storage);
        await repository.replaceState(state);

        const result = await repository.resetSiteMappingsBatch({ sites: [{ siteId: "example.test" }] });
        expect(result.endedSharedTemplateSetCount).toBe(1);
        await expect(repository.read()).resolves.toMatchObject({ sharedTemplateSets: [], sharedTemplateBindings: [] });
      });

      it("counts a cross-Site Set in the impact preview even when anchored at a different Site", async () => {
        const storage = new InMemoryLocalStorage();
        const state = {
          ...crossSiteState(),
          sharedTemplateSets: [
            // Anchored at other.test, but field-1 (a member) is on example.test.
            { id: "set-1", siteId: "other.test", name: "Cross-site", memberFieldProfileIds: ["field-1", "field-other-site"] },
          ],
          sharedTemplateBindings: [],
          sharedTemplateFieldStates: [],
        };
        const repository = new FillNestRepository(storage);
        await repository.replaceState(state);

        const impact = computeResetSiteMappingsImpact(await repository.read(), "example.test");
        expect(impact.sharedTemplateSetCount).toBe(1);
      });
    });
  });

  it("migrates schema-v4 records additively through V5 to V6 matching collections", async () => {
    const storage = new InMemoryLocalStorage();
    storage.values.fillnestState = {
      schemaVersion: 4,
      sites: [{ id: "example.test" }],
      templates: [],
      pageProfiles: [{ id: "page-legacy", siteId: "example.test" }],
      fieldProfiles: [{ id: "field-legacy", pageProfileId: "page-legacy" }],
      bindings: [],
      pickerPosition: null,
      pageStatusPosition: null,
    };
    const repository = new FillNestRepository(storage);

    await expect(repository.read()).resolves.toMatchObject({
      schemaVersion: 13,
      compatibilityPairDecisions: [],
      pageProfiles: [{ id: "page-legacy", siteId: "example.test" }],
      fieldProfiles: [{ id: "field-legacy", pageProfileId: "page-legacy" }],
      logicalPageSiteKeys: [],
      logicalPageRules: [],
      logicalPageProvenance: [],
      logicalPageObservations: [],
    });
    expect(storage.setCount).toBe(1);
  });

  it("creates a schema-v1 Template with exactly one current-Site Affinity", async () => {
    const storage = new InMemoryLocalStorage();
    const repository = new FillNestRepository(storage, {
      createId: () => "template-001",
      now: () => "2026-08-08T06:00:00.000Z",
    });

    const created = await repository.createTemplate({
      content: "Jordan Lee",
      pageUrl: "http://records.example.test:4173/customer/42",
    });

    expect(created).toEqual({
      id: "template-001",
      content: "Jordan Lee",
      siteAffinities: ["example.test"],
      createdAt: "2026-08-08T06:00:00.000Z",
      updatedAt: "2026-08-08T06:00:00.000Z",
      totalUsageCount: 0,
      revision: 0,
    });
    await expect(repository.read()).resolves.toEqual({
      schemaVersion: 13,
      compatibilityPairDecisions: [],
      sites: [{ id: "example.test" }],
      templates: [created],
      pageProfiles: [],
      fieldProfiles: [],
      bindings: [],
      logicalPageSiteKeys: [],
      logicalPageRules: [],
      logicalPageProvenance: [],
      logicalPageObservations: [],
      sharedTemplateSets: [],
      sharedTemplateBindings: [],
      sharedTemplateFieldStates: [],
      pickerPosition: null,
      pageStatusPosition: null,
    });
  });

  it("rejects malformed schema-v3 records without replacing stored data", async () => {
    const storage = new InMemoryLocalStorage();
    storage.values.fillnestState = {
      schemaVersion: 3,
      templates: [{ id: "broken-template", content: 42 }],
    };
    const repository = new FillNestRepository(storage);

    await expect(repository.read()).rejects.toBeInstanceOf(InvalidStoredDataError);
    expect(storage.values.fillnestState).toEqual({
      schemaVersion: 3,
      templates: [{ id: "broken-template", content: 42 }],
    });
  });

  it("rejects a malformed legacy record without writing the migrated-but-invalid shape to storage", async () => {
    const storage = new InMemoryLocalStorage();
    storage.values.fillnestState = {
      schemaVersion: 1,
      templates: [{ id: "broken-template", content: 42 }],
    };
    const repository = new FillNestRepository(storage);

    await expect(repository.read()).rejects.toBeInstanceOf(InvalidStoredDataError);
    expect(storage.setCount).toBe(0);
    expect(storage.values.fillnestState).toEqual({
      schemaVersion: 1,
      templates: [{ id: "broken-template", content: 42 }],
    });
  });

  it("persists one Binding and adds its new Site Affinity without inserting content", async () => {
    const storage = new InMemoryLocalStorage();
    const ids = ["template-003", "binding-001"];
    const repository = new FillNestRepository(storage, {
      createId: () => ids.shift() ?? "unexpected-id",
      now: () => "2026-08-08T07:00:00.000Z",
    });
    await repository.createTemplate({
      content: "Jordan Lee",
      pageUrl: "https://forms.example.test/profile",
    });

    const first = await repository.bindTemplate({
      templateId: "template-003",
      pageUrl: "https://records.other.test/profile",
      pageProfileId: "page-profile-other",
      fieldProfileId: "field-profile-name",
    });
    const repeated = await repository.bindTemplate({
      templateId: "template-003",
      pageUrl: "https://records.other.test/profile",
      pageProfileId: "page-profile-other",
      fieldProfileId: "field-profile-name",
    });

    expect(repeated).toEqual(first);
    await expect(repository.read()).resolves.toEqual({
      schemaVersion: 13,
      compatibilityPairDecisions: [],
      sites: [{ id: "example.test" }, { id: "other.test" }],
      templates: [
        expect.objectContaining({
          id: "template-003",
          content: "Jordan Lee",
          siteAffinities: ["example.test", "other.test"],
        }),
      ],
      pageProfiles: [{ id: "page-profile-other", siteId: "other.test" }],
      fieldProfiles: [
        { id: "field-profile-name", pageProfileId: "page-profile-other" },
      ],
      bindings: [
        {
          id: "binding-001",
          templateId: "template-003",
          pageProfileId: "page-profile-other",
          fieldProfileId: "field-profile-name",
          createdAt: "2026-08-08T07:00:00.000Z",
          usageCount: 0,
          revision: 0,
        },
      ],
      logicalPageSiteKeys: [],
      logicalPageRules: [],
      logicalPageProvenance: [],
      logicalPageObservations: [],
      sharedTemplateSets: [],
      sharedTemplateBindings: [],
      sharedTemplateFieldStates: [],
      pickerPosition: null,
      pageStatusPosition: null,
    });
  });

  it("atomically creates a Template and its initial Binding for the Target Field", async () => {
    const storage = new InMemoryLocalStorage();
    const ids = ["template-created", "binding-created"];
    const repository = new FillNestRepository(storage, {
      createId: () => ids.shift() ?? "unexpected-id",
      now: () => "2026-08-13T10:30:00.000Z",
    });
    const createAndBind = (
      repository as FillNestRepository & {
        createTemplateAndBind(input: {
          content: string;
          pageUrl: string;
          pageProfileId: string;
          fieldProfileId: string;
          pageIdentityKey: string;
          fieldIdentityKey: string;
        }): Promise<{ template: { id: string }; binding: { id: string } }>;
      }
    ).createTemplateAndBind.bind(repository);

    const created = await createAndBind({
      content: "Created for this field",
      pageUrl: "https://forms.example.test/customer/42",
      pageProfileId: "page-customer",
      fieldProfileId: "field-notes",
      pageIdentityKey: "/customer/:record",
      fieldIdentityKey: '{"name":"notes"}',
    });

    expect(created).toEqual({
      template: expect.objectContaining({ id: "template-created" }),
      binding: expect.objectContaining({
        id: "binding-created",
        templateId: "template-created",
        fieldProfileId: "field-notes",
      }),
    });
    expect(storage.setCount).toBe(1);
    await expect(repository.read()).resolves.toEqual(
      expect.objectContaining({
        templates: [expect.objectContaining({ id: "template-created" })],
        bindings: [
          expect.objectContaining({
            id: "binding-created",
            templateId: "template-created",
            fieldProfileId: "field-notes",
          }),
        ],
      }),
    );
  });

  it("unbinds only the requested Template from the current Field Profile", async () => {
    const storage = new InMemoryLocalStorage();
    const ids = ["template-one", "binding-one", "template-two", "binding-two"];
    const repository = new FillNestRepository(storage, {
      createId: () => ids.shift() ?? "unexpected-id",
      now: () => "2026-08-13T10:45:00.000Z",
    });
    for (const content of ["First", "Second"]) {
      await repository.createTemplateAndBind({
        content,
        pageUrl: "https://forms.example.test/customer/42",
        pageProfileId: "page-customer",
        fieldProfileId: "field-notes",
      });
    }
    const unbind = (
      repository as FillNestRepository & {
        unbindTemplate(input: {
          templateId: string;
          fieldProfileId: string;
        }): Promise<boolean>;
      }
    ).unbindTemplate.bind(repository);

    await expect(
      unbind({ templateId: "template-one", fieldProfileId: "field-notes" }),
    ).resolves.toBe(true);
    const state = await repository.read();
    expect(state.templates.map((template) => template.id)).toEqual([
      "template-one",
      "template-two",
    ]);
    expect(state.bindings).toEqual([
      expect.objectContaining({
        templateId: "template-two",
        fieldProfileId: "field-notes",
      }),
    ]);
  });

  it("serializes concurrent mutations so accepted Templates cannot overwrite each other", async () => {
    const storage = new InMemoryLocalStorage();
    const ids = ["template-one", "template-two"];
    const repository = new FillNestRepository(storage, {
      createId: () => ids.shift() ?? "unexpected-id",
      now: () => "2026-08-13T12:00:00.000Z",
    });

    await Promise.all([
      repository.createTemplate({
        content: "First concurrent Template",
        pageUrl: "https://forms.example.test/profile",
      }),
      repository.createTemplate({
        content: "Second concurrent Template",
        pageUrl: "https://forms.example.test/profile",
      }),
    ]);

    const state = await repository.read();
    expect(state.templates.map((template) => template.content).sort()).toEqual([
      "First concurrent Template",
      "Second concurrent Template",
    ]);
  });

  it("restores a Binding only for the same reliable Page and Field identities", async () => {
    const storage = new InMemoryLocalStorage();
    const ids = ["template-1", "binding-1", "page-new", "field-new"];
    const repository = new FillNestRepository(storage, {
      createId: () => ids.shift() ?? "unexpected-id",
      now: () => "2026-08-08T08:00:00.000Z",
    });
    const template = await repository.createTemplate({
      content: "Recognized content",
      pageUrl: "https://app.example.test/customers/first-record/edit",
    });
    await repository.bindTemplate({
      templateId: template.id,
      pageUrl: "https://app.example.test/customers/first-record/edit",
      pageProfileId: "page-customers-edit",
      fieldProfileId: "field-contact-email",
      pageIdentityKey: "/customers/:record/edit",
      fieldIdentityKey: '{"semanticKind":"email","name":"contact_email"}',
    });

    const recognized = await repository.resolveFieldContext({
      pageUrl: "https://app.example.test/customers/unseen-third-record/edit",
      pageIdentityKey: "/customers/:record/edit",
      fieldIdentityKey: '{"semanticKind":"email","name":"contact_email"}',
    });
    const negativePage = await repository.resolveFieldContext({
      pageUrl: "https://app.example.test/vendors/unseen-record/edit",
      pageIdentityKey: "/vendors/:record/edit",
      fieldIdentityKey: '{"semanticKind":"email","name":"contact_email"}',
    });
    const ambiguousField = await repository.resolveFieldContext({
      pageUrl: "https://app.example.test/customers/unseen-third-record/edit",
      pageIdentityKey: "/customers/:record/edit",
      fieldIdentityKey: null,
    });

    expect(recognized).toEqual({
      siteId: "example.test",
      pageProfileId: "page-customers-edit",
      fieldProfileId: "field-contact-email",
      recognized: true,
    });
    expect(negativePage).toEqual({
      siteId: "example.test",
      pageProfileId: "page-new",
      fieldProfileId: "field-new",
      recognized: false,
    });
    expect(ambiguousField.recognized).toBe(false);
    const persisted = JSON.stringify(await repository.read());
    expect(persisted).not.toContain("first-record");
    expect(persisted).not.toContain("unseen-third-record");
  });

  it("restores a Binding for a tracking-param page and an exact structural Field identity", async () => {
    const storage = new InMemoryLocalStorage();
    const ids = ["template-1", "binding-1"];
    const repository = new FillNestRepository(storage, {
      createId: () => ids.shift() ?? "unexpected-id",
      now: () => "2026-08-24T00:00:00.000Z",
    });
    const structuralFieldIdentity =
      '{"tag":"input","type":"search","name":"","id":"","autocomplete":"","semanticKind":"","form":"","ancestors":["main"],"ordinal":0,"supportedFieldCount":1}';

    await repository.createTemplateAndBind({
      content: "Saved search",
      pageUrl: "https://practice.expandtesting.com/dynamic-pagination-table?utm_source=chatgpt.com",
      pageProfileId: "page-dynamic-table",
      fieldProfileId: "field-search",
      pageIdentityKey: "/dynamic-pagination-table",
      fieldIdentityKey: structuralFieldIdentity,
    });

    await expect(
      repository.resolveFieldContext({
        pageUrl: "https://practice.expandtesting.com/dynamic-pagination-table?utm_medium=referral",
        pageIdentityKey: "/dynamic-pagination-table",
        fieldIdentityKey: structuralFieldIdentity,
      }),
    ).resolves.toEqual({
      siteId: "expandtesting.com",
      pageProfileId: "page-dynamic-table",
      fieldProfileId: "field-search",
      recognized: true,
    });
  });

  it("migrates schema-v1 data through v2, v3, v4, v5, and v6 with neutral usage counts, revisions, Binding order, and empty matching collections, once and idempotently", async () => {
    const storage = new InMemoryLocalStorage();
    storage.values.fillnestState = {
      schemaVersion: 1,
      sites: [{ id: "example.test" }],
      templates: [
        {
          id: "template-legacy",
          content: "Legacy content",
          siteAffinities: ["example.test"],
          createdAt: "2026-08-01T00:00:00.000Z",
          updatedAt: "2026-08-01T00:00:00.000Z",
        },
      ],
      pageProfiles: [{ id: "page-legacy", siteId: "example.test", identityKey: "/legacy" }],
      fieldProfiles: [{ id: "field-legacy", pageProfileId: "page-legacy" }],
      bindings: [
        {
          id: "binding-legacy",
          templateId: "template-legacy",
          pageProfileId: "page-legacy",
          fieldProfileId: "field-legacy",
          createdAt: "2026-08-01T00:00:00.000Z",
        },
      ],
    };
    const repository = new FillNestRepository(storage);

    const migrated = await repository.read();

    expect(migrated).toEqual({
      schemaVersion: 13,
      compatibilityPairDecisions: [],
      sites: [{ id: "example.test" }],
      templates: [
        expect.objectContaining({ id: "template-legacy", totalUsageCount: 0, revision: 0 }),
      ],
      pageProfiles: [{ id: "page-legacy", siteId: "example.test", identityKey: "/legacy" }],
      fieldProfiles: [{ id: "field-legacy", pageProfileId: "page-legacy" }],
      bindings: [expect.objectContaining({ id: "binding-legacy", usageCount: 0, revision: 0 })],
      logicalPageSiteKeys: [],
      logicalPageRules: [],
      logicalPageProvenance: [],
      logicalPageObservations: [],
      sharedTemplateSets: [],
      sharedTemplateBindings: [],
      sharedTemplateFieldStates: [],
      pickerPosition: null,
      pageStatusPosition: null,
    });
    expect(storage.values.fillnestState).toEqual(migrated);
    expect(storage.setCount).toBe(1);

    const secondRead = await repository.read();
    expect(secondRead).toEqual(migrated);
    expect(storage.setCount).toBe(1);
  });

  it("migrates schema-v3 data to v4 by assigning each Field's Bindings a dense sequential order, grouped independently per Field", async () => {
    const storage = new InMemoryLocalStorage();
    storage.values.fillnestState = {
      schemaVersion: 3,
      sites: [{ id: "example.test" }],
      templates: [
        { id: "t1", content: "First", siteAffinities: ["example.test"], createdAt: "x", updatedAt: "x", totalUsageCount: 0, revision: 0 },
        { id: "t2", content: "Second", siteAffinities: ["example.test"], createdAt: "x", updatedAt: "x", totalUsageCount: 0, revision: 0 },
        { id: "t3", content: "Third", siteAffinities: ["example.test"], createdAt: "x", updatedAt: "x", totalUsageCount: 0, revision: 0 },
      ],
      pageProfiles: [{ id: "page-1", siteId: "example.test" }],
      fieldProfiles: [
        { id: "field-a", pageProfileId: "page-1" },
        { id: "field-b", pageProfileId: "page-1" },
      ],
      bindings: [
        { id: "b1", templateId: "t1", pageProfileId: "page-1", fieldProfileId: "field-a", createdAt: "x", usageCount: 0, revision: 0 },
        { id: "b2", templateId: "t2", pageProfileId: "page-1", fieldProfileId: "field-b", createdAt: "x", usageCount: 0, revision: 0 },
        { id: "b3", templateId: "t3", pageProfileId: "page-1", fieldProfileId: "field-a", createdAt: "x", usageCount: 0, revision: 0 },
      ],
    };
    const repository = new FillNestRepository(storage);

    const migrated = await repository.read();

    expect(migrated.bindings).toEqual([
      expect.objectContaining({ id: "b1", fieldProfileId: "field-a" }),
      expect.objectContaining({ id: "b2", fieldProfileId: "field-b" }),
      expect.objectContaining({ id: "b3", fieldProfileId: "field-a" }),
    ]);
  });

  it("folds a pre-Slice-1 standalone floating position into the migrated v2 state", async () => {
    const storage = new InMemoryLocalStorage();
    storage.values.fillnestState = {
      schemaVersion: 1,
      sites: [],
      templates: [],
      pageProfiles: [],
      fieldProfiles: [],
      bindings: [],
    };
    storage.values.fillnestPickerPosition = { top: 40, left: 120 };
    const repository = new FillNestRepository(storage);

    const migrated = await repository.read();

    expect(migrated.pickerPosition).toEqual({ top: 40, left: 120 });
    await expect(repository.getPickerPosition()).resolves.toEqual({ top: 40, left: 120 });
  });

  it("rejects a Template with a malformed totalUsageCount", async () => {
    const storage = new InMemoryLocalStorage();
    storage.values.fillnestState = {
      schemaVersion: 2,
      sites: [],
      templates: [
        {
          id: "t1",
          content: "x",
          siteAffinities: [],
          createdAt: "x",
          updatedAt: "x",
          totalUsageCount: -1,
        },
      ],
      pageProfiles: [],
      fieldProfiles: [],
      bindings: [],
      pickerPosition: null,
      pageStatusPosition: null,
    };
    const repository = new FillNestRepository(storage);

    await expect(repository.read()).rejects.toBeInstanceOf(InvalidStoredDataError);
  });

  it("rejects a Binding with a malformed usageCount", async () => {
    const storage = new InMemoryLocalStorage();
    storage.values.fillnestState = {
      schemaVersion: 2,
      sites: [],
      templates: [],
      pageProfiles: [],
      fieldProfiles: [],
      bindings: [
        {
          id: "b1",
          templateId: "t1",
          pageProfileId: "p1",
          fieldProfileId: "f1",
          createdAt: "x",
          usageCount: 1.5,
        },
      ],
      pickerPosition: null,
      pageStatusPosition: null,
    };
    const repository = new FillNestRepository(storage);

    await expect(repository.read()).rejects.toBeInstanceOf(InvalidStoredDataError);
  });

  it("rejects a stored floating position with non-finite coordinates", async () => {
    const storage = new InMemoryLocalStorage();
    storage.values.fillnestState = {
      schemaVersion: 2,
      sites: [],
      templates: [],
      pageProfiles: [],
      fieldProfiles: [],
      bindings: [],
      pickerPosition: { top: "40", left: 120 },
      pageStatusPosition: null,
    };
    const repository = new FillNestRepository(storage);

    await expect(repository.read()).rejects.toBeInstanceOf(InvalidStoredDataError);
  });

  it("sets and clears a Page Profile alias without affecting identity or recognition", async () => {
    const storage = new InMemoryLocalStorage();
    let nextId = 1;
    const repository = new FillNestRepository(storage, {
      createId: () => `id-${nextId++}`,
      now: () => "2026-08-16T00:00:00.000Z",
    });
    await repository.createTemplateAndBind({
      content: "Content",
      pageUrl: "https://app.example.test/customers/first-record/edit",
      pageProfileId: "page-1",
      fieldProfileId: "field-1",
      pageIdentityKey: "/customers/:record/edit",
      fieldIdentityKey: '{"semanticKind":"email"}',
    });

    const aliased = await repository.setPageAlias({ pageProfileId: "page-1", alias: "  My customers  " });
    expect(aliased.userAlias).toBe("My customers");

    const resolvedWhileAliased = await repository.resolveFieldContext({
      pageUrl: "https://app.example.test/customers/second-record/edit",
      pageIdentityKey: "/customers/:record/edit",
      fieldIdentityKey: '{"semanticKind":"email"}',
    });
    expect(resolvedWhileAliased).toEqual({
      siteId: "example.test",
      pageProfileId: "page-1",
      fieldProfileId: "field-1",
      recognized: true,
    });

    const cleared = await repository.setPageAlias({ pageProfileId: "page-1", alias: "   " });
    expect(cleared.userAlias).toBeUndefined();
    expect(Object.hasOwn(cleared, "userAlias")).toBe(false);
  });

  it("sets and clears a Field Profile alias without affecting identity or recognition", async () => {
    const storage = new InMemoryLocalStorage();
    let nextId = 1;
    const repository = new FillNestRepository(storage, {
      createId: () => `id-${nextId++}`,
      now: () => "2026-08-16T00:00:00.000Z",
    });
    await repository.createTemplateAndBind({
      content: "Content",
      pageUrl: "https://app.example.test/customers/first-record/edit",
      pageProfileId: "page-2",
      fieldProfileId: "field-2",
      pageIdentityKey: "/customers/:record/edit",
      fieldIdentityKey: '{"semanticKind":"email"}',
    });

    const aliased = await repository.setFieldAlias({ fieldProfileId: "field-2", alias: "Work email" });
    expect(aliased.userAlias).toBe("Work email");

    const resolvedWhileAliased = await repository.resolveFieldContext({
      pageUrl: "https://app.example.test/customers/second-record/edit",
      pageIdentityKey: "/customers/:record/edit",
      fieldIdentityKey: '{"semanticKind":"email"}',
    });
    expect(resolvedWhileAliased.recognized).toBe(true);

    const cleared = await repository.setFieldAlias({ fieldProfileId: "field-2", alias: "" });
    expect(cleared.userAlias).toBeUndefined();
  });

  it("creates a missing Field Profile when the user aliases a live identified Field", async () => {
    const storage = new InMemoryLocalStorage();
    const repository = new FillNestRepository(storage);

    const aliased = await repository.setFieldAlias({
      fieldProfileId: "field-live",
      alias: "Emergency contact name",
      newField: {
        pageUrl: "https://app.example.test/profile",
        pageProfileId: "page-live",
        fieldProfileId: "field-live",
        pageIdentityKey: "/profile",
        fieldIdentityKey: '{"semanticKind":"name"}',
        fieldDocumentOrder: 3,
        fieldObservedTitle: "Name",
      },
    });

    expect(aliased).toMatchObject({
      id: "field-live",
      pageProfileId: "page-live",
      userAlias: "Emergency contact name",
      identityKey: '{"semanticKind":"name"}',
      observedTitle: "Name",
    });
    await expect(repository.read()).resolves.toMatchObject({
      sites: [{ id: "example.test" }],
      pageProfiles: [{ id: "page-live", siteId: "example.test", identityKey: "/profile" }],
      fieldProfiles: [expect.objectContaining({ id: "field-live", userAlias: "Emergency contact name" })],
    });
  });

  it("rejects setting an alias on a Page Profile that does not exist", async () => {
    const storage = new InMemoryLocalStorage();
    const repository = new FillNestRepository(storage);

    await expect(
      repository.setPageAlias({ pageProfileId: "missing", alias: "Anything" }),
    ).rejects.toThrow("Page Profile not found: missing");
  });

  it("records a bound insertion by incrementing both Template total and Binding usage exactly once", async () => {
    const storage = new InMemoryLocalStorage();
    let nextId = 1;
    const repository = new FillNestRepository(storage, {
      createId: () => `id-${nextId++}`,
      now: () => "2026-08-16T00:00:00.000Z",
    });
    const { template, binding } = await repository.createTemplateAndBind({
      content: "Reusable reply",
      pageUrl: "https://app.example.test/profile",
      pageProfileId: "page-1",
      fieldProfileId: "field-1",
    });
    expect(template.totalUsageCount).toBe(0);
    expect(binding.usageCount).toBe(0);

    await repository.recordInsertion({ templateId: template.id, fieldProfileId: "field-1" });

    const state = await repository.read();
    expect(state.templates[0]).toEqual(expect.objectContaining({ totalUsageCount: 1 }));
    expect(state.bindings[0]).toEqual(expect.objectContaining({ usageCount: 1 }));
  });

  it("records an unbound Search insertion by incrementing only the Template total", async () => {
    const storage = new InMemoryLocalStorage();
    let nextId = 1;
    const repository = new FillNestRepository(storage, {
      createId: () => `id-${nextId++}`,
      now: () => "2026-08-16T00:00:00.000Z",
    });
    const template = await repository.createTemplate({
      content: "Global note",
      pageUrl: "https://app.example.test/profile",
    });

    await repository.recordInsertion({ templateId: template.id, fieldProfileId: "field-unbound" });

    const state = await repository.read();
    expect(state.templates[0]).toEqual(expect.objectContaining({ totalUsageCount: 1 }));
    expect(state.bindings).toEqual([]);
  });

  it("increments Binding usage exactly once per insertion across repeated insertions", async () => {
    const storage = new InMemoryLocalStorage();
    let nextId = 1;
    const repository = new FillNestRepository(storage, {
      createId: () => `id-${nextId++}`,
      now: () => "2026-08-16T00:00:00.000Z",
    });
    const { template } = await repository.createTemplateAndBind({
      content: "Reusable reply",
      pageUrl: "https://app.example.test/profile",
      pageProfileId: "page-1",
      fieldProfileId: "field-1",
    });

    for (let index = 0; index < 3; index += 1) {
      await repository.recordInsertion({ templateId: template.id, fieldProfileId: "field-1" });
    }

    const state = await repository.read();
    expect(state.templates[0]).toEqual(expect.objectContaining({ totalUsageCount: 3 }));
    expect(state.bindings[0]).toEqual(expect.objectContaining({ usageCount: 3 }));
  });

  it("serializes concurrent insertions so no increment is lost", async () => {
    const storage = new InMemoryLocalStorage();
    let nextId = 1;
    const repository = new FillNestRepository(storage, {
      createId: () => `id-${nextId++}`,
      now: () => "2026-08-16T00:00:00.000Z",
    });
    const { template } = await repository.createTemplateAndBind({
      content: "Reusable reply",
      pageUrl: "https://app.example.test/profile",
      pageProfileId: "page-1",
      fieldProfileId: "field-1",
    });

    await Promise.all(
      Array.from({ length: 10 }, () =>
        repository.recordInsertion({ templateId: template.id, fieldProfileId: "field-1" }),
      ),
    );

    const state = await repository.read();
    expect(state.templates[0]).toEqual(expect.objectContaining({ totalUsageCount: 10 }));
    expect(state.bindings[0]).toEqual(expect.objectContaining({ usageCount: 10 }));
  });

  it("recording an insertion for an already-deleted Template is a safe no-op (idempotent under a lost race)", async () => {
    const storage = new InMemoryLocalStorage();
    let nextId = 1;
    const repository = new FillNestRepository(storage, {
      createId: () => `id-${nextId++}`,
      now: () => "2026-08-16T00:00:00.000Z",
    });
    const template = await repository.createTemplate({
      content: "Content",
      pageUrl: "https://app.example.test/profile",
    });
    await repository.deleteTemplate({ templateId: template.id });

    await expect(
      repository.recordInsertion({ templateId: template.id, fieldProfileId: "field-1" }),
    ).resolves.toBe(false);
    const state = await repository.read();
    expect(state.templates).toEqual([]);
  });

  // Regression: nextBindingOrder used to compute a new Binding's order as a
  // plain count of the Field's existing Bindings. Unbinding a Binding that
  // isn't the last one leaves a gap (e.g. orders [0,1,2] minus the middle
  // one is [0,2], not [0,1]) without reindexing, so the next count-based
  // Bind on that Field collided with an order that already existed. This is
  // exactly the case the new order-uniqueness invariant in
  // validateCandidateInvariants would otherwise reject.

  it("rebinding after Unbind starts the new Binding's usage count back at 0 and never resets the Template total", async () => {
    const storage = new InMemoryLocalStorage();
    let nextId = 1;
    const repository = new FillNestRepository(storage, {
      createId: () => `id-${nextId++}`,
      now: () => "2026-08-16T00:00:00.000Z",
    });
    const { template } = await repository.createTemplateAndBind({
      content: "Reusable reply",
      pageUrl: "https://app.example.test/profile",
      pageProfileId: "page-1",
      fieldProfileId: "field-1",
    });
    await repository.recordInsertion({ templateId: template.id, fieldProfileId: "field-1" });
    await repository.recordInsertion({ templateId: template.id, fieldProfileId: "field-1" });
    await repository.unbindTemplate({ templateId: template.id, fieldProfileId: "field-1" });

    const rebound = await repository.bindTemplate({
      templateId: template.id,
      pageUrl: "https://app.example.test/profile",
      pageProfileId: "page-1",
      fieldProfileId: "field-1",
    });

    expect(rebound.usageCount).toBe(0);
    const state = await repository.read();
    expect(state.templates[0]).toEqual(expect.objectContaining({ totalUsageCount: 2 }));
    expect(state.bindings).toEqual([expect.objectContaining({ id: "id-3", usageCount: 0 })]);
  });

  it("editing a Template's content never changes its usage counts", async () => {
    const storage = new InMemoryLocalStorage();
    let nextId = 1;
    const repository = new FillNestRepository(storage, {
      createId: () => `id-${nextId++}`,
      now: () => "2026-08-16T00:00:00.000Z",
    });
    const created = await repository.createTemplate({
      content: "Original",
      pageUrl: "https://app.example.test/profile",
    });
    await repository.recordInsertion({ templateId: created.id, fieldProfileId: "field-1" });

    const updated = await repository.updateTemplate({ templateId: created.id, content: "Edited" });

    expect(updated.totalUsageCount).toBe(1);
  });

  it("Delete Undo (restoreTemplate) restores the exact prior usage counts, not zeros", async () => {
    const storage = new InMemoryLocalStorage();
    let nextId = 1;
    const repository = new FillNestRepository(storage, {
      createId: () => `id-${nextId++}`,
      now: () => "2026-08-16T00:00:00.000Z",
    });
    const { template, binding } = await repository.createTemplateAndBind({
      content: "Reusable reply",
      pageUrl: "https://app.example.test/profile",
      pageProfileId: "page-1",
      fieldProfileId: "field-1",
    });
    await repository.recordInsertion({ templateId: template.id, fieldProfileId: "field-1" });
    await repository.recordInsertion({ templateId: template.id, fieldProfileId: "field-1" });
    const beforeDelete = await repository.read();
    const snapshotTemplate = beforeDelete.templates.find((candidate) => candidate.id === template.id)!;
    const snapshotBinding = beforeDelete.bindings.find((candidate) => candidate.id === binding.id)!;
    expect(snapshotTemplate.totalUsageCount).toBe(2);
    expect(snapshotBinding.usageCount).toBe(2);

    await repository.deleteTemplate({ templateId: template.id });
    const restored = await repository.restoreTemplate({
      template: snapshotTemplate,
      bindings: [snapshotBinding],
    });

    expect(restored.totalUsageCount).toBe(2);
    const state = await repository.read();
    expect(state.bindings).toEqual([expect.objectContaining({ usageCount: 2 })]);
  });

  it("deleteTemplates removes multiple Templates and all of their Bindings atomically, skipping IDs that no longer exist", async () => {
    const storage = new InMemoryLocalStorage();
    const ids = ["template-1", "binding-1", "template-2", "binding-2", "template-3"];
    const repository = new FillNestRepository(storage, {
      createId: () => ids.shift() ?? "unexpected-id",
      now: () => "2026-08-16T00:00:00.000Z",
    });
    const first = await repository.createTemplateAndBind({
      content: "First",
      pageUrl: "https://app.example.test/profile",
      pageProfileId: "page-1",
      fieldProfileId: "field-1",
    });
    const second = await repository.createTemplateAndBind({
      content: "Second",
      pageUrl: "https://app.example.test/profile",
      pageProfileId: "page-1",
      fieldProfileId: "field-2",
    });
    const third = await repository.createTemplate({
      content: "Untouched",
      pageUrl: "https://app.example.test/profile",
    });

    const result = await repository.deleteTemplates({
      templateIds: [first.template.id, second.template.id, "does-not-exist"],
    });

    expect(result.deletedTemplateIds.sort()).toEqual([first.template.id, second.template.id].sort());
    const state = await repository.read();
    expect(state.templates).toEqual([expect.objectContaining({ id: third.id })]);
    expect(state.bindings).toEqual([]);
  });

  it("clearSiteData removes mappings and the selected Site Affinity while preserving Templates and other Sites", async () => {
    const storage = new InMemoryLocalStorage();
    const ids = ["template-1", "binding-1", "template-2", "binding-2"];
    const repository = new FillNestRepository(storage, {
      createId: () => ids.shift() ?? "unexpected-id",
      now: () => "2026-08-17T00:00:00.000Z",
    });
    const first = await repository.createTemplateAndBind({
      content: "Example reply",
      pageUrl: "https://app.example.test/profile",
      pageProfileId: "page-example",
      fieldProfileId: "field-example",
    });
    await repository.setPageAlias({ pageProfileId: "page-example", alias: "Profile page" });
    await repository.setFieldAlias({ fieldProfileId: "field-example", alias: "Notes" });
    const second = await repository.createTemplateAndBind({
      content: "Other reply",
      pageUrl: "https://other.test/profile",
      pageProfileId: "page-other",
      fieldProfileId: "field-other",
    });

    const result = await repository.resetSiteMappingsBatch({ sites: [{ siteId: "example.test" }] });

    expect(result).toEqual({
      pageProfileIds: ["page-example"],
      fieldProfileIds: ["field-example"],
      bindingIds: [first.binding.id],
      newlyGlobalTemplates: [expect.objectContaining({ id: "template-1", siteAffinities: [] })],
      endedSharedTemplateSetCount: 0,
      didMutate: true,
    });
    const state = await repository.read();
    // Both Templates and both Sites survive, but example.test is removed from
    // its Template's filing relationship and the formerly site-only Template
    // becomes Global.
    expect(state.templates.map((template) => template.id).sort()).toEqual(["template-1", "template-2"]);
    expect(state.templates.find((template) => template.id === "template-1")?.siteAffinities).toEqual([]);
    expect(state.sites.map((site) => site.id).sort()).toEqual(["example.test", "other.test"]);
    // example.test's Page/Field Profile (and their aliases) and Binding are gone...
    expect(state.pageProfiles.find((page) => page.id === "page-example")).toBeUndefined();
    expect(state.fieldProfiles.find((field) => field.id === "field-example")).toBeUndefined();
    expect(state.bindings.find((binding) => binding.id === first.binding.id)).toBeUndefined();
    // ...while other.test's own Page/Field Profile and Binding are untouched.
    expect(state.pageProfiles.find((page) => page.id === "page-other")).toEqual(
      expect.objectContaining({ id: "page-other", siteId: "other.test" }),
    );
    expect(state.bindings.find((binding) => binding.id === second.binding.id)).toBeTruthy();
  });

  it("clearSiteData removes the Site's confirmed Logical Page Matching rules, provenance, and Site key while preserving another Site's", async () => {
    const storage = new InMemoryLocalStorage();
    const repository = new FillNestRepository(storage);
    await repository.replaceState({
      ...baseLogicalPageState,
      sites: [{ id: "example.test" }, { id: "other.test" }],
      pageProfiles: [
        ...baseLogicalPageState.pageProfiles,
        { id: "page-other", siteId: "other.test", identityKey: "/customers/999" },
      ],
      fieldProfiles: [
        ...baseLogicalPageState.fieldProfiles,
        { id: "field-other", pageProfileId: "page-other", identityKey: "field-x" },
      ],
      bindings: [
        ...baseLogicalPageState.bindings,
        { id: "binding-other", templateId: "template-1", pageProfileId: "page-other", fieldProfileId: "field-other", createdAt: "x", usageCount: 0, revision: 0 },
      ],
      logicalPageSiteKeys: [
        ...baseLogicalPageState.logicalPageSiteKeys,
        { id: "site-key-other", siteId: "other.test", encodedHmacKey: "hmac-sha256-v1:BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB" },
      ],
      logicalPageRules: [
        {
          id: "rule-example",
          siteId: "example.test",
          siteKeyId: "site-key-1",
          origin: "https://forms.example.test",
          routePattern: "/customers/:number",
          fieldFeatureHashes: ["a".repeat(64)],
          groupedFieldFeatureHashes: ["b".repeat(64)],
          pageProfileId: "page-1",
        },
        {
          id: "rule-other",
          siteId: "other.test",
          siteKeyId: "site-key-other",
          origin: "https://forms.other.test",
          routePattern: "/customers/:number",
          fieldFeatureHashes: ["c".repeat(64)],
          groupedFieldFeatureHashes: ["d".repeat(64)],
          pageProfileId: "page-other",
        },
      ],
      logicalPageProvenance: [{
        id: "provenance-example",
        ruleId: "rule-example",
        origin: "https://forms.example.test",
        sourcePageProfileId: "page-1",
        canonicalPageProfileId: "page-1",
        fieldMappings: [{
          sourceFieldProfileId: "field-1",
          canonicalFieldProfileId: "field-1",
          bindingIds: ["binding-1"],
        }],
      }],
    });

    const result = await repository.resetSiteMappingsBatch({ sites: [{ siteId: "example.test" }] });
    expect(result.didMutate).toBe(true);

    const state = await repository.read();
    expect(state.logicalPageRules.map((rule) => rule.id)).toEqual(["rule-other"]);
    expect(state.logicalPageProvenance).toEqual([]);
    expect(state.logicalPageSiteKeys.map((key) => key.siteId)).toEqual(["other.test"]);
  });

  it("resetSiteMappings' actual scope always matches computeResetSiteMappingsImpact's preview for the same state (single source of truth, cannot drift)", async () => {
    const storage = new InMemoryLocalStorage();
    const ids = ["template-1", "binding-1", "template-2", "binding-2"];
    const repository = new FillNestRepository(storage, {
      createId: () => ids.shift() ?? "unexpected-id",
      now: () => "2026-08-17T00:00:00.000Z",
    });
    await repository.createTemplateAndBind({
      content: "Example reply",
      pageUrl: "https://app.example.test/profile",
      pageProfileId: "page-example",
      fieldProfileId: "field-example",
    });
    await repository.setPageAlias({ pageProfileId: "page-example", alias: "Profile page" });
    await repository.setFieldAlias({ fieldProfileId: "field-example", alias: "Notes" });
    await repository.createTemplateAndBind({
      content: "Other reply",
      pageUrl: "https://other.test/profile",
      pageProfileId: "page-other",
      fieldProfileId: "field-other",
    });

    // What the UI would show the user before they confirm the Reset...
    const preview = computeResetSiteMappingsImpact(await repository.read(), "example.test");
    // ...must equal what the mutation itself actually removes. If either
    // side ever re-derives this scope independently instead of sharing
    // `deriveSiteMappingScope`, this assertion is what would catch the drift.
    const result = await repository.resetSiteMappingsBatch({ sites: [{ siteId: "example.test" }] });

    expect(result.pageProfileIds.length).toBe(preview.pageProfileCount);
    expect(result.fieldProfileIds.length).toBe(preview.fieldProfileCount);
    expect(result.bindingIds.length).toBe(preview.bindingCount);
    expect(preview.pageAliasCount).toBe(1);
    expect(preview.fieldAliasCount).toBe(1);
  });

  it("resetSiteMappings fails closed when the confirmed impact changed before execution", async () => {
    const storage = new InMemoryLocalStorage();
    const ids = ["template-1", "binding-1", "template-2", "binding-2"];
    const repository = new FillNestRepository(storage, {
      createId: () => ids.shift() ?? "unexpected-id",
      now: () => "2026-08-17T00:00:00.000Z",
    });
    await repository.createTemplateAndBind({
      content: "Example reply",
      pageUrl: "https://app.example.test/profile",
      pageProfileId: "page-example",
      fieldProfileId: "field-example",
    });
    const preview = computeResetSiteMappingsImpact(await repository.read(), "example.test");

    await repository.createTemplateAndBind({
      content: "New mapping after preview",
      pageUrl: "https://app.example.test/profile",
      pageProfileId: "page-example",
      fieldProfileId: "field-new",
    });

    await expect(
      repository.resetSiteMappingsBatch({
        sites: [{ siteId: "example.test", expectedImpact: preview }],
      }),
    ).rejects.toBeInstanceOf(StaleImpactError);

    const state = await repository.read();
    expect(state.pageProfiles).toHaveLength(1);
    expect(state.fieldProfiles).toHaveLength(2);
    expect(state.bindings).toHaveLength(2);
  });

  it("resetSiteMappingsBatch fails closed without partially clearing any Site when one confirmed impact is stale", async () => {
    const storage = new InMemoryLocalStorage();
    const ids = ["template-1", "binding-1", "template-2", "binding-2", "template-3", "binding-3"];
    const repository = new FillNestRepository(storage, {
      createId: () => ids.shift() ?? "unexpected-id",
      now: () => "2026-08-17T00:00:00.000Z",
    });
    await repository.createTemplateAndBind({
      content: "Example reply",
      pageUrl: "https://app.example.test/profile",
      pageProfileId: "page-example",
      fieldProfileId: "field-example",
    });
    await repository.createTemplateAndBind({
      content: "Other reply",
      pageUrl: "https://other.test/profile",
      pageProfileId: "page-other",
      fieldProfileId: "field-other",
    });
    const examplePreview = computeResetSiteMappingsImpact(await repository.read(), "example.test");
    const otherPreview = computeResetSiteMappingsImpact(await repository.read(), "other.test");

    await repository.createTemplateAndBind({
      content: "Other late mapping",
      pageUrl: "https://other.test/profile",
      pageProfileId: "page-other",
      fieldProfileId: "field-late",
    });

    await expect(
      repository.resetSiteMappingsBatch({
        sites: [
          { siteId: "example.test", expectedImpact: examplePreview },
          { siteId: "other.test", expectedImpact: otherPreview },
        ],
      }),
    ).rejects.toBeInstanceOf(StaleImpactError);

    const state = await repository.read();
    expect(state.pageProfiles.map((page) => page.id).sort()).toEqual(["page-example", "page-other"]);
    expect(state.fieldProfiles.map((field) => field.id).sort()).toEqual([
      "field-example",
      "field-late",
      "field-other",
    ]);
    expect(state.bindings).toHaveLength(3);
  });

  it("resetSiteMappings is a no-op that returns empty arrays for a Site with no mapping data", async () => {
    const storage = new InMemoryLocalStorage();
    const repository = new FillNestRepository(storage);

    const result = await repository.resetSiteMappingsBatch({ sites: [{ siteId: "empty.test" }] });

    expect(result).toEqual({ pageProfileIds: [], fieldProfileIds: [], bindingIds: [], newlyGlobalTemplates: [], endedSharedTemplateSetCount: 0, didMutate: false });
    expect(storage.setCount).toBe(0);
  });

  it("clearSiteData removes every selected Site Affinity and deletes only its exact newly-Global result", async () => {
    const storage = new InMemoryLocalStorage();
    const ids = ["template-1", "binding-1", "binding-2"];
    const repository = new FillNestRepository(storage, {
      createId: () => ids.shift() ?? "unexpected-id",
      now: () => "2026-08-25T00:00:00.000Z",
    });
    const created = await repository.createTemplateAndBind({
      content: "Shared reply",
      pageUrl: "https://app.example.test/profile",
      pageProfileId: "page-example",
      fieldProfileId: "field-example",
    });
    await repository.bindTemplate({
      templateId: created.template.id,
      pageUrl: "https://other.test/profile",
      pageProfileId: "page-other",
      fieldProfileId: "field-other",
    });

    const firstClear = await repository.resetSiteMappingsBatch({ sites: [{ siteId: "example.test" }] });
    expect(firstClear.newlyGlobalTemplates).toEqual([]);
    expect((await repository.read()).templates[0]?.siteAffinities).toEqual(["other.test"]);

    const secondClear = await repository.resetSiteMappingsBatch({ sites: [{ siteId: "other.test" }] });
    const newlyGlobal = secondClear.newlyGlobalTemplates[0];
    expect(newlyGlobal).toEqual(expect.objectContaining({ id: created.template.id, siteAffinities: [] }));

    await repository.deleteNewlyGlobalTemplates({
      templates: [{ id: newlyGlobal!.id, expectedRevision: newlyGlobal!.revision }],
    });
    expect((await repository.read()).templates).toEqual([]);
  });

  it("clears a shared Template Affinity even when that Site has no saved field records", async () => {
    const storage = new InMemoryLocalStorage();
    const ids = ["template-1", "binding-1", "binding-2"];
    const repository = new FillNestRepository(storage, {
      createId: () => ids.shift() ?? "unexpected-id",
      now: () => "2026-08-25T00:00:00.000Z",
    });
    const created = await repository.createTemplateAndBind({
      content: "Shared reply",
      pageUrl: "https://app.example.test/profile",
      pageProfileId: "page-example",
      fieldProfileId: "field-example",
    });
    await repository.bindTemplate({
      templateId: created.template.id,
      pageUrl: "https://other.test/profile",
      pageProfileId: "page-other",
      fieldProfileId: "field-other",
    });
    const state = await repository.read();
    storage.values.fillnestState = { ...state, pageProfiles: [], fieldProfiles: [], bindings: [] };
    storage.setCount = 0;

    const result = await repository.resetSiteMappingsBatch({ sites: [{ siteId: "example.test" }] });

    expect(result).toEqual(expect.objectContaining({ didMutate: true, newlyGlobalTemplates: [] }));
    expect((await repository.read()).templates[0]?.siteAffinities).toEqual(["other.test"]);
    expect(storage.setCount).toBe(1);
  });

  it("refuses a newly-Global delete after any later Template mutation", async () => {
    const storage = new InMemoryLocalStorage();
    const ids = ["template-1", "binding-1"];
    const repository = new FillNestRepository(storage, {
      createId: () => ids.shift() ?? "unexpected-id",
      now: () => "2026-08-25T00:00:00.000Z",
    });
    const created = await repository.createTemplateAndBind({
      content: "Site-only reply",
      pageUrl: "https://app.example.test/profile",
      pageProfileId: "page-example",
      fieldProfileId: "field-example",
    });
    const cleared = await repository.resetSiteMappingsBatch({ sites: [{ siteId: "example.test" }] });
    const newlyGlobal = cleared.newlyGlobalTemplates[0]!;
    await repository.updateTemplate({ templateId: created.template.id, content: "Changed after clear" });

    await expect(
      repository.deleteNewlyGlobalTemplates({
        templates: [{ id: newlyGlobal.id, expectedRevision: newlyGlobal.revision }],
      }),
    ).rejects.toBeInstanceOf(StaleUndoError);
    expect((await repository.read()).templates).toHaveLength(1);
  });

  it("saves and undoes a Template copy for a Shared Template Set without changing dormant direct Bindings", async () => {
    const storage = new InMemoryLocalStorage();
    const ids = ["copy-template", "copy-shared-binding", "changed-copy-template", "changed-copy-binding"];
    const repository = new FillNestRepository(storage, {
      createId: () => ids.shift() ?? "unexpected-id",
      now: () => "2026-09-04T00:00:00.000Z",
    });
    const originalSharedBinding = {
      id: "shared-original",
      setId: "set-1",
      templateId: "template-original",
      usageCount: 4,
      revision: 2,
      order: 1,
    };
    const dormantBinding = {
      id: "dormant-field-binding",
      templateId: "template-original",
      pageProfileId: "page-1",
      fieldProfileId: "field-1",
      createdAt: "x",
      usageCount: 7,
      revision: 0,
    };
    await repository.replaceState({
      schemaVersion: 13,
      compatibilityPairDecisions: [],
      sites: [{ id: "example.test" }, { id: "other.test" }],
      templates: [{ id: "template-original", content: "Original", siteAffinities: ["example.test", "other.test"], createdAt: "x", updatedAt: "x", totalUsageCount: 9, revision: 3 }],
      pageProfiles: [{ id: "page-1", siteId: "example.test" }, { id: "page-2", siteId: "other.test" }],
      fieldProfiles: [{ id: "field-1", pageProfileId: "page-1" }, { id: "field-2", pageProfileId: "page-2" }],
      bindings: [dormantBinding],
      sharedTemplateSets: [{ id: "set-1", siteId: "example.test", name: "Names", memberFieldProfileIds: ["field-1", "field-2"] }],
      sharedTemplateBindings: [originalSharedBinding],
      sharedTemplateFieldStates: [],
      logicalPageSiteKeys: [],
      logicalPageRules: [],
      logicalPageProvenance: [],
      logicalPageObservations: [],
      pickerPosition: null,
      pageStatusPosition: null,
    });

    const result = await repository.saveTemplateCopyForSharedSet({
      slotId: originalSharedBinding.id,
      setId: "set-1",
      content: "Shared-set copy",
    });
    expect(result.template).toMatchObject({
      id: "copy-template",
      content: "Shared-set copy",
      siteAffinities: ["example.test", "other.test"],
      totalUsageCount: 0,
    });
    // Task 026: a Set-level copy keeps the existing slot's own id - it does
    // not destroy that slot identity, so a member's Override/Exclusion keyed
    // by it survives the swap.
    expect(result.sharedBinding).toEqual({
      id: originalSharedBinding.id,
      setId: "set-1",
      templateId: "copy-template",
      usageCount: 0,
      revision: 0,
      order: 1,
    });
    await expect(repository.read()).resolves.toMatchObject({
      bindings: [dormantBinding],
      sharedTemplateBindings: [result.sharedBinding],
    });

    await repository.undoSaveTemplateCopyForSharedSet({
      copyTemplateId: result.template.id,
      originalSharedBinding,
    });
    await expect(repository.read()).resolves.toMatchObject({
      templates: [expect.objectContaining({ id: "template-original" })],
      bindings: [dormantBinding],
      sharedTemplateBindings: [originalSharedBinding],
    });

    const changedCopy = await repository.saveTemplateCopyForSharedSet({
      slotId: originalSharedBinding.id,
      setId: "set-1",
      content: "Another shared copy",
    });
    await repository.updateTemplate({ templateId: changedCopy.template.id, content: "Changed later" });
    await expect(
      repository.undoSaveTemplateCopyForSharedSet({
        copyTemplateId: changedCopy.template.id,
        originalSharedBinding,
      }),
    ).rejects.toThrow(StaleUndoError);
  });

  it("deletes and restores a shared Template together with its Shared Binding", async () => {
    const storage = new InMemoryLocalStorage();
    const repository = new FillNestRepository(storage);
    const template = { id: "template-shared", content: "Shared", siteAffinities: ["example.test"], createdAt: "x", updatedAt: "x", totalUsageCount: 0, revision: 0 };
    const sharedBinding = { id: "shared-binding", setId: "set-1", templateId: template.id, usageCount: 2, revision: 0, order: 0 };
    await repository.replaceState({
      schemaVersion: 13,
      compatibilityPairDecisions: [],
      sites: [{ id: "example.test" }],
      templates: [template],
      pageProfiles: [{ id: "page-1", siteId: "example.test" }],
      fieldProfiles: [{ id: "field-1", pageProfileId: "page-1" }, { id: "field-2", pageProfileId: "page-1" }],
      bindings: [],
      sharedTemplateSets: [{ id: "set-1", siteId: "example.test", name: "Fields", memberFieldProfileIds: ["field-1", "field-2"] }],
      sharedTemplateBindings: [sharedBinding],
      sharedTemplateFieldStates: [],
      logicalPageSiteKeys: [],
      logicalPageRules: [],
      logicalPageProvenance: [],
      logicalPageObservations: [],
      pickerPosition: null,
      pageStatusPosition: null,
    });

    await repository.deleteTemplate({ templateId: template.id });
    await expect(repository.read()).resolves.toMatchObject({ templates: [], sharedTemplateBindings: [] });

    await repository.restoreTemplate({ template, bindings: [], sharedBindings: [sharedBinding] });
    await expect(repository.read()).resolves.toMatchObject({
      templates: [template],
      sharedTemplateBindings: [sharedBinding],
    });
  });

  it("records shared insertion usage on the effective Shared Binding, never a dormant direct Binding", async () => {
    const storage = new InMemoryLocalStorage();
    const repository = new FillNestRepository(storage);
    await repository.replaceState({
      schemaVersion: 13,
      compatibilityPairDecisions: [],
      sites: [{ id: "example.test" }],
      templates: [{ id: "template-1", content: "Shared", siteAffinities: ["example.test"], createdAt: "x", updatedAt: "x", totalUsageCount: 0, revision: 0 }],
      pageProfiles: [{ id: "page-1", siteId: "example.test" }],
      fieldProfiles: [{ id: "field-1", pageProfileId: "page-1" }, { id: "field-2", pageProfileId: "page-1" }],
      bindings: [{ id: "dormant", templateId: "template-1", pageProfileId: "page-1", fieldProfileId: "field-1", createdAt: "x", usageCount: 5, revision: 0}],
      sharedTemplateSets: [{ id: "set-1", siteId: "example.test", name: "Fields", memberFieldProfileIds: ["field-1", "field-2"] }],
      sharedTemplateBindings: [{ id: "shared", setId: "set-1", templateId: "template-1", usageCount: 2, revision: 0, order: 0 }],
      sharedTemplateFieldStates: [],
      logicalPageSiteKeys: [],
      logicalPageRules: [],
      logicalPageProvenance: [],
      logicalPageObservations: [],
      pickerPosition: null,
      pageStatusPosition: null,
    });

    await repository.recordInsertion({ templateId: "template-1", fieldProfileId: "field-1" });
    await expect(repository.read()).resolves.toMatchObject({
      templates: [expect.objectContaining({ totalUsageCount: 1 })],
      bindings: [expect.objectContaining({ id: "dormant", usageCount: 5 })],
      sharedTemplateBindings: [expect.objectContaining({ id: "shared", usageCount: 3, revision: 1 })],
    });
  });

  it("restoreTemplates restores the still-valid subset of a batch and reports which records could not be restored", async () => {
    const storage = new InMemoryLocalStorage();
    const ids = ["template-1", "binding-1", "template-2", "binding-2"];
    const repository = new FillNestRepository(storage, {
      createId: () => ids.shift() ?? "unexpected-id",
      now: () => "2026-08-16T00:00:00.000Z",
    });
    const first = await repository.createTemplateAndBind({
      content: "First",
      pageUrl: "https://app.example.test/profile",
      pageProfileId: "page-1",
      fieldProfileId: "field-1",
    });
    const second = await repository.createTemplateAndBind({
      content: "Second",
      pageUrl: "https://app.example.test/profile",
      pageProfileId: "page-1",
      fieldProfileId: "field-2",
    });
    await repository.deleteTemplates({ templateIds: [first.template.id, second.template.id] });

    // Recreate a Template with the same ID as `first` out of band, so that
    // Undo's attempt to restore it now collides and must fail closed for
    // just that one record while still restoring the other.
    const collision = { ...first.template };
    await storage.set({
      fillnestState: {
        ...(await repository.read()),
        templates: [collision],
      },
    });

    const result = await repository.restoreTemplates({
      templates: [
        { template: first.template, bindings: [first.binding] },
        { template: second.template, bindings: [second.binding] },
      ],
    });

    expect(result.restored).toEqual([second.template]);
    expect(result.failed).toEqual([
      { templateId: first.template.id, reason: expect.stringContaining("already exists") },
    ]);
    const state = await repository.read();
    expect(state.templates.map((template) => template.id).sort()).toEqual(
      [first.template.id, second.template.id].sort(),
    );
    expect(state.bindings).toEqual([expect.objectContaining({ id: second.binding.id })]);
  });

  describe("Shared Template Per-Field Overrides (Task 026)", () => {
    async function seedTwoMemberSet(repository: FillNestRepository) {
      await repository.replaceState({
        ...baseLogicalPageState,
        pageProfiles: [
          { id: "page-1", siteId: "example.test" },
          { id: "page-2", siteId: "example.test" },
        ],
        fieldProfiles: [
          { id: "field-a", pageProfileId: "page-1" },
          { id: "field-b", pageProfileId: "page-2" },
        ],
        bindings: [],
        templates: [
          { id: "template-t", content: "T", siteAffinities: ["example.test"], createdAt: "x", updatedAt: "x", totalUsageCount: 0, revision: 0 },
        ],
        sharedTemplateSets: [
          { id: "set-1", siteId: "example.test", name: "Names", memberFieldProfileIds: ["field-a", "field-b"] },
        ],
        sharedTemplateBindings: [
          { id: "slot-1", setId: "set-1", templateId: "template-t", usageCount: 0, revision: 0, order: 0 },
        ],
        sharedTemplateFieldStates: [],
      });
    }

    it("acceptance 1: 'Save for this field' from A produces A's own Override while B still receives the base Template", async () => {
      const storage = new InMemoryLocalStorage();
      const repository = new FillNestRepository(storage);
      await seedTwoMemberSet(repository);

      const result = await repository.saveTemplateOverrideForField({
        setId: "set-1",
        slotId: "slot-1",
        fieldProfileId: "field-a",
        content: "A's own version",
      });
      expect(result.template.content).toBe("A's own version");
      expect(result.state).toMatchObject({
        setId: "set-1",
        slotId: "slot-1",
        fieldProfileId: "field-a",
        mode: "override",
        templateId: result.template.id,
      });

      const state = await repository.read();
      // The base slot itself is untouched - B still resolves to it.
      expect(state.sharedTemplateBindings).toEqual([
        { id: "slot-1", setId: "set-1", templateId: "template-t", usageCount: 0, revision: 0, order: 0 },
      ]);
      expect(state.templates.map((t) => t.id).sort()).toEqual(["template-t", result.template.id].sort());
    });

    it("acceptance 2: a Set-level 'Save for shared fields' changes B's inherited version but leaves A's Override unchanged", async () => {
      const storage = new InMemoryLocalStorage();
      const repository = new FillNestRepository(storage);
      await seedTwoMemberSet(repository);
      const override = await repository.saveTemplateOverrideForField({
        setId: "set-1",
        slotId: "slot-1",
        fieldProfileId: "field-a",
        content: "A's own version",
      });

      const setCopy = await repository.saveTemplateCopyForSharedSet({
        slotId: "slot-1",
        setId: "set-1",
        content: "New shared version for everyone else",
      });
      expect(setCopy.sharedBinding.id).toBe("slot-1");
      expect(setCopy.sharedBinding.templateId).toBe(setCopy.template.id);

      const state = await repository.read();
      const aOverride = state.sharedTemplateFieldStates.find((entry) => entry.fieldProfileId === "field-a");
      expect(aOverride).toMatchObject({ mode: "override", templateId: override.template.id });
      expect(state.templates.find((t) => t.id === override.template.id)?.content).toBe("A's own version");
    });

    it("acceptance 3: removing A's Override records an Exclusion - A gets nothing for that slot, B is unaffected", async () => {
      const storage = new InMemoryLocalStorage();
      const repository = new FillNestRepository(storage);
      await seedTwoMemberSet(repository);
      await repository.saveTemplateOverrideForField({
        setId: "set-1",
        slotId: "slot-1",
        fieldProfileId: "field-a",
        content: "A's own version",
      });

      const result = await repository.excludeSharedTemplateForField({
        setId: "set-1",
        slotId: "slot-1",
        fieldProfileId: "field-a",
      });
      expect(result.state.mode).toBe("exclude");
      expect(result.replacedOverrideTemplateId).not.toBeNull();

      const state = await repository.read();
      const aState = state.sharedTemplateFieldStates.find((entry) => entry.fieldProfileId === "field-a");
      expect(aState).toMatchObject({ mode: "exclude" });
      // B never had a row - it still plainly inherits the slot's base Template.
      expect(state.sharedTemplateFieldStates.some((entry) => entry.fieldProfileId === "field-b")).toBe(false);
    });

    it("allows a direct inherit -> exclude transition with no Override ever created first", async () => {
      const storage = new InMemoryLocalStorage();
      const repository = new FillNestRepository(storage);
      await seedTwoMemberSet(repository);

      const result = await repository.excludeSharedTemplateForField({
        setId: "set-1",
        slotId: "slot-1",
        fieldProfileId: "field-a",
      });
      expect(result.replacedOverrideTemplateId).toBeNull();
      const state = await repository.read();
      expect(state.sharedTemplateFieldStates).toEqual([
        { id: result.state.id, setId: "set-1", slotId: "slot-1", fieldProfileId: "field-a", mode: "exclude" },
      ]);
    });

    it("undoes 'Save for this field', restoring plain inheritance", async () => {
      const storage = new InMemoryLocalStorage();
      const repository = new FillNestRepository(storage);
      await seedTwoMemberSet(repository);
      const result = await repository.saveTemplateOverrideForField({
        setId: "set-1",
        slotId: "slot-1",
        fieldProfileId: "field-a",
        content: "A's own version",
      });

      await repository.undoSaveTemplateOverrideForField({
        copyTemplateId: result.template.id,
        previousState: null,
      });

      const state = await repository.read();
      expect(state.sharedTemplateFieldStates).toEqual([]);
      expect(state.templates.some((t) => t.id === result.template.id)).toBe(false);
    });

    it("undoes an Exclusion that replaced an Override, restoring the exact Override", async () => {
      const storage = new InMemoryLocalStorage();
      const repository = new FillNestRepository(storage);
      await seedTwoMemberSet(repository);
      const override = await repository.saveTemplateOverrideForField({
        setId: "set-1",
        slotId: "slot-1",
        fieldProfileId: "field-a",
        content: "A's own version",
      });
      const stateBeforeExclude = (await repository.read()).sharedTemplateFieldStates.find(
        (entry) => entry.fieldProfileId === "field-a",
      )!;
      await repository.excludeSharedTemplateForField({ setId: "set-1", slotId: "slot-1", fieldProfileId: "field-a" });

      await repository.undoExcludeSharedTemplateForField({
        setId: "set-1",
        slotId: "slot-1",
        fieldProfileId: "field-a",
        previousState: stateBeforeExclude,
      });

      const state = await repository.read();
      expect(state.sharedTemplateFieldStates).toEqual([stateBeforeExclude]);
      expect(state.templates.some((t) => t.id === override.template.id)).toBe(true);
    });

    it("undoes a direct inherit -> exclude, restoring plain inheritance (no row)", async () => {
      const storage = new InMemoryLocalStorage();
      const repository = new FillNestRepository(storage);
      await seedTwoMemberSet(repository);
      await repository.excludeSharedTemplateForField({ setId: "set-1", slotId: "slot-1", fieldProfileId: "field-a" });

      await repository.undoExcludeSharedTemplateForField({
        setId: "set-1",
        slotId: "slot-1",
        fieldProfileId: "field-a",
        previousState: null,
      });

      const state = await repository.read();
      expect(state.sharedTemplateFieldStates).toEqual([]);
    });

    it("records insertion usage on the Field's own Override, never the shared slot it replaced", async () => {
      const storage = new InMemoryLocalStorage();
      const repository = new FillNestRepository(storage);
      await seedTwoMemberSet(repository);
      const override = await repository.saveTemplateOverrideForField({
        setId: "set-1",
        slotId: "slot-1",
        fieldProfileId: "field-a",
        content: "A's own version",
      });

      await repository.recordInsertion({ templateId: override.template.id, fieldProfileId: "field-a" });

      const state = await repository.read();
      expect(state.sharedTemplateBindings[0]?.usageCount).toBe(0);
      const overrideState = state.sharedTemplateFieldStates.find((entry) => entry.fieldProfileId === "field-a");
      expect(overrideState?.usageCount).toBe(1);
      expect(state.templates.find((t) => t.id === override.template.id)?.totalUsageCount).toBe(1);
    });

    // Deletion impact (Confirmed Contract: "Removing or deleting a base
    // Template follows an explicit impact preview... Deleting an Override
    // Template globally follows existing Template deletion rules and
    // removes its dependent Override relationship only after the user sees
    // the Field impact") - deleting a Template that is either a slot's own
    // base or the target of a Field's Override must not leave a dangling
    // sharedTemplateFieldStates row pointing at a Template or slot that no
    // longer exists, which would otherwise corrupt the very next read().
    it("deleting a shared slot's base Template drops every dependent Override/Exclusion for that slot, not just the slot itself", async () => {
      const storage = new InMemoryLocalStorage();
      const repository = new FillNestRepository(storage);
      await seedTwoMemberSet(repository);
      // B excludes the slot directly (never overridden).
      await repository.excludeSharedTemplateForField({ setId: "set-1", slotId: "slot-1", fieldProfileId: "field-b" });

      await repository.deleteTemplate({ templateId: "template-t" });

      const state = await repository.read();
      expect(state.sharedTemplateBindings).toEqual([]);
      expect(state.sharedTemplateFieldStates).toEqual([]);
      expect(state.templates).toEqual([]);
    });

    it("deleting a Field's Override Template drops only that Override, leaving the base slot and other members untouched", async () => {
      const storage = new InMemoryLocalStorage();
      const repository = new FillNestRepository(storage);
      await seedTwoMemberSet(repository);
      const override = await repository.saveTemplateOverrideForField({
        setId: "set-1",
        slotId: "slot-1",
        fieldProfileId: "field-a",
        content: "A's own version",
      });

      await repository.deleteTemplate({ templateId: override.template.id });

      const state = await repository.read();
      expect(state.sharedTemplateBindings).toEqual([
        { id: "slot-1", setId: "set-1", templateId: "template-t", usageCount: 0, revision: 0, order: 0 },
      ]);
      // A's Override relationship is gone entirely (not left dangling); the
      // Confirmed Contract does not require this to silently fall back to
      // inheriting the base slot, only that the dependent row itself never
      // references a deleted Template.
      expect(state.sharedTemplateFieldStates).toEqual([]);
      expect(state.templates.map((t) => t.id)).toEqual(["template-t"]);
    });

    it("batch-deleting a shared slot's base Template also drops its dependent field states", async () => {
      const storage = new InMemoryLocalStorage();
      const repository = new FillNestRepository(storage);
      await seedTwoMemberSet(repository);
      await repository.excludeSharedTemplateForField({ setId: "set-1", slotId: "slot-1", fieldProfileId: "field-b" });

      const result = await repository.deleteTemplates({ templateIds: ["template-t"] });

      expect(result.deletedTemplateIds).toEqual(["template-t"]);
      const state = await repository.read();
      expect(state.sharedTemplateBindings).toEqual([]);
      expect(state.sharedTemplateFieldStates).toEqual([]);
    });
  });

  describe("Explicit Template Audience Scope (Task 027)", () => {
    async function seedTwoMemberSet(repository: FillNestRepository) {
      await repository.replaceState({
        ...baseLogicalPageState,
        pageProfiles: [
          { id: "page-1", siteId: "example.test" },
          { id: "page-2", siteId: "example.test" },
        ],
        fieldProfiles: [
          { id: "field-a", pageProfileId: "page-1" },
          { id: "field-b", pageProfileId: "page-2" },
        ],
        bindings: [],
        templates: [
          { id: "template-t", content: "T", siteAffinities: ["example.test"], createdAt: "x", updatedAt: "x", totalUsageCount: 0, revision: 0 },
        ],
        sharedTemplateSets: [
          { id: "set-1", siteId: "example.test", name: "Names", memberFieldProfileIds: ["field-a", "field-b"] },
        ],
        sharedTemplateBindings: [
          { id: "slot-1", setId: "set-1", templateId: "template-t", usageCount: 0, revision: 0, order: 0 },
        ],
        sharedTemplateFieldStates: [],
      });
    }

    describe("resolver: owner-only visibility", () => {
      it("a Field-only slot resolves only for its owner - not for any other member, current or future", async () => {
        const storage = new InMemoryLocalStorage();
        const repository = new FillNestRepository(storage);
        await seedTwoMemberSet(repository);
        const seeded = await repository.read();
        await repository.replaceState({
          ...seeded,
          templates: [
            ...seeded.templates,
            { id: "template-owner", content: "Owner-only", siteAffinities: ["example.test"], createdAt: "x", updatedAt: "x", totalUsageCount: 0, revision: 0 },
          ],
          sharedTemplateBindings: [
            { id: "slot-1", setId: "set-1", templateId: "template-t", usageCount: 0, revision: 0, order: 0 },
            { id: "slot-owner", setId: "set-1", templateId: "template-owner", usageCount: 0, revision: 0, order: 1, ownerFieldProfileId: "field-a" },
          ],
        });
        const state = await repository.read();
        const aList = effectiveTemplateListForField(state, "field-a");
        expect(aList.entries.filter((entry) => entry.slotId === "slot-owner")).toHaveLength(1);
        expect(aList.entries.find((entry) => entry.slotId === "slot-owner")?.isFieldOnly).toBe(true);
        const bList = effectiveTemplateListForField(state, "field-b");
        expect(bList.entries.filter((entry) => entry.slotId === "slot-owner")).toHaveLength(0);
      });
    });

    describe("createTemplateAndBindSharedFieldOnly (Save for this field, new Template)", () => {
      it("creates a Field-only slot with no Exclusion rows, invisible to the other current member", async () => {
        const storage = new InMemoryLocalStorage();
        const repository = new FillNestRepository(storage);
        await seedTwoMemberSet(repository);

        const result = await repository.createTemplateAndBindSharedFieldOnly({
          setId: "set-1",
          fieldProfileId: "field-a",
          content: "A's private template",
        });
        expect(result.sharedBinding.ownerFieldProfileId).toBe("field-a");

        const state = await repository.read();
        expect(state.sharedTemplateFieldStates).toEqual([]);
        const aList = effectiveTemplateListForField(state, "field-a");
        expect(aList.templateIds).toContain(result.template.id);
        const bList = effectiveTemplateListForField(state, "field-b");
        expect(bList.templateIds).not.toContain(result.template.id);
      });

      it("stays invisible to a Field added to the Set afterward - the original bug this Task closes", async () => {
        const storage = new InMemoryLocalStorage();
        const repository = new FillNestRepository(storage);
        await seedTwoMemberSet(repository);
        const result = await repository.createTemplateAndBindSharedFieldOnly({
          setId: "set-1",
          fieldProfileId: "field-a",
          content: "A's private template",
        });

        await repository.replaceState({
          ...(await repository.read()),
          fieldProfiles: [
            ...(await repository.read()).fieldProfiles,
            { id: "field-c", pageProfileId: "page-1" },
          ],
        });
        await repository.addSharedTemplateSetMember({ setId: "set-1", fieldProfileId: "field-c" });

        const finalState = await repository.read();
        const cList = effectiveTemplateListForField(finalState, "field-c");
        expect(cList.templateIds).not.toContain(result.template.id);
        // C does inherit the ordinary shared slot, just not the Field-only one.
        expect(cList.templateIds).toContain("template-t");
      });

      it("Undo removes the Template and the slot; is stale once either has changed", async () => {
        const storage = new InMemoryLocalStorage();
        const repository = new FillNestRepository(storage);
        await seedTwoMemberSet(repository);
        const result = await repository.createTemplateAndBindSharedFieldOnly({
          setId: "set-1",
          fieldProfileId: "field-a",
          content: "A's private template",
        });

        await repository.undoCreateTemplateAndBindSharedFieldOnly({
          setId: "set-1",
          sharedBindingId: result.sharedBinding.id,
          templateId: result.template.id,
        });
        const state = await repository.read();
        expect(state.templates.map((t) => t.id)).toEqual(["template-t"]);
        expect(state.sharedTemplateBindings).toEqual([
          { id: "slot-1", setId: "set-1", templateId: "template-t", usageCount: 0, revision: 0, order: 0 },
        ]);

        await expect(
          repository.undoCreateTemplateAndBindSharedFieldOnly({
            setId: "set-1",
            sharedBindingId: result.sharedBinding.id,
            templateId: result.template.id,
          }),
        ).rejects.toThrow(StaleUndoError);
      });
    });

    describe("bindTemplateToFieldOnly (Bind to this field)", () => {
      it("creates a Field-only slot for an existing Template found elsewhere, invisible to the other member", async () => {
        const storage = new InMemoryLocalStorage();
        const repository = new FillNestRepository(storage);
        await seedTwoMemberSet(repository);
        const state = await repository.read();
        await repository.replaceState({
          ...state,
          templates: [
            ...state.templates,
            { id: "template-elsewhere", content: "Found via Search", siteAffinities: ["example.test"], createdAt: "x", updatedAt: "x", totalUsageCount: 0, revision: 0 },
          ],
        });

        const result = await repository.bindTemplateToFieldOnly({
          setId: "set-1",
          fieldProfileId: "field-a",
          templateId: "template-elsewhere",
        });
        expect(result.sharedBinding).toMatchObject({ templateId: "template-elsewhere", ownerFieldProfileId: "field-a" });

        const finalState = await repository.read();
        const aList = effectiveTemplateListForField(finalState, "field-a");
        expect(aList.templateIds).toContain("template-elsewhere");
        const bList = effectiveTemplateListForField(finalState, "field-b");
        expect(bList.templateIds).not.toContain("template-elsewhere");
      });

      it("Undo removes exactly that slot and is stale once it no longer exists", async () => {
        const storage = new InMemoryLocalStorage();
        const repository = new FillNestRepository(storage);
        await seedTwoMemberSet(repository);
        const state = await repository.read();
        await repository.replaceState({
          ...state,
          templates: [
            ...state.templates,
            { id: "template-elsewhere", content: "Found via Search", siteAffinities: ["example.test"], createdAt: "x", updatedAt: "x", totalUsageCount: 0, revision: 0 },
          ],
        });
        const result = await repository.bindTemplateToFieldOnly({
          setId: "set-1",
          fieldProfileId: "field-a",
          templateId: "template-elsewhere",
        });

        await repository.undoBindTemplateToFieldOnly({ setId: "set-1", sharedBinding: result.sharedBinding });
        expect((await repository.read()).sharedTemplateBindings).toEqual([
          { id: "slot-1", setId: "set-1", templateId: "template-t", usageCount: 0, revision: 0, order: 0 },
        ]);

        await expect(
          repository.undoBindTemplateToFieldOnly({ setId: "set-1", sharedBinding: result.sharedBinding }),
        ).rejects.toThrow(StaleUndoError);
      });
    });

    describe("promoteFieldOnlySlot (Share this version, same Set)", () => {
      it("strips ownerFieldProfileId so every current member resolves it normally", async () => {
        const storage = new InMemoryLocalStorage();
        const repository = new FillNestRepository(storage);
        await seedTwoMemberSet(repository);
        const created = await repository.createTemplateAndBindSharedFieldOnly({
          setId: "set-1",
          fieldProfileId: "field-a",
          content: "A's private template",
        });

        const promoted = await repository.promoteFieldOnlySlot({
          setId: "set-1",
          slotId: created.sharedBinding.id,
          fieldProfileId: "field-a",
        });
        expect(promoted.sharedBinding.ownerFieldProfileId).toBeUndefined();
        expect(promoted.previousOwnerFieldProfileId).toBe("field-a");

        const state = await repository.read();
        const bList = effectiveTemplateListForField(state, "field-b");
        expect(bList.templateIds).toContain(created.template.id);
      });

      it("rejects promoting a slot that is already shared with everyone", async () => {
        const storage = new InMemoryLocalStorage();
        const repository = new FillNestRepository(storage);
        await seedTwoMemberSet(repository);
        await expect(
          repository.promoteFieldOnlySlot({ setId: "set-1", slotId: "slot-1", fieldProfileId: "field-a" }),
        ).rejects.toThrow();
      });

      it("Undo restores ownerFieldProfileId and is stale once the slot has since changed", async () => {
        const storage = new InMemoryLocalStorage();
        const repository = new FillNestRepository(storage);
        await seedTwoMemberSet(repository);
        const created = await repository.createTemplateAndBindSharedFieldOnly({
          setId: "set-1",
          fieldProfileId: "field-a",
          content: "A's private template",
        });
        const promoted = await repository.promoteFieldOnlySlot({
          setId: "set-1",
          slotId: created.sharedBinding.id,
          fieldProfileId: "field-a",
        });

        await repository.undoPromoteFieldOnlySlot({
          setId: "set-1",
          slotId: created.sharedBinding.id,
          ownerFieldProfileId: "field-a",
          previousSlot: promoted.previousSlot,
        });
        const state = await repository.read();
        expect(state.sharedTemplateBindings.find((b) => b.id === created.sharedBinding.id)?.ownerFieldProfileId).toBe(
          "field-a",
        );

        await expect(
          repository.undoPromoteFieldOnlySlot({
            setId: "set-1",
            slotId: created.sharedBinding.id,
            ownerFieldProfileId: "field-a",
          }),
        ).rejects.toThrow(StaleUndoError);
      });
    });

    describe("stopping sharing and ending a Set preserve Field-only slots", () => {
      it("removing one of 3+ members drops their owner-only slot from the surviving Set, and Undo restores it", async () => {
        const storage = new InMemoryLocalStorage();
        const repository = new FillNestRepository(storage);
        await repository.replaceState({
          ...baseLogicalPageState,
          pageProfiles: [
            { id: "page-a", siteId: "example.test" },
            { id: "page-b", siteId: "example.test" },
            { id: "page-c", siteId: "example.test" },
          ],
          fieldProfiles: [
            { id: "field-a", pageProfileId: "page-a" },
            { id: "field-b", pageProfileId: "page-b" },
            { id: "field-c", pageProfileId: "page-c" },
          ],
          bindings: [],
          templates: [
            { id: "template-owner", content: "Owner-only", siteAffinities: ["example.test"], createdAt: "x", updatedAt: "x", totalUsageCount: 0, revision: 0 },
          ],
          sharedTemplateSets: [
            { id: "set-1", siteId: "example.test", name: "Three", memberFieldProfileIds: ["field-a", "field-b", "field-c"] },
          ],
          sharedTemplateBindings: [
            { id: "slot-owner", setId: "set-1", templateId: "template-owner", usageCount: 0, revision: 0, order: 0, ownerFieldProfileId: "field-a" },
          ],
        });

        const result = await repository.removeSharedTemplateSetMember({ setId: "set-1", fieldProfileId: "field-a" });
        expect(result.ended).toBe(false);
        expect(result.removedOwnedSlots).toEqual([
          expect.objectContaining({ id: "slot-owner", ownerFieldProfileId: "field-a" }),
        ]);

        // The stale owner-only slot must not linger in the surviving Set -
        // it would otherwise point at a Field no longer a member, which
        // fails validation on the next read.
        const state = await repository.read();
        expect(state.sharedTemplateBindings.some((b) => b.id === "slot-owner")).toBe(false);
        expect(state.bindings).toEqual(
          expect.arrayContaining([expect.objectContaining({ templateId: "template-owner", fieldProfileId: "field-a" })]),
        );

        await repository.undoRemoveSharedTemplateSetMember({
          fieldProfileId: "field-a",
          set: { id: "set-1", siteId: "example.test", name: "Three", memberFieldProfileIds: ["field-a", "field-b", "field-c"] },
          endedSharedBindings: [],
          snapshotBindings: result.snapshotBindings,
          dormantBindings: result.dormantBindings,
          removedOwnedSlots: result.removedOwnedSlots,
          removedFieldStates: [],
        });
        const restored = await repository.read();
        expect(restored.sharedTemplateBindings).toEqual([
          expect.objectContaining({ id: "slot-owner", ownerFieldProfileId: "field-a" }),
        ]);
      });

      it("ending a Set converts its owner-only slots into direct Bindings for their owners, and Undo reverses it", async () => {
        const storage = new InMemoryLocalStorage();
        const repository = new FillNestRepository(storage);
        await seedTwoMemberSet(repository);
        const created = await repository.createTemplateAndBindSharedFieldOnly({
          setId: "set-1",
          fieldProfileId: "field-a",
          content: "A's private template",
        });
        const set = (await repository.read()).sharedTemplateSets.find((s) => s.id === "set-1")!;
        const sharedBindings = (await repository.read()).sharedTemplateBindings.filter((b) => b.setId === "set-1");

        const result = await repository.endSharedTemplateSet({ setId: "set-1" });
        // Task 021 Addendum B: every member keeps what it was offered; the
        // Field-only Template goes to its owner alone, and stays private.
        expect(result.convertedBindings.filter((b) => b.templateId === created.template.id)).toEqual([
          expect.objectContaining({ fieldProfileId: "field-a", privateToField: true }),
        ]);

        const state = await repository.read();
        expect(state.sharedTemplateBindings).toEqual([]);
        expect(state.bindings).toEqual(
          expect.arrayContaining([expect.objectContaining({ templateId: created.template.id, fieldProfileId: "field-a" })]),
        );

        await repository.undoEndSharedTemplateSet({
          set,
          sharedBindings,
          endedFieldStates: [],
          convertedBindings: result.convertedBindings,
          dormantBindings: result.dormantBindings,
        });
        const restored = await repository.read();
        expect(restored.sharedTemplateBindings).toEqual(
          expect.arrayContaining([expect.objectContaining({ id: created.sharedBinding.id, ownerFieldProfileId: "field-a" })]),
        );
        expect(restored.bindings.some((b) => b.templateId === created.template.id)).toBe(false);
      });
    });


    describe("merging Sets preserves Field-only slots on both sides", () => {
      it("a Field-only slot exclusive to the removed Set survives the merge, still owner-only", async () => {
        const storage = new InMemoryLocalStorage();
        const repository = new FillNestRepository(storage);
        await repository.replaceState({
          ...baseLogicalPageState,
          pageProfiles: [
            ...baseLogicalPageState.pageProfiles,
            { id: "page-other-site", siteId: "example.test" },
          ],
          fieldProfiles: [
            ...baseLogicalPageState.fieldProfiles,
            { id: "field-2", pageProfileId: "page-other-site" },
          ],
          templates: [
            ...baseLogicalPageState.templates,
            { id: "template-private", content: "D's private template", siteAffinities: ["example.test"], createdAt: "x", updatedAt: "x", totalUsageCount: 0, revision: 0 },
          ],
          sharedTemplateSets: [
            { id: "keep-set", siteId: "example.test", name: "Keep me", memberFieldProfileIds: ["field-1"] },
            { id: "remove-set", siteId: "example.test", name: "Remove me", memberFieldProfileIds: ["field-2"] },
          ],
          sharedTemplateBindings: [
            { id: "remove-binding-private", setId: "remove-set", templateId: "template-private", usageCount: 0, revision: 0, order: 0, ownerFieldProfileId: "field-2" },
          ],
        });

        const result = await repository.mergeSharedTemplateSets({ keepSetId: "keep-set", removeSetId: "remove-set" });
        const mergedPrivateSlot = result.bindings.find((b) => b.templateId === "template-private");
        expect(mergedPrivateSlot?.ownerFieldProfileId).toBe("field-2");

        const state = await repository.read();
        expect(effectiveTemplateListForField(state, "field-1").templateIds).not.toContain("template-private");
        expect(effectiveTemplateListForField(state, "field-2").templateIds).toContain("template-private");
      });

      it("never dedupes an owner-only slot with an ordinary slot for the same Template on either side", async () => {
        const storage = new InMemoryLocalStorage();
        const repository = new FillNestRepository(storage);
        await repository.replaceState({
          ...baseLogicalPageState,
          pageProfiles: [
            ...baseLogicalPageState.pageProfiles,
            { id: "page-other-site", siteId: "example.test" },
          ],
          fieldProfiles: [
            ...baseLogicalPageState.fieldProfiles,
            { id: "field-2", pageProfileId: "page-other-site" },
          ],
          templates: [
            ...baseLogicalPageState.templates,
            { id: "template-shared", content: "Shared", siteAffinities: ["example.test"], createdAt: "x", updatedAt: "x", totalUsageCount: 0, revision: 0 },
          ],
          sharedTemplateSets: [
            { id: "keep-set", siteId: "example.test", name: "Keep me", memberFieldProfileIds: ["field-1"] },
            { id: "remove-set", siteId: "example.test", name: "Remove me", memberFieldProfileIds: ["field-2"] },
          ],
          sharedTemplateBindings: [
            // keep-set has field-1's own owner-only slot for template-shared;
            // remove-set has an ordinary slot for the exact same Template,
            // giving field-2 normal (non-owner) access to it today.
            { id: "keep-owner-slot", setId: "keep-set", templateId: "template-shared", usageCount: 0, revision: 0, order: 0, ownerFieldProfileId: "field-1" },
            { id: "remove-ordinary-slot", setId: "remove-set", templateId: "template-shared", usageCount: 0, revision: 0, order: 0 },
          ],
        });

        const result = await repository.mergeSharedTemplateSets({ keepSetId: "keep-set", removeSetId: "remove-set" });
        // Both relationships must survive as two distinct slots - the
        // owner-only one for field-1 unchanged, and a fresh ordinary one
        // carrying forward field-2's pre-merge access.
        const slotsForTemplate = result.bindings.filter((b) => b.templateId === "template-shared");
        expect(slotsForTemplate).toHaveLength(2);
        expect(slotsForTemplate.some((b) => b.ownerFieldProfileId === "field-1")).toBe(true);
        expect(slotsForTemplate.some((b) => b.ownerFieldProfileId === undefined)).toBe(true);

        const state = await repository.read();
        // field-2 must not silently gain field-1's owner-only relationship...
        expect(
          effectiveTemplateListForField(state, "field-2").entries.find((e) => e.templateId === "template-shared")
            ?.isFieldOnly,
        ).toBe(false);
        // ...and must not have lost the ordinary access it already had.
        expect(effectiveTemplateListForField(state, "field-2").templateIds).toContain("template-shared");
        expect(effectiveTemplateListForField(state, "field-1").templateIds).toContain("template-shared");
      });

      it("a stale merge Undo is rejected once the slot has since been promoted, even though id/order/usage are unchanged", async () => {
        const storage = new InMemoryLocalStorage();
        const repository = new FillNestRepository(storage);
        await seedTwoMemberSet(repository);
        const created = await repository.createTemplateAndBindSharedFieldOnly({
          setId: "set-1",
          fieldProfileId: "field-a",
          content: "A's private template",
        });
        const state = await repository.read();
        await repository.replaceState({
          ...state,
          sharedTemplateSets: [
            ...state.sharedTemplateSets,
            { id: "set-2", siteId: "example.test", name: "Other", memberFieldProfileIds: ["field-c"] },
          ],
          fieldProfiles: [...state.fieldProfiles, { id: "field-c", pageProfileId: "page-1" }],
        });

        const merged = await repository.mergeSharedTemplateSets({ keepSetId: "set-1", removeSetId: "set-2" });
        const mergedOwnerSlot = merged.bindings.find((b) => b.id === created.sharedBinding.id)!;

        // A later, unrelated mutation promotes the owner-only slot - same
        // id, templateId, usageCount, revision, and order, only the owner
        // cleared.
        await repository.promoteFieldOnlySlot({ setId: "set-1", slotId: mergedOwnerSlot.id, fieldProfileId: "field-a" });

        await expect(
          repository.undoMergeSharedTemplateSets({
            mergedSet: merged.set,
            mergedSetBindings: merged.bindings,
            previousKeepSet: merged.previousKeepSet,
            previousKeepSetBindings: merged.previousKeepSetBindings,
            removedSet: merged.removedSet,
            removedSetBindings: merged.removedSetBindings,
            remappedFieldStates: merged.remappedFieldStates,
            previousRemovedSetFieldStates: merged.previousRemovedSetFieldStates,
          }),
        ).rejects.toThrow(StaleUndoError);
      });
    });

    describe("joinSetAndShare (composite promotion, target unshared)", () => {
      it("atomically adds the target Field and promotes the slot in one operation", async () => {
        const storage = new InMemoryLocalStorage();
        const repository = new FillNestRepository(storage);
        await seedTwoMemberSet(repository);
        const created = await repository.createTemplateAndBindSharedFieldOnly({
          setId: "set-1",
          fieldProfileId: "field-a",
          content: "A's private template",
        });
        const state = await repository.read();
        await repository.replaceState({
          ...state,
          fieldProfiles: [...state.fieldProfiles, { id: "field-c", pageProfileId: "page-1" }],
        });

        const setCountBeforeComposite = storage.setCount;
        const result = await repository.joinSetAndShare({
          setId: "set-1",
          slotId: created.sharedBinding.id,
          fieldProfileId: "field-a",
          targetFieldProfileId: "field-c",
        });
        expect(result.set.memberFieldProfileIds).toContain("field-c");
        expect(result.sharedBinding.ownerFieldProfileId).toBeUndefined();
        // Behaviour lock for Task 032 Phase B. This composite adds a member
        // and promotes a slot, and it must remain one durable write: a reader
        // that sees the member added but the slot still owner-only would see a
        // state this Task's invariants say cannot exist. `runAtomicComposite`
        // stages both steps and calls `storage.set` once. Any later extraction
        // of the command bodies has to keep this number.
        expect(storage.setCount - setCountBeforeComposite).toBe(1);

        const finalState = await repository.read();
        expect(effectiveTemplateListForField(finalState, "field-c").templateIds).toContain(created.template.id);

        await repository.undoJoinSetAndShare({
          setId: "set-1",
          targetFieldProfileId: "field-c",
          addUndo: result.addUndo,
          slotId: created.sharedBinding.id,
          ownerFieldProfileId: "field-a",
          previousSlot: result.previousSlot,
        });
        const restored = await repository.read();
        expect(restored.sharedTemplateSets.find((s) => s.id === "set-1")?.memberFieldProfileIds).not.toContain("field-c");
        expect(restored.sharedTemplateBindings.find((b) => b.id === created.sharedBinding.id)?.ownerFieldProfileId).toBe(
          "field-a",
        );
      });
    });

    describe("mergeSetsAndShare (composite promotion, target in a different Set)", () => {
      it("atomically merges Sets and promotes the slot in one operation, keeping the slot's own id", async () => {
        const storage = new InMemoryLocalStorage();
        const repository = new FillNestRepository(storage);
        await repository.replaceState({
          ...baseLogicalPageState,
          pageProfiles: [
            ...baseLogicalPageState.pageProfiles,
            { id: "page-other", siteId: "example.test" },
          ],
          fieldProfiles: [
            ...baseLogicalPageState.fieldProfiles,
            { id: "field-2", pageProfileId: "page-other" },
          ],
          sharedTemplateSets: [
            { id: "keep-set", siteId: "example.test", name: "Keep me", memberFieldProfileIds: ["field-1"] },
            { id: "remove-set", siteId: "example.test", name: "Remove me", memberFieldProfileIds: ["field-2"] },
          ],
          sharedTemplateBindings: [],
        });
        const created = await repository.createTemplateAndBindSharedFieldOnly({
          setId: "keep-set",
          fieldProfileId: "field-1",
          content: "A's private template",
        });

        const setCountBeforeComposite = storage.setCount;
        const result = await repository.mergeSetsAndShare({
          keepSetId: "keep-set",
          removeSetId: "remove-set",
          slotId: created.sharedBinding.id,
          fieldProfileId: "field-1",
        });
        expect(result.sharedBinding.id).toBe(created.sharedBinding.id);
        expect(result.sharedBinding.ownerFieldProfileId).toBeUndefined();
        // Behaviour lock for Task 032 Phase B - see the sibling composite
        // above. Merging two Sets and promoting the slot is one durable write.
        expect(storage.setCount - setCountBeforeComposite).toBe(1);

        const state = await repository.read();
        expect(effectiveTemplateListForField(state, "field-2").templateIds).toContain(created.template.id);

        await repository.undoMergeSetsAndShare({
          mergedSet: result.set,
          mergedSetBindings: result.bindings,
          previousKeepSet: result.previousKeepSet,
          previousKeepSetBindings: result.previousKeepSetBindings,
          removedSet: result.removedSet,
          removedSetBindings: result.removedSetBindings,
          remappedFieldStates: result.remappedFieldStates,
          previousRemovedSetFieldStates: result.previousRemovedSetFieldStates,
          slotId: created.sharedBinding.id,
          ownerFieldProfileId: "field-1",
          previousSlot: result.previousSlot,
        });
        const restored = await repository.read();
        expect(restored.sharedTemplateSets.map((s) => s.id).sort()).toEqual(["keep-set", "remove-set"]);
        expect(restored.sharedTemplateBindings.find((b) => b.id === created.sharedBinding.id)?.ownerFieldProfileId).toBe(
          "field-1",
        );
      });
    });
  });
});

// Task 032 Addendum A, rule 4: the behaviour locks for the Template command
// family, written before that family's bodies are extracted.
//
// Phase B turns command bodies into pure transitions, which moves the
// `commit` call from inside each body to its caller. The two properties that
// move with it, and that no existing test states directly, are how many
// durable writes a command performs and whether a rejected command writes at
// all. Undo and staleness already have dedicated coverage across this file
// and `task-027-remediation.test.ts`; extraction must not modify those, so
// they are not restated here.
describe("Template command family: durable-write behaviour locks", () => {
  async function seedOneTemplate(repository: FillNestRepository) {
    return repository.createTemplateAndBind({
      content: "Locked template",
      pageUrl: "https://example.test/form",
      pageProfileId: "page-1",
      fieldProfileId: "field-1",
      pageIdentityKey: "/form",
      fieldIdentityKey: '{"semanticKind":"notes"}',
    });
  }

  it("performs exactly one durable write per successful command", async () => {
    const storage = new InMemoryLocalStorage();
    const repository = new FillNestRepository(storage);

    const created = await seedOneTemplate(repository);
    let before = storage.setCount;

    await repository.createTemplate({ content: "Second", pageUrl: "https://example.test/form" });
    expect(storage.setCount - before).toBe(1);

    before = storage.setCount;
    await repository.updateTemplate({ templateId: created.template.id, content: "Edited" });
    expect(storage.setCount - before).toBe(1);

    before = storage.setCount;
    await repository.deleteTemplate({ templateId: created.template.id });
    expect(storage.setCount - before).toBe(1);

    before = storage.setCount;
    await repository.restoreTemplate({ template: created.template, bindings: [created.binding] });
    expect(storage.setCount - before).toBe(1);

    before = storage.setCount;
    await repository.deleteTemplates({ templateIds: [created.template.id] });
    expect(storage.setCount - before).toBe(1);

    before = storage.setCount;
    await repository.restoreTemplates({
      templates: [{ template: created.template, bindings: [created.binding] }],
    });
    expect(storage.setCount - before).toBe(1);
  });

  it("createTemplateAndBind is one durable write, not one per record it creates", async () => {
    const storage = new InMemoryLocalStorage();
    const repository = new FillNestRepository(storage);
    const before = storage.setCount;

    // It creates a Template, a Page Profile, a Field Profile and a Binding.
    const created = await seedOneTemplate(repository);

    expect(created.binding.templateId).toBe(created.template.id);
    expect(storage.setCount - before).toBe(1);
  });

  it("keeps the batch commands at one durable write regardless of how many Templates they touch", async () => {
    const storage = new InMemoryLocalStorage();
    const repository = new FillNestRepository(storage);
    const first = await seedOneTemplate(repository);
    await repository.createTemplate({ content: "Second", pageUrl: "https://example.test/form" });
    await repository.createTemplate({ content: "Third", pageUrl: "https://example.test/form" });
    const all = (await repository.read()).templates;
    expect(all).toHaveLength(3);

    let before = storage.setCount;
    const deleted = await repository.deleteTemplates({ templateIds: all.map((template) => template.id) });
    expect(deleted.deletedTemplateIds).toHaveLength(3);
    expect(storage.setCount - before).toBe(1);

    before = storage.setCount;
    const restored = await repository.restoreTemplates({
      templates: all.map((template) => ({
        template,
        bindings: template.id === first.template.id ? [first.binding] : [],
      })),
    });
    expect(restored.restored).toHaveLength(3);
    expect(storage.setCount - before).toBe(1);
  });

  it("writes nothing when a command rejects", async () => {
    const storage = new InMemoryLocalStorage();
    const repository = new FillNestRepository(storage);
    await seedOneTemplate(repository);

    const before = storage.setCount;
    const stateBefore = structuredClone(storage.values.fillnestState);

    await expect(
      repository.updateTemplate({ templateId: "no-such-template", content: "x" }),
    ).rejects.toThrow();
    // Restoring a Template whose id is still present is the fail-closed
    // staleness path, not a filter: it must reject and leave storage alone.
    await expect(
      repository.restoreTemplate({ template: (await repository.read()).templates[0]!, bindings: [] }),
    ).rejects.toBeInstanceOf(StaleUndoError);

    expect(storage.setCount).toBe(before);
    expect(storage.values.fillnestState).toEqual(stateBefore);
  });

  it("treats a delete of an absent Template as a no-op that writes nothing", async () => {
    const storage = new InMemoryLocalStorage();
    const repository = new FillNestRepository(storage);
    await seedOneTemplate(repository);

    const before = storage.setCount;
    const deleted = await repository.deleteTemplate({ templateId: "no-such-template" });

    expect(deleted).toBe(false);
    expect(storage.setCount).toBe(before);
  });
});

// Task 032 Addendum A rule 4: the Binding command family's behaviour locks,
// written before that family's bodies are extracted. Same reasoning as the
// Template family's - what moves with a body is how many durable writes it
// performs and whether a rejected or no-op command writes at all.
describe("Binding command family: durable-write behaviour locks", () => {
  async function seedBoundTemplate(repository: FillNestRepository) {
    return repository.createTemplateAndBind({
      content: "Bound template",
      pageUrl: "https://example.test/form",
      pageProfileId: "page-1",
      fieldProfileId: "field-1",
      pageIdentityKey: "/form",
      fieldIdentityKey: '{"semanticKind":"notes"}',
    });
  }

  it("performs exactly one durable write per successful command", async () => {
    const storage = new InMemoryLocalStorage();
    const repository = new FillNestRepository(storage);
    const created = await seedBoundTemplate(repository);
    const second = await repository.createTemplate({
      content: "Second",
      pageUrl: "https://example.test/form",
    });

    let before = storage.setCount;
    await repository.recordInsertion({
      templateId: created.template.id,
      fieldProfileId: "field-1",
    });
    expect(storage.setCount - before).toBe(1);

    before = storage.setCount;
    const bound = await repository.bindTemplate({
      templateId: second.id,
      pageUrl: "https://example.test/form",
      pageProfileId: "page-1",
      fieldProfileId: "field-1",
      pageIdentityKey: "/form",
      fieldIdentityKey: '{"semanticKind":"notes"}',
    });
    expect(storage.setCount - before).toBe(1);

    before = storage.setCount;
    await repository.undoBind({ bindingId: bound.id });
    expect(storage.setCount - before).toBe(1);

    before = storage.setCount;
    await repository.unbindTemplate({
      templateId: created.template.id,
      fieldProfileId: "field-1",
    });
    expect(storage.setCount - before).toBe(1);

    before = storage.setCount;
    await repository.undoUnbind({ binding: created.binding });
    expect(storage.setCount - before).toBe(1);
  });

  it("re-binding the same Template to the same Field is a no-op that writes nothing", async () => {
    const storage = new InMemoryLocalStorage();
    const repository = new FillNestRepository(storage);
    const created = await seedBoundTemplate(repository);

    const before = storage.setCount;
    const rebound = await repository.bindTemplate({
      templateId: created.template.id,
      pageUrl: "https://example.test/form",
      pageProfileId: "page-1",
      fieldProfileId: "field-1",
      pageIdentityKey: "/form",
      fieldIdentityKey: '{"semanticKind":"notes"}',
    });

    expect(rebound.id).toBe(created.binding.id);
    expect(storage.setCount).toBe(before);
  });

  it("writes nothing for a command that finds nothing to do", async () => {
    const storage = new InMemoryLocalStorage();
    const repository = new FillNestRepository(storage);
    await seedBoundTemplate(repository);

    const before = storage.setCount;
    expect(await repository.recordInsertion({ templateId: "no-such", fieldProfileId: "field-1" })).toBe(false);
    expect(await repository.unbindTemplate({ templateId: "no-such", fieldProfileId: "field-1" })).toBe(false);
    expect(storage.setCount).toBe(before);
  });

  it("writes nothing when a Binding command fails closed", async () => {
    const storage = new InMemoryLocalStorage();
    const repository = new FillNestRepository(storage);
    const created = await seedBoundTemplate(repository);

    const before = storage.setCount;
    const stateBefore = structuredClone(storage.values.fillnestState);

    await expect(
      repository.bindTemplate({
        templateId: "no-such",
        pageUrl: "https://example.test/form",
        pageProfileId: "page-1",
        fieldProfileId: "field-1",
        pageIdentityKey: "/form",
        fieldIdentityKey: '{"semanticKind":"notes"}',
      }),
    ).rejects.toThrow();
    await expect(repository.undoBind({ bindingId: "no-such" })).rejects.toBeInstanceOf(StaleUndoError);
    // Undoing an Unbind that never happened would duplicate the live Binding.
    await expect(repository.undoUnbind({ binding: created.binding })).rejects.toBeInstanceOf(StaleUndoError);

    expect(storage.setCount).toBe(before);
    expect(storage.values.fillnestState).toEqual(stateBefore);
  });
});

// Task 032 Addendum A rule 4: the Shared Template Set family's behaviour locks,
// written before that family's bodies are extracted.
//
// This family differs from the two before it in a way that matters to the
// move: seven of its commands call `commit` more than once in the source.
// Every one of those is a branch - each `commit` is immediately followed by a
// `return` - so a call still performs exactly one durable write. An extraction
// that turned those branches into sequential writes would be a behaviour
// change, and these are what would catch it.
describe("Shared Template Set family: durable-write behaviour locks", () => {
  async function seedSetWithTwoFields(repository: FillNestRepository) {
    const created = await repository.createTemplateAndBind({
      content: "A's template",
      pageUrl: "https://example.test/form",
      pageProfileId: "page-1",
      fieldProfileId: "field-a",
      pageIdentityKey: "/form",
      fieldIdentityKey: '{"semanticKind":"notes"}',
    });
    const state = await repository.read();
    await repository.replaceState({
      ...state,
      fieldProfiles: [...state.fieldProfiles, { id: "field-b", pageProfileId: "page-1" }],
    });
    const set = await repository.createSharedTemplateSet({ fieldProfileIds: ["field-a", "field-b"] });
    return { created, set };
  }

  it("performs exactly one durable write per successful command", async () => {
    const storage = new InMemoryLocalStorage();
    const repository = new FillNestRepository(storage);
    const { set } = await seedSetWithTwoFields(repository);

    let before = storage.setCount;
    await repository.renameSharedTemplateSet({ setId: set.set.id, name: "Renamed" });
    expect(storage.setCount - before).toBe(1);

    before = storage.setCount;
    const shared = await repository.createTemplateAndBindShared({
      setId: set.set.id,
      content: "Shared by the Set",
    });
    expect(storage.setCount - before).toBe(1);

    before = storage.setCount;
    await repository.saveTemplateOverrideForField({
      setId: set.set.id,
      slotId: shared.sharedBinding.id,
      fieldProfileId: "field-b",
      content: "B's own wording",
    });
    expect(storage.setCount - before).toBe(1);

    before = storage.setCount;
    await repository.excludeSharedTemplateForField({
      setId: set.set.id,
      slotId: shared.sharedBinding.id,
      fieldProfileId: "field-b",
    });
    expect(storage.setCount - before).toBe(1);

    before = storage.setCount;
    await repository.unbindTemplateShared({ setId: set.set.id, slotId: shared.sharedBinding.id });
    expect(storage.setCount - before).toBe(1);

    before = storage.setCount;
    await repository.endSharedTemplateSet({ setId: set.set.id });
    expect(storage.setCount - before).toBe(1);
  });

  it("keeps a branching command at one durable write, whichever branch it takes", async () => {
    const storage = new InMemoryLocalStorage();
    const repository = new FillNestRepository(storage);
    const { set } = await seedSetWithTwoFields(repository);
    const template = await repository.createTemplate({
      content: "Bound to the Set",
      pageUrl: "https://example.test/form",
    });

    // bindTemplateShared has two commits in source: the already-bound branch
    // and the new-slot branch.
    let before = storage.setCount;
    const first = await repository.bindTemplateShared({ setId: set.set.id, templateId: template.id });
    expect(storage.setCount - before).toBe(1);

    before = storage.setCount;
    const repeated = await repository.bindTemplateShared({ setId: set.set.id, templateId: template.id });
    expect(repeated.id).toBe(first.id);
    expect(storage.setCount - before).toBeLessThanOrEqual(1);

    // removeSharedTemplateSetMember has three: the Set survives, the Set ends
    // because too few members remain, and the no-op.
    before = storage.setCount;
    await repository.removeSharedTemplateSetMember({ setId: set.set.id, fieldProfileId: "field-b" });
    expect(storage.setCount - before).toBe(1);
  });

  it("writes nothing when a Shared Set command fails closed", async () => {
    const storage = new InMemoryLocalStorage();
    const repository = new FillNestRepository(storage);
    const { set } = await seedSetWithTwoFields(repository);

    const before = storage.setCount;
    const stateBefore = structuredClone(storage.values.fillnestState);

    await expect(repository.renameSharedTemplateSet({ setId: "no-such-set", name: "x" })).rejects.toThrow();
    await expect(
      repository.createTemplateAndBindShared({ setId: "no-such-set", content: "x" }),
    ).rejects.toThrow();
    await expect(
      repository.saveTemplateOverrideForField({
        setId: set.set.id,
        slotId: "no-such-slot",
        fieldProfileId: "field-b",
        content: "x",
      }),
    ).rejects.toThrow();

    expect(storage.setCount).toBe(before);
    expect(storage.values.fillnestState).toEqual(stateBefore);
  });
});
