// Task 027 Addendum A - Relationship-Targeted Remediation.
//
// One regression per lettered defect (A-J) from the second audit, plus the
// two extra tests A.6 calls out: a collapse-provenance test, and a
// promotion-Undo-after-collapse staleness test. Each test's comment states
// the defect it reproduces and what the pre-fix code did wrong.

import { describe, expect, it } from "vitest";

import {
  createBackupArchive,
  parseAndValidateBackupArchive,
  serializeBackupArchive,
  InvalidBackupArchiveError,
} from "../../src/backup/archive-contract";
import {
  effectiveTemplateListForField,
  FillNestRepository,
  StaleUndoError,
  type FillNestState,
  type LocalStorageArea,
} from "../../src/storage/fillnest-repository";
import { resolveTemplateEditScope } from "../../src/templates/template-edit-scope";

class InMemoryLocalStorage implements LocalStorageArea {
  readonly values: Record<string, unknown> = {};

  async get(key: string): Promise<Record<string, unknown>> {
    return key in this.values ? { [key]: this.values[key] } : {};
  }

  async set(items: Record<string, unknown>): Promise<void> {
    Object.assign(this.values, structuredClone(items));
  }

  async remove(key: string): Promise<void> {
    delete this.values[key];
  }
}

function baseState(overrides: Partial<FillNestState> = {}): FillNestState {
  return {
    schemaVersion: 13,
    compatibilityPairDecisions: [],
    sites: [{ id: "a.test" }],
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
    ...overrides,
  };
}

function template(id: string, content = id, siteAffinities: string[] = ["a.test"]) {
  return {
    id,
    content,
    siteAffinities,
    createdAt: "2026-09-06T00:00:00.000Z",
    updatedAt: "2026-09-06T00:00:00.000Z",
    totalUsageCount: 0,
    revision: 0,
  };
}

async function seed(state: FillNestState): Promise<FillNestRepository> {
  const repository = new FillNestRepository(new InMemoryLocalStorage());
  await repository.replaceState(state);
  return repository;
}

