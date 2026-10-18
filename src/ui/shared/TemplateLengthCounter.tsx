import { useMessages } from "../../i18n/useMessages";
import {
  MAX_TEMPLATE_CONTENT_BYTES,
  MAX_TEMPLATE_CONTENT_WIDE_CHARACTERS,
  TEMPLATE_CONTENT_COUNT_VISIBLE_FROM,
  templateContentByteLength,
} from "../../templates/template-content";

/**
 * How much room is left in a Template, once the draft is near the limit.
 *
 * Shared by the Picker and the Side Panel because both edit the same thing
 * against the same budget. It renders nothing below the threshold, so a caller
 * can place it unconditionally.
 *
 * **Why it counts what is left rather than showing used / limit.** The budget
 * is UTF-8 bytes: a Chinese character costs three of what a letter costs. A
 * "2,600 / 3,000" would be honest about the budget and actively wrong to the
 * person reading it - someone who has typed 867 Chinese characters has not
 * typed 2,600 of anything. Nor can the limit be shown as a character count,
 * because there is no single one: it is 1,000 characters or 3,000 letters
 * depending on what you type.
 *
 * What survives both problems is the room remaining, measured in the
 * characters the writer is actually using. It is an estimate only for mixed
 * text, hence "About", and it is the number a writer wants anyway. The exact
 * budget stays available in `title` for anyone who wants it.
 */
export function TemplateLengthCounter({ content }: { content: string }) {
  const t = useMessages();
  const used = templateContentByteLength(content);
  if (used < TEMPLATE_CONTENT_COUNT_VISIBLE_FROM) return null;

  // Code points, not UTF-16 units, so an emoji is one character rather than two.
  const characters = [...content].length;
  const bytesPerCharacter = characters > 0 ? used / characters : 1;
  const remainingCharacters = Math.floor((MAX_TEMPLATE_CONTENT_BYTES - used) / bytesPerCharacter);
  const over = used > MAX_TEMPLATE_CONTENT_BYTES;

  return (
    <p
      class={over ? "template-length-counter over" : "template-length-counter"}
      title={t.templateLengthDetail(
        used.toLocaleString("en-US"),
        MAX_TEMPLATE_CONTENT_BYTES.toLocaleString("en-US"),
        MAX_TEMPLATE_CONTENT_WIDE_CHARACTERS.toLocaleString("en-US"),
        MAX_TEMPLATE_CONTENT_BYTES.toLocaleString("en-US"),
      )}
      role="status"
      aria-live="polite"
    >
      {over
        ? t.charactersTooMany(Math.abs(remainingCharacters).toLocaleString("en-US"))
        : t.charactersLeft(remainingCharacters.toLocaleString("en-US"))}
    </p>
  );
}
