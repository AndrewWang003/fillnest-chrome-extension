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

/**
 * Task 036 Addendum A. The three defects the owner found by hand on 2026-09-09,
 * reduced to the behaviours that caused them.
 *
 * - **Type-anywhere-to-focus.** The composer listens on `document` for any
 *   keystroke and pulls focus to itself. Both a bubble-phase and a
 *   capture-phase listener are installed here, because containment defeats one
 *   and only focus restoration defeats the other.
 * - **A composer box with its own toolbar.** The editing host is the inner
 *   text node; the attach/dictate/send buttons live in the rounded box around
 *   it. FillNest's control must not land on top of them.
 * - **A re-parented composer.** Navigating rebuilds the view around the same
 *   editor, which is what lost a Binding on ChatGPT's new-conversation page.
 */
const FIXTURE_HTML = `<!doctype html>
<html>
  <body style="margin:0">
    <input id="seed-field" type="text" autocomplete="notes" />

    <div id="composer-shell" style="position:fixed;left:40px;top:200px;width:600px">
      <div id="composer-box" style="border:1px solid #444;border-radius:24px;background:#222;padding:12px 16px;display:flex;align-items:center;gap:12px">
        <!-- Narrower than the box that contains it, the way ChatGPT's is:
             the buttons sit beside the text node, not below it. -->
        <!-- Carries an id, the way ChatGPT's composer does: the identity is
             the attribute, not the label the application rewrites. -->
        <div id="composer" contenteditable="true" role="textbox" aria-multiline="true"
             spellcheck="true" aria-label="Write your prompt" style="min-height:24px;width:340px"></div>
        <button id="attach-button" type="button">Attach</button>
        <button id="send-button" type="button">Send</button>
      </div>
    </div>

    <script>
      const composer = document.querySelector("#composer");
      const steal = (event) => {
        if (event.key && event.key.length === 1 && document.activeElement !== composer) {
          composer.focus();
        }
      };
      document.addEventListener("keydown", steal);
      document.addEventListener("keydown", steal, true);
      window.__pageSawKeys = 0;
      document.addEventListener("keydown", () => { window.__pageSawKeys += 1; });

      // Mount a second composer the user cannot see, ahead of the real one -
      // a conversation being animated out, or the next view pre-mounting.
      window.__mountHiddenComposer = () => {
        const hidden = document.createElement("div");
        hidden.setAttribute("contenteditable", "true");
        hidden.setAttribute("role", "textbox");
        hidden.setAttribute("aria-multiline", "true");
        hidden.setAttribute("aria-label", "Write your prompt");
        hidden.id = "hidden-composer";
        hidden.style.display = "none";
        document.body.prepend(hidden);
      };

      // A route change the way a chat application does one: the address moves
      // and the composer is replaced with a new element in the same batch.
      window.__navigate = (path) => {
        history.pushState({}, "", path);
        const shell = document.querySelector("#composer-shell");
        const old = document.querySelector("#composer-box");
        const replacement = old.cloneNode(true);
        old.remove();
        shell.append(replacement);
      };

      // A route change that keeps the composer element and its focus, the way
      // Gemini's does. One attribute is touched so the lifecycle observer sees
      // the batch at all.
      window.__navigateKeepingComposer = (path) => {
        history.pushState({}, "", path);
        document.querySelector("#composer-shell").setAttribute("data-route", path);
      };

      // The same, with no DOM change at all and nothing to observe - the case
      // that defeated the lifecycle-driven and frame-driven checks.
      window.__navigateSilently = (path) => history.pushState({}, "", path);

      // Rebuild the view around the same editor, the way an SPA does on a
      // route change: a new wrapper, the same host element moved into it.
      window.__reparentComposer = () => {
        const shell = document.querySelector("#composer-shell");
        const box = document.querySelector("#composer-box");
        const wrapper = document.createElement("section");
        const inner = document.createElement("div");
        wrapper.append(inner);
        inner.append(box);
        shell.replaceChildren(wrapper);
      };
    </script>
  </body>
</html>`;

