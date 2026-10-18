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

/**
 * Task 037, slice 1. The language reaches every surface, immediately, and
 * leaves the user's own words alone.
 */
const FIXTURE_HTML = `<!doctype html>
<html>
  <body>
    <label for="field">Notes</label>
    <input id="field" type="text" autocomplete="notes" />
  </body>
</html>`;

const TEMPLATE = "Thanks for the quick reply";

test("the chosen language reaches every surface at once, and never touches the user's own words", async () => {
  test.setTimeout(120_000);
  const fixture = await startFixtureServer();
  const userDataDir = await mkdtemp(join(tmpdir(), "fillnest-playwright-"));
  const extensionBaseDir = await mkdtemp(join(tmpdir(), "fillnest-extension-"));
  const extensionPath = join(extensionBaseDir, "extension");
  await cp(resolve(E2E_EXTENSION_BUILD_DIR), extensionPath, { recursive: true });
  let context: BrowserContext | undefined;

  try {
    context = await launchWithPermissionHistory(userDataDir, extensionPath, [`${fixture.origin}/*`]);
    const worker = await extensionWorker(context);
    const extensionId = new URL(worker.url()).host;
    const page = await context.newPage();
    await page.goto(fixture.origin);
    const extensionPage = await openExtensionPage(context, extensionId);
    await grantOrigin(worker, extensionPage, page, fixture.origin);

    // A Template of the user's own, to prove it is left alone.
    await page.bringToFront();
    await page.locator("#field").click();
    await page.getByRole("button", { name: "Open FillNest" }).click();
    await page.getByRole("button", { name: "New template" }).click();
    await page.getByRole("textbox", { name: "Template content" }).fill(TEMPLATE);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("status").first()).toHaveText("Saved and bound to this field.");
    await page.keyboard.press("Escape");

    // The page status control starts in English.
    await expect(page.getByRole("button", { name: "Pause on this site" })).toHaveCount(1);

    // The Popup starts in English too.
    const popup = await openExtensionPage(context, extensionId);
    await expect(popup.getByText("Enable FillNest", { exact: true })).toBeVisible();

    // ---- Choose Chinese, from the Side Panel's Settings -----------------
    const sidePanel = await context.newPage();
    await sidePanel.goto(`chrome-extension://${extensionId}/side-panel.html`);
    await sidePanel.getByRole("button", { name: "Settings" }).click();
    await sidePanel.getByRole("combobox", { name: "Language" }).selectOption("zh-Hans");

    // The Side Panel says so itself.
    await expect(sidePanel.getByRole("heading", { name: "语言" })).toBeVisible();

    // ---- And every other open surface follows, with no reload ------------
    await expect(popup.getByText("启用 FillNest", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "在这个网站暂停" })).toHaveCount(1);

    // ---- The Picker inside the page follows too, and leaves the user's
    //      own Template exactly as they typed it ---------------------------
    await page.locator("#field").click();
    await page.getByRole("button", { name: "打开 FillNest" }).click();
    await expect(page.getByRole("region", { name: "FillNest 模版" })).toBeVisible();
    await expect(page.getByRole("button", { name: "新建模版" })).toBeVisible();
    await expect(page.getByRole("button", { name: TEMPLATE })).toBeVisible();
    await page.keyboard.press("Escape");

    // ---- And back again --------------------------------------------------
    await sidePanel.getByRole("combobox", { name: "语言" }).selectOption("en");
    await expect(popup.getByText("Enable FillNest", { exact: true })).toBeVisible();
  } finally {
    await context?.close();
    await rm(userDataDir, { recursive: true, force: true });
    await rm(extensionBaseDir, { recursive: true, force: true });
    await stopFixtureServer(fixture.server);
  }
});

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
  page: Page,
  origin: string,
): Promise<void> {
  const globalActivation = await extensionPage.evaluate(async (): Promise<RuntimeHarnessResponse> => {
    const result: unknown = await chrome.runtime.sendMessage({
      type: "SET_GLOBAL_ACTIVATION",
      mode: "active",
    });
    return result as RuntimeHarnessResponse;
  });
  if (!globalActivation.ok) throw new Error("SET_GLOBAL_ACTIVATION failed");

  await page.bringToFront();
  const tabId = await worker.evaluate(async () => {
    const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    return activeTab?.id ?? null;
  });
  if (tabId === null) throw new Error("Fixture tab not found");
  const response = await extensionPage.evaluate(
    async ({ pageUrl, id }): Promise<RuntimeHarnessResponse> => {
      const result: unknown = await chrome.runtime.sendMessage({ type: "ENABLE_SITE", pageUrl, tabId: id });
      return result as RuntimeHarnessResponse;
    },
    { pageUrl: `${origin}/`, id: tabId },
  );
  if (!response.ok) throw new Error(`ENABLE_SITE failed: ${response.error ?? "unknown"}`);
  await page.reload();
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
