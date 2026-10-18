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

/**
 * Task 036 Addendum H. Pages that take Tab away from FillNest's Picker. The
 * Picker lives in a Shadow Root, so from the page's side the focused element is
 * FillNest's host - a plain element the page does not know.
 *
 * - `document`: a composer that focuses itself on Tab pressed while nothing
 *   editable is focused, listening on `document` in the capture phase.
 * - `window`: a page running its own Tab order from `document.activeElement`,
 *   listening on `window` in the capture phase and registered before any
 *   content script can be.
 * - `library`: the shape measured on a real product and read in its
 *   open-source focus library. It records the focused element from `focusin`
 *   on `document`, and on Tab while it holds one it moves the focus to its own
 *   next element, cancels the key and stops it from reaching any later
 *   listener - FillNest's included.
 *
 * The first two are run letting the browser's navigation continue (`follow`)
 * and cancelling it (`cancel`); the library always cancels.
 */
const FIXTURE_HTML = `<!doctype html>
<html>
  <body>
    <button id="before-composer" type="button">Menu</button>
    <textarea id="composer" aria-label="Message the assistant"></textarea>
    <button id="after-composer" type="button">Send</button>

    <script>
      const params = new URLSearchParams(location.search);
      const mode = params.get("steal");
      const composer = document.querySelector("#composer");
      const editable = (element) =>
        element instanceof HTMLTextAreaElement ||
        element instanceof HTMLInputElement ||
        (element instanceof HTMLElement && element.isContentEditable);
      if (params.get("target") === "library") {
        const own = [...document.querySelectorAll("#before-composer, #composer, #after-composer")];
        let tracked;
        document.addEventListener("focusin", (event) => { tracked = event.composedPath()[0]; }, true);
        document.addEventListener("focusout", () => { tracked = undefined; }, true);
        window.addEventListener(
          "keydown",
          (event) => {
            if (event.key !== "Tab" || !tracked) return;
            const index = own.indexOf(tracked);
            const next = own[(index + (event.shiftKey ? own.length - 1 : 1)) % own.length] ?? own[0];
            event.preventDefault();
            event.stopImmediatePropagation();
            next.focus();
          },
          true,
        );
      } else if (params.get("target") === "window") {
        const own = [...document.querySelectorAll("#before-composer, #composer, #after-composer")];
        window.addEventListener(
          "keydown",
          (event) => {
            if (event.key !== "Tab") return;
            const index = own.indexOf(document.activeElement);
            const next = own[(index + (event.shiftKey ? own.length - 1 : 1)) % own.length] ?? own[0];
            next.focus();
            if (mode === "cancel") event.preventDefault();
          },
          true,
        );
      } else {
        document.addEventListener(
          "keydown",
          (event) => {
            if (event.key !== "Tab" || editable(document.activeElement)) return;
            composer.focus();
            if (mode === "cancel") event.preventDefault();
          },
          true,
        );
      }
    </script>
  </body>
</html>`;

const VARIANTS = [
  ["document", "follow"],
  ["document", "cancel"],
  ["window", "follow"],
  ["window", "cancel"],
  ["library", "cancel"],
] as const;

