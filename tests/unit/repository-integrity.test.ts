import { describe, expect, it } from "vitest";

import {
  FillNestRepository,
  InvalidStoredDataError,
  validateCandidateInvariants,
  validateCandidateState,
  type FillNestState,
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

function createValidState(): FillNestState {
  return {
    schemaVersion: 13,
    compatibilityPairDecisions: [],
    sites: [{ id: "example.test" }],
    templates: [
      {
        id: "t-1",
        content: "Template 1",
        siteAffinities: ["example.test"],
        createdAt: "2026-08-21T00:00:00.000Z",
        updatedAt: "2026-08-21T00:00:00.000Z",
        totalUsageCount: 0,
        revision: 0,
      },
    ],
    pageProfiles: [{ id: "p-1", siteId: "example.test", identityKey: "/login" }],
    fieldProfiles: [{ id: "f-1", pageProfileId: "p-1", identityKey: "username" }],
    bindings: [
      {
        id: "b-1",
        templateId: "t-1",
        pageProfileId: "p-1",
        fieldProfileId: "f-1",
        createdAt: "2026-08-21T00:00:00.000Z",
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
    pickerPosition: { top: 100, left: 200 },
    pageStatusPosition: null,
  };
}

function createValidLogicalPageState(): FillNestState {
  const state = createValidState();
  state.pageProfiles.push({ id: "p-2", siteId: "example.test", identityKey: "/customers/:number" });
  state.fieldProfiles.push({ id: "f-2", pageProfileId: "p-2", identityKey: "username" });
  state.logicalPageSiteKeys = [
    {
      id: "logical-site-key-1",
      siteId: "example.test",
      encodedHmacKey: "hmac-sha256-v1:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    },
  ];
  state.logicalPageRules = [
    {
      id: "logical-rule-1",
      siteId: "example.test",
      siteKeyId: "logical-site-key-1",
      origin: "https://forms.example.test",
      routePattern: "/customers/:number",
      fieldFeatureHashes: ["a".repeat(64)],
      groupedFieldFeatureHashes: ["b".repeat(64)],
      pageProfileId: "p-1",
    },
  ];
  state.logicalPageProvenance = [
    {
      id: "logical-provenance-1",
      ruleId: "logical-rule-1",
      origin: "https://forms.example.test",
      sourcePageProfileId: "p-2",
      canonicalPageProfileId: "p-1",
      fieldMappings: [
        {
          sourceFieldProfileId: "f-2",
          canonicalFieldProfileId: "f-1",
          bindingIds: ["b-1"],
        },
      ],
    },
  ];
  return state;
}

describe("Repository Integrity & Candidate State Validation", () => {
  describe("Logical Page Matching V5 and V6 invariants", () => {
    it("rejects an Observation for a Page without a direct Binding", () => {
      const state = createValidState();
      state.pageProfiles.push({ id: "p-unbound", siteId: "example.test" });
      state.logicalPageSiteKeys = [
        {
          id: "logical-site-key-1",
          siteId: "example.test",
          encodedHmacKey: "hmac-sha256-v1:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        },
      ];
      state.logicalPageObservations = [
        {
          id: "observation-unbound",
          siteId: "example.test",
          siteKeyId: "logical-site-key-1",
          origin: "https://forms.example.test",
          routePattern: "/customers/:number",
          fieldFeatureHashes: ["a".repeat(64)],
          groupedFieldFeatureHashes: ["b".repeat(64)],
          pageProfileId: "p-unbound",
        },
      ];

      expect(() => validateCandidateState(state)).toThrow(InvalidStoredDataError);
    });

    it("rejects an Observation whose Origin belongs to another Site", () => {
      const state = createValidState();
      state.logicalPageSiteKeys = [
        {
          id: "logical-site-key-1",
          siteId: "example.test",
          encodedHmacKey: "hmac-sha256-v1:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        },
      ];
      state.logicalPageObservations = [
        {
          id: "observation-wrong-origin",
          siteId: "example.test",
          siteKeyId: "logical-site-key-1",
          origin: "https://other.test",
          routePattern: "/customers/:number",
          fieldFeatureHashes: ["a".repeat(64)],
          groupedFieldFeatureHashes: ["b".repeat(64)],
          pageProfileId: "p-1",
        },
      ];

      expect(() => validateCandidateState(state)).toThrow(InvalidStoredDataError);
    });

    it("accepts an all-static route pattern, which a Rule may now legitimately hold", () => {
      // Task 014 Addendum C Slice 2. A Rule used to be required to contain a
      // dynamic segment, because a Rule could only ever come from an address
      // that already spelled one. Comparability is now a route *family* - two
      // addresses differing in at most one position - so a Rule can be
      // confirmed between two pages whose patterns are entirely static, and
      // the validator must not reject the record that produces.
      const state = createValidLogicalPageState();
      state.logicalPageRules[0]!.routePattern = "/customers/edit";

      expect(() => validateCandidateState(state)).not.toThrow();
    });

    it("still rejects a route pattern carrying raw address text", () => {
      // The shape check is what stops readable address text being stored as a
      // Route Pattern; only its dynamic-segment requirement was lifted.
      for (const corrupt of [
        "/customers/Morgan Reed/edit",
        "/customers/morgan%20reed/edit",
        "customers/:number/edit",
        "/customers/:number/edit?tab=1",
        "/customers/seg-v1:nothex/edit",
      ]) {
        const state = createValidLogicalPageState();
        state.logicalPageRules[0]!.routePattern = corrupt;
        expect(() => validateCandidateState(state), corrupt).toThrow(InvalidStoredDataError);
      }
    });

    it("accepts numeric, UUID, generalized and hashed route segments", () => {
      const numeric = createValidLogicalPageState();
      expect(() => validateCandidateState(numeric)).not.toThrow();

      for (const routePattern of [
        "/customers/:uuid/edit",
        "/jobs/:id/apply",
        "/p/seg-v1:0123456789abcdef",
      ]) {
        const state = createValidLogicalPageState();
        state.logicalPageRules[0]!.routePattern = routePattern;
        expect(() => validateCandidateState(state), routePattern).not.toThrow();
      }
    });

    it("rejects provenance whose mapped Fields do not share the exact identity key", () => {
      const state = createValidLogicalPageState();
      state.fieldProfiles.find((field) => field.id === "f-2")!.identityKey = "different-field";

      expect(() => validateCandidateState(state)).toThrow(InvalidStoredDataError);
    });

    // Task 020 Addendum A: provenance records what was merged at confirmation;
    // the canonical Field stays free to gain and lose Bindings afterwards.
    it("accepts a canonical Field that gained a Binding after the match was confirmed", () => {
      const state = createValidLogicalPageState();
      state.templates.push({
        id: "t-2",
        content: "Template 2",
        siteAffinities: ["example.test"],
        createdAt: "2026-08-21T00:00:00.000Z",
        updatedAt: "2026-08-21T00:00:00.000Z",
        totalUsageCount: 0,
        revision: 0,
      });
      state.bindings.push({
        id: "b-2",
        templateId: "t-2",
        pageProfileId: "p-1",
        fieldProfileId: "f-1",
        createdAt: "2026-08-21T00:00:00.000Z",
        usageCount: 0,
        revision: 0,
      });

      expect(() => validateCandidateState(state)).not.toThrow();
    });

    it("rejects provenance that records the same merged Binding twice", () => {
      const state = createValidLogicalPageState();
      const mapping = state.logicalPageProvenance[0]!.fieldMappings[0]!;
      mapping.bindingIds = [mapping.bindingIds[0]!, mapping.bindingIds[0]!];

      expect(() => validateCandidateState(state)).toThrow(InvalidStoredDataError);
    });

    it("rejects malformed matching rules before a candidate state can be committed", () => {
      const state = {
        ...createValidState(),
        logicalPageSiteKeys: [],
        logicalPageRules: [{ origin: "bad" }],
        logicalPageProvenance: [],
    logicalPageObservations: [],
      };

      expect(() => validateCandidateState(state)).toThrow(InvalidStoredDataError);
    });

    it("rejects matching provenance that crosses the confirmed rule Origin", () => {
      const state = {
        ...createValidState(),
        logicalPageSiteKeys: [
          {
            id: "logical-site-key-1",
            siteId: "example.test",
            encodedHmacKey: "hmac-sha256-v1:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
          },
        ],
        logicalPageRules: [
          {
            id: "logical-rule-1",
            siteId: "example.test",
            siteKeyId: "logical-site-key-1",
            origin: "https://forms.example.test",
            routePattern: "/customers/:number",
            fieldFeatureHashes: ["a".repeat(64)],
            groupedFieldFeatureHashes: ["b".repeat(64)],
            pageProfileId: "p-1",
          },
        ],
        logicalPageProvenance: [
          {
            id: "logical-provenance-1",
            ruleId: "logical-rule-1",
            origin: "https://other.example.test",
            sourcePageProfileId: "p-1",
            canonicalPageProfileId: "p-1",
            fieldMappings: [
              {
                sourceFieldProfileId: "f-1",
                canonicalFieldProfileId: "f-1",
                bindingIds: ["b-1"],
              },
            ],
          },
        ],
      };

      expect(() => validateCandidateState(state)).toThrow(InvalidStoredDataError);
    });
  });

  it("validates a compliant candidate state successfully", () => {
    const valid = createValidState();
    const result = validateCandidateState(valid);
    expect(result).toEqual(valid);
  });

  describe("ID uniqueness and collision invariants", () => {
    it("rejects duplicate template IDs within templates collection", () => {
      const state = createValidState();
      state.templates.push({ ...state.templates[0]!, totalUsageCount: 1 });
      expect(() => validateCandidateInvariants(state)).toThrow(InvalidStoredDataError);
    });

    it("rejects duplicate page profile IDs", () => {
      const state = createValidState();
      state.pageProfiles.push({ id: "p-1", siteId: "example.test" });
      expect(() => validateCandidateInvariants(state)).toThrow(InvalidStoredDataError);
    });

    it("rejects duplicate field profile IDs", () => {
      const state = createValidState();
      state.fieldProfiles.push({ id: "f-1", pageProfileId: "p-1" });
      expect(() => validateCandidateInvariants(state)).toThrow(InvalidStoredDataError);
    });

    it("rejects duplicate binding IDs", () => {
      const state = createValidState();
      state.bindings.push({ ...state.bindings[0]!, id: "b-1" });
      expect(() => validateCandidateInvariants(state)).toThrow(InvalidStoredDataError);
    });

    it("rejects cross-collection ID collisions (e.g. template and field profile sharing an ID)", () => {
      const state = createValidState();
      state.templates[0]!.id = "collision-id";
      state.fieldProfiles[0]!.id = "collision-id";
      state.bindings[0]!.templateId = "collision-id";
      state.bindings[0]!.fieldProfileId = "collision-id";
      expect(() => validateCandidateInvariants(state)).toThrow(InvalidStoredDataError);
    });

    it("rejects cross-collection ID collisions between page and binding", () => {
      const state = createValidState();
      state.pageProfiles[0]!.id = "same-id";
      state.fieldProfiles[0]!.pageProfileId = "same-id";
      state.bindings[0]!.id = "same-id";
      state.bindings[0]!.pageProfileId = "same-id";
      expect(() => validateCandidateInvariants(state)).toThrow(InvalidStoredDataError);
    });
  });

  describe("Relational integrity invariants", () => {
    it("rejects a page profile pointing to a non-existent site", () => {
      const state = createValidState();
      state.pageProfiles[0]!.siteId = "unregistered.test";
      expect(() => validateCandidateInvariants(state)).toThrow(InvalidStoredDataError);
    });

    it("rejects a Template Site Affinity pointing to a non-existent Site", () => {
      const state = createValidState();
      state.templates[0]!.siteAffinities = ["unregistered.test"];
      expect(() => validateCandidateInvariants(state)).toThrow(InvalidStoredDataError);
    });

    it("rejects a field profile pointing to a non-existent page profile", () => {
      const state = createValidState();
      state.fieldProfiles[0]!.pageProfileId = "non-existent-page";
      expect(() => validateCandidateInvariants(state)).toThrow(InvalidStoredDataError);
    });

    it("rejects a binding referencing an unlisted template", () => {
      const state = createValidState();
      state.bindings[0]!.templateId = "unlisted-template";
      expect(() => validateCandidateInvariants(state)).toThrow(InvalidStoredDataError);
    });

    it("rejects a binding referencing an unlisted page profile", () => {
      const state = createValidState();
      state.bindings[0]!.pageProfileId = "unlisted-page";
      expect(() => validateCandidateInvariants(state)).toThrow(InvalidStoredDataError);
    });

    it("rejects a binding referencing an unlisted field profile", () => {
      const state = createValidState();
      state.bindings[0]!.fieldProfileId = "unlisted-field";
      expect(() => validateCandidateInvariants(state)).toThrow(InvalidStoredDataError);
    });

    it("rejects a binding where field belongs to a different page profile", () => {
      const state = createValidState();
      state.sites.push({ id: "other.test" });
      state.pageProfiles.push({ id: "p-2", siteId: "other.test" });
      state.bindings[0]!.pageProfileId = "p-2"; // but field f-1 belongs to p-1
      expect(() => validateCandidateInvariants(state)).toThrow(InvalidStoredDataError);
    });

    it("rejects duplicate bindings for the same (templateId, fieldProfileId) pair", () => {
      const state = createValidState();
      state.bindings.push({
        id: "b-2",
        templateId: "t-1",
        pageProfileId: "p-1",
        fieldProfileId: "f-1",
        createdAt: "2026-08-21T01:00:00.000Z",
        usageCount: 0,
        revision: 0,
      });
      expect(() => validateCandidateInvariants(state)).toThrow(InvalidStoredDataError);
    });
  });

  describe("Commit gate preventing malformed writes", () => {
    it("prevents writes to storage when candidate state fails validation", async () => {
      const storage = new InMemoryLocalStorage();
      const repository = new FillNestRepository(storage);

      const invalidState = createValidState();
      invalidState.fieldProfiles[0]!.pageProfileId = "orphaned-page";

      await expect(repository.replaceState(invalidState)).rejects.toThrow(InvalidStoredDataError);
      expect(storage.setCount).toBe(0);
    });
  });
});
