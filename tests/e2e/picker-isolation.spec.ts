import { cp, mkdtemp, rm } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { expect, test, type BrowserContext, type Page, type Worker } from "@playwright/test";

import { PRODUCTION_EXTENSION_BUILD_DIR } from "../helpers/extension-build";
import { launchWithPermissionHistory } from "../helpers/prime-extension-permissions";

interface RuntimeHarnessResponse {
  ok: boolean;
  value?: unknown;
  error?: string;
}

const FIXTURE_HTML = `<!doctype html>
<html>
  <body>
    <input id="bound-field" type="text" autocomplete="notes" />
  </body>
</html>`;

// Task 030. Every other E2E spec loads `dist-e2e`, whose Shadow Roots are open
// so Playwright can drive the Picker through ordinary locators. This one loads
// the real shipped artifact from `dist` and asserts the two halves that
// divergence would otherwise leave untested:
//
//   1. a host page cannot reach the Picker's Shadow Root, and
//   2. the Picker still opens, searches and inserts.
//
// Without (2) the suite could pass with a Picker that is isolated because it is
// broken. Everything here is therefore driven through the page's own DOM and
// the field's value, never through a shadow-piercing locator - which is also
// why it cannot simply reuse another spec's steps.
test("the shipped build hides the Picker from the host page and still works", async () => {
  test.setTimeout(60_000);
  const fixture = await startFixtureServer();
  const userDataDir = await mkdtemp(join(tmpdir(), "fillnest-isolation-"));
  const extensionBaseDir = await mkdtemp(join(tmpdir(), "fillnest-extension-"));
  const extensionPath = join(extensionBaseDir, "extension");
  await cp(resolve(PRODUCTION_EXTENSION_BUILD_DIR), extensionPath, { recursive: true });
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

    // Seed a Template through the service worker, so the Picker has content to
    // expose if it were exposable.
    const created = await sendRuntimeRequest(extensionPage, {
      type: "CREATE_TEMPLATE",
      content: "Secret template body",
      pageUrl: `${fixture.origin}/`,
    });
    expect(created.ok).toBe(true);

    // --- 1. The host page cannot reach any FillNest Shadow Root ---
    await page.locator("#bound-field").focus();
    await expect
      .poll(async () =>
        page.evaluate(() =>
          [...document.querySelectorAll("*")].filter(
            (element) => (element as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot !== null,
          ).length,
        ),
      )
      .toBe(0);

    // FillNest's own hosts are present - the roots exist, they are just closed.
    expect(await page.locator("[data-fillnest-overlay]").count()).toBeGreaterThan(0);

    // Task 034: the Picker lives in a Shadow Root on a page FillNest does not
    // own, so its theme cannot come from that page's stylesheets. It is
    // written as custom properties onto the host element, and the host has to
    // carry a complete palette before the Picker paints.
    const hostTheme = await page.evaluate(() => {
      const host = document.querySelector<HTMLElement>("[data-fillnest-overlay]");
      return {
        theme: host?.dataset["fnTheme"] ?? null,
        mode: host?.dataset["fnMode"] ?? null,
        surface: host?.style.getPropertyValue("--fn-surface") ?? "",
        accent: host?.style.getPropertyValue("--fn-accent") ?? "",
        colorScheme: host?.style.getPropertyValue("color-scheme") ?? "",
      };
    });
    expect(hostTheme).toEqual({
      theme: "default",
      mode: "light",
      surface: "#ffffff",
      accent: "#3157d5",
      colorScheme: "light",
    });

    const leaked = await page.evaluate(() => {
      const host = document.querySelector("[data-fillnest-overlay]");
      return {
        shadowRoot: (host as Element & { shadowRoot?: ShadowRoot | null })?.shadowRoot ?? null,
        text: document.body.innerText,
        html: document.documentElement.outerHTML,
      };
    });
    expect(leaked.shadowRoot).toBeNull();
    expect(leaked.text).not.toContain("Secret template body");
    expect(leaked.html).not.toContain("Secret template body");

    // --- 2. The Picker still works, driven without piercing anything ---
    // Playwright cannot see into a closed root, so the control is activated by
    // its position and the Picker by keyboard. The wait uses only focus state
    // observable from the page rather than assuming the Picker is ready.
    const control = await page.evaluate(() => {
      const host = document.querySelector("[data-fillnest-overlay]");
      const rect = host?.getBoundingClientRect();
      return rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null;
    });
    expect(control, "the FillNest control should be present on a focused eligible field").not.toBeNull();
    await page.mouse.click(control!.x + control!.width / 2, control!.y + control!.height / 2);

    // Focus moving into a closed Shadow Root is reported at the document level
    // as the host element itself, so this is a page-observable signal that the
    // Picker opened and its Search box has focus - without seeing inside it.
    await expect
      .poll(
        async () =>
          page.evaluate(() => document.activeElement?.hasAttribute("data-fillnest-overlay") ?? false),
        { timeout: 10_000 },
      )
      .toBe(true);

    await page.keyboard.type("Secret");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");

    await expect
      .poll(async () => page.locator("#bound-field").inputValue(), { timeout: 10_000 })
      .toBe("Secret template body");
  } finally {
    await context?.close();
    await stopFixtureServer(fixture.server);
    await rm(userDataDir, { recursive: true, force: true });
    await rm(extensionBaseDir, { recursive: true, force: true });
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
