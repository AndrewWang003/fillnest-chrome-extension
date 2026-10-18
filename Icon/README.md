# FillNest icon — 2C "Block"

96×96 grid. Geometry (x, y, w, h):
- caret top bar 14,16,28,10 · bottom bar 14,70,28,10 · stem 23,16,10,64
- top arm 48,16,30,10 (ink)
- insert bar 40,40,38,10 (accent, right edge aligned to top arm)

Colors: ink #201e1d · accent #ec3013 · white #ffffff (Modernist tokens).

## Files
- svg/fillnest-icon.svg — ink + accent, transparent ground (default)
- svg/fillnest-icon-dark.svg — white + accent, for dark UI
- svg/fillnest-icon-tile.svg — white + accent on ink square
- png/light/icon-{16,32,48,128,256,512}.png — Chrome extension set
- png/dark/… — same sizes, white ink
- png/tile/icon-tile-{128,256,512}.png — store listing / app tile

## manifest.json
"icons": { "16": "Icon/png/light/icon-16.png", "32": "Icon/png/light/icon-32.png", "48": "Icon/png/light/icon-48.png", "128": "Icon/png/light/icon-128.png" }

## What ships

This directory is the source set, kept for redrawing and for future artwork.
It is **not** what the extension loads. The manifest names
`public/icons/icon-<16|32|48|128>.png`: the light set composited onto opaque
white, so the toolbar icon is legible on a dark toolbar and on Chrome's dark
extensions page, with the C2PA provenance chunk removed. The reasoning, and
the owner's decision behind it, are in Task 033 Addendum D. Changing the
manifest to point here would ship transparent icons and undo that.

The dark PNGs, the 256/512 sizes and the tile PNGs are unused today. The
store's 440x280 promo tile is drawn by `npm run shots:store`, not from the
tile PNGs, because the store wants a landscape card rather than a square
(Task 033 Addendum H).
