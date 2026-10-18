// @vitest-environment happy-dom

import { render } from "preact";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createInitialFillNestState,
  FillNestRepository,
  type FillNestState,
  type LocalStorageArea,
} from "../../src/storage/fillnest-repository";
import { SharedSetsView } from "../../src/ui/side-panel/SharedSetsView";

// Task 040: the Templates page's Shared Sets tab, in the owner's language.

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

async function divergentState(): Promise<FillNestState> {
  const repo = repository();
  const a = await repo.createTemplateAndBind({
    pageUrl: "https://a.test/",
    pageProfileId: "home",
    pageIdentityKey: "/",
    fieldProfileId: "a",
    content: "A base",
  });
  const b = await repo.createTemplateAndBind({
    pageUrl: "https://b.test/tickets/reply",
    pageProfileId: "tickets",
    pageIdentityKey: "/tickets/reply",
    fieldProfileId: "b",
    fieldObservedTitle: "邮箱回复框",
    content: "B base",
  });
  const { set, sharedBindings } = await repo.createSharedTemplateSet({ fieldProfileIds: ["a", "b"], allowCrossSite: true });
  await repo.renameSharedTemplateSet({ setId: set.id, name: "客服回复组" });
  const slotOf = (templateId: string) => sharedBindings.find((slot) => slot.templateId === templateId)!.id;
  await repo.saveTemplateOverrideForField({ setId: set.id, slotId: slotOf(a.template.id), fieldProfileId: "b", content: "B 自己的 A" });
  await repo.excludeSharedTemplateForField({ setId: set.id, slotId: slotOf(b.template.id), fieldProfileId: "a" });
  await repo.createTemplateAndBindSharedFieldOnly({ setId: set.id, fieldProfileId: "a", content: "只给 A 的" });
  return repo.read();
}

const root = document.createElement("div");
document.body.append(root);

function renderInChinese(business: FillNestState): void {
  vi.stubGlobal("chrome", {
    runtime: {
      sendMessage: vi.fn(async () => ({ ok: true, value: "zh-Hans" })),
      onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
    },
  });
  render(<SharedSetsView business={business} onRefresh={async () => {}} onError={vi.fn()} onNotify={vi.fn()} />, root);
}

afterEach(async () => {
  render(null, root);
  await new Promise((resolve) => setTimeout(resolve, 20));
  vi.unstubAllGlobals();
});

function expand(name: string): void {
  const toggle = [...root.querySelectorAll("button")].find((button) => button.getAttribute("aria-label")?.includes(name));
  if (!toggle) throw new Error(`No expand control for ${name}`);
  toggle.click();
}

describe("SharedSetsView", () => {
  it("says how to create a Set when there is none", async () => {
    renderInChinese(createInitialFillNestState());
    await vi.waitFor(() => expect(root.textContent).toContain("还没有共享模版组"));
  });

  it("summarizes a collapsed Set: its fields, shared Templates and Sites", async () => {
    renderInChinese(await divergentState());
    await vi.waitFor(() => expect(root.textContent).toContain("客服回复组"));
    expect(root.textContent).toContain("2 个输入框 · 2 个模版 · 2 个网站");
    expect(root.textContent).not.toContain("A base");
  });

  it("shows the shared list once and, under each field, where it is and how it differs", async () => {
    renderInChinese(await divergentState());
    await vi.waitFor(() => expect(root.textContent).toContain("客服回复组"));
    expand("客服回复组");

    await vi.waitFor(() => expect(root.querySelector(".shared-set-templates")).not.toBeNull());
    const shared = [...root.querySelectorAll(".shared-set-templates li")].map((item) => item.textContent);
    expect(shared).toEqual(["A base", "B base"]);

    const members = [...root.querySelectorAll(".shared-set-member")];
    expect(members).toHaveLength(2);
    // A derived name, in Chinese: an unlabelled Field on a Site's home page.
    expect(members[0]!.textContent).toContain("输入框");
    expect(members[0]!.textContent).toContain("a.test › 首页");
    expect(members[0]!.textContent).toContain("不使用「B base」");
    expect(members[0]!.textContent).toContain("只给它的模版：「只给 A 的」");
    // The page's own words for a Field are shown as they are.
    expect(members[1]!.textContent).toContain("邮箱回复框");
    expect(members[1]!.textContent).toContain("b.test › Tickets / Reply");
    expect(members[1]!.textContent).toContain("自己的版本「B 自己的 A」，替代「A base」");
  });

  it("says a field with no differences uses every shared Template", async () => {
    const repo = repository();
    await repo.createTemplateAndBind({ pageUrl: "https://a.test/form", pageProfileId: "p", fieldProfileId: "a", content: "One" });
    await repo.createTemplateAndBind({ pageUrl: "https://a.test/form", pageProfileId: "p", fieldProfileId: "b", content: "Two" });
    const { set } = await repo.createSharedTemplateSet({ fieldProfileIds: ["a", "b"] });
    renderInChinese(await repo.read());
    await vi.waitFor(() => expect(root.textContent).toContain(set.name));
    expand(set.name);

    await vi.waitFor(() => expect(root.querySelectorAll(".shared-set-member")).toHaveLength(2));
    for (const member of root.querySelectorAll(".shared-set-member")) {
      expect(member.textContent).toContain("使用全部共享模版");
    }
  });
});
