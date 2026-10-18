import { E2E_EXTENSION_BUILD_DIR } from "../helpers/extension-build";
import { cp, mkdtemp, rm } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { expect, test, type BrowserContext, type Locator, type Page, type Worker } from "@playwright/test";

import { launchWithPermissionHistory } from "../helpers/prime-extension-permissions";

const FIELDS = Array.from({ length: 18 }, (_, index) => `<label for="f${index}">Field ${index}</label><input id="f${index}" />`).join("");
const FIXTURE_PAGES: Record<string, string> = {
  "/form": `<!doctype html><html><body>${FIELDS}</body></html>`,
};

/**
 * Task 044 (owner request, 2026-09-15). The Picker's header leads with the
 * FillNest mark on the Templates, and with Back and the page's name on the
 * Field list - where Back stays in reach however far the list scrolls.
 */
test("the header shows the mark on the Templates, and Back in the corner of the Field list", async () => {
  test.setTimeout(60_000);
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
    await page.goto(`${fixture.origin}/form`);
    const extensionPage = await context.newPage();
    await extensionPage.goto(`chrome-extension://${extensionId}/popup.html`);
    await grantOrigin(worker, extensionPage, page, `${fixture.origin}/form`);
    await page.bringToFront();

    await page.locator("#f0").focus();
    await page.getByRole("button", { name: "Open FillNest" }).click();
    const picker = page.getByRole("region", { name: "FillNest templates" });
    const header = picker.locator("header");

    // The Templates: the mark and the name, and no Back.
    await expect(header.locator('svg[data-fillnest-icon="brand"]')).toBeVisible();
    await expect(header.locator(".header-lead")).toHaveText("FillNest");
    await expect(picker.getByRole("button", { name: "Back" })).toHaveCount(0);
    expect(await header.locator("[data-fillnest-brand-accent]").evaluate((bar) => getComputedStyle(bar).fill)).toBe(
      "rgb(236, 48, 19)",
    );
    await page.screenshot({ path: "output/playwright/task044-picker-templates.png", clip: await clipOf(picker) });

    // The Field list: Back first in the header, the page's name beside it,
    // and no second Back at the bottom.
    await picker.getByRole("button", { name: "Share with…" }).click();
    const back = header.getByRole("button", { name: "Back" });
    await expect(back).toBeVisible();
    await expect(header.locator(".header-title")).toHaveText("Share with…");
    await expect(header.locator('svg[data-fillnest-icon="brand"]')).toHaveCount(0);
    await expect(picker.getByRole("button", { name: "Back" })).toHaveCount(1);
    await expect(picker.getByRole("searchbox")).toBeFocused();
    await page.screenshot({ path: "output/playwright/task044-picker-fields.png", clip: await clipOf(picker) });

    // However far the list scrolls, Back stays in the Picker's view.
    await picker.getByRole("button", { name: /^Show all/u }).click();
    await picker.evaluate((element) => element.scrollTo(0, element.scrollHeight));
    await expect.poll(() => picker.evaluate((element) => element.scrollTop)).toBeGreaterThan(40);
    const [pickerBox, backBox] = [await picker.boundingBox(), await back.boundingBox()];
    expect(backBox!.y).toBeGreaterThanOrEqual(pickerBox!.y);
    expect(backBox!.y + backBox!.height).toBeLessThanOrEqual(pickerBox!.y + 60);
    await page.screenshot({ path: "output/playwright/task044-picker-fields-scrolled.png", clip: await clipOf(picker) });
    await back.click();

    await expect(header.locator('svg[data-fillnest-icon="brand"]')).toBeVisible();
    await expect(picker.getByRole("button", { name: "Back" })).toHaveCount(0);
    await expect(picker.getByRole("searchbox", { name: /Search/u })).toBeFocused();
  } finally {
    await context?.close();
    await stopFixtureServer(fixture.server);
    await rm(userDataDir, { recursive: true, force: true });
    await rm(extensionBaseDir, { recursive: true, force: true });
  }
});

async function clipOf(locator: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await locator.boundingBox();
  if (!box) throw new Error("Picker is not on screen");
  return { x: Math.max(0, box.x - 8), y: Math.max(0, box.y - 8), width: box.width + 16, height: box.height + 16 };
}

async function extensionWorker(context: BrowserContext): Promise<Worker> {
  return context.serviceWorkers()[0] ?? context.waitForEvent("serviceworker");
}

async function grantOrigin(worker: Worker, extensionPage: Page, targetPage: Page, pageUrl: string): Promise<void> {
  expect(await sendRuntimeRequest(extensionPage, { type: "SET_GLOBAL_ACTIVATION", mode: "active" })).toEqual(
    expect.objectContaining({ ok: true }),
  );
  await targetPage.bringToFront();
  const tabId = await worker.evaluate(async () => {
    const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    return activeTab?.id;
  });
  if (tabId === undefined) throw new Error("Active Fixture tab ID is unavailable");
  expect(await sendRuntimeRequest(extensionPage, { type: "ENABLE_SITE", pageUrl, tabId })).toEqual({
    ok: true,
    value: expect.objectContaining({ status: "active" }),
  });
}

async function sendRuntimeRequest(page: Page, request: Record<string, unknown>): Promise<unknown> {
  return page.evaluate((message) => chrome.runtime.sendMessage(message), request);
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
