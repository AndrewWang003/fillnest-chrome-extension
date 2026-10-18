/**
 * Task 037, slice 5. Finds user-visible prose written inline in a component.
 *
 * Deliberately narrow. It reports the two shapes that actually reach a reader
 * and are easy to write by accident:
 *
 * - text between JSX tags, and
 * - the `aria-label`, `title` and `placeholder` attributes, whose values are
 *   read aloud or shown on hover.
 *
 * What it does not report matters as much. A single word with no space is
 * usually a class name, an icon name or a token rather than a sentence, and
 * flagging those would train people to ignore this gate. So a finding needs at
 * least two words and a lowercase letter - `Save` slips through, and that is
 * accepted: the cost of a false positive here is someone silencing the check.
 */

// Codex review, 2026-09-13: any prop named for what a reader sees - an
// `emptyMessage`, a `helpText`, a `dialogTitle` - carries copy too.
const ATTRIBUTE_PATTERN =
  /\b(aria-label|title|placeholder|label|ariaLabel|data-tooltip|\w+(?:Message|Label|Text|Title|Description|Hint|Placeholder))="([^"]+)"/gu;
/**
 * Prose built at runtime. `` `${count} templates` `` never sat between JSX
 * tags, so the first version of this check walked past every outcome message
 * in the product - which is exactly what the owner found untranslated.
 */
// Task 037 Addendum B: across lines too - an outcome message with a
// conditional clause wraps, and the single-line version never saw it.
const TEMPLATE_LITERAL_PATTERN = /`((?:[^`\\]|\\.)*[A-Za-z]{3,}(?:[^`\\]|\\.)*)`/gu;
const JSX_TEXT_PATTERN = />([^<>{}]+)<(.?)/gu;
/**
 * Task 037 Addendum B. JSX text next to an expression: `</strong> to Shared
 * Template Set{" "}` has an expression on one side, so `>text<` never saw it.
 */
const JSX_TEXT_BESIDE_EXPRESSION_PATTERN = /(?:>|\})([^<>{}]+)(?=\{)|\}([^<>{}]+)(?=<)/gu;
/**
 * Task 037 Addendum B. A quoted string anywhere else - a ternary inside an
 * attribute, a `[value, label]` tuple, an outcome message assigned to a
 * variable. The owner found each of these still English on screen, and the
 * three patterns above look only at tag text, attribute literals and template
 * literals.
 */
const STRING_LITERAL_PATTERN = /(?<![\w$\\])"((?:[^"\\\n]|\\.)*)"/gu;
/**
 * What comes just before a quoted string that makes it code rather than
 * copy: a comparison or `case` label (`key === "Escape"`), a thrown internal
 * invariant (Task 037 leaves those English - see its contract), a selector
 * query, a non-rendered JSX attribute (`class=`, `type=`...), or an object key
 * that names a token.
 */
