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

// Task 027 Confirmed Contract: a Shared Set member's Search results split
// the ambiguous "Bind" into "Bind to this field" (a Field-only relationship,
// invisible to every other member) and "Bind to Shared Set" (the whole
// Set), and "Share this version" is the only action that later broadens a
// Field-only relationship. field-1 is the real, recognized Field this test
// drives through the Picker; field-2 is a second Set member seeded directly
// into storage purely to prove the Field-only slot's owner-only data shape
// never references it.
test("Bind to this field creates an owner-only slot, and Share this version promotes it - both Undoable", async () => {
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
    // produces for #notes-field.
    await page.locator("#notes-field").click();
    await page.getByRole("button", { name: "Open FillNest" }).click();
    await page.getByRole("button", { name: "New template" }).click();
    const composeBox = page.getByRole("textbox", { name: "Template content" });
    // Task 035 (R8 follow-up): the counter is silent on an ordinary draft and
    // appears once the draft is near the limit.
    await composeBox.fill("Short draft");
    await expect(page.locator(".template-length-counter")).toHaveCount(0);
    await composeBox.fill("a".repeat(2600));
    await expect(page.locator(".template-length-counter")).toHaveText("About 400 characters left");
    await composeBox.fill("Direct binding, becomes dormant while shared");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.locator(".template-preview", { hasText: "Direct binding" })).toBeVisible();

    const seedState = await readState(extensionPage);
    const fieldProfileId = seedState.fieldProfiles[0]?.id;
    if (!fieldProfileId) throw new Error("field-1's real Field Profile id is unavailable");

    // Seed a two-member Shared Template Set with one ordinary slot, plus an
    // unrelated Template ("Found elsewhere") that field-1 can discover
    // through Search but has never bound.
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
            createdAt: "2026-09-06T00:00:00.000Z",
            updatedAt: "2026-09-06T00:00:00.000Z",
            totalUsageCount: 0,
            revision: 0,
          },
          {
            id: "template-elsewhere",
            content: "Found elsewhere via Search",
            siteAffinities: [siteId],
            createdAt: "2026-09-06T00:00:00.000Z",
            updatedAt: "2026-09-06T00:00:00.000Z",
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

    // --- Reopen the Picker on field-1 and search for the unrelated Template ---
    await page.reload();
    await page.locator("#notes-field").click();
    await page.getByRole("button", { name: "Open FillNest" }).click();
    await expect(page.locator(".template-preview", { hasText: "Thanks for reaching out" })).toBeVisible();

    await page.getByRole("searchbox", { name: "Search templates" }).fill("elsewhere");
    await expect(page.getByRole("button", { name: "Bind to this field" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Bind to Shared Set" })).toBeVisible();

    await page.getByRole("button", { name: "Bind to this field" }).click();
    await expect(page.getByRole("status")).toContainText("this field only");

    let state = await readState(extensionPage);
    const ownedSlot = state.sharedTemplateBindings.find((b) => b.templateId === "template-elsewhere");
    expect(ownedSlot).toMatchObject({ setId: "set-1", ownerFieldProfileId: fieldProfileId });

    // --- Share this version: promotes the slot for the whole Set ---
    await page.getByRole("searchbox", { name: "Search templates" }).fill("");
    await expect(page.getByRole("button", { name: "Share this version" })).toBeVisible();
    await page.getByRole("button", { name: "Share this version" }).click();
    // Task 027 Explicit Scope UI: the audience change and the affected Set's
    // member count are stated BEFORE the mutation, and nothing is written
    // until the user confirms.
    await expect(page.getByText("with the whole Shared Template Set?")).toBeVisible();
    const beforeConfirm = await readState(extensionPage);
    expect(
      beforeConfirm.sharedTemplateBindings.find((b) => b.templateId === "template-elsewhere")?.ownerFieldProfileId,
    ).toBe(fieldProfileId);
    await page.getByRole("button", { name: "Share with the Set" }).click();
    await expect(page.getByRole("status")).toContainText("whole Set");

    state = await readState(extensionPage);
    const promotedSlot = state.sharedTemplateBindings.find((b) => b.templateId === "template-elsewhere");
    expect(promotedSlot?.ownerFieldProfileId).toBeUndefined();

    // --- Undo the promotion: the slot is owner-only again ---
    await page.getByRole("button", { name: "Undo" }).click();
    state = await readState(extensionPage);
    const revertedSlot = state.sharedTemplateBindings.find((b) => b.templateId === "template-elsewhere");
    expect(revertedSlot).toMatchObject({ ownerFieldProfileId: fieldProfileId });
  } finally {
    await context?.close();
    await rm(userDataDir, { recursive: true, force: true });
    await rm(extensionBaseDir, { recursive: true, force: true });
    await stopFixtureServer(fixture.server);
  }
});

// Task 027 Addendum A.3: "Share this version" has a second, explicitly
// disclosed mode when the Set already shares this exact Template through an
// ordinary slot - the promotion *consumes* the owner-only slot into it
// (summing usage, dropping the duplicate) instead of clearing its own
// `ownerFieldProfileId` in place. field-1 reaches that state here by holding
// its own private owner-only slot for "template-shared" while separately
// excluding itself from the Set's existing ordinary slot for that same
// Template - the Picker then shows one collapsed row (field-1's own private
// content), and "Share this version" is the only way back to the Set's
// normal content.
test("Share this version consumes the owner-only slot into an existing ordinary slot for the same Template, and the confirmation names the merge", async () => {
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
    // a real identityKey, exactly as the first test does.
    await page.locator("#notes-field").click();
    await page.getByRole("button", { name: "Open FillNest" }).click();
    await page.getByRole("button", { name: "New template" }).click();
    await page.getByRole("textbox", { name: "Template content" }).fill("Direct binding, becomes dormant while shared");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.locator(".template-preview", { hasText: "Direct binding" })).toBeVisible();

    const seedState = await readState(extensionPage);
    const fieldProfileId = seedState.fieldProfiles[0]?.id;
    if (!fieldProfileId) throw new Error("field-1's real Field Profile id is unavailable");

    // Seed the Set with an ordinary slot for "template-shared", field-1's own
    // owner-only slot for the *same* Template id, and field-1's own
    // Exclusion of the ordinary slot - the state Addendum A.3 mode 2 (the
    // "consume" mode) is written for.
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
            createdAt: "2026-09-06T00:00:00.000Z",
            updatedAt: "2026-09-06T00:00:00.000Z",
            totalUsageCount: 0,
            revision: 0,
          },
        ];
        // Addendum A.3 mode 2 is keyed on the owner-only slot's own
        // `templateId` matching an *existing ordinary slot's* `templateId`
        // in the same Set exactly - the realistic path is a Field
        // explicitly pinning a Template already shared by the Set (e.g. via
        // "Bind to this field" on a Search result that happens to be the
        // Set's own content) while separately excluding itself from the
        // ordinary slot, so its Picker resolves the pinned owner-only slot
        // alone.
        state.sharedTemplateSets = [
          { id: "set-1", siteId, name: "Contact fields", memberFieldProfileIds: [fieldProfileId, "field-2"] },
        ];
        state.sharedTemplateBindings = [
          { id: "shared-binding-1", setId: "set-1", templateId: "template-shared", usageCount: 4, revision: 0, order: 0 },
          {
            id: "shared-binding-owner",
            setId: "set-1",
            templateId: "template-shared",
            usageCount: 2,
            revision: 0,
            order: 1,
            ownerFieldProfileId: fieldProfileId,
          },
        ];
        state.sharedTemplateFieldStates = [
          {
            id: "field-state-exclude",
            setId: "set-1",
            slotId: "shared-binding-1",
            fieldProfileId,
            mode: "exclude",
          },
        ];
        await chrome.storage.local.set({ fillnestState: state });
      },
      { siteId, fieldProfileId },
    );

    await page.reload();
    await page.locator("#notes-field").click();
    await page.getByRole("button", { name: "Open FillNest" }).click();

    // field-1 resolves "template-shared" exactly once - through its own
    // pinned owner-only slot, not the ordinary slot it excluded itself from
    // (Addendum A.2 collapse: never two rows for one Template).
    await expect(page.locator(".template-preview", { hasText: "Thanks for reaching out" })).toHaveCount(1);

    await expect(page.getByRole("button", { name: "Share this version" })).toBeVisible();
    await page.getByRole("button", { name: "Share this version" }).click();
    // Mode 2's pre-mutation disclosure must name the merge, not describe an
    // ordinary promotion - and still nothing is written until confirmed.
    await expect(page.getByText("merged into the Set's existing shared entry")).toBeVisible();
    const beforeConfirm = await readState(extensionPage);
    expect(beforeConfirm.sharedTemplateBindings.filter((b) => b.templateId === "template-shared")).toHaveLength(2);
    await page.getByRole("button", { name: "Share with the Set" }).click();
    await expect(page.getByRole("status")).toContainText("merged into the Set's existing shared entry");

    const state = await readState(extensionPage);
    const survivingSlots = state.sharedTemplateBindings.filter((b) => b.templateId === "template-shared");
    expect(survivingSlots).toHaveLength(1);
    expect(survivingSlots[0]).toMatchObject({ id: "shared-binding-1", usageCount: 6 });
    expect(survivingSlots[0]?.ownerFieldProfileId).toBeUndefined();

    // --- Undo the consuming promotion: the pre-promotion pair returns exactly ---
    await page.getByRole("button", { name: "Undo" }).click();
    const reverted = await readState(extensionPage);
    const revertedOrdinary = reverted.sharedTemplateBindings.find((b) => b.id === "shared-binding-1");
    const revertedOwner = reverted.sharedTemplateBindings.find((b) => b.id === "shared-binding-owner");
    expect(revertedOrdinary).toMatchObject({ templateId: "template-shared", usageCount: 4 });
    expect(revertedOwner).toMatchObject({ templateId: "template-shared", usageCount: 2, ownerFieldProfileId: fieldProfileId });
  } finally {
    await context?.close();
    await rm(userDataDir, { recursive: true, force: true });
    await rm(extensionBaseDir, { recursive: true, force: true });
    await stopFixtureServer(fixture.server);
  }
});

