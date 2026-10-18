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
    <input id="field-a" type="text" autocomplete="notes" />
  </body>
</html>`;

test("field-scoped copy preserves the original elsewhere and Undo reverts it; a stale Save Undo fails closed with a clear error", async () => {
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

    // Bind a Template to field-a, then also bind it to a second synthetic
    // field (via a direct runtime request) so it has two Bindings and
    // qualifies for the Save-everywhere/Save-a-copy choice.
    await page.locator("#field-a").focus();
    await page.getByRole("button", { name: "Open FillNest" }).click();
    await page.getByRole("button", { name: "New template" }).click();
    await page.getByRole("textbox", { name: "Template content" }).fill("Shared reply");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("Saved and bound to this field.");

    const initialState = await readState(extensionPage);
    const template = findTemplate(initialState, "Shared reply");
    const bindingA = findBinding(initialState, template.id, "field-a-profile") ?? findAnyBinding(initialState, template.id);
    if (!bindingA) throw new Error("Expected Binding not found");

    const secondBind = await sendRuntimeRequest(extensionPage, {
      type: "BIND_TEMPLATE",
      templateId: template.id,
      pageUrl: fixture.origin,
      pageProfileId: bindingA.pageProfileId,
      fieldProfileId: "field-b-profile",
    });
    expect(secondBind.ok).toBe(true);

    // Edit from field-a's Picker: with two Bindings now, the choice appears.
    await page.locator("#field-a").focus();
    await page.getByRole("button", { name: "Open FillNest" }).click();
    await page.getByRole("button", { name: "Edit" }).click();
    await expect(page.getByRole("button", { name: "Save everywhere" })).toBeVisible();
    const copyButton = page.getByRole("button", { name: "Save a copy here" });
    await expect(copyButton).toBeVisible();

    await page.getByRole("textbox", { name: "Edit template content" }).fill("Shared reply, field-a only");
    await copyButton.click();
    await page.waitForTimeout(300);

    const afterCopy = await readState(extensionPage);
    // The original Template is untouched and still bound to field-b-profile.
    const original = afterCopy.templates.find((candidate) => candidate.id === template.id);
    expect(original?.content).toBe("Shared reply");
    expect(afterCopy.bindings.some((binding) => binding.templateId === template.id && binding.fieldProfileId === "field-b-profile")).toBe(true);
    // field-a now points at a brand-new copy Template with the edited content.
    const copyBinding = afterCopy.bindings.find((binding) => binding.fieldProfileId === bindingA.fieldProfileId);
    expect(copyBinding).toBeDefined();
    expect(copyBinding?.templateId).not.toBe(template.id);
    const copyTemplate = afterCopy.templates.find((candidate) => candidate.id === copyBinding?.templateId);
    expect(copyTemplate?.content).toBe("Shared reply, field-a only");
    expect(copyTemplate?.totalUsageCount).toBe(0);

    // Undo the copy: field-a's Binding reverts to the original Template.
    await page.locator(".picker-result").getByRole("button", { name: "Undo" }).click();
    await page.waitForTimeout(300);
    const afterUndo = await readState(extensionPage);
    expect(afterUndo.templates.some((candidate) => candidate.id === copyTemplate?.id)).toBe(false);
    expect(
      afterUndo.bindings.some(
        (binding) => binding.templateId === template.id && binding.fieldProfileId === bindingA.fieldProfileId,
      ),
    ).toBe(true);

    // A later successful mutation silently invalidates the prior Undo and
    // leaves the later change intact.
    await page.locator("#field-a").focus();
    await page.getByRole("button", { name: "Open FillNest" }).click();
    await page.getByRole("button", { name: "Edit" }).click();
    await page.getByRole("textbox", { name: "Edit template content" }).fill("First edit");
    await page.getByRole("button", { name: "Save everywhere" }).click();
    await page.waitForTimeout(300);

    const laterChange = await sendRuntimeRequest(extensionPage, {
      type: "UPDATE_TEMPLATE",
      templateId: template.id,
      content: "Later accepted change from elsewhere",
    });
    expect(laterChange.ok).toBe(true);

    await expect(page.locator(".picker-result").getByRole("button", { name: "Undo" })).toHaveCount(0);
    const finalState = await readState(extensionPage);
    const finalTemplate = finalState.templates.find((candidate) => candidate.id === template.id);
    expect(finalTemplate?.content).toBe("Later accepted change from elsewhere");
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
  pageProfileId: string;
  fieldProfileId: string;
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

function findBinding(state: StateShape, templateId: string, fieldProfileId: string): BindingShape | undefined {
  return state.bindings.find((binding) => binding.templateId === templateId && binding.fieldProfileId === fieldProfileId);
}

function findAnyBinding(state: StateShape, templateId: string): BindingShape | undefined {
  return state.bindings.find((binding) => binding.templateId === templateId);
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