const NON_RENDERED_CONTEXT =
  /(?:[!=]==?|\bcase|(?<!\|)\|\s*|\b(?:querySelector(?:All)?|closest|matches|getElementById|addEventListener|removeEventListener|setAttribute|getAttribute|hasAttribute|removeAttribute)\(|\b[\w-]+=|\b(?:key|code|type|kind|id|role|mode|name|class|className)\s*:)\s*$/u;
/**
 * Anywhere earlier on the line: a thrown internal invariant (Task 037 leaves
 * those English), a type alias, or an `as const` list of identifiers.
 */
const NON_RENDERED_LINE = /\bError\(|\btype\s+\w+\s*=/u;
/** Code words that JSX-shaped text between `}` and `<` or `{` can start with. */
const TYPE_LEVEL =
  /^\s*(?:as|satisfies|extends|implements|keyof|typeof|new|return|await|yield|else|from|interface|type|export|const|let|var|function|import|async|catch|finally|try|do|while|in|instanceof|case|default)\b/u;
/**
 * Codex review, 2026-09-13: lowercase words beside an expression are the noun
 * or connective of a count - `{count} option{s}`, `{n} selected`, `{a}–{b} of
 * {total}` - and every one reached a Chinese reader while this gate passed.
 */
const LOWERCASE_BESIDE_EXPRESSION = /^[a-z]{2,}(?:\s+[a-z]{2,})*$/u;

/**
 * Comments are not rendered, and TypeScript's generics look exactly like JSX
 * to a regular expression: `useState<Foo>(null)` puts `(null);\n  const ...`
 * between a `>` and a `<`. Both are removed before anything is judged.
 */
/** @param {string} source @returns {string} */
function stripNonRendered(source) {
  // Newlines are preserved so reported line numbers still point at the file.
  return source
    .replace(/\/\*[\s\S]*?\*\//gu, (/** @type {string} */ comment) => comment.replace(/[^\n]/gu, " "))
    .replace(/^([ \t]*)\/\/.*$/gmu, (/** @type {string} */ _line, /** @type {string} */ indent) => indent);
}

/** Code between angle brackets is a generic, not text a reader sees. */
const CODE_LIKE = /[;=(){}`|&]/u;

/**
 * @param {string} text
 *
 * A single word counts. The first version of this check required two, and the
 * owner found `Move`, `Insert`, `Restore` and every theme name still in
 * English - one word is a button label far more often than it is a token.
 * What is excluded instead is the shape of an identifier: SCREAMING_CASE,
 * kebab-case, dotted paths and camelCase runs.
 */
function looksLikeProse(text) {
  const trimmed = text.trim();
  if (trimmed.length < 3) return false;
  // User-facing text in this product starts with a capital. A lowercase single
  // word is an internal token - the icon components pass `label="edit"` to
  // build a `data-fillnest-icon` marker nobody reads.
  if (!/^[A-Z]/u.test(trimmed) && !/\s/u.test(trimmed)) return false;
  // Prose has lowercase letters in it; SCREAMING_CASE does not.
  if (!/[a-z]/u.test(trimmed)) return false;
  if (CODE_LIKE.test(trimmed)) return false;
  if (!/[A-Za-z]/u.test(trimmed)) return false;
  if (/\s/u.test(trimmed)) return true;
  // One word: a label unless it is shaped like an identifier.
  return /^[A-Za-z][a-z]*$/u.test(trimmed);
}

/**
 * @param {string} text
 *
 * A quoted string is copy when it reads as words a person sees: either a
 * capitalised word on its own (arrows and ellipses around it allowed - "↓
 * Descending"), or two or more words carrying a capital or sentence
 * punctuation. Several lower-case words with no punctuation are a class list
 * (`"picker pinned"`), which is by far the commonest quoted multi-word string
 * in a component.
 */
function looksLikeLiteralProse(text) {
  const trimmed = text.trim();
  if (trimmed.length < 3 || CODE_LIKE.test(trimmed)) return false;
  if (/^[.#[@]/u.test(trimmed) || /^https?:/u.test(trimmed) || /[[\]]/u.test(trimmed)) return false;
  const words = trimmed.match(/[A-Za-z]{2,}/gu) ?? [];
  if (words.length >= 2 && /\s/u.test(trimmed)) {
    return /[A-Z]/u.test(trimmed) || /[.,·?!…:]/u.test(trimmed);
  }
  const bare = trimmed.replace(/^[^A-Za-z]+|[^A-Za-z]+$/gu, "");
  return /^[A-Z][a-z]+$/u.test(bare);
}

/**
 * @param {string} text
 * @param {boolean} readAloud the literal is the value of an attribute a reader
 *   hears or sees (`aria-label`, `title`...), where one word is already copy
 */
function looksLikeInterpolatedProse(text, readAloud) {
  const withoutHoles = text.replace(/\$\{[^}]*\}/gu, " ");
  // Real words outside the interpolations, so a bare `${a}/${b}` path or a CSS
  // value is not mistaken for a sentence. Task 037 Addendum B: one capitalised
  // word with a short one beside it is enough (`Added ${a} to ${b}`), and in a
  // read-aloud attribute one word is (`Select ${origin}`).
  const words = withoutHoles.match(/[A-Za-z]{3,}/gu) ?? [];
  const shortWords = withoutHoles.match(/[A-Za-z]{2,}/gu) ?? [];
  const enough =
    words.length >= 2 ||
    (words.length === 1 && (readAloud || (shortWords.length >= 2 && /[A-Z]/u.test(words[0] ?? ""))));
  // Codex review, 2026-09-13: a short phrase is a sentence once it carries
  // sentence punctuation - `(+${n} more)`, `${label} is available.`, `${a} of
  // ${b}. ...` - where a class list or a key never does.
  const punctuated = shortWords.length >= 1 && /[.!?…](?:\s|$)|\(\+|\)\s*$/u.test(withoutHoles.trim()) &&
    !/\b(?:calc|var|url|min|max|clamp)\(/u.test(withoutHoles);
  if (!enough && !punctuated) return false;
  // Only lower-case words and hyphens: a class list built across lines.
  if (/^[a-z0-9\s-]*$/u.test(withoutHoles)) return false;
  if (!/[a-z]/u.test(withoutHoles)) return false;
  // Selectors, URLs, storage keys and CSS are built the same way and are not
  // read by anyone.
  // Task 037 Addendum B: a `;` or `:` alone is punctuation - "from this Field;
  // it is now Global", "Filter by Site: …". CSS is a lower-case property
  // name directly before the colon.
  if (/[[\]<>#/\\]|\bpx\b|rgb|translate|data-|aria-|--fn|\b[a-z-]+:/u.test(withoutHoles)) return false;
  return true;
}

/**
 * @param {string} source
 * @returns {{ line: number, kind: string, text: string }[]}
 */
/**
 * A line may opt out with `i18n-exempt: <reason>`, on it or just above it.
 *
 * There is one honest reason and the reason has to be written down: a word the
 * user must **type** cannot be translated, because translating it would make
 * the instruction wrong. `delete`, `reset` and `restore` are the three in this
 * product.
 */
const EXEMPT_PATTERN = /i18n-exempt:/u;

export function findInlineUserFacingStrings(/** @type {string} */ source) {
  /** @type {{ line: number, kind: string, text: string }[]} */
  const findings = [];
  const originalLines = source.split("\n");
  const isExempt = (/** @type {number} */ line) =>
    EXEMPT_PATTERN.test(originalLines[line - 1] ?? "") ||
    EXEMPT_PATTERN.test(originalLines[line - 2] ?? "");
  const scanned = stripNonRendered(source);
  const lineOf = (/** @type {number} */ index) => scanned.slice(0, index).split("\n").length;

  for (const match of scanned.matchAll(ATTRIBUTE_PATTERN)) {
    const attribute = match[1] ?? "";
    const value = match[2] ?? "";
    if (!looksLikeProse(value)) continue;
    const line = lineOf(match.index ?? 0);
    if (isExempt(line)) continue;
    findings.push({ line, kind: attribute, text: value.trim() });
  }

  for (const match of scanned.matchAll(JSX_TEXT_PATTERN)) {
    const text = match[1] ?? "";
    // Task 037 Addendum F: between tags, a lowercase word that trails off or
    // ends a sentence is read, not a token - the share Finder's `more…`.
    if (!looksLikeProse(text) && !/^[a-z]{2,}[….!?]$/u.test(text.trim())) continue;
    // A single word between tags is a label when what follows is a closing tag
    // (`>Move</button>`). When a letter follows instead, the brackets belong to
    // two different generics - `Promise<void>` reads as text to a regex.
    if (!/\s/u.test(text.trim()) && !/[/\s]/u.test(match[2] ?? "")) continue;
    const line = lineOf(match.index ?? 0);
    if (isExempt(line)) continue;
    findings.push({ line, kind: "text", text: text.trim() });
  }

  // Template literals are judged by their own pattern below; blanking them here
  // keeps their `${...}` holes from reading as JSX expressions.
  // The `${...}` holes are kept: a label chosen inside one - `${open ?
  // "Collapse" : "Expand"}` - is still a quoted string a reader sees.
  const withoutTemplates = scanned.replace(/`(?:[^`\\]|\\.)*`/gu, (literal) =>
    literal.replace(/(\$\{[^}]*\})|[^\n]/gu, (character, hole) => hole ?? " "),
  );

  for (const match of withoutTemplates.matchAll(JSX_TEXT_BESIDE_EXPRESSION_PATTERN)) {
    const text = match[1] ?? match[2] ?? "";
    const trimmed = text.trim();
    const capitalisedWord = /^[A-Z][a-z]+[:?]?$/u.test(trimmed);
    const lowercaseWords = LOWERCASE_BESIDE_EXPRESSION.test(trimmed);
    if (TYPE_LEVEL.test(text)) continue;
    const start = match.index ?? 0;
    const end = start + match[0].length;
    // `=> void {`: the `>` of an arrow, not the end of a tag.
    if (withoutTemplates[start] === ">" && withoutTemplates[start - 1] === "=") continue;
    // `template={template} selectable {...rest}`: a boolean prop inside a tag.
    if (withoutTemplates.startsWith("{...", end)) continue;
    if (!lowercaseWords) {
      if (!capitalisedWord && !looksLikeProse(text)) continue;
      // One word beside an expression counts when it is capitalised - `Delete
      // {count}`, `Sites: {list}`.
      if ((!/\s/u.test(trimmed) && !capitalisedWord) || /^[.#]/u.test(trimmed)) continue;
    }
    // Between two kept template holes: the literal's own text, judged below.
    if (/\$$/u.test(trimmed)) continue;
    // Arguments between an interpolated literal and an object: `, undefined, {`.
    if (/,$/u.test(trimmed)) continue;
    // `{a ? b : c}` split across lines leaves `current ?` between braces, and
    // an object literal leaves `, dark:` between `}` and `{`.
    if (/^[a-z_$][\w$.]*\s*\?$/u.test(trimmed) || /^(?:,\s*["\w$-]+|[a-z_$"][\w$-]*"?)\s*:$/u.test(trimmed)) continue;
    const line = lineOf(match.index ?? 0);
    if (isExempt(line)) continue;
    findings.push({ line, kind: "text", text: trimmed });
  }

  for (const match of withoutTemplates.matchAll(STRING_LITERAL_PATTERN)) {
    const text = match[1] ?? "";
    if (!looksLikeLiteralProse(text)) continue;
    const index = match.index ?? 0;
    const lineStart = withoutTemplates.lastIndexOf("\n", index) + 1;
    const prefix = withoutTemplates.slice(lineStart, index);
    const lineEnd = withoutTemplates.indexOf("\n", index);
    const wholeLine = withoutTemplates.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
    if (NON_RENDERED_CONTEXT.test(prefix) || NON_RENDERED_LINE.test(prefix)) continue;
    // A state setter given one capitalised word is choosing an identifier -
    // `setDestination("Templates")`. Given a sentence, it is showing copy -
    // `setError("FillNest returned …")` - and that is reported.
    if (/\b(?:set[A-Z]\w*|useState(?:<[^>]*>)?)\(\s*$/u.test(prefix) && !/\s/u.test(text.trim())) continue;
    if (/\]\s*as const\b/u.test(wholeLine)) continue;
    const line = lineOf(index);
    if (isExempt(line)) continue;
    findings.push({ line, kind: "string", text: text.trim() });
  }

  // A sentence can also arrive as an imported constant. By convention the core
  // names a user-facing sentence `*_MESSAGE`; rendering one puts the core's
  // English in front of a reader who chose another language (2026-09-11 audit).
  for (const match of scanned.matchAll(/\{\s*([A-Z][A-Z0-9_]*_MESSAGE)\s*\}/gu)) {
    const line = lineOf(match.index ?? 0);
    if (isExempt(line)) continue;
    findings.push({ line, kind: "constant", text: match[1] ?? "" });
  }

  for (const match of scanned.matchAll(TEMPLATE_LITERAL_PATTERN)) {
    const text = match[1] ?? "";
    // `class={`page-status ${mode}`}` is a class list, not a sentence.
    const before = scanned.slice(Math.max(0, (match.index ?? 0) - 14), match.index ?? 0);
    const lineStart = scanned.lastIndexOf("\n", match.index ?? 0) + 1;
    const linePrefix = scanned.slice(lineStart, match.index ?? 0);
    const readAloud = /\b(?:aria-label|ariaLabel|title|placeholder|label|\w*Label)=\{/u.test(linePrefix);
    if (!looksLikeInterpolatedProse(text, readAloud)) continue;
    if (/\b(class|className|id|style|key)=\{$/u.test(before)) continue;
    const line = lineOf(match.index ?? 0);
    if (isExempt(line)) continue;
    findings.push({ line, kind: "interpolated text", text: text.trim() });
  }

  return findings;
}
