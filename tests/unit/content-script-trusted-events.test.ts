// @vitest-environment happy-dom
//
// Task 007 Slice 2 gap #3 (SECURITY): PROJECT.md requires that "Host-page
// scripts cannot substitute synthetic events for the user's explicit Picker
// actions; action handlers accept only trusted browser events." The guard
// that enforces this lives in src/content/content-script.tsx, which wraps
// every rendered control (the field control button and the whole InlinePicker,
// including its row actions) inside a Shadow Root whose capture-phase click
// listener drops any event with isTrusted !== true before it can reach a
// button's own click handler.
//
// This mounts the real content script (not a re-implementation of the guard)
// against a stubbed chrome.runtime, focuses a real field to render the
// overlay + picker, and proves a synthetic (non-trusted) click on the Insert,
// Bind, and Delete row controls never triggers their action - while an
// (isTrusted-forced) trusted click on the same controls does.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FillNestState } from "../../src/storage/fillnest-repository";

const CONTROLLER_KEY = "__fillnestActivationController";

function dispatchClick(target: Element, options: { trusted: boolean }): void {
  const event = new MouseEvent("click", { bubbles: true, composed: true, cancelable: true });
  // jsdom/happy-dom-generated events are never isTrusted in a test
  // environment; force it for the "trusted" side of each comparison so both
  // branches of the guard are actually exercised.
  Object.defineProperty(event, "isTrusted", { value: options.trusted });
  target.dispatchEvent(event);
}

function activationSnapshotValue() {
  return {
    global: "active",
    page: {
      status: "available",
      origin: "https://example.test:443",
      pattern: "https://example.test:443/*",
      websiteAccess: true,
      originActivation: "active",
    },
  };
}

function baseTemplateState(overrides: { templateDeleted?: boolean } = {}): FillNestState {
  return {
    schemaVersion: 13,
    compatibilityPairDecisions: [],
    sites: [{ id: "example.test" }],
    templates: overrides.templateDeleted
      ? []
      : [
          {
            id: "template-1",
            content: "Reusable reply",
            siteAffinities: ["example.test"],
            createdAt: "x",
            updatedAt: "x",
            totalUsageCount: 0,
            revision: 0,
          },
        ],
    pageProfiles: [],
    fieldProfiles: [],
    bindings: overrides.templateDeleted
      ? []
      : [
          {
            id: "binding-1",
            templateId: "template-1",
            pageProfileId: "page-1",
            fieldProfileId: "field-1",
            createdAt: "x",
            usageCount: 0,
            revision: 0,
          },
        ],
    logicalPageSiteKeys: [],
    logicalPageRules: [],
    logicalPageProvenance: [],
    logicalPageObservations: [],
    sharedTemplateSets: [],
    sharedTemplateBindings: [],
    sharedTemplateFieldStates: [],
    pickerPosition: null,
    pageStatusPosition: null,
  };
}

