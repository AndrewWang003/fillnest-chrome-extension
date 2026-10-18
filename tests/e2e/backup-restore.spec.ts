import { E2E_EXTENSION_BUILD_DIR } from "../helpers/extension-build";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { chromium, expect, test, type BrowserContext, type Page, type Worker } from "@playwright/test";

interface RuntimeHarnessResponse {
  ok: boolean;
  value?: unknown;
  error?: string;
}

test("Backup and Restore: Export JSON archive with rich bindings/profiles/identityKeys, optional backup reminder, typed confirmation, and full data restoration", async () => {
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

    // 1. Seed initial templates
    for (const [id, content, affinities] of [
      ["template-alpha", "Original Alpha Template", ["example.com"]],
      ["template-beta", "Original Beta Template", []],
    ] as const) {
      const result = await sendRuntimeRequest(extensionPage, {
        type: "RESTORE_TEMPLATE",
        template: {
          id,
          content,
          siteAffinities: affinities,
          createdAt: "2026-08-21T00:00:00.000Z",
          updatedAt: "2026-08-21T00:00:00.000Z",
          totalUsageCount: 2,
          revision: 1,
        },
        bindings: [],
      });
      expect(result.ok).toBe(true);
    }

    // 2. Bind template-alpha to a real PageProfile and FieldProfile with identityKeys
    const bindResult = await sendRuntimeRequest(extensionPage, {
      type: "BIND_TEMPLATE",
      templateId: "template-alpha",
      pageUrl: "https://example.com/login",
      pageProfileId: "page-login",
      pageIdentityKey: "login-page-key",
      fieldProfileId: "field-username",
      fieldIdentityKey: "username-input-key",
    });
    expect(bindResult.ok).toBe(true);

    // Add user aliases
    await sendRuntimeRequest(extensionPage, {
      type: "SET_PAGE_ALIAS",
      pageProfileId: "page-login",
      alias: "User Login Page",
    });
    await sendRuntimeRequest(extensionPage, {
      type: "SET_FIELD_ALIAS",
      fieldProfileId: "field-username",
      alias: "User Email Input",
    });

    // Save picker position
    await sendRuntimeRequest(extensionPage, {
      type: "SET_PICKER_POSITION",
      position: { top: 180, left: 320 },
    });

    const sidePanel = await context.newPage();
    await sidePanel.goto(`chrome-extension://${extensionId}/side-panel.html`);

    // Verify initial templates are visible
    await sidePanel.getByRole("button", { name: "Templates", exact: true }).click();
    await sidePanel.getByRole("button", { name: "All templates", exact: true }).click();
    await expect(sidePanel.getByText("Original Alpha Template")).toBeVisible();
    await expect(sidePanel.getByText("Original Beta Template")).toBeVisible();

    // 3. Export Backup from Settings
    await sidePanel.getByRole("button", { name: "Settings" }).click();
    await expect(sidePanel.getByRole("heading", { name: "Data Management" })).toBeVisible();
    // The privacy warning hangs off the Backup action rather than standing as
    // a block of its own, but it is not hover-only: the control is focusable
    // and the whole warning is its accessible name.
    const privacyHint = sidePanel.locator(".setting-hint");
    await expect(privacyHint).toBeVisible();
    await expect(privacyHint).toHaveAccessibleName(/^Privacy warning: a backup is plain text/u);
    await privacyHint.focus();
    await expect.poll(() =>
      privacyHint.evaluate((element) => getComputedStyle(element, "::after").opacity),
    ).toBe("1");

    const downloadPromise = sidePanel.waitForEvent("download");
    await sidePanel.getByRole("button", { name: "Export Backup" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^fillnest-backup-\d{4}-\d{2}-\d{2}\.json$/);

    const backupFilePath = join(userDataDir, download.suggestedFilename());
    await download.saveAs(backupFilePath);
    const backupContent = await readFile(backupFilePath, "utf8");
    const parsedBackup = JSON.parse(backupContent);

    expect(parsedBackup.format).toBe("fillnest-backup");
    expect(parsedBackup.archiveVersion).toBe(1);
    expect(parsedBackup.payload.business.templates.length).toBe(2);
    expect(parsedBackup.payload.business.pageProfiles.length).toBe(1);
    expect(parsedBackup.payload.business.pageProfiles[0].identityKey).toBe("login-page-key");
    expect(parsedBackup.payload.business.pageProfiles[0].userAlias).toBe("User Login Page");
    expect(parsedBackup.payload.business.fieldProfiles[0].identityKey).toBe("username-input-key");
    expect(parsedBackup.payload.business.fieldProfiles[0].userAlias).toBe("User Email Input");
    expect(parsedBackup.payload.business.bindings.length).toBe(1);
    expect(parsedBackup.payload.business.pickerPosition).toEqual({ top: 180, left: 320 });

    // 4. Mutate current state: delete template-alpha and add a new template
    await sidePanel.getByRole("button", { name: "Templates", exact: true }).click();
    await sidePanel.getByRole("button", { name: "All templates", exact: true }).click();
    // Delete Alpha template
    const alphaCard = sidePanel.locator(".template-item").filter({ hasText: "Original Alpha Template" });
    await alphaCard.getByRole("button", { name: "Delete" }).click();
    await expect(sidePanel.locator(".template-item").filter({ hasText: "Original Alpha Template" })).toHaveCount(0);

    // Add a new template via runtime
    await sendRuntimeRequest(extensionPage, {
      type: "RESTORE_TEMPLATE",
      template: {
        id: "template-gamma",
        content: "New Divergent Gamma Template",
        siteAffinities: [],
        createdAt: "2026-08-21T01:00:00.000Z",
        updatedAt: "2026-08-21T01:00:00.000Z",
        totalUsageCount: 0,
        revision: 0,
      },
      bindings: [],
    });

    // 5. Restore from Backup
    await sidePanel.getByRole("button", { name: "Settings" }).click();

    // Select the previously downloaded backup file
    await sidePanel.locator("#restore-file-input").setInputFiles(backupFilePath);

    // Verify Impact Preview sheet opens
    await expect(sidePanel.getByRole("heading", { name: "Restore FillNest Data" })).toBeVisible();
    await expect(sidePanel.getByText("Recommended:")).toBeVisible();

    const restoreConfirmBtn = sidePanel.getByRole("button", { name: "Restore Data" });
    // Export remains available as a recommendation, not a Restore gate.
    const safetyDownloadPromise = sidePanel.waitForEvent("download");
    await sidePanel.getByRole("button", { name: "Export current backup" }).click();
    await safetyDownloadPromise;

    // Type confirmation
    const confirmationInput = sidePanel.locator("#restore-confirmation-input");
    await confirmationInput.fill("wrong");
    await expect(restoreConfirmBtn).toBeDisabled();

    await confirmationInput.fill("restore");
    await expect(restoreConfirmBtn).toBeEnabled();

    // Confirm restore
    await restoreConfirmBtn.click();
    await expect(sidePanel.getByRole("dialog")).toHaveCount(0);
    await expect(sidePanel.getByText("Backup successfully restored.")).toBeVisible();

    // 6. Verify restored state completely
    await sidePanel.getByRole("button", { name: "Templates", exact: true }).click();
    await sidePanel.getByRole("button", { name: "All templates", exact: true }).click();
    await expect(sidePanel.getByText("Original Alpha Template")).toBeVisible();
    await expect(sidePanel.getByText("Original Beta Template")).toBeVisible();
    await expect(sidePanel.getByText("New Divergent Gamma Template")).toHaveCount(0);

    // Verify restored profile, binding, identityKeys, and picker position via repository read
    const stateResult = await sendRuntimeRequest(extensionPage, { type: "READ_STATE" });
    expect(stateResult.ok).toBe(true);
    const restoredState = stateResult.value as Record<string, unknown>;
    expect(restoredState.pickerPosition).toEqual({ top: 180, left: 320 });
    const pageProfiles = restoredState.pageProfiles as Array<Record<string, unknown>>;
    expect(pageProfiles[0]?.identityKey).toBe("login-page-key");
    expect(pageProfiles[0]?.userAlias).toBe("User Login Page");
    const fieldProfiles = restoredState.fieldProfiles as Array<Record<string, unknown>>;
    expect(fieldProfiles[0]?.identityKey).toBe("username-input-key");
    expect(fieldProfiles[0]?.userAlias).toBe("User Email Input");
  } finally {
    if (context) await context.close();
    await rm(userDataDir, { recursive: true, force: true });
    await rm(extensionBaseDir, { recursive: true, force: true });
  }
});

