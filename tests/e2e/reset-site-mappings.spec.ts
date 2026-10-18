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

test("Clear site data atomically removes mappings and Site Affinity while preserving the Template and Website Access", async () => {
  test.setTimeout(60_000);
  const fixture = await startFixtureServer();
  const userDataDir = await mkdtemp(join(tmpdir(), "fillnest-playwright-"));
  const extensionBaseDir = await mkdtemp(join(tmpdir(), "fillnest-extension-"));
  const extensionPath = join(extensionBaseDir, "extension");
  await cp(resolve(E2E_EXTENSION_BUILD_DIR), extensionPath, { recursive: true });
  const fixturePattern = `${fixture.origin}/*`;
  let context: BrowserContext | undefined;

  try {
    context = await launchWithPermissionHistory(userDataDir, extensionPath, [fixturePattern]);
    const worker = await extensionWorker(context);
    const extensionId = new URL(worker.url()).host;
    const extensionPage = await openExtensionPage(context, extensionId);

    expect(
      await sendRuntimeRequest(extensionPage, { type: "SET_GLOBAL_ACTIVATION", mode: "active" }),
    ).toEqual(expect.objectContaining({ ok: true }));

    const bound = await sendRuntimeRequest(extensionPage, {
      type: "CREATE_TEMPLATE_AND_BIND",
      content: "Reset-mappings evidence",
      pageUrl: fixture.origin,
      pageProfileId: "page-reset-1",
      fieldProfileId: "field-reset-1",
      pageIdentityKey: "/profile",
      fieldIdentityKey: '{"semanticKind":"notes"}',
    });
    expect(bound.ok).toBe(true);
    expect(
      await sendRuntimeRequest(extensionPage, {
        type: "SET_PAGE_ALIAS",
        pageProfileId: "page-reset-1",
        alias: "Profile page",
      }),
    ).toEqual(expect.objectContaining({ ok: true }));
    expect(
      await sendRuntimeRequest(extensionPage, {
        type: "SET_FIELD_ALIAS",
        fieldProfileId: "field-reset-1",
        alias: "Notes",
      }),
    ).toEqual(expect.objectContaining({ ok: true }));

    const preResetState = await sendRuntimeRequest(extensionPage, { type: "READ_STATE" });
    expect(preResetState).toEqual(
      expect.objectContaining({
        ok: true,
        value: expect.objectContaining({
          pageProfiles: [expect.objectContaining({ id: "page-reset-1", userAlias: "Profile page" })],
          fieldProfiles: [expect.objectContaining({ id: "field-reset-1", userAlias: "Notes" })],
        }),
      }),
    );

    const sidePanel = await context.newPage();
    await sidePanel.goto(`chrome-extension://${extensionId}/side-panel.html`);
    await sidePanel.getByRole("button", { name: "Sites" }).click();
    // Sites opens on its By-site default view - switch to the flat list.
    await sidePanel.getByRole("button", { name: "All addresses" }).click();
    // Clear site data is reached by selecting an address and using the toolbar;
    // it still acts on the whole Site, which the confirmation states outright.
    const address = sidePanel.locator(".address-origin").first();
    await expect(address).toBeVisible();
    const origin = (await address.textContent())?.trim() ?? "";
    await sidePanel.getByRole("checkbox", { name: `Select ${origin}` }).check();
    await expect(sidePanel.getByText(/1 of \d+ selected/)).toBeVisible();

    await sidePanel.getByRole("button", { name: "Clear site data" }).click();
    await expect(
      sidePanel.getByText(/1 page, 1 field, and 1 binding \(including 1 page alias and 1 field alias\)/),
    ).toBeVisible();
    await expect(
      sidePanel.getByText("This covers every address of 127.0.0.1, including any you did not select."),
    ).toBeVisible();
    await sidePanel.screenshot({ path: "output/playwright/task004-slice3-reset-mappings-confirm.png" });
    await sidePanel.locator(".clean-up-sheet").getByRole("button", { name: "Confirm" }).click();

    await expect(sidePanel.getByText("1 Template is now Global. Delete it if you no longer need it.")).toBeVisible();
    // Task 023 Addendum B5 (11): a result-region action's accessible name
    // carries the result it acts on, because reached by keyboard it is the
    // only thing announced. Its visible label is still "Delete".
    const resultDelete = sidePanel.locator(".side-panel-notification-action");
    await expect(resultDelete).toBeVisible();
    await expect(resultDelete).toHaveText("Delete");
    await expect(resultDelete).toHaveAccessibleName(
      "Delete: 1 Template is now Global. Delete it if you no longer need it.",
    );

    await expect(
      sidePanel.getByText(/1 page, 1 field, and 1 binding/),
    ).toHaveCount(0, { timeout: 10_000 });

    const postResetState = await sendRuntimeRequest(extensionPage, { type: "READ_STATE" });
    expect(postResetState).toEqual(
      expect.objectContaining({
        ok: true,
        value: expect.objectContaining({
          pageProfiles: [],
          fieldProfiles: [],
          bindings: [],
          templates: [
            expect.objectContaining({
              content: "Reset-mappings evidence",
              siteAffinities: [],
            }),
          ],
        }),
      }),
    );

    const permissionStillGranted = await worker.evaluate(
      (pattern) => chrome.permissions.contains({ origins: [pattern] }),
      fixturePattern,
    );
    expect(permissionStillGranted).toBe(true);
  } finally {
    await context?.close();
    await rm(userDataDir, { recursive: true, force: true });
    await rm(extensionBaseDir, { recursive: true, force: true });
    await stopFixtureServer(fixture.server);
  }
});

