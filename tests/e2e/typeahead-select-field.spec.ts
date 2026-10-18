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
 * Task 016 Addendum D.
 *
 * A remote-search select, reduced to the shape Element UI ships and the owner
 * hit on `vue-typescript-admin-template#/example/create` ("Search User"): a
 * real text input the component marks `readonly` whenever it does not have
 * focus, and clears again on focus.
 *
 * The FillNest control appeared on it - the Field is eligible while focused -
 * but activating the control did nothing at all. Opening the Picker focuses its
 * own Search box, the input blurs, the component restores `readonly`, and the
 * lifecycle tore the Field down, taking the interface the user was mid-click on
 * with it.
 *
 * The second field is deliberately a genuinely read-only one, to hold the line
 * the addendum must not cross.
 */
const FIXTURE_HTML = `<!doctype html>
<html>
  <body>
    <label for="search-user">Author</label>
    <input id="search-user" type="text" readonly autocomplete="off" />
    <input id="plain-field" type="text" autocomplete="notes" />
    <input id="always-readonly" type="text" readonly autocomplete="organization" />
    <script>
      const select = document.querySelector("#search-user");
      select.addEventListener("focus", () => select.removeAttribute("readonly"));
      select.addEventListener("blur", () => select.setAttribute("readonly", ""));
    </script>
  </body>
</html>`;

test("a typeahead select that re-marks itself readonly on blur stays usable, and a genuinely read-only field still gets nothing", async () => {
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

    // A Template to offer, saved on an ordinary field.
    await page.locator("#plain-field").focus();
    await page.getByRole("button", { name: "Open FillNest" }).click();
    await page.getByRole("button", { name: "New template" }).click();
    await page.getByRole("textbox", { name: "Template content" }).fill("Morgan Reed");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("Saved and bound to this field.");
    await page.keyboard.press("Escape");

    // A genuinely read-only field is still out of scope: no control at all.
    await page.locator("#always-readonly").click();
    await page.waitForTimeout(300);
    await expect(page.locator("[data-fillnest-overlay]")).toHaveCount(0);

    // The select behaves as its component does: readonly until focused.
    await expect(page.locator("#search-user")).toHaveAttribute("readonly", "");
    await page.locator("#search-user").focus();
    await expect(page.locator("#search-user")).not.toHaveAttribute("readonly", "");

    // Activating the control must leave a usable Picker standing, even though
    // opening it blurs the input and the component restores `readonly`.
    await page.getByRole("button", { name: "Open FillNest" }).click();
    await expect(page.getByRole("region", { name: "FillNest templates" })).toBeVisible();
    await expect(page.locator("#search-user")).toHaveAttribute("readonly", "");
    await expect(
      page.getByText("No usable field is focused. Insert and Bind are unavailable until you focus a supported field."),
    ).toHaveCount(0);

    // And inserting works: the insertion focuses the Field first, which is what
    // makes the component drop `readonly` again of its own accord.
    await page.locator('.picker input[aria-label="Search templates"]').fill("Morgan");
    await page.getByRole("button", { name: "Morgan Reed" }).click();
    await expect(page.locator("#search-user")).toHaveValue("Morgan Reed");
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
      const result: unknown = await chrome.runtime.sendMessage({ type: "ENABLE_SITE", pageUrl, tabId: id });
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
