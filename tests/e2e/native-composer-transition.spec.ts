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
    <div id="form-region">
      <form id="form-a" name="first-form"></form>
      <form id="form-b" name="second-form"></form>
    </div>
    <button id="history-link" type="button">Conversation history</button>
    <main id="current-view">
      <div id="composer-shell">
        <div id="settled-wrapper">
          <textarea id="userInput" form="form-a"></textarea>
        </div>
      </div>
    </main>
    <main id="next-view"></main>

    <script>
      window.__navigateDomFirst = async (path) => {
        const shell = document.querySelector("#composer-shell");
        const composer = document.querySelector("#userInput");
        const transientOuter = document.createElement("section");
        const transientInner = document.createElement("article");
        transientOuter.append(transientInner);
        transientInner.append(composer);
        shell.replaceChildren(transientOuter);
        composer.focus();

        await new Promise((resolve) => setTimeout(resolve, 50));
        history.pushState({}, "", path);

        // Leave enough time for the Page-context repair to accept the
        // transition-only Field identity before the DOM settles.
        await new Promise((resolve) => setTimeout(resolve, 450));
        const settled = document.createElement("div");
        settled.id = "settled-wrapper";
        settled.append(composer);
        shell.replaceChildren(settled);
      };

      // Task 036 Addendum I. Opening a conversation the way the owner's
      // recording shows a real product doing it: the address changes first,
      // the view around the old composer is touched while it is still mounted
      // under the new address, and then the composer is replaced by a new
      // element with the same structure, which takes the focus.
      window.__openConversation = async (path) => {
        history.pushState({}, "", path);
        const shell = document.querySelector("#composer-shell");
        shell.classList.toggle("routing");
        await new Promise((resolve) => setTimeout(resolve, 50));
        const composer = document.createElement("textarea");
        composer.id = "userInput";
        composer.setAttribute("form", "form-a");
        const settled = document.createElement("div");
        settled.id = "settled-wrapper";
        settled.append(composer);
        shell.replaceChildren(settled);
        composer.focus();
      };

      // Task 036 Addendum G. A cross-fade between two views: the next view's
      // composer is mounted and focused while the previous view's identical
      // composer is still in the document ahead of it, and the previous view is
      // emptied later. Its container does not contain the new composer.
      window.__mountNextView = (path) => {
        history.pushState({}, "", path);
        const shell = document.createElement("div");
        const wrapper = document.createElement("div");
        const composer = document.createElement("textarea");
        composer.id = "userInput";
        composer.setAttribute("form", "form-a");
        wrapper.append(composer);
        shell.append(wrapper);
        document.querySelector("#next-view").append(shell);
        composer.focus();
      };
      window.__emptyPreviousView = () => document.querySelector("#current-view").replaceChildren();
    </script>
  </body>
