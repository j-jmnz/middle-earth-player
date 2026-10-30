// Whether the combat spotlight is running for the table's last moment (docs/design-system-table.md, Spotlight; phase 24). Pure: the
// store (store.ts) opens a gate for each accepted intent with the attacks it resolved, the canvas plays them and closes it (done, or
// skipped by a tap), and everything that waits for the spotlight reads it: the scrim over the bar and the dock, the banner, the
// 350 ms settle after a new moment, the card motions of the state and the token pops of its damage. The gate never gates an intent:
// a tap on the canvas skips it and is still handled, and a closed gate holds nothing.
import type { Clash } from "./clash.ts";

/**
 * `seq`: the moment (store.ts) whose attacks these are. `ended`: null while they play, "done" when the run finished, "skipped" when a
 * tap, a new picture size, Undo or reduced motion ended it early (the table then lands on the new state at once). `leaving`: the last
 * attack has begun to go back, so the scrim fades with the canvas.
 */
export type SpotlightGate = { seq: number; clashes: readonly Clash[]; ended: "done" | "skipped" | null; leaving: boolean };

/** A table that has not played a spotlight. */
export const NO_SPOTLIGHT: SpotlightGate = { seq: 0, clashes: [], ended: "done", leaving: true };

/** The gate for a moment's attacks: open when there are any, else already closed. */
export function openGate(seq: number, clashes: readonly Clash[]): SpotlightGate {
  return clashes.length === 0 ? { seq, clashes, ended: "done", leaving: true } : { seq, clashes, ended: null, leaving: false };
}

/** The gate closed, by the run finishing or by a skip. A gate that is already closed, or another moment's, is left as it is. */
export function endGate(gate: SpotlightGate, how: "done" | "skipped", seq = gate.seq): SpotlightGate {
  return gate.seq !== seq || gate.ended != null ? gate : { ...gate, ended: how, leaving: true };
}

/** The gate marked as leaving: the last attack has begun to go back. */
export function leaveGate(gate: SpotlightGate, seq = gate.seq): SpotlightGate {
  return gate.seq !== seq || gate.leaving ? gate : { ...gate, leaving: true };
}

/**
 * Whether the table is waiting for the spotlight: it has attacks to play, has not ended, a canvas will draw it, and the motion
 * scale is not 0 (reduced motion plays none; the banner carries the attack). The web build has no canvas to draw it.
 */
export function spotlightHolds(gate: SpotlightGate, scale: number, canvas: boolean): boolean {
  return canvas && scale > 0 && gate.clashes.length > 0 && gate.ended == null;
}

/** Whether a spotlight is open and not yet ended, whatever the scale: what Android Back skips before it peels a layer. */
export function spotlightOpen(gate: SpotlightGate): boolean {
  return gate.clashes.length > 0 && gate.ended == null;
}
