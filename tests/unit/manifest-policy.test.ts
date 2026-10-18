import { describe, expect, it } from "vitest";

import { validateBuiltPackage } from "../../scripts/lib/manifest-policy.mjs";
import { findForbiddenNetworkCapabilities } from "../../scripts/lib/network-capability-policy.mjs";

const validManifest = {
  manifest_version: 3,
  name: "FillNest",
  version: "0.1.0",
  background: {
    service_worker: "assets/service-worker.js",
    type: "module",
  },
  action: {
    default_popup: "popup.html",
  },
  side_panel: { default_path: "side-panel.html" },
  minimum_chrome_version: "116",
  permissions: ["storage", "tabs", "scripting", "sidePanel"],
  optional_host_permissions: ["http://*/*", "https://*/*"],
};

const validFiles = new Set([
  "manifest.json",
  "popup.html",
  "side-panel.html",
  "pencil.svg",
  "map-pin.svg",
  "assets/service-worker.js",
  "assets/content-script.js",
]);

describe("built extension manifest policy", () => {
  it("rejects product network APIs and telemetry markers in built code", () => {
    expect(
      findForbiddenNetworkCapabilities(
        "fetch('/collect'); new XMLHttpRequest(); new WebSocket('wss://x'); new EventSource('/events'); posthog.capture('x');",
      ),
    ).toEqual(["EventSource", "XMLHttpRequest", "WebSocket", "fetch", "posthog"]);
    expect(findForbiddenNetworkCapabilities("chrome.runtime.sendMessage({ type: 'READ_STATE' })"))
      .toEqual([]);
  });

  it("rejects install-time host permissions", () => {
    const errors = validateBuiltPackage(
      {
        ...validManifest,
        host_permissions: ["https://example.com/*"],
      },
      validFiles,
    );

    expect(errors).toContain("manifest must not declare install-time host_permissions");
  });

  it("rejects statically declared content scripts", () => {
    const errors = validateBuiltPackage(
      {
        ...validManifest,
        content_scripts: [
          {
            matches: ["https://*/*"],
            js: ["assets/content-script.js"],
          },
        ],
      },
      validFiles,
    );

    expect(errors).toContain("manifest must not declare static content_scripts");
  });

  it("rejects required permission drift", () => {
    const errors = validateBuiltPackage(
      {
        ...validManifest,
        permissions: ["storage", "activeTab"],
      },
      validFiles,
    );

    expect(errors).toContain(
      "manifest permissions must equal scripting, sidePanel, storage, tabs",
    );
  });

  it("rejects optional host declaration drift", () => {
    const errors = validateBuiltPackage(
      {
        ...validManifest,
        optional_host_permissions: ["https://*/*"],
      },
      validFiles,
    );

    expect(errors).toContain(
      "manifest optional_host_permissions must equal http://*/*, https://*/*",
    );
  });

  it("rejects any web-accessible resource at all", () => {
    // Task 028 Slice 4 (audit finding S3): the provided UI icons are inlined
    // as data: URIs, so nothing needs host-page reach. Any web-accessible
    // resource is an extension-presence probe for every authorized page, so
    // the gate rejects the whole key rather than policing its contents - the
    // previous rule permitted the icons and would have permitted their
    // reintroduction.
    for (const resources of [
      [{ resources: ["assets/content-script.js"], matches: ["http://*/*", "https://*/*"] }],
      [{ resources: ["pencil.svg"], matches: ["https://*/*"] }],
      [],
    ]) {
      const errors = validateBuiltPackage(
        { ...validManifest, web_accessible_resources: resources },
        validFiles,
      );
      expect(errors).toContain("manifest must not declare web_accessible_resources");
    }
  });

  it("rejects a package with a missing extension entry", () => {
    const files = new Set(validFiles);
    files.delete("assets/service-worker.js");

    const errors = validateBuiltPackage(validManifest, files);

    expect(errors).toContain("built package is missing assets/service-worker.js");
  });

  it("rejects a non-MV3 manifest", () => {
    const errors = validateBuiltPackage(
      {
        ...validManifest,
        manifest_version: 2,
      },
      validFiles,
    );

    expect(errors).toContain("manifest_version must equal 3");
  });

  it("rejects a service-worker entrypoint drift", () => {
    const errors = validateBuiltPackage(
      {
        ...validManifest,
        background: {
          service_worker: "assets/other-worker.js",
          type: "module",
        },
      },
      validFiles,
    );

    expect(errors).toContain(
      "manifest background must reference the module assets/service-worker.js",
    );
  });

  it("rejects extension-surface entrypoint drift", () => {
    const errors = validateBuiltPackage(
      {
        ...validManifest,
        action: {
          default_popup: "other-popup.html",
        },
        side_panel: { default_path: "other-panel.html" },
      },
      validFiles,
    );

    expect(errors).toContain("manifest action must reference popup.html");
    expect(errors).toContain("manifest side_panel must reference side-panel.html");
  });

  it("rejects Options Page and Chrome versions below 116", () => {
    const errors = validateBuiltPackage(
      { ...validManifest, options_page: "options.html", minimum_chrome_version: "115" },
      validFiles,
    );

    expect(errors).toContain("manifest must not declare an Options Page");
    expect(errors).toContain("manifest minimum_chrome_version must equal 116");
  });

  it("rejects an unrelated built file", () => {
    const files = new Set(validFiles);
    files.add("assets/unrelated.js");

    const errors = validateBuiltPackage(validManifest, files);

    expect(errors).toContain("built package contains unexpected file assets/unrelated.js");
  });

  // Task 033 Addendum A: the store requires icons, and the package gate must
  // let exactly those in - and nothing else under their name.
  describe("icons", () => {
    const iconPaths = ["icons/icon-16.png", "icons/icon-32.png", "icons/icon-48.png", "icons/icon-128.png"];
    const withIcons = {
      ...validManifest,
      icons: { 16: iconPaths[0], 32: iconPaths[1], 48: iconPaths[2], 128: iconPaths[3] },
      action: { ...validManifest.action, default_icon: { 16: iconPaths[0], 32: iconPaths[1] } },
    };
    const iconErrors = (errors: string[]) => errors.filter((error) => error.includes("icon"));

    it("accepts the store's icon sizes when the manifest declares them", () => {
      const errors = validateBuiltPackage(withIcons, new Set([...validFiles, ...iconPaths]));
      expect(iconErrors(errors)).toEqual([]);
    });

    it("rejects a declared icon the package does not contain", () => {
      const errors = validateBuiltPackage(withIcons, new Set([...validFiles, ...iconPaths.slice(1)]));
      expect(errors).toContain("manifest icon icons/icon-16.png is not in the built package");
    });

    it("rejects an icon the manifest does not declare", () => {
      const errors = validateBuiltPackage(validManifest, new Set([...validFiles, "icons/icon-48.png"]));
      expect(errors).toContain("built package contains unexpected file icons/icon-48.png");
    });

    it("rejects an icon path outside the store's sizes", () => {
      const errors = validateBuiltPackage(
        { ...validManifest, icons: { 64: "icons/icon-64.png" } },
        new Set([...validFiles, "icons/icon-64.png"]),
      );
      expect(errors).toContain("manifest icon icons/icon-64.png must be icons/icon-<16|32|48|128>.png");
    });
  });

  it("rejects an all-zero extension version", () => {
    const errors = validateBuiltPackage(
      {
        ...validManifest,
        version: "0.0.0",
      },
      validFiles,
    );

    expect(errors).toContain("manifest version must be a valid non-zero Chrome version");
  });
});
