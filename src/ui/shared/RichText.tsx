import type { RichMessage } from "../../i18n/messages";

/** Task 037 Addendum B. Renders a catalogue sentence with its emphasised parts. */
export function RichText({ parts }: { parts: RichMessage }) {
  return <>{parts.map((part, index) => (typeof part === "string" ? part : <strong key={index}>{part.strong}</strong>))}</>;
}
