import { describe, expect, it } from "vitest";

import {
  requireExactContentOriginSender,
  requireExtensionPage,
  requireOriginActivationSender,
} from "../../src/background/message-authorization";

const runtime = {
  id: "fillnest-extension-id",
  extensionUrlPrefix: "chrome-extension://fillnest-extension-id/",
};

describe("message authorization", () => {
  it("allows privileged mutations only from an extension page", () => {
    expect(() => requireExtensionPage({
      id: runtime.id,
      url: "chrome-extension://fillnest-extension-id/side-panel.html",
    }, runtime)).not.toThrow();

    expect(() => requireExtensionPage({
      id: runtime.id,
      url: "https://example.test/form",
    }, runtime)).toThrow("Permission changes require a FillNest extension page");
    expect(() => requireExtensionPage({
      id: "different-extension-id",
      url: "chrome-extension://fillnest-extension-id/side-panel.html",
    }, runtime)).toThrow("Permission changes require a FillNest extension page");
  });

  it("allows Origin Activation only from its matching page or an extension page", () => {
    expect(() => requireOriginActivationSender({
      id: runtime.id,
      url: "https://example.test/form",
    }, "https://example.test:443", runtime)).not.toThrow();
    expect(() => requireOriginActivationSender({
      id: runtime.id,
      url: "chrome-extension://fillnest-extension-id/popup.html",
    }, "https://example.test:443", runtime)).not.toThrow();

    expect(() => requireOriginActivationSender({
      id: runtime.id,
      url: "https://other.test/form",
    }, "https://example.test:443", runtime)).toThrow("Origin Activation requires its matching page context");
    expect(() => requireOriginActivationSender({
      id: "different-extension-id",
      url: "https://example.test/form",
    }, "https://example.test:443", runtime)).toThrow("Origin Activation requires a FillNest context");
  });

  it("allows Logical Page evidence only from its matching content-page Origin", () => {
    expect(() => requireExactContentOriginSender({
      id: runtime.id,
      url: "https://example.test/form",
    }, "https://example.test:443", runtime)).not.toThrow();

    expect(() => requireExactContentOriginSender({
      id: runtime.id,
      url: "chrome-extension://fillnest-extension-id/side-panel.html",
    }, "https://example.test:443", runtime)).toThrow("Logical Page evidence requires its matching content-page Origin");
  });
});