for (const [target, mode] of VARIANTS) {
  {
    test(`Tab moves through the Picker when the page takes Tab on ${target} (${mode})`, async () => {
      test.setTimeout(120_000);
      const harness = await openHarness();
      const { page } = harness;
      try {
        await page.goto(`${new URL(page.url()).origin}/?target=${target}&steal=${mode}`);
        await page.locator("#composer").click();
        await page.getByRole("button", { name: "Open FillNest" }).click();
        await expect.poll(() => deepActiveElementLabel(page)).toBe("Search templates");

        // Forward into the Picker's next control, and back again.
        await page.keyboard.press("Tab");
        await expect.poll(() => deepActiveElementLabel(page)).toBe("New template");
        await page.keyboard.press("Shift+Tab");
        await expect.poll(() => deepActiveElementLabel(page)).toBe("Search templates");

        // Backward through the header: every step lands on a different control
        // of the Picker, never on the page.
        const visited = new Set<string | null>();
        for (let step = 0; step < 3; step += 1) {
          await page.keyboard.press("Shift+Tab");
          await expect.poll(() => focusIsInsideFillNest(page)).toBe(true);
          visited.add(await deepActiveElementLabel(page));
        }
        expect(visited.size).toBe(3);
        expect(visited.has("Close")).toBe(true);
        await expect(page.getByLabel("Search templates")).toBeVisible();

        // Not a trap: Tab from the Picker's last control leaves it.
        await page.getByRole("button", { name: "New template" }).focus();
        await page.keyboard.press("Tab");
        await expect.poll(() => focusIsInsideFillNest(page)).toBe(false);
      } finally {
        await closeHarness(harness);
      }
    });
  }
}

async function focusIsInsideFillNest(page: Page): Promise<boolean> {
  return page.evaluate(() => document.activeElement?.hasAttribute("data-fillnest-overlay") === true);
}

async function deepActiveElementLabel(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    let element: Element | null = document.activeElement;
    while (element?.shadowRoot?.activeElement) element = element.shadowRoot.activeElement;
    return element?.getAttribute("aria-label") ?? element?.textContent?.trim() ?? null;
  });
}

interface Harness {
  context: BrowserContext;
  page: Page;
  userDataDir: string;
  extensionBaseDir: string;
  server: Server;
}

async function openHarness(): Promise<Harness> {
  const fixture = await startFixtureServer();
  const userDataDir = await mkdtemp(join(tmpdir(), "fillnest-playwright-"));
  const extensionBaseDir = await mkdtemp(join(tmpdir(), "fillnest-extension-"));
  const extensionPath = join(extensionBaseDir, "extension");
  await cp(resolve(E2E_EXTENSION_BUILD_DIR), extensionPath, { recursive: true });
  const context = await launchWithPermissionHistory(userDataDir, extensionPath, [
    `${fixture.origin}/*`,
  ]);
  const worker = await extensionWorker(context);
  const extensionId = new URL(worker.url()).host;
  const page = await context.newPage();
  await page.goto(fixture.origin);
  const extensionPage = await openExtensionPage(context, extensionId);
  await grantOrigin(worker, extensionPage, page, fixture.origin);
  await page.bringToFront();
  return { context, page, userDataDir, extensionBaseDir, server: fixture.server };
}

async function closeHarness(harness: Harness): Promise<void> {
  await harness.context.close();
  await rm(harness.userDataDir, { recursive: true, force: true });
  await rm(harness.extensionBaseDir, { recursive: true, force: true });
  await stopFixtureServer(harness.server);
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
  page: Page,
  origin: string,
): Promise<void> {
  const globalActivation = await extensionPage.evaluate(async (): Promise<RuntimeHarnessResponse> => {
    const result: unknown = await chrome.runtime.sendMessage({
      type: "SET_GLOBAL_ACTIVATION",
      mode: "active",
    });
    return result as RuntimeHarnessResponse;
  });
  if (!globalActivation.ok) throw new Error("SET_GLOBAL_ACTIVATION failed");

  await page.bringToFront();
  const tabId = await worker.evaluate(async () => {
    const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    return activeTab?.id ?? null;
  });
  if (tabId === null) throw new Error("Fixture tab not found");
  const response = await extensionPage.evaluate(
    async ({ pageUrl, id }): Promise<RuntimeHarnessResponse> => {
      const result: unknown = await chrome.runtime.sendMessage({
        type: "ENABLE_SITE",
        pageUrl,
        tabId: id,
      });
      return result as RuntimeHarnessResponse;
    },
    { pageUrl: `${origin}/`, id: tabId },
  );
  if (!response.ok) throw new Error(`ENABLE_SITE failed: ${response.error ?? "unknown"}`);
  await page.reload();
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
