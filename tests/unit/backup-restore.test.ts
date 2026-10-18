import { describe, expect, it } from "vitest";

import {
  createBackupArchive,
} from "../../src/backup/archive-contract";
import {
  computeConfirmationToken,
  computeRestoreImpact,
} from "../../src/backup/restore-impact";
import {
  type FillNestState,
} from "../../src/storage/fillnest-repository";

describe("Backup Restore Flow & Safety Gating", () => {
  const currentBusiness: FillNestState = {
    schemaVersion: 13,
    compatibilityPairDecisions: [],
    sites: [{ id: "current.test" }],
    templates: [
      {
        id: "t-current",
        content: "Current template",
        siteAffinities: ["current.test"],
        createdAt: "2026-08-20T00:00:00.000Z",
        updatedAt: "2026-08-20T00:00:00.000Z",
        totalUsageCount: 5,
        revision: 2,
      },
    ],
    pageProfiles: [{ id: "p-current", siteId: "current.test", userAlias: "Current page", identityKey: "page-key-cur" }],
    fieldProfiles: [{ id: "f-current", pageProfileId: "p-current", userAlias: "Current field", identityKey: "field-key-cur" }],
    bindings: [
      {
        id: "b-current",
        templateId: "t-current",
        pageProfileId: "p-current",
        fieldProfileId: "f-current",
        createdAt: "2026-08-20T00:00:00.000Z",
        usageCount: 5,
        revision: 2,
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
  };

  const currentActivation = {
    schemaVersion: 1 as const,
    global: "active" as const,
    origins: [
      { origin: "https://current.test:443", mode: "active" as const },
      { origin: "https://authorized-both.test:443", mode: "active" as const },
    ],
    dormantOrigins: [],
  };

  const backupBusiness: FillNestState = {
    schemaVersion: 13,
    compatibilityPairDecisions: [],
    sites: [{ id: "backup.test" }],
    templates: [
      {
        id: "t-backup-1",
        content: "Backup template 1",
        siteAffinities: ["backup.test"],
        createdAt: "2026-08-10T00:00:00.000Z",
        updatedAt: "2026-08-10T00:00:00.000Z",
        totalUsageCount: 1,
        revision: 0,
      },
      {
        id: "t-backup-2",
        content: "Backup template 2",
        siteAffinities: ["backup.test"],
        createdAt: "2026-08-10T00:00:00.000Z",
        updatedAt: "2026-08-10T00:00:00.000Z",
        totalUsageCount: 2,
        revision: 0,
      },
    ],
    pageProfiles: [{ id: "p-backup", siteId: "backup.test", identityKey: "page-key-bkp" }],
    fieldProfiles: [{ id: "f-backup", pageProfileId: "p-backup", identityKey: "field-key-bkp" }],
    bindings: [
      {
        id: "b-backup",
        templateId: "t-backup-1",
        pageProfileId: "p-backup",
        fieldProfileId: "f-backup",
        createdAt: "2026-08-10T00:00:00.000Z",
        usageCount: 1,
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
    pickerPosition: { top: 120, left: 240 },
    pageStatusPosition: null,
  };

  const backupActivation = {
    global: "paused" as const,
    origins: [
      { origin: "https://authorized-both.test:443", mode: "paused" as const },
      { origin: "https://dormant-in-chrome.test:443", mode: "active" as const },
    ],
  };

  const backupArchive = createBackupArchive(backupBusiness, backupActivation, {
    createdAt: "2026-08-10T00:00:00.000Z",
  });

  describe("computeRestoreImpact", () => {
    it("accurately computes impact counts between current and backup state", async () => {
      const grantedOrigins = ["https://current.test:443", "https://authorized-both.test:443"];
      const { preview, confirmationToken } = await computeRestoreImpact(
        currentBusiness,
        currentActivation,
        grantedOrigins,
        backupArchive,
      );

      expect(preview.templates).toEqual({ current: 1, backup: 2 });
      expect(preview.sites).toEqual({ current: 1, backup: 1 });
      expect(preview.pageProfiles).toEqual({ current: 1, backup: 1 });
      expect(preview.fieldProfiles).toEqual({ current: 1, backup: 1 });
      expect(preview.bindings).toEqual({ current: 1, backup: 1 });
      expect(preview.aliases).toEqual({ current: 2, backup: 0 });
      expect(preview.globalActivation).toEqual({ current: "active", backup: "paused" });
      expect(preview.authorizedOriginsActive).toEqual({ current: 2, backup: 1 }); // current.test (fallback active) + authorized-both (paused) -> 1 active
      expect(preview.authorizedOriginsPaused).toEqual({ current: 0, backup: 1 });
      expect(preview.dormantOriginsCount).toBe(1);
      expect(preview.pickerPositionSaved).toEqual({ current: false, backup: true });
      expect(typeof confirmationToken).toBe("string");
    });

    it("reports non-empty current data for the optional backup reminder", async () => {
      const emptyBusiness: FillNestState = {
        schemaVersion: 13,
        compatibilityPairDecisions: [],
        sites: [],
        templates: [],
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
      const emptyActivation = {
        schemaVersion: 1 as const,
        global: "paused" as const,
        origins: [],
        dormantOrigins: [],
      };

      // Completely empty (global paused, origins empty)
      const emptyImpact = await computeRestoreImpact(emptyBusiness, emptyActivation, [], backupArchive);
      expect(emptyImpact.preview.hasCurrentData).toBe(false);

      // Global Activation only (active)
      const globalActiveImpact = await computeRestoreImpact(
        emptyBusiness,
        { ...emptyActivation, global: "active" },
        [],
        backupArchive,
      );
      expect(globalActiveImpact.preview.hasCurrentData).toBe(true);

      // Dormant origins only
      const dormantOnlyImpact = await computeRestoreImpact(
        emptyBusiness,
        { ...emptyActivation, dormantOrigins: [{ origin: "https://dormant.test:443", mode: "paused" }] },
        [],
        backupArchive,
      );
      expect(dormantOnlyImpact.preview.hasCurrentData).toBe(true);

      // Sites only
      const sitesOnly = await computeRestoreImpact(
        { ...emptyBusiness, sites: [{ id: "site.test" }] },
        emptyActivation,
        [],
        backupArchive,
      );
      expect(sitesOnly.preview.hasCurrentData).toBe(true);

      // Picker position only
      const pickerOnly = await computeRestoreImpact(
        { ...emptyBusiness, pickerPosition: { top: 50, left: 50 } },
        emptyActivation,
        [],
        backupArchive,
      );
      expect(pickerOnly.preview.hasCurrentData).toBe(true);
    });
  });

  describe("Confirmation Token Binding", () => {
    it("binds confirmation token to target archive content", async () => {
      const archiveA = createBackupArchive(backupBusiness, backupActivation, {
        createdAt: "2026-08-10T00:00:00.000Z",
      });
      const archiveB = createBackupArchive(
        {
          ...backupBusiness,
          templates: [{ ...backupBusiness.templates[0]!, content: "Different content" }],
        },
        backupActivation,
        { createdAt: "2026-08-10T00:00:00.000Z" },
      );

      const tokenA = await computeConfirmationToken(currentBusiness, currentActivation, [], archiveA);
      const tokenB = await computeConfirmationToken(currentBusiness, currentActivation, [], archiveB);

      expect(tokenA).not.toBe(tokenB);
    });

    it("invalidates confirmation token when current identityKey or granted origins mutate", async () => {
      const tokenInitial = await computeConfirmationToken(currentBusiness, currentActivation, ["https://current.test:443"], backupArchive);

      const mutatedIdentity = {
        ...currentBusiness,
        pageProfiles: [{ ...currentBusiness.pageProfiles[0]!, identityKey: "changed-key" }],
      };
      const tokenMutatedIdentity = await computeConfirmationToken(mutatedIdentity, currentActivation, ["https://current.test:443"], backupArchive);
      expect(tokenInitial).not.toBe(tokenMutatedIdentity);

      const tokenMutatedGranted = await computeConfirmationToken(currentBusiness, currentActivation, ["https://other.test:443"], backupArchive);
      expect(tokenInitial).not.toBe(tokenMutatedGranted);
    });

  });
});
