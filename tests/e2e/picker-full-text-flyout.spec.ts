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

// Task 003 addendum of 2026-09-11, from the owner's QA: a row shows only a
// Template's first line, clamped, so the full-text flyout must open whenever
// the row hides part of the text - not only past 120 characters.
test("the full-text flyout opens exactly when a row hides part of its Template", async () => {
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

    const contents = {
      multiLine: "Leaving the list closed it\nThe flyout sits beside the Picker, so the pointer left the list first.",
      clampedLine: "A single line long enough that the row's two-line clamp has to cut it short, because it keeps going well past what two lines of this narrow Picker can hold.",
      short: "Short and whole",
    };
    await page.locator("#notes-field").click();
    await page.getByRole("button", { name: "Open FillNest" }).click();
    for (const content of Object.values(contents)) {
      await page.getByRole("button", { name: "New template" }).click();
      await page.getByRole("textbox", { name: "Template content" }).fill(content);
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await expect(page.locator(".template-preview", { hasText: content.split("\n")[0]!.slice(0, 20) })).toBeVisible();
    }

    const flyout = page.locator(".preview-flyout");
    async function hover(text: string): Promise<{ x: number; y: number; width: number; height: number }> {
      const row = page.locator("[data-template-row]", { has: page.locator(".template-preview", { hasText: text }) });
      const box = await row.boundingBox();
      if (!box) throw new Error(`No row for ${text}`);
      await page.mouse.move(box.x + 20, box.y + box.height / 2);
      await page.mouse.move(box.x + 30, box.y + box.height / 2);
      return box;
    }

    // Owner QA 2026-09-11: level with its row, reached by moving straight
    // across - no vertical travel - and it stays while the pointer is on it.
    async function crossTo(row: { x: number; y: number; height: number }): Promise<void> {
      const box = await flyout.boundingBox();
      if (!box) throw new Error("No flyout");
      const picker = (await page.locator(".picker").boundingBox())!;
      // Within the Picker's top and bottom, and level with its row when it fits.
      expect(box.y).toBeGreaterThanOrEqual(picker.y - 1);
      expect(box.y + box.height).toBeLessThanOrEqual(picker.y + picker.height + 1);
      if (row.y + box.height <= picker.y + picker.height) expect(Math.abs(box.y - row.y)).toBeLessThan(2);
      const y = Math.max(box.y + 4, Math.min(row.y + row.height / 2, box.y + box.height - 4));
      await page.mouse.move(box.x + 12, y, { steps: 8 });
      await page.waitForTimeout(600);
      await expect(flyout).toBeVisible();
    }

    const multiLineRow = await hover("Leaving the list");
    await expect(flyout).toBeVisible();
    await expect(flyout).toContainText("so the pointer left the list first");
    await crossTo(multiLineRow);

    const clampedRow = await hover("A single line long enough");
    await expect(flyout).toBeVisible();
    await expect(flyout).toContainText("what two lines of this narrow Picker can hold");
    await crossTo(clampedRow);

    await hover("Short and whole");
    await expect(flyout).toHaveCount(0);

    // Owner QA 2026-09-14: in a window too narrow for either side, the flyout
    // lies over the Picker, half see-through until the pointer is on it. Beside
    // the Picker, above, it was solid.
    await page.setViewportSize({ width: 420, height: 720 });
    await page.waitForTimeout(200);
    const opacity = () => flyout.evaluate((element) => getComputedStyle(element).opacity);
    await hover("A single line long enough");
    await expect(flyout).toBeVisible();
    await expect.poll(opacity).toBe("0.3");
    const covering = (await flyout.boundingBox())!;
    await page.mouse.move(covering.x + covering.width / 2, covering.y + 10, { steps: 4 });
    await expect.poll(opacity).toBe("1");
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
