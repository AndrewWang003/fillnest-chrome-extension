import { E2E_EXTENSION_BUILD_DIR } from "../helpers/extension-build";
import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { chromium, expect, test, type BrowserContext, type Page, type Worker } from "@playwright/test";

/**
 * Task 034. The theme is only real if it reaches every surface, so this drives
 * the actual product: choose a theme in Settings, then check that the Side
 * Panel repaints, that the choice survives a reload, and that Reset returns to
 * the default palette.
 */
test("Settings chooses a theme, every surface takes it, it survives a reload, and Reset clears it", async () => {
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
    const sidePanel = await openSidePanel(context, extensionId);

    await sidePanel.getByRole("button", { name: "Settings" }).click();
    await expect(sidePanel.getByRole("heading", { name: "Appearance" })).toBeVisible();

    // Default: the shipped blue, painted from the tokens rather than assumed.
    await expect.poll(() => themeAttributes(sidePanel)).toEqual({ theme: "default", mode: "light" });

    await sidePanel.getByRole("radio", { name: "Dark", exact: true }).click();
    await expect.poll(() => themeAttributes(sidePanel)).toEqual({ theme: "default", mode: "dark" });
    const darkCanvas = await tokenValue(sidePanel, "--fn-canvas");
    expect(darkCanvas.trim()).toBe("#12151d");

    await sidePanel.getByRole("radio", { name: "Forest" }).click();
    await expect.poll(() => themeAttributes(sidePanel)).toEqual({ theme: "forest", mode: "dark" });
    // The accent moved with the theme; the neutral ramp is shared, so the
    // canvas is the theme's own tint rather than the previous theme's.
    expect((await tokenValue(sidePanel, "--fn-accent")).trim()).toBe("#7fce9c");

    // Survives a reload of the surface: the choice is stored, not in memory.
    await sidePanel.reload();
    await expect.poll(() => themeAttributes(sidePanel)).toEqual({ theme: "forest", mode: "dark" });

    // A second surface opened afterwards wears the same theme.
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await expect.poll(() => themeAttributes(popup)).toEqual({ theme: "forest", mode: "dark" });
    await popup.close();

    // Reset returns the palette to the default with everything else.
    await sidePanel.getByRole("button", { name: "Settings" }).click();
    await sidePanel.getByRole("button", { name: "Reset FillNest", exact: true }).first().click();
    const dialog = sidePanel.locator(".clean-up-sheet");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("textbox").fill("reset");
    await dialog.getByRole("button", { name: "Reset FillNest" }).click();
    await expect(dialog).toHaveCount(0, { timeout: 15_000 });
    await expect.poll(() => themeAttributes(sidePanel), { timeout: 10_000 }).toEqual({
      theme: "default",
      mode: "light",
    });
  } finally {
    await context?.close();
    await rm(userDataDir, { recursive: true, force: true });
    await rm(extensionBaseDir, { recursive: true, force: true });
  }
});

async function themeAttributes(page: Page): Promise<{ theme: string | null; mode: string | null }> {
  return page.evaluate(() => ({
    theme: document.documentElement.dataset["fnTheme"] ?? null,
    mode: document.documentElement.dataset["fnMode"] ?? null,
  }));
}

async function tokenValue(page: Page, name: string): Promise<string> {
  return page.evaluate((token) => getComputedStyle(document.documentElement).getPropertyValue(token), name);
}

async function extensionWorker(context: BrowserContext): Promise<Worker> {
  const existing = context.serviceWorkers()[0];
  return existing ?? (await context.waitForEvent("serviceworker"));
}

async function openSidePanel(context: BrowserContext, extensionId: string): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/side-panel.html`);
  await page.getByRole("navigation").waitFor();
  return page;
}
