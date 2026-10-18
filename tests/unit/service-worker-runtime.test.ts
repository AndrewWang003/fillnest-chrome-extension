// Runs the real service worker against an in-memory Chrome platform. Only
// storage and the platform's answers are simulated.
//
// Found by the 2026-09-11 audit, each at the worker boundary where the unit
// tests of the individual modules could not see it.

import { afterEach, describe, expect, it, vi } from "vitest";
import { createInitialActivationState } from "../../src/activation/activation-repository";
import { createInitialFillNestState } from "../../src/storage/fillnest-repository";
import { DEFAULT_THEME_ID } from "../../src/ui/theme/theme-tokens";
import { isRuntimeRequest } from "../../src/messages/runtime-messages";

type Response = { ok: true; value: unknown } | { ok: false; error: string; errorCode?: string };
type Journal = { status: string; priorState: { business: { templates: Array<{ content: string }> } } };

type StorageFault = (items: Record<string, unknown>) => void;

async function startWorker({
  grantedOrigins = [],
  seed = {},
  fault: initialFault,
}: { grantedOrigins?: string[]; seed?: Record<string, unknown>; fault?: StorageFault } = {}) {
  vi.resetModules();
  const data: Record<string, unknown> = {
    fillnestState: createInitialFillNestState(),
    fillnestActivation: createInitialActivationState(),
    ...structuredClone(seed),
  };
  let fault: StorageFault | undefined = initialFault;
  let listener: (message: unknown, sender: unknown, respond: (response: Response) => void) => void = () => {};
  const notifications: Array<{ type: string }> = [];
  const tabQueries: unknown[] = [];
  vi.stubGlobal("chrome", {
    storage: {
      local: {
        get: async (key: string) => structuredClone({ [key]: data[key] }),
        set: async (items: Record<string, unknown>) => {
          fault?.(items);
          Object.assign(data, structuredClone(items));
        },
        remove: async (key: string) => {
          delete data[key];
        },
      },
    },
    runtime: {
      id: "worker-test",
      getURL: (path: string) => `chrome-extension://worker-test/${path}`,
      getManifest: () => ({ version: "0.1.1" }),
      onInstalled: { addListener: vi.fn() },
      onMessage: { addListener: (next: typeof listener) => (listener = next) },
      sendMessage: async (message: { type: string }) => {
        notifications.push(message);
      },
    },
    permissions: { getAll: async () => ({ origins: grantedOrigins }), onRemoved: { addListener: vi.fn() } },
    scripting: { getRegisteredContentScripts: async () => [], registerContentScripts: async () => undefined },
    tabs: {
      query: async (query: unknown) => {
        tabQueries.push(query);
        return [];
      },
      sendMessage: async () => undefined,
    },
  });
  await import("../../src/background/service-worker");
  const send = (message: Record<string, unknown>): Promise<Response> =>
    new Promise((resolve) => {
      listener(message, { id: "worker-test", url: "chrome-extension://worker-test/side-panel.html" }, resolve);
    });
  const value = async (message: Record<string, unknown>) => {
    const response = await send(message);
    if (!response.ok) throw new Error(response.error);
    return response.value as Record<string, unknown>;
  };
  await send({ type: "GET_LANGUAGE" });
  const journal = () => data._fillnest_restore_journal as Journal | undefined;
  return { data, send, value, journal, notifications, tabQueries, listener: (...args: Parameters<typeof listener>) => listener(...args), setFault: (next: typeof fault) => (fault = next) };
}

afterEach(() => vi.unstubAllGlobals());

describe("Restore", () => {
  it("returns every business record exactly as it was backed up", async () => {
    const worker = await startWorker();
    await worker.value({
      type: "CREATE_TEMPLATE_AND_BIND",
      content: "Private field text",
      pageUrl: "https://example.com/form",
      pageProfileId: "page-a",
      fieldProfileId: "field-a",
      fieldObservedTitle: "Special instructions",
      privateToField: true,
    });
    await worker.value({ type: "RECORD_INSERTION_REJECTION", fieldProfileId: "field-a", rejected: true });
    await worker.value({ type: "SET_PAGE_STATUS_POSITION", position: { top: 120, left: 240 } });
    await worker.value({ type: "SET_PICKER_POSITION", position: { top: 10, left: 20 } });
    const backedUp = await worker.value({ type: "READ_STATE" });
    const { archiveJson } = await worker.value({ type: "CREATE_BACKUP_ARCHIVE" });

    await worker.value({ type: "CREATE_TEMPLATE", content: "Written after the backup", pageUrl: "https://example.com/" });
    const { confirmationToken } = await worker.value({ type: "VALIDATE_BACKUP_ARCHIVE", archiveJson });
    await worker.value({
      type: "RESTORE_BACKUP_ARCHIVE",
      archiveJson,
      typedConfirmation: "restore",
      expectedConfirmationToken: confirmationToken,
    });

    expect(await worker.value({ type: "READ_STATE" })).toEqual({ ...backedUp, logicalPageObservations: [] });
  });
});

