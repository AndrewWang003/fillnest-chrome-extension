import { E2E_EXTENSION_BUILD_DIR } from "../helpers/extension-build";
import { cp, mkdtemp, rm } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { expect, test, type BrowserContext, type Locator, type Page, type Worker } from "@playwright/test";

import { launchWithPermissionHistory } from "../helpers/prime-extension-permissions";

const FIXTURE_PAGES: Record<string, string> = {
  "/form": `<!doctype html><html><body><label for="reply">Reply</label><input id="reply" /></body></html>`,
};

/**
 * Task 045 (owner QA, 2026-09-15). When a list grew long enough to scroll, the
 * scrollbar took its width from the content and everything re-laid out - the
 * UI jumped. Each scroll container now keeps its scrollbar's room whether or
 * not it scrolls, so content is exactly as wide either way.
 *
 * Each check measures the container's content width and one real control's
 * width, makes the container overflow, and measures again. The Popup is not
 * here: Chrome shows no scrollbar in a Popup that fits, and widens the Popup
 * window by the scrollbar's width when it does not (measured through
 * `chrome.action.openPopup()` on 2026-09-15), so its content never moves.
 */
test("no surface re-lays out when its content starts to scroll", async () => {
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

    // The Side Panel: its content area scrolls under a fixed navigation.
    const sidePanel = await context.newPage();
    await sidePanel.goto(`chrome-extension://${extensionId}/side-panel.html`);
    await expectSteadyWidth(sidePanel.locator(".panel-content"), sidePanel.locator(".panel-content > *").first());

    // The Picker: the whole panel scrolls, and so does its editor.
    await page.bringToFront();
    await page.locator("#reply").focus();
    await page.getByRole("button", { name: "Open FillNest" }).click();
    const picker = page.getByRole("region", { name: "FillNest templates" });
    await expectSteadyWidth(picker, picker.getByRole("searchbox", { name: "Search templates" }));

    await picker.getByRole("button", { name: "New template" }).click();
    const editor = picker.getByRole("textbox", { name: "Template content" });
    const before = await editor.evaluate((element) => element.clientWidth);
    await editor.fill(Array.from({ length: 40 }, (_, line) => `Line ${line}`).join("\n"));
    await expect.poll(() => editor.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
    expect(await editor.evaluate((element) => element.clientWidth)).toBe(before);
  } finally {
    await context?.close();
    await stopFixtureServer(fixture.server);
    await rm(userDataDir, { recursive: true, force: true });
    await rm(extensionBaseDir, { recursive: true, force: true });
  }
});

async function expectSteadyWidth(container: Locator, control: Locator): Promise<void> {
  await expect(control).toBeVisible();
  const measure = async () => ({
    content: await container.evaluate((element) => element.clientWidth),
    control: (await control.boundingBox())!.width,
  });
  const before = await measure();
  expect(await container.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(false);

  await container.evaluate((element) => {
    const filler = document.createElement("div");
    filler.dataset["testFiller"] = "";
    filler.style.height = "3000px";
    element.append(filler);
  });
  await expect.poll(() => container.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  expect(await measure()).toEqual(before);

  await container.evaluate((element) => {
    element.querySelector("[data-test-filler]")?.remove();
  });
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
