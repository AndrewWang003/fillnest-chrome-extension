export interface PermissionOrigin {
  origin: string;
  pattern: string;
}

export function permissionOriginFromUrl(value: string): PermissionOrigin {
  const url = new URL(value);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Unsupported permission protocol: ${url.protocol}`);
  }

  const port = url.port || (url.protocol === "https:" ? "443" : "80");
  const origin = `${url.protocol}//${url.hostname}:${port}`;

  return {
    origin,
    pattern: `${origin}/*`,
  };
}

/** Returns an exact Permission Origin only for a canonical single-origin match pattern. */
export function exactOriginFromPattern(pattern: string): string | null {
  const match = /^(https?):\/\/(\[[^\]]+\]|[^/:*]+):(\d+)\/\*$/.exec(pattern);
  if (!match) return null;

  try {
    return permissionOriginFromUrl(`${match[1]}://${match[2]}:${match[3]}`).origin;
  } catch {
    return null;
  }
}
