// Task 020 Addendum A (2026-09-11 audit). Confirming a Logical Page match
// merges two Fields' Bindings, and the merged Field must remain an ordinary
// Field afterwards: the user can still create, bind, unbind and delete
// Templates on it. Relationship provenance used to require the canonical
// Field's Bindings to stay exactly the set that was merged, so every one of
// those actions was refused as "local data does not match schema version 13".

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

const canonical = {
  pageUrl: "https://forms.example.test/customers/123",
  pageProfileId: "page-canonical",
  fieldProfileId: "field-canonical",
  pageIdentityKey: "/customers/123",
  fieldIdentityKey: "name:notes",
};

async function confirmedMatch() {
  const repo = repository();
  const first = await repo.createTemplateAndBind({ ...canonical, content: "First" });
  const second = await repo.createTemplateAndBind({
    ...canonical,
    pageUrl: "https://forms.example.test/customers/456",
    pageProfileId: "page-source",
    fieldProfileId: "field-source",
    pageIdentityKey: "/customers/456",
    content: "Second",
  });
  const key = await repo.getOrCreateLogicalPageSiteKey(canonical.pageUrl);
  const evidence = {
    origin: "https://forms.example.test",
    routePattern: "/customers/:number",
    fieldFeatures: new Set(["a".repeat(64)]),
    groupedFieldFeatures: new Set(["b".repeat(64)]),
    fieldIdentityKey: canonical.fieldIdentityKey,
  };
  await repo.recordLogicalPageObservation({
    pageUrl: canonical.pageUrl,
    pageProfileId: canonical.pageProfileId,
    siteKeyId: key.siteKeyId,
    evidence,
  });
  await repo.confirmLogicalPageCandidate({
    ruleId: "rule-1",
    canonicalPageProfileId: canonical.pageProfileId,
    pageIdentityKey: "/customers/456",
    evidence,
  });
  return { repo, first: first.template, second: second.template };
}

async function templatesOn(repo: FillNestRepository, fieldProfileId: string): Promise<string[]> {
  const state = await repo.read();
  return state.bindings
    .filter((binding) => binding.fieldProfileId === fieldProfileId)
    .map((binding) => state.templates.find((template) => template.id === binding.templateId)!.content)
    .sort();
}

describe("a Field merged by a confirmed Logical Page match", () => {
  it("offers the union of both Fields' Templates", async () => {
    const { repo } = await confirmedMatch();
    expect(await templatesOn(repo, canonical.fieldProfileId)).toEqual(["First", "Second"]);
  });

  it("can take a new Template", async () => {
    const { repo } = await confirmedMatch();
    await repo.createTemplateAndBind({ ...canonical, content: "Third" });
    expect(await templatesOn(repo, canonical.fieldProfileId)).toEqual(["First", "Second", "Third"]);
  });

  it("can have a Template unbound", async () => {
    const { repo, first } = await confirmedMatch();
    await repo.unbindTemplate({ templateId: first.id, fieldProfileId: canonical.fieldProfileId });
    expect(await templatesOn(repo, canonical.fieldProfileId)).toEqual(["Second"]);
  });

  it("can have a bound Template deleted", async () => {
    const { repo, second } = await confirmedMatch();
    await repo.deleteTemplate({ templateId: second.id });
    expect(await templatesOn(repo, canonical.fieldProfileId)).toEqual(["First"]);
  });

  it("separates with the Field's current list, not the list it had when merged", async () => {
    const { repo, first } = await confirmedMatch();
    await repo.createTemplateAndBind({ ...canonical, content: "Third" });
    await repo.unbindTemplate({ templateId: first.id, fieldProfileId: canonical.fieldProfileId });

    await repo.stopLogicalPageMatching({ ruleId: "rule-1" });

    expect(await templatesOn(repo, canonical.fieldProfileId)).toEqual(["Second", "Third"]);
    expect(await templatesOn(repo, "field-source")).toEqual(["Second", "Third"]);
  });
});
