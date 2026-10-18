import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { expect, type BrowserContext, type CDPSession, type Page, type Worker } from "@playwright/test";

const execFileAsync = promisify(execFile);

interface RuntimeHarnessResponse {
  ok: boolean;
  value?: unknown;
  error?: string;
}

export async function extensionWorker(context: BrowserContext): Promise<Worker> {
  return context.serviceWorkers()[0] ?? context.waitForEvent("serviceworker");
}

export async function activateFixtureOrigin(
  context: BrowserContext,
  worker: Worker,
  extensionId: string,
  targetPage: Page,
  pageUrl: string,
): Promise<Page> {
  await targetPage.bringToFront();
  const tabId = await worker.evaluate(async () => {
    const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    return activeTab?.id;
  });
  if (tabId === undefined) throw new Error("Active Fixture tab ID is unavailable");

  const extensionPage = await context.newPage();
  await extensionPage.goto(`chrome-extension://${extensionId}/popup.html`);

  expect(await sendRuntimeRequest(extensionPage, {
    type: "SET_GLOBAL_ACTIVATION",
    mode: "active",
  })).toEqual(expect.objectContaining({ ok: true }));
  expect(await sendRuntimeRequest(extensionPage, {
    type: "ENABLE_SITE",
    pageUrl,
    tabId,
  })).toEqual({
    ok: true,
    value: expect.objectContaining({ status: "active" }),
  });

  return extensionPage;
}

export async function installValueReadInstrumentation(
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
      if (context.name.includes(extensionId) || context.origin === `chrome-extension://${extensionId}`) {
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

export async function valueReadCount(page: Page, fieldId: string): Promise<number> {
  return page.evaluate((id) => {
    const counts = JSON.parse(
      document.documentElement.getAttribute("data-fillnest-read-counts") ?? "{}",
    ) as Record<string, number>;
    return counts[id] ?? 0;
  }, fieldId);
}

/**
 * Counts listeners attached directly to a fixture Field node. This deliberately
 * does not inspect document-level delegation: Task 016 forbids per-Field
 * listeners on zero-touch fields, not a single document-level listener.
 */
export async function directFieldListenerCount(
  session: CDPSession,
  fieldId: string,
): Promise<number> {
  const evaluation = await session.send("Runtime.evaluate", {
    expression: `document.getElementById(${JSON.stringify(fieldId)})`,
  }) as { result: { objectId?: string } };
  if (!evaluation.result.objectId) {
    throw new Error(`Fixture Field ${fieldId} is unavailable for listener inspection`);
  }
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const listeners = await Promise.race([
      session.send("DOMDebugger.getEventListeners", {
        objectId: evaluation.result.objectId,
      }) as Promise<{ listeners: unknown[] }>,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error(`Listener inspection timed out for ${fieldId}`)),
          5_000,
        );
      }),
    ]);
    return listeners.listeners.length;
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

export async function sendRuntimeRequest(
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
      if (result === null && request.type === "ENABLE_SITE") await allowMacOsPermissionSheet();
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
      "-e", "tell application \"System Events\"",
      "-e", "tell process \"Google Chrome for Testing\"",
      "-e", "click button 2 of group 2 of group 2 of group 1 of group 1 of group 1 of sheet 1 of window 1",
      "-e", "end tell",
      "-e", "end tell",
    ]);
  } catch {
    // The condition poll retries until Chrome presents the permission sheet.
  }
}
