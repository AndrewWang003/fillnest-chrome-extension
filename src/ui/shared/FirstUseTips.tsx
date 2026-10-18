import { useEffect, useId, useState } from "preact/hooks";

import { isTipIdArray, type TipId } from "../../guidance/tips";
import { useMessages } from "../../i18n/useMessages";
import { sendRequest } from "./runtime-request";

/**
 * Task 042. Which first-use tips this surface may still show.
 *
 * Nothing is shown until the answer arrives, and nothing at all if it cannot:
 * a tip that flashes and vanishes, or one shown while FillNest is closed by a
 * failed Restore, would be worse than none. Dismissing is optimistic - the tip
 * goes at once, and a failed write only means it may appear once more.
 */
export function useFirstUseTips(): { shows(tip: TipId): boolean; dismiss(tip: TipId): void } {
  const [dismissed, setDismissed] = useState<ReadonlySet<TipId> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void sendRequest({ type: "GET_DISMISSED_TIPS" })
      .then((response) => {
        if (!cancelled && response.ok && isTipIdArray(response.value)) setDismissed(new Set(response.value));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    shows: (tip) => dismissed !== null && !dismissed.has(tip),
    dismiss: (tip) => {
      setDismissed((current) => new Set([...(current ?? []), tip]));
      void sendRequest({ type: "DISMISS_TIP", tip }).catch(() => undefined);
    },
  };
}

/**
 * A start card: a heading, at most three one-line tips, and `Got it`. It takes
 * no focus when it appears and covers nothing - it is part of the page's flow.
 */
export function StartCard({ lines, onDismiss }: { lines: readonly string[]; onDismiss(): void }) {
  const t = useMessages();
  const headingId = useId();
  return (
    <section class="fn-tip" aria-labelledby={headingId}>
      <style>{firstUseTipStyles}</style>
      <h2 id={headingId} class="fn-tip-heading">{t.tipsHeading()}</h2>
      {/* Paragraphs, not list items: each surface styles its own lists - the
          Picker's are Template rows - and a tip must look the same everywhere. */}
      {lines.map((line) => (
        <p key={line} class="fn-tip-line">{line}</p>
      ))}
      <button type="button" class="fn-tip-dismiss" aria-label={t.hideTheseTips()} onClick={onDismiss}>
        {t.gotIt()}
      </button>
    </section>
  );
}

/** A page note: one line, shown on a page's first visit. */
export function PageNote({ text, onDismiss }: { text: string; onDismiss(): void }) {
  const t = useMessages();
  return (
    <p class="fn-tip-note" role="note" aria-label={t.tipRegion()}>
      <style>{firstUseTipStyles}</style>
      <span>{text}</span>
      <button type="button" class="fn-tip-dismiss" aria-label={t.hideThisTip()} onClick={onDismiss}>
        {t.gotIt()}
      </button>
    </p>
  );
}

/**
 * The same look on every surface, from the theme's warning tokens - the
 * owner asked that tips stand apart from FillNest's own blue (2026-09-15). Each card and note
 * carries it, so it works unchanged inside the Picker's Shadow Root and on
 * the two extension pages.
 */
const firstUseTipStyles = `
.fn-tip { display: grid; gap: 4px; margin: 0 0 12px; padding: 10px 12px; border: 1px solid var(--fn-warning-border); border-radius: 9px; background: var(--fn-warning-soft); color: var(--fn-text); }
.fn-tip .fn-tip-heading { margin: 0; font-size: 12px; font-weight: 750; color: var(--fn-warning); }
.fn-tip .fn-tip-line { margin: 0; padding: 0; font-size: 12px; line-height: 1.45; }
p.fn-tip-note { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin: 0 0 10px; padding: 7px 10px; border: 1px solid var(--fn-warning-border); border-radius: 8px; background: var(--fn-warning-soft); color: var(--fn-text); font-size: 12px; line-height: 1.4; }
.fn-tip .fn-tip-dismiss, .fn-tip-note .fn-tip-dismiss { justify-self: start; flex: none; min-height: 0; padding: 3px 9px; border: 1px solid var(--fn-warning-border); border-radius: 6px; background: var(--fn-surface); color: var(--fn-warning); font-family: inherit; font-size: 11px; font-weight: 650; line-height: 1.3; cursor: pointer; }
.fn-tip .fn-tip-dismiss:focus-visible, .fn-tip-note .fn-tip-dismiss:focus-visible { outline: 2px solid var(--fn-warning); outline-offset: 2px; }
@media (forced-colors: active) {
  .fn-tip, .fn-tip-note { border: 1px solid CanvasText; }
  .fn-tip .fn-tip-dismiss, .fn-tip-note .fn-tip-dismiss { border-color: ButtonText; }
}
`;