// Task 027 Addendum B: "Join Set & Share" - the Picker's Finder-based entry
// point for broadening a Field-only relationship onto a target Field that
// has never joined any Shared Template Set. field-1 holds its own private
// slot in "Contact fields"; field-3 is a separate, not-yet-shared Field
// (discoverable in the Finder because it already has its own effective
// Template) on the same Site.
test("Join Set & Share adds the target Field to the owner's Set and promotes the private slot, with one confirmation and one Undo", async () => {
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

    await page.locator("#notes-field").click();
    await page.getByRole("button", { name: "Open FillNest" }).click();
    await page.getByRole("button", { name: "New template" }).click();
    await page.getByRole("textbox", { name: "Template content" }).fill("Direct binding, becomes dormant while shared");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.locator(".template-preview", { hasText: "Direct binding" })).toBeVisible();

    const seedState = await readState(extensionPage);
    const fieldProfileId = seedState.fieldProfiles[0]?.id;
    if (!fieldProfileId) throw new Error("field-1's real Field Profile id is unavailable");

    // Seed field-1's own private slot in a 2-member Set, plus a third,
    // wholly independent Field (field-3) that already has its own bound
    // Template and belongs to no Set - the discoverable, not-yet-shared
    // target the Finder must offer.
    await worker.evaluate(
      async ({ siteId, fieldProfileId }) => {
        const stored = await chrome.storage.local.get("fillnestState");
        const state = stored.fillnestState as Record<string, unknown>;
        const pageProfiles = (state.pageProfiles as Array<Record<string, unknown>>) ?? [];
        const fieldProfiles = (state.fieldProfiles as Array<Record<string, unknown>>) ?? [];
        pageProfiles.push({ id: "page-2", siteId, identityKey: "/billing" });
        pageProfiles.push({ id: "page-3", siteId, identityKey: "/newsletter" });
        fieldProfiles.push({ id: "field-2", pageProfileId: "page-2", observedTitle: "Billing email" });
        fieldProfiles.push({ id: "field-3", pageProfileId: "page-3", observedTitle: "Newsletter email" });
        state.pageProfiles = pageProfiles;
        state.fieldProfiles = fieldProfiles;
        state.templates = [
          ...(state.templates as Array<Record<string, unknown>>),
          {
            id: "template-private",
            content: "A private reply",
            siteAffinities: [siteId],
            createdAt: "2026-09-06T00:00:00.000Z",
            updatedAt: "2026-09-06T00:00:00.000Z",
            totalUsageCount: 0,
            revision: 0,
          },
          {
            id: "template-newsletter",
            content: "Welcome to the list",
            siteAffinities: [siteId],
            createdAt: "2026-09-06T00:00:00.000Z",
            updatedAt: "2026-09-06T00:00:00.000Z",
            totalUsageCount: 0,
            revision: 0,
          },
        ];
        state.sharedTemplateSets = [
          { id: "set-1", siteId, name: "Contact fields", memberFieldProfileIds: [fieldProfileId, "field-2"] },
        ];
        state.sharedTemplateBindings = [
          {
            id: "shared-binding-owner",
            setId: "set-1",
            templateId: "template-private",
            usageCount: 0,
            revision: 0,
            order: 0,
            ownerFieldProfileId: fieldProfileId,
          },
        ];
        state.bindings = [
          ...(state.bindings as Array<Record<string, unknown>>),
          { id: "binding-field-3", templateId: "template-newsletter", pageProfileId: "page-3", fieldProfileId: "field-3", createdAt: "2026-09-06T00:00:00.000Z", usageCount: 0, revision: 0 },
        ];
        await chrome.storage.local.set({ fillnestState: state });
      },
      { siteId, fieldProfileId },
    );

    await page.reload();
    await page.locator("#notes-field").click();
    await page.getByRole("button", { name: "Open FillNest" }).click();
    await expect(page.locator(".template-preview", { hasText: "A private reply" })).toBeVisible();

    await page.getByRole("button", { name: "Share this version" }).click();
    await expect(page.getByText("with the whole Shared Template Set?")).toBeVisible();
    await page.getByRole("button", { name: "Share with a different field…" }).click();

    await expect(page.getByRole("searchbox", { name: "Search Fields to share with" })).toBeVisible();
    await expect(page.getByText("Newsletter email")).toBeVisible();

    // Task 027 Explicit Scope UI: names the affected Field/Set and states
    // the membership change before anything is written.
    await page.getByRole("button", { name: "Share", exact: true }).click();
    await expect(page.getByText("Join Set & Share")).toBeVisible();
    await expect(page.getByText("Newsletter email")).toBeVisible();
    // Task 035 (R8 follow-up): a join takes the union of both sides, so the
    // confirmation states what each Field will offer afterwards. That number
    // used to be the one thing it did not say, which is how a Set merge could
    // take a Field over the limit without anyone being told.
    await expect(page.locator(".picker-share-count")).toContainText(/Afterwards each of these fields offers/u);
    const beforeConfirm = await readState(extensionPage);
    expect(beforeConfirm.sharedTemplateSets[0]?.memberFieldProfileIds).not.toContain("field-3");

    await page.getByRole("button", { name: "Join Set & Share" }).click();
    await expect(page.getByRole("status")).toContainText("Newsletter email");

    let state = await readState(extensionPage);
    expect(state.sharedTemplateSets[0]?.memberFieldProfileIds).toContain("field-3");
    const promotedSlot = state.sharedTemplateBindings.find((b) => b.templateId === "template-private");
    expect(promotedSlot?.ownerFieldProfileId).toBeUndefined();

    // --- Undo the composite: membership and promotion both revert exactly ---
    await page.getByRole("button", { name: "Undo" }).click();
    state = await readState(extensionPage);
    expect(state.sharedTemplateSets[0]?.memberFieldProfileIds).not.toContain("field-3");
    const revertedSlot = state.sharedTemplateBindings.find((b) => b.templateId === "template-private");
    expect(revertedSlot).toMatchObject({ ownerFieldProfileId: fieldProfileId });
  } finally {
    await context?.close();
    await rm(userDataDir, { recursive: true, force: true });
    await rm(extensionBaseDir, { recursive: true, force: true });
    await stopFixtureServer(fixture.server);
  }
});

