const DEFAULT_CONTROL_SIZE = 28;

export function fieldControlSize(fieldHeight: number): number {
  if (!Number.isFinite(fieldHeight)) return DEFAULT_CONTROL_SIZE;
  return Math.round(Math.min(32, Math.max(24, fieldHeight - 4)));
}

/**
 * The Picker's preferred width, and the margin it keeps from every viewport
 * edge. Shared so the stylesheet, the anchored placement in the content
 * script and the pinned (dragged) placement cannot disagree about how wide
 * the Picker actually is.
 */
export const PICKER_PREFERRED_WIDTH = 348;
export const PICKER_VIEWPORT_MARGIN = 8;

/**
 * Task 023 Addendum B5 (15): the width was a hard 348px in the stylesheet and
 * repeated as a literal in the placement maths. Browser zoom shrinks the
 * viewport measured in CSS pixels, so past roughly 250% the Picker was wider
 * than the viewport itself - its right-hand content sat off-screen with no way
 * to scroll to it, because a fixed/absolute overlay does not extend the page's
 * own scroll range.
 */
export function pickerWidthWithin(viewportWidth: number): number {
  if (!Number.isFinite(viewportWidth)) return PICKER_PREFERRED_WIDTH;
  const available = viewportWidth - 2 * PICKER_VIEWPORT_MARGIN;
  return Math.max(1, Math.min(PICKER_PREFERRED_WIDTH, available));
}

/**
 * Task 023 Addendum B5 (14): a pinned Picker is placed from a stored position
 * that nothing re-checked against the current viewport. Zooming in, or moving
 * the window to a smaller screen, left it partly or wholly outside - and
 * because the stored value never changed, it came back off-screen every time.
 *
 * Clamping keeps the whole Picker inside the viewport when it fits, and pins
 * it to the top-left margin when it does not (its own `max-height`/`overflow`
 * then makes the rest reachable by scrolling inside it).
 */
export function clampPickerPosition(
  position: { top: number; left: number },
  size: { width: number; height: number },
  viewport: { width: number; height: number },
): { top: number; left: number } {
  const maxLeft = Math.max(PICKER_VIEWPORT_MARGIN, viewport.width - size.width - PICKER_VIEWPORT_MARGIN);
  const maxTop = Math.max(PICKER_VIEWPORT_MARGIN, viewport.height - size.height - PICKER_VIEWPORT_MARGIN);
  return {
    left: Math.min(Math.max(position.left, PICKER_VIEWPORT_MARGIN), maxLeft),
    top: Math.min(Math.max(position.top, PICKER_VIEWPORT_MARGIN), maxTop),
  };
}
