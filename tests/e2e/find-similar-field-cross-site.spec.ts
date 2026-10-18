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
    <input id="field-a" type="email" autocomplete="email" />
  </body>
</html>`;

// Task 024 Slice 3: real headed regression for cross-Site linking. A second
// Site's discoverable Field/Page/Template/direct-Binding is seeded directly
// into storage - the same technique shared-template-sets-management.spec.ts
// already uses for a second Site, since Playwright's own two fixture
// servers both bind 127.0.0.1 and are therefore the *same* registrable Site
// (see that spec's own comment) - there is no way to get a real second
// registrable Site without DNS setup this environment doesn't have. What
// this proves that a unit test cannot: the real built extension's storage
// layer accepts and correctly displays a cross-Site Shared Template Set
// created through the real Picker UI end to end.
for (const joinExisting of [false, true]) {
test(`Links Templates across two Sites through the real Picker (join existing: ${joinExisting})`, async () => {
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
    const page = await context.newPage();
    await page.goto(fixture.origin);
    const extensionPage = await openExtensionPage(context, extensionId);
    await grantOrigin(worker, extensionPage, page, fixture.origin);
    await page.bringToFront();

    await page.locator("#field-a").focus();
    await page.getByRole("button", { name: "Open FillNest" }).click();
    await page.getByRole("button", { name: "New template" }).click();
    await page.getByRole("textbox", { name: "Template content" }).fill("Field A reply");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("Saved and bound to this field.");
    await page.getByRole("button", { name: "Close" }).click();

    // Seed a second, distinct Site's own discoverable Field - a real Page,
    // Field, Template, and direct Binding, matching the same generic
    // autocomplete="email" evidence so it is field-a's sole high-confidence
    // match despite being on a different Site.
    await worker.evaluate(async (joinExisting) => {
      const stored = await chrome.storage.local.get("fillnestState");
      const state = stored.fillnestState as Record<string, unknown>;
      const otherSiteId = "other-site.test";
      state.sites = [...(state.sites as Array<Record<string, unknown>>), { id: otherSiteId }];
      state.pageProfiles = [
        ...(state.pageProfiles as Array<Record<string, unknown>>),
        { id: "page-b", siteId: otherSiteId, identityKey: "/contact" },
      ];
      state.fieldProfiles = [
        ...(state.fieldProfiles as Array<Record<string, unknown>>),
        {
          id: "field-b",
          pageProfileId: "page-b",
          identityKey: JSON.stringify({ tag: "input", type: "email", name: "", id: "", autocomplete: "email", semanticKind: "", form: "", ancestors: [], ordinal: 0 }),
          observedTitle: "Field B",
        },
      ];
      state.templates = [
        ...(state.templates as Array<Record<string, unknown>>),
        {
          id: "template-b",
          content: "Field B reply",
          siteAffinities: [otherSiteId],
          createdAt: "2026-09-02T00:00:00.000Z",
          updatedAt: "2026-09-02T00:00:00.000Z",
          totalUsageCount: 0,
          revision: 0,
        },
      ];
      state.bindings = [
        ...(state.bindings as Array<Record<string, unknown>>),
        {
          id: "binding-b",
          templateId: "template-b",
          pageProfileId: "page-b",
          fieldProfileId: "field-b",
          createdAt: "2026-09-02T00:00:00.000Z",
          usageCount: 0,
          revision: 0,
          order: 0,
        },
      ];
      if (joinExisting) {
        state.fieldProfiles = [...(state.fieldProfiles as Array<Record<string, unknown>>), {
          id: "field-b-peer", pageProfileId: "page-b", identityKey: "peer", observedTitle: "Peer",
        }];
        state.sharedTemplateSets = [{ id: "set-b", siteId: otherSiteId, name: "B and peer", memberFieldProfileIds: ["field-b", "field-b-peer"] }];
        state.sharedTemplateBindings = [{ id: "shared-b", setId: "set-b", templateId: "template-b", usageCount: 0, revision: 0, order: 0 }];
      }
      await chrome.storage.local.set({ fillnestState: state });
    }, joinExisting);

    await page.locator("#field-a").focus();
    await page.getByRole("button", { name: "Open FillNest" }).click();
    await page.getByRole("button", { name: "Share with…" }).click();

    // Cross-Site discovery is never shown by default - only Search reveals it.
    await expect(page.getByText("Field B reply")).not.toBeVisible();
    await page.getByRole("searchbox", { name: "Search Fields" }).fill("Field B");
    const crossSiteRow = page.locator(".find-similar-row").filter({ hasText: "Field B reply" }).first();
    await expect(crossSiteRow.locator(".shared-field-candidate-page")).toHaveCount(0);
    await expect(crossSiteRow.locator(".find-similar-search-context")).toContainText("may have a different purpose.");
    await expect(crossSiteRow.locator(".find-similar-search-context strong")).toHaveText("other-site.test");
    await crossSiteRow.getByRole("button", { name: "Share" }).click();

    if (joinExisting) {
      await expect(page.getByText(/Every Template these 3 fields across 2 Sites currently offer/)).toBeVisible();
      await page.getByRole("button", { name: "Share", exact: true }).click();
    }
    await expect(page.getByRole("status")).toContainText("Started sharing Templates with");
    await expect(page.locator(".picker-context")).toContainText(`${joinExisting ? 3 : 2} fields use the same Templates`);
    // The joining Field's original Template must remain visible alongside the source list.
    await expect(page.locator("[data-template-row]").filter({ hasText: "Field A reply" })).toBeVisible();
    await expect(page.locator("[data-template-row]").filter({ hasText: "Field B reply" })).toBeVisible();

    const state = await readState(extensionPage);
    expect(state.sharedTemplateSets).toHaveLength(1);
    const set = state.sharedTemplateSets[0]!;
    expect(set.memberFieldProfileIds).toHaveLength(joinExisting ? 3 : 2);
    expect(set.memberFieldProfileIds).toContain("field-b");
    const memberSiteIds = new Set(
      set.memberFieldProfileIds.map((fieldId) => {
        const field = state.fieldProfiles.find((candidate) => candidate.id === fieldId);
        const pageProfile = state.pageProfiles.find((candidate) => candidate.id === field?.pageProfileId);
        return pageProfile?.siteId;
      }),
    );
    // The defining proof: one Shared Template Set whose members span two
    // genuinely distinct Sites.
    expect(memberSiteIds.size).toBe(2);
    expect(memberSiteIds.has("other-site.test")).toBe(true);
    if (joinExisting) {
      await page.bringToFront();
      await page.getByRole("button", { name: "Undo", exact: true }).click();
      await expect(page.locator("[data-template-row]").filter({ hasText: "Field A reply" })).toBeVisible();
      await expect(page.locator("[data-template-row]").filter({ hasText: "Field B reply" })).not.toBeVisible();
      const restored = await readState(extensionPage);
      expect(restored.sharedTemplateBindings.map((binding) => binding.templateId)).toEqual(["template-b"]);
      expect(restored.sharedTemplateSets[0]?.memberFieldProfileIds).toEqual(["field-b", "field-b-peer"]);
      await page.bringToFront();
      await page.getByRole("button", { name: "Share with…" }).click();
      await page.getByRole("searchbox", { name: "Search Fields" }).fill("Field B");
      await page.locator(".find-similar-row").filter({ hasText: "Field B" }).first().getByRole("button", { name: "Share", exact: true }).click();
      await page.getByRole("button", { name: "Share", exact: true }).click();
      await expect(page.locator(".picker-context")).toContainText("3 fields use the same Templates");
      await page.getByRole("button", { name: "Leave sharing", exact: true }).click();
      await expect(page.locator("[data-template-row]").filter({ hasText: "Field A reply" })).toBeVisible();
      await expect(page.locator("[data-template-row]").filter({ hasText: "Field B reply" })).toBeVisible();
    }
  } finally {
    await context?.close();
    await rm(userDataDir, { recursive: true, force: true });
    await rm(extensionBaseDir, { recursive: true, force: true });
    await stopFixtureServer(fixture.server);
  }
});

}

interface StateShape {
  sharedTemplateBindings: Array<{ templateId: string }>;
  sharedTemplateSets: Array<{ memberFieldProfileIds: string[] }>;
  fieldProfiles: Array<{ id: string; pageProfileId: string }>;
  pageProfiles: Array<{ id: string; siteId: string }>;
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
  expect(result).toEqual({ ok: true, value: expect.objectContaining({ status: "active" }) });
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
