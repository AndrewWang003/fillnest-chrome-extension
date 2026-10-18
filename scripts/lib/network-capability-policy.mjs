/** @type {Array<[string, RegExp]>} */
const forbiddenCapabilities = [
  ["EventSource", /\bEventSource\s*\(/u],
  ["XMLHttpRequest", /\bXMLHttpRequest\b/u],
  ["WebSocket", /\bWebSocket\s*\(/u],
  ["fetch", /\bfetch\s*\(/u],
  ["amplitude", /\bamplitude\b/iu],
  ["mixpanel", /\bmixpanel\b/iu],
  ["posthog", /\bposthog\b/iu],
  ["segment", /\bsegment\.(?:track|identify|page)\b/iu],
  ["sentry", /\bSentry\.(?:init|captureException|captureMessage)\b/u],
];

/** @param {string} content */
export function findForbiddenNetworkCapabilities(content) {
  return forbiddenCapabilities
    .filter(([, pattern]) => pattern.test(content))
    .map(([name]) => name);
}
