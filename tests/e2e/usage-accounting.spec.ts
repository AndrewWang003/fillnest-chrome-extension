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

const FIXTURE_HTML = `<!doctype html>
<html>
  <body>
    <input id="bound-field" type="text" autocomplete="notes" />
    <input id="other-field" type="text" autocomplete="off" />
  </body>
</html>`;

test("successful insertion increments usage exactly once per insertion, bound and unbound, and Delete Undo restores it", async () => {
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
    await page.goto(fixture.origin);
    const extensionPage = await openExtensionPage(context, extensionId);
    await grantOrigin(worker, extensionPage, page, fixture.origin);
    await page.bringToFront();

    // Create and bind a Template to #bound-field, then insert it twice.
    await page.locator("#bound-field").focus();
    await page.getByRole("button", { name: "Open FillNest" }).click();
    await page.getByRole("button", { name: "New template" }).click();
    await page.getByRole("textbox", { name: "Template content" }).fill("Reusable reply");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("Saved and bound to this field.");

    await page.locator("#bound-field").focus();
    await page.getByRole("button", { name: "Open FillNest" }).click();
    await page.getByRole("button", { name: "Reusable reply" }).click();

    let state = await readState(extensionPage);
    let template = findTemplate(state, "Reusable reply");
    let binding = findBindingForTemplate(state, template.id);
    expect(template.totalUsageCount).toBe(1);
    expect(binding.usageCount).toBe(1);

    await page.locator("#bound-field").focus();
    await page.getByRole("button", { name: "Open FillNest" }).click();
    await page.getByRole("button", { name: "Reusable reply" }).click();

    state = await readState(extensionPage);
    template = findTemplate(state, "Reusable reply");
    binding = findBindingForTemplate(state, template.id);
    expect(template.totalUsageCount).toBe(2);
    expect(binding.usageCount).toBe(2);

    // Unbound Search insertion on a different field: only the Template total moves.
    await page.locator("#other-field").focus();
    await page.getByRole("button", { name: "Open FillNest" }).click();
    await page.getByRole("searchbox", { name: "Search templates" }).fill("reusable");
    await page.getByRole("button", { name: "Reusable reply" }).click();

    state = await readState(extensionPage);
    template = findTemplate(state, "Reusable reply");
    binding = findBindingForTemplate(state, template.id);
    expect(template.totalUsageCount).toBe(3);
    expect(binding.usageCount).toBe(2);

    // Delete then Undo restores the exact prior usage counts, not zeros.
    await page.locator("#bound-field").focus();
    await page.getByRole("button", { name: "Open FillNest" }).click();
    await page.getByRole("button", { name: "Delete template everywhere" }).click();
    await expect(page.getByRole("status")).toHaveText(/Deleted .* from 1 field and your library\./u);
    state = await readState(extensionPage);
    expect(state.templates).toHaveLength(0);

    await page.locator(".picker-result").getByRole("button", { name: "Undo" }).click();
    await page.waitForTimeout(300);
    state = await readState(extensionPage);
    template = findTemplate(state, "Reusable reply");
    binding = findBindingForTemplate(state, template.id);
    expect(template.totalUsageCount).toBe(3);
    expect(binding.usageCount).toBe(2);
  } finally {
    await context?.close();
    await rm(userDataDir, { recursive: true, force: true });
    await rm(extensionBaseDir, { recursive: true, force: true });
    await stopFixtureServer(fixture.server);
  }
});

interface TemplateShape {
  id: string;
  content: string;
  totalUsageCount: number;
}
interface BindingShape {
  id: string;
  templateId: string;
  fieldProfileId: string;
  usageCount: number;
}
interface StateShape {
  templates: TemplateShape[];
  bindings: BindingShape[];
}

function findTemplate(state: StateShape, content: string): TemplateShape {
  const template = state.templates.find((candidate) => candidate.content === content);
  if (!template) throw new Error(`Template not found: ${content}`);
  return template;
}

function findBindingForTemplate(state: StateShape, templateId: string): BindingShape {
  const binding = state.bindings.find((candidate) => candidate.templateId === templateId);
  if (!binding) throw new Error(`Binding not found for Template: ${templateId}`);
  return binding;
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
    const server = createServer((_request, response) => {
      response.writeHead(200, { "content-type": "text/html" });
      response.end(FIXTURE_HTML);
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
