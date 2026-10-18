// Task 027 Addendum C - defects found by the project owner's hands-on QA.
import { describe, expect, it } from "vitest";

import {
  createBackupArchive,
  parseAndValidateBackupArchive,
  serializeBackupArchive,
} from "../../src/backup/archive-contract";
import {
  effectiveTemplateListForField,
  FillNestRepository,
  type FillNestState,
  type LocalStorageArea,
} from "../../src/storage/fillnest-repository";

class Mem implements LocalStorageArea {
  values: Record<string, unknown> = {};
  async get(key: string) { return key in this.values ? { [key]: structuredClone(this.values[key]) } : {}; }
  async set(items: Record<string, unknown>) { Object.assign(this.values, structuredClone(items)); }
  async remove(key: string) { delete this.values[key]; }
}

const template = (id: string, siteAffinities: string[]) => ({
  id, content: id, siteAffinities,
  createdAt: "2026-09-07T00:00:00.000Z", updatedAt: "2026-09-07T00:00:00.000Z",
  totalUsageCount: 0, revision: 0,
});

function baseState(overrides: Partial<FillNestState> = {}): FillNestState {
  return {
    schemaVersion: 13, compatibilityPairDecisions: [],
    sites: [{ id: "a.test" }, { id: "b.test" }],
    templates: [], pageProfiles: [], fieldProfiles: [], bindings: [],
    logicalPageSiteKeys: [], logicalPageRules: [], logicalPageProvenance: [],
    logicalPageObservations: [], sharedTemplateSets: [], sharedTemplateBindings: [],
    sharedTemplateFieldStates: [], pickerPosition: null, pageStatusPosition: null,
    ...overrides,
  };
}

async function seed(state: FillNestState) {
  const repository = new FillNestRepository(new Mem());
  await repository.replaceState(state);
  return repository;
}

describe("Addendum C.1 - cross-Site opt-in is judged against the Set's real Sites", () => {
  // QA report 2: with a Set already spanning a.test and b.test, sharing from a
  // Field on b.test threw `Field Profile not found in this Site`, because the
  // repository compared against the Set's anchor siteId while the Picker
  // computed `crossSite` against the current Field's Site.
  const spanningSet = () =>
    baseState({
      templates: [template("t-1", ["a.test"])],
      pageProfiles: [
        { id: "p-a", siteId: "a.test" },
        { id: "p-b", siteId: "b.test" },
        { id: "p-b2", siteId: "b.test" },
      ],
      fieldProfiles: [
        { id: "f-a", pageProfileId: "p-a" },
        { id: "f-b", pageProfileId: "p-b" },
        { id: "f-b2", pageProfileId: "p-b2" },
      ],
      // Anchor is a.test, but f-b on b.test is already a member.
      sharedTemplateSets: [{ id: "set-1", siteId: "a.test", name: "S", memberFieldProfileIds: ["f-a", "f-b"] }],
      sharedTemplateBindings: [
        { id: "slot-1", setId: "set-1", templateId: "t-1", usageCount: 0, revision: 0, order: 0 },
      ],
    });

  it("adds a Field on a Site the Set already covers, with no opt-in", async () => {
    const repository = await seed(spanningSet());
    await expect(
      repository.addSharedTemplateSetMember({ setId: "set-1", fieldProfileId: "f-b2" }),
    ).resolves.toBeDefined();
    const after = await repository.read();
    expect(effectiveTemplateListForField(after, "f-b2").templateIds).toEqual(["t-1"]);
  });

  it("still requires an opt-in to expand the Set to a genuinely new Site", async () => {
    const state = spanningSet();
    const repository = await seed({
      ...state,
      sites: [...state.sites, { id: "c.test" }],
      pageProfiles: [...state.pageProfiles, { id: "p-c", siteId: "c.test" }],
      fieldProfiles: [...state.fieldProfiles, { id: "f-c", pageProfileId: "p-c" }],
    });

    await expect(
      repository.addSharedTemplateSetMember({ setId: "set-1", fieldProfileId: "f-c" }),
    ).rejects.toThrow(/not found in this Site/u);

    await expect(
      repository.addSharedTemplateSetMember({ setId: "set-1", fieldProfileId: "f-c", allowCrossSite: true }),
    ).resolves.toBeDefined();
  });
});

