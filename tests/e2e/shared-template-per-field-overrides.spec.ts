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
    <input id="notes-field" type="text" autocomplete="off" />
  </body>
</html>`;

// Task 026 Confirmed Contract, acceptance 1 and 3: a Shared Template Set
// member can create a per-Field Override of an inherited shared Template
// ("Save for this field") without disturbing the other member, and can
// later remove that relationship ("Remove from this field") - recording an
// Exclusion, not silently re-inheriting the base - with both mutations
// fully Undoable. field-1 is the real, recognized Field this test drives
// through the Picker; field-2 is a second Set member seeded directly into
// storage purely to prove it stays untouched throughout (its own UI
// coverage is out of scope here - Task 021/024's own E2E already covers
// interacting with a second real Shared Template Set member).
test("Save for this field creates an Override, and Remove from this field records an Exclusion - both Undoable, both leaving the other member untouched", async () => {
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

    const page = await context.newPage();
    await page.goto(fixture.origin);
    await page.bringToFront();
    const tabId = await worker.evaluate(async () => {
      const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      return activeTab?.id;
    });
    if (tabId === undefined) throw new Error("Active Fixture tab ID is unavailable");
    expect(
      await sendRuntimeRequest(extensionPage, { type: "ENABLE_SITE", pageUrl: fixture.origin, tabId }),
    ).toEqual({ ok: true, value: expect.objectContaining({ status: "active" }) });

    const siteId = new URL(fixture.origin).hostname;

    // Bind through the real Picker UI first so field-1's Field Profile gets
    // the actual identityKey the live content script's own recognition
    // produces for #notes-field - a hand-picked id would mismatch and the
    // Picker would never resolve back to it once reopened.
    await page.locator("#notes-field").click();
    await page.getByRole("button", { name: "Open FillNest" }).click();
    await page.getByRole("button", { name: "New template" }).click();
    await page.getByRole("textbox", { name: "Template content" }).fill("Direct binding, becomes dormant while shared");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.locator(".template-preview", { hasText: "Direct binding" })).toBeVisible();

    const seedState = await readState(extensionPage);
    const fieldProfileId = seedState.fieldProfiles[0]?.id;
    if (!fieldProfileId) throw new Error("field-1's real Field Profile id is unavailable");

    // Seed a two-member Shared Template Set with one Template slot: field-1
    // is the real Field just bound above, field-2 is a second reliably
    // identified Set member that never gets its own Picker in this test.
    await worker.evaluate(
      async ({ siteId, fieldProfileId }) => {
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
          { id: "set-1", siteId, name: "Contact fields", memberFieldProfileIds: [fieldProfileId, "field-2"] },
        ];
        state.sharedTemplateBindings = [
          { id: "shared-binding-1", setId: "set-1", templateId: "template-shared", usageCount: 0, revision: 0, order: 0 },
        ];
        await chrome.storage.local.set({ fillnestState: state });
      },
      { siteId, fieldProfileId },
    );

    // --- Reopen the Picker on field-1 and confirm the plain inherited state ---
    await page.reload();
    await page.locator("#notes-field").click();
    await page.getByRole("button", { name: "Open FillNest" }).click();
    await expect(page.locator(".template-preview", { hasText: "Thanks for reaching out" })).toBeVisible();
    // The dormant direct Binding is no longer offered once shared.
    await expect(page.locator(".template-preview", { hasText: "Direct binding" })).toHaveCount(0);

    // --- Acceptance 1: "Save for this field" creates A's own Override ---
    await page.getByRole("button", { name: "Edit" }).click();
    const editor = page.getByRole("textbox", { name: "Edit template content" });
    await editor.fill("A's own version");
    await expect(page.getByRole("button", { name: "Save for shared fields" })).toBeVisible();
    await page.getByRole("button", { name: "Save for this field" }).click();
    await expect(page.getByRole("status")).toContainText("for this field only");
    await expect(page.locator(".template-preview", { hasText: "A's own version" })).toBeVisible();

    let state = await readState(extensionPage);
    expect(state.sharedTemplateFieldStates).toHaveLength(1);
    expect(state.sharedTemplateFieldStates[0]).toMatchObject({
      setId: "set-1",
      slotId: "shared-binding-1",
      fieldProfileId,
      mode: "override",
    });
    // The base slot itself, and field-2's own inherited relationship to it,
    // are untouched by A's Override.
    expect(state.sharedTemplateBindings).toEqual([
      expect.objectContaining({ id: "shared-binding-1", templateId: "template-shared" }),
    ]);

    // --- Undo the Override: field-1 plainly re-inherits the base again ---
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.locator(".template-preview", { hasText: "Thanks for reaching out" })).toBeVisible();
    state = await readState(extensionPage);
    expect(state.sharedTemplateFieldStates).toEqual([]);
    expect(state.templates.map((t) => t.content)).not.toContain("A's own version");

    // --- Acceptance 3: "Remove from this field" records an Exclusion ---
    await page.getByRole("button", { name: "Remove from this field" }).click();
    await expect(page.getByRole("status")).toContainText("Still shared with the rest of the set");
    await expect(page.locator(".template-preview", { hasText: "Thanks for reaching out" })).toHaveCount(0);

    state = await readState(extensionPage);
    expect(state.sharedTemplateFieldStates).toHaveLength(1);
    expect(state.sharedTemplateFieldStates[0]).toMatchObject({
      setId: "set-1",
      slotId: "shared-binding-1",
      fieldProfileId,
      mode: "exclude",
    });
    // The base slot survives untouched - it remains available to field-2.
    expect(state.sharedTemplateBindings).toEqual([
      expect.objectContaining({ id: "shared-binding-1", templateId: "template-shared" }),
    ]);

    // --- Undo the Exclusion: field-1 plainly re-inherits the base again ---
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.locator(".template-preview", { hasText: "Thanks for reaching out" })).toBeVisible();
    state = await readState(extensionPage);
    expect(state.sharedTemplateFieldStates).toEqual([]);
  } finally {
    await context?.close();
    await rm(userDataDir, { recursive: true, force: true });
    await rm(extensionBaseDir, { recursive: true, force: true });
    await stopFixtureServer(fixture.server);
  }
});

interface StateShape {
  sharedTemplateFieldStates: Array<Record<string, unknown>>;
  sharedTemplateBindings: Array<Record<string, unknown>>;
  templates: Array<{ content: string }>;
  fieldProfiles: Array<{ id: string }>;
}

async function readState(extensionPage: Page): Promise<StateShape> {
  const response = await sendRuntimeRequest(extensionPage, { type: "READ_STATE" });
  if (!response.ok) throw new Error(response.error ?? "READ_STATE failed");
  return response.value as StateShape;
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