describe("an error a user can meet (Task 037 acceptance 6)", () => {
  it("carries a code beside its English text", async () => {
    const worker = await startWorker();
    const { archiveJson } = await worker.value({ type: "CREATE_BACKUP_ARCHIVE" });

    expect(await worker.send({ type: "VALIDATE_BACKUP_ARCHIVE", archiveJson: "{broken" })).toEqual({
      ok: false,
      error: "File content is not valid JSON.",
      errorCode: "backup-invalid",
    });
    expect(
      await worker.send({
        type: "RESTORE_BACKUP_ARCHIVE",
        archiveJson,
        typedConfirmation: "restore",
        expectedConfirmationToken: "not-the-preview",
      }),
    ).toEqual(expect.objectContaining({ ok: false, errorCode: "restore-preview-stale" }));

    // Emptying the whole Library needs the typed word.
    const first = await worker.value({ type: "CREATE_TEMPLATE", content: "One", pageUrl: "https://example.com/" });
    const second = await worker.value({ type: "CREATE_TEMPLATE", content: "Two", pageUrl: "https://example.com/" });
    expect(await worker.send({ type: "DELETE_TEMPLATES", templateIds: [first.id, second.id] })).toEqual(
      expect.objectContaining({ ok: false, errorCode: "confirmation-mismatch" }),
    );
  });

  it("carries no code when it is an internal failure", async () => {
    const worker = await startWorker();
    const response = await worker.send({ type: "UPDATE_TEMPLATE", templateId: "missing", content: "x", expectedRevision: 0 });
    expect(response.ok).toBe(false);
    expect(response).not.toHaveProperty("errorCode");
  });
});

describe("Reset FillNest", () => {
  it("tells every open surface the language went back to System (Task 037 Addendum D)", async () => {
    const worker = await startWorker();
    await worker.value({ type: "SET_LANGUAGE", language: "zh-Hans" });
    worker.notifications.length = 0;
    const { confirmationToken } = await worker.value({ type: "GET_RESET_PREVIEW" });

    await worker.value({ type: "RESET_FILLNEST", typedConfirmation: "reset", expectedConfirmationToken: confirmationToken });

    expect(await worker.value({ type: "GET_LANGUAGE" })).toBe("system");
    expect(worker.notifications).toContainEqual({ type: "LANGUAGE_CHANGED", language: "system" });
  });
});

describe("a Restore whose rollback failed (Task 006 Addendum A)", () => {
  it("stops the worker taking any further change, as a failed journal found at startup does", async () => {
    const worker = await startWorker();
    await worker.value({ type: "CREATE_TEMPLATE", content: "Original user data", pageUrl: "https://example.com/" });
    const { archiveJson } = await worker.value({ type: "CREATE_BACKUP_ARCHIVE" });
    const { confirmationToken } = await worker.value({ type: "VALIDATE_BACKUP_ARCHIVE", archiveJson });
    let businessWrites = 0;
    let activationWrites = 0;
    worker.setFault((items) => {
      if ("fillnestState" in items && ++businessWrites === 2) throw new Error("Injected rollback failure");
      if ("fillnestActivation" in items && ++activationWrites === 1) throw new Error("Injected activation failure");
    });

    const restore = await worker.send({
      type: "RESTORE_BACKUP_ARCHIVE",
      archiveJson,
      typedConfirmation: "restore",
      expectedConfirmationToken: confirmationToken,
    });
    worker.setFault(undefined);

    expect(restore.ok).toBe(false);
    expect(worker.journal()?.status).toBe("failed");
    const later = await worker.send({ type: "CREATE_TEMPLATE", content: "After failure", pageUrl: "https://example.com/" });
    expect(later).toEqual(expect.objectContaining({ ok: false, errorCode: "restore-recovery-blocked" }));
    expect(worker.journal()?.status).toBe("failed");
    expect(worker.journal()?.priorState.business.templates[0]?.content).toBe("Original user data");
  });

  it("stays closed when persisting the failed journal status also fails (Task 039 R1)", async () => {
    const worker = await startWorker();
    const { archiveJson } = await worker.value({ type: "CREATE_BACKUP_ARCHIVE" });
    await worker.value({
      type: "CREATE_TEMPLATE",
      content: "Original user data",
      pageUrl: "https://example.com/",
    });
    const { confirmationToken } = await worker.value({
      type: "VALIDATE_BACKUP_ARCHIVE",
      archiveJson,
    });
    let businessWrites = 0;
    let activationWrites = 0;
    worker.setFault((items) => {
      if ((items["_fillnest_restore_journal"] as { status?: string } | undefined)?.status === "failed") {
        throw new Error("Injected journal update failure");
      }
      if ("fillnestState" in items && ++businessWrites === 2) {
        throw new Error("Injected rollback failure");
      }
      if ("fillnestActivation" in items && ++activationWrites === 1) {
        throw new Error("Injected activation failure");
      }
    });

    const restore = await worker.send({
      type: "RESTORE_BACKUP_ARCHIVE",
      archiveJson,
      typedConfirmation: "restore",
      expectedConfirmationToken: confirmationToken,
    });
    worker.setFault(undefined);

    expect(restore.ok).toBe(false);
    expect(worker.journal()?.status).toBe("in_progress");
    expect(worker.journal()?.priorState.business.templates[0]?.content).toBe("Original user data");
    expect(
      await worker.send({
        type: "CREATE_TEMPLATE",
        content: "After failure",
        pageUrl: "https://example.com/",
      }),
    ).toEqual(expect.objectContaining({ ok: false, errorCode: "restore-recovery-blocked" }));
    expect(worker.journal()?.status).toBe("in_progress");
    expect(worker.journal()?.priorState.business.templates[0]?.content).toBe("Original user data");
  });
});

