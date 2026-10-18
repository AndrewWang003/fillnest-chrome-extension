import { useState } from "preact/hooks";

import type { AllowWebsiteAccessResult } from "../../activation/activation-authority";
import type { RuntimeRequest, RuntimeResponse } from "../../messages/runtime-messages";
import { sendRequest } from "./runtime-request";

// Shared between the Popup and the Side Panel Overview page so both surfaces
// request Website Access through exactly one code path, not two that could
// drift apart. Requesting access must remain a genuine user gesture: call
// allowAccess synchronously from the originating click handler, with nothing
// awaited beforehand, so chrome.permissions.request still runs inside that
// click's own gesture stack.
export function useWebsiteAccessRequest(onGranted: () => Promise<void> | void): {
  busy: boolean;
  incomplete: AllowWebsiteAccessResult | null;
  allowAccess(pageUrl: string, tabId: number, retry: boolean): Promise<void>;
  clearIncomplete(): void;
} {
  const [busy, setBusy] = useState(false);
  const [incomplete, setIncomplete] = useState<AllowWebsiteAccessResult | null>(null);

  async function allowAccess(pageUrl: string, tabId: number, retry: boolean): Promise<void> {
    setBusy(true);
    try {
      const request: RuntimeRequest = {
        type: retry ? "RETRY_SITE_ACTIVATION" : "ENABLE_SITE",
        pageUrl,
        tabId,
      };
      const response: RuntimeResponse = await sendRequest(request);
      if (!response.ok) throw new Error(response.error);
      if (!isAllowResult(response.value)) throw new Error("FillNest returned an invalid access result.");
      setIncomplete(response.value.status === "incomplete" ? response.value : null);
      await onGranted();
    } finally {
      setBusy(false);
    }
  }

  return { busy, incomplete, allowAccess, clearIncomplete: () => setIncomplete(null) };
}


function isAllowResult(value: unknown): value is AllowWebsiteAccessResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "status" in value &&
    (value.status === "denied" || value.status === "active" || value.status === "incomplete")
  );
}
