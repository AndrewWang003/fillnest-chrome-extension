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

// A "generate new fields" button appends a fresh <input name="name{N}"> each
// click, mirroring a real page's repeating-group form (e.g. a "Next of Kin"
// section where the user adds more people). None of these Fields is bound
// to anything when generated.
const FIXTURE_HTML = `<!doctype html>
<html>
  <style>#generated { margin-top: 1200px; }</style>
  <body>
    <input id="anchor" name="anchor" type="text" autocomplete="off" />
    <div id="generated"></div>
    <button type="button" id="generate" onclick="
      var n = document.querySelectorAll('#generated input').length + 1;
      var input = document.createElement('input');
      input.type = 'text';
      input.name = 'name' + n;
      input.id = 'name' + n;
      document.getElementById('generated').appendChild(input);
    ">Add another person</button>
  </body>
</html>`;

// Owner QA 2026-09-15. On the Picker's Field list ("Share with…"), a Field
// could look selected for good in two ways:
// - the page Field stayed outlined after the list went away while the pointer
//   rested on its row (here: Back pressed from the keyboard), because only
//   that row's mouseleave or blur cleared the outline;
// - a press on a row's Share, dragged off and released elsewhere, is no click
//   but leaves the button focused, and :focus-within kept the row painted as
//   selected wherever the pointer went.
test("a Field-list row and its page Field never stay selected once the pointer and the keyboard have left", async () => {
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
    await page.goto(fixture.origin);
    const extensionPage = await openExtensionPage(context, extensionId);
    await grantOrigin(worker, extensionPage, page, fixture.origin);
    await page.bringToFront();
    for (let i = 0; i < 8; i += 1) await page.locator("#generate").click();
    await page.locator("#anchor").focus();
    await page.getByRole("button", { name: "Open FillNest" }).click();
    await page.getByRole("button", { name: "Share with…" }).click();
    await page.getByRole("button", { name: "Show all 8 other Fields" }).click();
    const highlight = "data-fillnest-shared-candidate-highlight";
    const background = (text: string) =>
      page.locator(".find-similar-row").filter({ hasText: text }).evaluate((row) => getComputedStyle(row).backgroundColor);

    // The pointer rests on a row while the keyboard takes the list away.
    await page.locator(".find-similar-row").filter({ hasText: "name5" }).hover({ position: { x: 4, y: 4 } });
    await expect(page.locator("#name5")).toHaveAttribute(highlight, "");
    await page.getByRole("button", { name: "Back" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".find-similar-row")).toHaveCount(0);
    await expect(page.locator("#name5")).not.toHaveAttribute(highlight);

    await page.getByRole("button", { name: "Share with…" }).click();
    await page.getByRole("button", { name: "Show all 8 other Fields" }).click();

    // A press on Share, dragged off the row and released: no share, and no
    // row left looking selected.
    const row = page.locator(".find-similar-row").filter({ hasText: "name6" });
    await row.hover({ position: { x: 4, y: 4 } });
    const share = (await row.getByRole("button", { name: "Share" }).boundingBox())!;
    const picker = (await page.locator(".picker").boundingBox())!;
    await page.mouse.move(share.x + share.width / 2, share.y + share.height / 2, { steps: 3 });
    await page.mouse.down();
    await page.mouse.move(picker.x + 30, picker.y + picker.height - 12, { steps: 8 });
    await page.mouse.up();
    await page.mouse.move(picker.x - 150, picker.y + 200, { steps: 8 });
    await expect(page.locator(".find-similar-row")).toHaveCount(8);
    await expect.poll(() => background("name6")).toBe("rgba(0, 0, 0, 0)");
    await expect(page.locator("#name6")).not.toHaveAttribute(highlight);

    // The keyboard still shows where it is: Tab from that Share reaches the
    // next row, which is painted as selected.
    await page.keyboard.press("Tab");
    await expect.poll(() => background("name7")).not.toBe("rgba(0, 0, 0, 0)");
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
