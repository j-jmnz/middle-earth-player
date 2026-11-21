// The volume row's keys on the web and the desktop (src/ui/sound/volume-slider.canvaskit.tsx; docs/design-system-table.md, Pointer and keys):
// the arrows move it one 5% step, Page Up and Page Down a screen reader's 10%, Home and End to 0% and 100%.
import { clampVolume, stepVolume } from "../sound/volume.ts";

const STEP = 0.05;

/** The volume a key moves `value` to, or null for a key the row leaves to the page. */
export function volumeKey(key: string, value: number): number | null {
  switch (key) {
    case "ArrowRight":
    case "ArrowUp":
      return clampVolume(value + STEP);
    case "ArrowLeft":
    case "ArrowDown":
      return clampVolume(value - STEP);
    case "PageUp":
      return stepVolume(value, true);
    case "PageDown":
      return stepVolume(value, false);
    case "Home":
      return 0;
    case "End":
      return 1;
    default:
      return null;
  }
}
