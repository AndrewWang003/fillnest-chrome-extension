import { E2E_EXTENSION_BUILD_DIR } from "../helpers/extension-build";
import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { chromium, expect, test, type BrowserContext, type Worker } from "@playwright/test";

/**
 * Task 033 Addendum D. Chrome's own UI - the toolbar, the extensions page -
 * shows the owner's mark on a white ground in every Chrome theme, since no
 * extension can read the colours Chrome paints there; the mark inside
 * FillNest follows the surface's light or dark theme.
 */
test("every manifest icon has a white ground, and the mark inside follows the theme", async () => {
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

    const popup = await context.newPage();
    await popup.emulateMedia({ colorScheme: "dark" });
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);

    // Every icon the manifest names - the toolbar's and the one on Chrome's
    // extensions page: opaque white in the corner, brand ink in the top arm.
    const toolbarIcons = await popup.evaluate(async () => {
      const manifest = chrome.runtime.getManifest();
      const values = (declared: unknown) =>
        Object.values(typeof declared === "object" && declared !== null ? declared : {}).map(String);
      const paths = [...new Set([...values(manifest.icons), ...values(manifest.action?.default_icon)])];
      return Promise.all(
        paths.map(async (path) => {
          const image = new Image();
          image.src = `/${path}`;
          await image.decode();
          const canvas = document.createElement("canvas");
          canvas.width = image.width;
          canvas.height = image.height;
          const context2d = canvas.getContext("2d")!;
          context2d.drawImage(image, 0, 0);
          const pixel = (x: number, y: number) => [...context2d.getImageData(x, y, 1, 1).data];
          const size = image.width;
          return { path, corner: pixel(0, 0), arm: pixel(Math.round(size * 0.66), Math.round(size * 0.21)) };
        }),
      );
    });
    expect(toolbarIcons.map(({ path }) => path).sort()).toEqual([
      "icons/icon-128.png",
      "icons/icon-16.png",
      "icons/icon-32.png",
      "icons/icon-48.png",
    ]);
    for (const { corner, arm } of toolbarIcons) {
      expect(corner).toEqual([255, 255, 255, 255]);
      expect(arm[0]).toBeLessThan(80);
    }

    // The mark's ink is the surface's text colour: light in dark mode, dark
    // in light mode; its insert bar is the brand red in both.
    const mark = popup.locator('.brand-mark svg[data-fillnest-icon="brand"]');
    await expect(mark).toBeVisible();
    const ink = () => mark.locator("g").evaluate((group) => getComputedStyle(group).fill);
    const accent = () => mark.locator("[data-fillnest-brand-accent]").evaluate((bar) => getComputedStyle(bar).fill);
    const darkInk = await ink();
    expect(await accent()).toBe("rgb(236, 48, 19)");

    await popup.emulateMedia({ colorScheme: "light" });
    await expect.poll(ink).not.toBe(darkInk);
    expect(await accent()).toBe("rgb(236, 48, 19)");
  } finally {
    await context?.close();
    await rm(userDataDir, { recursive: true, force: true });
    await rm(extensionBaseDir, { recursive: true, force: true });
  }
});

async function extensionWorker(context: BrowserContext): Promise<Worker> {
  const existing = context.serviceWorkers()[0];
  return existing ?? (await context.waitForEvent("serviceworker"));
}
