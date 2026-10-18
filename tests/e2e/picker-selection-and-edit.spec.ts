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
 * Task 036 Addendum J. What the owner saw on opening the Picker over a Field
 * with several Templates: a Template shown as selected while Search had the
 * focus, and after one ArrowDown two Templates shown as selected. The Picker
 * opens where the user just clicked, so a row appears under a pointer that has
 * not moved.
 */
const FIXTURE_HTML = `<!doctype html>
<html>
  <body>
    <textarea id="composer" aria-label="Message the assistant" style="margin-top:40px"></textarea>
    <input id="other-field" type="text" aria-label="Subject" style="margin-top:400px" />
  </body>
</html>`;

const TEMPLATES = ["First saved reply", "Second saved reply", "Third saved reply"];

async function createBoundTemplates(page: Page): Promise<void> {
  for (const content of TEMPLATES) {
    await page.getByRole("button", { name: "New template" }).click();
    await page.getByRole("textbox", { name: "Template content" }).fill(content);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("button", { name: content })).toBeVisible();
  }
}

const highlightedRows = (page: Page) => page.locator("[data-template-row][data-highlighted]");

test("one selection at most: none on open under a resting pointer, and ArrowDown selects the first row", async () => {
  test.setTimeout(120_000);
  const harness = await openHarness();
  const { page } = harness;
  try {
    await page.locator("#composer").click();
    await page.getByRole("button", { name: "Open FillNest" }).click();
    await createBoundTemplates(page);

    // Park the pointer where the second row appears, with the Picker closed.
    const secondRow = page.locator("[data-template-row]").nth(1);
    const box = await secondRow.boundingBox();
    if (!box) throw new Error("Second row has no box");
    await page.keyboard.press("Escape");
    await expect(secondRow).toHaveCount(0);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

    // Reopen from the keyboard, so the row appears under a resting pointer.
    await page.locator("#composer").focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await expect(page.getByLabel("Search templates")).toBeFocused();
    await expect(secondRow).toBeVisible();
    await page.waitForTimeout(200);
    await expect(highlightedRows(page)).toHaveCount(0);
    // Nothing paints a row as selected by any other route either.
    const accentShadows = await page
      .locator("[data-template-row]")
      .evaluateAll((rows) => rows.filter((row) => getComputedStyle(row).boxShadow !== "none").length);
    expect(accentShadows).toBe(0);

    await page.keyboard.press("ArrowDown");
    await expect(highlightedRows(page)).toHaveCount(1);
    await expect(page.locator("[data-template-row]").nth(0)).toHaveAttribute("data-highlighted", "true");

    // Task 037 Addendum B: the host's inline all:initial outranks :host, so
    // headings once fell back to the browser's serif default.
    const headingFont = await page.locator(".picker header").evaluate((header) => getComputedStyle(header).fontFamily);
    expect(headingFont).toContain("sans-serif");
  } finally {
    await closeHarness(harness);
  }
});

test("arrow keys count from the focused row, not from a row the pointer moved to", async () => {
  test.setTimeout(120_000);
  const harness = await openHarness();
  const { page } = harness;
  try {
    await page.locator("#composer").click();
    await page.getByRole("button", { name: "Open FillNest" }).click();
    await createBoundTemplates(page);

    await page.getByLabel("Search templates").focus();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("button", { name: TEMPLATES[0] })).toBeFocused();

    // The pointer moves to the third row; focus stays on the first.
    await page.locator("[data-template-row]").nth(2).hover();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("button", { name: TEMPLATES[1] })).toBeFocused();
    await expect(highlightedRows(page)).toHaveCount(1);
  } finally {
    await closeHarness(harness);
  }
});

test("an edit ended by moving to another Field leaves the focus on that Field", async () => {
  test.setTimeout(120_000);
  const harness = await openHarness();
  const { page } = harness;
  try {
    await page.locator("#composer").click();
    await page.getByRole("button", { name: "Open FillNest" }).click();
    await createBoundTemplates(page);
    await page.getByRole("button", { name: "Keep open" }).click();

    const row = page.locator("[data-template-row]").nth(0);
    await row.hover();
    await row.getByRole("button", { name: "Edit" }).click();
    await expect(page.getByRole("textbox", { name: "Edit template content" })).toBeFocused();

    await page.locator("#other-field").click();
    await expect(page.getByLabel("Search templates")).toBeVisible();
    await page.waitForTimeout(300);
    await expect(page.locator("#other-field")).toBeFocused();
  } finally {
    await closeHarness(harness);
  }
});

