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
 * Task 036. The four editor families and the exclusions, as FillNest-owned
 * fixtures rather than as named sites.
 *
 * Each host reproduces a *behaviour* a real editor has, because that is what
 * the contract is about:
 *
 * - `#plain-host` accepts the browser's own `insertText` and keeps it. This is
 *   what ProseMirror, Lexical and Quill all do when they are working.
 * - `#refusing-host` cancels `beforeinput`, which any document-model editor is
 *   entitled to do.
 * - `#reverting-host` accepts the DOM change and overwrites it on the next
 *   frame - the failure that looks like success for a moment, and the reason
 *   verification happens a frame later instead of at insertion time.
 * - `#code-host` declares `role="code"`; `#code-mirror-host` carries
 *   CodeMirror 6's real attributes, which declare a multi-line text box and
 *   are separated from a composer only by the language affordances.
 * - `#cell-host` sits inside a grid.
 * - `#unnamed-host` declares a role and no name: insertable, not bindable.
 * - Task 036 Addendum D: `#lying-single-line-host` declares
 *   `aria-multiline="false"` and holds a paragraph, and `#placeholder-host`
 *   declares nothing but `data-placeholder`. Both are Fields.
 */
const FIXTURE_HTML = `<!doctype html>
<html>
  <body>
    <input id="seed-field" type="text" autocomplete="notes" />

    <div id="plain-host" contenteditable="true" role="textbox" aria-multiline="true"
         aria-label="Write your prompt"></div>

    <div id="refusing-host" contenteditable="true" role="textbox" aria-multiline="true"
         aria-label="Refusing composer"></div>

    <div id="reverting-host" contenteditable="true" role="textbox" aria-multiline="true"
         aria-label="Reverting composer"></div>

    <div id="unnamed-host" contenteditable="true" role="textbox" aria-multiline="true"></div>

    <div id="code-host" contenteditable="true" role="code" aria-label="Source"></div>

    <!-- CodeMirror 6's real markup: a multi-line text box with every
         natural-language affordance switched off. -->
    <div id="code-mirror-host" contenteditable="true" role="textbox" aria-multiline="true"
         spellcheck="false" autocorrect="off" autocapitalize="off"
         aria-label="Editor content"></div>

    <div role="grid"><div role="row">
      <div id="cell-host" contenteditable="true" role="textbox" aria-label="Amount"></div>
    </div></div>

    <!-- Both carry a min-height because an empty editing host collapses to
         zero and Playwright cannot click what has no box. A real composer has
         a box; this is the fixture matching the page, not a workaround. -->
    <div id="lying-single-line-host" contenteditable="true" role="textbox" aria-multiline="false"
         aria-label="Ask anything" style="min-height: 2em"><p></p></div>

    <div id="placeholder-host" contenteditable="true" style="min-height: 2em"
         data-placeholder="Type / for quick access"></div>

    <div id="bare-host" contenteditable="true"></div>

    <script>
      window.__fillnestKeyEvents = [];
      for (const type of ["keydown", "keypress", "keyup"]) {
        document.addEventListener(type, (event) => window.__fillnestKeyEvents.push(event.type), true);
      }
      document
        .querySelector("#refusing-host")
        .addEventListener("beforeinput", (event) => event.preventDefault());
      const reverting = document.querySelector("#reverting-host");
      reverting.addEventListener("input", () => {
        requestAnimationFrame(() => reverting.replaceChildren());
      });
    </script>
  </body>
</html>`;

const TEMPLATE = "Please review the attached draft.";

