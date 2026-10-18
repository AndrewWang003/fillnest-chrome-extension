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
    <input id="field-b" type="text" autocomplete="notes" />
  </body>
</html>`;

// Regression: the FillNest control button is rendered in a Shadow DOM host
// appended to `document.documentElement` for stacking/positioning reasons,
// so its real DOM position has nothing to do with the Target Field it sits
// beside - a keyboard user tabbing forward from the Field never naturally
// reached it, making the Picker unreachable without a mouse. Forward Tab
// from the Field must reach the control; forward Tab from the control
// (without activating it) must continue to the next real page element
// rather than trapping focus; Enter on the control must open the Picker
// exactly as a click does.
test("Tab from a focused Field reaches the FillNest control, opens the Picker on Enter, and never traps focus", async () => {
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

    await page.locator("#field-a").focus();
    await expect(page.getByRole("button", { name: "Open FillNest" })).toBeVisible();

    // Forward Tab from the Field reaches the control, not whatever the page's
    // own default tab order would have picked next.
    await page.keyboard.press("Tab");
    await expect.poll(() => deepActiveElementLabel(page)).toBe("Open FillNest");

    // Enter activates it exactly like a click - the Picker opens and moves
    // focus onto its own Search field.
    await page.keyboard.press("Enter");
    await expect.poll(() => deepActiveElementLabel(page)).toBe("Search templates");
    await page.keyboard.press("Escape");

    // Tabbing to the control again but choosing not to activate it must not
    // trap focus there - the next Tab press continues to the next real Field.
    await page.locator("#field-a").focus();
    await page.keyboard.press("Tab");
    await expect.poll(() => deepActiveElementLabel(page)).toBe("Open FillNest");
    await page.keyboard.press("Tab");
    await expect.poll(() => deepActiveElementId(page)).toBe("field-b");
  } finally {
    await context?.close();
    await rm(userDataDir, { recursive: true, force: true });
    await rm(extensionBaseDir, { recursive: true, force: true });
    await stopFixtureServer(fixture.server);
  }
});

// Walks through any open Shadow DOM hosts to find the real focused element,
// since the FillNest control and Picker both live inside one.
async function deepActiveElementLabel(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    let element: Element | null = document.activeElement;
    while (element?.shadowRoot?.activeElement) element = element.shadowRoot.activeElement;
    return element?.getAttribute("aria-label") ?? null;
  });
}

async function deepActiveElementId(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    let element: Element | null = document.activeElement;
    while (element?.shadowRoot?.activeElement) element = element.shadowRoot.activeElement;
    return element?.id ?? null;
  });
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
