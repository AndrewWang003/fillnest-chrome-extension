import scrollbarStyles from "../shared/scrollbars.css?raw";

export const pickerStyles = `
/* The host also carries an inline all:initial, which outranks :host - so the
   font is declared again on .picker, or headings and labels fall back to the
   browser's serif default. */
:host { all: initial; color: var(--fn-text); font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
* { box-sizing: border-box; }
.control { display: grid; place-items: center; width: var(--fillnest-control-size, 28px); height: var(--fillnest-control-size, 28px); padding: 0; border: 1px solid var(--fn-accent-border); border-radius: 7px; background: var(--fn-surface); color: var(--fn-accent); box-shadow: 0 2px 8px rgb(var(--fn-shadow) / 18%); cursor: pointer; }
.control svg { width: 62%; height: 62%; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.picker { position: absolute; top: var(--fillnest-picker-top, 32px); left: var(--fillnest-picker-left, 0); width: min(348px, calc(100vw - 16px)); max-height: min(440px, calc(100vh - 16px)); overflow: auto; scrollbar-gutter: stable; padding: 14px 4px 14px 14px; border: 1px solid var(--fn-border); border-radius: 10px; background: var(--fn-surface); color: var(--fn-text); box-shadow: 0 12px 32px rgb(var(--fn-shadow) / 22%); font-family: Inter, ui-sans-serif, system-ui, sans-serif; font-size: 13px; line-height: 1.4; }
.picker.pinned { position: fixed; max-height: min(560px, calc(100vh - 16px)); touch-action: none; }
.picker header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; font-size: 15px; }
.picker.pinned header { cursor: grab; }
.picker.pinned header:active { cursor: grabbing; }
.picker.pinned header button { cursor: pointer; touch-action: auto; }
.picker header .header-actions { display: inline-flex; align-items: center; gap: 6px; }
/* Task 044: what the header leads with - the mark and FillNest on the
   Templates, Back and the page's name on the Field list. */
.picker header .header-lead { display: inline-flex; align-items: center; gap: 7px; min-width: 0; }
.picker header .header-mark { width: 20px; height: 20px; flex: none; color: var(--fn-text); }
.picker header .header-title { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; }
.picker header .back { display: inline-flex; align-items: center; gap: 1px; flex: none; min-height: 26px; margin-left: -6px; padding: 3px 8px 3px 3px; border: 0; border-radius: 6px; background: transparent; color: var(--fn-accent-hover); font-size: 13px; }
.picker header .back svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
.picker header .back:hover { background: var(--fn-surface-raised); }
/* Task 044: on the Field list the header stays put while the list scrolls,
   so Back is always in reach. It runs edge to edge over the Picker's padding
   and paints its own ground, so nothing scrolling under it shows through.
   The context row normally tucks 4px under the header; under a header with a
   ground it would lose those 4px, so here it starts just below instead. */
.picker.finding header { position: sticky; top: -14px; z-index: 4; margin: -14px -4px 10px -14px; padding: 14px 4px 0 14px; background: var(--fn-surface); }
.picker.finding .picker-context { margin-top: -10px; }
.picker header .close { display: grid; place-items: center; width: 26px; height: 26px; padding: 0; border: 0; border-radius: 6px; background: transparent; color: var(--fn-text-muted); font-size: 18px; line-height: 1; cursor: pointer; }
.picker header .close:hover { background: var(--fn-surface-raised); color: var(--fn-text); }
.picker header .undo { display: grid; place-items: center; width: 23px; height: 23px; min-height: 0; padding: 0; border: 1px solid var(--fn-warning-border); border-radius: 6px; background: var(--fn-warning-soft); color: var(--fn-warning); cursor: pointer; }
.picker header .undo svg { width: 13px; height: 13px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.picker header .undo:hover { background: var(--fn-warning-soft); }
.picker header .undo[aria-disabled="true"] { border-color: var(--fn-border); background: var(--fn-surface); color: var(--fn-text-disabled); opacity: .55; cursor: default; }
.picker header .undo[aria-disabled="true"]:hover { background: var(--fn-surface); }
.picker header .pin { display: grid; place-items: center; width: 23px; height: 23px; min-height: 0; padding: 0; border: 1px solid var(--fn-border); border-radius: 6px; background: var(--fn-surface); color: var(--fn-icon); cursor: pointer; }
.picker header .pin svg { width: 13px; height: 13px; fill: none; stroke: currentColor; stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round; }
.picker header .pin:hover { background: var(--fn-surface-raised); }
.picker header .pin.pinned { border-color: var(--fn-accent); background: var(--fn-accent); color: var(--fn-on-accent); }
.picker header .pin.pinned:hover { background: var(--fn-accent-hover); }
.picker .picker-context { display: flex; align-items: center; gap: 7px; margin: -14px -4px 10px -14px; padding: 7px 4px 7px 14px; border-bottom: 1px solid var(--fn-surface-sunken); background: var(--fn-canvas); font-size: 11px; color: var(--fn-icon); }
.picker .picker-context-field { display: flex; flex: 1 1 auto; flex-wrap: wrap; align-items: center; gap: 2px; min-width: 0; }
.picker .pinned-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--fn-accent); flex: none; }
.picker .picker-context strong { color: var(--fn-text); font-weight: 600; }
.picker .picker-context-invalid { background: var(--fn-warning-soft); }
.picker .picker-context-invalid .pinned-dot { background: var(--fn-warning); }
/* The result row sits flush under the context row (its negative top margin
   cancels that row's bottom margin) so the two read as one banded header:
   what this Field is, then what just happened to it. */
.picker .picker-result { display: flex; align-items: center; gap: 7px; margin: -10px -4px 10px -14px; padding: 7px 4px 7px 14px; border-bottom: 1px solid var(--fn-surface-sunken); font-size: 11px; }
.picker .picker-result-actions { display: inline-flex; flex: none; gap: 5px; margin-left: auto; }
/* Owner QA 2026-09-15: a result quoting a Template with no spaces in it could
   not wrap and pushed Undo out of the Picker. The text breaks anywhere; the
   actions keep their room. */
.picker .picker-result > span:first-child { flex: 1 1 auto; min-width: 0; overflow-wrap: anywhere; }
.picker .picker-result-success { background: var(--fn-success-soft); color: var(--fn-success); }
.picker .picker-result-warning { background: var(--fn-warning-soft); color: var(--fn-warning); }
.picker .picker-result-danger { background: var(--fn-danger-soft); color: var(--fn-danger); }
.picker .picker-result-info { background: var(--fn-canvas); color: var(--fn-icon); }
.picker .picker-context-candidate, .picker .picker-context-shared { background: var(--fn-accent-soft); color: var(--fn-accent-strong); }
.picker .picker-context-candidate .pinned-dot, .picker .picker-context-shared .pinned-dot { background: var(--fn-accent-hover); }
.picker .shared-field-candidates { margin: 0 0 4px; }
.picker .shared-field-candidates li { min-height: 0; }
.picker .shared-field-candidate-page { color: var(--fn-text-muted); font-weight: 400; }
.picker .shared-field-candidates-more { min-height: 0; }
.picker .shared-field-candidates-more button { width: 100%; min-height: 28px; padding: 4px 8px; font-size: 12px; }
.picker .find-similar-before-count { min-height: 0; padding: 1px 3px; color: var(--fn-text-muted); font-size: 10px; font-weight: 600; }
.picker .find-similar-current-field { display: flex; align-items: baseline; gap: 5px; min-height: 30px; padding: 5px 8px; border-left: 3px solid var(--fn-accent); border-radius: 5px; background: var(--fn-accent-soft); color: var(--fn-text-secondary); font-size: 11px; }
.picker .find-similar-current-field span { color: var(--fn-icon); font-weight: 600; }
.picker .find-similar-current-field strong { color: var(--fn-text); font-size: 12px; overflow-wrap: anywhere; }
/* One shared row shape for every "share Templates with this Field" list in
   this Picker - "In this page" and Search must look and behave identically,
   since they are the same action against a different candidate pool. */
.picker .find-similar-row { display: grid; gap: 4px; padding: 7px 8px; min-height: 0; }
.picker .find-similar-row-primary { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-width: 0; }
.picker .find-similar-row-info { display: flex; flex: 1 1 auto; flex-direction: column; gap: 3px; min-width: 0; }
/* Site/Page context is orientation, not the point of the row - small,
   muted, and visually out of the way of the Field identity and Template
   preview a user actually scans for. */
.picker .find-similar-row .shared-field-candidate-page { font-size: 10px; color: var(--fn-text-muted); font-weight: 500; letter-spacing: 0.01em; text-transform: uppercase; }
.picker .find-similar-field-heading { display: flex; flex: 1 1 auto; align-items: center; gap: 5px; min-width: 0; }
.picker .find-similar-search-context { flex: 0 1 126px; color: var(--fn-text-muted); font-size: 10.5px; line-height: 1.35; overflow-wrap: anywhere; }
.picker .find-similar-search-context strong { color: var(--fn-text-secondary); font-weight: 700; }
.picker .picker-field-alias-label { display: inline-flex; align-items: center; gap: 4px; min-width: 0; }
.picker .picker-field-alias-trigger { display: inline-flex; align-items: center; gap: 5px; min-width: 0; min-height: 24px; padding: 2px 5px; border: 1px solid transparent; border-radius: 5px; background: transparent; color: var(--fn-text); font: inherit; cursor: pointer; transition: background 100ms ease, box-shadow 100ms ease, transform 100ms ease; }
.picker .picker-field-alias-trigger:hover { border-color: var(--fn-accent-border); background: var(--fn-accent-soft); box-shadow: inset 0 2px 4px rgb(var(--fn-shadow) / 20%); transform: translateY(1px); }
.picker .picker-field-alias-trigger:focus-visible { outline: 2px solid var(--fn-accent); outline-offset: 2px; border-color: var(--fn-accent-border); box-shadow: inset 0 1px 3px rgb(var(--fn-shadow) / 16%); }
.picker .picker-field-alias-trigger:active { border-color: var(--fn-accent-border); background: var(--fn-accent-soft-hover); box-shadow: inset 0 3px 5px rgb(var(--fn-shadow) / 26%); transform: translateY(1px); }
.picker .picker-field-alias-editor { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; align-items: center; gap: 5px; width: 100%; min-width: 0; }
.picker .picker-field-alias-editor input { min-width: 0; min-height: 30px; padding: 5px 7px; }
.picker .picker-field-alias-editor button { min-height: 28px; padding: 4px 8px; font-size: 11px; }
.picker .find-similar-field-label { min-width: 0; font-size: 14px; color: var(--fn-text); line-height: 1.35; }
.picker .find-similar-label-clamped { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; }
.picker .find-similar-label-more { display: inline; min-height: 0; padding: 0; border: 0; background: transparent; color: var(--fn-accent); font-size: 12px; font-weight: 600; text-decoration: underline; cursor: pointer; }
.picker .find-similar-preview { color: var(--fn-text-secondary); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.picker .find-similar-field-summary-toggle { display: grid; place-items: center; width: 16px; height: 16px; padding: 0; border: 0; border-radius: 3px; background: transparent; color: var(--fn-accent); cursor: pointer; }
.picker .find-similar-field-summary-toggle:focus-visible { outline: 2px solid var(--fn-accent); outline-offset: 2px; }
.picker .find-similar-template-count { display: inline-grid; place-items: center; flex: none; min-width: 17px; height: 17px; padding: 0 4px; border-radius: 999px; background: var(--fn-accent-soft); color: var(--fn-accent); font-size: 10px; font-weight: 750; line-height: 1; cursor: help; }
.picker .find-similar-template-count-sr { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
.picker .find-similar-saved-templates { display: grid; gap: 3px; width: 100%; margin: 2px 0 0; padding: 5px 0 0; border-top: 1px solid var(--fn-surface-sunken); list-style: none; }
.picker .find-similar-saved-templates li { display: flex; gap: 6px; min-width: 0; color: var(--fn-text-secondary); font-size: 11.5px; }
.picker .find-similar-saved-templates li > span:first-child { flex: none; display: grid; place-items: center; width: 15px; height: 15px; border-radius: 3px; background: var(--fn-accent-soft); color: var(--fn-accent); font-size: 9px; font-weight: 750; }
.picker .find-similar-saved-templates li > span:last-child { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* Saved Template previews are deliberately read-only recognition text. The
   Picker's generic interactive-row hover treatment must not make them look
   clickable. */
.picker .find-similar-saved-templates li:hover,
.picker .find-similar-saved-templates li:has(:focus-visible) { background: transparent; box-shadow: none; }
.picker .find-similar-row-actions { flex: none; display: flex; gap: 6px; }
.picker .find-similar-row-actions button { min-height: 26px; padding: 3px 10px; font-size: 11px; opacity: 0; transition: opacity 0.1s ease; }
.picker .find-similar-row-actions .find-similar-locate { position: relative; display: grid; place-items: center; width: 26px; min-height: 26px; height: 26px; padding: 0; }
/* Sized by the asset marker, not by an img element. Task 023 Addendum B4
   replaced the provided-asset images with masked spans and this selector was
   left behind, so the Locate glyph had no width or height at all and the
   button rendered empty - the same defect Addendum B5 found on the Side
   Panel's rename action, in the one place that pass did not reach. */
.picker .find-similar-row-actions .find-similar-locate [data-fillnest-asset] { width: 14px; height: 14px; }
.picker .find-similar-locate[data-tooltip]::after { content: attr(data-tooltip); position: absolute; right: 0; bottom: calc(100% + 5px); z-index: 5; width: max-content; max-width: 160px; padding: 4px 6px; border-radius: 5px; background: var(--fn-inverse-surface); color: var(--fn-on-inverse-surface); font-size: 10px; font-weight: 600; line-height: 1.2; white-space: nowrap; opacity: 0; pointer-events: none; transform: translateY(2px); transition: opacity 0ms linear, transform 0ms linear; }
.picker .find-similar-locate[data-tooltip]:hover::after, .picker .find-similar-locate[data-tooltip]:focus-visible::after { opacity: 1; transform: translateY(0); }
.picker .find-similar-row-primary:hover .find-similar-row-actions button,
.picker .find-similar-row-primary:has(:focus-visible) .find-similar-row-actions button { opacity: 1; }
.picker .candidate-route { margin: -4px 0 8px; padding: 6px 8px; border-radius: 6px; background: var(--fn-canvas); color: var(--fn-icon); font: 600 11px/1.4 ui-monospace, monospace; overflow-wrap: anywhere; }
.picker .candidate-template-list { margin: 0 0 8px; padding: 0 0 0 18px; list-style: disc; }
.picker .candidate-template-list li { padding: 2px 0; color: var(--fn-text); font-weight: 600; overflow-wrap: anywhere; }
.picker .picker-context-actions { display: inline-flex; gap: 5px; margin-left: auto; }
.picker .picker-context-action { min-height: 28px; padding: 5px 11px; border-color: currentColor; background: color-mix(in srgb, var(--fn-surface) 76%, transparent); color: inherit; font-size: 12px; }
.picker .picker-context-delete { color: var(--fn-danger); }
/* Task 021 Addendum C: the header's icon-only sharing actions. Their tooltip
   opens downward - the header is the top of a scrolling Picker, so an upward
   one would be clipped - and appears at once, on hover and on keyboard focus. */
.picker .picker-context-icon { position: relative; display: grid; place-items: center; width: 28px; padding: 0; }
.picker .picker-context-icon [data-fillnest-asset] { width: 16px; height: 16px; }
.picker .picker-context-icon[data-tooltip]::after { content: attr(data-tooltip); position: absolute; right: 0; top: calc(100% + 5px); z-index: 5; width: max-content; max-width: 220px; padding: 5px 7px; border-radius: 5px; background: var(--fn-inverse-surface); color: var(--fn-on-inverse-surface); font-size: 11px; font-weight: 600; line-height: 1.35; text-align: left; white-space: normal; opacity: 0; pointer-events: none; }
.picker .picker-context-icon[data-tooltip]:hover::after, .picker .picker-context-icon[data-tooltip]:focus-visible::after { opacity: 1; }
.picker p { margin: 8px 0; color: var(--fn-icon); }
.picker .repeat-insert-notice { padding: 6px 8px; border: 1px solid var(--fn-danger-border); border-radius: 6px; background: var(--fn-danger-soft); color: var(--fn-danger-hover); font-weight: 600; }
/* Task 024 Addendum C: the automatic offer to share Templates between Fields.
   It names Fields and never previews a Template - recommending Templates
   before a deliberate Search is the one thing the product does not do. */
.picker .picker-link-offer { display: grid; gap: 6px; padding: 8px; border: 1px solid var(--fn-accent-border); border-radius: 7px; background: var(--fn-surface); color: var(--fn-text); }
.picker .picker-link-offer-fields { color: var(--fn-text-muted); font-size: 12px; }
/* Task 024 Addendum C.1: what renaming actually names, said in words that do
   not assume the reader knows what a "field" is. */
.picker .picker-field-alias-hint { grid-column: 1 / -1; display: block; margin-top: 2px; color: var(--fn-text-muted); font-size: 11px; font-weight: 400; line-height: 1.35; }
/* Task 036: why Binding is unavailable on an editor with no stable identity. */
.picker .picker-note { margin: 0; padding: 6px 8px; border: 1px solid var(--fn-border-strong); border-radius: 6px; background: var(--fn-surface); color: var(--fn-text-secondary); font-weight: 500; }
.picker label { display: grid; gap: 6px; font-weight: 600; }
.picker input, .picker textarea { width: 100%; min-height: 36px; padding: 8px; border: 1px solid var(--fn-border-strong); border-radius: 7px; background: var(--fn-surface); color: var(--fn-text); font: 400 13px/1.4 system-ui; }
.picker textarea { min-height: 96px; padding-right: 0; resize: vertical; }
.actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.picker button { min-height: 32px; padding: 6px 10px; border: 1px solid var(--fn-accent-border); border-radius: 7px; background: var(--fn-canvas); color: var(--fn-accent-hover); font: 600 13px/1.2 system-ui; cursor: pointer; }
.picker button:disabled, .picker button[aria-disabled="true"] { opacity: .5; cursor: default; }
.picker button.secondary { background: var(--fn-surface); color: var(--fn-text-secondary); border-color: var(--fn-border-strong); }
.picker .group-heading { display: flex; align-items: center; gap: 8px; margin: 14px 0 4px; padding: 0 2px; font-size: 10px; font-weight: 700; color: var(--fn-text-muted); letter-spacing: 0.06em; text-transform: uppercase; }
.picker .group-heading:first-of-type { margin-top: 10px; }
.picker ul { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
.picker li { position: relative; min-height: 48px; border-radius: 8px; }
/* Mouse hover, keyboard focus, and the keyboard virtual-cursor highlight
   all carry the same weight and color - there is no "stronger" or "weaker"
   selection state, just one visible cue regardless of input method.
   Task 036 Addendum J: a Template row shows that cue only through
   data-highlighted, which pointer movement and focus both set. Styling
   :hover and :focus-within as well painted two rows at once - the one
   under a pointer that had not moved, and the one the keyboard chose.
   Owner QA 2026-09-15: every other row shows focus only when the keyboard
   put it there (:focus-visible). A press on a row's Share, dragged off and
   released elsewhere, is no click but leaves the button focused, and
   :focus-within kept that row looking selected wherever the pointer went. */
.picker li:not([data-template-row]):hover, .picker li:not([data-template-row]):has(:focus-visible), .picker li[data-highlighted] { background: var(--fn-accent-soft-hover); box-shadow: inset 3px 0 0 var(--fn-accent); }
.picker li[data-repeat-inserted] { background: var(--fn-danger-soft); box-shadow: inset 3px 0 0 var(--fn-danger); }
.picker li[data-repeat-inserted] .template { color: var(--fn-danger-hover); }
.picker .picker-field-count { margin-left: auto; padding: 1px 7px; border-radius: 999px; background: var(--fn-accent-soft); color: var(--fn-accent); font-size: 10px; font-weight: 750; letter-spacing: 0.2px; }
.picker .picker-field-count.full { background: var(--fn-warning-soft); color: var(--fn-warning); }
.picker .picker-share-count { margin: 6px 0 0; color: var(--fn-text-muted); font-size: 11.5px; line-height: 1.45; }
.picker .picker-share-count.over { padding: 7px 9px; border: 1px solid var(--fn-warning-border); border-radius: 7px; background: var(--fn-warning-soft); color: var(--fn-warning); }
.picker .template-length-counter { margin: 4px 0 0; text-align: right; color: var(--fn-text-muted); font-size: 11px; font-weight: 650; font-variant-numeric: tabular-nums; cursor: help; }
.picker .template-length-counter.over { color: var(--fn-danger); }
.picker .picker-length-error { margin: 6px 0 0; padding: 7px 9px; border: 1px solid var(--fn-danger-border); border-radius: 7px; background: var(--fn-danger-soft); color: var(--fn-danger); font-size: 11.5px; line-height: 1.4; }
.picker .template { position: relative; z-index: 1; width: 100%; height: calc(2 * 1.4em + 16px); padding: 8px 10px; border: 0; border-radius: 8px; background: transparent; text-align: left; overflow: hidden; white-space: normal; }
.picker .template-preview { display: -webkit-box; max-height: calc(2 * 1.4em); padding-right: 88px; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 2; font: 600 13px/1.4 system-ui; overflow-wrap: anywhere; }
/* A row with a Site Affinity badge clamps to one line instead of two, so the
   badge below it never gets cut off by the button's own fixed height. */
.picker .template-with-badge { height: calc(1 * 1.4em + 16px); }
.picker .template-with-badge .template-preview { max-height: calc(1 * 1.4em); -webkit-line-clamp: 1; }
.picker .site-badge { display: block; width: fit-content; margin: 0 10px 8px; padding: 1px 7px; border-radius: 999px; background: var(--fn-accent-soft); color: var(--fn-text-muted); font-size: 10px; font-weight: 700; font-family: ui-monospace, monospace; }
.picker .template-actions { position: absolute; right: 38px; top: 0; bottom: 0; z-index: 2; display: inline-flex; align-items: center; gap: 2px; pointer-events: none; opacity: 0.65; transition: opacity 150ms ease; }
.picker li:hover .template-actions,
.picker li:focus-within .template-actions,
.picker li[data-highlighted] .template-actions,
.picker .template-actions:focus-within,
.picker .template-actions:hover { opacity: 1; }
.picker .template-actions .action { display: grid; place-items: center; width: 26px; height: 26px; min-height: 0; padding: 0; border: 0; border-radius: 50%; background: color-mix(in srgb, var(--fn-surface) 90%, transparent); box-shadow: 0 1px 3px rgb(var(--fn-shadow) / 14%); color: var(--fn-icon); cursor: pointer; pointer-events: auto; }
.picker .template-actions .action svg { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.picker .template-actions .action [data-fillnest-asset] { width: 15px; height: 15px;  }
.picker .template-actions .action:hover { background: var(--fn-surface); color: var(--fn-accent-hover); }
.picker .template-actions .action[data-tooltip] { position: relative; }
.picker .template-actions .action[data-tooltip]::after, .picker .template-delete[data-tooltip]::after { content: attr(data-tooltip); position: absolute; right: 0; bottom: calc(100% + 5px); z-index: 5; width: max-content; max-width: 190px; padding: 4px 6px; border-radius: 5px; background: var(--fn-inverse-surface); color: var(--fn-on-inverse-surface); font-size: 10px; font-weight: 600; line-height: 1.2; white-space: nowrap; opacity: 0; pointer-events: none; transform: translateY(2px); transition: opacity 0ms linear, transform 0ms linear; }
.picker .template-actions .action[data-tooltip]:hover::after, .picker .template-actions .action[data-tooltip]:focus-visible::after, .picker .template-delete[data-tooltip]:hover::after, .picker .template-delete[data-tooltip]:focus-visible::after { opacity: 1; transform: translateY(0); }
.picker .template-delete[data-tooltip]::after { border: 1px solid var(--fn-danger-border); background: var(--fn-danger-soft); color: var(--fn-danger); }
.picker .template-delete { position: absolute; right: 4px; top: 0; bottom: 0; margin: auto; z-index: 2; display: grid; place-items: center; width: 24px; height: 24px; min-height: 0; padding: 0; border: 1px solid var(--fn-danger-border); border-radius: 50%; background: var(--fn-surface); box-shadow: 0 2px 6px rgb(var(--fn-shadow) / 12%); color: var(--fn-danger); cursor: pointer; opacity: 0.65; transition: opacity 150ms ease; }
.picker .template-delete svg { width: 13px; height: 13px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.picker li:hover .template-delete,
.picker li:focus-within .template-delete,
.picker li[data-highlighted] .template-delete,
.picker .template-delete:hover,
.picker .template-delete:focus-visible { opacity: 1; }
.picker .template-delete:hover { background: var(--fn-danger-soft); }
.picker .keyboard-hint { margin-left: auto; align-self: center; color: var(--fn-text-muted); font-size: 11px; white-space: nowrap; }
.preview-flyout { position: fixed; z-index: 2147483647; width: 200px; max-height: min(300px, calc(100vh - 16px)); overflow: auto; scrollbar-gutter: stable; padding: 10px 1px 10px 11px; border: 1px solid var(--fn-border); border-radius: 9px; background: var(--fn-canvas); box-shadow: 6px 6px 18px rgb(var(--fn-shadow) / 8%); font-size: 11.5px; line-height: 1.5; color: var(--fn-text); font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
/* Owner QA 2026-09-14: only when the window is too narrow for either side does
   the flyout lie over the Picker. It is then 70% see-through, so the Picker
   reads through it, and solid while the pointer is on it to read. */
.preview-flyout.covers-picker { opacity: .3; transition: opacity 120ms ease; }
.preview-flyout.covers-picker:hover { opacity: 1; }
@media (prefers-reduced-motion: reduce) { .preview-flyout.covers-picker { transition: none; } }
.preview-flyout-label { display: block; margin-bottom: 5px; font-size: 10px; font-weight: 700; color: var(--fn-text-muted); letter-spacing: 0.06em; text-transform: uppercase; }
.preview-flyout-body { display: block; white-space: pre-wrap; overflow-wrap: anywhere; }
/* Owner QA 2026-09-14: New template and Edit are panels of their own that keep
   the Picker's list height and give it to the text. */
.picker.writing { display: flex; flex-direction: column; }
.picker.writing > * { flex: none; }
.picker .picker-replaced { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 0; color: var(--fn-text-secondary); font-size: 12px; }
.picker .picker-replaced button { min-height: 26px; padding: 3px 9px; font-size: 11.5px; }
.picker .picker-writing { flex: 1 1 auto; display: flex; flex-direction: column; gap: 8px; min-height: 0; }
.picker.writing .picker-writing-field { flex: 1 1 auto; display: flex; flex-direction: column; gap: 4px; min-height: 0; }
.picker.writing .picker-writing-field textarea { flex: 1 1 auto; min-height: 96px; resize: none; }
.picker .editor-actions { display: flex; flex-wrap: wrap; gap: 8px; }

/* Windows High Contrast Mode (Task 023 Addendum B, finding B4). Only applies
 * inside this media query; normal rendering is untouched. The Picker relies on
 * tinted backgrounds and inset box-shadows for the highlighted row, and
 * forced-colors drops box-shadow entirely. */
@media (forced-colors: active) {
  .picker { border: 1px solid CanvasText; }
  .picker li:not([data-template-row]):hover, .picker li:not([data-template-row]):has(:focus-visible), .picker li[data-highlighted] {
    background: Highlight;
    color: HighlightText;
    box-shadow: none;
    outline: 2px solid Highlight;
    outline-offset: -2px;
  }
  .picker .template-actions, .picker .find-similar-row-actions button { opacity: 1; }
  .picker .template-delete { border: 1px solid CanvasText; box-shadow: none; }
  .picker button:focus-visible,
  .picker input:focus-visible,
  .picker .picker-field-alias-trigger:focus-visible,
  .picker .find-similar-field-summary-toggle:focus-visible { outline: 3px solid Highlight; outline-offset: 2px; }
  .picker .picker-result { border: 1px solid CanvasText; }
}

/* Reduced motion (Task 023 Addendum B, finding B3).
 *
 * Every transition in the Picker is a short opacity, background or transform tween.
 * Disabling them keeps each end state exactly as it was and only removes the
 * movement between states, so nothing becomes unreachable or invisible - a
 * toggle thumb jumps to its position instead of sliding, a hover-revealed
 * action appears at once. Applies only when the reader has asked for reduced
 * motion. */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
  }
}
${scrollbarStyles}
`;