describe("Task 027 Addendum A remediation", () => {
  it("defect A: an ordinary unbind leaves a peer's owner-only slot intact", async () => {
    // Pre-fix: unbindTemplateShared({setId, templateId}) deleted every slot
    // matching that Template, including a peer's owner-only slot for it.
    const state = baseState({
      templates: [template("t-1")],
      pageProfiles: [{ id: "p-1", siteId: "a.test" }, { id: "p-2", siteId: "a.test" }],
      fieldProfiles: [{ id: "f-1", pageProfileId: "p-1" }, { id: "f-2", pageProfileId: "p-2" }],
      sharedTemplateSets: [{ id: "set-1", siteId: "a.test", name: "Set", memberFieldProfileIds: ["f-1", "f-2"] }],
      sharedTemplateBindings: [
        { id: "slot-ordinary", setId: "set-1", templateId: "t-1", usageCount: 0, revision: 0, order: 0 },
        {
          id: "slot-owner",
          setId: "set-1",
          templateId: "t-1",
          usageCount: 0,
          revision: 0,
          order: 1,
          ownerFieldProfileId: "f-2",
        },
      ],
    });
    const repository = await seed(state);

    await expect(repository.unbindTemplateShared({ setId: "set-1", slotId: "slot-ordinary" })).resolves.toMatchObject({
      sharedBinding: { id: "slot-ordinary" },
      fieldStates: [],
    });

    const after = await repository.read();
    expect(after.sharedTemplateBindings).toEqual([
      { id: "slot-owner", setId: "set-1", templateId: "t-1", usageCount: 0, revision: 0, order: 1, ownerFieldProfileId: "f-2" },
    ]);
  });

  it("defect B: Bind to Shared Set makes the Template effective for a peer even when another member owns a Field-only slot for it", async () => {
    // Pre-fix: bindTemplateShared's `existing` short-circuit matched by
    // templateId alone, silently returning the peer's owner-only slot and
    // never creating an ordinary slot - the Template stayed invisible to f-2.
    const state = baseState({
      templates: [template("t-1")],
      pageProfiles: [{ id: "p-1", siteId: "a.test" }, { id: "p-2", siteId: "a.test" }],
      fieldProfiles: [{ id: "f-1", pageProfileId: "p-1" }, { id: "f-2", pageProfileId: "p-2" }],
      sharedTemplateSets: [{ id: "set-1", siteId: "a.test", name: "Set", memberFieldProfileIds: ["f-1", "f-2"] }],
      sharedTemplateBindings: [
        {
          id: "slot-owner",
          setId: "set-1",
          templateId: "t-1",
          usageCount: 0,
          revision: 0,
          order: 0,
          ownerFieldProfileId: "f-1",
        },
      ],
    });
    const repository = await seed(state);

    const bound = await repository.bindTemplateShared({ setId: "set-1", templateId: "t-1" });
    expect(bound.ownerFieldProfileId).toBeUndefined();
    expect(bound.id).not.toBe("slot-owner");

    const after = await repository.read();
    expect(after.sharedTemplateBindings).toHaveLength(2);
    const f2Effective = effectiveTemplateListForField(after, "f-2");
    expect(f2Effective.templateIds).toContain("t-1");
  });

  it("defect C: promotion into a Set that already shares the Template succeeds and yields exactly one ordinary slot with the summed usage count", async () => {
    // Pre-fix: promoteFieldOnlySlot cleared `ownerFieldProfileId` in place,
    // creating a duplicate ordinary slot pair for the same Template and
    // throwing InvalidStoredDataError at commit.
    const state = baseState({
      templates: [template("t-1")],
      pageProfiles: [{ id: "p-1", siteId: "a.test" }, { id: "p-2", siteId: "a.test" }],
      fieldProfiles: [{ id: "f-1", pageProfileId: "p-1" }, { id: "f-2", pageProfileId: "p-2" }],
      sharedTemplateSets: [{ id: "set-1", siteId: "a.test", name: "Set", memberFieldProfileIds: ["f-1", "f-2"] }],
      sharedTemplateBindings: [
        { id: "slot-ordinary", setId: "set-1", templateId: "t-1", usageCount: 5, revision: 0, order: 0 },
        {
          id: "slot-owner",
          setId: "set-1",
          templateId: "t-1",
          usageCount: 3,
          revision: 0,
          order: 1,
          ownerFieldProfileId: "f-1",
        },
      ],
    });
    const repository = await seed(state);

    const result = await repository.promoteFieldOnlySlot({ setId: "set-1", slotId: "slot-owner", fieldProfileId: "f-1" });
    expect(result.consumedSlot?.id).toBe("slot-owner");
    expect(result.previousOrdinarySlot?.id).toBe("slot-ordinary");
    expect(result.sharedBinding).toMatchObject({ id: "slot-ordinary", usageCount: 8 });
    expect(result.sharedBinding.ownerFieldProfileId).toBeUndefined();

    const after = await repository.read();
    expect(after.sharedTemplateBindings).toHaveLength(1);
    expect(after.sharedTemplateBindings[0]).toMatchObject({ id: "slot-ordinary", templateId: "t-1", usageCount: 8 });
  });

  it("defect D: after a merge, the owner's effective list contains the Template once, with both relations recorded", async () => {
    // Pre-fix: the resolver pushed one entry per slot with no collapse, so
    // f-1 resolved "t-1" twice after the merge brought an ordinary slot for
    // it alongside f-1's own pre-existing owner-only slot.
    const set1 = { id: "set-1", siteId: "a.test", name: "Keep", memberFieldProfileIds: ["f-1"] };
    const set2 = { id: "set-2", siteId: "a.test", name: "Remove", memberFieldProfileIds: ["f-2"] };
    const state = baseState({
      templates: [template("t-1")],
      pageProfiles: [{ id: "p-1", siteId: "a.test" }, { id: "p-2", siteId: "a.test" }],
      fieldProfiles: [{ id: "f-1", pageProfileId: "p-1" }, { id: "f-2", pageProfileId: "p-2" }],
      sharedTemplateSets: [set1, set2],
      sharedTemplateBindings: [
        {
          id: "slot-owner",
          setId: "set-1",
          templateId: "t-1",
          usageCount: 2,
          revision: 0,
          order: 0,
          ownerFieldProfileId: "f-1",
        },
        { id: "slot-ordinary", setId: "set-2", templateId: "t-1", usageCount: 1, revision: 0, order: 0 },
      ],
    });
    const repository = await seed(state);

    await repository.mergeSharedTemplateSets({ keepSetId: "set-1", removeSetId: "set-2" });

    const after = await repository.read();
    const effective = effectiveTemplateListForField(after, "f-1");
    expect(effective.templateIds).toEqual(["t-1"]);
    const entry = effective.entries[0]!;
    expect(entry.relations).toHaveLength(2);
    expect(entry.isFieldOnly).toBe(false);
    expect(entry.usageCount).toBe(3);
  });

  it("defect E: End Set converts an overridden owner-only slot to the Override's Template as a direct Binding for the owner alone", async () => {
    // Pre-fix: endSharedTemplateSet filtered entries by `entry.isFieldOnly`,
    // which the resolver deliberately sets `false` for an Override - the
    // owner's overridden content was discarded outright instead of
    // converted.
    const state = baseState({
      templates: [template("t-base"), template("t-override")],
      pageProfiles: [{ id: "p-1", siteId: "a.test" }, { id: "p-2", siteId: "a.test" }],
      fieldProfiles: [{ id: "f-1", pageProfileId: "p-1" }, { id: "f-2", pageProfileId: "p-2" }],
      sharedTemplateSets: [{ id: "set-1", siteId: "a.test", name: "Set", memberFieldProfileIds: ["f-1", "f-2"] }],
      sharedTemplateBindings: [
        {
          id: "slot-owner",
          setId: "set-1",
          templateId: "t-base",
          usageCount: 0,
          revision: 0,
          order: 0,
          ownerFieldProfileId: "f-1",
        },
      ],
      sharedTemplateFieldStates: [
        {
          id: "state-1",
          setId: "set-1",
          slotId: "slot-owner",
          fieldProfileId: "f-1",
          mode: "override",
          templateId: "t-override",
          usageCount: 4,
          revision: 0,
        },
      ],
    });
    const repository = await seed(state);

    const result = await repository.endSharedTemplateSet({ setId: "set-1" });
    expect(result.convertedBindings).toHaveLength(1);
    expect(result.convertedBindings[0]).toMatchObject({ fieldProfileId: "f-1", templateId: "t-override", usageCount: 4 });

    const after = await repository.read();
    expect(after.bindings.some((b) => b.fieldProfileId === "f-2")).toBe(false);
    expect(after.bindings).toEqual([expect.objectContaining({ fieldProfileId: "f-1", templateId: "t-override" })]);
  });

  it("defect F: 'Save for shared fields' is not offered for a private relationship, and the Set-level copy command preserves ownerFieldProfileId", async () => {
    // Pre-fix: resolveTemplateEditScope had no owner-only awareness at all,
    // so a private slot resolved to "shared-inherited" and offered a
    // Set-wide save; saveTemplateCopyForSharedSet rebuilt the slot literally
    // and dropped `ownerFieldProfileId` on any slot it touched.
    const state = baseState({
      templates: [template("t-1")],
      pageProfiles: [{ id: "p-1", siteId: "a.test" }, { id: "p-2", siteId: "a.test" }],
      fieldProfiles: [{ id: "f-1", pageProfileId: "p-1" }, { id: "f-2", pageProfileId: "p-2" }],
      sharedTemplateSets: [{ id: "set-1", siteId: "a.test", name: "Set", memberFieldProfileIds: ["f-1", "f-2"] }],
      sharedTemplateBindings: [
        {
          id: "slot-owner",
          setId: "set-1",
          templateId: "t-1",
          usageCount: 0,
          revision: 0,
          order: 0,
          ownerFieldProfileId: "f-1",
        },
      ],
    });
    const repository = await seed(state);
    const current = await repository.read();

    const scope = resolveTemplateEditScope(current, current.templates[0]!, "f-1");
    expect(scope).toBe("shared-field-only");
    // The non-owner never resolves this Template at all, so there is no
    // scope question for f-2 to ask - confirmed separately via the resolver.
    const peerEffective = effectiveTemplateListForField(current, "f-2");
    expect(peerEffective.templateIds).not.toContain("t-1");

    const result = await repository.saveTemplateCopyForSharedSet({
      setId: "set-1",
      slotId: "slot-owner",
      content: "Private edit",
    });
    expect(result.sharedBinding.ownerFieldProfileId).toBe("f-1");
    expect(result.template.content).toBe("Private edit");
  });

  it("defect G: 'Merge Sets & Share' succeeds against a Set that already shares the Template, and its Undo restores both pre-merge Sets and the consumed slot", async () => {
    // Pre-fix: falls out of C - mergeSetsAndShare's promotion step cleared
    // ownerFieldProfileId in place and threw InvalidStoredDataError because
    // the merge had already brought in an ordinary slot for the same
    // Template.
    const keepSet = { id: "set-keep", siteId: "a.test", name: "Keep", memberFieldProfileIds: ["f-1"] };
    const removeSet = { id: "set-remove", siteId: "a.test", name: "Remove", memberFieldProfileIds: ["f-2"] };
    const state = baseState({
      templates: [template("t-1")],
      pageProfiles: [{ id: "p-1", siteId: "a.test" }, { id: "p-2", siteId: "a.test" }],
      fieldProfiles: [{ id: "f-1", pageProfileId: "p-1" }, { id: "f-2", pageProfileId: "p-2" }],
      sharedTemplateSets: [keepSet, removeSet],
      sharedTemplateBindings: [
        {
          id: "slot-owner",
          setId: "set-keep",
          templateId: "t-1",
          usageCount: 2,
          revision: 0,
          order: 0,
          ownerFieldProfileId: "f-1",
        },
        { id: "slot-ordinary", setId: "set-remove", templateId: "t-1", usageCount: 5, revision: 0, order: 0 },
      ],
    });
    const repository = await seed(state);

    const result = await repository.mergeSetsAndShare({
      keepSetId: "set-keep",
      removeSetId: "set-remove",
      slotId: "slot-owner",
      fieldProfileId: "f-1",
    });
    expect(result.consumedSlot?.id).toBe("slot-owner");
    const afterMerge = await repository.read();
    expect(afterMerge.sharedTemplateBindings.filter((b) => b.templateId === "t-1")).toHaveLength(1);
    expect(afterMerge.sharedTemplateBindings[0]).toMatchObject({ usageCount: 7 });
    expect(afterMerge.sharedTemplateBindings[0]!.ownerFieldProfileId).toBeUndefined();

    await repository.undoMergeSetsAndShare({
      mergedSet: result.set,
      mergedSetBindings: result.bindings,
      previousKeepSet: result.previousKeepSet,
      previousKeepSetBindings: result.previousKeepSetBindings,
      removedSet: result.removedSet,
      removedSetBindings: result.removedSetBindings,
      remappedFieldStates: result.remappedFieldStates,
      previousRemovedSetFieldStates: result.previousRemovedSetFieldStates,
      slotId: result.sharedBinding.id,
      ownerFieldProfileId: result.previousOwnerFieldProfileId,
      consumedSlot: result.consumedSlot,
      previousOrdinarySlot: result.previousOrdinarySlot,
      removedFieldStates: result.removedFieldStates,
    });

    const restored = await repository.read();
    expect(restored.sharedTemplateSets).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "set-keep" }), expect.objectContaining({ id: "set-remove" })]),
    );
    expect(restored.sharedTemplateBindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "slot-owner", ownerFieldProfileId: "f-1", usageCount: 2 }),
        expect.objectContaining({ id: "slot-ordinary", usageCount: 5 }),
      ]),
    );
  });

  it("defect H: clearing the owner's Site leaves the survivor without the private Template", async () => {
    // Pre-fix: the sole-survivor snapshot filtered only on templateId, never
    // ownerFieldProfileId, handing the departing owner's private Template to
    // the survivor as a new direct Binding.
    const state = baseState({
      templates: [template("t-private"), template("t-shared")],
      sites: [{ id: "a.test" }, { id: "b.test" }],
      pageProfiles: [{ id: "p-1", siteId: "a.test" }, { id: "p-2", siteId: "b.test" }],
      fieldProfiles: [{ id: "f-1", pageProfileId: "p-1" }, { id: "f-2", pageProfileId: "p-2" }],
      sharedTemplateSets: [{ id: "set-1", siteId: "a.test", name: "Set", memberFieldProfileIds: ["f-1", "f-2"] }],
      sharedTemplateBindings: [
        {
          id: "slot-owner",
          setId: "set-1",
          templateId: "t-private",
          usageCount: 0,
          revision: 0,
          order: 0,
          ownerFieldProfileId: "f-1",
        },
        { id: "slot-ordinary", setId: "set-1", templateId: "t-shared", usageCount: 0, revision: 0, order: 1 },
      ],
    });
    const repository = await seed(state);

    await repository.resetSiteMappingsBatch({ sites: [{ siteId: "a.test" }] });

    const after = await repository.read();
    expect(after.sharedTemplateSets).toEqual([]);
    const survivorBindings = after.bindings.filter((b) => b.fieldProfileId === "f-2");
    expect(survivorBindings.map((b) => b.templateId)).toEqual(["t-shared"]);
  });

  it("defect I: clearing the owner's Site with 2+ survivors succeeds and leaves no orphaned slot or field state", async () => {
    // Pre-fix: the `>= 2 members survive` branch never removed a departing
    // owner's slot, leaving its ownerFieldProfileId pointing outside the
    // surviving membership and throwing InvalidStoredDataError at commit.
    const state = baseState({
      templates: [template("t-private")],
      sites: [{ id: "a.test" }, { id: "b.test" }, { id: "c.test" }],
      pageProfiles: [
        { id: "p-1", siteId: "a.test" },
        { id: "p-2", siteId: "b.test" },
        { id: "p-3", siteId: "c.test" },
      ],
      fieldProfiles: [
        { id: "f-1", pageProfileId: "p-1" },
        { id: "f-2", pageProfileId: "p-2" },
        { id: "f-3", pageProfileId: "p-3" },
      ],
      sharedTemplateSets: [{ id: "set-1", siteId: "a.test", name: "Set", memberFieldProfileIds: ["f-1", "f-2", "f-3"] }],
      sharedTemplateBindings: [
        {
          id: "slot-owner",
          setId: "set-1",
          templateId: "t-private",
          usageCount: 0,
          revision: 0,
          order: 0,
          ownerFieldProfileId: "f-1",
        },
      ],
      sharedTemplateFieldStates: [
        { id: "state-1", setId: "set-1", slotId: "slot-owner", fieldProfileId: "f-1", mode: "exclude" },
      ],
    });
    const repository = await seed(state);

    await expect(repository.resetSiteMappingsBatch({ sites: [{ siteId: "a.test" }] })).resolves.toMatchObject({
      didMutate: true,
    });

    const after = await repository.read();
    const survivingSet = after.sharedTemplateSets.find((set) => set.id === "set-1");
    expect(survivingSet?.memberFieldProfileIds).toEqual(["f-2", "f-3"]);
    expect(after.sharedTemplateBindings.some((b) => b.id === "slot-owner")).toBe(false);
    expect(after.sharedTemplateFieldStates).toEqual([]);
  });

  it("defect J: a joining Field keeps its own Template as a new ordinary slot", async () => {
    // Pre-fix: the snapshot dedupe matched any slot (ordinary or owner-only)
    // by templateId alone, folding the joiner's own Template into a peer's
    // pre-existing owner-only slot for it - the joiner lost access entirely.
    const state = baseState({
      templates: [template("t-1")],
      pageProfiles: [{ id: "p-1", siteId: "a.test" }, { id: "p-2", siteId: "a.test" }],
      fieldProfiles: [{ id: "f-1", pageProfileId: "p-1" }, { id: "f-2", pageProfileId: "p-2" }],
      bindings: [
        { id: "binding-1", templateId: "t-1", pageProfileId: "p-2", fieldProfileId: "f-2", createdAt: "x", usageCount: 3, revision: 0},
      ],
      sharedTemplateSets: [{ id: "set-1", siteId: "a.test", name: "Set", memberFieldProfileIds: ["f-1"] }],
      sharedTemplateBindings: [
        {
          id: "slot-owner",
          setId: "set-1",
          templateId: "t-1",
          usageCount: 0,
          revision: 0,
          order: 0,
          ownerFieldProfileId: "f-1",
        },
      ],
    });
    const repository = await seed(state);

    await repository.addSharedTemplateSetMember({ setId: "set-1", fieldProfileId: "f-2" });

    const after = await repository.read();
    const slotsForTemplate = after.sharedTemplateBindings.filter((b) => b.templateId === "t-1");
    expect(slotsForTemplate).toHaveLength(2);
    expect(slotsForTemplate.some((b) => b.ownerFieldProfileId === "f-1")).toBe(true);
    const newOrdinary = slotsForTemplate.find((b) => b.ownerFieldProfileId === undefined);
    expect(newOrdinary).toMatchObject({ usageCount: 3 });
    const f2Effective = effectiveTemplateListForField(after, "f-2");
    expect(f2Effective.templateIds).toContain("t-1");
  });

  it("collapse-provenance: one ordinary plus one owner-only relation for one Template resolves to one entry with two relations, isFieldOnly false", async () => {
    const state = baseState({
      templates: [template("t-1")],
      pageProfiles: [{ id: "p-1", siteId: "a.test" }, { id: "p-2", siteId: "a.test" }],
      fieldProfiles: [{ id: "f-1", pageProfileId: "p-1" }, { id: "f-2", pageProfileId: "p-2" }],
      sharedTemplateSets: [{ id: "set-1", siteId: "a.test", name: "Set", memberFieldProfileIds: ["f-1", "f-2"] }],
      sharedTemplateBindings: [
        { id: "slot-ordinary", setId: "set-1", templateId: "t-1", usageCount: 2, revision: 0, order: 0 },
        {
          id: "slot-owner",
          setId: "set-1",
          templateId: "t-1",
          usageCount: 1,
          revision: 0,
          order: 1,
          ownerFieldProfileId: "f-1",
        },
      ],
    });
    const repository = await seed(state);
    const current = await repository.read();

    const effective = effectiveTemplateListForField(current, "f-1");
    expect(effective.templateIds).toEqual(["t-1"]);
    expect(effective.entries).toHaveLength(1);
    const entry = effective.entries[0]!;
    expect(entry.relations).toHaveLength(2);
    expect(entry.isFieldOnly).toBe(false);
    expect(entry.slotId).toBe("slot-ordinary"); // lowest `order` is primary
    expect(entry.usageCount).toBe(3);

    // f-2 never sees the owner-only relation at all - only the ordinary one.
    const peerEffective = effectiveTemplateListForField(current, "f-2");
    expect(peerEffective.entries).toHaveLength(1);
    expect(peerEffective.entries[0]!.relations).toHaveLength(1);
  });

  it("promotion-Undo-after-collapse staleness: rejects Undo once the surviving ordinary slot has since changed", async () => {
    const state = baseState({
      templates: [template("t-1")],
      pageProfiles: [{ id: "p-1", siteId: "a.test" }, { id: "p-2", siteId: "a.test" }],
      fieldProfiles: [{ id: "f-1", pageProfileId: "p-1" }, { id: "f-2", pageProfileId: "p-2" }],
      sharedTemplateSets: [{ id: "set-1", siteId: "a.test", name: "Set", memberFieldProfileIds: ["f-1", "f-2"] }],
      sharedTemplateBindings: [
        { id: "slot-ordinary", setId: "set-1", templateId: "t-1", usageCount: 5, revision: 0, order: 0 },
        {
          id: "slot-owner",
          setId: "set-1",
          templateId: "t-1",
          usageCount: 3,
          revision: 0,
          order: 1,
          ownerFieldProfileId: "f-1",
        },
      ],
    });
    const repository = await seed(state);

    const result = await repository.promoteFieldOnlySlot({ setId: "set-1", slotId: "slot-owner", fieldProfileId: "f-1" });

    // Happy path first, on an independent copy of the same scenario, to
    // prove Undo works before proving staleness rejects it.
    const repositoryForHappyPath = await seed(state);
    const happyResult = await repositoryForHappyPath.promoteFieldOnlySlot({
      setId: "set-1",
      slotId: "slot-owner",
      fieldProfileId: "f-1",
    });
    await repositoryForHappyPath.undoPromoteFieldOnlySlot({
      setId: "set-1",
      slotId: happyResult.sharedBinding.id,
      ownerFieldProfileId: happyResult.previousOwnerFieldProfileId,
      consumedSlot: happyResult.consumedSlot,
      previousOrdinarySlot: happyResult.previousOrdinarySlot,
      removedFieldStates: happyResult.removedFieldStates,
    });
    const restored = await repositoryForHappyPath.read();
    expect(restored.sharedTemplateBindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "slot-ordinary", usageCount: 5 }),
        expect.objectContaining({ id: "slot-owner", usageCount: 3, ownerFieldProfileId: "f-1" }),
      ]),
    );

    // Now make the surviving slot stale (record an insertion on it, which
    // bumps its usageCount/revision) before attempting Undo.
    await repository.recordInsertion({ templateId: "t-1", fieldProfileId: "f-2" });

    await expect(
      repository.undoPromoteFieldOnlySlot({
        setId: "set-1",
        slotId: result.sharedBinding.id,
        ownerFieldProfileId: result.previousOwnerFieldProfileId,
        consumedSlot: result.consumedSlot,
        previousOrdinarySlot: result.previousOrdinarySlot,
        removedFieldStates: result.removedFieldStates,
      }),
    ).rejects.toThrow(StaleUndoError);
  });

  it("saveTemplateOverrideForField has no owner-only guard: an owner may override its own private slot (pinned, unchanged behaviour)", async () => {
    const state = baseState({
      templates: [template("t-1")],
      pageProfiles: [{ id: "p-1", siteId: "a.test" }, { id: "p-2", siteId: "a.test" }],
      fieldProfiles: [{ id: "f-1", pageProfileId: "p-1" }, { id: "f-2", pageProfileId: "p-2" }],
      sharedTemplateSets: [{ id: "set-1", siteId: "a.test", name: "Set", memberFieldProfileIds: ["f-1", "f-2"] }],
      sharedTemplateBindings: [
        {
          id: "slot-owner",
          setId: "set-1",
          templateId: "t-1",
          usageCount: 0,
          revision: 0,
          order: 0,
          ownerFieldProfileId: "f-1",
        },
      ],
    });
    const repository = await seed(state);

    const result = await repository.saveTemplateOverrideForField({
      setId: "set-1",
      slotId: "slot-owner",
      fieldProfileId: "f-1",
      content: "Override of my own private slot",
    });
    expect(result.state).toMatchObject({ fieldProfileId: "f-1", mode: "override" });
    const after = await repository.read();
    const effective = effectiveTemplateListForField(after, "f-1");
    expect(effective.entries[0]).toMatchObject({ templateId: result.template.id, isOverride: true });
  });

  it("archive validation: an ownerFieldProfileId pointing outside the slot's own Set membership fails at parse time with InvalidBackupArchiveError (pinned, already correct)", () => {
    const state = baseState({
      templates: [template("t-1")],
      pageProfiles: [{ id: "p-1", siteId: "a.test" }],
      fieldProfiles: [{ id: "f-1", pageProfileId: "p-1" }, { id: "f-2", pageProfileId: "p-1" }],
      sharedTemplateSets: [{ id: "set-1", siteId: "a.test", name: "Set", memberFieldProfileIds: ["f-1", "f-2"] }],
      sharedTemplateBindings: [
        {
          id: "slot-1",
          setId: "set-1",
          templateId: "t-1",
          usageCount: 0,
          revision: 0,
          order: 0,
          ownerFieldProfileId: "f-1",
        },
      ],
    });
    const archive = createBackupArchive(state, { global: "paused", origins: [] });
    const tampered = JSON.parse(serializeBackupArchive(archive)) as {
      payload: { business: { sharedTemplateBindings: Array<{ ownerFieldProfileId?: string }> } };
    };
    tampered.payload.business.sharedTemplateBindings[0]!.ownerFieldProfileId = "not-a-member";

    expect(() => parseAndValidateBackupArchive(JSON.stringify(tampered))).toThrow(InvalidBackupArchiveError);
  });
  it("defect K: 'Bind to this field' is idempotent, matching bindTemplateShared", async () => {
    // Pre-fix: bindTemplateToFieldOnly had no existing-slot guard, so a
    // second call (a double-click before the row re-renders) produced a
    // duplicate setId:templateId:owner pair and the commit was rejected
    // with InvalidStoredDataError. Its sibling bindTemplateShared already
    // returned the existing slot instead.
    const state = baseState({
      templates: [template("t-1")],
      pageProfiles: [{ id: "p-1", siteId: "a.test" }, { id: "p-2", siteId: "a.test" }],
      fieldProfiles: [{ id: "f-1", pageProfileId: "p-1" }, { id: "f-2", pageProfileId: "p-2" }],
      sharedTemplateSets: [{ id: "set-1", siteId: "a.test", name: "Set", memberFieldProfileIds: ["f-1", "f-2"] }],
    });
    const repository = await seed(state);

    const first = await repository.bindTemplateToFieldOnly({
      setId: "set-1",
      fieldProfileId: "f-1",
      templateId: "t-1",
    });
    const second = await repository.bindTemplateToFieldOnly({
      setId: "set-1",
      fieldProfileId: "f-1",
      templateId: "t-1",
    });

    expect(second.sharedBinding).toEqual(first.sharedBinding);
    const after = await repository.read();
    expect(after.sharedTemplateBindings).toHaveLength(1);
  });

  it("defect K: a second 'Bind to this field' by a different owner still creates its own relationship", async () => {
    // The idempotence guard must key on the owner too - coexistence (A.1)
    // means f-2's own Field-only relationship to the same Template is a
    // different relationship, not a repeat of f-1's.
    const state = baseState({
      templates: [template("t-1")],
      pageProfiles: [{ id: "p-1", siteId: "a.test" }, { id: "p-2", siteId: "a.test" }],
      fieldProfiles: [{ id: "f-1", pageProfileId: "p-1" }, { id: "f-2", pageProfileId: "p-2" }],
      sharedTemplateSets: [{ id: "set-1", siteId: "a.test", name: "Set", memberFieldProfileIds: ["f-1", "f-2"] }],
    });
    const repository = await seed(state);

    await repository.bindTemplateToFieldOnly({ setId: "set-1", fieldProfileId: "f-1", templateId: "t-1" });
    await repository.bindTemplateToFieldOnly({ setId: "set-1", fieldProfileId: "f-2", templateId: "t-1" });

    const after = await repository.read();
    expect(after.sharedTemplateBindings.map((slot) => slot.ownerFieldProfileId).sort()).toEqual(["f-1", "f-2"]);
    expect(effectiveTemplateListForField(after, "f-1").templateIds).toEqual(["t-1"]);
    expect(effectiveTemplateListForField(after, "f-2").templateIds).toEqual(["t-1"]);
  });

  it("defect L: Join Set & Share round-trips through Undo when the joiner brought the same Template", async () => {
    // Pre-fix: the promotion ran in Addendum A.3 mode 2 (the join created an
    // ordinary slot for the Template the owner was sharing), and its Undo
    // restored the consumed slot by appending it. undoAddSharedTemplateSetMember
    // then compared with JSON.stringify, which is order-sensitive, so the
    // byte-identical-but-reordered array failed the check and the composite
    // Undo threw StaleUndoError - acceptance 4 unmet.
    const state = baseState({
      templates: [template("t-1")],
      pageProfiles: [
        { id: "p-1", siteId: "a.test" },
        { id: "p-2", siteId: "a.test" },
        { id: "p-3", siteId: "a.test" },
      ],
      fieldProfiles: [
        { id: "f-1", pageProfileId: "p-1" },
        { id: "f-2", pageProfileId: "p-2" },
        { id: "f-3", pageProfileId: "p-3" },
      ],
      bindings: [
        {
          id: "binding-3",
          templateId: "t-1",
          pageProfileId: "p-3",
          fieldProfileId: "f-3",
          createdAt: "2026-09-06T00:00:00.000Z",
          usageCount: 2,
          revision: 0,
        },
      ],
      sharedTemplateSets: [{ id: "set-1", siteId: "a.test", name: "Set", memberFieldProfileIds: ["f-1", "f-2"] }],
      sharedTemplateBindings: [
        {
          id: "slot-owner",
          setId: "set-1",
          templateId: "t-1",
          usageCount: 3,
          revision: 0,
          order: 0,
          ownerFieldProfileId: "f-1",
        },
      ],
    });
    const repository = await seed(state);

    const result = await repository.joinSetAndShare({
      setId: "set-1",
      fieldProfileId: "f-1",
      targetFieldProfileId: "f-3",
      slotId: "slot-owner",
    });
    // Mode 2: the join's own ordinary slot absorbed the owner's private one.
    expect(result.consumedSlot?.id).toBe("slot-owner");

    await repository.undoJoinSetAndShare({
      setId: "set-1",
      targetFieldProfileId: "f-3",
      slotId: result.sharedBinding.id,
      ownerFieldProfileId: result.previousOwnerFieldProfileId,
      addUndo: result.addUndo,
      consumedSlot: result.consumedSlot,
      previousOrdinarySlot: result.previousOrdinarySlot,
      removedFieldStates: result.removedFieldStates,
    });

    const after = await repository.read();
    expect(after.sharedTemplateSets).toEqual(state.sharedTemplateSets);
    expect(after.sharedTemplateBindings).toEqual(state.sharedTemplateBindings);
    expect(after.bindings).toEqual(state.bindings);
  });

  it("defect L: an intervening slot change still invalidates the add Undo", async () => {
    // The order-insensitive comparison must not weaken Task 010's rule: a
    // real change to the Set's slots since the add must still be rejected.
    const state = baseState({
      templates: [template("t-1"), template("t-2")],
      pageProfiles: [
        { id: "p-1", siteId: "a.test" },
        { id: "p-2", siteId: "a.test" },
        { id: "p-3", siteId: "a.test" },
      ],
      fieldProfiles: [
        { id: "f-1", pageProfileId: "p-1" },
        { id: "f-2", pageProfileId: "p-2" },
        { id: "f-3", pageProfileId: "p-3" },
      ],
      sharedTemplateSets: [{ id: "set-1", siteId: "a.test", name: "Set", memberFieldProfileIds: ["f-1", "f-2"] }],
      sharedTemplateBindings: [
        { id: "slot-1", setId: "set-1", templateId: "t-1", usageCount: 0, revision: 0, order: 0 },
      ],
    });
    const repository = await seed(state);

    const added = await repository.addSharedTemplateSetMember({ setId: "set-1", fieldProfileId: "f-3" });
    await repository.bindTemplateShared({ setId: "set-1", templateId: "t-2" });

    await expect(
      repository.undoAddSharedTemplateSetMember({
        ...added.undo,
        setId: "set-1",
        fieldProfileId: "f-3",
      }),
    ).rejects.toBeInstanceOf(StaleUndoError);
  });

  it("owner assertion: 'Share this version' rejects a slot the acting Field does not own", async () => {
    // The contract's "expanded only by an explicit action by its owner" was
    // enforced only by UI convention - promoteFieldOnlySlot took no acting
    // Field at all, so any caller could broaden a peer's private
    // relationship.
    const state = baseState({
      templates: [template("t-1")],
      pageProfiles: [{ id: "p-1", siteId: "a.test" }, { id: "p-2", siteId: "a.test" }],
      fieldProfiles: [{ id: "f-1", pageProfileId: "p-1" }, { id: "f-2", pageProfileId: "p-2" }],
      sharedTemplateSets: [{ id: "set-1", siteId: "a.test", name: "Set", memberFieldProfileIds: ["f-1", "f-2"] }],
      sharedTemplateBindings: [
        {
          id: "slot-owner",
          setId: "set-1",
          templateId: "t-1",
          usageCount: 0,
          revision: 0,
          order: 0,
          ownerFieldProfileId: "f-1",
        },
      ],
    });
    const repository = await seed(state);

    await expect(
      repository.promoteFieldOnlySlot({ setId: "set-1", fieldProfileId: "f-2", slotId: "slot-owner" }),
    ).rejects.toThrow(/only by its owner/iu);

    const after = await repository.read();
    expect(after.sharedTemplateBindings[0]!.ownerFieldProfileId).toBe("f-1");
  });

  it("dangling private slot: the owner can still reach it once an ordinary slot for the same Template appears", async () => {
    // Pre-fix: the collapsed entry reported isFieldOnly false (an ordinary
    // slot also contributes), which hid `Share this version` - the only
    // action that can collapse the two. The private slot was then
    // unreachable: unshareable, unremovable, and its usage silently pooled
    // into the visible item. `fieldOnlySlotId` exposes it, and promoting it
    // runs the A.3 mode 2 cleanup collapse.
    const state = baseState({
      templates: [template("t-1")],
      pageProfiles: [{ id: "p-1", siteId: "a.test" }, { id: "p-2", siteId: "a.test" }],
      fieldProfiles: [{ id: "f-1", pageProfileId: "p-1" }, { id: "f-2", pageProfileId: "p-2" }],
      sharedTemplateSets: [{ id: "set-1", siteId: "a.test", name: "Set", memberFieldProfileIds: ["f-1", "f-2"] }],
      sharedTemplateBindings: [
        { id: "slot-ordinary", setId: "set-1", templateId: "t-1", usageCount: 1, revision: 0, order: 0 },
        {
          id: "slot-owner",
          setId: "set-1",
          templateId: "t-1",
          usageCount: 5,
          revision: 0,
          order: 1,
          ownerFieldProfileId: "f-1",
        },
      ],
    });
    const repository = await seed(state);

    const before = await repository.read();
    const entry = effectiveTemplateListForField(before, "f-1").entries;
    expect(entry).toHaveLength(1);
    // Not private (a peer already sees this Template), but the owner's own
    // private relation is still addressable.
    expect(entry[0]).toMatchObject({ isFieldOnly: false, fieldOnlySlotId: "slot-owner", usageCount: 6 });
    // A peer holds no private relation and is offered nothing to promote.
    expect(effectiveTemplateListForField(before, "f-2").entries[0]).toMatchObject({ fieldOnlySlotId: null });

    await repository.promoteFieldOnlySlot({ setId: "set-1", slotId: "slot-owner", fieldProfileId: "f-1" });

    const after = await repository.read();
    expect(after.sharedTemplateBindings).toEqual([
      { id: "slot-ordinary", setId: "set-1", templateId: "t-1", usageCount: 6, revision: 1, order: 0 },
    ]);
    expect(effectiveTemplateListForField(after, "f-1").entries[0]).toMatchObject({
      fieldOnlySlotId: null,
      usageCount: 6,
    });
  });
});

