import { E2E_EXTENSION_BUILD_DIR } from "../helpers/extension-build";
import { cp, mkdtemp, rm } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { expect, test, type BrowserContext, type Page, type Worker } from "@playwright/test";

import { launchWithPermissionHistory } from "../helpers/prime-extension-permissions";

const ACTIVE_MARKER = "data-fillnest-extension-active";

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

test("Sites page removes authorized Sites with one confirmation, clears Site data, and tears down every open tab", async () => {
  test.setTimeout(60_000);
  // Both fixture servers bind to 127.0.0.1: siteIdentityFromUrl only keeps
  // the hostname, so both distinct-port origins are real exact Permission
  // Origins that group under the same registrable Site, exactly like two
  // subdomains would - this is the case the Sites page must display as one
  // Site row with two child origins beneath it.
  const first = await startFixtureServer();
  const second = await startFixtureServer();
  const userDataDir = await mkdtemp(join(tmpdir(), "fillnest-playwright-"));
  const extensionBaseDir = await mkdtemp(join(tmpdir(), "fillnest-extension-"));
  const extensionPath = join(extensionBaseDir, "extension");
  await cp(resolve(E2E_EXTENSION_BUILD_DIR), extensionPath, { recursive: true });
  const firstPattern = `${first.origin}/*`;
  const secondPattern = `${second.origin}/*`;
  let context: BrowserContext | undefined;

  try {
    context = await launchWithPermissionHistory(userDataDir, extensionPath, [firstPattern, secondPattern]);
    const worker = await extensionWorker(context);
    const extensionId = new URL(worker.url()).host;

    const extensionPage = await openExtensionPage(context, extensionId);
    expect(
      await sendRuntimeRequest(extensionPage, { type: "SET_GLOBAL_ACTIVATION", mode: "active" }),
    ).toEqual(expect.objectContaining({ ok: true }));

    // The Template survives Remove site but loses this Site Affinity, becoming
    // Global when it has no other Site.
    const created = await sendRuntimeRequest(extensionPage, {
      type: "CREATE_TEMPLATE",
      content: "Survives access removal",
      pageUrl: first.origin,
    });
    expect(created.ok).toBe(true);

    const firstTab = await context.newPage();
    await firstTab.goto(first.origin);
    await expectMarker(firstTab, true);
    const secondTab = await context.newPage();
    await secondTab.goto(second.origin);
    await expectMarker(secondTab, true);

    const sidePanel = await context.newPage();
    await sidePanel.goto(`chrome-extension://${extensionId}/side-panel.html`);
    await sidePanel.getByRole("button", { name: "Sites" }).click();
    // Sites opens on its By-site default view - switch to the flat list.
    await sidePanel.getByRole("button", { name: "All addresses" }).click();
    // Both addresses of the same registrable Site are top-level rows, reachable
    // with no expansion: the Site name appears only in each row's subline.
    await expect(sidePanel.locator(".address-origin", { hasText: first.origin })).toBeVisible();
    await expect(sidePanel.locator(".address-origin", { hasText: second.origin })).toBeVisible();
    // Both origins are 127.0.0.1 on different ports, so the registrable Site
    // adds nothing the origin does not already show and no subline renders.
    await expect(sidePanel.locator(".address-subline")).toHaveCount(0);

    await sidePanel.getByRole("checkbox", { name: `Select ${first.origin}` }).check();
    await sidePanel.getByRole("checkbox", { name: `Select ${second.origin}` }).check();
    await expect(sidePanel.getByText("2 of 2 selected")).toBeVisible();

    await sidePanel.getByRole("button", { name: "Remove site" }).click();
    await expect(sidePanel.getByText("Remove 1 Site?")).toBeVisible();
    await sidePanel.screenshot({ path: "output/playwright/task004-slice2-remove-access-confirm.png" });
    await sidePanel.locator(".clean-up-sheet").getByRole("button", { name: "Remove site" }).click();

    // Historical Sites never render in Sites after access is removed.
    await expect(sidePanel.locator(".address-origin")).toHaveCount(0, { timeout: 10_000 });
    await expect(sidePanel.getByText("Saved data, no access")).toHaveCount(0);

    await expectMarker(firstTab, false);
    await expectMarker(secondTab, false);

    const permissionEvidence = await worker.evaluate(
      async ({ patterns }) => ({
        granted: await Promise.all(patterns.map((pattern) => chrome.permissions.contains({ origins: [pattern] }))),
        registrations: await chrome.scripting.getRegisteredContentScripts(),
      }),
      { patterns: [firstPattern, secondPattern] },
    );
    expect(permissionEvidence.granted).toEqual([false, false]);
    expect(permissionEvidence.registrations).toEqual([]);

    const state = await sendRuntimeRequest(extensionPage, { type: "READ_STATE" });
    expect(state).toEqual(
      expect.objectContaining({
        ok: true,
        value: expect.objectContaining({
          templates: [expect.objectContaining({ content: "Survives access removal", siteAffinities: [] })],
        }),
      }),
    );
  } finally {
    await context?.close();
    await rm(userDataDir, { recursive: true, force: true });
    await rm(extensionBaseDir, { recursive: true, force: true });
    await stopFixtureServer(first.server);
    await stopFixtureServer(second.server);
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

async function expectMarker(page: Page, active: boolean): Promise<void> {
  await expect.poll(() => page.locator(`html[${ACTIVE_MARKER}]`).count()).toBe(active ? 1 : 0);
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