describe("content-script: trusted-event enforcement on Picker/row actions", () => {
  let sendMessage: ReturnType<typeof vi.fn>;
  let deleteCalls: unknown[];
  let recordInsertionCalls: unknown[];

  beforeEach(() => {
    deleteCalls = [];
    recordInsertionCalls = [];
    let templateState = baseTemplateState();
    sendMessage = vi.fn(async (request: { type: string; [key: string]: unknown }) => {
      switch (request.type) {
        case "GET_ACTIVATION_SNAPSHOT":
          return { ok: true, value: activationSnapshotValue() };
        case "GET_PICKER_POSITION":
          return { ok: true, value: null };
        case "RESOLVE_FIELD_CONTEXT":
          return {
            ok: true,
            value: {
              pageProfileId: "page-1",
              fieldProfileId: "field-1",
              siteId: "example.test",
              recognized: true,
            },
          };
        case "READ_STATE":
          return { ok: true, value: templateState };
        case "DELETE_TEMPLATE":
          deleteCalls.push(request);
          templateState = baseTemplateState({ templateDeleted: true });
          return { ok: true, value: true };
        case "RECORD_INSERTION":
          recordInsertionCalls.push(request);
          return { ok: true, value: true };
        case "BIND_TEMPLATE":
          return { ok: true, value: { id: "binding-new" } };
        default:
          return { ok: true, value: {} };
      }
    });
    vi.stubGlobal("chrome", {
      runtime: {
        sendMessage,
        onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
      },
    });
    (globalThis as Record<string, unknown>)[CONTROLLER_KEY] = undefined;
  });

  afterEach(async () => {
    // Preact defers a mount's useEffect cleanup behind a timer. The content
    // script here is never explicitly torn down (its overlay host is just
    // removed from the DOM), so leave the chrome stub in place long enough
    // for that pending cleanup to run before the next test's beforeEach
    // replaces it - otherwise it fires later against a swapped-out/removed
    // stub and surfaces as an unrelated "chrome is not defined" error.
    await new Promise((resolve) => setTimeout(resolve, 60));
    document.body.replaceChildren();
    document.documentElement.removeAttribute("data-fillnest-extension-active");
    for (const host of document.documentElement.querySelectorAll(
      "[data-fillnest-overlay], [data-fillnest-page-status]",
    )) {
      host.remove();
    }
    delete (globalThis as Record<string, unknown>)[CONTROLLER_KEY];
    vi.resetModules();
  });

  async function mountWithFocusedField(): Promise<{
    field: HTMLInputElement;
    overlayHost: Element;
    shadowRoot: ShadowRoot;
  }> {
    await import("../../src/content/content-script");

    const field = document.createElement("input");
    field.type = "text";
    field.name = "notes";
    document.body.append(field);

    field.focus();
    field.dispatchEvent(new FocusEvent("focusin", { bubbles: true, composed: true }));

    const overlayHost = await vi.waitFor(() => {
      const host = document.documentElement.querySelector("[data-fillnest-overlay]");
      if (!host || !host.shadowRoot) throw new Error("Overlay not mounted yet");
      return host;
    });
    const shadowRoot = overlayHost.shadowRoot;
    if (!shadowRoot) throw new Error("Overlay shadow root missing");

    // Open the Picker with a trusted click on the field control button - this
    // exercises the same shadow-root guard, so it also proves the guard does
    // not block legitimate user interaction.
    const controlButton = await vi.waitFor(() => {
      const button = shadowRoot.querySelector("button.control");
      if (!button) throw new Error("Control button not rendered yet");
      return button;
    });
    dispatchClick(controlButton, { trusted: true });

    await vi.waitFor(() => {
      if (!shadowRoot.querySelector("[data-template-row]")) {
        throw new Error("Template row not rendered yet");
      }
    });

    return { field, overlayHost, shadowRoot };
  }

  it("ignores a synthetic (non-trusted) click on the field control button", async () => {
    await import("../../src/content/content-script");
    const field = document.createElement("input");
    field.type = "text";
    field.name = "notes";
    document.body.append(field);
    field.focus();
    field.dispatchEvent(new FocusEvent("focusin", { bubbles: true, composed: true }));

    const overlayHost = await vi.waitFor(() => {
      const host = document.documentElement.querySelector("[data-fillnest-overlay]");
      if (!host || !host.shadowRoot) throw new Error("Overlay not mounted yet");
      return host;
    });
    const shadowRoot = overlayHost.shadowRoot!;
    const controlButton = await vi.waitFor(() => {
      const button = shadowRoot.querySelector("button.control");
      if (!button) throw new Error("Control button not rendered yet");
      return button;
    });

    dispatchClick(controlButton, { trusted: false });
    // Give any (incorrect) handler a turn to run before asserting nothing happened.
    await Promise.resolve();
    expect(shadowRoot.querySelector("[data-template-row]")).toBeNull();
  });

  it("rejects a synthetic click on the Delete row action", async () => {
    const { shadowRoot } = await mountWithFocusedField();
    const deleteButton = shadowRoot.querySelector<HTMLButtonElement>('[aria-label="Delete template everywhere"]');
    if (!deleteButton) throw new Error("Delete button not found");

    dispatchClick(deleteButton, { trusted: false });
    await Promise.resolve();
    expect(deleteCalls).toEqual([]);
    expect(shadowRoot.querySelector("[data-template-row]")).not.toBeNull();

    // Positive control: the identical control, given a trusted event, does act.
    dispatchClick(deleteButton, { trusted: true });
    await vi.waitFor(() => expect(deleteCalls).toEqual([{ type: "DELETE_TEMPLATE", templateId: "template-1" }]));
  });

  it("rejects a synthetic click on the Insert (template row) action", async () => {
    const { field, shadowRoot } = await mountWithFocusedField();
    const templateContent = field.value;
    const row = shadowRoot.querySelector<HTMLButtonElement>("[data-template-content]");
    if (!row) throw new Error("Template content row not found");

    dispatchClick(row, { trusted: false });
    await Promise.resolve();
    expect(field.value).toBe(templateContent);
    expect(recordInsertionCalls).toEqual([]);

    // Positive control: a trusted click on the same row does insert.
    dispatchClick(row, { trusted: true });
    await vi.waitFor(() => expect(field.value).toContain("Reusable reply"));
  });

  it("rejects a synthetic click on the Bind row action", async () => {
    // Bind is only offered for a Template not yet bound to this field, so use
    // Search to surface an unbound Template's Bind action.
    let templateState: FillNestState = {
      ...baseTemplateState(),
      templates: [
        {
          id: "template-1",
          content: "Reusable reply",
          siteAffinities: ["example.test"],
          createdAt: "x",
          updatedAt: "x",
          totalUsageCount: 0,
          revision: 0,
        },
        {
          id: "template-2",
          content: "Unbound reply",
          siteAffinities: [],
          createdAt: "x",
          updatedAt: "x",
          totalUsageCount: 0,
          revision: 0,
        },
      ],
      bindings: [],
    };
    // The mocked `chrome.runtime.sendMessage` is declared as returning void in
    // the ambient Chrome types this file stubs, but the real one is async and
    // every caller awaits it.
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    sendMessage.mockImplementation(async (request: { type: string; [key: string]: unknown }) => {
      switch (request.type) {
        case "GET_ACTIVATION_SNAPSHOT":
          return { ok: true, value: activationSnapshotValue() };
        case "GET_PICKER_POSITION":
          return { ok: true, value: null };
        case "RESOLVE_FIELD_CONTEXT":
          return {
            ok: true,
            value: { pageProfileId: "page-1", fieldProfileId: "field-1", siteId: "example.test", recognized: true },
          };
        case "READ_STATE":
          return { ok: true, value: templateState };
        case "BIND_TEMPLATE":
          templateState = {
            ...templateState,
            bindings: [
              {
                id: "binding-new",
                templateId: "template-2",
                pageProfileId: "page-1",
                fieldProfileId: "field-1",
                createdAt: "x",
                usageCount: 0,
                revision: 0,
              },
            ],
          };
          return { ok: true, value: { id: "binding-new" } };
        default:
          return { ok: true, value: {} };
      }
    });

    await import("../../src/content/content-script");
    const field = document.createElement("input");
    field.type = "text";
    field.name = "notes";
    document.body.append(field);
    field.focus();
    field.dispatchEvent(new FocusEvent("focusin", { bubbles: true, composed: true }));

    const overlayHost = await vi.waitFor(() => {
      const host = document.documentElement.querySelector("[data-fillnest-overlay]");
      if (!host || !host.shadowRoot) throw new Error("Overlay not mounted yet");
      return host;
    });
    const shadowRoot = overlayHost.shadowRoot!;
    const controlButton = await vi.waitFor(() => {
      const button = shadowRoot.querySelector("button.control");
      if (!button) throw new Error("Control button not rendered yet");
      return button;
    });
    dispatchClick(controlButton, { trusted: true });

    const searchInput = await vi.waitFor(() => {
      const input = shadowRoot.querySelector<HTMLInputElement>('input[aria-label="Search templates"]');
      if (!input) throw new Error("Search input not found");
      return input;
    });
    searchInput.value = "unbound";
    searchInput.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true }));

    const bindButton = await vi.waitFor(() => {
      const button = shadowRoot.querySelector<HTMLButtonElement>('[aria-label="Bind to this field"]');
      if (!button) throw new Error("Bind button not rendered yet");
      return button;
    });

    dispatchClick(bindButton, { trusted: false });
    await Promise.resolve();
    expect(sendMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: "BIND_TEMPLATE" }));

    dispatchClick(bindButton, { trusted: true });
    await vi.waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ type: "BIND_TEMPLATE" })),
    );
  });
});
