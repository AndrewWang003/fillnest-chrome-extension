import { E2E_EXTENSION_BUILD_DIR } from "../helpers/extension-build";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { expect, test, type BrowserContext, type Page, type Worker } from "@playwright/test";

import { launchWithPermissionHistory } from "../helpers/prime-extension-permissions";

/**
 * The Chrome Web Store listing's screenshots, made rather than taken.
 *
 * Opt-in (`npm run shots:store`), never part of a suite: it asserts almost
 * nothing, it writes images. Run it when the listing needs its pictures, look
 * at what it produced, and upload the ones that earn their place.
 *
 * It drives `dist-e2e` because Playwright cannot reach inside the shipped
 * build's closed Shadow Roots to click anything (Task 030's recorded
 * exception). The two builds differ in that flag alone, so what is drawn here
 * is what the shipped build draws.
 *
 * The page is `demo/screenshot-form.html` - FillNest's own page, whose
 * templates describe the product, so a picture of the Picker also reads as a
 * sentence about it.
 */

const SHOT_DIR = "output/store-screenshots";
const PROMO_DIR = "output/promo";
/**
 * `.test` is reserved by the IANA and can never belong to anyone, so the
 * Popup can name a site in the pictures without the listing implying a
 * domain FillNest does not own - and without showing a loopback port.
 */
const HOST = "fillnest.test";
/** FillNest's canonical Permission Origin carries the port, even the default one. */
const ORIGIN = `http://${HOST}:80`;
const WIDTH = 1280;
const HEIGHT = 800;

/**
  * Three, not four: a fourth makes the list taller than the Picker and cuts
  * `New template` in half. The Picker sorts them alphabetically, so they are
  * written to be read in this order - what it does, then what it remembers,
  * then where the data lives.
  */
const MESSAGE_TEMPLATES = [
  "Beside the field you choose, never filled for you.",
  "Bound to a field, it is offered there first.",
  "Everything stays on your device. No account, no server.",
];

const SUBJECT_TEMPLATES = ["Bug report", "Feature request", "Quick question"];

/**
 * Centred down the page and right of its middle: the panel is 348 wide and,
 * with three templates, about 420 tall, so this leaves an even margin above
 * and below it and a clear one to its right.
 */
const PICKER_POSITION = { top: 190, left: 770 };

