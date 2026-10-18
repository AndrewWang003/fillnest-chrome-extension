import { describe, expect, it } from "vitest";

import { FillNestRepository, type LocalStorageArea } from "../../src/storage/fillnest-repository";
import { buildSharedSetViews } from "../../src/templates/shared-set-view";

// Task 040 (owner decision 1A): a Set shows its shared list once, and under
// each member only how that member differs from it.

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

const field = (fieldProfileId: string, site: string, page: string) => ({
  pageUrl: `https://${site}/${page}`,
  pageProfileId: `${site}-${page}`,
  fieldProfileId,
});

async function divergentSet() {
  const repo = repository();
  const a = await repo.createTemplateAndBind({ ...field("a", "a.test", "form"), content: "A base" });
  const b = await repo.createTemplateAndBind({ ...field("b", "b.test", "chat"), content: "B base" });
  const { set, sharedBindings } = await repo.createSharedTemplateSet({ fieldProfileIds: ["a", "b"], allowCrossSite: true });
  const slotOf = (templateId: string) => sharedBindings.find((slot) => slot.templateId === templateId)!.id;
  await repo.saveTemplateOverrideForField({ setId: set.id, slotId: slotOf(a.template.id), fieldProfileId: "b", content: "B's own A" });
  await repo.excludeSharedTemplateForField({ setId: set.id, slotId: slotOf(b.template.id), fieldProfileId: "a" });
  await repo.createTemplateAndBindSharedFieldOnly({ setId: set.id, fieldProfileId: "a", content: "A private" });
  return { repo, set };
}

describe("buildSharedSetViews", () => {
  it("lists the shared Templates once, in Set order, without Field-only ones", async () => {
    const { repo } = await divergentSet();
    const [view] = buildSharedSetViews(await repo.read());
    expect(view!.sharedTemplates.map((template) => template.content)).toEqual(["A base", "B base"]);
  });

  it("counts the Sites its members are on", async () => {
    const { repo } = await divergentSet();
    const [view] = buildSharedSetViews(await repo.read());
    expect(view!.siteIds).toEqual(["a.test", "b.test"]);
  });

  it("puts each difference under the member it belongs to", async () => {
    const { repo } = await divergentSet();
    const [view] = buildSharedSetViews(await repo.read());
    const [a, b] = view!.members;

    expect(a!.fieldProfileId).toBe("a");
    expect(a!.page?.siteId).toBe("a.test");
    expect(a!.exclusions.map((template) => template.content)).toEqual(["B base"]);
    expect(a!.fieldOnly.map((template) => template.content)).toEqual(["A private"]);
    expect(a!.overrides).toEqual([]);

    expect(b!.overrides.map(({ base, own }) => [base.content, own.content])).toEqual([["A base", "B's own A"]]);
    expect(b!.exclusions).toEqual([]);
    expect(b!.fieldOnly).toEqual([]);
  });

  it("shows a Field-only Template its owner has overridden as that owner's version", async () => {
    const { repo, set } = await divergentSet();
    const state = await repo.read();
    const ownSlot = state.sharedTemplateBindings.find((slot) => slot.ownerFieldProfileId === "a")!;
    await repo.saveTemplateOverrideForField({ setId: set.id, slotId: ownSlot.id, fieldProfileId: "a", content: "A private, edited" });

    const [view] = buildSharedSetViews(await repo.read());

    expect(view!.members[0]!.fieldOnly.map((template) => template.content)).toEqual(["A private, edited"]);
    expect(view!.members[0]!.overrides).toEqual([]);
  });

  it("lists Sets by name", async () => {
    const repo = repository();
    for (const id of ["a", "b", "c", "d"]) await repo.createTemplateAndBind({ ...field(id, "a.test", id), content: id });
    const first = await repo.createSharedTemplateSet({ fieldProfileIds: ["a", "b"] });
    const second = await repo.createSharedTemplateSet({ fieldProfileIds: ["c", "d"] });
    await repo.renameSharedTemplateSet({ setId: first.set.id, name: "Zulu" });
    await repo.renameSharedTemplateSet({ setId: second.set.id, name: "Alpha" });

    expect(buildSharedSetViews(await repo.read()).map((view) => view.set.name)).toEqual(["Alpha", "Zulu"]);
  });
});
