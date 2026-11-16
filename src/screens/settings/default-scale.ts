// The desktop's first-launch interface size (docs/design-system.md, Settings; the desktop build only, store.canvaskit.ts): a big window shows the table small at
// Medium, so a profile that has never set the interface size starts at the step the window suits. A value the player has set (stored with the rest of the settings) is
// never replaced.
import { UI_SCALE_OPTIONS, type UiScaleOption } from "../../ui/table-settings.ts";

/** The window, in points, from which a first launch starts at Large. */
export const LARGE_FROM = { width: 1600, height: 900 } as const;

/** The window, in points, from which a first launch starts at Extra large. */
export const XLARGE_FROM = { width: 2400, height: 1350 } as const;

/** The interface size a window suits: Medium, Large from 1600 by 900, Extra large from 2400 by 1350. */
export function defaultUiScale(width: number, height: number): UiScaleOption {
  if (width >= XLARGE_FROM.width && height >= XLARGE_FROM.height) return "xlarge";
  if (width >= LARGE_FROM.width && height >= LARGE_FROM.height) return "large";
  return "medium";
}

/** Whether stored settings already hold an interface size: the player (or the first launch) has chosen. */
export function hasStoredScale(stored: unknown): boolean {
  return stored != null && typeof stored === "object" && UI_SCALE_OPTIONS.some((option) => option === (stored as { uiScale?: unknown }).uiScale);
}