describe("Addendum C.2 - a Field-only relationship stays private across a Set boundary", () => {
  // QA report 6: after Stop sharing and then sharing again, A's private
  // Template reached B, because the conversion to a direct Binding lost the
  // fact that it had ever been private.
  const withPrivateSlot = () =>
    baseState({
      templates: [template("t-shared", ["a.test"]), template("t-private", ["a.test"])],
      pageProfiles: [{ id: "p-1", siteId: "a.test" }, { id: "p-2", siteId: "a.test" }],
      fieldProfiles: [{ id: "f-a", pageProfileId: "p-1" }, { id: "f-b", pageProfileId: "p-2" }],
      sharedTemplateSets: [{ id: "set-1", siteId: "a.test", name: "S", memberFieldProfileIds: ["f-a", "f-b"] }],
      sharedTemplateBindings: [
        { id: "slot-shared", setId: "set-1", templateId: "t-shared", usageCount: 0, revision: 0, order: 0 },
        { id: "slot-private", setId: "set-1", templateId: "t-private", usageCount: 0, revision: 0, order: 1, ownerFieldProfileId: "f-a" },
      ],
    });

  it("marks the converted Binding as private when its owner stops sharing", async () => {
    const repository = await seed(withPrivateSlot());
    await repository.removeSharedTemplateSetMember({ setId: "set-1", fieldProfileId: "f-a" });

    const after = await repository.read();
    const privateBinding = after.bindings.find((binding) => binding.templateId === "t-private");
    expect(privateBinding?.privateToField).toBe(true);
    // The ordinary Template it also carried forward is not marked.
    expect(after.bindings.find((binding) => binding.templateId === "t-shared")?.privateToField).toBeUndefined();
  });

  it("does not hand the private Template to B when a new Set is created", async () => {
    const repository = await seed(withPrivateSlot());
    await repository.removeSharedTemplateSetMember({ setId: "set-1", fieldProfileId: "f-a" });
    await repository.createSharedTemplateSet({ fieldProfileIds: ["f-a", "f-b"] });

    const after = await repository.read();
    expect(effectiveTemplateListForField(after, "f-a").templateIds).toContain("t-private");
    expect(effectiveTemplateListForField(after, "f-b").templateIds).not.toContain("t-private");
  });

  it("does not hand the private Template to an existing Set the owner joins", async () => {
    const repository = await seed(withPrivateSlot());
    await repository.removeSharedTemplateSetMember({ setId: "set-1", fieldProfileId: "f-a" });
    // f-b is now alone, so its Set dissolved; rebuild one from f-b and a third
    // Field, then let f-a join it.
    const state = await repository.read();
    await repository.replaceState({
      ...state,
      pageProfiles: [...state.pageProfiles, { id: "p-3", siteId: "a.test" }],
      fieldProfiles: [...state.fieldProfiles, { id: "f-c", pageProfileId: "p-3" }],
    });
    await repository.createSharedTemplateSet({ fieldProfileIds: ["f-b", "f-c"] });
    const created = await repository.read();
    const setId = created.sharedTemplateSets[0]!.id;

    await repository.addSharedTemplateSetMember({ setId, fieldProfileId: "f-a" });

    const after = await repository.read();
    expect(effectiveTemplateListForField(after, "f-a").templateIds).toContain("t-private");
    expect(effectiveTemplateListForField(after, "f-b").templateIds).not.toContain("t-private");
    expect(effectiveTemplateListForField(after, "f-c").templateIds).not.toContain("t-private");
  });

  it("clears the marker when the owner explicitly shares that version", async () => {
    const repository = await seed(withPrivateSlot());
    await repository.removeSharedTemplateSetMember({ setId: "set-1", fieldProfileId: "f-a" });
    await repository.createSharedTemplateSet({ fieldProfileIds: ["f-a", "f-b"] });
    const created = await repository.read();
    const ownSlot = created.sharedTemplateBindings.find(
      (slot) => slot.templateId === "t-private" && slot.ownerFieldProfileId === "f-a",
    );
    expect(ownSlot).toBeDefined();

    await repository.promoteFieldOnlySlot({
      setId: ownSlot!.setId,
      slotId: ownSlot!.id,
      fieldProfileId: "f-a",
    });

    const after = await repository.read();
    expect(effectiveTemplateListForField(after, "f-b").templateIds).toContain("t-private");
    // Once shared, leaving must not re-privatise it.
    await repository.removeSharedTemplateSetMember({ setId: ownSlot!.setId, fieldProfileId: "f-a" });
    const left = await repository.read();
    expect(left.bindings.find((b) => b.templateId === "t-private")?.privateToField).toBeUndefined();
  });
});