test("Backup and Restore: Rejects corrupted/invalid backup file without opening restore sheet", async () => {
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

    const sidePanel = await context.newPage();
    await sidePanel.goto(`chrome-extension://${extensionId}/side-panel.html`);

    await sidePanel.getByRole("button", { name: "Settings" }).click();

    // Create a corrupted backup file
    const corruptedFilePath = join(userDataDir, "corrupted-backup.json");
    await cp(resolve("package.json"), corruptedFilePath);

    // Upload corrupted file
    await sidePanel.locator("#restore-file-input").setInputFiles(corruptedFilePath);

    // Verify error banner is displayed and restore dialog is NOT opened
    await expect(sidePanel.getByRole("dialog")).toHaveCount(0);
    await expect(sidePanel.locator(".panel-error")).toBeVisible();
  } finally {
    if (context) await context.close();
    await rm(userDataDir, { recursive: true, force: true });
    await rm(extensionBaseDir, { recursive: true, force: true });
  }
});

async function extensionWorker(context: BrowserContext): Promise<Worker> {
  const existing = context.serviceWorkers()[0];
  if (existing) return existing;
  return context.waitForEvent("serviceworker");
}

async function openExtensionPage(context: BrowserContext, extensionId: string): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/side-panel.html`);
  return page;
}

async function sendRuntimeRequest(
  page: Page,
  message: Record<string, unknown>,
): Promise<RuntimeHarnessResponse> {
  return page.evaluate(async (payload) => {
    return new Promise<RuntimeHarnessResponse>((resolvePromise) => {
      chrome.runtime.sendMessage(payload, (response: RuntimeHarnessResponse) => {
        resolvePromise(response);
      });
    });
  }, message);
}
