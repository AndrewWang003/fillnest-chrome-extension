// Task 024 Addendum D (2026-09-11 audit). A remembered "No" names two Fields.
// When Clear Site Data or Remove Site deletes one of them, the decision has
// nothing left to describe and must go with it. It used to stay behind, fail
// the repository's own integrity check, and refuse the whole Site cleanup.

import { describe, expect, it } from "vitest";
import { FillNestRepository, type LocalStorageArea } from "../../src/storage/fillnest-repository";

function repository(): FillNestRepository {
  let id = 0;
  const data: Record<string, unknown> = {};
  const storage: LocalStorageArea = {
    async get(key) {
      return { [key]: data[key] };
    },
    async set(items) {
      Object.assign(data, structuredClone(items));
    },
    async remove(key) {
      delete data[key];
    },
  };
  return new FillNestRepository(storage, { createId: () => `id-${++id}`, now: () => "2026-09-11T00:00:00.000Z" });
}

describe("a remembered compatibility No", () => {
  it("is removed with a Field that Clear Site Data deletes", async () => {
    const repo = repository();
    await repo.createTemplateAndBind({
      content: "A",
      pageUrl: "https://a.test/form",
      pageProfileId: "page-a",
      fieldProfileId: "field-a",
    });
    await repo.createTemplateAndBind({
      content: "B",
      pageUrl: "https://b.test/form",
      pageProfileId: "page-b",
      fieldProfileId: "field-b",
    });
    await repo.recordCompatibilityPairNo({ fieldProfileIdA: "field-a", fieldProfileIdB: "field-b" });

    await repo.resetSiteMappingsBatch({ sites: [{ siteId: "a.test" }] });

    const state = await repo.read();
    expect(state.fieldProfiles.map((field) => field.id)).toEqual(["field-b"]);
    expect(state.compatibilityPairDecisions).toEqual([]);
  });

  it("survives Clear Site Data of an unrelated Site", async () => {
    const repo = repository();
    for (const [site, field] of [["a", "field-a"], ["b", "field-b"], ["c", "field-c"]] as const) {
      await repo.createTemplateAndBind({
        content: site,
        pageUrl: `https://${site}.test/form`,
        pageProfileId: `page-${site}`,
        fieldProfileId: field,
      });
    }
    await repo.recordCompatibilityPairNo({ fieldProfileIdA: "field-a", fieldProfileIdB: "field-b" });

    await repo.resetSiteMappingsBatch({ sites: [{ siteId: "c.test" }] });

    expect((await repo.read()).compatibilityPairDecisions).toHaveLength(1);
  });
});
