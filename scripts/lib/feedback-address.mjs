const ADDRESS_DECLARATION = /FEEDBACK_EMAIL_ADDRESS\s*=\s*"([^"]*)"/u;
const PLAUSIBLE_ADDRESS = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

/**
 * Task 042. The feedback address Overview shows, read from
 * `src/support/feedback.ts`, or why it cannot go to the store.
 *
 * @param {string} source the file's text
 * @returns {{ address: string } | { problem: string }}
 */
export function feedbackAddressFrom(source) {
  const address = ADDRESS_DECLARATION.exec(source)?.[1] ?? "";
  if (address.length === 0) return { problem: "no feedback address in src/support/feedback.ts (owner: an address)" };
  if (!PLAUSIBLE_ADDRESS.test(address)) return { problem: `the feedback address "${address}" is not an email address` };
  return { address };
}
