// The phase title sweep (docs/design-system-table.md, Motion; phase 23): when the round moves forward into a new phase, its name
// crosses the canvas once. Pure: whether it shows and what it says. The view is phase-sweep.tsx.
import { clamp01 } from "./motion-curves.ts";
import { ROUND_PHASES } from "./rail.ts";
import { tokenDeltas, type Counted } from "./token-deltas.ts";

/**
 * How long the table waits after a phase change before it sweeps. The table passes a whole phase for the player (Stops on, an
 * action window that is not a stop) in the moments after it begins, and a phase the player never stopped in does not get a title:
 * a second change inside this wait takes the first one's place. A gate, not a motion, so it is outside the scale.
 */
export const SETTLE_MS = 150;

/** Where the round is: the phase's name and the round it belongs to. */
export type PhasePoint = { phase: string; round: number };

// Where a point sits in the game's order: the round, then the phase in the round (-1 outside the seven: setup, the mulligan,
// the beginning and end of the round).
function order(point: PhasePoint): [number, number] {
  return [point.round, ROUND_PHASES.indexOf(point.phase)];
}

/**
 * The name to sweep when the game's phase went from `before` to `now`, or null. Only one of the round's seven phases is named
 * (not Setup, the Mulligan or the beginning and end of the round), and nothing sweeps:
 * - when the scale is not 1 (Quick or reduced motion);
 * - when the new state moves cards or changes a count (`busy`): the title would cover the pops and turns on the player's row;
 * - when the phase went backward, which is Undo taking a phase back.
 */
export function sweepName(before: PhasePoint, now: PhasePoint, scale: number, busy: boolean): string | null {
  if (before.phase === now.phase && before.round === now.round) return null;
  if (scale !== 1 || busy || !ROUND_PHASES.includes(now.phase)) return null;
  const [roundWas, phaseWas] = order(before);
  const [roundNow, phaseNow] = order(now);
  if (roundNow < roundWas || (roundNow === roundWas && phaseNow < phaseWas)) return null;
  return now.phase;
}

/** The part of a state `busyBetween` reads: each card's counts, where it lies and whether it is turned. */
export type Seen = Counted & { readonly cards: Readonly<Record<string, { readonly zone: string; readonly exhausted: boolean }>> };

/** Whether the table moves cards or changes a count between two states: a draw, a ready, a token added or taken off. */
export function busyBetween(prev: Seen, next: Seen): boolean {
  if (tokenDeltas(prev, next).length > 0) return true;
  for (const [id, card] of Object.entries(next.cards)) {
    const before = prev.cards[id];
    if (before && (before.zone !== card.zone || before.exhausted !== card.exhausted)) return true;
  }
  return false;
}

/** The sweep's opacity and the slide it has made, at `x` in 0..1 of its run: fades in over the first quarter, out over the last. */
export function sweepFrame(x: number, slide: number): { opacity: number; offset: number } {
  "worklet";
  const v = clamp01(x);
  const opacity = v < 0.25 ? v / 0.25 : v > 0.75 ? (1 - v) / 0.25 : 1;
  return { opacity, offset: (v - 0.5) * slide };
}
