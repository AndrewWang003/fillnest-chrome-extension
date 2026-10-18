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
 * Task 038. The page status control is dragged where the user wants it and
 * stays there.
 *
 * The fixture is deliberately plain: what is being tested is the control's own
 * behaviour, not any page's.
 */
const FIXTURE_HTML = `<!doctype html>
<html>
  <body style="margin:0;height:200vh">
    <input id="field" type="text" autocomplete="notes" />
  </body>
</html>`;

test("the page status control drags, remembers where it was put, and still toggles on a plain click", async () => {
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
    await page.bringToFront();

    const host = page.locator("[data-fillnest-page-status]");
    await expect(host).toHaveCount(1);
    const before = await boxOf(host);
    // Its default is the bottom-right corner.
    expect(before.x).toBeGreaterThan(page.viewportSize()!.width / 2);
    expect(before.y).toBeGreaterThan(page.viewportSize()!.height / 2);

    // ---- A plain click still toggles, because a click is not a drag -------
    const control = page.getByRole("button", { name: /^(Pause on this site|Active on this site)$/u });
    const labelBefore = await control.getAttribute("aria-label");
    await control.click();
    await expect.poll(() => control.getAttribute("aria-label")).not.toBe(labelBefore);
    await control.click();
    await expect.poll(() => control.getAttribute("aria-label")).toBe(labelBefore);

    // ---- Dragging moves it, and does not toggle on the way ---------------
    await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
    await page.mouse.down();
    await page.mouse.move(140, 120, { steps: 12 });
    await page.mouse.up();

    const after = await boxOf(host);
    expect(after.x).toBeLessThan(before.x - 100);
    expect(after.y).toBeLessThan(before.y - 100);
    // The drag is not also a click on the toggle.
    expect(await control.getAttribute("aria-label")).toBe(labelBefore);

    // ---- It is still there after a reload, and on a fresh page -----------
    await page.reload();
    await expect(host).toHaveCount(1);
    await expect.poll(async () => Math.round((await boxOf(host)).x)).toBe(Math.round(after.x));
    await expect.poll(async () => Math.round((await boxOf(host)).y)).toBe(Math.round(after.y));

    const second = await context.newPage();
    await second.goto(fixture.origin);
    const secondHost = second.locator("[data-fillnest-page-status]");
    await expect(secondHost).toHaveCount(1);
    await expect.poll(async () => Math.round((await boxOf(secondHost)).x)).toBe(Math.round(after.x));

    // ---- A viewport too small for the stored position brings it back -----
    await second.setViewportSize({ width: 400, height: 400 });
    await expect
      .poll(async () => {
        const box = await boxOf(secondHost);
        return box.x + box.width <= 400 && box.y + box.height <= 400;
      })
      .toBe(true);
  } finally {
    await context?.close();
    await rm(userDataDir, { recursive: true, force: true });
    await rm(extensionBaseDir, { recursive: true, force: true });
    await stopFixtureServer(fixture.server);
  }
});

async function boxOf(locator: ReturnType<Page["locator"]>): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await locator.boundingBox();
  if (!box) throw new Error("The page status control has no layout box");
  return box;
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
