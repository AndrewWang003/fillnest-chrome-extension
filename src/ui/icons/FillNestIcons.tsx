import copyIcon from "./assets/copy.svg?inline";
import gearIcon from "./assets/gear.svg?inline";
import mapPinIcon from "./assets/map-pin.svg?inline";
import pencilIcon from "./assets/pencil.svg?inline";
import plugsConnectedIcon from "./assets/plugs-connected.svg?inline";
import plugsIcon from "./assets/plugs.svg?inline";
import shareNetworkIcon from "./assets/share-network.svg?inline";
import shareIcon from "./assets/share.svg?inline";
import signOutIcon from "./assets/sign-out.svg?inline";
import translateIcon from "./assets/translate.svg?inline";

type IconProps = { class?: string };

/**
 * The provided icon assets, inlined at build time.
 *
 * Task 028 Slice 4 (audit finding S3): these were previously loaded from
 * `chrome-extension://<id>/<asset>.svg`, which required declaring
 * `web_accessible_resources` for `http://*` and `https://*` - an
 * extension-presence probe available to every authorized page, for no
 * functional gain. Vite's `?inline` turns each file into a `data:` URI, so
 * the manifest now declares no web-accessible resources at all
 * (`scripts/lib/manifest-policy.mjs` enforces their absence).
 *
 * The files stay real assets under `assets/` rather than pasted base64, so
 * PROJECT.md's "independent replaceable local asset boundary" still holds:
 * editing an SVG changes the build.
 */
const PROVIDED_ICON_DATA_URLS: Readonly<Record<string, string>> = {
  "pencil.svg": pencilIcon,
  "copy.svg": copyIcon,
  "map-pin.svg": mapPinIcon,
  "plugs.svg": plugsIcon,
  "plugs-connected.svg": plugsConnectedIcon,
  "share-network.svg": shareNetworkIcon,
  "share.svg": shareIcon,
  "sign-out.svg": signOutIcon,
  "gear.svg": gearIcon,
  "translate.svg": translateIcon,
};

/**
 * Renders a provided asset as a mask over `currentColor` rather than as an
 * `<img>`.
 *
 * Task 023 Addendum B (B4). The supplied SVGs carry `fill="#000000"`. As an
 * `<img>` that colour is baked in: Windows High Contrast Mode does not recolour
 * image content, so on a dark high-contrast theme these icons were black on
 * black. Masking makes the glyph take the button's own colour, which is a
 * system colour in forced-colors mode - the same way the hand-drawn inline SVG
 * icons already behaved, so the two kinds now match in normal mode too.
 *
 * The element keeps its `data-fillnest-asset` marker: the seam that matters is
 * still that every Edit affordance comes from the one provided asset.
 */
function ProvidedAssetIcon({
  asset,
  label,
  class: className,
  mirrored = false,
}: { asset: string; label: string; mirrored?: boolean } & IconProps) {
  const source = PROVIDED_ICON_DATA_URLS[asset];
  return (
    <span
      class={className}
      data-fillnest-icon={label}
      data-fillnest-asset={asset}
      aria-hidden="true"
      style={{
        display: "inline-block",
        backgroundColor: "currentColor",
        // Both spellings, deliberately. Unprefixed `mask-*` only shipped in
        // Chrome 120, and the manifest supports Chrome 116 - where the mask
        // would simply be ignored and this span would paint as a solid
        // `currentColor` rectangle where the glyph should be, which is worse
        // than a missing icon. The prefixed properties carry those versions.
        "-webkit-mask-image": `url("${source}")`,
        "-webkit-mask-repeat": "no-repeat",
        "-webkit-mask-position": "center",
        "-webkit-mask-size": "contain",
        maskImage: `url("${source}")`,
        maskRepeat: "no-repeat",
        maskPosition: "center",
        maskSize: "contain",
        ...(mirrored ? { transform: "scaleX(-1)" } : {}),
      }}
    />
  );
}

/**
 * Task 033 Addendum D: the FillNest mark, from the owner's `Icon/` set ("2C
 * Block", a 96-unit grid). The ink takes `currentColor`, so it is dark on a light
 * surface and white on a dark one, as the set's two variants are; the insert
 * bar keeps the brand accent in every theme.
 */
export function BrandIcon({ class: className }: IconProps) {
  return (
    <svg class={className} data-fillnest-icon="brand" viewBox="0 0 96 96" aria-hidden="true">
      <g fill="currentColor">
        <rect x="14" y="16" width="28" height="10" />
        <rect x="14" y="70" width="28" height="10" />
        <rect x="23" y="16" width="10" height="64" />
        <rect x="48" y="16" width="30" height="10" />
      </g>
      <rect data-fillnest-brand-accent="" x="40" y="40" width="38" height="10" fill={BRAND_ACCENT} />
    </svg>
  );
}

/** The set's accent, which is the brand's rather than any theme's. */
const BRAND_ACCENT = "#ec3013";

