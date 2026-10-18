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

// Covers the Site-management "Stop matching" action added for Task 020: a
// confirmed Logical Page Matching rule must be visible and removable from a
// real, built extension's Sites page, and removing it must leave the
// canonical Field's own Binding untouched. The precondition rule is seeded
// directly into storage (its correctness is already covered end-to-end by
// the repository/message-contract unit tests) so this test can focus on
// proving the Sites page UI itself.
test("Sites page lists a confirmed Logical Page Matching rule and Stop matching removes only the rule", async () => {
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

    const bound = await sendRuntimeRequest(extensionPage, {
      type: "CREATE_TEMPLATE_AND_BIND",
      content: "Support reply",
      pageUrl: fixture.origin,
      pageProfileId: "page-1",
      fieldProfileId: "field-1",
    });
    expect(bound.ok).toBe(true);

    const siteId = new URL(fixture.origin).hostname;

    // Seed a confirmed Rule directly into storage: the Review/Confirm flow
    // that produces one in real use is already covered by unit and
    // component tests, so this focuses purely on Sites page behaviour.
    await worker.evaluate(
      async ({ siteId, origin }) => {
        const stored = await chrome.storage.local.get("fillnestState");
        const state = stored.fillnestState as Record<string, unknown>;
        state.logicalPageSiteKeys = [
          { id: "site-key-1", siteId, encodedHmacKey: "hmac-sha256-v1:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" },
        ];
        state.logicalPageRules = [
          {
            id: "rule-1",
            siteId,
            siteKeyId: "site-key-1",
            origin,
            routePattern: "/customers/:number",
            fieldFeatureHashes: ["a".repeat(64)],
            groupedFieldFeatureHashes: ["b".repeat(64)],
            pageProfileId: "page-1",
          },
        ];
        await chrome.storage.local.set({ fillnestState: state });
      },
      { siteId, origin: fixture.origin },
    );

    const sidePanel = await context.newPage();
    await sidePanel.goto(`chrome-extension://${extensionId}/side-panel.html`);
    await sidePanel.getByRole("button", { name: "Sites" }).click();
    await sidePanel.locator(".tree-node", { hasText: siteId }).locator(".tree-chevron").click();

    await expect(sidePanel.getByText(`${fixture.origin}/customers/:number`)).toBeVisible();
    await sidePanel.getByRole("button", { name: "Stop matching" }).click();
    await expect(sidePanel.getByText("Stop matching this page?")).toBeVisible();
    await sidePanel.locator(".clean-up-sheet").getByRole("button", { name: "Stop matching" }).click();

    await expect(sidePanel.getByText("Stopped matching")).toBeVisible();
    await expect(sidePanel.locator(".logical-page-rule-row")).toHaveCount(0);

    const state = await sendRuntimeRequest(extensionPage, { type: "READ_STATE" });
    expect(state).toEqual(
      expect.objectContaining({
        ok: true,
        value: expect.objectContaining({
          logicalPageRules: [],
          bindings: [expect.objectContaining({ pageProfileId: "page-1", fieldProfileId: "field-1" })],
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
