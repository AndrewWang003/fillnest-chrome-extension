import type { AllowWebsiteAccessResult } from "../../activation/activation-authority";
import type { ActivationMode } from "../../activation/activation-repository";
import type { Messages } from "../../i18n/catalogue";
import { useMessages } from "../../i18n/useMessages";
import { ToggleSwitch } from "./ToggleSwitch";

/** What the current tab is, for the purpose of using FillNest on it. */
export type ActivationPage =
  | { status: "unavailable" }
  | { status: "available"; origin: string; websiteAccess: boolean; originActivation: ActivationMode };

export type ActivationStatus = "unavailable" | "needs-access" | "needs-global" | "needs-site" | "needs-reload" | "ready";

/**
 * Owner QA 2026-09-15. The one next step before FillNest works on this tab,
 * or that it already does. A new user used to grant a site and find nothing
 * happening, because FillNest itself starts paused and nothing said so.
 * Blocking failures - a failed Restore - are shown by the surface's own error
 * state instead, which replaces all of this.
 */
export function activationStatus(
  global: ActivationMode,
  page: ActivationPage,
  incomplete: AllowWebsiteAccessResult | null,
): ActivationStatus {
  if (page.status === "unavailable") return "unavailable";
  if (!page.websiteAccess) return "needs-access";
  if (global === "paused") return "needs-global";
  if (page.originActivation === "paused") return "needs-site";
  if (incomplete?.status === "incomplete") return "needs-reload";
  return "ready";
}

function statusText(status: ActivationStatus, t: Messages): string {
  switch (status) {
    case "unavailable":
      return t.statusPageUnsupported();
    case "needs-access":
      return t.statusNeedsAccess();
    case "needs-global":
      return t.statusNeedsGlobal();
    case "needs-site":
      return t.statusNeedsSite();
    case "needs-reload":
      return t.statusNeedsReload();
    case "ready":
      return t.statusReady();
  }
}

function hostOf(origin: string): string {
  try {
    return new URL(origin).host;
  } catch {
    return origin;
  }
}

/**
 * Shared by the Popup and the Side Panel's Overview, so the two say the same
 * thing about the same state: FillNest on or off everywhere, on or off on
 * this site, and - in one line - what is still missing.
 */
export function CurrentWebsiteAccess({
  idPrefix,
  global,
  page,
  busy,
  incomplete,
  onGlobal,
  onOrigin,
  onAllow,
  onRetry,
}: {
  idPrefix: string;
  global: ActivationMode;
  page: ActivationPage;
  busy: boolean;
  incomplete: AllowWebsiteAccessResult | null;
  onGlobal(): void;
  onOrigin(): void;
  onAllow(): void;
  onRetry(): void;
}) {
  const t = useMessages();
  const status = activationStatus(global, page, incomplete);
  return (
    <div class="activation">
      <section class="activation-block" aria-labelledby={`${idPrefix}-global-heading`}>
        <div class="activation-row">
          <div>
            <h2 id={`${idPrefix}-global-heading`}>{t.enableFillNest()}</h2>
            <p>{t.enableFillNestDescription()}</p>
          </div>
          <ToggleSwitch
            id={`${idPrefix}-global-toggle`}
            label={global === "active" ? t.globalActive() : t.globalPaused()}
            ariaLabel={t.activeEverywhere()}
            checked={global === "active"}
            disabled={busy}
            onChange={onGlobal}
          />
        </div>
      </section>

      {page.status === "available" && (
        <section class="activation-block" aria-labelledby={`${idPrefix}-site-heading`}>
          <div class="activation-row">
            <div>
              <h2 id={`${idPrefix}-site-heading`}>
                {t.enableOnThisSite()} <span class="activation-host">· {hostOf(page.origin)}</span>
              </h2>
              <p>{t.enableOnThisSiteDescription()}</p>
            </div>
            {page.websiteAccess && (
              <ToggleSwitch
                id={`${idPrefix}-origin-toggle`}
                label={page.originActivation === "active" ? t.globalActive() : t.globalPaused()}
                ariaLabel={t.activeOnOrigin(page.origin)}
                checked={page.originActivation === "active"}
                disabled={busy || global === "paused"}
                onChange={onOrigin}
              />
            )}
          </div>
        </section>
      )}

      <p class={status === "ready" ? "activation-status ready" : "activation-status"} role="status">
        {status === "ready" && <span aria-hidden="true">✓ </span>}
        {statusText(status, t)}
      </p>

      {page.status === "available" && !page.websiteAccess && (
        // Owner QA 2026-09-15: two centred lines, the action above the site,
        // so the action reads first; the accessible name stays one phrase.
        <button
          class="primary-button allow-access-button"
          type="button"
          aria-label={t.allowAccessTo(page.origin)}
          disabled={busy}
          onClick={onAllow}
        >
          <span class="allow-access-action">{t.allowAccess()}</span>
          <span class="allow-access-origin">{page.origin}</span>
        </button>
      )}
      {incomplete?.status === "incomplete" && (
        <div class="notice warning" role="alert">
          <strong>{t.activationIncomplete()}</strong>
          <span>
            {incomplete.stage === "injection" ? t.pageCouldNotStart() : t.activationCouldNotFinish()}
          </span>
          <button type="button" disabled={busy} onClick={onRetry}>
            {t.retry()}
          </button>
        </div>
      )}
    </div>
  );
}
