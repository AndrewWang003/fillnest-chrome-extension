import type { ActivationMode, ActivationState } from "../activation/activation-repository";
import type { FillNestState } from "../storage/fillnest-repository";
import { serializeBackupArchive, type BackupArchiveV1 } from "./archive-contract";

export interface RestoreCountPair {
  current: number;
  backup: number;
}

export interface RestoreImpactPreview {
  templates: RestoreCountPair;
  sites: RestoreCountPair;
  pageProfiles: RestoreCountPair;
  fieldProfiles: RestoreCountPair;
  bindings: RestoreCountPair;
  aliases: RestoreCountPair;
  logicalPageRules: RestoreCountPair;
  sharedTemplateSets: RestoreCountPair;
  globalActivation: {
    current: ActivationMode;
    backup: ActivationMode;
  };
  authorizedOriginsActive: RestoreCountPair;
  authorizedOriginsPaused: RestoreCountPair;
  dormantOriginsCount: number;
  pickerPositionSaved: {
    current: boolean;
    backup: boolean;
  };
  hasCurrentData: boolean;
  websiteAccessNotice: string;
}

// Used for stale confirmation of an irreversible whole-dataset replacement.
// A cryptographic digest is used
// rather than a checksum so that two different states of the same length
// (a single-character Template edit, two aliases swapping) cannot collide.
async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function computeRestoreImpact(
  currentBusiness: FillNestState,
  currentActivation: ActivationState,
  grantedOrigins: string[],
  backup: BackupArchiveV1,
): Promise<{ preview: RestoreImpactPreview; confirmationToken: string }> {
  const currentAliases =
    currentBusiness.pageProfiles.filter((p) => p.userAlias !== undefined).length +
    currentBusiness.fieldProfiles.filter((f) => f.userAlias !== undefined).length;

  const backupAliases =
    backup.payload.business.pageProfiles.filter((p) => p.userAlias !== undefined).length +
    backup.payload.business.fieldProfiles.filter((f) => f.userAlias !== undefined).length;

  const grantedSet = new Set(grantedOrigins);
  const backupOriginMap = new Map(backup.payload.activation.origins.map((o) => [o.origin, o.mode]));
  const currentOriginMap = new Map(currentActivation.origins.map((o) => [o.origin, o.mode]));

  let currentAuthorizedActive = 0;
  let currentAuthorizedPaused = 0;
  let backupAuthorizedActive = 0;
  let backupAuthorizedPaused = 0;

  for (const origin of grantedOrigins) {
    const curMode = currentOriginMap.get(origin) ?? "active";
    if (curMode === "active") currentAuthorizedActive++;
    else currentAuthorizedPaused++;

    const bkpMode = backupOriginMap.get(origin) ?? "active";
    if (bkpMode === "active") backupAuthorizedActive++;
    else backupAuthorizedPaused++;
  }

  let dormantOriginsCount = 0;
  for (const originRecord of backup.payload.activation.origins) {
    if (!grantedSet.has(originRecord.origin)) {
      dormantOriginsCount++;
    }
  }

  const hasCurrentData = isStateNonEmpty(currentBusiness, currentActivation);

  const preview: RestoreImpactPreview = {
    templates: {
      current: currentBusiness.templates.length,
      backup: backup.payload.business.templates.length,
    },
    sites: {
      current: currentBusiness.sites.length,
      backup: backup.payload.business.sites.length,
    },
    pageProfiles: {
      current: currentBusiness.pageProfiles.length,
      backup: backup.payload.business.pageProfiles.length,
    },
    fieldProfiles: {
      current: currentBusiness.fieldProfiles.length,
      backup: backup.payload.business.fieldProfiles.length,
    },
    bindings: {
      current: currentBusiness.bindings.length,
      backup: backup.payload.business.bindings.length,
    },
    aliases: {
      current: currentAliases,
      backup: backupAliases,
    },
    logicalPageRules: {
      current: currentBusiness.logicalPageRules.length,
      backup: backup.payload.business.logicalPageRules.length,
    },
    sharedTemplateSets: {
      current: currentBusiness.sharedTemplateSets.length,
      backup: backup.payload.business.sharedTemplateSets.length,
    },
    globalActivation: {
      current: currentActivation.global,
      backup: backup.payload.activation.global,
    },
    authorizedOriginsActive: {
      current: currentAuthorizedActive,
      backup: backupAuthorizedActive,
    },
    authorizedOriginsPaused: {
      current: currentAuthorizedPaused,
      backup: backupAuthorizedPaused,
    },
    dormantOriginsCount,
    pickerPositionSaved: {
      current: currentBusiness.pickerPosition !== null,
      backup: backup.payload.business.pickerPosition !== null,
    },
    hasCurrentData,
    websiteAccessNotice:
      "Chrome Website Access is not restored from backups. Restored website preferences for sites without granted access will remain dormant until you explicitly enable them.",
  };

  const confirmationToken = await computeConfirmationToken(
    currentBusiness,
    currentActivation,
    grantedOrigins,
    backup,
  );

  return { preview, confirmationToken };
}

