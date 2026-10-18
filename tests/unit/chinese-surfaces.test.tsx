// @vitest-environment happy-dom

import { render } from "preact";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { FillNestState } from "../../src/storage/fillnest-repository";
import { createInitialFillNestState } from "../../src/storage/fillnest-repository";
import { Popup } from "../../src/ui/popup/Popup";
import { SidePanel } from "../../src/ui/side-panel/SidePanel";
import { TemplateLengthCounter } from "../../src/ui/shared/TemplateLengthCounter";

// Codex review, 2026-09-13: with Chinese chosen, the Side Panel still showed
// "2 options", "1 selected", "No Templates match this Search.", "1–10 of 12"
// and announced "Undo is available.", the length counter's tooltip stayed
// English, and every surface told assistive technology it was English. The
// source scan passed; this renders the surfaces in Chinese and reads them.

/** Words a Chinese surface may still show: the product's name, and user data. */
const ALLOWED = new Set(["FillNest"]);

function englishIn(root: Element, userData: readonly string[] = []): string[] {
  const texts: string[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.parentElement?.closest("style, script")) continue;
    texts.push(node.textContent ?? "");
  }
  for (const element of root.querySelectorAll("[aria-label], [title], [placeholder], [data-tooltip]")) {
    for (const name of ["aria-label", "title", "placeholder", "data-tooltip"]) {
      const value = element.getAttribute(name);
      if (value) texts.push(value);
    }
  }
  let all = texts.join("\n");
  for (const data of userData) all = all.split(data).join(" ");
  return [...new Set(all.match(/[A-Za-z]{2,}/gu) ?? [])].filter((word) => !ALLOWED.has(word));
}

function business(): FillNestState {
  const state = createInitialFillNestState();
  state.sites = [{ id: "example.test" }];
  state.pageProfiles = [{ id: "page", siteId: "example.test", identityKey: "/form" }];
  state.fieldProfiles = [{ id: "field", pageProfileId: "page", identityKey: "field", observedTitle: "客户邮箱" }];
  state.templates = ["第一条", "第二条"].map((content, index) => ({
    id: `t${index}`,
    content,
    siteAffinities: ["example.test"],
    createdAt: "x",
    updatedAt: "x",
    totalUsageCount: 0,
    revision: 0,
  }));
  state.bindings = state.templates.map((template, index) => ({
    id: `b${index}`,
    templateId: template.id,
    pageProfileId: "page",
    fieldProfileId: "field",
    createdAt: "x",
    usageCount: 0,
    revision: 0,
  }));
  return state;
}

const origins = Array.from({ length: 12 }, (_, index) => ({
  origin: `https://s${index}.example.test:443`,
  originActivation: "active",
}));

function stubChrome(extra?: (request: { type: string }) => unknown) {
  const sendMessage = vi.fn(async (request: { type: string }) => {
    const overridden = extra?.(request);
    if (overridden !== undefined) return overridden;
    if (request.type === "GET_LANGUAGE") return { ok: true, value: "zh-Hans" };
    if (request.type === "READ_STATE") return { ok: true, value: business() };
    if (request.type === "GET_ACTIVATION_MANAGEMENT") return { ok: true, value: { global: "active", origins } };
    return { ok: true, value: {} };
  });
  vi.stubGlobal("chrome", {
    runtime: { sendMessage, onMessage: { addListener: vi.fn(), removeListener: vi.fn() } },
    tabs: { query: vi.fn(async () => [{ url: "https://example.test/form" }]) },
  });
  return sendMessage;
}

const root = document.createElement("div");
document.body.append(root);

afterEach(async () => {
  render(null, root);
  await new Promise((resolve) => setTimeout(resolve, 40));
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute("lang");
});

function button(name: string): HTMLButtonElement {
  const found = [...root.querySelectorAll("button")].find((candidate) => candidate.textContent?.trim() === name || candidate.getAttribute("aria-label") === name);
  if (!found) throw new Error(`No button ${name}`);
  return found;
}

