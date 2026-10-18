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

// Regression: "Two empty Fields may create a Shared Template Set" (Task 015
// Accepted Contract). field-a is never bound to anything before this test
// shares *from* it - a Field that has never been bound has no durable Field
// Profile (only Bind/Create-and-Bind ever persist one), so
// CREATE_SHARED_TEMPLATE_SET must be able to create the current Field's
// Profile on demand. field-b is bound first through the real Picker UI, so
// its own Field Profile - and its Page Profile, which field-a's own
// still-unrecognized context resolution reuses once it exists - are both
// genuinely durable, letting field-b legitimately appear as an "Add Fields"
// candidate. Without the fix, sharing from field-a (the one still
// genuinely empty) failed with "Field Profile not found" the moment the
// user tried it - caught via hands-on QA, not by any earlier automated
// check.
test("creates a Shared Template Set from a Field that was never bound to anything", async () => {
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

    // Bind field-b through the real Picker UI first, so both its own Field
    // Profile and its Page's Profile are genuinely durable.
    await page.locator("#field-b").focus();
    await page.getByRole("button", { name: "Open FillNest" }).click();
    await page.getByRole("button", { name: "New template" }).click();
    await page.getByRole("textbox", { name: "Template content" }).fill("Field B reply");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("Saved and bound to this field.");
    await page.getByRole("button", { name: "Close" }).click();

    // field-a has never been bound to anything - its own Field Profile
    // stays purely in-memory until this Shared Template Set creates it.
    await page.locator("#field-a").focus();
    await page.getByRole("button", { name: "Open FillNest" }).click();
    await page.getByRole("button", { name: "Share with…" }).click();
    await expect(page.locator(".find-similar-row")).toHaveCount(1);

    // One click on the per-row Share button shares instantly - no
    // multi-select step.
    await page.locator(".find-similar-row").getByRole("button", { name: "Share" }).click();

    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(page.getByRole("status")).toHaveText(/Started sharing Templates with/u);

    // Regression: the result used to take over the one status row, hiding
    // both the "Shared" indicator and every affordance behind it - leaving
    // no way back to Share with… or Stop sharing until the result cleared.
    // The result now has its own row and the context row keeps working.
    await expect(page.locator(".picker-result")).toContainText("Started sharing Templates with");
    await expect(page.locator(".picker-result").getByRole("button", { name: "Undo" })).toBeVisible();
    await expect(page.locator(".picker-context")).toContainText("2 fields use the same Templates");
    await expect(page.locator(".picker-context").getByRole("button", { name: "Share with…" })).toBeVisible();
    await expect(page.locator(".picker-context").getByRole("button", { name: "Leave sharing" })).toBeVisible();

    const state = await readState(extensionPage);
    expect(state.sharedTemplateSets).toHaveLength(1);
    expect(state.sharedTemplateSets[0]?.memberFieldProfileIds).toHaveLength(2);
    expect(state.fieldProfiles).toHaveLength(2);
    // field-b's own direct Binding is untouched and simply dormant now.
    expect(state.bindings).toHaveLength(1);
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
