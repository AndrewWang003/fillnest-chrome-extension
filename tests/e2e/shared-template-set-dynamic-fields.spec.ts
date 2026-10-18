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

// Regression: "Add Fields" must offer *every* dynamically-added, never-bound
// Field as a candidate, not only the first two - reported directly by the
// user testing a real repeating-group form. Each generated Field only gets
// a durable Field Profile the moment it is actually added to a Shared
// Template Set (there is no earlier Bind step for any of them), so this
// specifically exercises sharing with the 3rd, 4th, and 5th generated Field.
test("Add Fields offers and can share with every dynamically-generated Field, past the first two", async () => {
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

    // Generate 8 new Fields (name1..name8), none ever bound to anything.
    for (let i = 0; i < 8; i += 1) {
      await page.locator("#generate").click();
    }
    await expect(page.locator("#generated input")).toHaveCount(8);

    await page.locator("#anchor").focus();
    await page.getByRole("button", { name: "Open FillNest" }).click();
    await page.getByRole("button", { name: "Share with…" }).click();
    await expect(page.locator(".find-similar-current-field")).toContainText("anchor");
    await expect(page.locator(".find-similar-row")).toHaveCount(4);

    // Opens at a shortlist rather than dumping all 8 on the user at once.
    await page.getByRole("button", { name: "Show all 8 other Fields" }).click();

    // Every generated Field must then be offered - not only the first two.
    await expect(page.locator(".find-similar-row")).toHaveCount(8);

    // Share the 8th one specifically, one click, no selection step - the
    // case a "first two only" bug would fail on.
    const lastRow = page.locator(".find-similar-row").filter({ hasText: "name8" });
    // The Finder row's visual hover includes its padding, so the page preview
    // must begin in that same area rather than only after the pointer reaches
    // the inner content container.
    await lastRow.hover({ position: { x: 4, y: 4 } });
    await expect(page.locator("#name8")).toHaveAttribute("data-fillnest-shared-candidate-highlight", "");
    await lastRow.getByRole("button", { name: 'Locate "name8" on page' }).click();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    await expect(page.locator("#name8")).toHaveAttribute("data-fillnest-shared-candidate-highlight", "");
    expect(await page.locator("#name8").evaluate((field) => document.activeElement === field)).toBe(false);
    await expect(page.locator(".picker-context")).toContainText("anchor");

    // Locate is a one-shot page preview. Moving the pointer to another Finder
    // row must not leave the previously located row looking active as well.
    const otherRow = page.locator(".find-similar-row").filter({ hasText: "name7" });
    await otherRow.hover();
    await expect.poll(() =>
      lastRow.evaluate((row) => getComputedStyle(row).backgroundColor),
    ).not.toBe("rgb(219, 228, 251)");
    await lastRow.getByRole("button", { name: "Share" }).click();

    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(page.getByRole("status")).toHaveText(/Started sharing Templates with/u);
    // Owner QA 2026-09-15: Share took the row away under the pointer, so no
    // mouseleave ever cleared the Field's page highlight.
    await expect(page.locator(".find-similar-row")).toHaveCount(0);
    await expect(page.locator("#name8")).not.toHaveAttribute("data-fillnest-shared-candidate-highlight");

    const state = await readState(extensionPage);
    expect(state.sharedTemplateSets).toHaveLength(1);
    expect(state.sharedTemplateSets[0]?.memberFieldProfileIds).toHaveLength(2);
    expect(state.fieldProfiles).toHaveLength(2);
  } finally {
    await context?.close();
    await rm(userDataDir, { recursive: true, force: true });
    await rm(extensionBaseDir, { recursive: true, force: true });
    await stopFixtureServer(fixture.server);
  }
});

interface StateShape {
  sharedTemplateSets: Array<{ memberFieldProfileIds: string[] }>;
  fieldProfiles: unknown[];
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
