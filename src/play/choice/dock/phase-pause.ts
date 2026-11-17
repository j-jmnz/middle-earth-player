// The pause before an answer that ends the player's phase (End planning) takes a tap (docs/design-system-table.md, Two taps): a quick
// "Pass, Pass" from the window before cannot carry into it. A gate, not a motion, so it is outside the animation scale.
import type { DockButton } from "../table-choice.ts";

export const PHASE_PAUSE_MS = 500;

/** True while `button` ends the phase and its moment came onto the dock (`shownAt`) less than PHASE_PAUSE_MS before `now`: the tap is ignored, arming included. */
export function pausedFor(button: Pick<DockButton, "reach">, shownAt: number, now: number): boolean {
  return button.reach === "phase" && now < shownAt + PHASE_PAUSE_MS;
}
