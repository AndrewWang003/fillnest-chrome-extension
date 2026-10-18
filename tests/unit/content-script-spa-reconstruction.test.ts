// @vitest-environment happy-dom
//
// Task 007 Slice 2 gap #4 (idempotency): Task 001/PROJECT SC6 require that
// static, conditional, SPA-created, reconstructed, and disappearing fields
// never end up with duplicate FillNest UI or listeners. src/content/content-
// The content script observes lifecycle mutations while retaining one overlay
// host (`ensureOverlay` returns early if one already exists). This test proves
// that invariant across a React/SPA-style remove-and-recreate of the same
// logical field, including the field regaining focus twice in a row.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { permissionOriginFromUrl } from "../../src/permissions/permission-origin";

const CONTROLLER_KEY = "__fillnestActivationController";

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

function emptyTemplateState() {
  return {
    schemaVersion: 13,
    compatibilityPairDecisions: [],
    sites: [{ id: "example.test" }],
    templates: [],
    pageProfiles: [],
    fieldProfiles: [],
    bindings: [],
    pickerPosition: null,
    pageStatusPosition: null,
  };
}

describe("content-script: exactly one overlay/control across SPA field reconstruction", () => {
  const runtimeListeners = new Set<(message: unknown) => void>();
  let sendMessage: ReturnType<typeof vi.fn>;
  let resolutionCount = 0;

  beforeEach(() => {
    resolutionCount = 0;
    sendMessage = vi.fn(async (request: { type: string }) => {
      switch (request.type) {
        case "GET_ACTIVATION_SNAPSHOT":
          return { ok: true, value: activationSnapshotValue() };
        case "GET_PICKER_POSITION":
          return { ok: true, value: null };
        case "RESOLVE_FIELD_CONTEXT":
          // A distinct identity per resolution, so a test can tell "the same
          // Field kept its context" apart from "the Field was re-resolved and
          // silently became a different Field Profile".
          resolutionCount += 1;
          return {
            ok: true,
            value: {
              pageProfileId: "page-1",
              fieldProfileId: `field-${resolutionCount}`,
              siteId: "example.test",
              recognized: true,
            },
          };
        case "READ_STATE":
          return { ok: true, value: emptyTemplateState() };
        default:
          return { ok: true, value: {} };
      }
    });
    vi.stubGlobal("chrome", {
      runtime: {
        sendMessage,
        onMessage: {
          addListener: vi.fn((listener: (message: unknown) => void) => runtimeListeners.add(listener)),
          removeListener: vi.fn((listener: (message: unknown) => void) => runtimeListeners.delete(listener)),
        },
      },
    });
    (globalThis as Record<string, unknown>)[CONTROLLER_KEY] = undefined;
  });

  afterEach(async () => {
    for (const listener of runtimeListeners) {
      listener({ type: "PERMISSION_REVOKED", patterns: [permissionOriginFromUrl(location.href).pattern] });
    }
    runtimeListeners.clear();
    // See content-script-trusted-events.test.ts for why the chrome stub
    // must outlive this test's body: Preact defers a mount's effect cleanup
    // behind a timer, and this content script is never explicitly torn down.
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

  function focus(field: HTMLInputElement): void {
    field.focus();
    field.dispatchEvent(new FocusEvent("focusin", { bubbles: true, composed: true }));
  }

  function overlayHosts(): NodeListOf<Element> {
    return document.documentElement.querySelectorAll("[data-fillnest-overlay]");
  }

  it("keeps exactly one overlay/control after the same field is removed and an equivalent field is reconstructed in its place", async () => {
    await import("../../src/content/content-script");

    const fieldA = document.createElement("input");
    fieldA.type = "text";
    fieldA.name = "notes";
    document.body.append(fieldA);
    focus(fieldA);

    await vi.waitFor(() => expect(overlayHosts()).toHaveLength(1));
    const firstOverlay = overlayHosts()[0]!;
    expect(firstOverlay.shadowRoot?.querySelectorAll("button.control")).toHaveLength(1);

    // Simulate an SPA reconstructing the same logical field: the old DOM
    // node is discarded (as a MutationObserver-based scan would observe as a
    // removal) and a fresh, attribute-identical node takes its place, then
    // regains focus - twice in a row, mirroring a re-render "flicker".
    fieldA.remove();
    const fieldB = document.createElement("input");
    fieldB.type = "text";
    fieldB.name = "notes";
    document.body.append(fieldB);
    focus(fieldB);
    focus(fieldB);

    await vi.waitFor(() => {
      const button = document
        .documentElement
        .querySelector("[data-fillnest-overlay]")
        ?.shadowRoot?.querySelector("button.control");
      if (!button) throw new Error("Overlay not re-mounted for reconstructed field yet");
    });

    expect(overlayHosts()).toHaveLength(1);
    const overlay = overlayHosts()[0]!;
    expect(overlay.shadowRoot?.querySelectorAll("button.control")).toHaveLength(1);
    expect(document.querySelectorAll("[data-fillnest-overlay]")).toHaveLength(1);
  });

  it("keeps exactly one overlay/control when the same field is focused twice in a row without any DOM change", async () => {
    await import("../../src/content/content-script");

    const field = document.createElement("input");
    field.type = "text";
    field.name = "notes";
    document.body.append(field);

    focus(field);
    focus(field);
    focus(field);

    await vi.waitFor(() => expect(overlayHosts()).toHaveLength(1));
    expect(overlayHosts()[0]!.shadowRoot?.querySelectorAll("button.control")).toHaveLength(1);
  });

  it("removes a Rich Text Field marker when the host becomes noneditable (Task 039 C3)", async () => {
    const field = document.createElement("div");
    field.setAttribute("contenteditable", "true");
    field.setAttribute("aria-label", "Message");
    Object.defineProperty(field, "isContentEditable", {
      configurable: true,
      get: () => field.getAttribute("contenteditable") === "true",
    });
    document.body.append(field);

    await import("../../src/content/content-script");
    await vi.waitFor(() => expect(field.hasAttribute("data-fillnest-field")).toBe(true));

    field.setAttribute("contenteditable", "false");

    await vi.waitFor(() => expect(field.hasAttribute("data-fillnest-field")).toBe(false));
  });

  it("removes a child host marker when its ancestor becomes editable (Task 039 C3)", async () => {
    const parent = document.createElement("div");
    const field = document.createElement("div");
    field.setAttribute("contenteditable", "true");
    field.setAttribute("aria-label", "Message");
    Object.defineProperty(parent, "isContentEditable", {
      configurable: true,
      get: () => parent.getAttribute("contenteditable") === "true",
    });
    Object.defineProperty(field, "isContentEditable", {
      configurable: true,
      get: () => field.getAttribute("contenteditable") === "true",
    });
    parent.append(field);
    document.body.append(parent);

    await import("../../src/content/content-script");
    await vi.waitFor(() => expect(field.hasAttribute("data-fillnest-field")).toBe(true));

    parent.setAttribute("contenteditable", "true");

    await vi.waitFor(() => expect(field.hasAttribute("data-fillnest-field")).toBe(false));
  });

  // Task 004 Addendum B follow-up. The document-lifetime Field Context cache
  // is what keeps an SPA-reconstructed Field's identity stable: a fresh
  // candidate resolves with no field identity key, so every re-resolution
  // mints a new Field Profile id. Addendum B dropped that cache on any
  // BUSINESS_STATE_CHANGED, which discarded the identity the user's own
  // mutation had just been recorded against. Only a change that can remove
  // stored Page/Field Profiles may invalidate it, which the broadcast now
  // states explicitly.
  //
  // The Addendum B unit test could not see either behaviour: a plain Field has
  // a real page identity key, so it is never cached and re-resolves on every
  // focus with or without the clear.
  describe("a reconstructed Field's cached identity", () => {
    async function reachCachedSteadyState(): Promise<HTMLInputElement> {
      await import("../../src/content/content-script");

      const original = document.createElement("input");
      original.type = "text";
      original.name = "notes";
      document.body.append(original);
      focus(original);
      await vi.waitFor(() => expect(overlayHosts()).toHaveLength(1));

      // One MutationObserver batch removes the Field and puts an
      // attribute-identical one in its place, which makes the replacement a
      // fresh candidate rather than a recognized Field.
      original.remove();
      const replacement = document.createElement("input");
      replacement.type = "text";
      replacement.name = "notes";
      document.body.append(replacement);
      focus(replacement);
      await settle();

      // Focus until re-focusing stops resolving: that is the cache engaging.
      focus(replacement);
      await settle();
      const cached = resolutionCount;
      focus(replacement);
      await settle();
      expect(resolutionCount).toBe(cached);

      return replacement;
    }

    async function settle(): Promise<void> {
      await new Promise((resolve) => setTimeout(resolve, 30));
    }

    it("survives an ordinary mutation elsewhere", async () => {
      const replacement = await reachCachedSteadyState();
      const cached = resolutionCount;

      // The user binds a Template to this Field; the service worker broadcasts
      // before resolving the originating request.
      for (const listener of runtimeListeners) {
        listener({ type: "BUSINESS_STATE_CHANGED", fieldIdentitiesInvalidated: false });
      }
      focus(replacement);
      await settle();

      expect(resolutionCount).toBe(cached);
    });

    it("is dropped when the change could have removed stored profiles", async () => {
      const replacement = await reachCachedSteadyState();
      const cached = resolutionCount;

      // Clear Site Data removed the Page and Field Profiles this cache holds.
      for (const listener of runtimeListeners) {
        listener({ type: "BUSINESS_STATE_CHANGED", fieldIdentitiesInvalidated: true });
      }
      focus(replacement);
      await settle();

      expect(resolutionCount).toBeGreaterThan(cached);
    });
  });
});
