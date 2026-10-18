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
    <input id="email" type="email" />
  </body>
</html>`;

test("Fields view tracks the current browser tab live (no Side Panel reload needed), and ranks a Field's options by that Field's own usage", async () => {
  test.setTimeout(60_000);
  const primary = await startFixtureServer();
  const other = await startFixtureServer();
  const userDataDir = await mkdtemp(join(tmpdir(), "fillnest-playwright-"));
  const extensionBaseDir = await mkdtemp(join(tmpdir(), "fillnest-extension-"));
  const extensionPath = join(extensionBaseDir, "extension");
  await cp(resolve(E2E_EXTENSION_BUILD_DIR), extensionPath, { recursive: true });
  const primaryPattern = `${primary.origin}/*`;
  let context: BrowserContext | undefined;

  try {
    context = await launchWithPermissionHistory(userDataDir, extensionPath, [primaryPattern]);
    const worker = await extensionWorker(context);
    const extensionId = new URL(worker.url()).host;
    const extensionPage = await openExtensionPage(context, extensionId);

    expect(
      await sendRuntimeRequest(extensionPage, { type: "SET_GLOBAL_ACTIVATION", mode: "active" }),
    ).toEqual(expect.objectContaining({ ok: true }));

    // pageIdentityKey must match what buildPageIdentityKey actually derives
    // from the real browser URL (root path -> "/") so the "This tab"
    // scope's Page lookup in the Side Panel can find this Page Profile once
    // the real fixture tab becomes active.
    const first = await sendRuntimeRequest(extensionPage, {
      type: "CREATE_TEMPLATE_AND_BIND",
      content: "First option",
      pageUrl: primary.origin,
      pageProfileId: "page-1",
      fieldProfileId: "field-1",
      pageIdentityKey: "/",
      fieldIdentityKey: JSON.stringify({ semanticKind: "email" }),
    });
    expect(first.ok).toBe(true);
    const second = await sendRuntimeRequest(extensionPage, {
      type: "CREATE_TEMPLATE_AND_BIND",
      content: "Second option",
      pageUrl: primary.origin,
      pageProfileId: "page-1",
      fieldProfileId: "field-1",
      pageIdentityKey: "/",
      fieldIdentityKey: JSON.stringify({ semanticKind: "email" }),
    });
    expect(second.ok).toBe(true);

    // Start on an unrelated tab (not the fixture) so the Side Panel opens
    // with "This tab" resolving to nothing.
    const otherTab = await context.newPage();
    await otherTab.goto(other.origin);
    await otherTab.bringToFront();

    const sidePanel = await context.newPage();
    await sidePanel.setViewportSize({ width: 380, height: 700 });
    await sidePanel.goto(`chrome-extension://${extensionId}/side-panel.html`);
    await sidePanel.getByRole("button", { name: "Templates" }).click();
    await expect(sidePanel.getByText("No Fields with saved Templates on this page yet.")).toBeVisible();

    // Switch the active tab to the real fixture page, without touching the
    // Side Panel itself - it must pick this up live.
    const primaryTab = await context.newPage();
    await primaryTab.goto(primary.origin);
    await primaryTab.bringToFront();
    await expect(sidePanel.getByText("Email", { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(sidePanel.getByText("No Fields with saved Templates on this page yet.")).toHaveCount(0);

    await sidePanel.getByRole("button", { name: /^Expand /u }).click();
    await expect(sidePanel.getByText("First option")).toBeVisible();
    await expect(sidePanel.getByText("Second option")).toBeVisible();
    const firstRank = sidePanel.locator(".field-first-option", { hasText: "First option" }).locator(".field-first-rank");
    const secondRank = sidePanel.locator(".field-first-option", { hasText: "Second option" }).locator(".field-first-rank");
    await expect(firstRank).toHaveText("1");
    await expect(secondRank).toHaveText("2");

    // A Field's list is ranked by that Field's own usage, not by the order
    // things were bound in and not by the Template's total across every Field.
    // Manual drag-to-reorder was removed on 2026-09-07 by owner decision.
    const secondTemplateId = (second.value as { template: { id: string } }).template.id;
    expect(
      (await sendRuntimeRequest(extensionPage, {
        type: "RECORD_INSERTION",
        templateId: secondTemplateId,
        fieldProfileId: "field-1",
      })).ok,
    ).toBe(true);

    // The harness fronts the extension page to send that request, and this
    // view follows the active tab - put the fixture back in front before
    // asserting what the view shows for it.
    await primaryTab.bringToFront();

    await expect
      .poll(async () => sidePanel.locator(".field-first-option").first().textContent(), { timeout: 10_000 })
      .toContain("Second option");
    await expect(secondRank).toHaveText("1");
    await expect(firstRank).toHaveText("2");
    await sidePanel.screenshot({ path: "output/playwright/task-design-7a-field-first-reordered.png", fullPage: true });

    const state = await sendRuntimeRequest(extensionPage, { type: "READ_STATE" });
    const value = state.value as { bindings: Array<{ templateId: string; usageCount: number }> };
    const firstTemplateId = (first.value as { template: { id: string } }).template.id;
    expect(value.bindings.find((b) => b.templateId === secondTemplateId)?.usageCount).toBe(1);
    expect(value.bindings.find((b) => b.templateId === firstTemplateId)?.usageCount).toBe(0);
  } finally {
    await context?.close();
    await rm(userDataDir, { recursive: true, force: true });
    await rm(extensionBaseDir, { recursive: true, force: true });
    await stopFixtureServer(primary.server);
    await stopFixtureServer(other.server);
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
