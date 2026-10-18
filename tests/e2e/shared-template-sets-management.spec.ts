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
    <input id="notes-field" type="text" autocomplete="notes" />
  </body>
</html>`;

// Task 040 slice 3: a Shared Template Set is managed from the Templates
// page's Shared Sets tab of a real, built extension - rename the Set, Leave
// sharing for a member (with its dialog's focus lifecycle, result and Undo).
// The Set is seeded directly into storage; its creation is covered by the
// repository, message-contract and Picker tests.
test("the Shared Sets tab renames a Set and runs Leave sharing with its dialog, result and Undo", async () => {
  test.setTimeout(60_000);
  const fixture = await startFixtureServer();
  const userDataDir = await mkdtemp(join(tmpdir(), "fillnest-playwright-"));
  const extensionBaseDir = await mkdtemp(join(tmpdir(), "fillnest-extension-"));
  const extensionPath = join(extensionBaseDir, "extension");
  await cp(resolve(E2E_EXTENSION_BUILD_DIR), extensionPath, { recursive: true });
  const pattern = `${fixture.origin}/*`;
  let context: BrowserContext | undefined;

  try {
    context = await launchWithPermissionHistory(userDataDir, extensionPath, [pattern]);
    const worker = await extensionWorker(context);
    const extensionId = new URL(worker.url()).host;
    const extensionPage = await openExtensionPage(context, extensionId);

    expect(
      await sendRuntimeRequest(extensionPage, { type: "SET_GLOBAL_ACTIVATION", mode: "active" }),
    ).toEqual(expect.objectContaining({ ok: true }));

    const tab = await context.newPage();
    await tab.goto(fixture.origin);
    await tab.bringToFront();
    const tabId = await worker.evaluate(async () => {
      const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      return activeTab?.id;
    });
    if (tabId === undefined) throw new Error("Active Fixture tab ID is unavailable");
    expect(
      await sendRuntimeRequest(extensionPage, { type: "ENABLE_SITE", pageUrl: fixture.origin, tabId }),
    ).toEqual({ ok: true, value: expect.objectContaining({ status: "active" }) });

    const siteId = new URL(fixture.origin).hostname;

    // Create page-1/field-1 through the real Bind flow first, exactly like
    // the Logical Page Matching precedent - a Shared Template Set can only
    // reference Field/Page Profiles that already exist.
    const bound = await sendRuntimeRequest(extensionPage, {
      type: "CREATE_TEMPLATE_AND_BIND",
      content: "Direct binding, becomes dormant while shared",
      pageUrl: fixture.origin,
      pageProfileId: "page-1",
      fieldProfileId: "field-1",
    });
    expect(bound.ok).toBe(true);

    // Seed a Shared Template Set with two members and one Template directly
    // into storage: field-1/page-1 is the real recognized Field just bound
    // above, field-2/page-2 is a second reliably identified Field the set
    // shares its Template list with.
    await worker.evaluate(
      async ({ siteId }) => {
        const stored = await chrome.storage.local.get("fillnestState");
        const state = stored.fillnestState as Record<string, unknown>;
        const pageProfiles = (state.pageProfiles as Array<Record<string, unknown>>) ?? [];
        const fieldProfiles = (state.fieldProfiles as Array<Record<string, unknown>>) ?? [];
        pageProfiles.push({ id: "page-2", siteId, identityKey: "/billing" });
        fieldProfiles.push({ id: "field-2", pageProfileId: "page-2", observedTitle: "Billing email" });
        state.pageProfiles = pageProfiles;
        state.fieldProfiles = fieldProfiles;
        state.templates = [
          ...(state.templates as Array<Record<string, unknown>>),
          {
            id: "template-shared",
            content: "Thanks for reaching out",
            siteAffinities: [siteId],
            createdAt: "2026-09-02T00:00:00.000Z",
            updatedAt: "2026-09-02T00:00:00.000Z",
            totalUsageCount: 0,
            revision: 0,
          },
        ];
        state.sharedTemplateSets = [
          { id: "set-1", siteId, name: "Contact fields", memberFieldProfileIds: ["field-1", "field-2"] },
        ];
        state.sharedTemplateBindings = [
          { id: "shared-binding-1", setId: "set-1", templateId: "template-shared", usageCount: 0, revision: 0, order: 0 },
        ];
        await chrome.storage.local.set({ fillnestState: state });
      },
      { siteId },
    );

    const sidePanel = await context.newPage();
    await sidePanel.goto(`chrome-extension://${extensionId}/side-panel.html`);
    await sidePanel.getByRole("button", { name: "Templates", exact: true }).click();
    await sidePanel.getByRole("button", { name: "Shared Sets", exact: true }).click();

    await expect(sidePanel.getByText("Contact fields")).toBeVisible();
    await expect(sidePanel.getByText("2 fields · 1 Template · 1 Site")).toBeVisible();
    await sidePanel.getByRole("button", { name: 'Expand "Contact fields"' }).click();
    await expect(sidePanel.getByText("Billing email")).toBeVisible();
    await expect(sidePanel.locator(".shared-set-templates")).toHaveText("Thanks for reaching out");
    await expect(sidePanel.getByText(`${siteId} › Billing`)).toBeVisible();

    // Rename.
    await sidePanel.getByRole("button", { name: "Rename Set Contact fields" }).click();
    const renameInput = sidePanel.getByRole("textbox", { name: "Name for Contact fields" });
    await renameInput.fill("Household bills");
    await sidePanel.getByRole("button", { name: "Save", exact: true }).click();
    await expect(sidePanel.getByText("Household bills")).toBeVisible();

    // Leaving a two-member set ends it.
    const leaveButton = sidePanel.getByRole("button", { name: "Leave sharing for Billing email" });
    await leaveButton.click();
    const dialog = sidePanel.getByRole("dialog", { name: "Leave sharing for this field" });
    await expect(dialog).toBeVisible();
    const cancelButton = dialog.getByRole("button", { name: "Cancel" });
    const stopSharingButton = dialog.getByRole("button", { name: "Leave sharing" });
    await expect(cancelButton).toBeFocused();
    await sidePanel.keyboard.press("Tab");
    await expect(stopSharingButton).toBeFocused();
    await sidePanel.keyboard.press("Shift+Tab");
    await expect(cancelButton).toBeFocused();
    await sidePanel.keyboard.press("Shift+Tab");
    await expect(stopSharingButton).toBeFocused();
    await cancelButton.click();
    await expect(dialog).toHaveCount(0);
    await expect(leaveButton).toBeFocused();

    await leaveButton.click();
    await expect(dialog).toBeVisible();
    await expect(cancelButton).toBeFocused();
    await sidePanel.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(leaveButton).toBeFocused();

    await leaveButton.click();
    await expect(dialog).toBeVisible();
    await stopSharingButton.click();
    await expect(sidePanel.getByText(/Billing email left/)).toBeVisible();
    await expect(sidePanel.locator(".shared-template-set-row")).toHaveCount(0);
    // The tab stays usable with no Set left, and focus has somewhere to go.
    await expect(sidePanel.getByRole("button", { name: "Shared Sets", exact: true })).toBeFocused();

    const afterRemoval = await sendRuntimeRequest(extensionPage, { type: "READ_STATE" });
    expect(afterRemoval).toEqual(
      expect.objectContaining({
        ok: true,
        value: expect.objectContaining({
          sharedTemplateSets: [],
          sharedTemplateBindings: [],
          sharedTemplateFieldStates: [],
          bindings: expect.arrayContaining([
            expect.objectContaining({ fieldProfileId: "field-1", templateId: "template-shared" }),
            expect.objectContaining({ fieldProfileId: "field-2", templateId: "template-shared" }),
          ]),
        }),
      }),
    );

    // Undo brings the Set back, with its shared Template.
    await sidePanel.getByRole("button", { name: /^Undo: Billing email left sharing/ }).click();
    await expect(sidePanel.getByText("Undid Leave sharing.")).toBeVisible();
    await expect(sidePanel.locator(".shared-template-set-row")).toHaveCount(1);
    const restored = await sendRuntimeRequest(extensionPage, { type: "READ_STATE" });
    expect(restored).toEqual(
      expect.objectContaining({
        ok: true,
        value: expect.objectContaining({
          sharedTemplateSets: [expect.objectContaining({ id: "set-1", name: "Household bills", memberFieldProfileIds: ["field-1", "field-2"] })],
          sharedTemplateBindings: [expect.objectContaining({ templateId: "template-shared" })],
        }),
      }),
    );
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
