export function derivePreview(content: string): string {
  for (const line of content.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return content.trim();
}

export function deriveOutcomePreview(content: string, limit = 50): string {
  const preview = derivePreview(content);
  const characters = Array.from(preview);
  if (characters.length <= limit) return preview;
  return `${characters.slice(0, Math.max(0, limit - 1)).join("").trimEnd()}…`;
}
