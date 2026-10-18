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

interface ChurnResult {
  wallMs: number;
  longTasks: number;
  longTaskMs: number;
}

/**
 * Task 035 finding R7: lifecycle mutation cost, measured before anything is
 * optimized - which is the order the finding itself asks for.
 *
 * The design is a difference, not an absolute. The same page runs the same
 * churn twice: once on an Origin FillNest has no access to, so no content
 * script exists at all, and once with access granted. Everything else - the
 * browser, the machine, the DOM, the work - is identical, so the gap between
 * the two runs is FillNest's own cost and nothing else.
 *
 * Two shapes, because they stress different parts of the observer:
 *
 * - **Structure**: nodes added and removed in batches, over a DOM large enough
 *   that a careless `querySelectorAll` per record would show. This is the path
 *   R7 names.
 * - **Streaming**: one text node rewritten repeatedly, which is what a chat
 *   application does while a reply arrives. The observer asks for
 *   `characterData`, so this is the highest-frequency signal it can receive.
 *
 * Not part of `npm run test:e2e`: a benchmark that gates a suite becomes a
 * flake. Run it deliberately with `npm run bench:lifecycle`.
 */
const BASELINE_DOM_NODES = 2_000;
const STRUCTURE_BATCHES = 500;
const STREAMING_UPDATES = 5_000;
/** A form-heavy page, to reach the per-Field eligibility work a churn triggers. */
const CROWDED_FIELDS = 200;
/** Each shape is measured this many times; the median is reported. */
const REPEATS = 5;

const FIXTURE_HTML = `<!doctype html>
<html>
  <body>
    <input id="seed-field" type="text" autocomplete="notes" />
    <div id="composer" contenteditable="true" role="textbox" aria-multiline="true"
         spellcheck="true" aria-label="Write your prompt"></div>
    <div id="stream">initial</div>
    <div id="conversation"></div>
    <form id="crowd"></form>
    <script>
      const conversation = document.querySelector("#conversation");
      const message = (index) => {
        const node = document.createElement("article");
        node.className = "message";
        for (let child = 0; child < 20; child += 1) {
          const span = document.createElement("span");
          span.textContent = "message " + index + " part " + child;
          node.append(span);
        }
        return node;
      };

      for (let index = 0; index < ${BASELINE_DOM_NODES / 21}; index += 1) {
        conversation.append(message(index));
      }

      const crowd = document.querySelector("#crowd");
      for (let index = 0; index < ${CROWDED_FIELDS}; index += 1) {
        const label = document.createElement("label");
        label.textContent = "Field " + index;
        const input = document.createElement("input");
        input.type = "text";
        input.name = "field-" + index;
        label.append(input);
        crowd.append(label);
      }

      const frame = () => new Promise((done) => requestAnimationFrame(() => done()));

      const observeLongTasks = () => {
        const entries = [];
        let observer = null;
        try {
          observer = new PerformanceObserver((list) => entries.push(...list.getEntries()));
          observer.observe({ entryTypes: ["longtask"] });
        } catch { /* not every build exposes longtask */ }
        return () => {
          observer?.disconnect();
          return {
            longTasks: entries.length,
            longTaskMs: Math.round(entries.reduce((total, entry) => total + entry.duration, 0)),
          };
        };
      };

      // The mutations run in a tight loop and the clock stops after the next
      // frame, so what is measured is the work - the page's own, plus whatever
      // an observer does with the records - rather than how long the browser
      // spent waiting to paint. An earlier version awaited a frame per batch
      // and measured the frame rate: 200 batches took 3.3 seconds on both
      // sides, and the difference between them was lost in it.
      const measure = async (mutate) => {
        const stop = observeLongTasks();
        const started = performance.now();
        mutate();
        await frame();
        const wallMs = Math.round((performance.now() - started) * 100) / 100;
        return { wallMs, ...stop() };
      };

      // Nodes added and removed, the way a conversation list grows.
      window.__churnStructure = () =>
        measure(() => {
          for (let batch = 0; batch < ${STRUCTURE_BATCHES}; batch += 1) {
            conversation.append(message(batch));
            if (conversation.firstElementChild) conversation.firstElementChild.remove();
          }
        });

      // The same structural churn, on a page that also carries 200 eligible
      // Fields. Every flush re-judges each Field it queued, and that judgement
      // walks ancestors calling getComputedStyle - a cost the sparse fixture
      // never reaches.
      window.__churnCrowded = () =>
        measure(() => {
          for (let batch = 0; batch < ${STRUCTURE_BATCHES}; batch += 1) {
            crowd.append(crowd.firstElementChild.cloneNode(true));
            crowd.firstElementChild.remove();
          }
        });

      // One text node rewritten over and over: a reply streaming in.
      window.__churnStreaming = () => {
        const stream = document.querySelector("#stream");
        return measure(() => {
          for (let update = 0; update < ${STREAMING_UPDATES}; update += 1) {
            stream.firstChild.data = "token " + update;
          }
        });
      };
    </script>
  </body>
</html>`;

