import { describe, expect, it } from "vitest";

import {
  createBackupArchive,
  generateBackupFilename,
  parseAndValidateBackupArchive,
  serializeBackupArchive,
} from "../../src/backup/archive-contract";
import type { FillNestState } from "../../src/storage/fillnest-repository";

describe("Backup Export Flow", () => {
  const business: FillNestState = {
    schemaVersion: 13,
    compatibilityPairDecisions: [],
    sites: [{ id: "example.test" }],
    templates: [
      {
        id: "t-1",
        content: "Exportable content",
        siteAffinities: ["example.test"],
        createdAt: "2026-08-21T06:00:00.000Z",
        updatedAt: "2026-08-21T06:00:00.000Z",
        totalUsageCount: 4,
        revision: 1,
      },
    ],
    pageProfiles: [{ id: "p-1", siteId: "example.test", userAlias: "Billing" }],
    fieldProfiles: [{ id: "f-1", pageProfileId: "p-1", userAlias: "Email input" }],
    bindings: [
      {
        id: "b-1",
        templateId: "t-1",
        pageProfileId: "p-1",
        fieldProfileId: "f-1",
        createdAt: "2026-08-21T06:00:00.000Z",
        usageCount: 4,
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
    pickerPosition: { top: 50, left: 100 },
    pageStatusPosition: null,
  };

  const activation = {
    global: "active" as const,
    origins: [{ origin: "https://example.test:443", mode: "active" as const }],
  };

  it("exports a valid, parseable and complete backup archive payload", () => {
    const archive = createBackupArchive(business, activation, {
      createdAt: "2026-08-21T06:00:00.000Z",
      appVersion: "0.1.0",
    });
    const filename = generateBackupFilename(archive.createdAt);
    const json = serializeBackupArchive(archive);

    expect(filename).toBe("fillnest-backup-2026-08-21.json");
    const parsed = parseAndValidateBackupArchive(json);

    expect(parsed.format).toBe("fillnest-backup");
    expect(parsed.archiveVersion).toBe(1);
    expect(parsed.appVersion).toBe("0.1.0");
    expect(parsed.payload.business.templates[0]!.content).toBe("Exportable content");
    expect(parsed.payload.business.pageProfiles[0]!.userAlias).toBe("Billing");
    expect(parsed.payload.business.fieldProfiles[0]!.userAlias).toBe("Email input");
    expect(parsed.payload.activation.global).toBe("active");
    expect(parsed.payload.activation.origins).toEqual([
      { origin: "https://example.test:443", mode: "active" },
    ]);
  });

  it("excludes transient runtime state and non-durable properties from the archive", () => {
    const archive = createBackupArchive(business, activation);
    const serialized = serializeBackupArchive(archive);
    const parsed = JSON.parse(serialized);

    expect(parsed).not.toHaveProperty("undo");
    expect(parsed).not.toHaveProperty("search");
    expect(parsed).not.toHaveProperty("permissionHostPatterns");
    expect(parsed).not.toHaveProperty("error");
  });

  it("round-trips Shared Template Set Slots, Overrides, and Exclusions (Task 026)", () => {
    const businessWithSharing: FillNestState = {
      ...business,
      templates: [
        ...business.templates,
        {
          id: "t-shared",
          content: "Shared base",
          siteAffinities: ["example.test"],
          createdAt: "2026-08-21T06:00:00.000Z",
          updatedAt: "2026-08-21T06:00:00.000Z",
          totalUsageCount: 0,
          revision: 0,
        },
        {
          id: "t-override",
          content: "One field's own version",
          siteAffinities: ["example.test"],
          createdAt: "2026-08-21T06:00:00.000Z",
          updatedAt: "2026-08-21T06:00:00.000Z",
          totalUsageCount: 0,
          revision: 0,
        },
      ],
      fieldProfiles: [...business.fieldProfiles, { id: "f-2", pageProfileId: "p-1" }],
      sharedTemplateSets: [
        { id: "set-1", siteId: "example.test", name: "Shared fields", memberFieldProfileIds: ["f-1", "f-2"] },
      ],
      sharedTemplateBindings: [
        { id: "slot-1", setId: "set-1", templateId: "t-shared", usageCount: 0, revision: 0, order: 0 },
      ],
      sharedTemplateFieldStates: [
        {
          id: "state-override",
          setId: "set-1",
          slotId: "slot-1",
          fieldProfileId: "f-1",
          mode: "override",
          templateId: "t-override",
          usageCount: 0,
          revision: 0,
        },
        { id: "state-exclude", setId: "set-1", slotId: "slot-1", fieldProfileId: "f-2", mode: "exclude" },
      ],
    };

    const archive = createBackupArchive(businessWithSharing, activation, {
      createdAt: "2026-08-21T06:00:00.000Z",
      appVersion: "0.1.0",
    });
    const parsed = parseAndValidateBackupArchive(serializeBackupArchive(archive));

    expect(parsed.payload.business.sharedTemplateBindings).toEqual([
      { id: "slot-1", setId: "set-1", templateId: "t-shared", usageCount: 0, revision: 0, order: 0 },
    ]);
    expect([...parsed.payload.business.sharedTemplateFieldStates].sort((a, b) => a.id.localeCompare(b.id))).toEqual(
      [
        {
          id: "state-override",
          setId: "set-1",
          slotId: "slot-1",
          fieldProfileId: "f-1",
          mode: "override",
          templateId: "t-override",
          usageCount: 0,
          revision: 0,
        },
        { id: "state-exclude", setId: "set-1", slotId: "slot-1", fieldProfileId: "f-2", mode: "exclude" },
      ].sort((a, b) => a.id.localeCompare(b.id)),
    );
  });

  it("round-trips a Field-only relationship's ownerFieldProfileId (Task 027)", () => {
    const businessWithFieldOnly: FillNestState = {
      ...business,
      templates: [
        ...business.templates,
        {
          id: "t-private",
          content: "Field-only content",
          siteAffinities: ["example.test"],
          createdAt: "2026-08-21T06:00:00.000Z",
          updatedAt: "2026-08-21T06:00:00.000Z",
          totalUsageCount: 0,
          revision: 0,
        },
      ],
      fieldProfiles: [...business.fieldProfiles, { id: "f-2", pageProfileId: "p-1" }],
      sharedTemplateSets: [
        { id: "set-1", siteId: "example.test", name: "Shared fields", memberFieldProfileIds: ["f-1", "f-2"] },
      ],
      sharedTemplateBindings: [
        { id: "slot-private", setId: "set-1", templateId: "t-private", usageCount: 0, revision: 0, order: 0, ownerFieldProfileId: "f-1" },
      ],
    };

    const archive = createBackupArchive(businessWithFieldOnly, activation, {
      createdAt: "2026-08-21T06:00:00.000Z",
      appVersion: "0.1.0",
    });
    const parsed = parseAndValidateBackupArchive(serializeBackupArchive(archive));

    expect(parsed.payload.business.sharedTemplateBindings).toEqual([
      { id: "slot-private", setId: "set-1", templateId: "t-private", usageCount: 0, revision: 0, order: 0, ownerFieldProfileId: "f-1" },
    ]);
  });

  it("preserves dormant Origin Activation preferences as restorable preferences", () => {
    const archive = createBackupArchive(business, {
      global: "active",
      origins: [{ origin: "https://example.test:443", mode: "active" }],
      dormantOrigins: [{ origin: "https://offline.example.test:443", mode: "paused" }],
    });

    expect(parseAndValidateBackupArchive(serializeBackupArchive(archive)).payload.activation.origins).toEqual([
      { origin: "https://example.test:443", mode: "active" },
      { origin: "https://offline.example.test:443", mode: "paused" },
    ]);
  });
});