/** Task 044: the Picker header's Back. */
export function BackIcon({ class: className }: IconProps) {
  return (
    <svg class={className} data-fillnest-icon="back" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
}

export function PageStatusIcon({ class: className }: IconProps) {
  return (
    <svg class={className} data-fillnest-icon="page-status" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 7.5 12 4l7 3.5v9L12 20l-7-3.5z" />
      <path d="m8.5 12 2.2 2.2 4.8-4.8" />
    </svg>
  );
}

export function FieldControlIcon({ class: className }: IconProps) {
  return (
    <svg class={className} data-fillnest-icon="field-control" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 6v12M19 6v12M8 9h8M8 15h5" />
    </svg>
  );
}

export function EditIcon({ class: className }: IconProps) {
  return <ProvidedAssetIcon asset="pencil.svg" label="edit" class={className} />;
}

/** Task 036: the clipboard fallback for an editor that refuses an insertion. */
export function CopyIcon({ class: className }: IconProps) {
  return <ProvidedAssetIcon asset="copy.svg" label="copy" class={className} />;
}

export function MapPinIcon({ class: className }: IconProps) {
  return <ProvidedAssetIcon asset="map-pin.svg" label="map-pin" class={className} />;
}

export function BindIcon({ class: className }: IconProps) {
  return <ProvidedAssetIcon asset="plugs-connected.svg" label="bind" class={className} />;
}

export function BindSharedSetIcon({ class: className }: IconProps) {
  return <ProvidedAssetIcon asset="share-network.svg" label="bind-shared-set" class={className} />;
}

// Task 021 Addendum C (owner request, 2026-09-11): the Picker header's two
// sharing actions as icons. Leaving uses the owner's sign-out glyph mirrored,
// so its arrow points left - out of the Set - as the owner asked.
export function LeaveSharingIcon({ class: className }: IconProps) {
  return <ProvidedAssetIcon asset="sign-out.svg" label="leave-sharing" class={className} mirrored />;
}

// Deliberately not share-network.svg: that glyph is `Bind to Shared Set`, which
// a Set member's Search results show at the same time (Task 027 Addendum E.1).
export function ShareWithIcon({ class: className }: IconProps) {
  return <ProvidedAssetIcon asset="share.svg" label="share-with" class={className} />;
}

export function RemoveFromFieldIcon({ class: className }: IconProps) {
  return <ProvidedAssetIcon asset="plugs.svg" label="remove-from-field" class={className} />;
}

// The Side Panel still exposes the technical relationship-management action
// as Unbind. The Picker uses RemoveFromFieldIcon's user-outcome wording.
export function UnbindIcon({ class: className }: IconProps) {
  return <ProvidedAssetIcon asset="plugs.svg" label="unbind" class={className} />;
}

// A circled exclamation, drawn inline like the other hand-drawn glyphs so it
// takes `currentColor` and needs no asset. Used for the one warning that is
// attached to an action rather than shown as a standing notice.
export function WarningIcon({ class: className }: IconProps) {
  return (
    <svg class={className} data-fillnest-icon="warning" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.75v5" />
      <path d="M12 16.1v.4" />
    </svg>
  );
}

export function PinIcon({ class: className }: IconProps) {
  return (
    <svg class={className} data-fillnest-icon="pin" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9.5 4h5l-.8 5.6 2.8 2.6v1.3h-4.5V20l-.5 .8-.5-.8v-6.5H6.5v-1.3l2.8-2.6z" />
    </svg>
  );
}

// Task 027: "Share this version" promotes a Field-only relationship to a
// normal Shared Template Slot - a distinct action from Bind, so it needs its
// own glyph rather than reusing BindIcon's plug metaphor.
//
// Task 027 Addendum E follow-up: this used to draw the three-node network
// (two circles joined to a third). `BindSharedSetIcon` now renders the
// provided `share-network.svg`, which is that same picture, and the Picker
// shows both at once - `Share this version` in the Shared Template Set list
// and `Bind to Shared Set` in the search results below it. Two different
// commands must not look identical, which is the defect Addendum E exists to
// remove, so promotion moved to its own metaphor: lifting this version up out
// of the Field and into the Set the Field already belongs to.
export function ShareIcon({ class: className }: IconProps) {
  return (
    <svg class={className} data-fillnest-icon="share" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 15V4.5" />
      <path d="M8 8.5 12 4.5l4 4" />
      <path d="M5 13.5V18a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4.5" />
    </svg>
  );
}


export function DeleteIcon({ class: className }: IconProps) {
  return (
    <svg class={className} data-fillnest-icon="delete" viewBox="0 0 24 24" aria-hidden="true">
      {/* The lid+body silhouette has most of its ink below the viewBox's
          geometric center (y 7-21 vs a thin lid at 4-7), so it reads as
          bottom-heavy inside its circular button next to Edit's more evenly
          balanced stroke. Nudged up 1 unit to rebalance visual weight. */}
      <g transform="translate(0 -1)">
        <path d="M5 7h14" />
        <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" />
        <path d="M7 7l1 12.5A1.5 1.5 0 0 0 9.5 21h5a1.5 1.5 0 0 0 1.5-1.5L17 7" />
        <path d="M10 11v6M14 11v6" />
      </g>
    </svg>
  );
}

// Owner QA 2026-09-15: the Settings tab is this icon alone, with "Settings" as
// its accessible name and hover text.
export function SettingsIcon({ class: className }: IconProps) {
  return <ProvidedAssetIcon asset="gear.svg" label="settings" class={className} />;
}

// Owner QA 2026-09-15: beside Language, so someone who reads none of the
// offered languages can still find where to change it.
export function LanguageIcon({ class: className }: IconProps) {
  return <ProvidedAssetIcon asset="translate.svg" label="language" class={className} />;
}

