// Shared Template Set defects found by the 2026-09-11 audit. Each is driven
// through the Repository's public commands, the same path the Picker and the
// Side Panel take, so a state that could only be built by hand is not tested.

import { describe, expect, it } from "vitest";
import {
  effectiveTemplateListForField,
  FillNestRepository,
  type LocalStorageArea,
} from "../../src/storage/fillnest-repository";

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

const field = (fieldProfileId: string, site = "a.test", page = `${site}-form`) => ({
  pageUrl: `https://${site}/form`,
  pageProfileId: page,
  fieldProfileId,
});

async function contentsOf(repo: FillNestRepository, fieldProfileId: string): Promise<string[]> {
  const state = await repo.read();
  return effectiveTemplateListForField(state, fieldProfileId)
    .templateIds.map((templateId) => state.templates.find((template) => template.id === templateId)!.content)
    .sort();
}

/** A Field left holding a private Binding, after its Field-only Template's Set ended. */
async function fieldWithPrivateBinding() {
  const repo = repository();
  for (const id of ["a", "b", "c"]) await repo.createTemplateAndBind({ ...field(id), content: id.toUpperCase() });
  const first = await repo.createSharedTemplateSet({ fieldProfileIds: ["a", "b"] });
  const own = await repo.createTemplateAndBindSharedFieldOnly({
    setId: first.set.id,
    fieldProfileId: "a",
    content: "A private",
  });
  await repo.endSharedTemplateSet({ setId: first.set.id });
  return { repo, own: own.template };
}

describe("Task 027 Addendum F: a private Binding through a second Set", () => {
  it("stays private when its Field saves its own copy of the Template", async () => {
    const { repo, own } = await fieldWithPrivateBinding();
    // Found through Search and bound somewhere else too, so an edit from
    // Field a offers "Save for this field" - a copy only a keeps.
    await repo.bindTemplate({ ...field("x", "a.test", "a.test-other"), templateId: own.id });
    await repo.saveTemplateCopyForField({ templateId: own.id, fieldProfileId: "a", content: "A private, edited" });

    await repo.createSharedTemplateSet({ fieldProfileIds: ["a", "c"] });

    expect(await contentsOf(repo, "a")).toContain("A private, edited");
    expect(await contentsOf(repo, "c")).not.toContain("A private, edited");
  });

  it("stays private when its Field joins another Set", async () => {
    const { repo } = await fieldWithPrivateBinding();
    await repo.createSharedTemplateSet({ fieldProfileIds: ["a", "c"] });
    expect(await contentsOf(repo, "c")).not.toContain("A private");
    expect(await contentsOf(repo, "a")).toContain("A private");
  });

  it("lets that second Set end, keeping the Template on its owner once", async () => {
    const { repo, own } = await fieldWithPrivateBinding();
    const second = await repo.createSharedTemplateSet({ fieldProfileIds: ["a", "c"] });

    await repo.endSharedTemplateSet({ setId: second.set.id });

    const state = await repo.read();
    const owned = state.bindings.filter((binding) => binding.fieldProfileId === "a" && binding.templateId === own.id);
    expect(owned).toHaveLength(1);
    expect(owned[0]!.privateToField).toBe(true);
    expect(await contentsOf(repo, "c")).not.toContain("A private");
  });
});

/** A cross-Site Set whose b.test member has its own divergent view of it. */
async function crossSiteSet() {
  const repo = repository();
  const a = await repo.createTemplateAndBind({ ...field("a", "a.test"), content: "A base" });
  const b = await repo.createTemplateAndBind({ ...field("b", "b.test"), content: "B base" });
  const { set, sharedBindings } = await repo.createSharedTemplateSet({ fieldProfileIds: ["a", "b"], allowCrossSite: true });
  const slotOf = (templateId: string) => sharedBindings.find((slot) => slot.templateId === templateId)!.id;
  return { repo, set, slotA: slotOf(a.template.id), slotB: slotOf(b.template.id) };
}

describe("Task 026 Addendum A: Clear Site Data leaving one member behind", () => {
  it("keeps that member's Overrides and Exclusions, as Stop sharing does", async () => {
    const { repo, set, slotA, slotB } = await crossSiteSet();
    await repo.saveTemplateOverrideForField({ setId: set.id, slotId: slotA, fieldProfileId: "b", content: "B edited A" });
    await repo.excludeSharedTemplateForField({ setId: set.id, slotId: slotB, fieldProfileId: "b" });
    expect(await contentsOf(repo, "b")).toEqual(["B edited A"]);

    await repo.resetSiteMappingsBatch({ sites: [{ siteId: "a.test" }] });

    expect(await contentsOf(repo, "b")).toEqual(["B edited A"]);
  });

  it("keeps that member's Field-only Template private in the next Set it joins", async () => {
    const { repo, set } = await crossSiteSet();
    await repo.createTemplateAndBindSharedFieldOnly({ setId: set.id, fieldProfileId: "b", content: "B private" });
    await repo.resetSiteMappingsBatch({ sites: [{ siteId: "a.test" }] });
    await repo.createTemplateAndBind({ ...field("c", "b.test", "b.test-other"), content: "C" });

    await repo.createSharedTemplateSet({ fieldProfileIds: ["b", "c"] });

    expect(await contentsOf(repo, "b")).toContain("B private");
    expect(await contentsOf(repo, "c")).not.toContain("B private");
  });
});