async function openSidePanel(): Promise<void> {
  render(<SidePanel />, root);
  await vi.waitFor(() => expect(root.textContent).toContain("模版"));
  await vi.waitFor(() => expect(root.querySelector("nav")?.textContent).toContain("概览"));
}

describe("the surfaces in Chinese", () => {
  it("tell assistive technology the Side Panel and the Popup are Chinese", async () => {
    stubChrome();
    await openSidePanel();
    await vi.waitFor(() => expect(document.documentElement.lang).toBe("zh-Hans"));

    render(null, root);
    document.documentElement.lang = "en";
    render(<Popup />, root);
    await vi.waitFor(() => expect(document.documentElement.lang).toBe("zh-Hans"));
  });

  it("show a Field card's count in Chinese", async () => {
    stubChrome();
    await openSidePanel();
    button("模版").click();
    await vi.waitFor(() => expect(root.querySelector(".field-card-count")).not.toBeNull());
    expect(root.querySelector(".field-card-count")?.textContent).toBe("2 个模版");
    expect(englishIn(root)).toEqual([]);
  });

  it("show All templates' selection and an empty Search in Chinese", async () => {
    stubChrome();
    await openSidePanel();
    button("模版").click();
    await vi.waitFor(() => expect(button("全部模版")).toBeDefined());
    button("全部模版").click();
    await vi.waitFor(() => expect(root.querySelector('.template-list input[type="checkbox"]')).not.toBeNull());

    root.querySelector<HTMLInputElement>('.template-list input[type="checkbox"]')!.click();
    await vi.waitFor(() => expect(root.textContent).toContain("已选 1 个"));
    expect(englishIn(root)).toEqual([]);

    const search = root.querySelector<HTMLInputElement>('input[type="search"]')!;
    search.value = "不存在的内容";
    search.dispatchEvent(new InputEvent("input", { bubbles: true }));
    await vi.waitFor(() => expect(root.textContent).toContain("没有符合搜索的模版。"));
    expect(englishIn(root, ["不存在的内容"])).toEqual([]);
  });

  it("page the Sites list in Chinese", async () => {
    stubChrome();
    await openSidePanel();
    button("网站").click();
    await vi.waitFor(() => expect(button("全部地址")).toBeDefined());
    button("全部地址").click();
    await vi.waitFor(() => expect(root.querySelector(".sites-pagination")).not.toBeNull());
    expect(root.querySelector(".sites-pagination")?.textContent).toContain("第 1–10 个，共 12 个");
    expect(englishIn(root.querySelector(".sites-pagination")!)).toEqual([]);
  });

  it("announce that Undo is available in Chinese", async () => {
    stubChrome((request) =>
      request.type === "DELETE_TEMPLATE"
        ? { ok: true, value: { template: business().templates[0], bindings: [], sharedBindings: [], fieldStates: [] } }
        : undefined,
    );
    await openSidePanel();
    button("模版").click();
    await vi.waitFor(() => expect(button("全部模版")).toBeDefined());
    button("全部模版").click();
    await vi.waitFor(() => expect(root.querySelector('.template-list [aria-label="删除"]')).not.toBeNull());
    root.querySelector<HTMLButtonElement>('.template-list [aria-label="删除"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 100));
    const confirm = [...root.querySelectorAll<HTMLButtonElement>(".clean-up-sheet button.danger")][0];
    confirm?.click();

    await vi.waitFor(() => expect(document.querySelector(".visually-hidden[aria-live], [role='status'].visually-hidden")?.textContent ?? "").toContain("撤销"));
    const announcement = document.querySelector(".visually-hidden[aria-live], [role='status'].visually-hidden")!;
    expect(englishIn(announcement, ["第一条"])).toEqual([]);
  });

  it("explain the length counter in Chinese", async () => {
    stubChrome();
    render(<TemplateLengthCounter content={"字".repeat(900)} />, root);
    await vi.waitFor(() => expect(root.querySelector(".template-length-counter")?.textContent).toContain("字"));
    expect(englishIn(root)).toEqual([]);
  });
});