test("rich text hosts: eligibility, insertion, refusal, and the clipboard fallback", async () => {
  test.setTimeout(120_000);
  const fixture = await startFixtureServer();
  const userDataDir = await mkdtemp(join(tmpdir(), "fillnest-playwright-"));
  const extensionBaseDir = await mkdtemp(join(tmpdir(), "fillnest-extension-"));
  const extensionPath = join(extensionBaseDir, "extension");
  await cp(resolve(E2E_EXTENSION_BUILD_DIR), extensionPath, { recursive: true });
  const fixturePattern = `${fixture.origin}/*`;
  let context: BrowserContext | undefined;

  try {
    context = await launchWithPermissionHistory(userDataDir, extensionPath, [fixturePattern]);
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: fixture.origin });
    const worker = await extensionWorker(context);
    const extensionId = new URL(worker.url()).host;
    const page = await context.newPage();
    await page.goto(fixture.origin);
    const extensionPage = await openExtensionPage(context, extensionId);
    await grantOrigin(worker, extensionPage, page, fixture.origin);
    await page.bringToFront();

    // ---- Excluded hosts get nothing at all -----------------------------
    for (const id of [
      "#code-host",
      "#code-mirror-host",
      "#cell-host",
      "#bare-host",
    ]) {
      await page.locator(id).click();
      await page.waitForTimeout(250);
      await expect(page.locator("[data-fillnest-overlay]"), `${id} must be untouched`).toHaveCount(0);
      await expect(page.locator(`${id}[data-fillnest-field]`)).toHaveCount(0);
    }

    // ---- Task 036 Addendum D: two hosts the first rules refused --------
    for (const id of ["#lying-single-line-host", "#placeholder-host"]) {
      await page.locator(id).click();
      await expect(page.locator(`${id}[data-fillnest-field]`), `${id} must be a Field`).toHaveCount(
        1,
      );
    }

    // ---- A named host is an ordinary Field -----------------------------
    await page.locator("#plain-host").click();
    await page.getByRole("button", { name: "Open FillNest" }).click();
    await page.getByRole("button", { name: "New template" }).click();
    await page.getByRole("textbox", { name: "Template content" }).fill(TEMPLATE);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("status").first()).toHaveText("Saved and bound to this field.");
    await page.keyboard.press("Escape");

    // Insertion lands, and no key event is synthesized on the way.
    await page.evaluate(() => {
      (window as unknown as { __fillnestKeyEvents: string[] }).__fillnestKeyEvents = [];
    });
    await page.locator("#plain-host").click();
    await page.getByRole("button", { name: "Open FillNest" }).click();
    await page.getByRole("button", { name: TEMPLATE }).click();
    await expect(page.locator("#plain-host")).toHaveText(TEMPLATE);
    expect(
      await page.evaluate(() => (window as unknown as { __fillnestKeyEvents: string[] }).__fillnestKeyEvents),
    ).toEqual([]);

    // ---- A host with a role and no name: insert yes, Bind no -----------
    await page.keyboard.press("Escape");
    await page.locator("#unnamed-host").click();
    await page.getByRole("button", { name: "Open FillNest" }).click();
    await expect(
      page.getByText("This editor has no stable identity, so a Template can be inserted here but not remembered."),
    ).toBeVisible();
    await page.getByRole("button", { name: "New template" }).click();
    await expect(page.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
    await page.keyboard.press("Escape");

    // ---- A refusing editor: reported, and the clipboard is left alone --
    await page.evaluate(() => navigator.clipboard.writeText("something the user cares about"));
    await page.locator("#refusing-host").click();
    await page.getByRole("button", { name: "Open FillNest" }).click();
    await page.locator('.picker input[aria-label="Search templates"]').fill("Please review");
    await page.getByRole("button", { name: TEMPLATE }).click();
    await expect(page.getByText("This editor did not accept the insertion.")).toBeVisible();
    await expect(page.locator("#refusing-host")).toHaveText("");
    // Nothing has been copied. The offer exists; the write has not happened.
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      "something the user cares about",
    );

    await page.getByRole("button", { name: "Copy to clipboard" }).click();
    await expect(page.getByText("Copied to the clipboard - paste it into the editor.")).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(TEMPLATE);

    // ---- An editor that reverts on the next frame is caught too --------
    await page.keyboard.press("Escape");
    await page.locator("#reverting-host").click();
    await page.getByRole("button", { name: "Open FillNest" }).click();
    await page.locator('.picker input[aria-label="Search templates"]').fill("Please review");
    await page.getByRole("button", { name: TEMPLATE }).click();
    await expect(page.getByText("This editor did not accept the insertion.")).toBeVisible();
  } finally {
    await context?.close();
    await rm(userDataDir, { recursive: true, force: true });
    await rm(extensionBaseDir, { recursive: true, force: true });
    await stopFixtureServer(fixture.server);
  }
});

test("a remembered Insertion Rejection offers the copy up front on the next visit", async () => {
  test.setTimeout(120_000);
  const fixture = await startFixtureServer();
  const userDataDir = await mkdtemp(join(tmpdir(), "fillnest-playwright-"));
  const extensionBaseDir = await mkdtemp(join(tmpdir(), "fillnest-extension-"));
  const extensionPath = join(extensionBaseDir, "extension");
  await cp(resolve(E2E_EXTENSION_BUILD_DIR), extensionPath, { recursive: true });
  const fixturePattern = `${fixture.origin}/*`;
  let context: BrowserContext | undefined;

  try {
    context = await launchWithPermissionHistory(userDataDir, extensionPath, [fixturePattern]);
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: fixture.origin });
    const worker = await extensionWorker(context);
    const extensionId = new URL(worker.url()).host;
    const page = await context.newPage();
    await page.goto(fixture.origin);
    const extensionPage = await openExtensionPage(context, extensionId);
    await grantOrigin(worker, extensionPage, page, fixture.origin);
    await page.bringToFront();

    // Bind on the refusing host, so the Field has a stored profile to
    // remember anything against.
    await page.locator("#refusing-host").click();
    await page.getByRole("button", { name: "Open FillNest" }).click();
    await page.getByRole("button", { name: "New template" }).click();
    await page.getByRole("textbox", { name: "Template content" }).fill(TEMPLATE);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("status").first()).toHaveText("Saved and bound to this field.");

    // The insertion is refused, and the fact is recorded.
    await page.getByRole("button", { name: TEMPLATE }).click();
    await expect(page.getByText("This editor did not accept the insertion.")).toBeVisible();

    // A fresh visit: the copy is offered before anything is attempted.
    await page.reload();
    await page.locator("#refusing-host").click();
    await page.getByRole("button", { name: "Open FillNest" }).click();
    await expect(page.getByRole("button", { name: "Copy to clipboard" })).toBeVisible();
    await expect(page.getByText("This editor did not accept the insertion.")).toHaveCount(0);
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
