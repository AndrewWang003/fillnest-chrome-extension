import { E2E_EXTENSION_BUILD_DIR } from "../helpers/extension-build";
import { cp, mkdtemp, rm } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { chromium, expect, test, type BrowserContext, type Page, type Worker } from "@playwright/test";

import { launchWithPermissionHistory } from "../helpers/prime-extension-permissions";

interface RuntimeHarnessResponse {
  ok: boolean;
  value?: unknown;
  error?: string;
}

test("Deletion Safety: immediate single Delete with Undo, multi-select Delete with an impact summary, and typed delete for the whole library", async () => {
  test.setTimeout(60_000);
  const userDataDir = await mkdtemp(join(tmpdir(), "fillnest-playwright-"));
  const extensionBaseDir = await mkdtemp(join(tmpdir(), "fillnest-extension-"));
  const extensionPath = join(extensionBaseDir, "extension");
  await cp(resolve(E2E_EXTENSION_BUILD_DIR), extensionPath, { recursive: true });
  let context: BrowserContext | undefined;

  try {
    context = await chromium.launchPersistentContext(userDataDir, {
      channel: "chromium",
      headless: false,
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    });
    const worker = await extensionWorker(context);
    const extensionId = new URL(worker.url()).host;
    const extensionPage = await openExtensionPage(context, extensionId);

    for (const [id, content] of [
      ["template-1", "First global note"],
      ["template-2", "Second global note"],
      ["template-3", "Third global note"],
    ] as const) {
      const result = await sendRuntimeRequest(extensionPage, {
        type: "RESTORE_TEMPLATE",
        template: {
          id,
          content,
          siteAffinities: [],
          createdAt: "2026-08-16T00:00:00.000Z",
          updatedAt: "2026-08-16T00:00:00.000Z",
          totalUsageCount: 0,
          revision: 0,
        },
        bindings: [],
      });
      expect(result.ok).toBe(true);
    }

    const sidePanel = await context.newPage();
    await sidePanel.goto(`chrome-extension://${extensionId}/side-panel.html`);
    await sidePanel.getByRole("button", { name: "Templates" }).click();
    await sidePanel.getByRole("button", { name: "All templates", exact: true }).click();
    await expect(sidePanel.getByText("First global note")).toBeVisible();
    await expect(sidePanel.getByText("Second global note")).toBeVisible();
    await expect(sidePanel.getByText("Third global note")).toBeVisible();

    // Immediate single Delete: no pre-confirmation dialog, Undo bar reverses it.
    await sidePanel
      .locator(".template-item", { hasText: "First global note" })
      .getByRole("button", { name: "Delete" })
      .click();
    await expect(sidePanel.locator(".template-item", { hasText: "First global note" })).toHaveCount(0);
    await expect(sidePanel.locator(".confirm-inline", { hasText: "Delete this Template" })).toHaveCount(0);
    // Result is now shown in the global result region below navigation, not the old bottom bar.
    const resultRegion = sidePanel.locator(".panel-result-region");
    await expect(resultRegion).toContainText("Deleted");
    await expect(resultRegion).toContainText("First global note");
    await resultRegion.getByRole("button", { name: "Undo" }).click();
    await expect(sidePanel.locator(".template-item", { hasText: "First global note" })).toBeVisible();
    // After Undo, the result region shows a completion notice (no second Undo).
    await expect(resultRegion.getByRole("button", { name: "Undo" })).toHaveCount(0);

    // Multi-select deletion: an ordinary confirmation with an expandable impact
    // summary (no typed DELETE, since this is not the whole library).
    await sidePanel
      .locator(".template-item", { hasText: "First global note" })
      .getByRole("checkbox")
      .check();
    await sidePanel
      .locator(".template-item", { hasText: "Second global note" })
      .getByRole("checkbox")
      .check();
    await expect(sidePanel.getByText("2 selected")).toBeVisible();
    await sidePanel.getByRole("button", { name: "Delete selected" }).click();
    await expect(sidePanel.getByText("Delete 2 Templates everywhere?")).toBeVisible();
    await expect(sidePanel.getByRole("textbox", { name: "Type delete to confirm" })).toHaveCount(0);
    await sidePanel.getByRole("button", { name: /^Show affected locations/u }).click();
    await expect(sidePanel.getByText("Sites:")).toBeVisible();
    await sidePanel.screenshot({ path: "output/playwright/task003-slice6-deletion-safety.png", fullPage: true });
    await sidePanel.locator(".batch-delete-confirm").getByRole("button", { name: "Delete", exact: true }).click();
    await expect(sidePanel.locator(".template-item", { hasText: "First global note" })).toHaveCount(0);
    await expect(sidePanel.locator(".template-item", { hasText: "Second global note" })).toHaveCount(0);
    await expect(sidePanel.locator(".template-item", { hasText: "Third global note" })).toBeVisible();
    await expect(resultRegion).toContainText("Deleted 2 Templates");
    await resultRegion.getByRole("button", { name: "Undo" }).click();
    await expect(sidePanel.locator(".template-item", { hasText: "First global note" })).toBeVisible();
    await expect(sidePanel.locator(".template-item", { hasText: "Second global note" })).toBeVisible();

    // Deleting the entire Template Library requires exact typed lowercase
    // delete, and lives in Templates so Settings can own only product-wide
    // Reset rather than duplicating a library action.
    const selectAll = sidePanel.getByRole("checkbox", { name: "Select all visible Templates" });
    await selectAll.check();
    await sidePanel.getByRole("button", { name: "Delete selected" }).click();
    await expect(sidePanel.getByText("This removes your entire Template Library.")).toBeVisible();
    await expect(sidePanel.getByRole("textbox", { name: "Type delete to confirm" })).toBeFocused();
    const confirmAllButton = sidePanel.locator(".batch-delete-confirm").getByRole("button", { name: "Delete", exact: true });
    await expect(confirmAllButton).toBeDisabled();
    // Disabled must look visibly inactive (grayed out), not full-strength red.
    const disabledBackground = await confirmAllButton.evaluate((element) => getComputedStyle(element).backgroundColor);
    expect(disabledBackground).not.toBe("rgb(180, 35, 24)");
    const typedInput = sidePanel.getByRole("textbox", { name: "Type delete to confirm" });
    await typedInput.fill("DELETE");
    await expect(confirmAllButton).toBeDisabled();
    await typedInput.fill("delete");
    await expect(confirmAllButton).toBeEnabled();
    const enabledBackground = await confirmAllButton.evaluate((element) => getComputedStyle(element).backgroundColor);
    expect(enabledBackground).toBe("rgb(180, 35, 24)");
    await confirmAllButton.click();
    await expect(sidePanel.getByText("Deleted 3 Templates")).toBeVisible();

    await sidePanel.getByRole("button", { name: "Templates", exact: true }).click();
    await sidePanel.getByRole("button", { name: "All templates", exact: true }).click();
    await expect(sidePanel.getByText("No Templates match this Search.")).toBeVisible();

    const finalState = await readState(extensionPage);
    expect(finalState.templates).toEqual([]);
  } finally {
    await context?.close();
    await rm(userDataDir, { recursive: true, force: true });
    await rm(extensionBaseDir, { recursive: true, force: true });
  }
});

