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

// One logical form served at every record-specific URL.
const FIXTURE_HTML = `<!doctype html>
<html>
  <body>
    <main>
      <form name="customer-editor">
        <label>Contact email<input name="contact_email" type="email" /></label>
        <label>Internal notes<textarea name="internal_notes"></textarea></label>
      </form>
    </main>
  </body>
</html>`;

/**
 * Covers the Inline Picker Logical Page Matching review flow end to end.
 *
 * Choosing a URL shape that actually reaches this code path is the whole
 * difficulty of this fixture. FillNest's pre-existing page identity key
 * (Task 001-era `buildPageIdentityKey`) already normalizes a plain
 * `/customers/123` to `/customers/:record`, so two records share one Page
 * Profile, the Field is recognized outright, and Logical Page Matching is
 * never consulted - correctly, since nothing needs matching.
 *
 * Logical Page Matching exists for the pages that older mechanism gives up
 * on. It yields `null` (unrecognized) as soon as a query key falls outside
 * its small stable allowlist (`action`/`mode`/`section`/`tab`/`view`), while
 * `buildRoutePattern` still derives a dynamic `/customers/:number`. A
 * record URL carrying an app-specific query parameter is therefore the
 * real-world shape this feature is for, and the shape this test uses.
 */
test("an unrecognized Field on a repeated record route offers Review, and confirming reuses the existing Template", async () => {
  test.setTimeout(90_000);
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

    // Record A: create and bind a Template on the contact email Field.
    const recordA = await context.newPage();
    await recordA.goto(`${fixture.origin}/customers/123?ref=inbox`);
    await recordA.bringToFront();
    const tabId = await worker.evaluate(async () => {
      const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      return activeTab?.id;
    });
    if (tabId === undefined) throw new Error("Active Fixture tab ID is unavailable");
    expect(
      await sendRuntimeRequest(extensionPage, {
        type: "ENABLE_SITE",
        pageUrl: `${fixture.origin}/customers/123?ref=inbox`,
        tabId,
      }),
    ).toEqual({ ok: true, value: expect.objectContaining({ status: "active" }) });

    await recordA.bringToFront();
    await recordA.locator('input[name="contact_email"]').focus();
    await recordA.getByRole("button", { name: "Open FillNest" }).click();
    await recordA.getByRole("button", { name: "New template" }).click();
    await recordA.getByRole("textbox", { name: "Template content" }).fill("hello@example.test");
    await recordA.getByRole("button", { name: "Save", exact: true }).click();
    await expect(recordA.getByRole("status")).toHaveText(/Saved and bound to this field\./u);

    // The opaque Page Observation is recorded off the Bind broadcast; wait for
    // it rather than assuming, so a slow write cannot silently skip the case.
    await expect
      .poll(
        async () => {
          const state = await sendRuntimeRequest(extensionPage, { type: "READ_STATE" });
          const value = state.value as { logicalPageObservations?: unknown[] } | undefined;
          return value?.logicalPageObservations?.length ?? 0;
        },
        { timeout: 10_000 },
      )
      .toBe(1);

    // Record B: a different record ID for the same logical form. The Field is
    // unrecognized, so its bound Template is NOT offered outright...
    const recordB = await context.newPage();
    await recordB.goto(`${fixture.origin}/customers/456?ref=search`);
    await recordB.bringToFront();
    await recordB.locator('input[name="contact_email"]').focus();
    await recordB.getByRole("button", { name: "Open FillNest" }).click();
    await expect(recordB.getByText("No saved match for this field.")).toBeVisible();

    // ...instead the status strip offers a Review of the candidate.
    await expect(recordB.getByText(/looks like a page you have filled before/u)).toBeVisible();

    // Dismissing via the dialog writes nothing.
    await recordB.getByRole("button", { name: "Review" }).click();
    // The dialog must name the actual match and what will change, not just
    // reassure generically - the address pattern and the specific Template.
    await expect(recordB.getByText(`${fixture.origin}/customers/:number`)).toBeVisible();
    await expect(recordB.getByText("hello@example.test")).toBeVisible();
    await expect(recordB.getByText(/Confirming makes this Template available/u)).toBeVisible();
    await recordB.getByRole("button", { name: "Cancel" }).click();
    await expect(recordB.getByText(/looks like a page you have filled before/u)).toHaveCount(0);
    const afterDismiss = await sendRuntimeRequest(extensionPage, { type: "READ_STATE" });
    expect((afterDismiss.value as { logicalPageRules: unknown[] }).logicalPageRules).toEqual([]);

    // Task 014: "The same page session is not prompted repeatedly." Reopening
    // the Picker on the same record must not offer the candidate again.
    await recordB.getByRole("button", { name: "Open FillNest" }).click();
    await expect(recordB.getByText("No saved match for this field.")).toBeVisible();
    await expect(recordB.getByText(/looks like a page you have filled before/u)).toHaveCount(0);

    // "Choosing not to review" counts the same as dismissing the dialog, so
    // simply closing the Picker also settles the offer for that page session.
    const recordBb = await context.newPage();
    await recordBb.goto(`${fixture.origin}/customers/222?ref=list`);
    await recordBb.bringToFront();
    await recordBb.locator('input[name="contact_email"]').focus();
    await recordBb.getByRole("button", { name: "Open FillNest" }).click();
    await expect(recordBb.getByText(/looks like a page you have filled before/u)).toBeVisible();
    await recordBb.getByRole("button", { name: "Close" }).click();
    await recordBb.locator('input[name="contact_email"]').focus();
    await recordBb.getByRole("button", { name: "Open FillNest" }).click();
    await expect(recordBb.getByText("No saved match for this field.")).toBeVisible();
    await expect(recordBb.getByText(/looks like a page you have filled before/u)).toHaveCount(0);

    // A fresh page session offers the candidate again; confirming this time
    // creates the Rule and reuses the already-bound Template on this Field.
    const recordC = await context.newPage();
    await recordC.goto(`${fixture.origin}/customers/789?ref=report`);
    await recordC.bringToFront();
    await recordC.locator('input[name="contact_email"]').focus();
    await recordC.getByRole("button", { name: "Open FillNest" }).click();
    await expect(recordC.getByText(/looks like a page you have filled before/u)).toBeVisible();
    await recordC.getByRole("button", { name: "Review" }).click();
    await recordC.getByRole("button", { name: "Confirm" }).click();

    await expect(recordC.getByRole("status")).toHaveText(/Reused your existing Templates for this page\./u);
    await expect(recordC.getByRole("button", { name: /hello@example\.test/u })).toBeVisible();

    const finalState = await sendRuntimeRequest(extensionPage, { type: "READ_STATE" });
    const business = finalState.value as {
      logicalPageRules: Array<{ routePattern: string; origin: string }>;
      templates: unknown[];
    };
    expect(business.logicalPageRules).toEqual([
      expect.objectContaining({ routePattern: "/customers/:number", origin: fixture.origin }),
    ]);
    // Confirmation reuses the existing Template; it never duplicates one.
    expect(business.templates).toHaveLength(1);
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
