// @vitest-environment happy-dom

import { render } from "preact";
import { describe, expect, it } from "vitest";

import {
  BindIcon,
  BrandIcon,
  BindSharedSetIcon,
  EditIcon,
  FieldControlIcon,
  LeaveSharingIcon,
  MapPinIcon,
  PageStatusIcon,
  ShareIcon,
  ShareWithIcon,
} from "../../src/ui/icons/FillNestIcons";

describe("replaceable icon seams", () => {
  it("renders three independent local, decorative components", () => {
    const root = document.createElement("div");
    render(
      <>
        <BrandIcon />
        <PageStatusIcon />
        <FieldControlIcon />
      </>,
      root,
    );

    expect([...root.querySelectorAll("svg")].map((icon) => icon.dataset.fillnestIcon)).toEqual([
      "brand",
      "page-status",
      "field-control",
    ]);
    for (const icon of root.querySelectorAll("svg")) {
      expect(icon.getAttribute("aria-hidden")).toBe("true");
      expect(icon.querySelector("image")).toBeNull();
    }
  });

  // Task 033 Addendum D: the owner's mark, its ink following the surface's text colour
  // for light and dark, its insert bar the brand accent in either.
  it("draws the owner's mark with themed ink and the brand accent", () => {
    const root = document.createElement("div");
    render(<BrandIcon />, root);
    const mark = root.querySelector("svg")!;
    expect(mark.getAttribute("viewBox")).toBe("0 0 96 96");
    expect(mark.querySelector("g")?.getAttribute("fill")).toBe("currentColor");
    expect(mark.querySelectorAll("g rect")).toHaveLength(4);
    expect(mark.querySelector("[data-fillnest-brand-accent]")?.getAttribute("fill")).toBe("#ec3013");
  });

  it("renders every Edit affordance from the provided pencil.svg asset", () => {
    const root = document.createElement("div");
    render(<EditIcon />, root);

    const icon = root.querySelector<HTMLElement>('[data-fillnest-icon="edit"]');
    expect(icon).not.toBeNull();
    // Task 028 Slice 4 (audit finding S3): the asset is inlined, so the
    // manifest can declare no web-accessible resources. The seam that matters
    // is still that every Edit affordance comes from the one provided asset.
    //
    // Task 023 Addendum B (B4): it is a masked span rather than an `<img>`, so
    // the glyph takes `currentColor` and survives Windows High Contrast Mode,
    // where image content is not recoloured.
    expect(icon?.getAttribute("data-fillnest-asset")).toBe("pencil.svg");
    expect(icon?.style.maskImage).toMatch(/^url\("data:image\/svg\+xml[,;]/u);
    // Unprefixed `mask-*` only shipped in Chrome 120 and the manifest supports
    // 116: without the prefixed spelling the mask is ignored on 116-119 and
    // the span paints as a solid `currentColor` rectangle.
    expect(icon?.style.getPropertyValue("-webkit-mask-image")).toMatch(/^url\("data:image\/svg\+xml[,;]/u);
    expect(icon?.style.backgroundColor.toLowerCase()).toBe("currentcolor");
    expect(icon?.getAttribute("aria-hidden")).toBe("true");
  });

  it("renders the Locate affordance from the provided map-pin.svg asset", () => {
    const root = document.createElement("div");
    render(<MapPinIcon />, root);

    const icon = root.querySelector<HTMLElement>('[data-fillnest-icon="map-pin"]');
    expect(icon?.getAttribute("data-fillnest-asset")).toBe("map-pin.svg");
    expect(icon?.style.maskImage).toMatch(/^url\("data:image\/svg\+xml[,;]/u);
    // Unprefixed `mask-*` only shipped in Chrome 120 and the manifest supports
    // 116: without the prefixed spelling the mask is ignored on 116-119 and
    // the span paints as a solid `currentColor` rectangle.
    expect(icon?.style.getPropertyValue("-webkit-mask-image")).toMatch(/^url\("data:image\/svg\+xml[,;]/u);
    expect(icon?.style.backgroundColor.toLowerCase()).toBe("currentcolor");
    expect(icon?.getAttribute("aria-hidden")).toBe("true");
  });

  // Task 027 Addendum E: the owner's hands-on QA reported two commands whose
  // descriptions differed but whose icons did not. Three audience commands can
  // be on screen together - `Bind to this field` (one Field), `Bind to Shared
  // Set` (every Field in the Set) and `Share this version` (promote a private
  // relation into the Set) - so each owns a different metaphor.
  //
  // This cannot prove two glyphs look different; it pins the three decisions
  // that keep them apart. The first Addendum E fix satisfied a purely textual
  // check while `Share this version` still drew the same three-node network as
  // the provided share-network.svg, so the last assertion names that shape
  // rather than only comparing asset identifiers.
  it("gives the one-to-one Bind, the one-to-many Bind and Promotion different metaphors", () => {
    const root = document.createElement("div");
    render(
      <>
        <BindIcon />
        <BindSharedSetIcon />
        <ShareIcon />
      </>,
      root,
    );

    expect(root.querySelector('[data-fillnest-icon="bind"]')?.getAttribute("data-fillnest-asset")).toBe(
      "plugs-connected.svg",
    );
    expect(
      root.querySelector('[data-fillnest-icon="bind-shared-set"]')?.getAttribute("data-fillnest-asset"),
    ).toBe("share-network.svg");

    const assets = [...root.querySelectorAll("[data-fillnest-asset]")].map((icon) =>
      icon.getAttribute("data-fillnest-asset"),
    );
    expect(new Set(assets).size).toBe(assets.length);

    // share-network.svg is a node graph. Promotion must not draw one too.
    const promotion = root.querySelector('svg[data-fillnest-icon="share"]');
    expect(promotion).not.toBeNull();
    expect(promotion?.querySelector("circle")).toBeNull();
  });

  // Task 021 Addendum C (owner request, 2026-09-11).
  it("draws the Picker header's sharing actions from the owner's assets, leaving pointing left", () => {
    const root = document.createElement("div");
    render(
      <>
        <LeaveSharingIcon />
        <ShareWithIcon />
        <BindSharedSetIcon />
      </>,
      root,
    );
    const [leave, shareWith, bindShared] = [...root.querySelectorAll<HTMLElement>("[data-fillnest-asset]")];
    expect(leave?.dataset.fillnestAsset).toBe("sign-out.svg");
    expect(leave?.style.transform).toBe("scaleX(-1)");
    expect(shareWith?.dataset.fillnestAsset).toBe("share.svg");
    expect(shareWith?.style.transform).toBe("");
    // Task 027 Addendum E.1: Share with must not look like Bind to Shared Set.
    expect(shareWith?.dataset.fillnestAsset).not.toBe(bindShared?.dataset.fillnestAsset);
  });
});
