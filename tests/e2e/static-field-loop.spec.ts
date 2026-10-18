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

import { monitorRuntimeNetwork } from "../helpers/runtime-network-allowlist";
import { launchWithPermissionHistory } from "../helpers/prime-extension-permissions";

const ACTIVE_MARKER = "data-fillnest-extension-active";
const execFileAsync = promisify(execFile);

interface RuntimeHarnessResponse {
  ok: boolean;
  value?: unknown;
  error?: string;
}

test("static fields preserve privacy and support the explicit Picker loop", async () => {
  test.setTimeout(60_000);
  const fixture = await startFixtureServer();
  const userDataDir = await mkdtemp(join(tmpdir(), "fillnest-static-"));
  const extensionBaseDir = await mkdtemp(join(tmpdir(), "fillnest-extension-"));
  const extensionPath = join(extensionBaseDir, "extension");
  await cp(resolve(E2E_EXTENSION_BUILD_DIR), extensionPath, { recursive: true });
  const fixturePattern = `${fixture.origin}/*`;
  let context: BrowserContext | undefined;

  try {
    context = await launchWithPermissionHistory(userDataDir, extensionPath, [fixturePattern]);
    const networkMonitor = monitorRuntimeNetwork(context, new Set([fixture.origin]));
    const worker = await extensionWorker(context);
    const extensionId = new URL(worker.url()).host;
    const fixturePage = await context.newPage();
    await fixturePage.goto(`${fixture.origin}/pages/forms/text-inputs?utm_source=chatgpt.com`);
    await expect(fixturePage.locator(`html[${ACTIVE_MARKER}]`)).toHaveCount(0);
    const extensionPage = await openExtensionPage(context, extensionId);
    await grantOrigin(worker, extensionPage, fixturePage, fixture.origin);
    await expect(fixturePage.locator(`html[${ACTIVE_MARKER}]`)).toHaveCount(1);
    await installValueReadInstrumentation(fixturePage, extensionId);

    await seedTemplates(extensionPage, fixture.origin);
    await verifyConcurrentPersistence(extensionPage, fixture.origin);
    await verifyUntrustedPageActionsAreBlocked(fixturePage, extensionPage);
    await verifyEligibilityAndPrivacy(fixturePage);
    await verifyCreateFlow(fixturePage, extensionPage);
    await verifyTrackingAndStructuralBindingRestore(fixturePage);
    await verifySearchAndBinding(fixturePage, extensionPage);
    await verifyCursorInsertion(fixturePage);
    await verifyEmailCursorInsertion(fixturePage);
    await verifySelectionInsertion(fixturePage);
    await verifyEligibilityRevalidation(fixturePage);
    await verifyConservativeRecognition(context, extensionPage, fixture.origin);
    expect(networkMonitor.violations).toEqual([]);
    console.log(
      `Runtime network evidence: ${networkMonitor.requests.length} allowed Fixture Origin requests; 0 violations`,
    );
  } finally {
    await context?.close();
    await stopFixtureServer(fixture.server);
    await rm(userDataDir, { recursive: true, force: true });
    await rm(extensionBaseDir, { recursive: true, force: true });
  }
});

