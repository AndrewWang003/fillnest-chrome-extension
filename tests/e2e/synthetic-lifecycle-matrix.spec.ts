import { E2E_EXTENSION_BUILD_DIR } from "../helpers/extension-build";
import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  expect,
  test,
  type BrowserContext,
} from "@playwright/test";

import {
  activateFixtureOrigin,
  directFieldListenerCount,
  extensionWorker,
  installValueReadInstrumentation,
  sendRuntimeRequest,
  valueReadCount,
} from "../helpers/extension-e2e-session";
import { launchWithPermissionHistory } from "../helpers/prime-extension-permissions";
import {
  startSyntheticLifecycleServer,
  stopSyntheticLifecycleServer,
} from "../helpers/synthetic-lifecycle-server";
import {
  SYNTHETIC_FIXTURE_CASES,
} from "../fixtures/synthetic-lifecycle-matrix";

const ACTIVE_MARKER = "data-fillnest-extension-active";

test("synthetic lifecycle matrix verifies zero-touch on excluded fields and focus-driven single-field operations", async () => {
  test.setTimeout(60_000);
  const fixture = await startSyntheticLifecycleServer();
  const userDataDir = await mkdtemp(join(tmpdir(), "fillnest-synthetic-e2e-"));
  const extensionBaseDir = await mkdtemp(join(tmpdir(), "fillnest-extension-"));
  const extensionPath = join(extensionBaseDir, "extension");
  await cp(resolve(E2E_EXTENSION_BUILD_DIR), extensionPath, { recursive: true });
  const fixturePattern = `${fixture.origin}/*`;
  let context: BrowserContext | undefined;

  try {
    context = await launchWithPermissionHistory(userDataDir, extensionPath, [fixturePattern]);
    const worker = await extensionWorker(context);
    const extensionId = new URL(worker.url()).host;

    const fixturePage = await context.newPage();
    await fixturePage.goto(fixture.origin);
    const extensionPage = await activateFixtureOrigin(
      context,
      worker,
      extensionId,
      fixturePage,
      fixture.origin,
    );

    // Verify extension activated on authorized synthetic fixture page
    await expect(fixturePage.locator(`html[${ACTIVE_MARKER}]`)).toHaveCount(1);
    await installValueReadInstrumentation(fixturePage, extensionId);
    const listenerAuditSession = await context.newCDPSession(fixturePage);
    expect(
      await directFieldListenerCount(listenerAuditSession, "repeat-contact-0-name"),
      "Fixture-owned direct input listeners prove this CDP audit can observe Field listeners.",
    ).toBeGreaterThan(0);

    // 1. Verify Fail-Closed Zero-Touch on All Excluded Fields
    const excludedCases = SYNTHETIC_FIXTURE_CASES.filter((c) => !c.isEligible);
    for (const testCase of excludedCases) {
      const locator = fixturePage.locator(`#${testCase.fieldId}`);
      // Some excluded controls (for example disabled or type=hidden) cannot
      // receive browser focus. Dispatch the same bubbling event the delegated
      // content-script listener receives, without weakening the zero-touch
      // assertion to focusable controls only.
      await locator.dispatchEvent("focusin", { bubbles: true });
      await expect(
        fixturePage.getByRole("button", { name: "Open FillNest" }),
        `Expected no FillNest button on excluded field ${testCase.fieldId}`,
      ).toHaveCount(0);
      await expect(
        fixturePage.locator(`#${testCase.fieldId}[data-fillnest-field]`),
        `Expected no data-fillnest-field attribute on ${testCase.fieldId}`,
      ).toHaveCount(0);
      expect(await valueReadCount(fixturePage, testCase.fieldId)).toBe(0);
      expect(await directFieldListenerCount(listenerAuditSession, testCase.fieldId)).toBe(0);
      await locator.dispatchEvent("input", { bubbles: true, inputType: "insertText", data: "x" });
      await expect(
        fixturePage.getByRole("button", { name: "Open FillNest" }),
        `Expected no effective FillNest interaction path on excluded field ${testCase.fieldId}`,
      ).toHaveCount(0);
      expect(await valueReadCount(fixturePage, testCase.fieldId)).toBe(0);
      expect(await directFieldListenerCount(listenerAuditSession, testCase.fieldId)).toBe(0);
    }
    expect(await sendRuntimeRequest(extensionPage, { type: "READ_STATE" })).toEqual(
      expect.objectContaining({
        ok: true,
        value: expect.objectContaining({
          pageProfiles: [],
          fieldProfiles: [],
          bindings: [],
        }),
      }),
    );

    // 2. Verify Repeated Groups Single-Field Insertion Isolation
    const contact0 = fixturePage.locator("#repeat-contact-0-name");
    await contact0.focus();
    await expect(fixturePage.getByRole("button", { name: "Open FillNest" })).toHaveCount(1);
    await fixturePage.getByRole("button", { name: "Open FillNest" }).click();

    await fixturePage.getByRole("button", { name: "New template" }).click();
    const editor = fixturePage.getByRole("textbox", { name: "Template content" });
    expect(await valueReadCount(fixturePage, "repeat-contact-0-name")).toBe(0);
    await fixturePage.getByRole("button", { name: "Use field content" }).click();
    await expect(editor).toHaveValue("Alice");
    expect(await valueReadCount(fixturePage, "repeat-contact-0-name")).toBeGreaterThan(0);
    await editor.fill("Alice synthetic note");
    await fixturePage.getByRole("button", { name: "Save", exact: true }).click();
    await expect(fixturePage.getByRole("status")).toHaveText(/(?:Saved and bound|Bound .*) to this field\./u);

    // Insert template into contact 0
    await fixturePage.getByRole("button", { name: "Alice synthetic note" }).click();
    await expect(contact0).toHaveValue("Alice synthetic noteAlice");

    // Add repeated contact row 1 dynamically
    await fixturePage.locator("#btn-add-repeat-contact-row").click();
    const contact1 = fixturePage.locator("#repeat-contact-1-name");
    await expect(contact1).toHaveValue("Bob");

    // Assert event log for contact 1 is untouched (isolation)
    const eventLogs = await fixturePage.evaluate(() => (window as unknown as { syntheticEventLogs: Record<string, unknown[]> }).syntheticEventLogs);
    expect(eventLogs["repeat-contact-1-name"]).toEqual([]);

    // 3. Verify Dynamic Insertion Focus Activation
    await fixturePage.locator("#btn-add-dynamic-text").click();
    const dynText = fixturePage.locator("#dyn-text-field");
    await dynText.focus();
    await expect(fixturePage.getByRole("button", { name: "Open FillNest" })).toHaveCount(1);

    await fixturePage.locator("#btn-add-conditional-note").click();
    const dynNote = fixturePage.locator("#dyn-note-textarea");
    await dynNote.focus();
    await expect(fixturePage.getByRole("button", { name: "Open FillNest" })).toHaveCount(1);

    // 4. Existing DOM replacement safety: a detached Picker Target closes rather than retargeting.
    const replaceTarget = fixturePage.locator("#replace-target");
    await replaceTarget.focus();
    await fixturePage.getByRole("button", { name: "Open FillNest" }).click();
    await expect(fixturePage.getByRole("region", { name: "FillNest templates" })).toBeVisible();
    await fixturePage.evaluate(() => {
      document.querySelector<HTMLButtonElement>("#btn-replace-field")?.click();
    });
    await expect(fixturePage.getByRole("region", { name: "FillNest templates" })).toHaveCount(0);

    // 5. Ambiguous repeat instances remain manual-only and do not inherit a Binding.
    const ambiguous0 = fixturePage.locator("#ambiguous-item-0");
    await ambiguous0.focus();
    await fixturePage.getByRole("button", { name: "Open FillNest" }).click();
    await fixturePage.getByRole("button", { name: "New template" }).click();
    await fixturePage.getByRole("textbox", { name: "Template content" }).fill("Ambiguous item note");
    await fixturePage.getByRole("button", { name: "Save", exact: true }).click();
    await fixturePage.getByRole("button", { name: "Close" }).click();
    await fixturePage.locator("#btn-add-ambiguous-item").click();
    await fixturePage.locator("#ambiguous-item-1").focus();
    await fixturePage.getByRole("button", { name: "Open FillNest" }).click();
    await expect(fixturePage.getByText("No saved match for this field.")).toBeVisible();
  } finally {
    await context?.close();
    await stopSyntheticLifecycleServer(fixture.server);
    await rm(userDataDir, { recursive: true, force: true });
    await rm(extensionBaseDir, { recursive: true, force: true });
  }
});
