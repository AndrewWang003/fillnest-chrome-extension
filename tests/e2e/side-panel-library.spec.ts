import { E2E_EXTENSION_BUILD_DIR } from "../helpers/extension-build";
import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { chromium, expect, test, type BrowserContext, type Page, type Worker } from "@playwright/test";

interface RuntimeHarnessResponse {
  ok: boolean;
  value?: unknown;
  error?: string;
}

test("Side Panel Template Library: This tab (default), By location, All templates, Not offered anywhere, and inline alias rename", async () => {
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
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    });
    console.log("launched context");
    const worker = await extensionWorker(context);
    const extensionId = new URL(worker.url()).host;
    console.log("worker ready", extensionId);
    const extensionPage = await openExtensionPage(context, extensionId);
    console.log("extension page opened");

    const bound = await sendRuntimeRequest(extensionPage, {
      type: "CREATE_TEMPLATE_AND_BIND",
      content: "Support reply\nThanks for reaching out",
      pageUrl: "https://app.example.test/customers/first-record/edit",
      pageProfileId: "page-customers-edit",
      fieldProfileId: "field-contact-email",
      pageIdentityKey: "/customers/:record/edit",
      fieldIdentityKey: '{"semanticKind":"email"}',
    });
    console.log("bound response", JSON.stringify(bound));
    expect(bound.ok).toBe(true);

    const global = await sendRuntimeRequest(extensionPage, {
      type: "RESTORE_TEMPLATE",
      template: {
        id: "global-template-1",
        content: "Global signature",
        siteAffinities: [],
        createdAt: "2026-08-16T00:00:00.000Z",
        updatedAt: "2026-08-16T00:00:00.000Z",
        totalUsageCount: 0,
        revision: 0,
      },
      bindings: [],
    });
    console.log("global response", JSON.stringify(global));
    expect(global.ok).toBe(true);

    // Task 035 (R8). The limit is enforced at the service worker's own
    // boundary, so it holds for every surface at once. Asserted here against
    // the real worker rather than the helper that computes it.
    const tooLong = await sendRuntimeRequest(extensionPage, {
      type: "CREATE_TEMPLATE",
      content: "中".repeat(1001),
      pageUrl: "https://app.example.test/customers/first-record/edit",
    });
    expect(tooLong.ok).toBe(false);
    expect(tooLong.error).toMatch(/1,000 Chinese characters/u);

    const atTheLimit = await sendRuntimeRequest(extensionPage, {
      type: "CREATE_TEMPLATE",
      content: "中".repeat(1000),
      pageUrl: "https://app.example.test/customers/first-record/edit",
    });
    expect(atTheLimit.ok).toBe(true);

    // And the exemption: content FillNest already accepted comes back whatever
    // its length. Refusing to return a user's own data would be the worse
    // failure of the two.
    const restoredLong = await sendRuntimeRequest(extensionPage, {
      type: "RESTORE_TEMPLATE",
      template: {
        id: "restored-long-template",
        content: "中".repeat(4000),
        siteAffinities: [],
        createdAt: "2026-08-16T00:00:00.000Z",
        updatedAt: "2026-08-16T00:00:00.000Z",
        totalUsageCount: 0,
        revision: 0,
      },
      bindings: [],
    });
    expect(restoredLong.ok).toBe(true);

    // Task 035 (R8 follow-up): 20 Templates per Field, enforced at the
    // worker's boundary. Fill the bound Field to the limit, then check that
    // one more is refused and that a different Field is unaffected.
    const filler: string[] = [];
    for (let index = filler.length; index < 19; index += 1) {
      const created = await sendRuntimeRequest(extensionPage, {
        type: "CREATE_TEMPLATE_AND_BIND",
        content: `Filler ${index}`,
        pageUrl: "https://app.example.test/customers/first-record/edit",
        pageProfileId: "page-customers-edit",
        fieldProfileId: "field-contact-email",
      });
      expect(created.ok).toBe(true);
      filler.push((created.value as { template: { id: string } }).template.id);
    }

    const oneTooMany = await sendRuntimeRequest(extensionPage, {
      type: "CREATE_TEMPLATE_AND_BIND",
      content: "One too many",
      pageUrl: "https://app.example.test/customers/first-record/edit",
      pageProfileId: "page-customers-edit",
      fieldProfileId: "field-contact-email",
    });
    expect(oneTooMany.ok).toBe(false);
    expect(oneTooMany.error).toMatch(/already offers 20 Templates/u);

    // A different Field is untouched by another Field being full.
    const otherField = await sendRuntimeRequest(extensionPage, {
      type: "CREATE_TEMPLATE_AND_BIND",
      content: "On another field",
      pageUrl: "https://app.example.test/customers/first-record/edit",
      pageProfileId: "page-customers-edit",
      fieldProfileId: "field-contact-phone",
    });
    expect(otherField.ok).toBe(true);
    filler.push((otherField.value as { template: { id: string } }).template.id);

    // Neither extra Template may disturb the assertions below, which count
    // what the Library shows.
    for (const templateId of [(atTheLimit.value as { id: string }).id, "restored-long-template", ...filler]) {
      const removed = await sendRuntimeRequest(extensionPage, { type: "DELETE_TEMPLATE", templateId });
      expect(removed.ok).toBe(true);
    }

    const sidePanel = await context.newPage();
    await sidePanel.goto(`chrome-extension://${extensionId}/side-panel.html`);
    await sidePanel.getByRole("button", { name: "Templates" }).click();

    // This tab: the default view. This harness's own tab isn't "on"
    // app.example.test, so "This tab" scope legitimately shows nothing for
    // the seeded Field - but Not offered anywhere doesn't depend on scope,
    // so the unbound Global Template still shows up here.
    await expect(sidePanel.getByRole("button", { name: "This tab", exact: true })).toHaveAttribute(
      "aria-current",
      "true",
    );
    await expect(sidePanel.getByText("No Fields with saved Templates on this page yet.")).toBeVisible();
    await sidePanel.locator(".not-offered-anywhere-toggle").click();
    await expect(sidePanel.getByText("Global signature")).toBeVisible();
    await sidePanel.locator(".not-offered-anywhere-toggle").click();

    // By location: reach the seeded Field by expanding Site -> Page -> Field.
    await sidePanel.getByRole("button", { name: "By location", exact: true }).click();
    await expect(sidePanel.getByText("example.test", { exact: true })).toBeVisible();
    await sidePanel.locator(".tree-chevron").nth(0).click();
    await sidePanel.locator(".tree-chevron").nth(1).click();
    await expect(sidePanel.getByText("Email", { exact: true })).toBeVisible();
    // Collapsed by default: the bound Template's own content isn't shown yet.
    await expect(sidePanel.getByText("Support reply")).toHaveCount(0);
    await sidePanel.locator(".tree-chevron").nth(2).click();
    await expect(sidePanel.getByText("Support reply")).toBeVisible();

    // Inline alias rename via the focusable Rename action + Enter, on the
    // Field's own label in the tree. Task 023 Addendum B5 (2): the label
    // itself is that action - there is no separate pencil button any more.
    await sidePanel.getByRole("button", { name: "Rename Email" }).click();
    const aliasInput = sidePanel.getByRole("textbox", { name: /^Name for /u });
    await expect(aliasInput).toBeVisible();
    // Task 023 Addendum B5 (3): it opens on the name being displayed.
    await expect(aliasInput).toHaveValue("Email");
    await aliasInput.fill("Work email");
    await aliasInput.press("Enter");
    await expect(sidePanel.getByText("Work email")).toBeVisible();
    await expect(sidePanel.getByText("Email", { exact: true })).toHaveCount(0);

    // All templates: still shows every Template with no filter, plus literal
    // body Search and the Global only toggle, unchanged from before.
    await sidePanel.getByRole("button", { name: "All templates", exact: true }).click();
    await expect(sidePanel.getByText("Support reply")).toBeVisible();
    await expect(sidePanel.getByText("Global signature")).toBeVisible();
    await sidePanel.getByRole("searchbox", { name: "Search Template bodies" }).fill("global");
    await expect(sidePanel.getByText("Global signature")).toBeVisible();
    await expect(sidePanel.getByText("Support reply")).toHaveCount(0);
    await sidePanel.getByRole("searchbox", { name: "Search Template bodies" }).fill("");

    await sidePanel.getByRole("button", { name: "Global only" }).click();
    await expect(sidePanel.getByText("Global signature")).toBeVisible();
    await expect(sidePanel.getByText("Support reply")).toHaveCount(0);
    await sidePanel.getByRole("button", { name: "Global only" }).click();
    await expect(sidePanel.getByText("Support reply")).toBeVisible();

    await sidePanel.screenshot({ path: "output/playwright/task003-slice2-side-panel-library.png", fullPage: true });

    // Acceptance criterion: usable without horizontal scrolling or clipped
    // controls at 360, 420, and 600 CSS pixel Side Panel widths, across both
    // Library views (the widest real content: the All templates filter bar
    // and an expanded Field card).
    for (const width of [360, 420, 600]) {
      await sidePanel.setViewportSize({ width, height: 700 });
      await sidePanel.getByRole("button", { name: "All templates", exact: true }).click();
      await expect(sidePanel.getByRole("searchbox", { name: "Search Template bodies" })).toBeVisible();
      const allTemplatesOverflow = await sidePanel.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(allTemplatesOverflow, `All templates view overflows at ${width}px`).toBeLessThanOrEqual(0);

      await sidePanel.getByRole("button", { name: "By location", exact: true }).click();
      await expect(sidePanel.getByText("Work email")).toBeVisible();
      const locationOverflow = await sidePanel.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(locationOverflow, `By location view overflows at ${width}px`).toBeLessThanOrEqual(0);
    }
  } finally {
    await context?.close();
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