export function isStateNonEmpty(
  business: FillNestState,
  activation: ActivationState,
): boolean {
  return (
    business.templates.length > 0 ||
    business.sites.length > 0 ||
    business.pageProfiles.length > 0 ||
    business.fieldProfiles.length > 0 ||
    business.bindings.length > 0 ||
    business.pickerPosition !== null ||
    activation.origins.length > 0 ||
    (activation.dormantOrigins !== undefined && activation.dormantOrigins.length > 0) ||
    activation.global === "active"
  );
}

export async function computeTargetArchiveDigest(archive: BackupArchiveV1): Promise<string> {
  const serialized = serializeBackupArchive(archive);
  return sha256Hex(serialized);
}

export async function computeConfirmationToken(
  business: FillNestState,
  activation: ActivationState,
  grantedOrigins: string[],
  archive: BackupArchiveV1,
): Promise<string> {
  const currentPayload = JSON.stringify({
    schemaVersion: business.schemaVersion,
    sites: business.sites.map((s) => s.id).sort(),
    templates: business.templates
      .map((t) => ({
        id: t.id,
        content: t.content,
        siteAffinities: [...t.siteAffinities].sort(),
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        totalUsageCount: t.totalUsageCount,
        revision: t.revision,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    pageProfiles: business.pageProfiles
      .map((p) => ({
        id: p.id,
        siteId: p.siteId,
        userAlias: p.userAlias ?? null,
        identityKey: p.identityKey ?? null,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    fieldProfiles: business.fieldProfiles
      .map((f) => ({
        id: f.id,
        pageProfileId: f.pageProfileId,
        userAlias: f.userAlias ?? null,
        identityKey: f.identityKey ?? null,
        documentOrder: f.documentOrder ?? null,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    bindings: business.bindings
      .map((b) => ({
        id: b.id,
        templateId: b.templateId,
        pageProfileId: b.pageProfileId,
        fieldProfileId: b.fieldProfileId,
        createdAt: b.createdAt,
        usageCount: b.usageCount,
        revision: b.revision,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    pickerPosition: business.pickerPosition,
    logicalPageSiteKeys: business.logicalPageSiteKeys
      .map((k) => ({ id: k.id, siteId: k.siteId, encodedHmacKey: k.encodedHmacKey }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    logicalPageRules: business.logicalPageRules
      .map((r) => ({
        id: r.id,
        siteId: r.siteId,
        siteKeyId: r.siteKeyId,
        origin: r.origin,
        routePattern: r.routePattern,
        fieldFeatureHashes: [...r.fieldFeatureHashes].sort(),
        groupedFieldFeatureHashes: [...r.groupedFieldFeatureHashes].sort(),
        pageProfileId: r.pageProfileId,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    logicalPageProvenance: business.logicalPageProvenance
      .map((p) => ({
        id: p.id,
        ruleId: p.ruleId,
        origin: p.origin,
        sourcePageProfileId: p.sourcePageProfileId,
        canonicalPageProfileId: p.canonicalPageProfileId,
        fieldMappings: [...p.fieldMappings]
          .map((m) => ({
            sourceFieldProfileId: m.sourceFieldProfileId,
            canonicalFieldProfileId: m.canonicalFieldProfileId,
            bindingIds: [...m.bindingIds].sort(),
          }))
          .sort((a, b) => a.sourceFieldProfileId.localeCompare(b.sourceFieldProfileId)),
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    sharedTemplateSets: business.sharedTemplateSets
      .map((set) => ({
        id: set.id,
        siteId: set.siteId,
        name: set.name,
        memberFieldProfileIds: [...set.memberFieldProfileIds].sort(),
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    sharedTemplateBindings: business.sharedTemplateBindings
      .map((binding) => ({
        id: binding.id,
        setId: binding.setId,
        templateId: binding.templateId,
        usageCount: binding.usageCount,
        revision: binding.revision,
        order: binding.order,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    sharedTemplateFieldStates: business.sharedTemplateFieldStates
      .map((entry) =>
        entry.mode === "override"
          ? {
              id: entry.id,
              setId: entry.setId,
              slotId: entry.slotId,
              fieldProfileId: entry.fieldProfileId,
              mode: entry.mode,
              templateId: entry.templateId,
              usageCount: entry.usageCount,
              revision: entry.revision,
            }
          : {
              id: entry.id,
              setId: entry.setId,
              slotId: entry.slotId,
              fieldProfileId: entry.fieldProfileId,
              mode: entry.mode,
            },
      )
      .sort((a, b) => a.id.localeCompare(b.id)),
    activation: {
      global: activation.global,
      origins: activation.origins
        .map((o) => ({ origin: o.origin, mode: o.mode }))
        .sort((a, b) => a.origin.localeCompare(b.origin)),
      dormantOrigins: (activation.dormantOrigins ?? [])
        .map((o) => ({ origin: o.origin, mode: o.mode }))
        .sort((a, b) => a.origin.localeCompare(b.origin)),
    },
    grantedOrigins: [...grantedOrigins].sort(),
    targetArchiveDigest: await computeTargetArchiveDigest(archive),
  });

  return `cfn-${await sha256Hex(currentPayload)}`;
}
