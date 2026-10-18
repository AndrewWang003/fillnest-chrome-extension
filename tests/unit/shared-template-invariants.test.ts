import { describe, expect, it } from "vitest";
import { FillNestRepository, InvalidStoredDataError, type LocalStorageArea } from "../../src/storage/fillnest-repository";
class Mem implements LocalStorageArea {
  values: Record<string, unknown> = {};
  async get(k: string) { return k in this.values ? { [k]: structuredClone(this.values[k]) } : {}; }
  async set(i: Record<string, unknown>) { Object.assign(this.values, structuredClone(i)); }
  async remove(k: string) { delete this.values[k]; }
}
const base = {
  schemaVersion: 13 as const, compatibilityPairDecisions: [], sites: [{ id: "a.test" }],
  templates: [{ id: "t", content: "t", siteAffinities: ["a.test"], createdAt: "x", updatedAt: "x", totalUsageCount: 0, revision: 0 }],
  pageProfiles: [{ id: "p1", siteId: "a.test" }, { id: "p2", siteId: "a.test" }],
  fieldProfiles: [{ id: "f1", pageProfileId: "p1" }, { id: "f2", pageProfileId: "p2" }],
  bindings: [], logicalPageSiteKeys: [], logicalPageRules: [], logicalPageProvenance: [],
  logicalPageObservations: [], sharedTemplateSets: [], sharedTemplateBindings: [],
  sharedTemplateFieldStates: [], pickerPosition: null, pageStatusPosition: null,
};
const set = { id: "s1", siteId: "a.test", name: "S", memberFieldProfileIds: ["f1", "f2"] };
const slot = (over: Record<string, unknown>) => ({ id: "sl1", setId: "s1", templateId: "t", usageCount: 0, revision: 0, order: 0, ...over });

// Task 031 slice 2 moved every Shared Template Set invariant into
// shared-templates.ts. A refactor that silently disabled one of them would
// still pass the rest of the suite, so each is asserted to still reject.
describe("Shared Template Set stored-data invariants", () => {
  const cases: [string, Record<string, unknown>][] = [
    ["owner outside the Set", { sharedTemplateSets: [set], sharedTemplateBindings: [slot({ ownerFieldProfileId: "ghost" })] }],
    ["duplicate setId:templateId:owner", { sharedTemplateSets: [set], sharedTemplateBindings: [slot({}), slot({ id: "sl2", order: 1 })] }],
    ["duplicate order in one Set", { sharedTemplateSets: [set], sharedTemplateBindings: [slot({}), slot({ id: "sl2", templateId: "t", ownerFieldProfileId: "f1", order: 0 })] }],
    ["Field in two Sets", { sharedTemplateSets: [set, { id: "s2", siteId: "a.test", name: "T", memberFieldProfileIds: ["f1"] }] }],
    ["empty Set", { sharedTemplateSets: [{ id: "s3", siteId: "a.test", name: "E", memberFieldProfileIds: [] }] }],
    ["field state on a non-member", { sharedTemplateSets: [{ ...set, memberFieldProfileIds: ["f1"] }], sharedTemplateBindings: [slot({})], sharedTemplateFieldStates: [{ id: "fs", setId: "s1", slotId: "sl1", fieldProfileId: "f2", mode: "exclude" }] }],
    ["field state on a missing slot", { sharedTemplateSets: [set], sharedTemplateBindings: [slot({})], sharedTemplateFieldStates: [{ id: "fs", setId: "s1", slotId: "ghost", fieldProfileId: "f1", mode: "exclude" }] }],
  ];
  for (const [name, overrides] of cases) {
    it(`rejects: ${name}`, async () => {
      const repo = new FillNestRepository(new Mem());
      await expect(repo.replaceState({ ...base, ...overrides })).rejects.toBeInstanceOf(InvalidStoredDataError);
    });
  }
});
