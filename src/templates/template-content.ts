import { UserFacingError } from "../messages/user-error";
/**
 * The limit on how much text one Template may hold.
 *
 * Set by the owner as **1,000 Chinese characters**, with other writing systems
 * converted at the same weight. The measure is therefore UTF-8 bytes rather
 * than characters: a CJK character is three bytes, so 1,000 of them is 3,000
 * bytes, and the same budget buys roughly 3,000 Latin letters. Counting
 * characters instead would have squeezed English to a third of the room and
 * given an emoji the same cost as a word.
 *
 * Bytes are also the honest unit for the reason the limit exists.
 * `chrome.storage.local` gives FillNest about 10 MB, and nothing else in the
 * product caps growth, so one pasted document could have consumed a
 * meaningful share of a store that holds every Template, Site and Binding.
 *
 * The limit applies to **new writes only**. Restoring a Backup Archive, and
 * every Undo, deliberately bypass it: they carry content FillNest already
 * accepted, and refusing to give a user their own data back would be a worse
 * failure than the one this prevents.
 */
export const MAX_TEMPLATE_CONTENT_BYTES = 3000;

/** Roughly what the budget buys, for wording the user sees. */
export const MAX_TEMPLATE_CONTENT_WIDE_CHARACTERS = 1000;

/**
 * When an editor starts showing the count.
 *
 * Same rule as the Field's own Template counter: below this a running total is
 * noise on a Template that is plainly nowhere near the limit, and above it the
 * user is close enough that meeting the limit for the first time as a refusal
 * would be a surprise.
 */
export const TEMPLATE_CONTENT_COUNT_VISIBLE_FROM = Math.round(MAX_TEMPLATE_CONTENT_BYTES * 0.8);

const encoder = new TextEncoder();

export function templateContentByteLength(content: string): number {
  return encoder.encode(content).length;
}

export function isTemplateContentWithinLimit(content: string): boolean {
  return templateContentByteLength(content) <= MAX_TEMPLATE_CONTENT_BYTES;
}

function utf8Length(codePoint: number): number {
  if (codePoint < 0x80) return 1;
  if (codePoint < 0x800) return 2;
  if (codePoint < 0x10000) return 3;
  return 4;
}

/**
 * Task 035 Addendum A (owner decision, 2026-09-11): an editor stops input at
 * the limit rather than accepting it and then refusing to save.
 *
 * `previous` is the editor's content before this input and `next` its content
 * after, with the caret at `caret`. Only what the input added - the text just
 * before the caret - is cut, from its end, and whole characters only; text
 * already there, before or after the caret, is never touched. When the input
 * cannot be made to fit that way (a Template saved before the limit existed,
 * or a paste replacing a selection), a change that would make the content
 * longer is refused outright.
 */
export function fitTemplateInput(
  previous: string,
  next: string,
  caret: number,
): { value: string; caret: number; truncated: boolean } {
  if (isTemplateContentWithinLimit(next)) return { value: next, caret, truncated: false };

  const prefix = next.slice(0, caret);
  const suffix = next.slice(caret);
  const added = Math.max(0, next.length - previous.length);
  const earliestCut = Math.max(0, caret - added);
  const budget = MAX_TEMPLATE_CONTENT_BYTES - templateContentByteLength(suffix);

  // The longest prefix, in whole code points, that fits the budget.
  let fits = 0;
  let bytes = 0;
  for (const character of prefix) {
    const size = utf8Length(character.codePointAt(0) ?? 0);
    if (bytes + size > budget) break;
    bytes += size;
    fits += character.length;
  }
  if (budget >= 0 && fits >= earliestCut) {
    return { value: prefix.slice(0, fits) + suffix, caret: fits, truncated: true };
  }
  if (templateContentByteLength(next) <= templateContentByteLength(previous)) {
    return { value: next, caret, truncated: false };
  }
  return { value: previous, caret: earliestCut, truncated: true };
}

/**
 * One sentence the user can act on. It states the budget both ways because
 * "3,000 bytes" means nothing to someone writing a Template, and a single
 * character count would be wrong for one of the two writing systems.
 */
export const TEMPLATE_TOO_LONG_MESSAGE =
  `This Template is too long. A Template holds about ${MAX_TEMPLATE_CONTENT_WIDE_CHARACTERS.toLocaleString("en-US")} Chinese characters, or about ${MAX_TEMPLATE_CONTENT_BYTES.toLocaleString("en-US")} letters. Shorten it, or split it into two Templates.`;

/** Throws the user-facing message. Used at the service worker's own boundary. */
export function assertTemplateContentWithinLimit(content: string): void {
  if (!isTemplateContentWithinLimit(content)) throw new UserFacingError("template-too-long", TEMPLATE_TOO_LONG_MESSAGE);
}

