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
  </body>
</html>`;

test("Picker keyboard highlight has real visible contrast, and repeatedly inserting the same Template in Keep Open flags it clearly", async () => {
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

    // Bind two Templates to field-a so keyboard Arrow navigation has more
    // than one row to move across.
    await page.locator("#field-a").focus();
    await page.getByRole("button", { name: "Open FillNest" }).click();
    await page.getByRole("button", { name: "New template" }).click();
    await page.getByRole("textbox", { name: "Template content" }).fill("First reply");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("Saved and bound to this field.");

    const secondTemplate = await sendRuntimeRequest(extensionPage, {
      type: "RESTORE_TEMPLATE",
      template: {
        id: "template-2",
        content: "Second reply",
        siteAffinities: [],
        createdAt: "2026-08-16T00:00:00.000Z",
        updatedAt: "2026-08-16T00:00:00.000Z",
        totalUsageCount: 0,
        revision: 0,
      },
      bindings: [],
    });
    expect(secondTemplate.ok).toBe(true);
    const bindSecond = await sendRuntimeRequest(extensionPage, {
      type: "BIND_TEMPLATE",
      templateId: "template-2",
      pageUrl: fixture.origin,
      pageProfileId: (await readState(extensionPage)).bindings[0]?.pageProfileId,
      fieldProfileId: (await readState(extensionPage)).bindings[0]?.fieldProfileId,
    });
    expect(bindSecond.ok).toBe(true);

    await page.locator("#field-a").focus();
    await page.getByRole("button", { name: "Open FillNest" }).click();
    await expect(page.getByText("Second reply")).toBeVisible();

    // Keyboard highlight: real computed-style contrast, not just visual
    // trust. Task 003, restored by Task 036 Addendum J: nothing is selected
    // on open, the first ArrowDown selects row 1 and the next row 2; compare
    // row 1 (now unhighlighted) against row 2 (now highlighted).
    const searchBox = page.getByRole("searchbox", { name: "Search templates" });
    const rowOne = page.locator("[data-template-row]").nth(0);
    const rowTwo = page.locator("[data-template-row]").nth(1);
    await expect(page.locator("[data-template-row][data-highlighted]")).toHaveCount(0);
    await searchBox.press("ArrowDown");
    await expect(rowOne).toHaveAttribute("data-highlighted", "true");
    await page.keyboard.press("ArrowDown");
    await expect(rowTwo).toHaveAttribute("data-highlighted", "true");
    await expect(rowOne).not.toHaveAttribute("data-highlighted", "true");
    const unhighlightedBackground = await rowOne.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    );
    const highlightedBackground = await rowTwo.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    );
    expect(highlightedBackground).not.toBe(unhighlightedBackground);
    expect(highlightedBackground).not.toBe("rgba(0, 0, 0, 0)");

    // Mouse hover must carry the exact same weight and color as the
    // keyboard highlight - and hovering the Template button itself (which
    // covers most of the row) must not paint a different, conflicting
    // background over the row's own highlight.
    await rowOne.locator(".template").hover();
    // Addendum J: pointing moves the one highlight rather than adding another.
    await expect(rowOne).toHaveAttribute("data-highlighted", "true");
    await expect(page.locator("[data-template-row][data-highlighted]")).toHaveCount(1);
    const hoverOnlyBackground = await rowOne.evaluate((element) => getComputedStyle(element).backgroundColor);
    expect(hoverOnlyBackground).toBe(highlightedBackground);

    // Keyboard-only pass: after Tab moves real focus onto a row's own
    // button (not the search box), Up/Down must still move the highlight
    // instead of falling through to the browser's default page-scroll.
    // The Picker renders inside an open shadow root, so document.activeElement
    // only reports the shadow host - walk into shadowRoot.activeElement to
    // see what's really focused.
    const deepActiveElementLabel = () =>
      page.evaluate(() => {
        let active: Element | null = document.activeElement;
        while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
        return active?.getAttribute("aria-label") ?? null;
      });
    await searchBox.focus();
    await page.keyboard.press("Tab");
    expect(await deepActiveElementLabel()).not.toBe("Search templates");
    await page.keyboard.press("ArrowUp");
    expect(await deepActiveElementLabel()).toBe("Search templates");
    // Addendum J: back on Search, no Template is shown as selected.
    await expect(page.locator("[data-template-row][data-highlighted]")).toHaveCount(0);

    // Editing opens its own panel (owner QA 2026-09-14), so no row highlight
    // can bleed into the editor: the list is gone while it is open.
    await rowOne.hover();
    await rowOne.getByRole("button", { name: "Edit" }).click();
    await expect(page.locator("[data-template-row]")).toHaveCount(0);
    await page.getByRole("button", { name: "Cancel", exact: true }).click();

    // Pin mode, then repeatedly insert the same Template into field-a.
    await page.getByRole("button", { name: "Keep open" }).click();
    const firstRow = page.locator("[data-template-row]", { hasText: "First reply" });
    await expect(firstRow).not.toHaveAttribute("data-repeat-inserted", "true");

    await firstRow.getByRole("button", { name: "First reply" }).click();
    await expect(firstRow).not.toHaveAttribute("data-repeat-inserted", "true");
    await expect(page.getByText(/times into this field/u)).toHaveCount(0);

    await firstRow.getByRole("button", { name: "First reply" }).click();
    await expect(firstRow).toHaveAttribute("data-repeat-inserted", "true");
    await expect(page.getByText('Inserted "First reply" 2 times into this field.')).toBeVisible();
    await page.screenshot({ path: "output/playwright/task003-picker-repeat-insert-warning.png" });

    const fieldValue = await page.locator("#field-a").inputValue();
    expect(fieldValue).toBe("First replyFirst reply");
  } finally {
    await context?.close();
    await rm(userDataDir, { recursive: true, force: true });
    await rm(extensionBaseDir, { recursive: true, force: true });
    await stopFixtureServer(fixture.server);
  }
});

interface BindingShape {
  pageProfileId: string;
  fieldProfileId: string;
}
interface StateShape {
  bindings: BindingShape[];
}

async function readState(extensionPage: Page): Promise<StateShape> {
  const response = await sendRuntimeRequest(extensionPage, { type: "READ_STATE" });
  if (!response.ok) throw new Error(response.error ?? "READ_STATE failed");
  return response.value as StateShape;
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