test("Factory Reset: typed reset removes local state and returns Global Activation to paused", async () => {
  test.setTimeout(60_000);
  const fixture = await startResetFixtureServer();
  const userDataDir = await mkdtemp(join(tmpdir(), "fillnest-playwright-"));
  const extensionBaseDir = await mkdtemp(join(tmpdir(), "fillnest-extension-"));
  const extensionPath = join(extensionBaseDir, "extension");
  await cp(resolve(E2E_EXTENSION_BUILD_DIR), extensionPath, { recursive: true });
  let context: BrowserContext | undefined;

  try {
    context = await launchWithPermissionHistory(userDataDir, extensionPath, [`${fixture.origin}/*`]);
    const worker = await extensionWorker(context);
    const extensionId = new URL(worker.url()).host;
    const extensionPage = await openExtensionPage(context, extensionId);
    expect((await sendRuntimeRequest(extensionPage, {
      type: "RESTORE_TEMPLATE",
      template: {
        id: "reset-template", content: "Will be reset", siteAffinities: [],
        createdAt: "2026-08-24T00:00:00.000Z", updatedAt: "2026-08-24T00:00:00.000Z",
        totalUsageCount: 0, revision: 0,
      }, bindings: [],
    })).ok).toBe(true);
    expect((await sendRuntimeRequest(extensionPage, { type: "SET_GLOBAL_ACTIVATION", mode: "active" })).ok).toBe(true);

    const fixturePage = await context.newPage();
    await fixturePage.goto(fixture.origin);
    await fixturePage.locator("#reset-field").focus();
    await expect(fixturePage.locator("html[data-fillnest-extension-active]")).toHaveCount(1);
    await expect(fixturePage.locator("[data-fillnest-overlay]")).toHaveCount(1);
    await fixturePage.locator("[data-fillnest-overlay]").evaluate((host) => {
      host.shadowRoot?.querySelector<HTMLButtonElement>('button[aria-label="Open FillNest"]')?.click();
    });

    const sidePanel = await context.newPage();
    await sidePanel.goto(`chrome-extension://${extensionId}/side-panel.html`);
    await sidePanel.getByRole("button", { name: "Settings" }).click();
    const resetTrigger = sidePanel.getByRole("button", { name: "Reset FillNest", exact: true });
    await resetTrigger.click();
    const dialog = sidePanel.getByRole("dialog", { name: "Reset FillNest" });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("#reset-confirmation-input")).toBeFocused();
    await sidePanel.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(resetTrigger).toBeFocused();

    await resetTrigger.click();
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("#reset-confirmation-input")).toBeFocused();
    const resetButton = dialog.getByRole("button", { name: "Reset FillNest", exact: true });
    await expect(resetButton).toBeDisabled();
    await dialog.locator("#reset-confirmation-input").fill("reset");
    await expect(resetButton).toBeEnabled();
    await resetButton.click();
    // Reset fans out to every tab four times - reconcile inject, explicit
    // revocation, activation broadcast, business broadcast - and the dialog
    // only closes once RESET_FILLNEST resolves, so this assertion is timing
    // sensitive under a loaded full suite. It has failed intermittently.
    //
    // A rejected Reset also leaves the dialog open, and the two look identical
    // through a count assertion. Checking the dialog's own error region first
    // makes a rejection report its actual message instead of "expected 0,
    // received 1", so a real failure is never mistaken for slowness.
    const resetErrors = await dialog.getByRole("alert").allTextContents();
    expect(resetErrors, "Reset reported an error instead of completing").toEqual([]);
    await expect(dialog).toHaveCount(0, { timeout: 15_000 });
    await expect(sidePanel.getByText("FillNest was reset to its initial state.")).toBeVisible();
    // Task 023 Addendum B5 (12): the outcome must also reach the announcing
    // region. Reset closes its confirmation sheet and restores focus to the
    // Reset FillNest button, and all a screen-reader user used to hear was
    // that button's own name - the visible banner was the live region, and
    // its new content is a subtree of buttons that VoiceOver did not announce.
    await expect(sidePanel.locator(".visually-hidden[role='status']")).toHaveText(
      /FillNest was reset to its initial state\./,
    );
    await expect(fixturePage.locator("html[data-fillnest-extension-active]")).toHaveCount(0);
    await expect(fixturePage.locator("[data-fillnest-overlay]")).toHaveCount(0);
    await expect(fixturePage.locator("[data-fillnest-field]")).toHaveCount(0);

    const state = await readState(extensionPage);
    expect(state.templates).toEqual([]);
    const activation = await sendRuntimeRequest(extensionPage, { type: "GET_ACTIVATION_MANAGEMENT" });
    expect(activation).toMatchObject({ ok: true, value: { global: "paused", origins: [] } });
  } finally {
    await context?.close();
    await rm(userDataDir, { recursive: true, force: true });
    await rm(extensionBaseDir, { recursive: true, force: true });
    await stopResetFixtureServer(fixture.server);
  }
});

async function startResetFixtureServer(): Promise<{ server: Server; origin: string }> {
  return new Promise((resolvePromise) => {
    const server = createServer((_request, response) => {
      response.writeHead(200, { "content-type": "text/html" });
      response.end('<!doctype html><html><body><label>Notes <input id="reset-field" type="text"></label></body></html>');
    });
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Fixture server address unavailable");
      resolvePromise({ server, origin: `http://127.0.0.1:${address.port}` });
    });
  });
}

async function stopResetFixtureServer(server: Server): Promise<void> {
  await new Promise<void>((resolvePromise) => server.close(() => resolvePromise()));
}

interface StateShape {
  templates: Array<{ id: string }>;
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
