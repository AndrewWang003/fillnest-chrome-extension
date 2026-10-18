import type { BrowserContext, Request } from "@playwright/test";

export interface RuntimeRequestEvidence {
  url: string;
  initiatorUrl: string;
  resourceType: string;
  navigation: boolean;
  allowedOrigins: ReadonlySet<string>;
}

export interface RuntimeNetworkMonitor {
  readonly requests: RuntimeRequestEvidence[];
  readonly violations: string[];
}

export function classifyRuntimeRequest(
  evidence: RuntimeRequestEvidence,
): string | null {
  const url = new URL(evidence.url);
  if (!["http:", "https:", "ws:", "wss:"].includes(url.protocol)) return null;
  if (evidence.initiatorUrl.startsWith("chrome-extension://")) {
    return `network request initiated by extension context: ${evidence.url}`;
  }
  if (evidence.resourceType === "websocket" || evidence.resourceType === "eventsource") {
    return `unexpected ${evidence.resourceType} request: ${evidence.url}`;
  }
  if (!evidence.allowedOrigins.has(url.origin)) {
    return `network request has unexpected origin: ${evidence.url}`;
  }
  if (evidence.navigation) return null;

  const initiator = safeUrl(evidence.initiatorUrl);
  if (!initiator || !evidence.allowedOrigins.has(initiator.origin)) {
    return `fixture request has unexpected initiator: ${evidence.initiatorUrl || "unknown"}`;
  }
  return null;
}

export function monitorRuntimeNetwork(
  context: BrowserContext,
  allowedOrigins: ReadonlySet<string>,
): RuntimeNetworkMonitor {
  const requests: RuntimeRequestEvidence[] = [];
  const violations: string[] = [];
  context.on("request", (request) => {
    const evidence = requestEvidence(request, allowedOrigins);
    if (!evidence) return;
    requests.push(evidence);
    const violation = classifyRuntimeRequest(evidence);
    if (violation) violations.push(violation);
  });
  return { requests, violations };
}

function requestEvidence(
  request: Request,
  allowedOrigins: ReadonlySet<string>,
): RuntimeRequestEvidence | null {
  const protocol = safeUrl(request.url())?.protocol;
  if (!protocol || !["http:", "https:", "ws:", "wss:"].includes(protocol)) {
    return null;
  }
  const worker = request.serviceWorker();
  let initiatorUrl = worker?.url() ?? "";
  if (!initiatorUrl) {
    try {
      initiatorUrl = request.frame().url();
    } catch {
      initiatorUrl = "";
    }
  }
  return {
    url: request.url(),
    initiatorUrl,
    resourceType: request.resourceType(),
    navigation: request.isNavigationRequest(),
    allowedOrigins,
  };
}

function safeUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}
