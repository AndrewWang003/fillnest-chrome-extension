/**
 * @param {Record<string, unknown>} manifest
 * @param {Set<string>} files
 * @returns {string[]}
 */
export function validateBuiltPackage(manifest, files) {
  const errors = [];

  if (manifest.manifest_version !== 3) {
    errors.push("manifest_version must equal 3");
  }

  if (!isValidChromeVersion(manifest.version)) {
    errors.push("manifest version must be a valid non-zero Chrome version");
  }

  const background = manifest.background;
  if (
    !isRecord(background) ||
    background.service_worker !== "assets/service-worker.js" ||
    background.type !== "module"
  ) {
    errors.push(
      "manifest background must reference the module assets/service-worker.js",
    );
  }

  const action = manifest.action;
  if (!isRecord(action) || action.default_popup !== "popup.html") {
    errors.push("manifest action must reference popup.html");
  }

  const sidePanel = manifest.side_panel;
  if (!isRecord(sidePanel) || sidePanel.default_path !== "side-panel.html") {
    errors.push("manifest side_panel must reference side-panel.html");
  }

  if ("options_page" in manifest || "options_ui" in manifest) {
    errors.push("manifest must not declare an Options Page");
  }

  if (manifest.minimum_chrome_version !== "116") {
    errors.push("manifest minimum_chrome_version must equal 116");
  }

  if ("host_permissions" in manifest) {
    errors.push("manifest must not declare install-time host_permissions");
  }

  if ("content_scripts" in manifest) {
    errors.push("manifest must not declare static content_scripts");
  }

  const requiredPermissions = ["scripting", "sidePanel", "storage", "tabs"];
  if (!hasExactStrings(manifest.permissions, requiredPermissions)) {
    errors.push("manifest permissions must equal scripting, sidePanel, storage, tabs");
  }

  const optionalHostPermissions = ["http://*/*", "https://*/*"];
  if (!hasExactStrings(manifest.optional_host_permissions, optionalHostPermissions)) {
    errors.push(
      "manifest optional_host_permissions must equal http://*/*, https://*/*",
    );
  }

  // Task 028 Slice 4 (audit finding S3): the provided UI icons are inlined as
  // data: URIs, so nothing needs to be reachable from a host page. A
  // web-accessible resource is an extension-presence probe available to every
  // page the user authorized; the package must declare none.
  if ("web_accessible_resources" in manifest) {
    errors.push("manifest must not declare web_accessible_resources");
  }

  // Task 033 Addendum A: the store requires icons. Each one the manifest
  // names must be one of the store's sizes and must ship; and an icon file
  // ships only because the manifest names it, so nothing hides under the name.
  const declaredIcons = declaredIconPaths(manifest);
  for (const path of declaredIcons) {
    if (!ICON_PATH.test(path)) {
      errors.push(`manifest icon ${path} must be icons/icon-<16|32|48|128>.png`);
    } else if (!files.has(path)) {
      errors.push(`manifest icon ${path} is not in the built package`);
    }
  }

  const requiredFiles = [
    "manifest.json",
    "popup.html",
    "side-panel.html",
    "assets/service-worker.js",
    "assets/content-script.js",
  ];
  for (const file of requiredFiles) {
    if (!files.has(file)) {
      errors.push(`built package is missing ${file}`);
    }
  }

  for (const file of files) {
    if (!isAllowedBuiltFile(file, requiredFiles, declaredIcons)) {
      errors.push(`built package contains unexpected file ${file}`);
    }
  }

  return errors;
}

/**
 * @param {unknown} value
 * @param {string[]} expected
 */
function hasExactStrings(value, expected) {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    return false;
  }

  return [...value].sort().join("\n") === [...expected].sort().join("\n");
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const ICON_PATH = /^icons\/icon-(?:16|32|48|128)\.png$/u;

/**
 * Every path the manifest uses as an icon: `icons`, and the toolbar's
 * `action.default_icon`, which may be one path or a map of sizes.
 *
 * @param {Record<string, unknown>} manifest
 * @returns {Set<string>}
 */
function declaredIconPaths(manifest) {
  /** @type {Set<string>} */
  const paths = new Set();
  /** @param {unknown} value */
  const collect = (value) => {
    if (typeof value === "string") paths.add(value);
    else if (isRecord(value)) for (const path of Object.values(value)) if (typeof path === "string") paths.add(path);
  };
  collect(manifest.icons);
  if (isRecord(manifest.action)) collect(manifest.action.default_icon);
  return paths;
}

/**
 * @param {string} file
 * @param {string[]} requiredFiles
 * @param {Set<string>} declaredIcons
 */
function isAllowedBuiltFile(file, requiredFiles, declaredIcons) {
  return (
    requiredFiles.includes(file) ||
    (ICON_PATH.test(file) && declaredIcons.has(file)) ||
    // Task 028 Slice 4: the provided UI icons are inlined as data: URIs and
    // live under src/, so the package emits no loose SVG at all. Keeping an
    // allowance here would silently let one back into the package - and any
    // file in the package is a candidate for becoming web-accessible again.
    /^assets\/(?:popup|side-panel)-[A-Za-z0-9_-]+\.js$/u.test(file) ||
    /^assets\/surface-[A-Za-z0-9_-]+\.css$/u.test(file) ||
    /^assets\/chunks\/surface-[A-Za-z0-9_-]+\.js$/u.test(file) ||
    // Task 037: Chrome resolves the manifest's name and description from
    // `_locales` by the browser's own UI language, and offers no alternative.
    // Only message catalogues are allowed in - nothing else may hide there.
    /^_locales\/[a-z]{2}(?:_[A-Za-z]+)?\/messages\.json$/u.test(file)
  );
}

/** @param {unknown} value */
function isValidChromeVersion(value) {
  if (typeof value !== "string") {
    return false;
  }

  const parts = value.split(".");
  if (parts.length < 1 || parts.length > 4) {
    return false;
  }

  let hasNonZeroPart = false;
  for (const part of parts) {
    if (!/^\d+$/u.test(part) || (part.length > 1 && part.startsWith("0"))) {
      return false;
    }

    const numericPart = Number(part);
    if (numericPart > 65_535) {
      return false;
    }
    hasNonZeroPart ||= numericPart > 0;
  }

  return hasNonZeroPart;
}
