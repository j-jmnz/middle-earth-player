// Feedback that is both a haptic and a sound at the same moment (docs/design-system-table.md, Haptics and Sound).
import { tickRefused } from "../haptics.ts";
import { playSound } from "./sound.ts";

/** The reducer refused an intent, the table refused a play it cannot pay for, or an unplayable card was let go: the reject tick and the error sound. */
export function refusedFeedback(): void {
  tickRefused();
  playSound("ui.error");
}
