// @vitest-environment happy-dom

import { readFileSync } from "node:fs";
import { render } from "preact";
import { afterEach, describe, expect, it, vi } from "vitest";

import { applyThemeToElement } from "../../src/ui/theme/apply-theme";
import { ThemeChooser } from "../../src/ui/side-panel/SettingsPage";
import { pageStatusStyles } from "../../src/ui/page-status/PageStatusControl";
import { pickerStyles } from "../../src/ui/picker/picker-styles";
import {
  buildThemeCustomProperties,
  buildThemeTokens,
  DEFAULT_APPEARANCE,
  resolveThemeMode,
  THEME_TOKEN_NAMES,
  THEMES,
} from "../../src/ui/theme/theme-tokens";

describe("theme tokens (Task 034)", () => {
  it("resolves system against the host and honours an explicit choice over it", () => {
    expect(resolveThemeMode("system", true)).toBe("dark");
    expect(resolveThemeMode("system", false)).toBe("light");
    expect(resolveThemeMode("light", true)).toBe("light");
    expect(resolveThemeMode("dark", false)).toBe("dark");
  });

  it("falls back to the first theme rather than producing an incomplete palette", () => {
    const known = new Set(Object.keys(buildThemeTokens("default", "light")));
    for (const theme of THEMES) {
      for (const mode of ["light", "dark"] as const) {
        expect(new Set(Object.keys(buildThemeTokens(theme.id, mode)))).toEqual(known);
      }
    }
  });

  it("names every property with the --fn- prefix the stylesheets use", () => {
    const properties = buildThemeCustomProperties("ocean", "dark");
    expect(Object.keys(properties).every((name) => name.startsWith("--fn-"))).toBe(true);
    expect(properties["--fn-accent"]).toBe(buildThemeTokens("ocean", "dark")["accent"]);
  });
});

describe("applyThemeToElement (Task 034)", () => {
  it("writes the palette, the theme identity and color-scheme onto the element itself", () => {
    const element = document.createElement("div");
    applyThemeToElement(element, "plum", "dark");

    expect(element.dataset["fnTheme"]).toBe("plum");
    expect(element.dataset["fnMode"]).toBe("dark");
    expect(element.style.getPropertyValue("color-scheme")).toBe("dark");
    // Written inline rather than through a stylesheet, because the Picker's
    // host lives in a page FillNest does not own.
    expect(element.style.getPropertyValue("--fn-accent")).toBe(buildThemeTokens("plum", "dark")["accent"]);
    expect(element.style.getPropertyValue("--fn-surface")).toBe(buildThemeTokens("plum", "dark")["surface"]);
  });
});

describe("every FillNest stylesheet resolves its colours through the tokens (Task 034)", () => {
  const sheets: ReadonlyArray<readonly [string, string]> = [
    ["side-panel.css", readFileSync("src/ui/side-panel/side-panel.css", "utf8")],
    ["popup.css", readFileSync("src/ui/popup/popup.css", "utf8")],
    ["picker-styles.ts", pickerStyles],
    // The fourth one. Task 034 tokenized three and left this sheet hard-coded,
    // so the page-status control stayed light under every theme; listing it
    // here is the check that would have caught that.
    ["PageStatusControl.tsx (page-status styles)", pageStatusStyles],
    ["toggle-switch.css", readFileSync("src/ui/shared/toggle-switch.css", "utf8")],
    [
      "current-website-access.css",
      readFileSync("src/ui/shared/current-website-access.css", "utf8"),
    ],
  ];

  it("reads no token that does not exist, and declares no token nothing reads", () => {
    // The two ways a token can be silently wrong. A `var(--fn-typo)` resolves
    // to nothing and the property is simply dropped - no error, no colour. A
    // token nobody reads is dead weight that still has to pass the contrast
    // test and still has to be defined in both ramps.
    const declared = new Set(THEME_TOKEN_NAMES);
    const used = new Set<string>();
    for (const [, source] of sheets) {
      for (const match of source.matchAll(/var\(--fn-([a-z-]+)\)/gu)) used.add(match[1]!);
    }

    const unknown = [...used].filter((name) => !declared.has(name as never)).sort();
    expect(unknown, "stylesheets read tokens that no theme defines").toEqual([]);

    const unused = [...declared].filter((name) => !used.has(name)).sort();
    expect(unused, "tokens are defined but read by no stylesheet").toEqual([]);
  });

  for (const [name, source] of sheets) {
    it(`${name} sizes provided-asset icons by their marker, never as an image`, () => {
      // Task 023 Addendum B4 replaced every provided-asset `<img>` with a
      // masked `<span data-fillnest-asset>`; the product now renders no
      // `<img>` at all. A surviving `img` rule is therefore always a masked
      // icon left with no width or height - which is invisible, not merely
      // unstyled. It cost the Side Panel's rename action (Addendum B5) and
      // then the Picker's Locate action.
      expect(source.match(/\bimg\b\s*[{,]/gu) ?? [], `${name} still styles an img element`).toEqual([]);
    });

    it(`${name} declares no literal colour of its own`, () => {
      // A hard-coded colour here is a surface the theme silently does not
      // reach - the failure mode this whole task exists to remove. System
      // colour keywords inside the forced-colors block are deliberate and are
      // not literals.
      expect(source.match(/#[0-9a-fA-F]{3,8}\b/gu) ?? [], `${name} still has literal hex colours`).toEqual([]);
      expect(source.match(/rgba?\((?!var\()\s*\d/gu) ?? [], `${name} still has literal rgb colours`).toEqual([]);
    });
  }
});

describe("Settings appearance chooser (Task 034)", () => {
  afterEach(() => document.body.replaceChildren());

  it("offers every theme with a live preview of the currently selected mode, and reports a choice", () => {
    const root = document.createElement("div");
    document.body.append(root);
    const onChange = vi.fn();

    render(<ThemeChooser appearance={{ themeId: "default", mode: "dark" }} onChange={onChange} />, root);

    const swatches = [...root.querySelectorAll(".theme-swatch")];
    expect(swatches).toHaveLength(THEMES.length);
    // The swatch is drawn from the theme's own tokens in the mode currently
    // chosen, so switching to Dark previews the dark palettes before the user
    // commits to one.
    const forest = swatches.find((swatch) => swatch.textContent?.includes("Forest"));
    const bar = forest?.querySelector<HTMLElement>(".theme-swatch-bar");
    expect(bar?.style.background).toBe(buildThemeTokens("forest", "dark")["accent"]);

    // Selection is exposed as a radio group, not by colour alone.
    const selected = root.querySelector(".theme-swatch.selected");
    expect(selected?.getAttribute("aria-checked")).toBe("true");
    expect(selected?.textContent).toContain("FillNest Blue");

    (forest as HTMLButtonElement | undefined)?.click();
    expect(onChange).toHaveBeenCalledWith({ themeId: "forest", mode: "dark" });

    const light = [...root.querySelectorAll<HTMLButtonElement>(".theme-mode-option")].find(
      (option) => option.textContent === "Light",
    );
    light?.click();
    expect(onChange).toHaveBeenCalledWith({ themeId: "default", mode: "light" });
  });

  it("starts on the shipped default", () => {
    expect(DEFAULT_APPEARANCE).toEqual({ themeId: "default", mode: "system" });
  });
});
