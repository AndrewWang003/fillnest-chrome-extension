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
    <input id="field-b" type="text" autocomplete="off" />
  </body>
</html>`;

test("Picker Undo survives visiting a different Field and returning, as long as nothing new happened there", async () => {
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

    // Seed a Global Template (unbound anywhere) so it is reachable via Search
    // from either field, then Bind it to field-a from the Picker - a Bind is
    // an undoable key data operation, unlike creating via "New template".
    const seeded = await sendRuntimeRequest(extensionPage, {
      type: "RESTORE_TEMPLATE",
      template: {
        id: "template-1",
        content: "Field A reply",
        siteAffinities: [],
        createdAt: "2026-08-16T00:00:00.000Z",
        updatedAt: "2026-08-16T00:00:00.000Z",
        totalUsageCount: 0,
        revision: 0,
      },
      bindings: [],
    });
    expect(seeded.ok).toBe(true);

    await page.locator("#field-a").focus();
    await page.getByRole("button", { name: "Open FillNest" }).click();
    await page.getByRole("searchbox", { name: "Search templates" }).fill("Field A reply");
    await page.getByRole("button", { name: "Bind" }).click();
    await expect(page.getByRole("status")).toHaveText(/Bound .* to this field\./u);
    await expect(page.locator(".picker-result").getByRole("button", { name: "Undo" })).toBeVisible();

    // Visit field-b without performing any operation there: its Picker must
    // not expose field-a's Undo, but must not destroy it either.
    await page.locator("#field-b").focus();
    await page.getByRole("button", { name: "Open FillNest" }).click();
    await expect(page.locator(".picker-result").getByRole("button", { name: "Undo" })).toHaveCount(0);

    // Return to field-a without ever having done anything on field-b - the
    // original Bind Undo must still be there and still work.
    await page.locator("#field-a").focus();
    await page.getByRole("button", { name: "Open FillNest" }).click();
    const undoButtonOnFieldA = page.locator(".picker-result").getByRole("button", { name: "Undo" });
    await expect(undoButtonOnFieldA).toBeVisible();
    await undoButtonOnFieldA.click();

    const state = await readState(extensionPage);
    expect(state.bindings).toHaveLength(0);
  } finally {
    await context?.close();
    await rm(userDataDir, { recursive: true, force: true });
    await rm(extensionBaseDir, { recursive: true, force: true });
    await stopFixtureServer(fixture.server);
  }
});

interface StateShape {
  bindings: unknown[];
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
