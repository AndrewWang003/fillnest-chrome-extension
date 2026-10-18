import { E2E_EXTENSION_BUILD_DIR } from "../helpers/extension-build";
import { cp, mkdtemp, rm } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { expect, test, type BrowserContext, type Page, type Worker } from "@playwright/test";

import { launchWithPermissionHistory } from "../helpers/prime-extension-permissions";

interface RuntimeHarnessResponse {
  ok: boolean;
  value?: unknown;
  error?: string;
}

const FIXTURE_PAGES: Record<string, string> = {
  "/a": `<!doctype html><html><body><input id="field-a" type="email" autocomplete="email" /><label for="field-c">Alternate email</label><input id="field-c" type="email" autocomplete="email" /></body></html>`,
  "/b": `<!doctype html><html><body><input id="field-b" type="email" autocomplete="email" /></body></html>`,
};

// Task 024 Slice 2: real headed regression for the Target Field Picker
// ("Find similar field"). field-a and field-b live on two different pages
// of the same Site and are both bound to distinct Templates through the
// ordinary Picker first, so each has a genuinely durable, non-empty
// effective Template list - "discoverable" per the Confirmed Contract. Both
// share the same generic `autocomplete="email"` evidence, so field-b is
// field-a's sole high-confidence, same-Site match - reachable only through
// this Picker's Search (cross-page discovery is never shown by default),
// and "Share Templates" there must create one Shared Template Set spanning
// both, exactly like the ordinary same-page Add Fields flow already covered
// by shared-template-set-empty-fields.spec.ts - proving the two independent
// discovery paths converge on the same, already-tested Share semantics.
test("finds a same-Site Field on another page only through Search, and shares Templates with it", async () => {
  test.setTimeout(60_000);
  const fixture = await startFixtureServer();
  const userDataDir = await mkdtemp(join(tmpdir(), "fillnest-playwright-"));
  const extensionBaseDir = await mkdtemp(join(tmpdir(), "fillnest-extension-"));
  const extensionPath = join(extensionBaseDir, "extension");
  await cp(resolve(E2E_EXTENSION_BUILD_DIR), extensionPath, { recursive: true });
  const fixturePattern = `${fixture.origin}/*`;
  let context: BrowserContext | undefined;

  try {
    context = await launchWithPermissionHistory(userDataDir, extensionPath, [fixturePattern]);
    const worker = await extensionWorker(context);
    const extensionId = new URL(worker.url()).host;
    const page = await context.newPage();
    await page.goto(`${fixture.origin}/a`);
    const extensionPage = await openExtensionPage(context, extensionId);
    await grantOrigin(worker, extensionPage, page, fixture.origin);
    await page.bringToFront();

    await page.locator("#field-a").focus();
    await page.getByRole("button", { name: "Open FillNest" }).click();
    await page.getByRole("button", { name: "New template" }).click();
    await page.getByRole("textbox", { name: "Template content" }).fill("Field A reply");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("Saved and bound to this field.");
    await page.getByRole("button", { name: "Close" }).click();

    await page.goto(`${fixture.origin}/b`);
    await page.locator("#field-b").focus();
    await page.getByRole("button", { name: "Open FillNest" }).click();
    await page.getByRole("button", { name: "New template" }).click();
    await page.getByRole("textbox", { name: "Template content" }).fill("Field B reply");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("Saved and bound to this field.");
    await page.getByRole("button", { name: "Close" }).click();

    await page.goto(`${fixture.origin}/a`);
    await page.locator("#field-a").focus();
    await page.getByRole("button", { name: "Open FillNest" }).click();
    // The persistent context row can assign the existing User Alias without
    // changing Field identity or needing a Template operation.
    const currentRename = page.locator(".picker-context .picker-field-alias-trigger");
    await expect(currentRename.locator("img")).toHaveCount(0);
    await currentRename.hover();
    await expect.poll(() => currentRename.evaluate((element) => getComputedStyle(element).boxShadow)).toContain("inset");
    await currentRename.click();
    await expect(page.getByRole("button", { name: "Share with…" })).toHaveCount(0);
    await expect(page.locator(".picker-context .picker-field-alias-editor").getByRole("button")).toHaveText(["Save", "Cancel"]);
    await page.getByRole("textbox", { name: "Name for this box" }).fill("Primary email");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.locator(".picker-context")).toContainText("Primary email");
    await page.getByRole("button", { name: "Share with…" }).click();

    // Task 034 follow-up. Two things had to be checked here rather than in a
    // stylesheet test: that the Locate action has a visible glyph at all - its
    // rule still sized an `img`, which Addendum B4 had replaced with a masked
    // span, so the button rendered empty - and that the page-status control
    // follows the chosen theme, its stylesheet having been the fourth one the
    // tokens did not reach.
    const locate = page.locator(".find-similar-row").filter({ hasText: "Alternate email" })
      .getByRole("button", { name: /^Locate/u });
    await expect
      .poll(() => locate.locator("[data-fillnest-asset]").evaluate((element) => {
        const box = element.getBoundingClientRect();
        return { width: box.width, height: box.height };
      }))
      .toEqual({ width: 14, height: 14 });

    await sendRuntimeRequest(extensionPage, {
      type: "SET_APPEARANCE",
      appearance: { themeId: "default", mode: "dark" },
    });
    const statusHost = page.locator("[data-fillnest-page-status]");
    await expect
      .poll(() => statusHost.evaluate((element) => (element as HTMLElement).dataset["fnMode"]))
      .toBe("dark");
    await expect
      .poll(() => statusHost.evaluate((element) => getComputedStyle(element).getPropertyValue("--fn-muted-fill").trim()))
      .toBe("#414957");
    await sendRuntimeRequest(extensionPage, {
      type: "SET_APPEARANCE",
      appearance: { themeId: "default", mode: "light" },
    });

    // An unbound live Field in the current page has the same rename path. The
    // explicit rename creates its local Profile on demand; passive browsing
    // still persists nothing.
    const localCandidate = page.locator(".find-similar-row").filter({ hasText: "Alternate email" });
    await localCandidate.getByRole("button", { name: 'Rename "Alternate email"' }).click();
    const localEditor = page.locator(".find-similar-row .picker-field-alias-editor");
    const editingRow = localEditor.locator("xpath=ancestor::li[contains(@class, 'find-similar-row')]");
    await expect(editingRow.getByRole("button", { name: "Share" })).toHaveCount(0);
    await expect(localEditor.getByRole("button")).toHaveText(["Save", "Cancel"]);
    await page.getByRole("textbox", { name: "Name for Alternate email" }).fill("Backup email");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.locator(".find-similar-row").filter({ hasText: "Backup email" })).toBeVisible();

    // Cross-page discovery is never shown by default - only Search reveals it.
    await expect(page.getByText("Field B reply")).not.toBeVisible();
    await page.getByRole("searchbox", { name: "Search Fields" }).fill("Field B");
    await expect(page.locator(".find-similar-row").filter({ hasText: "Field B reply" }).getByRole("button", { name: "Share" })).toBeVisible();

    await page.locator(".find-similar-row").filter({ hasText: "Field B reply" }).getByRole("button", { name: "Share" }).click();

    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(page.getByRole("status")).toContainText("Started sharing Templates with");
    // A successful Share closes the Target Field Picker back to the ordinary
    // context row, which now shows the new Shared Template Set.
    await expect(page.locator(".picker-context")).toContainText("2 fields use the same Templates");

    const state = await readState(extensionPage);
    expect(state.sharedTemplateSets).toHaveLength(1);
    expect(state.sharedTemplateSets[0]?.memberFieldProfileIds).toHaveLength(2);
    expect(state.sharedTemplateBindings.map((binding) => binding.templateId).sort()).toEqual(
      [...state.templates].map((template) => template.id).sort(),
    );
    // Both original direct Bindings survive, now dormant while shared.
    expect(state.bindings).toHaveLength(2);
    expect(state.fieldProfiles.map((field) => field.userAlias).filter(Boolean).sort()).toEqual([
      "Backup email",
      "Primary email",
    ]);

    // Give the original Template one independent effective use in addition
    // to the Shared Set. Editing it from a Shared member must now offer a
    // Set-scoped copy, and that copy must replace the Set relationship rather
    // than a dormant direct Binding of field-a.
    const originalTemplate = state.templates.find((template) => template.content === "Field A reply");
    const backupField = state.fieldProfiles.find((field) => field.userAlias === "Backup email");
    if (!originalTemplate || !backupField) throw new Error("Expected renamed Field and original Template");
    const independentBind = await sendRuntimeRequest(extensionPage, {
      type: "BIND_TEMPLATE",
      templateId: originalTemplate.id,
      pageUrl: `${fixture.origin}/a`,
      pageProfileId: backupField.pageProfileId,
      fieldProfileId: backupField.id,
    });
    expect(independentBind.ok).toBe(true);
    await page.bringToFront();
    const originalRow = page.locator("li[data-template-row]").filter({ hasText: "Field A reply" });
    await originalRow.getByRole("button", { name: "Edit" }).click();
    await page.getByRole("textbox", { name: "Edit template content" }).fill("Field A shared-set copy");
    await page.getByRole("button", { name: "Save for shared fields" }).click();
    await expect(page.getByRole("status")).toContainText("Saved a copy");

    const afterSharedCopy = await readState(extensionPage);
    const sharedTemplateIds = new Set(afterSharedCopy.sharedTemplateBindings.map((binding) => binding.templateId));
    expect(afterSharedCopy.templates.find((template) => template.id === originalTemplate.id)?.content).toBe("Field A reply");
    expect(afterSharedCopy.templates.some(
      (template) => sharedTemplateIds.has(template.id) && template.content === "Field A shared-set copy",
    )).toBe(true);
    expect(afterSharedCopy.sharedTemplateBindings.some((binding) => binding.templateId === originalTemplate.id)).toBe(false);
  } finally {
    await context?.close();
    await rm(userDataDir, { recursive: true, force: true });
    await rm(extensionBaseDir, { recursive: true, force: true });
    await stopFixtureServer(fixture.server);
  }
});

