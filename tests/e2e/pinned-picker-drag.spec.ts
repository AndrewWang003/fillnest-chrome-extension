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
    <div style="display:grid;grid-template-columns:repeat(2, 300px);gap:18px 60px;padding:20px">
      ${Array.from({ length: 10 }, (_, index) => `<label>Field ${index}<input id="field-${index}" type="text" autocomplete="off" /></label>`).join("")}
    </div>
  </body>
</html>`;

// Owner QA 2026-09-11: dragging a pinned Picker past the viewport edge drew
// a trail of Picker copies that could not be closed, and a press on the header
// took focus out of the Picker and started a text selection that followed the
// pointer across the page's Fields.
test("dragging a pinned Picker across the page leaves one Picker, and focus and the page alone", async () => {
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

    await page.locator("#field-0").click();
    await page.getByRole("button", { name: "Open FillNest" }).click();
    await page.getByRole("button", { name: "Keep open" }).click();
    const focusedInPicker = () =>
      page.evaluate(() => document.querySelector("[data-fillnest-overlay]")?.shadowRoot?.activeElement?.getAttribute("aria-label") ?? null);
    const before = await focusedInPicker();
    expect(before).not.toBeNull();
    await page.evaluate(() => {
      (window as unknown as { focusedFields: string[] }).focusedFields = [];
      document.addEventListener("focusin", (event) => {
        const target = event.target as HTMLElement;
        if (target.id.startsWith("field-")) (window as unknown as { focusedFields: string[] }).focusedFields.push(target.id);
      }, true);
    });

    const header = (await page.locator(".picker header strong").boundingBox())!;
    await page.mouse.move(header.x + 5, header.y + 5);
    await page.mouse.down();
    // Across every Field, and far enough down that the Picker is clamped
    // against the bottom of the viewport.
    for (const [x, y] of [[600, 80], [100, 300], [650, 500], [120, 200], [500, 650], [300, 120]] as const) {
      await page.mouse.move(x, y, { steps: 25 });
    }
    await page.mouse.up();

    await expect(page.locator(".picker")).toHaveCount(1);
    expect(await page.evaluate(() => document.querySelector("[data-fillnest-overlay]")!.shadowRoot!.querySelectorAll(".picker").length)).toBe(1);
    expect(await focusedInPicker()).toBe(before);
    expect(await page.evaluate(() => (window as unknown as { focusedFields: string[] }).focusedFields)).toEqual([]);
    expect(await page.evaluate(() => String(getSelection()))).toBe("");

    await page.getByRole("button", { name: "Close" }).click();
    await expect(page.locator(".picker")).toHaveCount(0);
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
