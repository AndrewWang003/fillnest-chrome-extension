import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { chromium, type BrowserContext } from "@playwright/test";

import { TIP_IDS } from "../../src/guidance/tips";
import { DISMISSED_TIPS_STORAGE_KEY } from "../../src/guidance/tips-repository";

/**
 * Task 042: a fresh profile shows the first-use tips, which change the
 * Picker's height and Tab order. Specs about anything else start as a user
 * who has already dismissed them; a spec about the tips asks for a first-time
 * user with `firstUseTips: "shown"`.
 */
export async function launchWithPermissionHistory(
  userDataDir: string,
  extensionPath: string,
  patterns: string[],
  options: { firstUseTips?: "shown" | "dismissed"; extraArgs?: string[] } = {},
): Promise<BrowserContext> {
  const manifestPath = join(extensionPath, "manifest.json");
  const original = await readFile(manifestPath, "utf8");
  const manifest = JSON.parse(original) as Record<string, unknown>;
  manifest.host_permissions = patterns;
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  // `extraArgs` is for the store screenshots, which map a reserved hostname
  // onto the fixture server so the Popup names a site rather than a loopback
  // port. Every spec that does not pass it launches exactly as before.
  const args = [
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
    ...(options.extraArgs ?? []),
  ];
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: "chromium",
    headless: false,
    args,
  });
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker");
  await worker.evaluate(async (origins) => {
    for (const origin of origins) {
      if (!(await chrome.permissions.contains({ origins: [origin] }))) {
        throw new Error(`Seed permission unavailable: ${origin}`);
      }
    }
  }, patterns);
  if ((options.firstUseTips ?? "dismissed") === "dismissed") {
    await worker.evaluate(
      async ({ key, tips }) => chrome.storage.local.set({ [key]: tips }),
      { key: DISMISSED_TIPS_STORAGE_KEY, tips: [...TIP_IDS] },
    );
  }
  await context.close();
  await writeFile(manifestPath, original);
  return chromium.launchPersistentContext(userDataDir, { channel: "chromium", headless: false, args });
}