interface StateShape {
  sharedTemplateSets: Array<{ memberFieldProfileIds: string[] }>;
  sharedTemplateBindings: Array<{ templateId: string }>;
  templates: Array<{ id: string; content: string }>;
  bindings: unknown[];
  fieldProfiles: Array<{ id: string; pageProfileId: string; userAlias?: string }>;
}

async function readState(extensionPage: Page): Promise<StateShape> {
  const response = await sendRuntimeRequest(extensionPage, { type: "READ_STATE" });
  if (!response.ok) throw new Error(response.error ?? "READ_STATE failed");
  return response.value as StateShape;
}

async function extensionWorker(context: BrowserContext): Promise<Worker> {
  return context.serviceWorkers()[0] ?? context.waitForEvent("serviceworker");
}

async function openExtensionPage(context: BrowserContext, extensionId: string): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  return page;
}

async function grantOrigin(
  worker: Worker,
  extensionPage: Page,
  targetPage: Page,
  pageUrl: string,
): Promise<void> {
  const globalActivation = await sendRuntimeRequest(extensionPage, {
    type: "SET_GLOBAL_ACTIVATION",
    mode: "active",
  });
  expect(globalActivation).toEqual(expect.objectContaining({ ok: true }));
  await targetPage.bringToFront();
  const tabId = await worker.evaluate(async () => {
    const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    return activeTab?.id;
  });
  if (tabId === undefined) throw new Error("Active Fixture tab ID is unavailable");

  const result = await sendRuntimeRequest(extensionPage, {
    type: "ENABLE_SITE",
    pageUrl,
    tabId,
  });
  expect(result).toEqual({ ok: true, value: expect.objectContaining({ status: "active" }) });
}