describe("Task 027 Addendum B Bind/Share integrity", () => {
  it("records insertion usage on the collapsed entry's primary visible relation only", async () => {
    const state = baseState({
      templates: [template("t-1")],
      pageProfiles: [{ id: "p-1", siteId: "a.test" }, { id: "p-2", siteId: "a.test" }],
      fieldProfiles: [{ id: "f-1", pageProfileId: "p-1" }, { id: "f-2", pageProfileId: "p-2" }],
      sharedTemplateSets: [{ id: "set-1", siteId: "a.test", name: "Set", memberFieldProfileIds: ["f-1", "f-2"] }],
      sharedTemplateBindings: [
        { id: "slot-private", setId: "set-1", templateId: "t-1", usageCount: 7, revision: 0, order: 1, ownerFieldProfileId: "f-2" },
        { id: "slot-shared", setId: "set-1", templateId: "t-1", usageCount: 3, revision: 0, order: 0 },
      ],
    });
    const repository = await seed(state);

    await repository.recordInsertion({ templateId: "t-1", fieldProfileId: "f-1" });

    const after = await repository.read();
    expect(after.sharedTemplateBindings.find((slot) => slot.id === "slot-shared")).toMatchObject({ usageCount: 4, revision: 1 });
    expect(after.sharedTemplateBindings.find((slot) => slot.id === "slot-private")).toMatchObject({ usageCount: 7, revision: 0 });
  });

  it("keeps an overridden owner-only relation addressable and shares the visible Override Template", async () => {
    const state = baseState({
      templates: [template("t-base", "Private base"), template("t-override", "Visible private version")],
      pageProfiles: [{ id: "p-1", siteId: "a.test" }, { id: "p-2", siteId: "a.test" }],
      fieldProfiles: [{ id: "f-1", pageProfileId: "p-1" }, { id: "f-2", pageProfileId: "p-2" }],
      sharedTemplateSets: [{ id: "set-1", siteId: "a.test", name: "Set", memberFieldProfileIds: ["f-1", "f-2"] }],
      sharedTemplateBindings: [
        { id: "slot-private", setId: "set-1", templateId: "t-base", usageCount: 2, revision: 0, order: 0, ownerFieldProfileId: "f-1" },
      ],
      sharedTemplateFieldStates: [
        { id: "state-override", setId: "set-1", slotId: "slot-private", fieldProfileId: "f-1", mode: "override", templateId: "t-override", usageCount: 4, revision: 0 },
      ],
    });
    const repository = await seed(state);
    expect(effectiveTemplateListForField(state, "f-1").entries[0]).toMatchObject({
      templateId: "t-override",
      fieldOnlySlotId: "slot-private",
    });

    await repository.promoteFieldOnlySlot({ setId: "set-1", slotId: "slot-private", fieldProfileId: "f-1" });

    const after = await repository.read();
    expect(after.sharedTemplateBindings).toContainEqual(expect.objectContaining({
      id: "slot-private",
      templateId: "t-override",
      usageCount: 4,
    }));
    expect(after.sharedTemplateBindings[0]!.ownerFieldProfileId).toBeUndefined();
    expect(after.sharedTemplateFieldStates).toEqual([]);
    expect(effectiveTemplateListForField(after, "f-2").templateIds).toEqual(["t-override"]);
  });

  it("consume promotion preserves an unrelated Override on the surviving ordinary slot", async () => {
    const state = baseState({
      templates: [template("t-1"), template("t-override")],
      pageProfiles: [{ id: "p-1", siteId: "a.test" }, { id: "p-2", siteId: "a.test" }],
      fieldProfiles: [{ id: "f-1", pageProfileId: "p-1" }, { id: "f-2", pageProfileId: "p-2" }],
      sharedTemplateSets: [{ id: "set-1", siteId: "a.test", name: "Set", memberFieldProfileIds: ["f-1", "f-2"] }],
      sharedTemplateBindings: [
        { id: "slot-shared", setId: "set-1", templateId: "t-1", usageCount: 1, revision: 0, order: 0 },
        { id: "slot-private", setId: "set-1", templateId: "t-1", usageCount: 2, revision: 0, order: 1, ownerFieldProfileId: "f-1" },
      ],
      sharedTemplateFieldStates: [
        { id: "state-override", setId: "set-1", slotId: "slot-shared", fieldProfileId: "f-1", mode: "override", templateId: "t-override", usageCount: 5, revision: 0 },
      ],
    });
    const repository = await seed(state);

    await repository.promoteFieldOnlySlot({ setId: "set-1", slotId: "slot-private", fieldProfileId: "f-1" });

    const after = await repository.read();
    expect(after.sharedTemplateFieldStates).toEqual(state.sharedTemplateFieldStates);
    expect(effectiveTemplateListForField(after, "f-1").templateIds).toEqual(["t-override"]);
    expect(effectiveTemplateListForField(after, "f-2").templateIds).toEqual(["t-1"]);
  });

  it("rejects an invalid Join Set & Share without persisting its membership half", async () => {
    const storage = new InMemoryLocalStorage();
    const repository = new FillNestRepository(storage);
    const state = baseState({
      templates: [template("t-1")],
      pageProfiles: [{ id: "p-1", siteId: "a.test" }, { id: "p-2", siteId: "a.test" }, { id: "p-3", siteId: "a.test" }],
      fieldProfiles: [{ id: "f-1", pageProfileId: "p-1" }, { id: "f-2", pageProfileId: "p-2" }, { id: "f-3", pageProfileId: "p-3" }],
      sharedTemplateSets: [{ id: "set-1", siteId: "a.test", name: "Set", memberFieldProfileIds: ["f-1", "f-2"] }],
      sharedTemplateBindings: [
        { id: "slot-private", setId: "set-1", templateId: "t-1", usageCount: 0, revision: 0, order: 0, ownerFieldProfileId: "f-1" },
      ],
    });
    await repository.replaceState(state);

    await expect(repository.joinSetAndShare({
      setId: "set-1",
      slotId: "slot-private",
      fieldProfileId: "f-2",
      targetFieldProfileId: "f-3",
    })).rejects.toThrow(/only by its owner/iu);

    expect(await repository.read()).toEqual(state);
  });

  it("invalidates mode-1 promotion Undo after the shared slot is used", async () => {
    const state = baseState({
      templates: [template("t-1")],
      pageProfiles: [{ id: "p-1", siteId: "a.test" }, { id: "p-2", siteId: "a.test" }],
      fieldProfiles: [{ id: "f-1", pageProfileId: "p-1" }, { id: "f-2", pageProfileId: "p-2" }],
      sharedTemplateSets: [{ id: "set-1", siteId: "a.test", name: "Set", memberFieldProfileIds: ["f-1", "f-2"] }],
      sharedTemplateBindings: [
        { id: "slot-private", setId: "set-1", templateId: "t-1", usageCount: 0, revision: 0, order: 0, ownerFieldProfileId: "f-1" },
      ],
    });
    const repository = await seed(state);
    const result = await repository.promoteFieldOnlySlot({ setId: "set-1", slotId: "slot-private", fieldProfileId: "f-1" });
    await repository.recordInsertion({ templateId: "t-1", fieldProfileId: "f-2" });

    await expect(repository.undoPromoteFieldOnlySlot({
      setId: "set-1",
      slotId: result.sharedBinding.id,
      ownerFieldProfileId: result.previousOwnerFieldProfileId,
    })).rejects.toThrow(StaleUndoError);
  });

  it("unbinds and restores a slot together with all of its dependent Field States", async () => {
    const state = baseState({
      templates: [template("t-1"), template("t-override")],
      pageProfiles: [{ id: "p-1", siteId: "a.test" }, { id: "p-2", siteId: "a.test" }],
      fieldProfiles: [{ id: "f-1", pageProfileId: "p-1" }, { id: "f-2", pageProfileId: "p-2" }],
      sharedTemplateSets: [{ id: "set-1", siteId: "a.test", name: "Set", memberFieldProfileIds: ["f-1", "f-2"] }],
      sharedTemplateBindings: [{ id: "slot-shared", setId: "set-1", templateId: "t-1", usageCount: 0, revision: 0, order: 0 }],
      sharedTemplateFieldStates: [
        { id: "state-override", setId: "set-1", slotId: "slot-shared", fieldProfileId: "f-1", mode: "override", templateId: "t-override", usageCount: 0, revision: 0 },
        { id: "state-exclude", setId: "set-1", slotId: "slot-shared", fieldProfileId: "f-2", mode: "exclude" },
      ],
    });
    const repository = await seed(state);

    const removed = await repository.unbindTemplateShared({ setId: "set-1", slotId: "slot-shared" });
    if (!removed) throw new Error("Expected the shared slot to be removed.");
    expect(removed).toMatchObject({ sharedBinding: state.sharedTemplateBindings[0], fieldStates: state.sharedTemplateFieldStates });
    expect((await repository.read()).sharedTemplateFieldStates).toEqual([]);

    await repository.undoUnbindTemplateShared(removed);
    expect(await repository.read()).toEqual(state);
  });

  it("keeps an owner-only Set-level copy affiliated only with its owner's Site", async () => {
    const state = baseState({
      sites: [{ id: "a.test" }, { id: "b.test" }],
      templates: [template("t-1")],
      pageProfiles: [{ id: "p-1", siteId: "a.test" }, { id: "p-2", siteId: "b.test" }],
      fieldProfiles: [{ id: "f-1", pageProfileId: "p-1" }, { id: "f-2", pageProfileId: "p-2" }],
      sharedTemplateSets: [{ id: "set-1", siteId: "a.test", name: "Set", memberFieldProfileIds: ["f-1", "f-2"] }],
      sharedTemplateBindings: [
        { id: "slot-private", setId: "set-1", templateId: "t-1", usageCount: 0, revision: 0, order: 0, ownerFieldProfileId: "f-1" },
      ],
    });
    const repository = await seed(state);

    const result = await repository.saveTemplateCopyForSharedSet({ setId: "set-1", slotId: "slot-private", content: "Edited privately" });

    expect(result.template.siteAffinities).toEqual(["a.test"]);
  });

  it("Addendum B: 'Join Set & Share' rejects a cross-Site target by default, but allows it with allowCrossSite", async () => {
    // The Picker's Finder-derived candidate list (Task 024) includes
    // cross-Site matches, so the composite must honor the same explicit
    // opt-in `addSharedTemplateSetMember` already requires - never silently
    // permit, never silently forbid.
    const state = baseState({
      sites: [{ id: "a.test" }, { id: "b.test" }],
      templates: [template("t-1")],
      pageProfiles: [{ id: "p-1", siteId: "a.test" }, { id: "p-2", siteId: "b.test" }],
      fieldProfiles: [{ id: "f-1", pageProfileId: "p-1" }, { id: "f-2", pageProfileId: "p-2" }],
      sharedTemplateSets: [{ id: "set-1", siteId: "a.test", name: "Set", memberFieldProfileIds: ["f-1"] }],
      sharedTemplateBindings: [
        { id: "slot-owner", setId: "set-1", templateId: "t-1", usageCount: 0, revision: 0, order: 0, ownerFieldProfileId: "f-1" },
      ],
    });
    const repository = await seed(state);

    await expect(
      repository.joinSetAndShare({
        setId: "set-1",
        slotId: "slot-owner",
        fieldProfileId: "f-1",
        targetFieldProfileId: "f-2",
      }),
    ).rejects.toThrow();

    const result = await repository.joinSetAndShare({
      setId: "set-1",
      slotId: "slot-owner",
      fieldProfileId: "f-1",
      targetFieldProfileId: "f-2",
      allowCrossSite: true,
    });
    expect(result.set.memberFieldProfileIds).toContain("f-2");
    expect(result.sharedBinding.ownerFieldProfileId).toBeUndefined();
  });
});
