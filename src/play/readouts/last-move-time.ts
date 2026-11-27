// How long the last move's line and its look strip stay (docs/design-system-table.md, Last move). Pure, so a test reads it.
import { paceScale, type Speed } from "../../ui/motion-tokens.ts";
import type { Moment } from "../store/outcome.ts";

/** The line that is up: the lean telling of the moment `seq`. */
export type HeldLine = { seq: number; move: Moment };

/**
 * The line after a moment is told. A moment with a lean telling replaces the line. One with none (a window the table passed for the player, a
 * draw, a change the table shows) leaves the line of the moment before it up, so the player reads it. An Undo takes it down: the table went back.
 * The player's own send takes it down too (table-hooks.ts, `close`), before the moment that send makes is told.
 */
export function heldLine(held: HeldLine | null, told: { seq: number; undone: boolean; lean: Moment | null }): HeldLine | null {
  if (told.undone) return null;
  return told.lean ? { seq: told.seq, move: told.lean } : held;
}

// How long a look strip lies over the play area once its line is up.
const LOOK_HOLD_MS = 4500;

/** The look strip's hold in ms: it covers cards the next send may need, so it does not wait for that send. Slow lengthens it by 1.5. */
export function lookHoldMs(speed: Speed): number {
  return Math.round(LOOK_HOLD_MS * paceScale(speed));
}