async function sendRuntimeRequest(
  extensionPage: Page,
  request: Record<string, unknown>,
): Promise<RuntimeHarnessResponse> {
  await extensionPage.evaluate((message) => {
    document.querySelector("#browser-harness")?.remove();
    document.documentElement.removeAttribute("data-browser-result");
    const button = document.createElement("button");
    button.id = "browser-harness";
    button.textContent = "Run browser operation";
    button.addEventListener("click", () => {
      void chrome.runtime.sendMessage(message).then((result) =>
        document.documentElement.setAttribute("data-browser-result", JSON.stringify(result)),
      );
    });
    document.body.append(button);
  }, request);
  await extensionPage.bringToFront();
  await extensionPage.getByRole("button", { name: "Run browser operation" }).click();
  await expect
    .poll(() => extensionPage.getAttribute("html", "data-browser-result"), { timeout: 10_000 })
    .not.toBeNull();
  const serialized = await extensionPage.getAttribute("html", "data-browser-result");
  return JSON.parse(serialized ?? "null") as RuntimeHarnessResponse;
}

async function startFixtureServer(): Promise<{ server: Server; origin: string }> {
  return new Promise((resolvePromise) => {
    const server = createServer((request, response) => {
      const html = FIXTURE_PAGES[request.url ?? "/"];
      if (!html) {
        response.writeHead(404);
        response.end();
        return;
      }
      response.writeHead(200, { "content-type": "text/html" });
      response.end(html);
    });
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Fixture server address unavailable");
      resolvePromise({ server, origin: `http://127.0.0.1:${address.port}` });
    });
  });
}

async function stopFixtureServer(server: Server): Promise<void> {
  await new Promise<void>((resolvePromise) => server.close(() => resolvePromise()));
}