const TEMPLATE = "Summarize this in three bullet points.";
const SECOND_TEMPLATE = "Rewrite this for a general audience.";

interface Nav {
  __navigate(path: string): void;
  __navigateKeepingComposer(path: string): void;
  __navigateSilently(path: string): void;
}

test("a hostile composer: typing reaches the Picker, the control clears the toolbar, and a re-parented editor keeps its Binding", async () => {
  test.setTimeout(120_000);
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

    await page.locator("#composer").click();
    await page.getByRole("button", { name: "Open FillNest" }).click();

    // ---- The control clears the composer's own toolbar -----------------
    const control = page.getByRole("button", { name: "Open FillNest" });
    const controlBox = await control.boundingBox();
    const composerBox = await page.locator("#composer-box").boundingBox();
    const sendBox = await page.locator("#send-button").boundingBox();
    if (!controlBox || !composerBox || !sendBox) throw new Error("Missing layout boxes");
    // Outside the composer's visual box, not merely outside the text node.
    expect(controlBox.x).toBeGreaterThanOrEqual(composerBox.x + composerBox.width);
    expect(overlaps(controlBox, sendBox)).toBe(false);

    // ---- Typing into the Picker stays in the Picker --------------------
    await page.getByRole("button", { name: "New template" }).click();
    const draft = page.getByRole("textbox", { name: "Template content" });
    await draft.click();
    await page.keyboard.type(TEMPLATE);

    // The page never saw the keystrokes, and never took the focus back.
    expect(await page.evaluate(() => (window as unknown as { __pageSawKeys: number }).__pageSawKeys)).toBe(0);
    await expect(draft).toHaveValue(TEMPLATE);
    await expect(page.locator("#composer")).toHaveText("");

    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("status").first()).toHaveText("Saved and bound to this field.");
    await page.keyboard.press("Escape");

    // ---- Arriving from a different page is not a replacement -----------
    // The exact pattern from the owner's ChatGPT recording: the Field's
    // identity was byte-identical across eighteen samples, and the Templates
    // still came and went. Arriving at a conversation from the
    // new-conversation page showed nothing; arriving from another conversation
    // showed everything. A route change removes the old page's composer and
    // adds the new page's in one batch, and the detached evidence then carried
    // the previous page's identity.
    await page.evaluate(() => (window as unknown as Nav).__navigate("/c/first"));
    await page.locator("#composer").click();
    await page.getByRole("button", { name: "Open FillNest" }).click();
    await page.getByRole("button", { name: "New template" }).click();
    await page.getByRole("textbox", { name: "Template content" }).fill(SECOND_TEMPLATE);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("status").first()).toHaveText("Saved and bound to this field.");
    await page.keyboard.press("Escape");

    // Away to a different page, then back. Both legs replace the composer.
    await page.evaluate(() => (window as unknown as Nav).__navigate("/"));
    await page.locator("#composer").click();
    await page.evaluate(() => (window as unknown as Nav).__navigate("/c/first"));
    await page.locator("#composer").click();
    await page.getByRole("button", { name: "Open FillNest" }).click();
    await expect(page.getByRole("button", { name: SECOND_TEMPLATE })).toBeVisible();
    await page.keyboard.press("Escape");

    // ---- The Picker follows a navigation that keeps the same element ---
    // Gemini's shape: the address changes and the composer element - and its
    // focus - survives. The context is resolved on focus, so without an
    // address watch the Picker went on showing the previous page's Templates
    // while the Side Panel showed the right ones.
    await page.evaluate(() => (window as unknown as Nav).__navigateKeepingComposer("/"));
    await page.getByRole("button", { name: "Open FillNest" }).click();
    await expect(page.getByRole("button", { name: TEMPLATE })).toBeVisible();
    await expect(page.getByRole("button", { name: SECOND_TEMPLATE })).toHaveCount(0);
    await page.keyboard.press("Escape");

    // ---- An address change with nothing to observe is still noticed -----
    // Addendum A.6: no DOM mutation, no focus change, no popstate. Only the
    // address moved, and the Picker must follow it.
    await page.evaluate(() => (window as unknown as Nav).__navigateSilently("/c/first"));
    await page.waitForTimeout(600);
    await page.getByRole("button", { name: "Open FillNest" }).click();
    await expect(page.getByRole("button", { name: SECOND_TEMPLATE })).toBeVisible();
    await expect(page.getByRole("button", { name: TEMPLATE })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await page.evaluate(() => (window as unknown as Nav).__navigateSilently("/"));
    await page.waitForTimeout(600);

    // ---- The Binding survives an off-screen composer appearing ---------
    // The owner's second QA pass: Templates that were there, then were not,
    // then were. A chat application keeps editors mounted that are not on
    // screen, and counting them used to move this Field's ordinal.
    await page.evaluate(() => (window as unknown as { __mountHiddenComposer(): void }).__mountHiddenComposer());
    await page.locator("#composer").click();
    await page.getByRole("button", { name: "Open FillNest" }).click();
    await expect(page.getByRole("button", { name: TEMPLATE })).toBeVisible();
    await page.keyboard.press("Escape");

    // ---- The Binding survives the page relabelling its own composer ----
    // The owner's third QA pass: one composer resolved to two alternating
    // Field Profiles, each with its own name and Templates, because these
    // applications change the composer's label with the interface's state.
    await page.evaluate(() =>
      document.querySelector("#composer")?.setAttribute("aria-label", "Ask anything"),
    );
    await page.locator("#composer").click();
    await page.getByRole("button", { name: "Open FillNest" }).click();
    await expect(page.getByRole("button", { name: TEMPLATE })).toBeVisible();
    await page.keyboard.press("Escape");

    // ---- The Binding survives the view being rebuilt around the editor --
    await page.evaluate(() => (window as unknown as { __reparentComposer(): void }).__reparentComposer());
    await page.locator("#composer").click();
    await page.getByRole("button", { name: "Open FillNest" }).click();
    // Still this Field's Template: offered without searching for it.
    await expect(page.getByRole("button", { name: TEMPLATE })).toBeVisible();
  } finally {
    await context?.close();
    await rm(userDataDir, { recursive: true, force: true });
    await rm(extensionBaseDir, { recursive: true, force: true });
    await stopFixtureServer(fixture.server);
  }
});

