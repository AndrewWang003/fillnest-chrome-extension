import { describe, expect, it } from "vitest";

import {
  BACKUP_ARCHIVE_FORMAT,
  CURRENT_ARCHIVE_VERSION,
  createBackupArchive,
  generateBackupFilename,
  InvalidBackupArchiveError,
  MAX_BACKUP_JSON_BYTES,
  MAX_SITE_AFFINITIES_PER_TEMPLATE,
  MAX_SITE_ID_LENGTH,
  MAX_TEMPLATE_CONTENT_LENGTH,
  OversizedBackupArchiveError,
  parseAndValidateBackupArchive,
  serializeBackupArchive,
} from "../../src/backup/archive-contract";
import type { FillNestState } from "../../src/storage/fillnest-repository";

function sampleBusinessState(): FillNestState {
  return {
    schemaVersion: 13,
    compatibilityPairDecisions: [],
    sites: [{ id: "b.test" }, { id: "a.test" }],
    templates: [
      {
        id: "t-2",
        content: "Second template",
        siteAffinities: ["b.test", "a.test"],
        createdAt: "2026-08-21T00:00:00.000Z",
        updatedAt: "2026-08-21T00:00:00.000Z",
        totalUsageCount: 2,
        revision: 1,
      },
      {
        id: "t-1",
        content: "First template",
        siteAffinities: ["a.test"],
        createdAt: "2026-08-21T00:00:00.000Z",
        updatedAt: "2026-08-21T00:00:00.000Z",
        totalUsageCount: 5,
        revision: 2,
      },
    ],
    pageProfiles: [
      { id: "p-2", siteId: "b.test", userAlias: "Page 2", identityKey: "page-key-2" },
      { id: "p-1", siteId: "a.test", userAlias: "Page 1", identityKey: "page-key-1" },
    ],
    fieldProfiles: [
      { id: "f-2", pageProfileId: "p-2", userAlias: "Field 2", identityKey: "field-key-2", documentOrder: 2, observedTitle: "Email address" },
      { id: "f-1", pageProfileId: "p-1", userAlias: "Field 1", identityKey: "field-key-1" },
    ],
    bindings: [
      {
        id: "b-2",
        templateId: "t-2",
        pageProfileId: "p-2",
        fieldProfileId: "f-2",
        createdAt: "2026-08-21T00:00:00.000Z",
        usageCount: 1,
        revision: 0,
      },
      {
        id: "b-1",
        templateId: "t-1",
        pageProfileId: "p-1",
        fieldProfileId: "f-1",
        createdAt: "2026-08-21T00:00:00.000Z",
        usageCount: 3,
        revision: 1,
      },
    ],
    logicalPageSiteKeys: [],
    logicalPageRules: [],
    logicalPageProvenance: [],
    logicalPageObservations: [],
    sharedTemplateSets: [],
    sharedTemplateBindings: [],
    sharedTemplateFieldStates: [],
    pickerPosition: { top: 150, left: 300 },
    pageStatusPosition: null,
  };
}

function sampleActivationState() {
  return {
    global: "active" as const,
    origins: [
      { origin: "http://b.test:80", mode: "paused" as const },
      { origin: "https://a.test:443", mode: "active" as const },
    ],
  };
}