describe("Task 026 Addendum A: undoing the deletion of an Override's Template", () => {
  it("puts the Override back on the slot it replaced", async () => {
    const { repo, set, slotA } = await crossSiteSet();
    const override = await repo.saveTemplateOverrideForField({
      setId: set.id,
      slotId: slotA,
      fieldProfileId: "b",
      content: "B override",
    });
    // What the Picker records before it deletes: the Override row itself.
    const before = await repo.read();
    const fieldStates = before.sharedTemplateFieldStates.filter(
      (entry) => entry.mode === "override" && entry.templateId === override.template.id,
    );

    await repo.deleteTemplate({ templateId: override.template.id });
    expect(await contentsOf(repo, "b")).toEqual(["A base", "B base"]);
    await repo.restoreTemplate({ template: override.template, bindings: [], sharedBindings: [], fieldStates });

    expect(await contentsOf(repo, "b")).toEqual(["B base", "B override"]);
    expect(await contentsOf(repo, "a")).toEqual(["A base", "B base"]);
  });
});

describe("Task 024 Addendum D: undoing Stop sharing in a cross-Site Set", () => {
  async function stopSharing(fieldProfileId: "a" | "b") {
    const { repo, set } = await crossSiteSet();
    const endedSharedBindings = (await repo.read()).sharedTemplateBindings.filter((slot) => slot.setId === set.id);
    const removal = await repo.removeSharedTemplateSetMember({ setId: set.id, fieldProfileId });
    const undo = () =>
      repo.undoRemoveSharedTemplateSetMember({
        fieldProfileId,
        set,
        endedSharedBindings,
        snapshotBindings: removal.snapshotBindings,
        dormantBindings: removal.dormantBindings,
        removedOwnedSlots: removal.removedOwnedSlots,
        removedFieldStates: removal.removedFieldStates,
      });
    return { repo, set, undo };
  }

  for (const fieldProfileId of ["a", "b"] as const) {
    it(`restores the Set when the member on ${fieldProfileId}.test stopped sharing`, async () => {
      const { repo, set, undo } = await stopSharing(fieldProfileId);
      await undo();
      expect((await repo.read()).sharedTemplateSets).toEqual([set]);
    });
  }

  it("is refused once the other member has joined a different Set", async () => {
    const { repo, undo } = await stopSharing("b");
    await repo.createTemplateAndBind({ ...field("c", "a.test", "a.test-other"), content: "C" });
    await repo.createSharedTemplateSet({ fieldProfileIds: ["a", "c"] });
    await expect(undo()).rejects.toThrow("This removal can no longer be undone.");
  });
});

describe("Task 021 Addendum B: End sharing keeps what each member was offered (owner decision)", () => {
  async function sharedWithDivergence() {
    const repo = repository();
    const a = await repo.createTemplateAndBind({ ...field("a"), content: "A" });
    await repo.createTemplateAndBind({ ...field("b"), content: "B" });
    const { set, sharedBindings } = await repo.createSharedTemplateSet({ fieldProfileIds: ["a", "b"] });
    await repo.createTemplateAndBindShared({ setId: set.id, content: "Added while shared" });
    const slotOfA = sharedBindings.find((slot) => slot.templateId === a.template.id)!;
    await repo.excludeSharedTemplateForField({ setId: set.id, slotId: slotOfA.id, fieldProfileId: "b" });
    return { repo, set };
  }

  it("leaves every member with the Templates it offered, including those added while shared", async () => {
    const { repo, set } = await sharedWithDivergence();
    expect(await contentsOf(repo, "a")).toEqual(["A", "Added while shared", "B"]);
    expect(await contentsOf(repo, "b")).toEqual(["Added while shared", "B"]);

    await repo.endSharedTemplateSet({ setId: set.id });

    expect((await repo.read()).sharedTemplateSets).toEqual([]);
    expect(await contentsOf(repo, "a")).toEqual(["A", "Added while shared", "B"]);
    expect(await contentsOf(repo, "b")).toEqual(["Added while shared", "B"]);
  });

  it("is undone exactly", async () => {
    const { repo, set } = await sharedWithDivergence();
    const before = await repo.read();
    const ended = await repo.endSharedTemplateSet({ setId: set.id });

    await repo.undoEndSharedTemplateSet({
      set,
      sharedBindings: before.sharedTemplateBindings.filter((slot) => slot.setId === set.id),
      endedFieldStates: ended.endedFieldStates,
      convertedBindings: ended.convertedBindings,
      dormantBindings: ended.dormantBindings,
    });

    const after = await repo.read();
    const byId = <T extends { id: string }>(records: T[]) => [...records].sort((x, y) => x.id.localeCompare(y.id));
    expect(byId(after.bindings)).toEqual(byId(before.bindings));
    expect(byId(after.sharedTemplateSets)).toEqual(byId(before.sharedTemplateSets));
    expect(byId(after.sharedTemplateBindings)).toEqual(byId(before.sharedTemplateBindings));
    expect(byId(after.sharedTemplateFieldStates)).toEqual(byId(before.sharedTemplateFieldStates));
  });

  it("refuses the Undo once a member's own list has changed since", async () => {
    const { repo, set } = await sharedWithDivergence();
    const before = await repo.read();
    const ended = await repo.endSharedTemplateSet({ setId: set.id });
    await repo.createTemplateAndBind({ ...field("a"), content: "Later" });

    await expect(
      repo.undoEndSharedTemplateSet({
        set,
        sharedBindings: before.sharedTemplateBindings.filter((slot) => slot.setId === set.id),
        endedFieldStates: ended.endedFieldStates,
        convertedBindings: ended.convertedBindings,
        dormantBindings: ended.dormantBindings,
      }),
    ).rejects.toThrow("This ending can no longer be undone.");
  });
});