async function verifyEligibilityAndPrivacy(page: Page): Promise<void> {
  const supported = [
    "textarea-field",
    "text-field",
    "missing-type",
    "invalid-type",
    "search-field",
    "email-field",
    "tel-field",
    "url-field",
    "date-notes-field",
    "start-date",
    "short-field",
    "ordinary-field",
    "tall-field",
  ];
  for (const id of supported) {
    await page.locator(`#${id}`).focus();
    await expect(page.getByRole("button", { name: "Open FillNest" })).toHaveCount(1);
    await expect(page.getByRole("region", { name: "FillNest templates" })).toHaveCount(0);
    expect(await readCount(page, id)).toBe(0);
  }
  await expectAdaptiveFieldControlGeometry(page);

  const excluded = [
    "password-field",
    "number-field",
    "date-field",
    "script-date-picker",
    "controlled-date-field",
    "controlled-country-field",
    "implicit-country-field",
    "spinbutton-field",
    "payment-field",
    "otp-field",
    "section-otp-field",
    "label-card-field",
    "readonly-field",
    "hidden-field",
    "disabled-field",
    "editable-div",
  ];
  for (const id of excluded) {
    await page.locator(`#${id}`).focus();
    await expect(page.getByRole("button", { name: "Open FillNest" })).toHaveCount(0);
    await expect(page.locator(`#${id}[data-fillnest-field]`)).toHaveCount(0);
    expect(await readCount(page, id)).toBe(0);
  }

  const sentinelBefore = await page.locator("#host-sentinel").evaluate((element) => ({
    className: element.className,
    style: element.getAttribute("style"),
    computed: {
      display: getComputedStyle(element).display,
      position: getComputedStyle(element).position,
      padding: getComputedStyle(element).padding,
    },
  }));
  const fieldAttributesBefore = await page.locator("#bind-field").evaluate((element) => ({
    className: element.className,
    style: element.getAttribute("style"),
    computed: {
      display: getComputedStyle(element).display,
      position: getComputedStyle(element).position,
      padding: getComputedStyle(element).padding,
    },
  }));
  await page.locator("#bind-field").focus();
  const fieldBox = await page.locator("#bind-field").boundingBox();
  const control = page.getByRole("button", { name: "Open FillNest" });
  const controlBox = await control.boundingBox();
  if (!fieldBox || !controlBox) throw new Error("Positioning boxes unavailable");
  expect(Math.min(Math.abs(controlBox.x - (fieldBox.x + fieldBox.width)), Math.abs(fieldBox.x - (controlBox.x + controlBox.width)))).toBeLessThanOrEqual(12);
  expect(controlBox.x >= fieldBox.x + fieldBox.width || controlBox.x + controlBox.width <= fieldBox.x).toBe(true);
  expect(await control.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(
    "rgb(255, 255, 255)",
  );

  await control.click();
  const picker = page.getByRole("region", { name: "FillNest templates" });
  await expect(picker).toBeVisible();
  const pickerBox = await picker.boundingBox();
  if (!pickerBox) throw new Error("Picker box unavailable");
  expect(Math.abs(pickerBox.y - (controlBox.y + controlBox.height))).toBeLessThanOrEqual(12);
  expect(pickerBox.x).toBeGreaterThanOrEqual(0);
  expect(pickerBox.y).toBeGreaterThanOrEqual(0);
  expect(pickerBox.x + pickerBox.width).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
  expect(pickerBox.y + pickerBox.height).toBeLessThanOrEqual(await page.evaluate(() => innerHeight));
  expect(await picker.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(
    "rgb(255, 255, 255)",
  );
  expect(await page.locator("#host-sentinel").evaluate((element) => ({
    className: element.className,
    style: element.getAttribute("style"),
    computed: {
      display: getComputedStyle(element).display,
      position: getComputedStyle(element).position,
      padding: getComputedStyle(element).padding,
    },
  }))).toEqual(sentinelBefore);
  expect(await page.locator("#bind-field").evaluate((element) => ({
    className: element.className,
    style: element.getAttribute("style"),
    computed: {
      display: getComputedStyle(element).display,
      position: getComputedStyle(element).position,
      padding: getComputedStyle(element).padding,
    },
  }))).toEqual(fieldAttributesBefore);

  const oldControlX = controlBox.x;
  await page.evaluate(() => {
    const sentinel = document.querySelector<HTMLElement>("#host-sentinel");
    if (sentinel) sentinel.style.marginLeft = "40px";
  });
  await expect.poll(async () => (await control.boundingBox())?.x).not.toBe(oldControlX);
  const shiftedFieldBox = await page.locator("#bind-field").boundingBox();
  const shiftedControlBox = await control.boundingBox();
  if (!shiftedFieldBox || !shiftedControlBox) throw new Error("Shifted boxes unavailable");
  expect(Math.min(Math.abs(shiftedControlBox.x - (shiftedFieldBox.x + shiftedFieldBox.width)), Math.abs(shiftedFieldBox.x - (shiftedControlBox.x + shiftedControlBox.width)))).toBeLessThanOrEqual(12);
  await expectPickerAnchoring(page, control);

  const controlYBeforeScroll = shiftedControlBox.y;
  await page.evaluate(() => window.scrollBy(0, 20));
  await expect.poll(async () => (await control.boundingBox())?.y).not.toBe(controlYBeforeScroll);
  const scrolledFieldBox = await page.locator("#bind-field").boundingBox();
  const scrolledControlBox = await control.boundingBox();
  if (!scrolledFieldBox || !scrolledControlBox) throw new Error("Scrolled boxes unavailable");
  expect(Math.abs(scrolledControlBox.y - scrolledFieldBox.y)).toBeLessThanOrEqual(12);
  await expectPickerAnchoring(page, control);

  await page.setViewportSize({ width: 1024, height: 700 });
  await expect
    .poll(async () => {
      const resizedFieldBox = await page.locator("#bind-field").boundingBox();
      const resizedControlBox = await control.boundingBox();
      if (!resizedFieldBox || !resizedControlBox) return Number.POSITIVE_INFINITY;
      return Math.min(
        Math.abs(resizedControlBox.x - (resizedFieldBox.x + resizedFieldBox.width)),
        Math.abs(resizedFieldBox.x - (resizedControlBox.x + resizedControlBox.width)),
      );
    })
    .toBeLessThanOrEqual(12);
  await expectPickerAnchoring(page, control);
  await page.locator("#bind-field").evaluate((field: HTMLInputElement) => {
    field.style.position = "fixed";
    field.style.top = "auto";
    field.style.bottom = "4px";
  });
  await expect
    .poll(async () => {
      const currentControl = await control.boundingBox();
      const currentPicker = await picker.boundingBox();
      if (!currentControl || !currentPicker) return false;
      const viewportHeight = await page.evaluate(() => innerHeight);
      return (
        currentPicker.y + currentPicker.height <= viewportHeight &&
        currentPicker.y < currentControl.y
      );
    })
    .toBe(true);
  await expectPickerAnchoring(page, control);
  await page.locator("#bind-field").evaluate((field: HTMLInputElement) => {
    field.removeAttribute("style");
  });
  expect(await readCount(page, "bind-field")).toBe(0);
}

async function expectPickerAnchoring(page: Page, control: ReturnType<Page["getByRole"]>): Promise<void> {
  const picker = page.getByRole("region", { name: "FillNest templates" });
  // The Picker's own content (and thus its height) can still be settling via
  // a Preact re-render a frame or two after a viewport/layout change, with
  // the content script's rAF-driven repositioning loop catching up shortly
  // after - the same class of timing every neighbouring assertion in this
  // function already absorbs with expect.poll rather than a one-shot read.
  await expect
    .poll(async () => {
      const controlBox = await control.boundingBox();
      const pickerBox = await picker.boundingBox();
      if (!controlBox || !pickerBox) return Number.POSITIVE_INFINITY;
      return Math.min(
        Math.abs(pickerBox.y - (controlBox.y + controlBox.height)),
        Math.abs(controlBox.y - (pickerBox.y + pickerBox.height)),
      );
    })
    .toBeLessThanOrEqual(12);
  const controlBox = await control.boundingBox();
  const pickerBox = await picker.boundingBox();
  if (!controlBox || !pickerBox) throw new Error("Picker anchor boxes unavailable");
  expect(pickerBox.x).toBeGreaterThanOrEqual(0);
  expect(pickerBox.y).toBeGreaterThanOrEqual(0);
  expect(pickerBox.x + pickerBox.width).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
  expect(pickerBox.y + pickerBox.height).toBeLessThanOrEqual(await page.evaluate(() => innerHeight));
}

async function expectAdaptiveFieldControlGeometry(page: Page): Promise<void> {
  const cases = [
    ["short-field", 24],
    ["ordinary-field", 28],
    ["tall-field", 32],
  ] as const;
  for (const [fieldId, expectedSize] of cases) {
    await page.locator(`#${fieldId}`).focus();
    const control = page.getByRole("button", { name: "Open FillNest" });
    const box = await control.boundingBox();
    if (!box) throw new Error(`Control geometry unavailable for ${fieldId}`);
    expect(box.width).toBe(expectedSize);
    expect(box.height).toBe(expectedSize);
    await expect(control.locator('svg[data-fillnest-icon="field-control"]')).toHaveCount(1);
  }
}

async function verifyUntrustedPageActionsAreBlocked(
  page: Page,
  extensionPage: Page,
): Promise<void> {
  await page.locator("#text-field").focus();
  await page.evaluate(() => {
    document
      .querySelector<HTMLElement>("[data-fillnest-overlay]")
      ?.shadowRoot?.querySelector<HTMLButtonElement>('button[aria-label="Open FillNest"]')
      ?.click();
  });
  await expect(page.getByRole("region", { name: "FillNest templates" })).toHaveCount(0);

  await page.getByRole("button", { name: "Open FillNest" }).click();
  console.log("verifySearchAndBinding: picker opened");
  await hostilePickerClick(page, "New template");
  await expect(page.getByRole("textbox", { name: "Template content" })).toHaveCount(0);
  console.log("verifySearchAndBinding: search box");
  await page.getByRole("searchbox", { name: "Search templates" }).fill("replacement");
  const valueBefore = await page.locator("#text-field").inputValue();
  await page.evaluate(() => {
    const buttons = document
      .querySelector<HTMLElement>("[data-fillnest-overlay]")
      ?.shadowRoot?.querySelectorAll<HTMLButtonElement>("button");
    [...(buttons ?? [])].find((button) => button.textContent === "replacement")?.click();
    [...(buttons ?? [])].find((button) => button.textContent === "Bind")?.click();
  });
  await expect(page.locator("#text-field")).toHaveValue(valueBefore);
  await expect(page.getByRole("status")).toHaveCount(0);

  await page.locator("#create-field").focus();
  await page.getByRole("button", { name: "Open FillNest" }).click();
  await page.getByRole("button", { name: "New template" }).click();
  const editor = page.getByRole("textbox", { name: "Template content" });
  await hostilePickerClick(page, "Use field content");
  await expect(editor).toHaveValue("");
  expect(await readCount(page, "create-field")).toBe(0);
  await editor.fill("Synthetic Save must fail");
  await hostilePickerClick(page, "Save");
  await expect(page.getByRole("status")).toHaveCount(0);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  console.log("verifySearchAndBinding: waiting for status");
  await expect(page.getByRole("status")).toHaveText(/(?:Saved and bound|Bound .*) to this field\./u);
  console.log("verifySearchAndBinding: status received");
  await hostilePickerClick(page, "Remove from this field");
  await expect(page.getByRole("status")).toHaveText(/(?:Saved and bound|Bound .*) to this field\./u);
  const state = await sendRuntimeRequest(extensionPage, { type: "READ_STATE" });
  const stored = state.value as {
    templates: Array<{ id: string; content: string }>;
    bindings: Array<{ templateId: string }>;
  };
  const template = stored.templates.find(
    (candidate) => candidate.content === "Synthetic Save must fail",
  );
  expect(template).toBeDefined();
  expect(stored.bindings.some((binding) => binding.templateId === template?.id)).toBe(true);
  await page
    .locator("li", { hasText: "Synthetic Save must fail" })
    .getByRole("button", { name: "Remove from this field" })
    .click();
  await page.locator("#password-field").focus();
}

async function hostilePickerClick(page: Page, label: string): Promise<void> {
  await page.evaluate((buttonLabel) => {
    const buttons = document
      .querySelector<HTMLElement>("[data-fillnest-overlay]")
      ?.shadowRoot?.querySelectorAll<HTMLButtonElement>("button");
    [...(buttons ?? [])].find((button) => button.textContent === buttonLabel)?.click();
  }, label);
}

async function verifyCreateFlow(page: Page, extensionPage: Page): Promise<void> {
  await page.locator("#create-field").focus();
  await page.getByRole("button", { name: "Open FillNest" }).click();
  await page.getByRole("button", { name: "New template" }).click();
  const editor = page.getByRole("textbox", { name: "Template content" });
  await expect(editor).toHaveValue("");
  expect(await readCount(page, "create-field")).toBe(0);

  await page.getByRole("button", { name: "Use field content" }).click();
  await expect(editor).toHaveValue("Create me literally");
  expect(await readCount(page, "create-field")).toBe(1);
  expect(await readCount(page, "sibling-field")).toBe(0);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText(/(?:Saved and bound|Bound .*) to this field\./u);
  await expect(page.getByRole("button", { name: "Create me literally" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove from this field" })).toBeVisible();

  const state = await sendRuntimeRequest(extensionPage, { type: "READ_STATE" });
  expect(state).toEqual(
    expect.objectContaining({
      ok: true,
      value: expect.objectContaining({
        templates: expect.arrayContaining([
          expect.objectContaining({
            content: "Create me literally",
            siteAffinities: ["127.0.0.1"],
          }),
        ]),
        bindings: expect.arrayContaining([
          expect.objectContaining({
            templateId: expect.any(String),
            fieldProfileId: expect.any(String),
          }),
        ]),
      }),
    }),
  );

  await page.getByRole("button", { name: "Remove from this field" }).click();
  await expect(page.getByRole("status")).toHaveText(/Removed .* from this field · Now in Global templates\./u);
  await expect(page.getByText("No templates bound to this field.")).toBeVisible();
  const unboundState = await sendRuntimeRequest(extensionPage, { type: "READ_STATE" });
  expect(unboundState).toEqual(
    expect.objectContaining({
      ok: true,
      value: expect.objectContaining({
        templates: expect.arrayContaining([
          expect.objectContaining({ content: "Create me literally" }),
        ]),
      }),
    }),
  );
  expect(
    (unboundState.value as { bindings: Array<{ templateId: string }> }).bindings.some(
      (binding) =>
        (unboundState.value as { templates: Array<{ id: string; content: string }> }).templates.some(
          (template) =>
            template.id === binding.templateId && template.content === "Create me literally",
        ),
    ),
  ).toBe(false);
}

async function verifyTrackingAndStructuralBindingRestore(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.body.insertAdjacentHTML(
      "beforeend",
      '<input type="text" data-test-unlabelled-field aria-label="Temporary test destination">',
    );
  });
  const field = page.locator('[data-test-unlabelled-field]');
  await field.focus();
  await page.getByRole("button", { name: "Open FillNest" }).click();
  await page.getByRole("button", { name: "New template" }).click();
  await page.getByRole("textbox", { name: "Template content" }).fill("Tracking-safe binding");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText(/(?:Saved and bound|Bound .*) to this field\./u);
  await page.getByRole("button", { name: "Close" }).click();

  await page.locator("#text-field").focus();
  await field.focus();
  await page.getByRole("button", { name: "Open FillNest" }).click();
  await expect(page.getByRole("heading", { name: "This field" })).toBeVisible();
  await expect(page.getByText("Tracking-safe binding", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
}

async function verifySearchAndBinding(page: Page, extensionPage: Page): Promise<void> {
  console.log("verifySearchAndBinding: start");
  await page.locator("#bind-field").focus();
  await page.getByRole("button", { name: "Open FillNest" }).click();
  await expect(page.getByText("No saved match for this field.")).toBeVisible();
  const search = page.getByRole("searchbox", { name: "Search templates" });
  await search.fill("bound candidate");
  await expect(page.getByRole("button", { name: "Bound candidate", exact: true })).toHaveCount(1);
  // Deliberate Search is full-library in Task 005 remediation. A different
  // Site's Template can be found, but it does not bind until the user clicks
  // Bind from the real Target Field.
  await expect(page.getByText("Bound candidate wrong site")).toBeVisible();

  const row = page.locator("[data-template-row]", { hasText: "Bound candidate" }).first();
  const beforeHover = await row.boundingBox();
  await row.hover();
  const afterHover = await row.boundingBox();
  expect(afterHover?.width).toEqual(beforeHover?.width);
  expect(afterHover?.height).toEqual(beforeHover?.height);
  await row.getByRole("button", { name: "Bind" }).focus();
  const afterFocus = await row.boundingBox();
  expect(afterFocus?.width).toEqual(beforeHover?.width);
  expect(afterFocus?.height).toEqual(beforeHover?.height);

  console.log("verifySearchAndBinding: about to click Bind");
  await row.getByRole("button", { name: "Bind" }).click();
  console.log("verifySearchAndBinding: Bind clicked");
  await expect(page.getByRole("region", { name: "FillNest templates" })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText(/(?:Saved and bound|Bound .*) to this field\./u);
  console.log("verifySearchAndBinding: checking filtered count");
  await expect(page.getByRole("button", { name: "Bound candidate", exact: true })).toHaveCount(1);
  await expect(row.getByRole("button", { name: "Remove from this field" })).toBeVisible();
  await expect(row.getByRole("button", { name: "Bind", exact: true })).toHaveCount(0);
  console.log("verifySearchAndBinding: filtered count ok");
  await expect(page.locator("#bind-field")).toHaveValue("Do not change");
  expect(await eventLog(page, "bind-field")).toEqual([]);
  expect(await readCount(page, "bind-field")).toBe(0);

  await page.locator("#bind-field").focus();
  await page.getByRole("button", { name: "Open FillNest" }).click();
  await expect(page.getByRole("button", { name: "Bound candidate" })).toBeVisible();
  await page
    .getByRole("region", { name: "FillNest templates" })
    .screenshot({ path: "output/playwright/task002-picker.png" });
  const state = await sendRuntimeRequest(extensionPage, { type: "READ_STATE" });
  expect(state).toEqual(
    expect.objectContaining({
      ok: true,
      value: expect.objectContaining({
        bindings: expect.arrayContaining([expect.objectContaining({})]),
      }),
    }),
  );
}

async function verifyCursorInsertion(page: Page): Promise<void> {
  console.log("verifyCursorInsertion: start");
  await page.locator("#text-field").focus();
  await page.locator("#text-field").evaluate((field: HTMLInputElement) =>
    field.setSelectionRange(6, 6),
  );
  await page.getByRole("button", { name: "Open FillNest" }).click();
  await page.getByRole("searchbox", { name: "Search templates" }).fill("img src=x");
  await page.getByRole("button", { name: /<img src=x/u }).click();

  const payload = '<img src=x onerror="window.pwned=true"><script>boom()</script>';
  await expect(page.locator("#text-field")).toHaveValue(`Hello ${payload}world`);
  expect(await eventLog(page, "text-field")).toEqual([
    {
      type: "input",
      constructor: "InputEvent",
      inputType: "insertText",
      data: payload,
      bubbles: true,
      composed: true,
      cancelable: false,
    },
    {
      type: "change",
      constructor: "Event",
      inputType: null,
      data: null,
      bubbles: true,
      composed: false,
      cancelable: false,
    },
  ]);
  expect(await eventLog(page, "sibling-field")).toEqual([]);
  await expect(page.locator("#sibling-field")).toHaveValue("Sibling untouched");
  console.log("verifySelectionInsertion: mid");
  expect(await page.locator("img[src='x']").count()).toBe(0);
  expect(await page.locator("script").count()).toBe(1);
  expect(await page.evaluate(() => window.pwned)).toBe(false);
  expect(await page.evaluate(() => window.submitCount)).toBe(0);
  expect(await readCount(page, "text-field")).toBe(0);
  expect(await page.evaluate(() => document.activeElement?.id)).toBe("text-field");
  expect(await page.locator("#text-field").evaluate((field: HTMLInputElement) => [field.selectionStart, field.selectionEnd])).toEqual([
    6 + payload.length,
    6 + payload.length,
  ]);
  await expect(page.getByRole("region", { name: "FillNest templates" })).toHaveCount(0);
  console.log("verifyCursorInsertion: end");
}

async function verifyEmailCursorInsertion(page: Page): Promise<void> {
  console.log("verifyEmailCursorInsertion: start");
  const field = page.locator("#email-field");
  await field.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.press("ArrowLeft");
  for (let index = 0; index < 7; index += 1) await page.keyboard.press("ArrowRight");
  await page.getByRole("button", { name: "Open FillNest" }).click();
  await page.getByRole("searchbox", { name: "Search templates" }).fill("email-cursor");
  await page.getByRole("button", { name: "email-cursor" }).click();

  await expect(field).toHaveValue("person@email-cursorexample.test");
  expect(await eventLog(page, "email-field")).toEqual([
    {
      type: "input",
      constructor: "InputEvent",
      inputType: "insertText",
      data: "email-cursor",
      bubbles: true,
      composed: true,
      cancelable: false,
    },
    {
      type: "change",
      constructor: "Event",
      inputType: null,
      data: null,
      bubbles: true,
      composed: false,
      cancelable: false,
    },
  ]);
  expect(await readCount(page, "email-field")).toBe(0);
  console.log("verifyEmailCursorInsertion: end");
}

async function verifyEligibilityRevalidation(page: Page): Promise<void> {
  console.log("verifyEligibilityRevalidation: start");
  const field = page.locator("#url-field");
  await field.evaluate((target: HTMLInputElement) => target.setSelectionRange(0, 5));
  await field.focus();
  await page.getByRole("button", { name: "Open FillNest" }).click();
  await expect(page.locator("[data-fillnest-selection-preview]")).toHaveCount(1);
  await page.getByRole("searchbox", { name: "Search templates" }).fill("replacement");
  const valueBefore = await field.inputValue();
  const replacement = page.getByRole("button", { name: "replacement" });
  await replacement.evaluate((button) => {
    button.addEventListener(
      "pointerdown",
      () => {
        const target = document.querySelector<HTMLInputElement>("#url-field");
        if (target) target.readOnly = true;
      },
      { once: true },
    );
  });
  await replacement.click();
  await expect(page.getByRole("region", { name: "FillNest templates" })).toHaveCount(0);
  await expect(page.locator("[data-fillnest-selection-preview]")).toHaveCount(0);
  await expect(field).toHaveValue(valueBefore);
  expect(await eventLog(page, "url-field")).toEqual([]);

  await page.locator("#text-field").focus();
  await page.getByRole("button", { name: "Open FillNest" }).click();
  await page.locator("#text-field").evaluate((target: HTMLInputElement) => {
    target.type = "password";
  });
  console.log("verifyEligibilityRevalidation: end");
  await expect(page.locator("[data-fillnest-overlay]")).toHaveCount(0);
}

async function verifySelectionInsertion(page: Page): Promise<void> {
  console.log("verifySelectionInsertion: start");
  await page.locator("#replace-field").focus();
  await page.locator("#replace-field").evaluate((field: HTMLInputElement) =>
    field.setSelectionRange(7, 13),
  );
  await page.getByRole("button", { name: "Open FillNest" }).click();
  await page.getByRole("searchbox", { name: "Search templates" }).fill("replacement");
  const selectionPreview = page.locator("[data-fillnest-selection-preview]");
  await expect(selectionPreview).toHaveCount(1);
  await expect(selectionPreview).toHaveAttribute("aria-hidden", "true");
  const previewGeometry = await selectionPreview.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const field = document.querySelector<HTMLInputElement>("#replace-field");
    if (!field) throw new Error("Target Field unavailable");
    const fieldBounds = field.getBoundingClientRect();
    return {
      withinField:
        bounds.left >= fieldBounds.left &&
        bounds.right <= fieldBounds.right &&
        bounds.top >= fieldBounds.top &&
        bounds.bottom <= fieldBounds.bottom,
      background: getComputedStyle(element).backgroundColor,
    };
  });
  expect(previewGeometry.withinField).toBe(true);
  expect(previewGeometry.background).not.toBe("rgba(0, 0, 0, 0)");

  await page.locator("#sibling-field").focus();
  await expect(selectionPreview).toHaveCount(0);
  await page.locator("#replace-field").focus();
  await page.locator("#replace-field").evaluate((field: HTMLInputElement) =>
    field.setSelectionRange(7, 13),
  );
  await page.getByRole("button", { name: "Open FillNest" }).click();
  await page.getByRole("searchbox", { name: "Search templates" }).fill("replacement");
  await expect(selectionPreview).toHaveCount(1);
  await page.getByRole("button", { name: "replacement" }).click();

  await expect(page.locator("#replace-field")).toHaveValue("before replacement after");
  console.log("verifySelectionInsertion: end");
  const events = await eventLog(page, "replace-field");
  expect(events).toEqual([
    {
      type: "input",
      constructor: "InputEvent",
      inputType: "insertReplacementText",
      data: "replacement",
      bubbles: true,
      composed: true,
      cancelable: false,
    },
    {
      type: "change",
      constructor: "Event",
      inputType: null,
      data: null,
      bubbles: true,
      composed: false,
      cancelable: false,
    },
  ]);
  expect(await page.evaluate(() => window.submitCount)).toBe(0);
  expect(await readCount(page, "replace-field")).toBe(2);
  expect(await page.evaluate(() => document.activeElement?.id)).toBe("replace-field");
  expect(await page.locator("#replace-field").evaluate((field: HTMLInputElement) => [field.selectionStart, field.selectionEnd])).toEqual([
    18,
    18,
  ]);
  await expect(selectionPreview).toHaveCount(0);

  await page.evaluate(() => {
    const field = document.createElement("input");
    field.id = "disconnect-selection-field";
    field.type = "text";
    field.value = "temporary selection";
    document.body.append(field);
    field.focus();
    field.setSelectionRange(0, 9);
  });
  await page.getByRole("button", { name: "Open FillNest" }).click();
  await expect(selectionPreview).toHaveCount(1);
  await page.locator("#disconnect-selection-field").evaluate((field) => field.remove());
  await expect(selectionPreview).toHaveCount(0);
}

async function verifyConservativeRecognition(
  context: BrowserContext,
  extensionPage: Page,
  origin: string,
): Promise<void> {
  console.log("verifyConservativeRecognition: start");
  const records = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
  console.log("verifyConservativeRecognition: records prepared");
  const names = [
    `Morgan-${crypto.randomUUID()}`,
    `Taylor-${crypto.randomUUID()}`,
    `Jordan-${crypto.randomUUID()}`,
  ];
  const created = await sendRuntimeRequest(extensionPage, {
    type: "CREATE_TEMPLATE",
    content: "Recognition template",
    pageUrl: `${origin}/customers/${records[0]}/edit`,
  });
  expect(created.ok).toBe(true);

  const page = await context.newPage();
  for (const [index, recordId] of records.entries()) {
    await page.goto(
      `${origin}/customers/${recordId}/edit?record=${recordId}&name=${encodeURIComponent(names[index] ?? "")}`,
    );
    console.log(`verifyConservativeRecognition: navigated to record ${index}`);
    const email = page.locator('input[name="contact_email"]');
    await email.focus();
    console.log(`verifyConservativeRecognition: focused email ${index}`);
    await page.getByRole("button", { name: "Open FillNest" }).click();
    console.log(`verifyConservativeRecognition: opened picker ${index}`);
    if (index === 0) {
      console.log(`verifyConservativeRecognition: search mode ${index}`);
      await page.getByRole("searchbox", { name: "Search templates" }).fill(
        "Recognition template",
      );
      console.log(`verifyConservativeRecognition: filled search ${index}`);
      await page.getByRole("button", { name: "Bind" }).click();
      await expect(page.getByRole("status")).toHaveText(/(?:Saved and bound|Bound .*) to this field\./u);
      console.log(`verifyConservativeRecognition: index ${index} bound`);
    } else {
      await expect(
        page.getByRole("button", { name: "Recognition template" }),
      ).toBeVisible();
      console.log(`verifyConservativeRecognition: index ${index} visible`);
    }
  }

  console.log("verifyConservativeRecognition: clicking spa-next");
  await page.locator("#spa-next").click();
  console.log("verifyConservativeRecognition: spa-next clicked");
  await expect(page.locator(`[${ACTIVE_MARKER}]`)).toHaveCount(1);
  await expect(page.locator("[data-fillnest-overlay]")).toHaveCount(0);
  const spaEmail = page.locator('input[name="contact_email"]');
  await spaEmail.focus();
  console.log("verifyConservativeRecognition: spa email focused");
  await expect(page.getByRole("button", { name: "Open FillNest" })).toHaveCount(1);
  await page.getByRole("button", { name: "Open FillNest" }).click();
  await expect(page.getByRole("button", { name: "Recognition template" })).toBeVisible();
  await page.getByRole("button", { name: "Recognition template" }).click();
  await expect(spaEmail).toHaveValue("Recognition template");
  await expect(spaEmail).toHaveAttribute("data-input-count", "1");
  await expect(spaEmail).toHaveAttribute("data-change-count", "1");

  await page.locator("#reveal-conditional").click();
  const conditional = page.locator('input[name="conditional_note"]');
  await conditional.focus();
  await expect(page.getByRole("button", { name: "Open FillNest" })).toHaveCount(1);
  await page.getByRole("button", { name: "Open FillNest" }).click();
  await page.getByRole("searchbox", { name: "Search templates" }).fill(
    "Recognition template",
  );
  await page.getByRole("button", { name: "Recognition template" }).click();
  await expect(conditional).toHaveValue("Recognition template");

  await spaEmail.focus();
  console.log("verifyConservativeRecognition: spa email focused");
  await page.getByRole("button", { name: "Open FillNest" }).click();
  await page.locator("#reconstruct").evaluate((button: HTMLButtonElement) => button.click());
  await expect(page.locator("[data-fillnest-overlay]")).toHaveCount(0);
  console.log("verifyConservativeRecognition: reconstructed cleared");
  const reconstructedEmail = page.locator('input[name="contact_email"]');
  await reconstructedEmail.focus();
  await expect(page.getByRole("button", { name: "Open FillNest" })).toHaveCount(1);
  await page.getByRole("button", { name: "Open FillNest" }).click();
  await expect(page.getByRole("button", { name: "Recognition template" })).toBeVisible();
  await expect(page.locator(`[${ACTIVE_MARKER}]`)).toHaveCount(1);
  await expect(page.locator("[data-fillnest-overlay]")).toHaveCount(1);
  console.log("verifyConservativeRecognition: reconstructed verified");

  const negativeId = crypto.randomUUID();
  const negativeName = `Casey-${crypto.randomUUID()}`;
  await page.goto(
    `${origin}/vendors/${negativeId}/edit?record=${negativeId}&name=${encodeURIComponent(negativeName)}`,
  );
  await page.locator('input[name="contact_email"]').focus();
  await page.getByRole("button", { name: "Open FillNest" }).click();
  await expect(page.getByText("No saved match for this field.")).toBeVisible();

  const ambiguousId = crypto.randomUUID();
  const ambiguousName = `Avery-${crypto.randomUUID()}`;
  await page.goto(
    `${origin}/customers/${ambiguousId}/edit?record=${ambiguousId}&variant=ambiguous&name=${encodeURIComponent(ambiguousName)}`,
  );
  await page.locator('input[name="contact_email"]').first().focus();
  await page.getByRole("button", { name: "Open FillNest" }).click();
  await expect(page.getByText("No saved match for this field.")).toBeVisible();

  const state = await sendRuntimeRequest(extensionPage, { type: "READ_STATE" });
  const persisted = JSON.stringify(state.value);
  for (const forbidden of [
    ...records,
    // The user-selected Observed Field Title rule deliberately preserves the
    // explicitly Bound Field's page-provided label, which contains names[0].
    ...names.slice(1),
    negativeId,
    negativeName,
    ambiguousId,
    ambiguousName,
    "dynamic-email",
  ]) {
    expect(persisted).not.toContain(forbidden);
  }
  await page.close();
  console.log("verifyConservativeRecognition: end");
}

async function seedTemplates(extensionPage: Page, fixtureOrigin: string): Promise<void> {
  const records = [
    ["Bound candidate", fixtureOrigin],
    ["Never appears", fixtureOrigin],
    ["Bound candidate wrong site", "https://records.other.test/profile"],
    ['<img src=x onerror="window.pwned=true"><script>boom()</script>', fixtureOrigin],
    ["replacement", fixtureOrigin],
    ["email-cursor", fixtureOrigin],
  ];
  for (const [content, pageUrl] of records) {
    expect(
      await sendRuntimeRequest(extensionPage, { type: "CREATE_TEMPLATE", content, pageUrl }),
    ).toEqual(expect.objectContaining({ ok: true }));
  }
}

async function verifyConcurrentPersistence(
  extensionPage: Page,
  fixtureOrigin: string,
): Promise<void> {
  const contents = [
    `Concurrent A ${crypto.randomUUID()}`,
    `Concurrent B ${crypto.randomUUID()}`,
  ];
  const responses = await extensionPage.evaluate(
    async ({ concurrentContents, pageUrl }) =>
      Promise.all(
        concurrentContents.map((content) =>
          chrome.runtime.sendMessage({
            type: "CREATE_TEMPLATE",
            content,
            pageUrl,
          }),
        ),
      ),
    { concurrentContents: contents, pageUrl: fixtureOrigin },
  );
  expect(responses).toEqual([
    expect.objectContaining({ ok: true }),
    expect.objectContaining({ ok: true }),
  ]);
  const state = await sendRuntimeRequest(extensionPage, { type: "READ_STATE" });
  const persisted = (state.value as { templates: Array<{ content: string }> }).templates.map(
    (template) => template.content,
  );
  expect(persisted).toEqual(expect.arrayContaining(contents));
}

async function readCount(page: Page, id: string): Promise<number> {
  return page.evaluate((fieldId) => {
    const counts = JSON.parse(
      document.documentElement.getAttribute("data-fillnest-read-counts") ?? "{}",
    ) as Record<string, number>;
    return counts[fieldId] ?? 0;
  }, id);
}

async function eventLog(page: Page, id: string): Promise<Array<Record<string, unknown>>> {
  return page.evaluate((fieldId) => window.eventLogs[fieldId] ?? [], id);
}

async function installValueReadInstrumentation(
  page: Page,
  extensionId: string,
): Promise<void> {
  const session = await page.context().newCDPSession(page);
  const contextId = await new Promise<number>((resolveContext, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("FillNest isolated execution context unavailable")),
      5_000,
    );
    session.on("Runtime.executionContextCreated", ({ context }) => {
      if (
        context.name.includes(extensionId) ||
        context.origin === `chrome-extension://${extensionId}`
      ) {
        clearTimeout(timeout);
        resolveContext(context.id);
      }
    });
    void session.send("Runtime.enable");
  });
  await session.send("Runtime.evaluate", {
    contextId,
    expression: `(() => {
      const counts = {};
      const publish = () => document.documentElement.setAttribute('data-fillnest-read-counts', JSON.stringify(counts));
      for (const prototype of [HTMLInputElement.prototype, HTMLTextAreaElement.prototype]) {
        const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
        Object.defineProperty(prototype, 'value', {
          configurable: true,
          get() {
            if (this.id && document.getElementById(this.id) === this) {
              counts[this.id] = (counts[this.id] || 0) + 1;
              publish();
            }
            return descriptor.get.call(this);
          },
          set(value) { descriptor.set.call(this, value); }
        });
      }
      publish();
    })()`,
  });
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
  await targetPage.bringToFront();
  const tabId = await worker.evaluate(async () => {
    const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    return activeTab?.id;
  });
  if (tabId === undefined) throw new Error("Active Fixture tab ID is unavailable");
  try {
    expect(
      await sendRuntimeRequest(extensionPage, {
        type: "SET_GLOBAL_ACTIVATION",
        mode: "active",
      }),
    ).toEqual(expect.objectContaining({ ok: true }));
    expect(
      await sendRuntimeRequest(extensionPage, { type: "ENABLE_SITE", pageUrl, tabId }),
    ).toEqual({
      ok: true,
      value: expect.objectContaining({ status: "active" }),
    });
  } catch (error) {
    console.log(
      "Grant timeout evidence:",
      await worker.evaluate(async (origin) => ({
        granted: await chrome.permissions.contains({ origins: [`${origin}/*`] }),
        registrations: await chrome.scripting.getRegisteredContentScripts(),
      }), pageUrl),
    );
    throw error;
  }
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
    .poll(async () => {
      const result = await extensionPage.getAttribute("html", "data-browser-result");
      if (result === null && request.type === "ENABLE_SITE") {
        await allowMacOsPermissionSheet();
      }
      return result;
    }, { timeout: 30_000 })
    .not.toBeNull();
  return JSON.parse(
    (await extensionPage.getAttribute("html", "data-browser-result")) ?? "null",
  ) as RuntimeHarnessResponse;
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

async function startFixtureServer(): Promise<{ server: Server; origin: string }> {
  const server = createServer((request, response) => {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    const url = new URL(request.url ?? "/", "http://fixture.test");
    response.end(
      url.pathname === "/" || url.pathname === "/pages/forms/text-inputs"
        ? fixtureHtml()
        : recordFixtureHtml(
            url.searchParams.get("name") ?? "Fictional record",
            url.searchParams.get("variant") === "ambiguous",
          ),
    );
  });
  await new Promise<void>((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Fixture port unavailable");
  return { server, origin: `http://127.0.0.1:${address.port}` };
}

function recordFixtureHtml(recordName: string, ambiguous: boolean): string {
  const eventOracle = ' data-input-count="0" data-change-count="0" oninput="this.dataset.inputCount=String(Number(this.dataset.inputCount)+1)" onchange="this.dataset.changeCount=String(Number(this.dataset.changeCount)+1)"';
  const fields = ambiguous
    ? '<label>Email for ' + recordName + '<input name="contact_email" type="email"' + eventOracle + '></label><label>Alternate email for ' + recordName + '<input name="contact_email" type="email"' + eventOracle + '></label>'
    : '<label>Email for ' + recordName + '<input name="contact_email" type="email"' + eventOracle + '></label>';
  return `<!doctype html><html><body><main><h1>${recordName}</h1>
<button id="spa-next" type="button">Navigate SPA</button>
<button id="reveal-conditional" type="button">Reveal conditional field</button>
<button id="reconstruct" type="button">Reconstruct form</button>
<form name="customer-editor"><section id="dynamic-email">${fields}</section></form></main>
<script>
window.dynamicEvents = { input: 0, change: 0 };
const editor = document.getElementById('dynamic-email');
document.getElementById('spa-next').addEventListener('click', () => {
  const nextId = crypto.randomUUID();
  history.pushState({}, '', '/customers/' + nextId + '/edit?record=' + nextId + '&name=SPA');
  editor.innerHTML = '<label>Email for SPA record<input name="contact_email" type="email" data-input-count="0" data-change-count="0" oninput="this.dataset.inputCount=String(Number(this.dataset.inputCount)+1)" onchange="this.dataset.changeCount=String(Number(this.dataset.changeCount)+1)"></label>';
});
document.getElementById('reveal-conditional').addEventListener('click', () => {
  if (editor.querySelector('input[name="conditional_note"]')) return;
  const label = document.createElement('label');
  label.textContent = 'Conditional note';
  const input = document.createElement('input');
  input.name = 'conditional_note';
  input.type = 'text';
  label.append(input);
  editor.append(label);
});
document.getElementById('reconstruct').addEventListener('click', () => {
  editor.innerHTML = '<label>Email for reconstructed record<input name="contact_email" type="email" data-input-count="0" data-change-count="0"></label>';
});
</script></body></html>`;
}

async function stopFixtureServer(server: Server): Promise<void> {
  await new Promise<void>((resolveClose, reject) =>
    server.close((error) => (error ? reject(error) : resolveClose())),
  );
}

function fixtureHtml(): string {
  return `<!doctype html>
<html><head><style>
button, input, textarea { background: rgb(255, 0, 0) !important; color: rgb(0, 128, 0) !important; font-size: 30px !important; }
fillnest-selection-preview { display: none !important; width: 1px !important; height: 1px !important; }
div, span { background: none !important; color: rgb(255, 0, 255) !important; }
body { min-height: 1400px; margin: 40px; }
.fixture-row { margin: 18px 0; }
input, textarea { width: 360px; }
</style></head><body>
<form id="fixture-form"><div id="host-sentinel" class="fixture-row sentinel">
<textarea id="textarea-field">Textarea</textarea>
<input id="text-field" type="text" value="Hello world">
<input id="missing-type" value="Missing">
<input id="invalid-type" type="invalid-kind" value="Invalid fallback">
<input id="search-field" type="search" value="Search">
<input id="email-field" type="email" value="person@example.test">
<input id="tel-field" type="tel" value="0400000000">
<input id="url-field" type="url" value="https://example.test">
<label>Date notes<input id="date-notes-field" type="text" name="date_notes" value="Call later"></label>
<label>Start<input id="start-date" type="text" name="start-date" value="Free text"></label>
<input id="short-field" type="text" style="height:22px !important" value="Short field">
<input id="ordinary-field" type="text" style="height:26px !important" value="Ordinary field">
<textarea id="tall-field" style="height:78px !important">Tall field</textarea>
<input id="create-field" type="text" value="Create me literally">
<input id="bind-field" type="text" value="Do not change">
<input id="replace-field" type="text" value="before SELECT after">
<input id="sibling-field" type="text" value="Sibling untouched">
</div>
<input id="password-field" type="password" value="secret">
<input id="number-field" type="number" value="42">
<input id="date-field" type="date" value="2026-08-08">
<label>Date picker<input id="script-date-picker" type="text" name="my-date" value="2026-08-08"></label>
<label>Appointment<input id="controlled-date-field" type="text" role="combobox" aria-haspopup="dialog" aria-controls="appointment-calendar" aria-label="Choose date" placeholder="YYYY-MM-DD" value="2026-08-08"></label>
<div id="appointment-calendar" role="dialog" hidden>Calendar</div>
<label>Country<input id="controlled-country-field" type="text" role="combobox" aria-haspopup="listbox" aria-controls="country-options" value="Australia"></label>
<div id="country-options" role="listbox" hidden>Australia</div>
<label>Country implicit<input id="implicit-country-field" type="text" role="combobox" aria-controls="implicit-country-options" value="Australia"></label>
<div id="implicit-country-options" role="listbox" hidden>Australia</div>
<label>Quantity<input id="spinbutton-field" type="text" role="spinbutton" value="2"></label>
<input id="hidden-field" type="hidden" value="hidden">
<input id="payment-field" type="text" autocomplete="cc-number" value="4111111111111111">
<input id="otp-field" type="text" autocomplete="one-time-code" value="123456">
<input id="section-otp-field" type="text" autocomplete="section-login one-time-code" value="654321">
<label>Credit card number<input id="label-card-field" type="text" name="entry" value="4111111111111111"></label>
<input id="readonly-field" type="text" readonly value="readonly">
<input id="disabled-field" type="text" disabled value="disabled">
<div id="editable-div" contenteditable="true">Editable</div>
<button type="submit">Host submit</button></form>
<script>
window.eventLogs = {}; window.submitCount = 0; window.pwned = false;
const ids = ['textarea-field','text-field','missing-type','invalid-type','search-field','email-field','tel-field','url-field','date-notes-field','start-date','short-field','ordinary-field','tall-field','create-field','bind-field','replace-field','sibling-field','password-field','number-field','date-field','script-date-picker','controlled-date-field','controlled-country-field','implicit-country-field','spinbutton-field','hidden-field','payment-field','otp-field','section-otp-field','label-card-field','readonly-field','disabled-field'];
for (const id of ids) {
  const field = document.getElementById(id);
  window.eventLogs[id] = [];
  for (const type of ['beforeinput','input','change']) field.addEventListener(type, event => window.eventLogs[id].push({ type: event.type, constructor: event.constructor.name, inputType: event.inputType ?? null, data: event.data ?? null, bubbles: event.bubbles, composed: event.composed, cancelable: event.cancelable }));
}
document.getElementById('fixture-form').addEventListener('submit', event => { window.submitCount++; event.preventDefault(); });
</script></body></html>`;
}

declare global {
  interface Window {
    eventLogs: Record<string, Array<Record<string, unknown>>>;
    submitCount: number;
    pwned: boolean;
    dynamicEvents: { input: number; change: number };
  }
}
