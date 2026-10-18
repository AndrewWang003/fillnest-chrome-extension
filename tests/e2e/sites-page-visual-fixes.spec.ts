import { E2E_EXTENSION_BUILD_DIR } from "../helpers/extension-build";
import { cp, mkdtemp, rm } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { chromium, expect, test, type BrowserContext, type Page, type Worker } from "@playwright/test";

interface RuntimeHarnessResponse {
  ok: boolean;
  value?: unknown;
  error?: string;
}

const FIXTURE_HTML = `<!doctype html>
<html>
  <body>
    <input id="notes-field" type="text" autocomplete="notes" />
  </body>
</html>`;

test("Sites page hides unauthorized historical Sites, and the status filter can only ever hold one value at a time", async () => {
  test.setTimeout(60_000);
  const fixture = await startFixtureServer();
  const userDataDir = await mkdtemp(join(tmpdir(), "fillnest-playwright-"));
  const extensionBaseDir = await mkdtemp(join(tmpdir(), "fillnest-extension-"));
  const extensionPath = join(extensionBaseDir, "extension");
  await cp(resolve(E2E_EXTENSION_BUILD_DIR), extensionPath, { recursive: true });
  let context: BrowserContext | undefined;

  try {
    // No granted permission at all: Repository data may exist, but Sites is
    // intentionally an authorized-Website-Access management surface.
    context = await chromium.launchPersistentContext(userDataDir, {
      channel: "chromium",
      headless: false,
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    });
    const worker = await extensionWorker(context);
    const extensionId = new URL(worker.url()).host;
    const extensionPage = await openExtensionPage(context, extensionId);

    expect(
      await sendRuntimeRequest(extensionPage, { type: "SET_GLOBAL_ACTIVATION", mode: "active" }),
    ).toEqual(expect.objectContaining({ ok: true }));
    expect(
      await sendRuntimeRequest(extensionPage, {
        type: "CREATE_TEMPLATE_AND_BIND",
        content: "Unauthorized-Site evidence",
        pageUrl: fixture.origin,
        pageProfileId: "page-1",
        fieldProfileId: "field-1",
      }),
    ).toEqual(expect.objectContaining({ ok: true }));

    const sidePanel = await context.newPage();
    await sidePanel.setViewportSize({ width: 380, height: 700 });
    await sidePanel.goto(`chrome-extension://${extensionId}/side-panel.html`);
    await sidePanel.getByRole("button", { name: "Sites" }).click();
    // Sites opens on its By-site default view - switch to the flat list.
    await sidePanel.getByRole("button", { name: "All addresses" }).click();
    // Historical data does not create a Sites entry.
    await expect(sidePanel.locator(".address-origin")).toHaveCount(0);
    await expect(sidePanel.getByText("Saved data, no access")).toHaveCount(0);
    const rowOverflow = await sidePanel.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(rowOverflow).toBeLessThanOrEqual(0);

    // A native <select> can only ever hold one value - selecting a second
    // status option replaces the first rather than adding to it, so the
    // "Active and Paused both selected" contradiction the old pill row
    // could produce is now structurally impossible.
    const statusFilter = sidePanel.getByRole("combobox", { name: "Filter addresses by status" });
    await statusFilter.selectOption("active");
    await expect(statusFilter).toHaveValue("active");
    await statusFilter.selectOption("paused");
    await expect(statusFilter).toHaveValue("paused");
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