test("the store listing's screenshots", async () => {
  test.skip(!process.env.FILLNEST_SHOTS, "Screenshot run - use npm run shots:store");
  test.setTimeout(300_000);

  const fixture = await startFixtureServer();
  const userDataDir = await mkdtemp(join(tmpdir(), "fillnest-shots-"));
  const extensionBaseDir = await mkdtemp(join(tmpdir(), "fillnest-extension-"));
  const extensionPath = join(extensionBaseDir, "extension");
  await cp(resolve(E2E_EXTENSION_BUILD_DIR), extensionPath, { recursive: true });
  await mkdir(resolve(SHOT_DIR), { recursive: true });
  let context: BrowserContext | undefined;

  try {
    context = await launchWithPermissionHistory(userDataDir, extensionPath, [`${ORIGIN}/*`], {
      extraArgs: [`--host-resolver-rules=MAP ${HOST} ${fixture.origin.replace("http://", "")}`],
    });
    const worker = await extensionWorker(context);
    const extensionId = new URL(worker.url()).host;

    const page = await context.newPage();
    await page.setViewportSize({ width: WIDTH, height: HEIGHT });
    await page.goto(`http://${HOST}/`);
    const extensionPage = await openExtensionPage(context, extensionId);
    await grantOrigin(worker, extensionPage, page, ORIGIN);
    await page.bringToFront();

    for (const content of MESSAGE_TEMPLATES) await createTemplate(page, "#message", content);
    for (const content of SUBJECT_TEMPLATES) await createTemplate(page, "#subject", content);

    // Where the Picker sits in both shots. Left to itself it opens against the
    // field, which here means hard against the top edge with the lower half of
    // the page empty under it. Kept open, it sits where it was put - and
    // where it was put is a product feature, not a trick for the camera.
    await sendRuntimeRequest(extensionPage, { type: "SET_PICKER_POSITION", position: PICKER_POSITION });
    await page.reload();
    await expect(page.locator("[data-fillnest-extension-active]")).toHaveCount(1);

    // 01 - the templates this field offers, in the panel that stays open.
    await openPicker(page, "#message");
    await page.getByRole("button", { name: "Keep open" }).click();
    await expect(page.getByText(MESSAGE_TEMPLATES[0]!)).toBeVisible();
    // Opening puts the caret in Search, and an empty box with a focus ring on
    // it is the brightest thing in the picture. The header takes it instead.
    await page.locator(".picker header strong").click();
    await page.mouse.move(WIDTH - 40, HEIGHT - 40);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SHOT_DIR}/01-picker.png` });

    // 02 - one click later: the text is in the field, the panel still there.
    await page.getByText(MESSAGE_TEMPLATES[0]!).click();
    await expect(page.locator("#message")).toHaveValue(MESSAGE_TEMPLATES[0]!);
    await page.mouse.move(WIDTH - 40, HEIGHT - 40);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SHOT_DIR}/02-inserted.png` });
    await page.getByRole("button", { name: "Turn off keep open" }).click();

    // 03 - the library, docked where Chrome docks it.
    const sidePanel = await context.newPage();
    await sidePanel.setViewportSize({ width: 420, height: HEIGHT });
    await sidePanel.goto(`chrome-extension://${extensionId}/side-panel.html`);
    await sidePanel.getByRole("button", { name: "Templates", exact: true }).click();
    await sidePanel.getByRole("button", { name: "All templates" }).click();
    await expect(sidePanel.getByText(MESSAGE_TEMPLATES[0]!)).toBeVisible();
    await sidePanel.waitForTimeout(400);
    await sidePanel.screenshot({ path: `${SHOT_DIR}/panel-templates.png` });

    // 04 - settings: themes, language, and the data that is the user's own.
    await sidePanel.getByRole("button", { name: "Settings" }).click();
    await expect(sidePanel.getByRole("heading", { name: "Appearance" })).toBeVisible();
    await sidePanel.waitForTimeout(400);
    await sidePanel.screenshot({ path: `${SHOT_DIR}/panel-settings.png` });

    // 05 - the popup: what the user grants, and whether it is working here.
    const popup = await context.newPage();
    await popup.setViewportSize({ width: 340, height: 380 });
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    // The Popup reports on the tab the user is looking at. Opened in a tab of
    // its own it is looking at itself, and says FillNest cannot be used here -
    // true, and not what the listing is about. So the demo tab is brought back
    // in front and the Popup asked again.
    await page.bringToFront();
    await popup.reload();
    await expect(popup.getByRole("heading", { name: "Enable on this site" })).toBeVisible();
    await popup.waitForTimeout(600);
    await popup.screenshot({ path: `${SHOT_DIR}/popup.png` });

    // The page behind the composed shots, with nothing of FillNest's open on it.
    await page.bringToFront();
    await page.locator("#subject").focus();
    await page.keyboard.press("Escape");
    await page.mouse.click(40, HEIGHT - 40);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SHOT_DIR}/page-plain.png` });

    await compose(context, `${SHOT_DIR}/03-templates.png`, panelComposition("panel-templates.png"));
    await compose(context, `${SHOT_DIR}/04-settings.png`, panelComposition("panel-settings.png"));
    await compose(context, `${SHOT_DIR}/05-popup.png`, popupComposition());

    // The store's small promo tile. The owner chose the motif on ink
    // (2026-09-16); the two it was chosen over are kept beside it, out of the
    // way of `verify:store`, which reads this directory and should find one
    // tile rather than a choice to make at upload time.
    await mkdir(resolve(`${PROMO_DIR}/alternates`), { recursive: true });
    const tile = { width: 440, height: 280 };
    await compose(context, `${PROMO_DIR}/promo-tile.png`, promoTile("motif"), tile);
    await compose(context, `${PROMO_DIR}/alternates/brand-only.png`, promoTile("brand"), tile);
    await compose(context, `${PROMO_DIR}/alternates/on-paper.png`, promoTile("paper"), tile);

    for (const name of ["panel-templates.png", "panel-settings.png", "popup.png", "page-plain.png"]) {
      await rm(resolve(SHOT_DIR, name), { force: true });
    }
    console.log(`Screenshots in ${SHOT_DIR}: 01-picker, 02-inserted, 03-templates, 04-settings, 05-popup`);
  } finally {
    await context?.close();
    await rm(userDataDir, { recursive: true, force: true });
    await rm(extensionBaseDir, { recursive: true, force: true });
    await stopFixtureServer(fixture.server);
  }
});

async function createTemplate(page: Page, field: string, content: string): Promise<void> {
  await openPicker(page, field);
  await page.getByRole("button", { name: "New template" }).click();
  await page.getByRole("textbox", { name: "Template content" }).fill(content);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved and bound to this field.")).toBeVisible();
  await closePicker(page);
}

async function openPicker(page: Page, field: string): Promise<void> {
  await closePicker(page);
  await page.locator(field).focus();
  await page.getByRole("button", { name: "Open FillNest" }).click();
  await expect(page.getByRole("region", { name: "FillNest templates" })).toBeVisible();
}

async function closePicker(page: Page): Promise<void> {
  const close = page.getByRole("button", { name: "Close", exact: true });
  if (await close.isVisible().catch(() => false)) await close.click();
  await expect(page.getByRole("region", { name: "FillNest templates" })).toBeHidden();
}

/** The side panel where Chrome puts it: docked right, the page carrying on beside it. */
function panelComposition(panel: string): string {
  return `
    <div class="frame">
      <img class="page" src="page-plain.png" alt="">
      <img class="panel" src="${panel}" alt="">
    </div>
    <style>
      body { margin: 0; background: #e9e5df; }
      .frame { position: relative; width: ${WIDTH}px; height: ${HEIGHT}px; overflow: hidden; background: #fff; }
      .page { position: absolute; inset: 0 420px 0 0; width: ${WIDTH}px; height: ${HEIGHT}px; object-fit: cover; object-position: left top; }
      .panel { position: absolute; top: 0; right: 0; width: 420px; height: ${HEIGHT}px; box-shadow: -1px 0 0 #d9d9de, -18px 0 40px rgb(23 32 51 / 10%); }
    </style>`;
}

/** The popup as it hangs from the toolbar: over the page, near the top right. */
function popupComposition(): string {
  return `
    <div class="frame">
      <img class="page" src="page-plain.png" alt="">
      <div class="veil"></div>
      <img class="popup" src="popup.png" alt="">
    </div>
    <style>
      body { margin: 0; background: #e9e5df; }
      .frame { position: relative; width: ${WIDTH}px; height: ${HEIGHT}px; overflow: hidden; background: #fff; }
      .page { position: absolute; inset: 0; width: ${WIDTH}px; height: ${HEIGHT}px; }
      .veil { position: absolute; inset: 0; background: rgb(32 30 29 / 8%); }
      .popup { position: absolute; top: 26px; right: 40px; width: 340px; border-radius: 12px; box-shadow: 0 18px 50px rgb(23 32 51 / 22%); }
    </style>`;
}

/**
 * The 440x280 tile the store puts on a card - a category page, a collection,
 * a row of related items - where it is small, often smaller, and glanced at.
 * Its job is recognition, not explanation: that is what the screenshots on the
 * listing page are for, and a screenshot shrunk to this is mud.
 *
 * `brand` is the mark and the words alone. `motif` adds a drawing of what the
 * product does - a field, and a panel of lines beside it - simplified until it
 * still reads at half this size; it is a diagram, never a screenshot.
 * `paper` is `motif` in the page's own warm light, for a store card that sits
 * on white.
 */
function promoTile(variant: "brand" | "motif" | "paper"): string {
  const paper = variant === "paper";
  const ground = paper ? "#f5f2ee" : "#201e1d";
  const ink = paper ? "#201e1d" : "#ffffff";
  const soft = paper ? "#8b847c" : "#bdb6ad";
  const line = paper ? "#ddd6cc" : "#3a3634";
  const motif = variant === "brand" ? "" : `
      <svg class="motif" viewBox="0 0 150 180" aria-hidden="true">
        <rect x="0" y="34" width="86" height="58" rx="8" fill="${paper ? "#ffffff" : "#35302d"}" stroke="${line}" stroke-width="2"/>
        <rect x="12" y="50" width="46" height="6" rx="3" fill="${soft}"/>
        <rect x="12" y="66" width="30" height="6" rx="3" fill="${soft}"/>
        <rect x="52" y="8" width="98" height="140" rx="12" fill="${paper ? "#ffffff" : "#f7f8fb"}" stroke="${paper ? "#d0d6e2" : "none"}" stroke-width="2"/>
        <rect x="66" y="26" width="34" height="7" rx="3.5" fill="#3157d5"/>
        <rect x="66" y="52" width="70" height="7" rx="3.5" fill="#3157d5" opacity=".85"/>
        <rect x="66" y="70" width="54" height="7" rx="3.5" fill="#3157d5" opacity=".55"/>
        <rect x="66" y="96" width="70" height="7" rx="3.5" fill="#3157d5" opacity=".85"/>
        <rect x="66" y="114" width="46" height="7" rx="3.5" fill="#3157d5" opacity=".55"/>
      </svg>`;
  return `
    <div class="tile${variant === "brand" ? " solo" : ""}">
      <div class="words">
        <svg class="mark" viewBox="0 0 96 96" aria-hidden="true">
          <g fill="${ink}">
            <rect x="14" y="16" width="28" height="10" />
            <rect x="14" y="70" width="28" height="10" />
            <rect x="23" y="16" width="10" height="64" />
            <rect x="48" y="16" width="30" height="10" />
          </g>
          <rect x="40" y="40" width="38" height="10" fill="#ec3013" />
        </svg>
        <div class="name">FillNest</div>
        <div class="tagline">Templates where you need them.</div>
      </div>
      ${motif}
    </div>
    <style>
      body { margin: 0; }
      .tile {
        width: 440px; height: 280px; box-sizing: border-box; padding: 34px 36px;
        display: flex; align-items: center; gap: 22px;
        background: ${ground}; color: ${ink};
        font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
        -webkit-font-smoothing: antialiased;
      }
      .tile.solo { padding: 38px 40px; }
      .words { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
      .mark { width: ${variant === "brand" ? 58 : 46}px; height: ${variant === "brand" ? 58 : 46}px; margin-bottom: ${variant === "brand" ? 14 : 10}px; }
      .name { font-size: ${variant === "brand" ? 42 : 33}px; font-weight: 700; letter-spacing: -0.03em; line-height: 1.05; }
      .tagline { color: ${soft}; font-size: ${variant === "brand" ? 18 : 14.5}px; font-weight: 500; letter-spacing: -0.01em; line-height: 1.35; text-wrap: balance; }
      .motif { flex: none; width: 138px; height: 180px; margin-left: auto; }
    </style>`;
}

async function compose(
  context: BrowserContext,
  target: string,
  markup: string,
  size: { width: number; height: number } = { width: WIDTH, height: HEIGHT },
): Promise<void> {
  // Written beside the images it references, so their relative paths resolve.
  const file = resolve(SHOT_DIR, "_composition.html");
  await writeFile(file, markup, "utf8");
  const page = await context.newPage();
  await page.setViewportSize(size);
  await page.goto(`file://${file}`);
  await page.waitForTimeout(300);
  await page.screenshot({ path: resolve(target) });
  await page.close();
  await rm(file, { force: true });
}

async function sendRuntimeRequest(extensionPage: Page, request: Record<string, unknown>): Promise<void> {
  const response: { ok: boolean; error?: string } = await extensionPage.evaluate(
    async (message) => chrome.runtime.sendMessage(message),
    request,
  );
  if (!response.ok) throw new Error(response.error ?? "Runtime request failed");
}

async function extensionWorker(context: BrowserContext): Promise<Worker> {
  const existing = context.serviceWorkers()[0];
  return existing ?? (await context.waitForEvent("serviceworker"));
}

async function openExtensionPage(context: BrowserContext, extensionId: string): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/side-panel.html`);
  return page;
}

async function grantOrigin(worker: Worker, extensionPage: Page, page: Page, origin: string): Promise<void> {
  await extensionPage.evaluate(
    async ([pageUrl]) => {
      await chrome.runtime.sendMessage({ type: "SET_GLOBAL_ACTIVATION", mode: "active" });
      await chrome.runtime.sendMessage({ type: "ENABLE_SITE", pageUrl, tabId: undefined });
    },
    [origin],
  );
  await expect
    .poll(async () => worker.evaluate(async () => (await chrome.permissions.getAll()).origins ?? []))
    .toContain(`${origin}/*`);
  await page.reload();
  await expect(page.locator("[data-fillnest-extension-active]")).toHaveCount(1);
}

async function startFixtureServer(): Promise<{ server: Server; origin: string }> {
  const html = await readFile(resolve("demo/screenshot-form.html"), "utf8");
  return new Promise((resolvePromise) => {
    const server = createServer((_request, response) => {
      response.writeHead(200, { "content-type": "text/html" });
      response.end(html);
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
