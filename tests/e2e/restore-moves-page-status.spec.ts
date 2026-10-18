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
    <input id="field-a" type="text" autocomplete="notes" /><input id="field-b" type="text" autocomplete="notes" />
  </body>
</html>`;

// Task 006 Addendum A, found in the owner's QA on 2026-09-11: Restore
// replaces the page status control's stored position, and an open page's
// control must move there without the page being reloaded.
test("Restore moves an open page's status control to the restored position", async () => {
  test.setTimeout(90_000);
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
    const control = page.locator("[data-fillnest-page-status]");
    const position = () => control.evaluate((host: HTMLElement) => `${host.style.top}/${host.style.left}`);

    await sendRuntimeRequest(extensionPage, { type: "SET_PAGE_STATUS_POSITION", position: { top: 120, left: 140 } });
    const backup = await sendRuntimeRequest(extensionPage, { type: "CREATE_BACKUP_ARCHIVE" });
    const archiveJson = (backup.value as { archiveJson: string }).archiveJson;
    await sendRuntimeRequest(extensionPage, { type: "SET_PAGE_STATUS_POSITION", position: { top: 300, left: 360 } });
    await page.bringToFront();
    await page.reload();
    await expect.poll(position).toBe("300px/360px");

    const preview = await sendRuntimeRequest(extensionPage, { type: "VALIDATE_BACKUP_ARCHIVE", archiveJson });
    const restored = await sendRuntimeRequest(extensionPage, {
      type: "RESTORE_BACKUP_ARCHIVE",
      archiveJson,
      typedConfirmation: "restore",
      expectedConfirmationToken: (preview.value as { confirmationToken: string }).confirmationToken,
    });
    expect(restored.ok).toBe(true);

    await expect.poll(position).toBe("120px/140px");
  } finally {
    await context?.close();
    await rm(userDataDir, { recursive: true, force: true });
    await rm(extensionBaseDir, { recursive: true, force: true });
    await stopFixtureServer(fixture.server);
  }
});

// Task 038 Addendum B, owner QA 2026-09-11: Settings puts a page button that
// was moved out of sight back in its corner, on an open page, at once.
test("Settings moves an open page's status control back to its corner", async () => {
  test.setTimeout(90_000);
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
    const control = page.locator("[data-fillnest-page-status]");
    const position = () =>
      control.evaluate((host: HTMLElement) => [host.style.top, host.style.left, host.style.right, host.style.bottom].join("/"));

    await sendRuntimeRequest(extensionPage, { type: "SET_PAGE_STATUS_POSITION", position: { top: 120, left: 140 } });
    await page.bringToFront();
    await page.reload();
    await expect.poll(position).toMatch(/^120px\/140px\//);

    const sidePanel = await context.newPage();
    await sidePanel.goto(`chrome-extension://${extensionId}/side-panel.html`);
    await sidePanel.getByRole("button", { name: "Settings", exact: true }).click();
    await sidePanel.getByRole("button", { name: "Move to bottom right", exact: true }).click();
    await expect(sidePanel.getByText("The FillNest button is back in the bottom-right corner of every page.")).toBeVisible();

    await expect.poll(position).toMatch(/^(initial)?\/(initial)?\/\d+px\/\d+px$/);
    const stored = await sendRuntimeRequest(extensionPage, { type: "GET_PAGE_STATUS_POSITION" });
    expect(stored).toEqual({ ok: true, value: null });
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
