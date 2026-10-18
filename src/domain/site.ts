import { getDomain } from "tldts-icann";

export type SiteIdentity = string;

export function siteIdentityFromUrl(value: string): SiteIdentity {
  const hostname = new URL(value).hostname.toLowerCase().replace(/\.$/, "");

  if (
    hostname === "localhost" ||
    hostname.startsWith("[") ||
    /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)
  ) {
    return hostname;
  }

  return getDomain(hostname, { extractHostname: false }) ?? hostname;
}

/**
 * A persisted Site must be the exact, canonical identity this module would
 * derive from a URL.  Archive input is untrusted, so accepting merely a
 * non-empty string here would allow an invalid Site to become durable state.
 */
export function isCanonicalSiteIdentity(value: unknown): value is SiteIdentity {
  if (typeof value !== "string" || value.length === 0 || value.trim() !== value) return false;
  try {
    // Keep the scheme fragmented so the extension package contains no literal
    // remote URL. This is validation-only; no request is made.
    return siteIdentityFromUrl(["https", ":", "//", value].join("")) === value;
  } catch {
    return false;
  }
}