test("editing a Template works like composing one: Search and New template step aside", async () => {
  test.setTimeout(120_000);
  const harness = await openHarness();
  const { page } = harness;
  try {
    await page.locator("#composer").click();
    await page.getByRole("button", { name: "Open FillNest" }).click();
    await createBoundTemplates(page);

    const row = page.locator("[data-template-row]").nth(0);
    await row.hover();
    await row.getByRole("button", { name: "Edit" }).click();
    await expect(page.getByLabel("Search templates")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "New template" })).toHaveCount(0);
    await expect(page.getByRole("textbox", { name: "Edit template content" })).toBeFocused();

    // Owner QA 2026-09-14: the editor is a panel of its own, not in the row.
    await expect(page.locator("[data-template-row]")).toHaveCount(0);
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page.getByLabel("Search templates")).toBeFocused();
    await expect(page.getByRole("button", { name: "New template" })).toBeVisible();
  } finally {
    await closeHarness(harness);
  }
});

// Owner QA 2026-09-14: New template and Edit keep the Picker its list size and
// give the room to the text; in Edit, Tab goes from the text to every Save
// choice - even before anything changed - and then to Cancel.
test("New template and Edit keep the Picker's size, and Tab reaches every Save choice", async () => {
  test.setTimeout(120_000);
  const harness = await openHarness();
  const { page } = harness;
  try {
    await page.locator("#composer").click();
    await page.getByRole("button", { name: "Open FillNest" }).click();
    await createBoundTemplates(page);

    // Sizes, on a field with several Templates.
    const picker = page.locator(".picker");
    const listHeight = (await picker.boundingBox())!.height;
    await page.getByRole("button", { name: "New template" }).click();
    const composeBox = page.getByRole("textbox", { name: "Template content" });
    await expect(composeBox).toBeVisible();
    expect(Math.abs((await picker.boundingBox())!.height - listHeight)).toBeLessThan(2);
    expect((await composeBox.boundingBox())!.height).toBeGreaterThanOrEqual(96);
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    const firstRow = page.locator("[data-template-row]").nth(0);
    await firstRow.hover();
    await firstRow.getByRole("button", { name: "Edit" }).click();
    const firstEditor = page.getByRole("textbox", { name: "Edit template content" });
    await expect(firstEditor).toBeFocused();
    expect(Math.abs((await picker.boundingBox())!.height - listHeight)).toBeLessThan(2);
    expect((await firstEditor.boundingBox())!.height).toBeGreaterThanOrEqual(96);
    await page.getByRole("button", { name: "Cancel", exact: true }).click();

    // Tab order, on a Template this field shares with another: two Save choices.
    await page.keyboard.press("Escape");
    await page.locator("#other-field").click();
    await page.getByRole("button", { name: "Open FillNest" }).click();
    await page.getByLabel("Search templates").fill("First");
    const found = page.locator("[data-template-row]").nth(0);
    await found.hover();
    await found.getByRole("button", { name: "Bind to this field", exact: true }).click();
    await page.getByLabel("Search templates").fill("");
    await expect(page.locator("[data-template-row]")).toHaveCount(1);
    const row = page.locator("[data-template-row]").nth(0);
    await row.hover();
    await row.getByRole("button", { name: "Edit" }).click();
    await expect(page.getByRole("textbox", { name: "Edit template content" })).toBeFocused();

    // Nothing changed yet: both Save choices are unavailable but still reachable.
    const focusedName = () =>
      page.evaluate(() => {
        const active = document.querySelector("[data-fillnest-overlay]")?.shadowRoot?.activeElement;
        return active ? `${active.textContent?.trim()}|${active.getAttribute("aria-disabled") ?? ""}` : "";
      });
    await page.keyboard.press("Tab");
    expect(await focusedName()).toBe("Save everywhere|true");
    await page.keyboard.press("Tab");
    expect(await focusedName()).toBe("Save a copy here|true");
    await page.keyboard.press("Tab");
    expect(await focusedName()).toBe("Cancel|");
  } finally {
    await closeHarness(harness);
  }
});

// Owner QA 2026-09-15: a result quoting a Template with no spaces in it could
// not wrap, and pushed Undo out of the Picker.
test("a result quoting an unbroken Template wraps and keeps Undo inside the Picker", async () => {
  test.setTimeout(120_000);
  const harness = await openHarness();
  const { page } = harness;
  try {
    await page.locator("#composer").click();
    await page.getByRole("button", { name: "Open FillNest" }).click();
    await createBoundTemplates(page);
    const row = page.locator("[data-template-row]").nth(0);
    await row.hover();
    await row.getByRole("button", { name: "Edit" }).click();
    await page.getByRole("textbox", { name: "Edit template content" }).fill("123fillnest.feedback@gmail.com".repeat(6));
    await page.getByRole("button", { name: "Save", exact: true }).click();

    const undo = page.locator(".picker-result").getByRole("button", { name: "Undo" });
    await expect(undo).toBeVisible();
    const picker = (await page.locator(".picker").boundingBox())!;
    const undoBox = (await undo.boundingBox())!;
    expect(undoBox.x + undoBox.width).toBeLessThanOrEqual(picker.x + picker.width);
    const result = (await page.locator(".picker-result").boundingBox())!;
    expect(result.x + result.width).toBeLessThanOrEqual(picker.x + picker.width + 1);
  } finally {
    await closeHarness(harness);
  }
});

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