// Task 038 Addendum B: a way back for a page button moved out of sight.
describe("putting the page button back in its corner", () => {
  it("forgets the stored position and tells open pages", async () => {
    const worker = await startWorker();
    await worker.value({ type: "SET_PAGE_STATUS_POSITION", position: { top: 120, left: 240 } });
    worker.notifications.length = 0;

    await worker.value({ type: "RESET_PAGE_STATUS_POSITION" });

    expect(await worker.value({ type: "GET_PAGE_STATUS_POSITION" })).toBeNull();
    expect(worker.notifications).toEqual([{ type: "PAGE_STATUS_POSITION_RESET" }]);
  });

  it("accepts the request only from FillNest's own pages", async () => {
    const worker = await startWorker();
    const response = await new Promise<Response>((resolve) => {
      worker.listener({ type: "RESET_PAGE_STATUS_POSITION" }, { id: "worker-test", url: "https://example.com/", tab: { id: 1 } }, resolve);
    });
    expect(response.ok).toBe(false);
  });
});

// Task 042: the first-use tips this browser has dismissed.
describe("first-use tips", () => {
  it("remembers a dismissed tip, and Show tips again forgets them all", async () => {
    const worker = await startWorker();
    expect(await worker.value({ type: "GET_DISMISSED_TIPS" })).toEqual([]);

    expect(await worker.value({ type: "DISMISS_TIP", tip: "popup-start" })).toEqual(["popup-start"]);
    expect(await worker.value({ type: "GET_DISMISSED_TIPS" })).toEqual(["popup-start"]);

    await worker.value({ type: "SHOW_TIPS_AGAIN" });
    expect(await worker.value({ type: "GET_DISMISSED_TIPS" })).toEqual([]);
  });

  it("refuses a tip it does not know, and Show tips again from a page", async () => {
    const worker = await startWorker();
    expect(isRuntimeRequest({ type: "DISMISS_TIP", tip: "made-up" })).toBe(false);
    expect(isRuntimeRequest({ type: "DISMISS_TIP", tip: "sites" })).toBe(true);
    const fromPage = await new Promise<Response>((resolve) => {
      worker.listener({ type: "SHOW_TIPS_AGAIN" }, { id: "worker-test", url: "https://example.com/", tab: { id: 1 } }, resolve);
    });
    expect(fromPage.ok).toBe(false);
  });

  it("is cleared by Reset FillNest and stays out of a Backup Archive", async () => {
    const worker = await startWorker();
    await worker.value({ type: "DISMISS_TIP", tip: "sites" });

    const { archiveJson } = await worker.value({ type: "CREATE_BACKUP_ARCHIVE" });
    expect(String(archiveJson)).not.toContain("sites\"]");
    expect(String(archiveJson)).not.toContain("DismissedTips");

    const { confirmationToken } = await worker.value({ type: "GET_RESET_PREVIEW" });
    await worker.value({ type: "RESET_FILLNEST", typedConfirmation: "reset", expectedConfirmationToken: confirmationToken });
    expect(await worker.value({ type: "GET_DISMISSED_TIPS" })).toEqual([]);
    expect(worker.data.fillnestDismissedTips).toBeUndefined();
  });
});

