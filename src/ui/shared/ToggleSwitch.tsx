/**
 * The one switch control.
 *
 * The Popup used to carry its own copy of this component and its own copy of
 * the CSS behind it, which is how the Popup's Global switch kept its
 * uninformative accessible name after the Side Panel's was fixed (Task 023
 * Addendum B5, finding 1). One component, imported by both surfaces, is what
 * stops the two from drifting apart again.
 *
 * It lives here rather than in `SidePanelShared` so the Popup can import it
 * without pulling the Side Panel's repository types and dialog machinery into
 * the Popup bundle.
 */
export function ToggleSwitch({
  checked,
  onChange,
  id,
  label,
  ariaLabel,
  disabled,
  compact,
}: {
  checked: boolean;
  onChange(): void;
  id: string;
  /** The visible state text, e.g. "Active" or "Paused". */
  label: string;
  /**
   * Required whenever `label` alone does not say what the switch turns on -
   * which is every switch whose visible label is only its own state. The
   * visible label is then hidden from assistive technology rather than
   * announced twice.
   */
  ariaLabel?: string;
  disabled?: boolean;
  /**
   * The switch sits inside a dense list row rather than standing on its own.
   * One documented size rule instead of three surfaces quietly disagreeing
   * (Task 034, finding F5).
   */
  compact?: boolean;
}) {
  return (
    <label class={compact ? "toggle-switch compact" : "toggle-switch"} htmlFor={id}>
      <span class="toggle-label" aria-hidden={ariaLabel !== undefined}>{label}</span>
      <input
        id={id}
        type="checkbox"
        role="switch"
        aria-label={ariaLabel ?? label}
        checked={checked}
        disabled={disabled}
        onChange={onChange}
      />
      <span class="toggle-track" aria-hidden="true"><span class="toggle-thumb" /></span>
    </label>
  );
}