describe("Addendum C.2 - the private marker survives Backup and Restore", () => {
  it("round-trips privateToField through the archive", () => {
    // Dropping the marker on restore would silently make a private Template
    // shareable again the next time its Field joins a Set.
    const state = baseState({
      templates: [template("t-private", ["a.test"])],
      pageProfiles: [{ id: "p-1", siteId: "a.test" }],
      fieldProfiles: [{ id: "f-a", pageProfileId: "p-1" }],
      bindings: [
        {
          id: "b-1", templateId: "t-private", pageProfileId: "p-1", fieldProfileId: "f-a",
          createdAt: "2026-09-07T00:00:00.000Z", usageCount: 0, revision: 0, 
          privateToField: true,
        },
      ],
    });

    const archive = createBackupArchive(state, { global: "paused", origins: [] });
    expect(archive.payload.business.bindings[0]?.privateToField).toBe(true);

    const restored = parseAndValidateBackupArchive(serializeBackupArchive(archive));
    expect(restored.payload.business.bindings[0]?.privateToField).toBe(true);
  });

  it("rejects an archive whose privateToField is not exactly true", () => {
    const state = baseState({
      templates: [template("t-1", ["a.test"])],
      pageProfiles: [{ id: "p-1", siteId: "a.test" }],
      fieldProfiles: [{ id: "f-a", pageProfileId: "p-1" }],
      bindings: [
        {
          id: "b-1", templateId: "t-1", pageProfileId: "p-1", fieldProfileId: "f-a",
          createdAt: "2026-09-07T00:00:00.000Z", usageCount: 0, revision: 0, 
        },
      ],
    });
    const tampered = JSON.parse(serializeBackupArchive(createBackupArchive(state, { global: "paused", origins: [] })));
    tampered.payload.business.bindings[0].privateToField = false;
    expect(() => parseAndValidateBackupArchive(JSON.stringify(tampered))).toThrow(/privateToField/u);
  });
});

describe("Addendum D - a Field can save privately before it is ever shared", () => {
  // Addendum C.4 concluded no such option was needed, judging only the
  // audience that exists at save time. The audience that matters is the one
  // that exists later: joining a Set unions every ordinary Binding into the
  // shared list, and the user had no way to say "not this one" beforehand.
  const unsharedField = () =>
    baseState({
      templates: [],
      pageProfiles: [{ id: "p-1", siteId: "a.test" }, { id: "p-2", siteId: "a.test" }],
      fieldProfiles: [{ id: "f-a", pageProfileId: "p-1" }, { id: "f-b", pageProfileId: "p-2" }],
    });

  it("marks the Binding only when the private choice is used", async () => {
    const repository = await seed(unsharedField());
    const target = {
      pageUrl: "https://a.test/form",
      pageProfileId: "p-1",
      fieldProfileId: "f-a",
    };

    await repository.createTemplateAndBind({ ...target, content: "ordinary" });
    await repository.createTemplateAndBind({ ...target, content: "mine only", privateToField: true });

    const after = await repository.read();
    const byContent = (text: string) => {
      const templateId = after.templates.find((entry) => entry.content === text)!.id;
      return after.bindings.find((binding) => binding.templateId === templateId);
    };
    expect(byContent("ordinary")?.privateToField).toBeUndefined();
    expect(byContent("mine only")?.privateToField).toBe(true);
  });

  it("keeps it private once the Field joins a Set, and shares the ordinary one", async () => {
    const repository = await seed(unsharedField());
    const target = { pageUrl: "https://a.test/form", pageProfileId: "p-1", fieldProfileId: "f-a" };
    await repository.createTemplateAndBind({ ...target, content: "ordinary" });
    await repository.createTemplateAndBind({ ...target, content: "mine only", privateToField: true });

    await repository.createSharedTemplateSet({ fieldProfileIds: ["f-a", "f-b"] });

    const after = await repository.read();
    const idOf = (text: string) => after.templates.find((entry) => entry.content === text)!.id;
    expect(effectiveTemplateListForField(after, "f-a").templateIds.sort()).toEqual(
      [idOf("ordinary"), idOf("mine only")].sort(),
    );
    expect(effectiveTemplateListForField(after, "f-b").templateIds).toEqual([idOf("ordinary")]);
  });
});