test("Clear site data invalidates live Field context and cross-tab Search converges without reload", async () => {
  test.setTimeout(60_000);
  const fixture = await startFixtureServer();
  const siteTwoOrigin = fixture.origin;
  const siteOneOrigin = fixture.origin.replace("127.0.0.1", "localhost");
  const userDataDir = await mkdtemp(join(tmpdir(), "fillnest-playwright-"));
  const extensionBaseDir = await mkdtemp(join(tmpdir(), "fillnest-extension-"));
  const extensionPath = join(extensionBaseDir, "extension");
  await cp(resolve(E2E_EXTENSION_BUILD_DIR), extensionPath, { recursive: true });
  let context: BrowserContext | undefined;

  try {
    context = await launchWithPermissionHistory(userDataDir, extensionPath, [
      `${siteOneOrigin}/*`,
      `${siteTwoOrigin}/*`,
    ]);
    const worker = await extensionWorker(context);
    const extensionId = new URL(worker.url()).host;
    const extensionPage = await openExtensionPage(context, extensionId);
    expect(
      await sendRuntimeRequest(extensionPage, { type: "SET_GLOBAL_ACTIVATION", mode: "active" }),
    ).toEqual(expect.objectContaining({ ok: true }));

    const siteOne = await context.newPage();
    await siteOne.goto(siteOneOrigin);
    await siteOne.locator("#notes-field").focus();
    await siteOne.getByRole("button", { name: "Open FillNest" }).click();
    const siteOneSearch = siteOne.getByRole("searchbox", { name: "Search templates" });
    await siteOneSearch.fill("QA3 T2");

    const siteTwo = await context.newPage();
    await siteTwo.goto(siteTwoOrigin);
    await siteTwo.locator("#notes-field").focus();
    await siteTwo.getByRole("button", { name: "Open FillNest" }).click();
    await siteTwo.getByRole("button", { name: "New template" }).click();
    await siteTwo.getByRole("textbox", { name: "Template content" }).fill("Before clear");
    await siteTwo.getByRole("button", { name: "Save", exact: true }).click();

    const before = await sendRuntimeRequest(extensionPage, { type: "READ_STATE" });
    expect(before.ok).toBe(true);
    const beforeValue = before.value as { bindings: Array<{ fieldProfileId: string; templateId: string }>; templates: Array<{ id: string; content: string }> };
    const oldTemplateId = beforeValue.templates.find((template) => template.content === "Before clear")?.id;
    const oldFieldId = beforeValue.bindings.find((binding) => binding.templateId === oldTemplateId)?.fieldProfileId;
    expect(oldFieldId).toBeTruthy();

    expect(
      await sendRuntimeRequest(extensionPage, {
        type: "RESET_SITE_MAPPINGS_BATCH",
        sites: [{ siteId: new URL(siteTwoOrigin).hostname }],
      }),
    ).toEqual(expect.objectContaining({ ok: true }));

    await siteTwo.bringToFront();
    await siteTwo.locator("#notes-field").focus();
    await siteTwo.getByRole("button", { name: "Open FillNest" }).click();
    await siteTwo.getByRole("button", { name: "New template" }).click();
    await siteTwo.getByRole("textbox", { name: "Template content" }).fill("QA3 T2");
    await siteTwo.getByRole("button", { name: "Save", exact: true }).click();

    const after = await sendRuntimeRequest(extensionPage, { type: "READ_STATE" });
    expect(after.ok).toBe(true);
    const afterValue = after.value as { bindings: Array<{ fieldProfileId: string; templateId: string }>; templates: Array<{ id: string; content: string }> };
    const newTemplateId = afterValue.templates.find((template) => template.content === "QA3 T2")?.id;
    const newFieldId = afterValue.bindings.find((binding) => binding.templateId === newTemplateId)?.fieldProfileId;
    expect(newFieldId).toBeTruthy();
    expect(newFieldId).not.toBe(oldFieldId);

    await siteOne.bringToFront();
    await siteOne.getByRole("button", { name: "Open FillNest" }).click();
    await siteOne.getByRole("searchbox", { name: "Search templates" }).fill("QA3 T2");
    await expect(siteOne.getByText("QA3 T2", { exact: true })).toBeVisible({ timeout: 10_000 });
    await siteOne.keyboard.press("Escape");
    await siteOne.getByRole("button", { name: "Open FillNest" }).click();
    await siteOne.getByRole("searchbox", { name: "Search templates" }).fill("QA3 T2");
    await expect(siteOne.getByText("QA3 T2", { exact: true })).toBeVisible();
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
