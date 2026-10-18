import { useCallback, useRef, useState } from "preact/hooks";

import { fitTemplateInput } from "../../templates/template-content";

type TextareaEvent = { currentTarget: HTMLTextAreaElement };

/**
 * Task 035 Addendum A (owner decision, 2026-09-11): a Template editor stops
 * taking input at the content limit.
 *
 * Returns the textarea's input handlers, and whether the last input was cut
 * short, so the editor can say why nothing more appeared.
 *
 * An input method's composition - how Chinese is typed - is left alone until
 * it ends: changing the text under a composition breaks it. Its result is
 * fitted once it is committed, measured against the content from before the
 * composition began.
 *
 * `compositionend` is listened for natively, through `ref`. Preact wires an
 * `onCompositionEnd` prop by lower-casing it only when the element has an
 * `oncompositionend` property, and Chromium's textarea has none - so the prop
 * listened for an event named `CompositionEnd` that never fires, and a
 * composition was cut only by the next non-composed keystroke (owner QA,
 * 2026-09-11). happy-dom defines the property, which is why tests missed it.
 */
export function useTemplateContentInput(value: string, setValue: (next: string) => void) {
  const committed = useRef(value);
  const composing = useRef(false);
  const [truncated, setTruncated] = useState(false);
  if (!composing.current) committed.current = value;

  function commit(field: HTMLTextAreaElement): void {
    composing.current = false;
    const fitted = fitTemplateInput(committed.current, field.value, field.selectionEnd ?? field.value.length);
    if (fitted.value !== field.value) {
      field.value = fitted.value;
      field.setSelectionRange(fitted.caret, fitted.caret);
    }
    committed.current = fitted.value;
    setTruncated(fitted.truncated);
    setValue(fitted.value);
  }

  const latestCommit = useRef(commit);
  latestCommit.current = commit;
  const attached = useRef<{ field: HTMLTextAreaElement; listener: () => void } | null>(null);
  const ref = useCallback((field: HTMLTextAreaElement | null) => {
    if (attached.current) attached.current.field.removeEventListener("compositionend", attached.current.listener);
    attached.current = null;
    if (!field) return;
    const listener = () => latestCommit.current(field);
    field.addEventListener("compositionend", listener);
    attached.current = { field, listener };
  }, []);

  return {
    truncated,
    ref,
    onInput(event: TextareaEvent & { isComposing?: boolean }): void {
      if (event.isComposing) {
        composing.current = true;
        setValue(event.currentTarget.value);
        return;
      }
      commit(event.currentTarget);
    },
  };
}
