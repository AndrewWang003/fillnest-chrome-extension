import type { Messages } from "../../i18n/catalogue";
import { useEffect, useRef } from "preact/hooks";

export function FieldAliasEditor({
  displayLabel,
  editing,
  draft,
  busy,
  labelClassName,
  showHint = false,
  messages,
  onStart,
  onDraftChange,
  onSave,
  onCancel,
}: {
  displayLabel: string;
  editing: boolean;
  draft: string;
  busy: boolean;
  labelClassName?: string;
  /**
   * Task 024 Addendum C.1. Shown for the box the user is typing in, where the
   * question "what am I naming, and why?" actually arises. A rename row inside
   * a list of other Fields already has its own context and does not need it.
   */
  showHint?: boolean;
  /** Task 037: passed in, because this editor renders inside a page too. */
  messages: Messages;
  onStart(): void;
  onDraftChange(value: string): void;
  onSave(value: string): void;
  onCancel(): void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const editorRef = useRef<HTMLSpanElement | null>(null);
  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;

  // Owner QA 2026-09-11: Task 036 Addendum A.3 discarded an unsaved rename on
  // the actions it listed; any press outside the editor now does, as in the
  // Side Panel. The Picker lives in a Shadow Root, where a document listener
  // sees only the host as the target, so the event's path decides.
  useEffect(() => {
    if (!editing) return;
    const editor = editorRef.current;
    const document = editor?.ownerDocument;
    if (!editor || !document) return;
    function onPointerDown(event: PointerEvent): void {
      if (editor && !event.composedPath().includes(editor)) cancelRef.current();
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [editing]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      // Task 023 Addendum B5 (3): the box is seeded with the current name, so
      // select it - replacing the whole name stays one keystroke away while
      // editing part of it becomes possible at all.
      inputRef.current?.select();
    }
  }, [editing]);

  if (editing) {
    return (
      <span
        class="picker-field-alias-editor"
        ref={editorRef}
        onFocusOut={(event) => {
          // Focus moving to another control abandons the rename; focus
          // leaving the page does not.
          const next = event.relatedTarget;
          if (next instanceof Node && !event.currentTarget.contains(next)) onCancel();
        }}
      >
        <input
          ref={inputRef}
          type="text"
          // The Field being named is the one the user is typing in only where
          // the hint says so; a rename row inside a list names *that* row's
          // Field, and has to keep saying which.
          aria-label={showHint ? messages.nameForThisBox() : messages.nameForField(displayLabel)}
          placeholder={messages.nameThisBox()}
          {...(showHint ? { "aria-describedby": "fillnest-field-alias-hint" } : {})}
          value={draft}
          onInput={(event) => onDraftChange(event.currentTarget.value)}
          onKeyDown={(event) => {
            const key = (event as unknown as KeyboardEvent).key;
            if (key === "Enter") {
              event.preventDefault();
              onSave(inputRef.current?.value ?? draft);
            } else if (key === "Escape") {
              event.preventDefault();
              onCancel();
            }
          }}
        />
        <button type="button" disabled={busy} onClick={() => onSave(inputRef.current?.value ?? draft)}>
          {messages.save()}
        </button>
        <button type="button" class="secondary" disabled={busy} onClick={onCancel}>
          {messages.cancel()}
        </button>
        {/* Task 024 Addendum C.1. Most people have never heard a text box
            called a "field", and nothing on screen explains why naming one
            would matter. This says which thing is being named - the box they
            are typing in - and what the name is for. */}
        {showHint && (
          <span class="picker-field-alias-hint" id="fillnest-field-alias-hint">
            {messages.renameHint()}
          </span>
        )}
      </span>
    );
  }

  return (
    <span class="picker-field-alias-label">
      <button
        type="button"
        class="picker-field-alias-trigger"
        // Same distinction as the input's name: "this box" is only true for
        // the Field the user is typing in. A row in a list of other Fields
        // says which one it renames - without the word "field", which is the
        // jargon this addendum is removing.
        aria-label={
          showHint ? messages.renameThisBox(displayLabel) : messages.renameField(displayLabel)
        }
        title={showHint ? messages.renameThisBoxHint() : messages.renameFieldHint()}
        onClick={onStart}
      >
        <strong class={labelClassName}>{displayLabel}</strong>
      </button>
    </span>
  );
}