</html>`;

const TEMPLATE = "Summarize this thread in three bullet points.";

test("a native Field uses its settled identity after a DOM-first SPA transition", async () => {
  test.setTimeout(120_000);
  const harness = await openHarness();
  const { page } = harness;
  try {
    await page.evaluate(() => history.pushState({}, "", "/chats/first"));
    await page.locator("#userInput").click();
    await page.getByRole("button", { name: "Open FillNest" }).click();
    await page.getByRole("button", { name: "New template" }).click();
    await page.getByRole("textbox", { name: "Template content" }).fill(TEMPLATE);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page.keyboard.press("Escape");

    await page.evaluate(() => history.pushState({}, "", "/"));
    await page.evaluate(() =>
      (window as unknown as { __navigateDomFirst(path: string): Promise<void> })
        .__navigateDomFirst("/chats/first"),
    );

    await page.getByRole("button", { name: "Open FillNest" }).click();
    await expect(page.getByRole("button", { name: TEMPLATE })).toBeVisible();
  } finally {
    await closeHarness(harness);
  }
});

test("a composer replaced while opening a conversation keeps its Binding, here and on the next conversation", async () => {
  test.setTimeout(120_000);
  const harness = await openHarness();
  const { page } = harness;
  try {
    await page.evaluate(() => history.pushState({}, "", "/chats/aa11bb22cc33"));
    await page.locator("#userInput").click();
    await saveBoundTemplate(page);
    await page.keyboard.press("Escape");

    // Back to the new-conversation page, whose composer is its own element.
    await page.locator("#history-link").click();
    await page.evaluate(() =>
      (window as unknown as { __openConversation(path: string): Promise<void> }).__openConversation("/"),
    );
    await page.locator("#history-link").click();

    await page.evaluate(() =>
      (window as unknown as { __openConversation(path: string): Promise<void> })
        .__openConversation("/chats/dd44ee55ff66"),
    );
    await page.getByRole("button", { name: "Open FillNest" }).click();
    await expect(page.getByRole("button", { name: TEMPLATE })).toBeVisible();
    await page.keyboard.press("Escape");

    // The next conversation keeps the same element, and the same Page identity.
    await page.locator("#history-link").click();
    await page.evaluate(() => history.pushState({}, "", "/chats/gg77hh88ii99"));
    await page.locator("#userInput").click();
    await page.getByRole("button", { name: "Open FillNest" }).click();
    await expect(page.getByRole("button", { name: TEMPLATE })).toBeVisible();
  } finally {
    await closeHarness(harness);
  }
});

test("a Field converges when a duplicate peer outside its subtree is removed, and an open Picker stays open", async () => {
  test.setTimeout(120_000);
  const harness = await openHarness();
  const { page } = harness;
  try {
    await page.evaluate(() => history.pushState({}, "", "/chats/first"));
    await page.locator("#userInput").click();
    await saveBoundTemplate(page);
    await page.keyboard.press("Escape");

    await page.locator("#history-link").click();
    await page.evaluate(() => history.pushState({}, "", "/"));
    await page.evaluate(() =>
      (window as unknown as { __mountNextView(path: string): void }).__mountNextView("/chats/first"),
    );
    // The next view's composer sits behind the previous view's identical one.
    await page.getByRole("button", { name: "Open FillNest" }).click();
    await expect(page.getByLabel("Search templates")).toBeVisible();

    await page.evaluate(() => (window as unknown as { __emptyPreviousView(): void }).__emptyPreviousView());
    await expect(page.locator("#current-view textarea")).toHaveCount(0);
    await expect(page.getByRole("button", { name: TEMPLATE })).toBeVisible();
  } finally {
    await closeHarness(harness);
  }
});

test("a native Field refreshes when its form attribute changes", async () => {
  test.setTimeout(120_000);
  const harness = await openHarness();
  const { page } = harness;
  try {
    await page.locator("#userInput").click();
    await saveBoundTemplate(page);

    await page.locator("#userInput").evaluate((field) => field.setAttribute("form", "form-b"));

    await expectContextRefreshed(page);
  } finally {
    await closeHarness(harness);
  }
});

test("an externally associated native Field refreshes when its Form identity changes", async () => {
  test.setTimeout(120_000);
  const harness = await openHarness();
  const { page } = harness;
  try {
    await page.locator("#userInput").click();
    await saveBoundTemplate(page);

    await page.locator("#form-a").evaluate((form) => form.setAttribute("name", "renamed-form"));

    await expectContextRefreshed(page);
  } finally {
    await closeHarness(harness);
  }
});

test("an externally associated native Field refreshes when its Form id severs the association", async () => {
  test.setTimeout(120_000);
  const harness = await openHarness();
  const { page } = harness;
  try {
    await page.locator("#form-a").evaluate((form) => form.removeAttribute("name"));
    await page.locator("#userInput").click();
    await saveBoundTemplate(page);

    await page.locator("#form-a").evaluate((form) => form.setAttribute("id", "renamed-form-a"));

    await expectContextRefreshed(page);
  } finally {
    await closeHarness(harness);
  }
});

test("an externally associated native Field refreshes when its Form is removed", async () => {
  test.setTimeout(120_000);
  const harness = await openHarness();
  const { page } = harness;
  try {
    await page.locator("#userInput").click();
    await saveBoundTemplate(page);

    await page.locator("#form-a").evaluate((form) => form.remove());

    await expectContextRefreshed(page);
  } finally {
    await closeHarness(harness);
  }
});

async function expectContextRefreshed(page: Page): Promise<void> {
  await expect(page.getByRole("button", { name: TEMPLATE })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Open FillNest" })).toBeVisible();
}

async function saveBoundTemplate(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Open FillNest" }).click();
  await page.getByRole("button", { name: "New template" }).click();
  await page.getByRole("textbox", { name: "Template content" }).fill(TEMPLATE);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("button", { name: TEMPLATE })).toBeVisible();
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
