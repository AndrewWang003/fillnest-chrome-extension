import { E2E_EXTENSION_BUILD_DIR } from "../helpers/extension-build";
/**
 * Task 018 — Eligibility Lifecycle Regression Specifications
 *
 * These specifications prove the accepted Task 016 lifecycle capabilities
 * implemented by Task 018.
 *
 * Task 017 recorded their expected-red baseline. Task 018 converts them into
 * ordinary green regressions for generic observation, teardown, and recovery.
 */

import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  expect,
  test,
  type BrowserContext,
  type CDPSession,
  type Page,
} from "@playwright/test";

import {
  activateFixtureOrigin,
  directFieldListenerCount,
  extensionWorker,
  sendRuntimeRequest,
} from "../helpers/extension-e2e-session";
import { launchWithPermissionHistory } from "../helpers/prime-extension-permissions";
import {
  startSyntheticLifecycleServer,
  stopSyntheticLifecycleServer,
} from "../helpers/synthetic-lifecycle-server";

const ACTIVE_MARKER = "data-fillnest-extension-active";

interface LifecycleSession {
  page: Page;
  extensionPage: Page;
}

interface DurableFieldState {
  fieldProfiles: Array<{ id: string }>;
  bindings: Array<{ id: string; fieldProfileId: string }>;
}

interface LifecycleScenario {
  specId: string;
  description: string;
  fieldId: string;
  toggleId: string;
}

const TEMPORARY_INELIGIBLE_SCENARIOS: LifecycleScenario[] = [
  {
    specId: "SPEC-016-HIDE-01",
    description: "dynamic ancestor display:none toggle",
    fieldId: "display-none-field",
    toggleId: "btn-toggle-display-none",
  },
  {
    specId: "SPEC-016-HIDDEN-ATTR-01",
    description: "native hidden toggle",
    fieldId: "toggle-hidden-field",
    toggleId: "btn-toggle-hidden-attr",
  },
  {
    specId: "SPEC-016-DISABLED-01",
    description: "dynamic disabled toggle",
    fieldId: "toggle-disabled-field",
    toggleId: "btn-toggle-disabled",
  },
  {
    specId: "SPEC-016-READONLY-01",
    description: "dynamic readOnly toggle",
    fieldId: "toggle-readonly-field",
    toggleId: "btn-toggle-readonly",
  },
];