test("R7: what the lifecycle observer costs a churning page", async () => {
  test.skip(!process.env.FILLNEST_BENCH, "Benchmark - run with npm run bench:lifecycle");
  test.setTimeout(300_000);

  const fixture = await startFixtureServer();
  const userDataDir = await mkdtemp(join(tmpdir(), "fillnest-playwright-"));
  const extensionBaseDir = await mkdtemp(join(tmpdir(), "fillnest-extension-"));
  const extensionPath = join(extensionBaseDir, "extension");
  await cp(resolve(E2E_EXTENSION_BUILD_DIR), extensionPath, { recursive: true });
  let context: BrowserContext | undefined;

  try {
    context = await launchWithPermissionHistory(userDataDir, extensionPath, [`${fixture.origin}/*`]);
    const worker = await extensionWorker(context);
    const extensionId = new URL(worker.url()).host;
    const page = await context.newPage();
    await page.goto(fixture.origin);

    // Baseline: no access, so no content script is injected on this page.
    await expect(page.locator("[data-fillnest-page-status]")).toHaveCount(0);
    const baseline = await runChurn(page);

    const extensionPage = await openExtensionPage(context, extensionId);
    await grantOrigin(worker, extensionPage, page, fixture.origin);
    await page.bringToFront();
    // With the Picker open on the composer, so the Field is actively tracked -
    // the most expensive state the product has.
    await page.locator("#composer").click();
    await page.getByRole("button", { name: "Open FillNest" }).click();
    const active = await runChurn(page);

    report("structure", baseline.structure, active.structure, STRUCTURE_BATCHES);
    report("crowded", baseline.crowded, active.crowded, STRUCTURE_BATCHES);
    report("streaming", baseline.streaming, active.streaming, STREAMING_UPDATES);

    // A ceiling, not a target: this exists so a future change that makes the
    // observer an order of magnitude more expensive fails here rather than in
    // someone's browser.
    expect(active.structure.wallMs).toBeLessThan(baseline.structure.wallMs * 4 + 2_000);
    expect(active.streaming.wallMs).toBeLessThan(baseline.streaming.wallMs * 4 + 2_000);
  } finally {
    await context?.close();
    await rm(userDataDir, { recursive: true, force: true });
    await rm(extensionBaseDir, { recursive: true, force: true });
    await stopFixtureServer(fixture.server);
  }
});

async function runChurn(
  page: Page,
): Promise<{ structure: ChurnResult; crowded: ChurnResult; streaming: ChurnResult }> {
  const structure: ChurnResult[] = [];
  const crowded: ChurnResult[] = [];
  const streaming: ChurnResult[] = [];
  for (let repeat = 0; repeat < REPEATS; repeat += 1) {
    structure.push(await shape(page, "__churnStructure"));
    crowded.push(await shape(page, "__churnCrowded"));
    streaming.push(await shape(page, "__churnStreaming"));
  }
  return { structure: median(structure), crowded: median(crowded), streaming: median(streaming) };
}

async function shape(page: Page, name: string): Promise<ChurnResult> {
  return page.evaluate(
    (fn) => (window as unknown as Record<string, () => Promise<ChurnResult>>)[fn]!(),
    name,
  );
}

/** The median run, so one scheduling hiccup does not become the answer. */
function median(runs: ChurnResult[]): ChurnResult {
  const sorted = [...runs].sort((left, right) => left.wallMs - right.wallMs);
  return sorted[Math.floor(sorted.length / 2)]!;
}

function report(name: string, baseline: ChurnResult, active: ChurnResult, operations: number): void {
  const overheadMs = Math.round((active.wallMs - baseline.wallMs) * 100) / 100;
  const perOperationUs = Math.round((overheadMs * 1_000) / operations);
  console.log(
    [
      `R7 ${name}: ${operations} operations`,
      `  without FillNest: ${baseline.wallMs}ms wall, ${baseline.longTasks} long tasks (${baseline.longTaskMs}ms)`,
      `  with FillNest:    ${active.wallMs}ms wall, ${active.longTasks} long tasks (${active.longTaskMs}ms)`,
      `  overhead:         ${overheadMs}ms total, ~${perOperationUs}us per operation`,
    ].join("\n"),
  );
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
