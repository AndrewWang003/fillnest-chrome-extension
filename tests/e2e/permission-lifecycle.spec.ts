import { E2E_EXTENSION_BUILD_DIR } from "../helpers/extension-build";
import { cp, mkdtemp, rm } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { execFile } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

import {
  expect,
  test,
  type BrowserContext,
  type Page,
  type Worker,
} from "@playwright/test";

import {
  monitorRuntimeNetwork,
  type RuntimeNetworkMonitor,
} from "../helpers/runtime-network-allowlist";
import { launchWithPermissionHistory } from "../helpers/prime-extension-permissions";

const ACTIVE_MARKER = "data-fillnest-extension-active";
const PAGE_STATUS_MARKER = "data-fillnest-page-status";
const execFileAsync = promisify(execFile);

interface RuntimeHarnessResponse {
  ok: boolean;
  value?: unknown;
  error?: string;
}

test("exact-origin access, persistence, restart, and revocation remain closed", async () => {
  test.setTimeout(60_000);
  const primary = await startFixtureServer();
  const sibling = await startFixtureServer();
  const userDataDir = await mkdtemp(join(tmpdir(), "fillnest-playwright-"));
  const extensionBaseDir = await mkdtemp(join(tmpdir(), "fillnest-extension-"));
  const extensionPath = join(extensionBaseDir, "extension");
  await cp(resolve(E2E_EXTENSION_BUILD_DIR), extensionPath, { recursive: true });
  let context: BrowserContext | undefined;
  const networkMonitors: RuntimeNetworkMonitor[] = [];

  try {
    console.log(
      `Fixture evidence: primary=${primary.origin} pattern=${primary.pattern}; sibling=${sibling.origin} pattern=${sibling.pattern}`,
    );
    context = await launchWithPermissionHistory(userDataDir, extensionPath, [primary.pattern]);
    networkMonitors.push(
      monitorRuntimeNetwork(context, new Set([primary.origin, sibling.origin])),
    );
    let worker = await extensionWorker(context);
    const extensionId = new URL(worker.url()).host;
    let primaryPage = await context.newPage();
    await primaryPage.goto(primary.origin);
    await expectMarker(primaryPage, false);

    let extensionPage = await openExtensionPage(context, extensionId);
    expect(await sendRuntimeRequest(extensionPage, {
      type: "GET_ACTIVATION_SNAPSHOT",
      pageUrl: primary.origin,
    })).toEqual(expect.objectContaining({
      ok: true,
      value: expect.objectContaining({
        global: "paused",
        page: expect.objectContaining({ websiteAccess: true }),
      }),
    }));
    await grantOrigin(worker, extensionPage, primaryPage, primary.origin);
    const primaryPopup = await openPopupForTarget(
      context,
      worker,
      extensionId,
      primaryPage,
      "Allowed",
    );
    await expectMarker(primaryPage, true);
    await expectPageStatus(primaryPage, true);
    await expectPermissionEvidence(worker, primary.pattern, sibling.pattern);
    // Owner QA 2026-09-15: the site switch is titled "Enable on this site" and
    // named for the site it turns on.
    await expect(primaryPopup.getByText("Enable on this site")).toBeVisible();
    await expect(primaryPopup.locator("#popup-origin-toggle")).toBeChecked();
    await expect(primaryPopup.locator('svg[data-fillnest-icon="brand"]')).toHaveCount(1);
    await primaryPopup.screenshot({ path: "output/playwright/task002-popup.png" });
    await primaryPopup.getByRole("button", { name: "Open FillNest" }).click();
    await expect
      .poll(() => worker.evaluate(async () => {
        const contexts = await chrome.runtime.getContexts({ contextTypes: ["SIDE_PANEL"] });
        return contexts.some((context) => context.documentUrl?.endsWith("/side-panel.html"));
      }))
      .toBe(true);
    const sidePanelVisual = await context.newPage();
    await sidePanelVisual.goto(`chrome-extension://${extensionId}/side-panel.html`);
    await expect(sidePanelVisual.getByRole("heading", { name: "Overview" })).toBeVisible();
    await sidePanelVisual.screenshot({ path: "output/playwright/task002-side-panel.png" });
    await sidePanelVisual.close();
    await primaryPage
      .locator(`html > [${PAGE_STATUS_MARKER}]`)
      .screenshot({ path: "output/playwright/task002-page-status.png" });

    await primaryPage.reload();
    await expectMarker(primaryPage, true);
    await primaryPage.goto(sibling.origin);
    await expectMarker(primaryPage, false);
    await primaryPage.goBack();
    await expectMarker(primaryPage, true);

    const newPrimaryTab = await context.newPage();
    await newPrimaryTab.goto(primary.origin);
    await expectMarker(newPrimaryTab, true);

    expect(
      await sendRuntimeRequest(extensionPage, {
        type: "SET_ORIGIN_ACTIVATION",
        origin: primary.origin,
        mode: "paused",
      }),
    ).toEqual(expect.objectContaining({ ok: true }));
    await expectMarker(primaryPage, false);
    await expectMarker(newPrimaryTab, false);
    await expectPageStatus(primaryPage, true);
    await expectPageStatus(newPrimaryTab, true);
    await primaryPage.reload();
    await expectMarker(primaryPage, false);
    expect(
      await sendRuntimeRequest(extensionPage, {
        type: "SET_ORIGIN_ACTIVATION",
        origin: primary.origin,
        mode: "active",
      }),
    ).toEqual(expect.objectContaining({ ok: true }));
    await expectMarker(primaryPage, true);
    await expectMarker(newPrimaryTab, true);
    await expectPageStatus(primaryPage, true);

    const created = await sendRuntimeRequest(extensionPage, {
      type: "CREATE_TEMPLATE",
      content: "Jordan Lee",
      pageUrl: primary.origin,
    });
    expect(created.ok).toBe(true);
    const createdId =
      created.value && typeof created.value === "object" && "id" in created.value
        ? created.value.id
        : undefined;
    expect(createdId).toEqual(expect.any(String));
    const preRestartState = await sendRuntimeRequest(extensionPage, { type: "READ_STATE" });
    expect(preRestartState).toEqual(
      expect.objectContaining({
        ok: true,
        value: expect.objectContaining({
          schemaVersion: 13,
          compatibilityPairDecisions: [],
          templates: [
            expect.objectContaining({
              id: expect.any(String),
              content: "Jordan Lee",
              siteAffinities: ["127.0.0.1"],
            }),
          ],
        }),
      }),
    );

    await worker.evaluate(async (origin) => {
      const stored = await chrome.storage.local.get("fillnestActivation");
      const state = stored.fillnestActivation as {
        schemaVersion: 1;
        global: "active" | "paused";
        origins: Array<{ origin: string; mode: "active" | "paused" }>;
      };
      await chrome.storage.local.set({
        fillnestActivation: {
          ...state,
          origins: [...state.origins, { origin, mode: "paused" }],
        },
      });
    }, sibling.origin);

    await context.close();
    context = await launchWithPermissionHistory(userDataDir, extensionPath, [primary.pattern, sibling.pattern]);
    networkMonitors.push(
      monitorRuntimeNetwork(context, new Set([primary.origin, sibling.origin])),
    );
    worker = await extensionWorker(context);
    await expect
      .poll(async () =>
        (await worker.evaluate(async () => chrome.scripting.getRegisteredContentScripts()))
          .some((registration) => registration.matches?.includes(primary.pattern)),
      )
      .toBe(true);
    primaryPage = await context.newPage();
    await primaryPage.goto(primary.origin);
    extensionPage = await openExtensionPage(context, extensionId);
    expect(await sendRuntimeRequest(extensionPage, {
      type: "GET_ACTIVATION_SNAPSHOT",
      pageUrl: primary.origin,
    })).toEqual(expect.objectContaining({
      ok: true,
      value: expect.objectContaining({
        global: "active",
        page: expect.objectContaining({ originActivation: "active" }),
      }),
    }));
    await expectMarker(primaryPage, true);
    await expectPermissionEvidence(worker, primary.pattern, sibling.pattern, true);

    const postRestartState = await sendRuntimeRequest(extensionPage, { type: "READ_STATE" });
    expect(postRestartState).toEqual(preRestartState);
    console.log(`Restart evidence: pre/post Template ID=${String(createdId)}`);

    const secondPrimaryPage = await context.newPage();
    await secondPrimaryPage.goto(primary.origin);
    await expectMarker(secondPrimaryPage, true);
    const siblingPage = await context.newPage();
    await siblingPage.goto(sibling.origin);
    await expectMarker(siblingPage, false);
    await grantOrigin(worker, extensionPage, siblingPage, sibling.origin);
    await expectMarker(siblingPage, true);

    expect(
      await sendRuntimeRequest(extensionPage, {
        type: "SET_GLOBAL_ACTIVATION",
        mode: "paused",
      }),
    ).toEqual(expect.objectContaining({ ok: true }));
    await expectMarker(primaryPage, false);
    await expectMarker(secondPrimaryPage, false);
    await expectMarker(siblingPage, false);
    await expectPageStatus(primaryPage, false);
    await expectPageStatus(siblingPage, false);
    expect(
      await sendRuntimeRequest(extensionPage, {
        type: "SET_GLOBAL_ACTIVATION",
        mode: "active",
      }),
    ).toEqual(expect.objectContaining({ ok: true }));
    await expectMarker(primaryPage, true);
    await expectMarker(secondPrimaryPage, true);
    await expectMarker(siblingPage, true);
    await expectPageStatus(siblingPage, true);

    await siblingPage.evaluate((marker) => {
      const host = document.querySelector<HTMLElement>(`[${marker}]`);
      host?.shadowRoot?.querySelector<HTMLButtonElement>("button")?.click();
    }, PAGE_STATUS_MARKER);
    await expectMarker(siblingPage, true);
    await siblingPage
      .locator(`[${PAGE_STATUS_MARKER}]`)
      .getByRole("button", { name: "Pause on this site" })
      .click();
    await expectMarker(siblingPage, false);
    await siblingPage
      .locator(`[${PAGE_STATUS_MARKER}]`)
      .getByRole("button", { name: "Active on this site" })
      .click();
    await expectMarker(siblingPage, true);

    const siblingPopup = await openPopupForTarget(
      context,
      worker,
      extensionId,
      siblingPage,
      "Allowed",
    );

    const externalRemoval = await removePermissionExternally(
      extensionPage,
      primary.pattern,
    );
    expect(externalRemoval).toBe(true);
    await expectMarker(primaryPage, false);
    await expectMarker(secondPrimaryPage, false);
    await expectMarker(siblingPage, true);
    await expectPageStatus(primaryPage, false);
    await expectPageStatus(siblingPage, true);

    const postRevocationEvidence = await worker.evaluate(
      async ({ removedPattern, retainedPattern }) => ({
        removedGranted: await chrome.permissions.contains({ origins: [removedPattern] }),
        retainedGranted: await chrome.permissions.contains({ origins: [retainedPattern] }),
        registrations: await chrome.scripting.getRegisteredContentScripts(),
      }),
      { removedPattern: primary.pattern, retainedPattern: sibling.pattern },
    );
    expect(postRevocationEvidence.removedGranted).toBe(false);
    expect(postRevocationEvidence.retainedGranted).toBe(true);
    expect(postRevocationEvidence.registrations).toEqual([
      expect.objectContaining({ matches: [sibling.pattern] }),
    ]);

    await primaryPage.reload();
    await expectMarker(primaryPage, false);
    expect(await sendRuntimeRequest(extensionPage, { type: "READ_STATE" })).toEqual(
      preRestartState,
    );

    await siblingPopup.locator('label[for="popup-origin-toggle"]').click();
    await expectMarker(siblingPage, false);
    await expectPageStatus(siblingPage, true);
    expect(networkMonitors.flatMap((monitor) => monitor.violations)).toEqual([]);
    console.log(
      `Runtime network evidence: ${networkMonitors.flatMap((monitor) => monitor.requests).length} allowed Fixture Origin requests; 0 violations`,
    );
    await siblingPage
      .locator(`[${PAGE_STATUS_MARKER}]`)
      .getByRole("button", { name: "Active on this site" })
      .click();
    await expectMarker(siblingPage, true);
    await siblingPage
      .locator(`[${PAGE_STATUS_MARKER}]`)
      .getByRole("button", { name: "Pause on this site" })
      .click();
    await expectMarker(siblingPage, false);
  } finally {
    await context?.close();
    await stopFixtureServer(primary.server);
    await stopFixtureServer(sibling.server);
    await rm(userDataDir, { recursive: true, force: true });
    await rm(extensionBaseDir, { recursive: true, force: true });
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

async function openPopupForTarget(
  context: BrowserContext,
  worker: Worker,
  extensionId: string,
  targetPage: Page,
  expectedStatus: "Allowed" | "Not authorized",
): Promise<Page> {
  const popupPage = await context.newPage();
  await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
  const popupTabId = await worker.evaluate(async () => {
    const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    return activeTab?.id;
  });
  if (popupTabId === undefined) throw new Error("Popup tab ID is unavailable");

  await targetPage.bringToFront();
  await worker.evaluate(async (tabId) => chrome.tabs.reload(tabId), popupTabId);
  // Owner QA 2026-09-15: an allowed site shows its own switch; one that is not
  // shows Allow access.
  if (expectedStatus === "Allowed") await expect(popupPage.locator("#popup-origin-toggle")).toBeAttached();
  else await expect(popupPage.getByRole("button", { name: /^Allow access to / })).toBeVisible();
  return popupPage;
}

async function grantOrigin(
  worker: Worker,
  extensionPage: Page,
  targetPage: Page,
  pageUrl: string,
): Promise<void> {
  const globalActivation = await sendRuntimeRequest(extensionPage, {
    type: "SET_GLOBAL_ACTIVATION",
    mode: "active",
  });
  expect(globalActivation).toEqual(expect.objectContaining({ ok: true }));
  await targetPage.bringToFront();
  const tabId = await worker.evaluate(async () => {
    const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    return activeTab?.id;
  });
  if (tabId === undefined) throw new Error("Active Fixture tab ID is unavailable");

  const result = await sendRuntimeRequest(extensionPage, {
    type: "ENABLE_SITE",
    pageUrl,
    tabId,
  });
  expect(result).toEqual({
    ok: true,
    value: expect.objectContaining({ status: "active" }),
  });
}

async function sendRuntimeRequest(
  extensionPage: Page,
  request: Record<string, unknown>,
): Promise<RuntimeHarnessResponse> {
  await extensionPage.evaluate(
    (message) => {
      document.querySelector("#browser-harness")?.remove();
      document.documentElement.removeAttribute("data-browser-result");
      const button = document.createElement("button");
      button.id = "browser-harness";
      button.textContent = "Run browser operation";
      button.addEventListener("click", () => {
        void chrome.runtime.sendMessage(message).then((result) =>
          document.documentElement.setAttribute(
            "data-browser-result",
            JSON.stringify(result),
          ),
        );
      });
      document.body.append(button);
    },
    request,
  );
  await extensionPage.bringToFront();
  await extensionPage.getByRole("button", { name: "Run browser operation" }).click();
  await expect
    .poll(async () => {
      const result = await extensionPage.getAttribute("html", "data-browser-result");
      if (result === null && request.type === "ENABLE_SITE") {
        await allowMacOsPermissionSheet();
      }
      return result;
    }, { timeout: 30_000 })
    .not.toBeNull();
  const serialized = await extensionPage.getAttribute("html", "data-browser-result");
  return JSON.parse(serialized ?? "null") as RuntimeHarnessResponse;
}

async function allowMacOsPermissionSheet(): Promise<void> {
  if (process.platform !== "darwin") return;
  try {
    await execFileAsync("osascript", [
      "-e",
      'tell application "System Events"',
      "-e",
      'tell process "Google Chrome for Testing"',
      "-e",
      'click button 2 of group 2 of group 2 of group 1 of group 1 of group 1 of sheet 1 of window 1',
      "-e",
      "end tell",
      "-e",
      "end tell",
    ]);
  } catch {
    // The condition poll retries until Chrome presents the permission sheet.
  }
}

async function removePermissionExternally(
  extensionPage: Page,
  pattern: string,
): Promise<boolean> {
  await extensionPage.evaluate((permissionPattern) => {
    document.querySelector("#browser-harness")?.remove();
    document.documentElement.removeAttribute("data-browser-result");
    const button = document.createElement("button");
    button.id = "browser-harness";
    button.textContent = "Remove permission externally";
    button.addEventListener("click", () => {
      void chrome.permissions
        .remove({ origins: [permissionPattern] })
        .then((result) =>
          document.documentElement.setAttribute(
            "data-browser-result",
            JSON.stringify(result),
          ),
        );
    });
    document.body.append(button);
  }, pattern);
  await extensionPage
    .getByRole("button", { name: "Remove permission externally" })
    .click();
  await expect
    .poll(() => extensionPage.getAttribute("html", "data-browser-result"))
    .not.toBeNull();
  return JSON.parse(
    (await extensionPage.getAttribute("html", "data-browser-result")) ?? "false",
  ) as boolean;
}

async function expectMarker(page: Page, active: boolean): Promise<void> {
  await expect
    .poll(() => page.locator(`html[${ACTIVE_MARKER}]`).count())
    .toBe(active ? 1 : 0);
}

async function expectPageStatus(page: Page, visible: boolean): Promise<void> {
  await expect
    .poll(() => page.locator(`html > [${PAGE_STATUS_MARKER}]`).count())
    .toBe(visible ? 1 : 0);
  if (visible) {
    const host = page.locator(`html > [${PAGE_STATUS_MARKER}]`);
    await expect(host.locator('svg[data-fillnest-icon="page-status"]')).toHaveCount(1);
    // Task 034 follow-up: this control's stylesheet was the one the theme did
    // not reach, so it stayed light under every theme. Its host is themed the
    // same way the Picker's is - inline custom properties written by the
    // content script - and the control resolves its fill through them.
    await expect
      .poll(() => host.evaluate((element) => (element as HTMLElement).style.getPropertyValue("--fn-accent")))
      .toBe("#3157d5");
    await expect
      .poll(() => host.evaluate((element) => (element as HTMLElement).dataset["fnMode"]))
      .toBe("light");
  }
}

async function expectPermissionEvidence(
  worker: Worker,
  grantedPattern: string,
  deniedPattern: string,
  deniedPermissionGranted = false,
): Promise<void> {
  const evidence = await worker.evaluate(
    async ({ grantedPattern: granted, deniedPattern: denied }) => ({
      granted: await chrome.permissions.contains({ origins: [granted] }),
      denied: await chrome.permissions.contains({ origins: [denied] }),
      registrations: await chrome.scripting.getRegisteredContentScripts(),
    }),
    { grantedPattern, deniedPattern },
  );
  expect(evidence.granted).toBe(true);
  expect(evidence.denied).toBe(deniedPermissionGranted);
  expect(evidence.registrations).toEqual(
    (deniedPermissionGranted ? [grantedPattern, deniedPattern] : [grantedPattern]).map(
      (pattern) => expect.objectContaining({
        matches: [pattern],
        persistAcrossSessions: true,
      }),
    ),
  );
}

async function startFixtureServer(): Promise<{
  server: Server;
  origin: string;
  pattern: string;
}> {
  const server = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end("<!doctype html><html><body><h1>FillNest fixture</h1></body></html>");
  });
  await new Promise<void>((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Fixture port unavailable");

  const origin = `http://127.0.0.1:${address.port}`;
  return { server, origin, pattern: `${origin}/*` };
}

async function stopFixtureServer(server: Server): Promise<void> {
  await new Promise<void>((resolveClose, reject) =>
    server.close((error) => (error ? reject(error) : resolveClose())),
  );
}
