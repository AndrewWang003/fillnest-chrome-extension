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
    <input id="notes-field" type="text" autocomplete="off" />
  </body>
</html>`;

// Task 042: a first-time user sees a Getting started card on the Picker and
// the Popup, and a one-line note on a page's first visit. The
// Picker's card sits above Search, keeps Search focused and covers no field.
test("a first-time user gets a start card on the Popup and the Picker, page notes, once, and Show tips again brings them back", async () => {
  test.setTimeout(90_000);
  const fixture = await startFixtureServer();
  const userDataDir = await mkdtemp(join(tmpdir(), "fillnest-playwright-"));
  const extensionBaseDir = await mkdtemp(join(tmpdir(), "fillnest-extension-"));
  const extensionPath = join(extensionBaseDir, "extension");
  await cp(resolve(E2E_EXTENSION_BUILD_DIR), extensionPath, { recursive: true });
  let context: BrowserContext | undefined;

  try {
    context = await launchWithPermissionHistory(userDataDir, extensionPath, [`${fixture.origin}/*`], { firstUseTips: "shown" });
    const worker = await extensionWorker(context);
    const extensionId = new URL(worker.url()).host;
    const extensionPage = await openExtensionPage(context, extensionId);
    await sendRuntimeRequest(extensionPage, { type: "SET_GLOBAL_ACTIVATION", mode: "active" });
    const page = await context.newPage();
    await page.goto(fixture.origin);
    await page.bringToFront();
    const tabId = await worker.evaluate(async () => {
      const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      return activeTab?.id;
    });
    if (tabId === undefined) throw new Error("Active Fixture tab ID is unavailable");
    await sendRuntimeRequest(extensionPage, { type: "ENABLE_SITE", pageUrl: fixture.origin, tabId });
    await page.bringToFront();

    // The Picker.
    await page.locator("#notes-field").click();
    await page.getByRole("button", { name: "Open FillNest" }).click();
    const pickerCard = page.locator(".picker .fn-tip");
    await expect(pickerCard).toBeVisible();
    await expect(pickerCard).toContainText("Start by creating a Template.");
    await expect(page.getByRole("searchbox", { name: "Search templates" })).toBeFocused();
    const field = (await page.locator("#notes-field").boundingBox())!;
    const picker = (await page.locator(".picker").boundingBox())!;
    const overlaps = picker.x < field.x + field.width && field.x < picker.x + picker.width &&
      picker.y < field.y + field.height && field.y < picker.y + picker.height;
    expect(overlaps).toBe(false);
    await pickerCard.getByRole("button", { name: "OK, hide these tips" }).click();
    await expect(pickerCard).toHaveCount(0);
    await page.keyboard.press("Escape");
    await page.reload();
    await page.locator("#notes-field").click();
    await page.getByRole("button", { name: "Open FillNest" }).click();
    await expect(page.getByRole("searchbox", { name: "Search templates" })).toBeVisible();
    await expect(page.locator(".picker .fn-tip")).toHaveCount(0);

    // The Popup.
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await expect(popup.locator(".fn-tip")).toContainText("Choose [Allow access] to let FillNest work on this site.");
    await popup.getByRole("button", { name: "OK, hide these tips" }).click();
    await popup.reload();
    await expect(popup.getByRole("button", { name: "Open FillNest" })).toBeVisible();
    await expect(popup.locator(".fn-tip")).toHaveCount(0);

    // The Side Panel, a page note, and Show tips again.
    const sidePanel = await context.newPage();
    await sidePanel.goto(`chrome-extension://${extensionId}/side-panel.html`);
    // Overview and Settings carry no tip (owner QA 2026-09-15).
    await expect(sidePanel.getByRole("heading", { name: "Enable FillNest" })).toBeVisible();
    await expect(sidePanel.locator(".fn-tip, .fn-tip-note")).toHaveCount(0);
    await sidePanel.getByRole("button", { name: "Sites", exact: true }).click();
    const sitesNote = sidePanel.locator(".fn-tip-note");
    await expect(sitesNote).toContainText("Pause, clear or remove a site.");
    await sitesNote.getByRole("button", { name: "OK, hide this tip" }).click();
    await expect(sitesNote).toHaveCount(0);
    await sidePanel.getByRole("button", { name: "Settings", exact: true }).click();
    await expect(sidePanel.locator(".fn-tip, .fn-tip-note")).toHaveCount(0);
    await sidePanel.getByRole("button", { name: "Show tips again" }).click();
    await sidePanel.getByRole("dialog").getByRole("button", { name: "Show again" }).click();
    await expect(sidePanel.getByText("Tips will show again.")).toBeVisible();
    await sidePanel.getByRole("button", { name: "Sites", exact: true }).click();
    await expect(sidePanel.locator(".fn-tip-note")).toContainText("Pause, clear or remove a site.");
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
