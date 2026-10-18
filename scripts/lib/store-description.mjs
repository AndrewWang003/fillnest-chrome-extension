export const MAX_SHORT_DESCRIPTION = 132;

const MESSAGE_REFERENCE = /^__MSG_(\w+)__$/u;

/**
 * What is wrong with the short description the store would show, in every
 * language the extension ships. A manifest description that names a message
 * (`__MSG_extensionDescription__`) is resolved in each locale's catalogue and
 * measured there - measuring the placeholder itself always passed.
 *
 * @param {unknown} description the manifest's `description`
 * @param {Record<string, Record<string, { message?: unknown }>>} catalogues by locale directory name
 * @returns {string[]}
 */
export function storeDescriptionProblems(description, catalogues) {
  if (typeof description !== "string" || description.length === 0) return ["the manifest has no description"];
  const reference = MESSAGE_REFERENCE.exec(description);
  if (!reference) return tooLong("the description", description);
  const key = reference[1] ?? "";
  return Object.entries(catalogues).flatMap(([locale, messages]) => {
    const text = messages[key]?.message;
    if (typeof text !== "string" || text.length === 0) return [`the ${locale} catalogue has no ${key} message`];
    return tooLong(`the ${locale} description`, text);
  });
}

/**
 * @param {string} subject
 * @param {string} text
 * @returns {string[]}
 */
function tooLong(subject, text) {
  const length = Array.from(text).length;
  return length <= MAX_SHORT_DESCRIPTION
    ? []
    : [`${subject} is ${length} characters; the store allows ${MAX_SHORT_DESCRIPTION}`];
}