function overlaps(a: { x: number; y: number; width: number; height: number },
                  b: { x: number; y: number; width: number; height: number }): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
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
  page: Page,
  origin: string,
): Promise<void> {
  const globalActivation = await extensionPage.evaluate(async (): Promise<RuntimeHarnessResponse> => {
    const result: unknown = await chrome.runtime.sendMessage({
      type: "SET_GLOBAL_ACTIVATION",
      mode: "active",
    });
    return result as RuntimeHarnessResponse;
  });
  if (!globalActivation.ok) throw new Error("SET_GLOBAL_ACTIVATION failed");

  await page.bringToFront();
  const tabId = await worker.evaluate(async () => {
    const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    return activeTab?.id ?? null;
  });
  if (tabId === null) throw new Error("Fixture tab not found");
  const response = await extensionPage.evaluate(
    async ({ pageUrl, id }): Promise<RuntimeHarnessResponse> => {
      const result: unknown = await chrome.runtime.sendMessage({ type: "ENABLE_SITE", pageUrl, tabId: id });
      return result as RuntimeHarnessResponse;
    },
    { pageUrl: `${origin}/`, id: tabId },
  );
  if (!response.ok) throw new Error(`ENABLE_SITE failed: ${response.error ?? "unknown"}`);
  await page.reload();
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