// Task 027 Addendum B: "Merge Sets & Share" - the target Field already
// belongs to a different existing Shared Template Set, so the composite
// merges that Set into the owner's own before promoting.
test("Merge Sets & Share merges the target's Set into the owner's and promotes the private slot, with one confirmation and one Undo", async () => {
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

    await page.locator("#notes-field").click();
    await page.getByRole("button", { name: "Open FillNest" }).click();
    await page.getByRole("button", { name: "New template" }).click();
    await page.getByRole("textbox", { name: "Template content" }).fill("Direct binding, becomes dormant while shared");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.locator(".template-preview", { hasText: "Direct binding" })).toBeVisible();

    const seedState = await readState(extensionPage);
    const fieldProfileId = seedState.fieldProfiles[0]?.id;
    if (!fieldProfileId) throw new Error("field-1's real Field Profile id is unavailable");

    // field-3 already belongs to its own separate Set ("Newsletter fields")
    // with an ordinary slot - selecting it must merge that Set into
    // field-1's own, never add field-3 as a bare member.
    await worker.evaluate(
      async ({ siteId, fieldProfileId }) => {
        const stored = await chrome.storage.local.get("fillnestState");
        const state = stored.fillnestState as Record<string, unknown>;
        const pageProfiles = (state.pageProfiles as Array<Record<string, unknown>>) ?? [];
        const fieldProfiles = (state.fieldProfiles as Array<Record<string, unknown>>) ?? [];
        pageProfiles.push({ id: "page-2", siteId, identityKey: "/billing" });
        pageProfiles.push({ id: "page-3", siteId, identityKey: "/newsletter" });
        fieldProfiles.push({ id: "field-2", pageProfileId: "page-2", observedTitle: "Billing email" });
        fieldProfiles.push({ id: "field-3", pageProfileId: "page-3", observedTitle: "Newsletter email" });
        state.pageProfiles = pageProfiles;
        state.fieldProfiles = fieldProfiles;
        state.templates = [
          ...(state.templates as Array<Record<string, unknown>>),
          {
            id: "template-private",
            content: "A private reply",
            siteAffinities: [siteId],
            createdAt: "2026-09-06T00:00:00.000Z",
            updatedAt: "2026-09-06T00:00:00.000Z",
            totalUsageCount: 0,
            revision: 0,
          },
          {
            id: "template-newsletter",
            content: "Welcome to the list",
            siteAffinities: [siteId],
            createdAt: "2026-09-06T00:00:00.000Z",
            updatedAt: "2026-09-06T00:00:00.000Z",
            totalUsageCount: 0,
            revision: 0,
          },
        ];
        state.sharedTemplateSets = [
          { id: "set-1", siteId, name: "Contact fields", memberFieldProfileIds: [fieldProfileId, "field-2"] },
          { id: "set-2", siteId, name: "Newsletter fields", memberFieldProfileIds: ["field-3"] },
        ];
        state.sharedTemplateBindings = [
          {
            id: "shared-binding-owner",
            setId: "set-1",
            templateId: "template-private",
            usageCount: 0,
            revision: 0,
            order: 0,
            ownerFieldProfileId: fieldProfileId,
          },
          { id: "shared-binding-newsletter", setId: "set-2", templateId: "template-newsletter", usageCount: 0, revision: 0, order: 0 },
        ];
        await chrome.storage.local.set({ fillnestState: state });
      },
      { siteId, fieldProfileId },
    );

    await page.reload();
    await page.locator("#notes-field").click();
    await page.getByRole("button", { name: "Open FillNest" }).click();
    await expect(page.locator(".template-preview", { hasText: "A private reply" })).toBeVisible();

    await page.getByRole("button", { name: "Share this version" }).click();
    await expect(page.getByText("with the whole Shared Template Set?")).toBeVisible();
    await page.getByRole("button", { name: "Share with a different field…" }).click();

    await expect(page.getByRole("searchbox", { name: "Search Fields to share with" })).toBeVisible();
    await expect(page.getByText("Newsletter email")).toBeVisible();

    await page.getByRole("button", { name: "Share", exact: true }).click();
    // The composite's confirmation states the Set merge explicitly, not a
    // bare member add.
    await expect(page.getByText("Merge Shared Template Sets")).toBeVisible();
    const beforeConfirm = await readState(extensionPage);
    expect(beforeConfirm.sharedTemplateSets).toHaveLength(2);

    await page.getByRole("button", { name: "Merge Sets & Share" }).click();
    await expect(page.getByRole("status")).toContainText("Newsletter email");

    let state = await readState(extensionPage);
    expect(state.sharedTemplateSets).toHaveLength(1);
    expect(state.sharedTemplateSets[0]?.memberFieldProfileIds).toEqual(
      expect.arrayContaining([fieldProfileId, "field-2", "field-3"]),
    );
    const promotedSlot = state.sharedTemplateBindings.find((b) => b.templateId === "template-private");
    expect(promotedSlot?.ownerFieldProfileId).toBeUndefined();

    // --- Undo the composite: the merge and promotion both revert exactly ---
    await page.getByRole("button", { name: "Undo" }).click();
    state = await readState(extensionPage);
    expect(state.sharedTemplateSets).toHaveLength(2);
    const revertedSlot = state.sharedTemplateBindings.find((b) => b.templateId === "template-private");
    expect(revertedSlot).toMatchObject({ ownerFieldProfileId: fieldProfileId });
  } finally {
    await context?.close();
    await rm(userDataDir, { recursive: true, force: true });
    await rm(extensionBaseDir, { recursive: true, force: true });
    await stopFixtureServer(fixture.server);
  }
});

interface StateShape {
  fieldProfiles: Array<{ id: string }>;
  sharedTemplateBindings: Array<{ id: string; setId: string; templateId: string; ownerFieldProfileId?: string }>;
  sharedTemplateSets: Array<{ id: string; memberFieldProfileIds: string[] }>;
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