test.describe("Task 018 Lifecycle Specifications", () => {
  let context: BrowserContext | undefined;
  let fixture: { server: ReturnType<typeof import("node:http").createServer>; origin: string };
  let userDataDir: string;
  let extensionBaseDir: string;

  test.beforeEach(async () => {
    fixture = await startSyntheticLifecycleServer();
    userDataDir = await mkdtemp(join(tmpdir(), "fillnest-pending-e2e-"));
    extensionBaseDir = await mkdtemp(join(tmpdir(), "fillnest-extension-"));
    const extensionPath = join(extensionBaseDir, "extension");
    await cp(resolve(E2E_EXTENSION_BUILD_DIR), extensionPath, { recursive: true });
    const fixturePattern = `${fixture.origin}/*`;

    context = await launchWithPermissionHistory(userDataDir, extensionPath, [fixturePattern]);
  });

  test.afterEach(async () => {
    await context?.close();
    await stopSyntheticLifecycleServer(fixture.server);
    await rm(userDataDir, { recursive: true, force: true });
    await rm(extensionBaseDir, { recursive: true, force: true });
  });

  test("[SPEC-016-DYN-01] Proactive dynamic field observation without initial user focus", async () => {
    const { page } = await newActiveFixturePage();

    // Dynamically insert a text field
    await page.locator("#btn-add-dynamic-text").click();
    const dynField = page.locator("#dyn-text-field");
    await expect(dynField).toHaveCount(1);

    // Task 016 Requirement: Lifecycle observer scans dynamic DOM and prepares candidate/overlay
    // Current Product Behaviour: No MutationObserver; only document focusin listener is installed.
    // Expected in Task 018: Field is recognized proactively.
    await expect(
      page.locator("#dyn-text-field[data-fillnest-field]"),
      "Task 018: Dynamic field should be recognized proactively without focus",
    ).toHaveCount(1);
  });

  test("[SPEC-016-HYDRATE-01] A stable Field added after content startup restores its Binding after reopening the page", async () => {
    const first = await newActiveFixturePage("/delayed-hydration");
    await expect(first.page.locator("#hydrated-address-field")).toHaveCount(1);
    await createBoundOpenPicker(first, "hydrated-address-field", "Hydrated address baseline");
    await first.page.close();

    const reopened = await newActiveFixturePage("/delayed-hydration");
    await expect(reopened.page.locator("#hydrated-address-field")).toHaveCount(1);
    await reopened.page.locator("#hydrated-address-field").focus();
    await reopened.page.getByRole("button", { name: "Open FillNest" }).click();
    await expect(reopened.page.getByText("Hydrated address baseline")).toBeVisible();
  });

  test("[SPEC-016-REPLACE-01] A replacement Field without reliable evidence does not inherit the detached Field Binding", async () => {
    const session = await newActiveFixturePage();
    const original = session.page.locator("#replace-target");

    await original.focus();
    await session.page.getByRole("button", { name: "Open FillNest" }).click();
    await session.page.getByRole("button", { name: "New template" }).click();
    await session.page.getByRole("textbox", { name: "Template content" }).fill("Replacement baseline");
    await session.page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(session.page.getByRole("status")).toHaveText(/(?:Saved and bound|Bound .*) to this field\./u);
    const durableState = await readDurableState(session.extensionPage);
    expect(durableState.fieldProfiles).toHaveLength(1);
    expect(durableState.bindings).toHaveLength(1);
    expect(durableState.bindings[0]?.fieldProfileId).toBe(durableState.fieldProfiles[0]?.id);
    const originalHandle = await original.elementHandle();
    if (originalHandle === null) throw new Error("Task 018 replacement fixture target is unavailable");
    const originalLabel = await session.page.locator('label[for="replace-target"]').textContent();
    const originalAttributes = await original.evaluate((field) => ({
      name: field.getAttribute("name"),
      type: field.getAttribute("type"),
      value: field.getAttribute("value"),
    }));

    await session.page.evaluate(() => {
      document.querySelector<HTMLButtonElement>("#btn-replace-field")?.click();
    });
    await expect(session.page.getByRole("region", { name: "FillNest templates" })).toHaveCount(0);
    expect(await originalHandle.evaluate((field) => field.isConnected)).toBe(false);

    const replacement = session.page.locator("#replace-target");
    await expect(session.page.locator('label[for="replace-target"]')).toHaveText(originalLabel ?? "");
    await expect(replacement).toHaveAttribute("name", originalAttributes.name ?? "");
    await expect(replacement).toHaveAttribute("type", originalAttributes.type ?? "");
    await expect(replacement).toHaveAttribute("value", originalAttributes.value ?? "");
    await replacement.focus();
    await session.page.getByRole("button", { name: "Open FillNest" }).click();
    await expect(
      session.page.getByText("No saved match for this field."),
      "Task 018: A replacement Field without accepted reliable evidence must be recognized fresh and not inherit the detached Field Binding.",
    ).toBeVisible();
  });

  test("[SPEC-016-REPLACE-02] An unfocused replacement Field without reliable evidence does not inherit a Binding", async () => {
    const session = await newActiveFixturePage();
    await createBoundOpenPicker(session, "replace-target", "Unfocused replacement baseline");
    await session.page.getByRole("button", { name: "Close" }).click();
    await session.page.locator("#toggle-hidden-field").focus();

    await session.page.evaluate(() => {
      document.querySelector<HTMLButtonElement>("#btn-replace-field")?.click();
    });
    await session.page.locator("#replace-target").focus();
    await session.page.getByRole("button", { name: "Open FillNest" }).click();
    await expect(session.page.getByText("No saved match for this field.")).toBeVisible();
  });

  test("[SPEC-016-REPLACE-03] A semantic replacement with exact stable evidence recovers the Binding", async () => {
    const session = await newActiveFixturePage();
    await createBoundOpenPicker(session, "replace-semantic-target", "Semantic replacement baseline");
    await session.page.getByRole("button", { name: "Close" }).click();
    await session.page.locator("#toggle-hidden-field").focus();

    await session.page.evaluate(() => {
      document.querySelector<HTMLButtonElement>("#btn-replace-semantic-field")?.click();
    });
    await session.page.locator("#replace-semantic-target").focus();
    await session.page.getByRole("button", { name: "Open FillNest" }).click();
    await expect(session.page.getByText("Semantic replacement baseline")).toBeVisible();
  });

  test("[SPEC-016-OTP-01] A metadata change to OTP immediately tears down the Field interaction path", async () => {
    const session = await newActiveFixturePage();
    const auditSession = await context!.newCDPSession(session.page);
    await createBoundOpenPicker(session, "toggle-transition-field", "OTP transition baseline");

    await session.page.evaluate(() => {
      document.querySelector<HTMLButtonElement>("#btn-toggle-otp-autocomplete")?.click();
    });
    await expectLifecycleTeardown(session.page, auditSession, "toggle-transition-field", "SPEC-016-OTP-01");
  });

  test("[SPEC-016-PIN-01] A pinned Picker remains visible but disables the stale Field path", async () => {
    const session = await newActiveFixturePage();
    await createBoundOpenPicker(session, "toggle-hidden-field", "Pinned lifecycle baseline");
    await session.page.getByRole("button", { name: "Keep open" }).click();

    await session.page.evaluate(() => {
      document.querySelector<HTMLButtonElement>("#btn-toggle-hidden-attr")?.click();
    });

    await expect(session.page.getByRole("region", { name: "FillNest templates" })).toBeVisible();
    await expect(
      session.page.getByText("No usable field is focused. Insert and Bind are unavailable until you focus a supported field."),
    ).toBeVisible();
    await expect(session.page.locator("#toggle-hidden-field[data-fillnest-field]")).toHaveCount(0);
    await expect(session.page.locator("[data-template-content]")).toBeDisabled();
    await expect(session.page.getByRole("button", { name: "Remove from this field" })).toBeDisabled();
  });

  for (const scenario of TEMPORARY_INELIGIBLE_SCENARIOS) {
    test(`[${scenario.specId}] Complete lifecycle teardown and recovery upon ${scenario.description}`, async () => {
      const session = await newActiveFixturePage();
      const auditSession = await context!.newCDPSession(session.page);
      const durableState = await createBoundOpenPicker(session, scenario.fieldId, scenario.specId);

      // Host-page mutation must not depend on moving focus to the toggle button.
      await session.page.evaluate((toggleId) => {
        document.getElementById(toggleId)?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      }, scenario.toggleId);

      await expectLifecycleTeardown(session.page, auditSession, scenario.fieldId, scenario.specId);

      await session.page.evaluate((toggleId) => {
        document.getElementById(toggleId)?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      }, scenario.toggleId);
      await expect(
        session.page.getByRole("button", { name: "Open FillNest" }),
        `Task 018: ${scenario.specId} restored Field must have exactly one control`,
      ).toHaveCount(1);
      await expectDurableState(session.extensionPage, durableState, scenario.specId);
    });
  }

  async function newActiveFixturePage(path = ""): Promise<LifecycleSession> {
    const page = await context!.newPage();
    await page.goto(`${fixture.origin}${path}`);
    const worker = await extensionWorker(context!);
    const extensionId = new URL(worker.url()).host;
    const extensionPage = await activateFixtureOrigin(context!, worker, extensionId, page, fixture.origin);
    await expect(page.locator(`html[${ACTIVE_MARKER}]`)).toHaveCount(1);
    return { page, extensionPage };
  }

  async function createBoundOpenPicker(
    session: LifecycleSession,
    fieldId: string,
    templateContent: string,
  ): Promise<DurableFieldState> {
    const target = session.page.locator(`#${fieldId}`);
    await target.focus();
    await expect(session.page.getByRole("button", { name: "Open FillNest" })).toHaveCount(1);
    await session.page.getByRole("button", { name: "Open FillNest" }).click();
    await expect(session.page.getByRole("region", { name: "FillNest templates" })).toBeVisible();
    await session.page.getByRole("button", { name: "New template" }).click();
    await session.page.getByRole("textbox", { name: "Template content" }).fill(templateContent);
    await session.page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(session.page.getByRole("status")).toHaveText(/(?:Saved and bound|Bound .*) to this field\./u);
    return readDurableState(session.extensionPage);
  }

  async function expectLifecycleTeardown(
    page: Page,
    auditSession: CDPSession,
    fieldId: string,
    specId: string,
  ): Promise<void> {
    await expect(
      page.getByRole("region", { name: "FillNest templates" }),
      `Task 018: ${specId} must close the open Picker for an unavailable target`,
    ).toHaveCount(0);
    await expect(
      page.locator(`#${fieldId}[data-fillnest-field]`),
      `Task 018: ${specId} must remove the target marker`,
    ).toHaveCount(0);
    expect(
      await directFieldListenerCount(auditSession, fieldId),
      `Task 018: ${specId} must leave no direct per-Field listener`,
    ).toBe(0);
    await expect(
      page.getByRole("button", { name: "Open FillNest" }),
      `Task 018: ${specId} must remove the target insertion path`,
    ).toHaveCount(0);
  }

  async function readDurableState(extensionPage: Page): Promise<DurableFieldState> {
    const response = await sendRuntimeRequest(extensionPage, { type: "READ_STATE" });
    if (!response.ok || response.value === undefined) throw new Error("Task 018 fixture state is unavailable");
    return response.value as DurableFieldState;
  }

  async function expectDurableState(
    extensionPage: Page,
    before: DurableFieldState,
    specId: string,
  ): Promise<void> {
    const after = await readDurableState(extensionPage);
    expect(after.fieldProfiles.map(({ id }) => id), `Task 018: ${specId} must retain FieldProfile`).toEqual(
      expect.arrayContaining(before.fieldProfiles.map(({ id }) => id)),
    );
    expect(after.bindings.map(({ id }) => id), `Task 018: ${specId} must retain Binding`).toEqual(
      expect.arrayContaining(before.bindings.map(({ id }) => id)),
    );
  }
});
