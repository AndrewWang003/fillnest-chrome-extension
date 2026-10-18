import { E2E_EXTENSION_BUILD_DIR } from "../helpers/extension-build";
import { cp, mkdtemp, rm } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { expect, test, type BrowserContext, type Worker } from "@playwright/test";

import { launchWithPermissionHistory } from "../helpers/prime-extension-permissions";

const FIXTURE_HTML = `<!doctype html>
<html>
  <body>
    <input id="notes-field" type="text" autocomplete="notes" />
  </body>
</html>`;

// Owner QA 2026-09-15 (Task 042): Allow access reads on two centred lines and
// breathes - a four-second glow, the pace of a resting breath - while the site
// is not authorized; it holds still under the pointer, and for anyone who
// asked for reduced motion.
test("Allow access breathes on a four-second cycle until the pointer or reduced motion stills it", async () => {
  test.setTimeout(60_000);
  const fixture = await startFixtureServer();
  const userDataDir = await mkdtemp(join(tmpdir(), "fillnest-playwright-"));
  const extensionBaseDir = await mkdtemp(join(tmpdir(), "fillnest-extension-"));
  const extensionPath = join(extensionBaseDir, "extension");
  await cp(resolve(E2E_EXTENSION_BUILD_DIR), extensionPath, { recursive: true });
  let context: BrowserContext | undefined;

  try {
    context = await launchWithPermissionHistory(userDataDir, extensionPath, []);
    const worker = await extensionWorker(context);
    const extensionId = new URL(worker.url()).host;
    const popup = await context.newPage();
    // The Popup reads the tab it was opened over; opened as a page, that tab
    // is the Popup itself, so it is shown an ordinary, unauthorized page.
    await popup.addInitScript((url) => {
      const query = chrome.tabs.query.bind(chrome.tabs);
      chrome.tabs.query = (async (info: chrome.tabs.QueryInfo) =>
        info.active ? [{ id: 1, windowId: 1, url }] : query(info)) as typeof chrome.tabs.query;
    }, `${fixture.origin}/form`);
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);

    const allow = popup.getByRole("button", { name: `Allow access to ${fixture.origin}` });
    await expect(allow).toBeVisible();
    await expect(allow.locator(".allow-access-action")).toHaveText("Allow access");
    await expect(allow.locator(".allow-access-origin")).toHaveText(fixture.origin);

    const animation = () =>
      allow.evaluate((element) => {
        const style = getComputedStyle(element);
        return `${style.animationName} ${style.animationDuration} ${style.animationIterationCount} ${style.animationPlayState}`;
      });
    expect(await animation()).toBe("fn-allow-access-breathe 4s infinite running");

    await allow.hover();
    await expect.poll(animation).toBe("fn-allow-access-breathe 4s infinite paused");

    await popup.mouse.move(0, 0);
    await popup.emulateMedia({ reducedMotion: "reduce" });
    await expect.poll(animation).toMatch(/^none /);
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