describe("Archive Contract & Schema", () => {
  it("uses the approved 3 MiB Archive capacity boundary", () => {
    expect(MAX_BACKUP_JSON_BYTES).toBe(3 * 1024 * 1024);
    expect(() => parseAndValidateBackupArchive(" ".repeat(MAX_BACKUP_JSON_BYTES + 1))).toThrow(
      OversizedBackupArchiveError,
    );
  });

  describe("generateBackupFilename", () => {
    it("generates correct filename from Date object", () => {
      const date = new Date("2026-08-21T12:30:00.000Z");
      expect(generateBackupFilename(date)).toBe("fillnest-backup-2026-08-21.json");
    });

    it("generates correct filename from ISO string", () => {
      expect(generateBackupFilename("2026-12-05T08:00:00.000Z")).toBe("fillnest-backup-2026-12-05.json");
    });
  });

  describe("createBackupArchive and serialization", () => {
    it("restores an older archive with no Logical Page Matching data as empty, inferring no Rule", () => {
      const archive = createBackupArchive(sampleBusinessState(), sampleActivationState(), {
        createdAt: "2026-08-21T00:00:00.000Z",
      });
      // Simulate an archive exported before Logical Page Matching data
      // existed: the three keys are entirely absent, not present-and-empty.
      const olderShape = { ...archive.payload.business } as Record<string, unknown>;
      delete olderShape.logicalPageSiteKeys;
      delete olderShape.logicalPageRules;
      delete olderShape.logicalPageProvenance;
      const olderArchiveJson = JSON.stringify({
        ...archive,
        payload: { ...archive.payload, business: olderShape },
      });

      const restored = parseAndValidateBackupArchive(olderArchiveJson);

      expect(restored.payload.business.logicalPageSiteKeys).toEqual([]);
      expect(restored.payload.business.logicalPageRules).toEqual([]);
      expect(restored.payload.business.logicalPageProvenance).toEqual([]);
      expect(restored.payload.business.pageProfiles).toEqual(archive.payload.business.pageProfiles);
    });

    it("includes confirmed Logical Page Matching rules, provenance, and Site keys in the Archive and round-trips them", () => {
      const state = sampleBusinessState();
      state.logicalPageSiteKeys = [
        { id: "site-key-1", siteId: "a.test", encodedHmacKey: "hmac-sha256-v1:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" },
      ];
      state.logicalPageRules = [{
        id: "rule-1",
        siteId: "a.test",
        siteKeyId: "site-key-1",
        origin: "https://a.test",
        routePattern: "/customers/:number",
        fieldFeatureHashes: ["a".repeat(64)],
        groupedFieldFeatureHashes: ["b".repeat(64)],
        pageProfileId: "p-1",
      }];
      state.logicalPageProvenance = [{
        id: "provenance-1",
        ruleId: "rule-1",
        origin: "https://a.test",
        sourcePageProfileId: "p-1",
        canonicalPageProfileId: "p-1",
        fieldMappings: [{
          sourceFieldProfileId: "f-1",
          canonicalFieldProfileId: "f-1",
          bindingIds: ["b-1"],
        }],
      }];

      const archive = createBackupArchive(state, sampleActivationState(), {
        createdAt: "2026-08-21T00:00:00.000Z",
      });

      expect(archive.payload.business.logicalPageSiteKeys).toEqual(state.logicalPageSiteKeys);
      expect(archive.payload.business.logicalPageRules).toEqual(state.logicalPageRules);
      expect(archive.payload.business.logicalPageProvenance).toEqual(state.logicalPageProvenance);

      const restored = parseAndValidateBackupArchive(serializeBackupArchive(archive));
      expect(restored.payload.business.logicalPageRules).toEqual(state.logicalPageRules);
      expect(restored.payload.business.logicalPageProvenance).toEqual(state.logicalPageProvenance);
    });

    it("rejects a Logical Page Matching rule whose Page Profile belongs to a different Site (relational invariant, not just shape)", () => {
      const state = sampleBusinessState();
      state.logicalPageSiteKeys = [
        { id: "site-key-1", siteId: "a.test", encodedHmacKey: "hmac-sha256-v1:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" },
      ];
      state.logicalPageRules = [{
        id: "rule-1",
        siteId: "a.test",
        siteKeyId: "site-key-1",
        origin: "https://a.test",
        routePattern: "/customers/:number",
        fieldFeatureHashes: ["a".repeat(64)],
        groupedFieldFeatureHashes: ["b".repeat(64)],
        pageProfileId: "p-1",
      }];
      const archive = createBackupArchive(state, sampleActivationState(), {
        createdAt: "2026-08-21T00:00:00.000Z",
      });

      // Corrupt the exported archive directly: p-2 belongs to b.test, not
      // a.test, which createBackupArchive's own current-state validation
      // would never allow to be exported in the first place - this exercises
      // Restore's own untrusted-input rejection independently.
      const corrupted = {
        ...archive,
        payload: {
          ...archive.payload,
          business: {
            ...archive.payload.business,
            logicalPageRules: archive.payload.business.logicalPageRules.map((rule) => ({
              ...rule,
              pageProfileId: "p-2",
            })),
          },
        },
      };

      expect(() => parseAndValidateBackupArchive(JSON.stringify(corrupted))).toThrow(InvalidBackupArchiveError);
    });

    it("includes Shared Template Sets and their Bindings in the Archive and round-trips them", () => {
      const state = sampleBusinessState();
      state.sharedTemplateSets = [
        { id: "set-1", siteId: "a.test", name: "Contact fields", memberFieldProfileIds: ["f-1"] },
      ];
      state.sharedTemplateBindings = [
        { id: "shared-binding-1", setId: "set-1", templateId: "t-1", usageCount: 2, revision: 0, order: 0 },
      ];

      const archive = createBackupArchive(state, sampleActivationState(), {
        createdAt: "2026-08-21T00:00:00.000Z",
      });

      expect(archive.payload.business.sharedTemplateSets).toEqual(state.sharedTemplateSets);
      expect(archive.payload.business.sharedTemplateBindings).toEqual(state.sharedTemplateBindings);

      const restored = parseAndValidateBackupArchive(serializeBackupArchive(archive));
      expect(restored.payload.business.sharedTemplateSets).toEqual(state.sharedTemplateSets);
      expect(restored.payload.business.sharedTemplateBindings).toEqual(state.sharedTemplateBindings);
    });

    it("restores an archive with no Shared Template Set data as empty, inferring no set", () => {
      const archive = createBackupArchive(sampleBusinessState(), sampleActivationState(), {
        createdAt: "2026-08-21T00:00:00.000Z",
      });
      const olderShape = { ...archive.payload.business } as Record<string, unknown>;
      delete olderShape.sharedTemplateSets;
      delete olderShape.sharedTemplateBindings;
      const olderArchiveJson = JSON.stringify({
        ...archive,
        payload: { ...archive.payload, business: olderShape },
      });

      const restored = parseAndValidateBackupArchive(olderArchiveJson);

      expect(restored.payload.business.sharedTemplateSets).toEqual([]);
      expect(restored.payload.business.sharedTemplateBindings).toEqual([]);
    });

    it("includes Compatibility pair decisions in the Archive and round-trips them (Task 024)", () => {
      const state = sampleBusinessState();
      state.compatibilityPairDecisions = [
        { id: "decision-1", fieldProfileIdA: "f-1", fieldProfileIdB: "f-2", createdAt: "2026-09-02T00:00:00.000Z" },
      ];

      const archive = createBackupArchive(state, sampleActivationState(), {
        createdAt: "2026-08-21T00:00:00.000Z",
      });

      expect(archive.payload.business.compatibilityPairDecisions).toEqual(state.compatibilityPairDecisions);

      const restored = parseAndValidateBackupArchive(serializeBackupArchive(archive));
      expect(restored.payload.business.compatibilityPairDecisions).toEqual(state.compatibilityPairDecisions);
    });

    it("restores an archive with no Compatibility pair decision data as empty (an older export)", () => {
      const archive = createBackupArchive(sampleBusinessState(), sampleActivationState(), {
        createdAt: "2026-08-21T00:00:00.000Z",
      });
      const olderShape = { ...archive.payload.business } as Record<string, unknown>;
      delete olderShape.compatibilityPairDecisions;
      const olderArchiveJson = JSON.stringify({
        ...archive,
        payload: { ...archive.payload, business: olderShape },
      });

      const restored = parseAndValidateBackupArchive(olderArchiveJson);

      expect(restored.payload.business.compatibilityPairDecisions).toEqual([]);
    });

    it("rejects a Compatibility pair decision referencing a Field that does not exist (relational invariant, not just shape)", () => {
      const state = sampleBusinessState();
      const archive = createBackupArchive(state, sampleActivationState(), {
        createdAt: "2026-08-21T00:00:00.000Z",
      });

      // "missing" is not any real Field - createBackupArchive's own
      // current-state validation would never allow this to be exported, so
      // the corruption is applied to the already-serialized archive instead,
      // exercising Restore's own untrusted-input rejection independently.
      const corrupted = {
        ...archive,
        payload: {
          ...archive.payload,
          business: {
            ...archive.payload.business,
            compatibilityPairDecisions: [
              { id: "decision-1", fieldProfileIdA: "f-1", fieldProfileIdB: "missing", createdAt: "2026-09-02T00:00:00.000Z" },
            ],
          },
        },
      };

      expect(() => parseAndValidateBackupArchive(JSON.stringify(corrupted))).toThrow(InvalidBackupArchiveError);
    });

    // Task 024 Confirmed Contract: a Shared Template Set spanning Sites is
    // now valid, restorable data - Task 024 is the only authorized way to
    // create one (through explicit Link confirmation), but once created it
    // round-trips through Backup/Restore like any other Shared Template Set.
    it("round-trips a Shared Template Set whose members span two Sites (Task 024)", () => {
      const state = sampleBusinessState();
      state.sharedTemplateSets = [
        { id: "set-1", siteId: "a.test", name: "Cross-site set", memberFieldProfileIds: ["f-1", "f-2"] },
      ];
      const archive = createBackupArchive(state, sampleActivationState(), {
        createdAt: "2026-08-21T00:00:00.000Z",
      });

      expect(archive.payload.business.sharedTemplateSets).toEqual(state.sharedTemplateSets);
      const restored = parseAndValidateBackupArchive(serializeBackupArchive(archive));
      expect(restored.payload.business.sharedTemplateSets).toEqual(state.sharedTemplateSets);
    });

    it("creates a canonical, deterministically sorted archive including identityKey", () => {
      const archive = createBackupArchive(sampleBusinessState(), sampleActivationState(), {
        createdAt: "2026-08-21T00:00:00.000Z",
        appVersion: "1.0.0",
      });

      expect(archive.format).toBe(BACKUP_ARCHIVE_FORMAT);
      expect(archive.archiveVersion).toBe(CURRENT_ARCHIVE_VERSION);
      expect(archive.createdAt).toBe("2026-08-21T00:00:00.000Z");
      expect(archive.appVersion).toBe("1.0.0");

      // Verify pageProfiles and fieldProfiles preserve identityKey
      expect(archive.payload.business.pageProfiles.find((p) => p.id === "p-1")?.identityKey).toBe("page-key-1");
      expect(archive.payload.business.fieldProfiles.find((f) => f.id === "f-1")?.identityKey).toBe("field-key-1");

      const json = serializeBackupArchive(archive);
      const reparsed = parseAndValidateBackupArchive(json);

      // Verify round-trip preserves identityKey and canonical sorting
      expect(reparsed.payload.business.sites.map((s) => s.id)).toEqual(["a.test", "b.test"]);
      expect(reparsed.payload.business.templates.map((t) => t.id)).toEqual(["t-1", "t-2"]);
      expect(reparsed.payload.business.pageProfiles.map((p) => p.identityKey)).toEqual(["page-key-1", "page-key-2"]);
      expect(reparsed.payload.business.fieldProfiles.map((f) => f.identityKey)).toEqual(["field-key-1", "field-key-2"]);
      expect(reparsed.payload.business.fieldProfiles.find((field) => field.id === "f-2")?.documentOrder).toBe(2);
      expect(reparsed.payload.activation.origins.map((o) => o.origin)).toEqual([
        "http://b.test:80",
        "https://a.test:443",
      ]);
    });
  });

  describe("parseAndValidateBackupArchive validation", () => {
    it("rejects non-JSON string", () => {
      expect(() => parseAndValidateBackupArchive("not a json string")).toThrow(InvalidBackupArchiveError);
    });

    it("rejects non-object top-level JSON", () => {
      expect(() => parseAndValidateBackupArchive("[]")).toThrow(InvalidBackupArchiveError);
      expect(() => parseAndValidateBackupArchive('"string"')).toThrow(InvalidBackupArchiveError);
    });

    it("rejects unknown top-level properties", () => {
      const archive = createBackupArchive(sampleBusinessState(), sampleActivationState(), {
        createdAt: "2026-08-21T00:00:00.000Z",
      });
      const invalid = { ...archive, extraField: "malicious" };
      expect(() => parseAndValidateBackupArchive(JSON.stringify(invalid))).toThrow(InvalidBackupArchiveError);
    });

    it("rejects unknown properties in business payload", () => {
      const archive = createBackupArchive(sampleBusinessState(), sampleActivationState(), {
        createdAt: "2026-08-21T00:00:00.000Z",
      });
      const invalid = {
        ...archive,
        payload: {
          ...archive.payload,
          business: {
            ...archive.payload.business,
            extraTable: [],
          },
        },
      };
      expect(() => parseAndValidateBackupArchive(JSON.stringify(invalid))).toThrow(InvalidBackupArchiveError);
    });

    it("rejects unknown properties in templates", () => {
      const archive = createBackupArchive(sampleBusinessState(), sampleActivationState(), {
        createdAt: "2026-08-21T00:00:00.000Z",
      });
      const invalid = {
        ...archive,
        payload: {
          ...archive.payload,
          business: {
            ...archive.payload.business,
            templates: [
              {
                ...archive.payload.business.templates[0],
                unknownTag: "test",
              },
            ],
          },
        },
      };
      expect(() => parseAndValidateBackupArchive(JSON.stringify(invalid))).toThrow(InvalidBackupArchiveError);
    });

    it("rejects unknown properties in pageProfiles and fieldProfiles", () => {
      const archive = createBackupArchive(sampleBusinessState(), sampleActivationState(), {
        createdAt: "2026-08-21T00:00:00.000Z",
      });
      const invalidPage = {
        ...archive,
        payload: {
          ...archive.payload,
          business: {
            ...archive.payload.business,
            pageProfiles: [
              {
                ...archive.payload.business.pageProfiles[0],
                unknownProp: 123,
              },
            ],
          },
        },
      };
      expect(() => parseAndValidateBackupArchive(JSON.stringify(invalidPage))).toThrow(InvalidBackupArchiveError);
    });

    it("rejects unknown properties in activation origins", () => {
      const archive = createBackupArchive(sampleBusinessState(), sampleActivationState(), {
        createdAt: "2026-08-21T00:00:00.000Z",
      });
      const invalid = {
        ...archive,
        payload: {
          ...archive.payload,
          activation: {
            ...archive.payload.activation,
            origins: [
              {
                origin: "https://a.test:443",
                mode: "active",
                extraMetadata: "injected",
              },
            ],
          },
        },
      };
      expect(() => parseAndValidateBackupArchive(JSON.stringify(invalid))).toThrow(InvalidBackupArchiveError);
    });

    it("rejects non-canonical permission origins in activation payload", () => {
      const archive = createBackupArchive(sampleBusinessState(), sampleActivationState(), {
        createdAt: "2026-08-21T00:00:00.000Z",
      });
      const invalid = {
        ...archive,
        payload: {
          ...archive.payload,
          activation: {
            ...archive.payload.activation,
            origins: [
              { origin: "https://a.test/*", mode: "active" }, // Wildcard path is invalid origin
            ],
          },
        },
      };
      expect(() => parseAndValidateBackupArchive(JSON.stringify(invalid))).toThrow(InvalidBackupArchiveError);
    });

    it("rejects unsupported archive versions", () => {
      const archive = createBackupArchive(sampleBusinessState(), sampleActivationState(), {
        createdAt: "2026-08-21T00:00:00.000Z",
      });
      const future = { ...archive, archiveVersion: 99 };
      expect(() => parseAndValidateBackupArchive(JSON.stringify(future))).toThrow(
        /newer than supported version/,
      );
    });

    it("rejects invalid non-ISO createdAt string", () => {
      const archive = createBackupArchive(sampleBusinessState(), sampleActivationState(), {
        createdAt: "2026-08-21T00:00:00.000Z",
      });
      const invalid = { ...archive, createdAt: "2026/08/21 10:00:00" };
      expect(() => parseAndValidateBackupArchive(JSON.stringify(invalid))).toThrow(
        /ISO 8601 UTC date string/,
      );
    });

    it("rejects impossible ISO-shaped Template and Binding dates", () => {
      const archive = createBackupArchive(sampleBusinessState(), sampleActivationState(), {
        createdAt: "2026-08-21T00:00:00.000Z",
      });
      const invalidTemplateDate = {
        ...archive,
        payload: {
          ...archive.payload,
          business: {
            ...archive.payload.business,
            templates: [{ ...archive.payload.business.templates[0]!, createdAt: "2026-99-99T99:99:99Z" }],
          },
        },
      };
      expect(() => parseAndValidateBackupArchive(JSON.stringify(invalidTemplateDate))).toThrow(
        /ISO 8601 UTC date string/,
      );
    });

    it("rejects oversized content", () => {
      const business = sampleBusinessState();
      business.templates[0]!.content = "x".repeat(MAX_TEMPLATE_CONTENT_LENGTH + 1);
      expect(() => createBackupArchive(business, sampleActivationState())).toThrow(
        OversizedBackupArchiveError,
      );
    });

    it("rejects an oversized Site id", () => {
      const longId = "x".repeat(MAX_SITE_ID_LENGTH + 1);
      const business: FillNestState = {
        schemaVersion: 13,
        compatibilityPairDecisions: [],
        sites: [{ id: longId }],
        templates: [
          {
            id: "t-1",
            content: "Template",
            siteAffinities: [longId],
            createdAt: "2026-08-21T00:00:00.000Z",
            updatedAt: "2026-08-21T00:00:00.000Z",
            totalUsageCount: 0,
            revision: 0,
          },
        ],
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
      };
      expect(() => createBackupArchive(business, sampleActivationState())).toThrow(
        OversizedBackupArchiveError,
      );
    });

    it("rejects a Template with more Site Affinities than the safety limit", () => {
      const manySites = Array.from({ length: MAX_SITE_AFFINITIES_PER_TEMPLATE + 1 }, (_, i) => `site-${i}.test`);
      const business: FillNestState = {
        schemaVersion: 13,
        compatibilityPairDecisions: [],
        sites: manySites.map((id) => ({ id })),
        templates: [
          {
            id: "t-1",
            content: "Template",
            siteAffinities: manySites,
            createdAt: "2026-08-21T00:00:00.000Z",
            updatedAt: "2026-08-21T00:00:00.000Z",
            totalUsageCount: 0,
            revision: 0,
          },
        ],
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
      };
      expect(() => createBackupArchive(business, sampleActivationState())).toThrow(
        OversizedBackupArchiveError,
      );
    });

    // Regression: validation errors used to echo unbounded archive content -
    // an attacker-supplied archive could place arbitrary-length text into
    // the Side Panel's error banner via, e.g., an unrecognized property name.
    it("truncates an unbounded property name echoed into a validation error", () => {
      const archive = createBackupArchive(sampleBusinessState(), sampleActivationState());
      const longKey = "z".repeat(500);
      const malformed = {
        ...archive,
        payload: {
          ...archive.payload,
          business: { ...archive.payload.business, [longKey]: [] },
        },
      };
      expect(() => parseAndValidateBackupArchive(JSON.stringify(malformed))).toThrow(
        /^Unknown business property: z{64}…$/,
      );
    });
  });
});