describe("telling open tabs about a change (Task 033 Addendum A)", () => {
  // Task 033 Addendum E. Every start of the worker reconciles Website Access
  // and activates the open pages it covers. That asked for every open tab,
  // reading each address only to try injecting into all of them.
  it("asks only for tabs on authorized Sites when the worker starts", async () => {
    const worker = await startWorker({ grantedOrigins: ["https://example.com:443/*"] });

    expect(worker.tabQueries.length).toBeGreaterThan(0);
    expect(worker.tabQueries).toEqual(worker.tabQueries.map(() => ({ url: ["https://example.com:443/*"] })));
  });

  it("asks for no tab at all when the worker starts with no Site authorized", async () => {
    const worker = await startWorker();

    expect(worker.tabQueries).toEqual([]);
  });

  it("asks Chrome only for tabs on authorized Sites, never for every tab's address", async () => {
    const worker = await startWorker({ grantedOrigins: ["https://example.com/*"] });
    worker.tabQueries.length = 0;

    await worker.value({ type: "SET_LANGUAGE", language: "zh-Hans" });

    expect(worker.tabQueries).toEqual([{ url: ["https://example.com/*"] }]);
  });

  it("asks for no tab at all when no Site is authorized", async () => {
    const worker = await startWorker();
    worker.tabQueries.length = 0;

    await worker.value({ type: "SET_LANGUAGE", language: "zh-Hans" });

    expect(worker.tabQueries).toEqual([]);
  });
});

describe("a failed Restore journal found at startup (Task 006 Addendum B)", () => {
  const priorTemplate = {
    id: "prior",
    content: "Original user data",
    siteAffinities: ["example.com"],
    createdAt: "2026-09-11T00:00:00.000Z",
    updatedAt: "2026-09-11T00:00:00.000Z",
    totalUsageCount: 0,
    revision: 0,
  };
  const failedJournal = {
    _fillnest_restore_journal: {
      transactionId: "txn-1",
      status: "failed",
      createdAt: "2026-09-11T00:00:00.000Z",
      failureReason: "Injected rollback failure",
      priorState: {
        business: { ...createInitialFillNestState(), sites: [{ id: "example.com" }], templates: [priorTemplate] },
        activation: createInitialActivationState(),
      },
    },
  };

  it("tries the rollback again, and puts the prior data back when it succeeds", async () => {
    const worker = await startWorker({ seed: failedJournal });

    const state = await worker.value({ type: "READ_STATE" });
    expect((state.templates as Array<{ content: string }>).map((template) => template.content)).toEqual(["Original user data"]);
    expect(worker.journal()).toBeUndefined();
    expect((await worker.send({ type: "CREATE_TEMPLATE", content: "Next", pageUrl: "https://example.com/" })).ok).toBe(true);
  });

  it("stays closed when the retry fails, and lets Reset FillNest start over", async () => {
    const worker = await startWorker({
      seed: failedJournal,
      fault: (items) => {
        if ("fillnestState" in items) throw new Error("Storage still failing");
      },
    });

    expect(await worker.send({ type: "READ_STATE" })).toEqual(
      expect.objectContaining({ ok: false, errorCode: "restore-recovery-blocked" }),
    );
    expect(worker.journal()?.status).toBe("failed");

    worker.setFault(undefined);
    const { confirmationToken } = await worker.value({ type: "GET_RESET_PREVIEW" });
    await worker.value({ type: "RESET_FILLNEST", typedConfirmation: "reset", expectedConfirmationToken: confirmationToken });

    expect(worker.journal()).toBeUndefined();
    expect((await worker.value({ type: "READ_STATE" })).templates).toEqual([]);
    expect((await worker.send({ type: "CREATE_TEMPLATE", content: "Fresh start", pageUrl: "https://example.com/" })).ok).toBe(true);
  });

  // Owner QA, 2026-09-11: someone locked out in a language they cannot read
  // must be able to switch to one they can. Neither preference is part of
  // the data the journal protects.
  it("still lets the language and theme be changed while closed", async () => {
    const worker = await startWorker({
      seed: failedJournal,
      fault: (items) => {
        if ("fillnestState" in items) throw new Error("Storage still failing");
      },
    });

    expect(await worker.value({ type: "SET_LANGUAGE", language: "zh-Hans" })).toBe("zh-Hans");
    expect(await worker.value({ type: "GET_LANGUAGE" })).toBe("zh-Hans");
    expect((await worker.send({ type: "SET_APPEARANCE", appearance: { themeId: DEFAULT_THEME_ID, mode: "dark" } })).ok).toBe(true);
    expect(await worker.send({ type: "CREATE_TEMPLATE", content: "Blocked", pageUrl: "https://example.com/" })).toEqual(
      expect.objectContaining({ ok: false, errorCode: "restore-recovery-blocked" }),
    );
    expect(worker.journal()?.status).toBe("failed");
  });
});
