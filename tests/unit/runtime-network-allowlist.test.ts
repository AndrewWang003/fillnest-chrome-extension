import { describe, expect, it } from "vitest";

import { classifyRuntimeRequest } from "../helpers/runtime-network-allowlist";

describe("runtime network allowlist", () => {
  const allowedOrigins = new Set(["http://127.0.0.1:4173"]);

  it("allows only runner-controlled Fixture Origin navigation and assets", () => {
    expect(
      classifyRuntimeRequest({
        url: "http://127.0.0.1:4173/customer/one",
        initiatorUrl: "about:blank",
        resourceType: "document",
        navigation: true,
        allowedOrigins,
      }),
    ).toBeNull();
    expect(
      classifyRuntimeRequest({
        url: "http://127.0.0.1:4173/fixture.css",
        initiatorUrl: "http://127.0.0.1:4173/customer/one",
        resourceType: "stylesheet",
        navigation: false,
        allowedOrigins,
      }),
    ).toBeNull();
  });

  it("rejects remote, realtime, and extension-initiated network activity", () => {
    expect(
      classifyRuntimeRequest({
        url: "https://telemetry.example.test/collect",
        initiatorUrl: "http://127.0.0.1:4173/customer/one",
        resourceType: "fetch",
        navigation: false,
        allowedOrigins,
      }),
    ).toContain("unexpected origin");
    expect(
      classifyRuntimeRequest({
        url: "ws://127.0.0.1:4173/socket",
        initiatorUrl: "http://127.0.0.1:4173/customer/one",
        resourceType: "websocket",
        navigation: false,
        allowedOrigins,
      }),
    ).toContain("websocket");
    expect(
      classifyRuntimeRequest({
        url: "http://127.0.0.1:4173/events",
        initiatorUrl: "http://127.0.0.1:4173/customer/one",
        resourceType: "eventsource",
        navigation: false,
        allowedOrigins,
      }),
    ).toContain("eventsource");
    expect(
      classifyRuntimeRequest({
        url: "http://127.0.0.1:4173/allowed-looking",
        initiatorUrl: "chrome-extension://fillnest/service-worker.js",
        resourceType: "fetch",
        navigation: false,
        allowedOrigins,
      }),
    ).toContain("extension context");
  });
});
