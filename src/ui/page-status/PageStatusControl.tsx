import type { ActivationMode } from "../../activation/activation-repository";
import type { Messages } from "../../i18n/catalogue";
import { PageStatusIcon } from "../icons/FillNestIcons";

export function PageStatusControl({
  mode,
  messages,
  lang,
  onToggle,
}: {
  mode: ActivationMode;
  /**
   * Task 037. Passed in rather than read from a hook: this control renders
   * inside a page, where the content script owns the language it was told and
   * re-renders when it changes.
   */
  messages: Messages;
  /** The language of those words: this control sits inside a page with a `lang` of its own. */
  lang: string;
  onToggle(): void;
}) {
  return (
    <button
      class={`page-status ${mode}`}
      type="button"
      lang={lang}
      aria-label={mode === "active" ? messages.pauseOnThisSite() : messages.resumeOnThisSite()}
      aria-pressed={mode === "active"}
      onClick={onToggle}
    >
      <PageStatusIcon />
    </button>
  );
}

/**
 * The fourth stylesheet.
 *
 * Task 034 tokenized the Side Panel, the Popup and the Picker and did not
 * reach this one, so the page-status control kept its hard-coded colours and
 * stayed light while everything else followed the chosen theme. Its host
 * element is themed the same way the Picker's is - inline custom properties
 * written by the content script - and `all: initial` does not reset custom
 * properties, so the values inherit into this Shadow Root.
 *
 * `tests/unit/theme-system.test.tsx` now covers all four sheets, which is the
 * check that would have caught this.
 */
export const pageStatusStyles = `
  :host { all: initial; }
  .page-status {
    all: initial;
    box-sizing: border-box;
    display: grid;
    place-items: center;
    width: 42px;
    height: 42px;
    border: 1px solid var(--fn-border-strong);
    border-radius: 13px;
    box-shadow: 0 8px 24px rgb(var(--fn-shadow) / 22%);
    color: var(--fn-on-muted-fill);
    background: var(--fn-muted-fill);
    cursor: pointer;
    transition: border-color 140ms ease, box-shadow 140ms ease;
  }
  .page-status svg { width: 23px; height: 23px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
  .page-status.active { color: var(--fn-on-accent); background: var(--fn-accent); }
  .page-status:hover { border-color: var(--fn-accent-border); box-shadow: 0 10px 26px rgb(var(--fn-shadow) / 30%); }
  .page-status:focus-visible { outline: 3px solid var(--fn-focus-ring); outline-offset: 3px; }

  /* Reduced motion (Task 023 Addendum B, finding B3). The control's only
     transition is a hover border/shadow tween; removing it keeps both end
     states and drops the movement between them. */
  @media (prefers-reduced-motion: reduce) {
    .page-status { transition-duration: 0.01ms; }
  }
`;
