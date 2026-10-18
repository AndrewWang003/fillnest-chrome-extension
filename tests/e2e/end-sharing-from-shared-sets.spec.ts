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

// Task 021 Addendum B, the owner's Chinese QA of 2026-09-11, and Task 040.
// End sharing - distinct from the automatic end a member's leaving causes,
// which shared-template-sets-management.spec.ts covers - must end the Set,
// close its dialog and report the result, in each language, from the
// Templates page's Shared Sets tab.
for (const language of ["en", "zh-Hans"] as const) {
  test(`End sharing from the Shared Sets tab ends the Set and closes its dialog (${language})`, async () => {
    test.setTimeout(60_000);
    const fixture = await startFixtureServer();
    const userDataDir = await mkdtemp(join(tmpdir(), "fillnest-playwright-"));
    const extensionBaseDir = await mkdtemp(join(tmpdir(), "fillnest-extension-"));
    const extensionPath = join(extensionBaseDir, "extension");
    await cp(resolve(E2E_EXTENSION_BUILD_DIR), extensionPath, { recursive: true });
    const pattern = `${fixture.origin}/*`;
    let context: BrowserContext | undefined;
    const words = language === "en"
      ? { templates: "Templates", tab: "Shared Sets", expand: 'Expand "Contact fields"', end: "End sharing", ended: /Ended "Contact fields"/ }
      : { templates: "模版", tab: "共享模版组", expand: "展开「Contact fields」", end: "结束共享", ended: /已结束「Contact fields」/ };

    try {
      context = await launchWithPermissionHistory(userDataDir, extensionPath, [pattern]);
      const worker = await extensionWorker(context);
      const extensionId = new URL(worker.url()).host;
      const extensionPage = await openExtensionPage(context, extensionId);
      expect(await sendRuntimeRequest(extensionPage, { type: "SET_LANGUAGE", language })).toEqual(
        expect.objectContaining({ ok: true }),
      );
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
      for (const [field, page] of [["field-1", "page-1"], ["field-2", "page-2"]] as const) {
        expect(
          (await sendRuntimeRequest(extensionPage, {
            type: "CREATE_TEMPLATE_AND_BIND",
            content: `Own ${field}`,
            pageUrl: `${fixture.origin}/${page}`,
            pageProfileId: page,
            fieldProfileId: field,
          })).ok,
        ).toBe(true);
      }
      const created = await sendRuntimeRequest(extensionPage, {
        type: "CREATE_SHARED_TEMPLATE_SET",
        fieldProfileIds: ["field-1", "field-2"],
      });
      expect(created.ok).toBe(true);
      const setId = (created.value as { set: { id: string } }).set.id;
      await sendRuntimeRequest(extensionPage, { type: "RENAME_SHARED_TEMPLATE_SET", setId, name: "Contact fields" });

      const sidePanel = await context.newPage();
      const errors: string[] = [];
      sidePanel.on("pageerror", (error) => errors.push(error.message));
      await sidePanel.goto(`chrome-extension://${extensionId}/side-panel.html`);
      await sidePanel.getByRole("button", { name: words.templates, exact: true }).click();
      await sidePanel.getByRole("button", { name: words.tab, exact: true }).click();
      await expect(sidePanel.getByText("Contact fields")).toBeVisible();
      await sidePanel.getByRole("button", { name: words.expand }).click();

      await sidePanel.getByRole("button", { name: words.end, exact: true }).click();
      const dialog = sidePanel.getByRole("dialog", { name: words.end });
      await expect(dialog).toBeVisible();
      await dialog.getByRole("button", { name: words.end, exact: true }).click();

      await expect(dialog).toHaveCount(0);
      await expect(sidePanel.getByText(words.ended)).toBeVisible();
      await expect(sidePanel.locator(".panel-error")).toHaveCount(0);
      expect(errors).toEqual([]);
      const state = await sendRuntimeRequest(extensionPage, { type: "READ_STATE" });
      expect((state.value as { sharedTemplateSets: unknown[] }).sharedTemplateSets).toEqual([]);
    } finally {
      await context?.close();
      await rm(userDataDir, { recursive: true, force: true });
      await rm(extensionBaseDir, { recursive: true, force: true });
      await stopFixtureServer(fixture.server);
    }
  });
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
