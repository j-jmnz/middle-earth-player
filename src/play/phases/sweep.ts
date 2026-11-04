// Rules: rr.step-1-2, rr.step-1-3, rr.step-6-2, rr.step-7-2 (data/rules/entries.json).
//
// The phase title sweep (docs/design-system-table.md, Motion; phase 23): when the round moves forward into a new phase, its name
// crosses the canvas once. Pure: whether it shows and what it says. The view is phase-sweep.tsx.
import { clamp01 } from "../motion/curves.ts";
import { ROUND_PHASES } from "./rail.ts";
import { tokenDeltas, type Counted } from "../motion/token-deltas.ts";

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

/**
 * Whether the table moves cards or changes a count between two states: a draw, a ready, a token added or taken off. What opens the
 * phase entered (`phase`) does not count, or its title would almost never show:
 * - Combat: a shadow card dealt (rr.step-6-2), beside the enemies and away from the player's row;
 * - Resource: the cards drawn into the hand (rr.step-1-3), the resources gained (rr.step-1-2) and the cards the Refresh phase readied
 *   just before (rr.step-7-2), which the table passes in the same tap.
 * Anything else that moves or counts on the way in still holds the title back.
 */
export function busyBetween(prev: Seen, next: Seen, phase = ""): boolean {
  const resource = phase === "Resource";
  const gained = tokenDeltas(prev, next).filter((delta) => !(resource && delta.token === "resources" && delta.change > 0));
  if (gained.length > 0) return true;
  for (const [id, card] of Object.entries(next.cards)) {
    const before = prev.cards[id];
    if (!before) continue;
    const moved = before.zone !== card.zone;
    const dealt = phase === "Combat" && card.zone === "shadow" && moved;
    const drawn = resource && before.zone === "deck" && card.zone === "hand";
    if (dealt || drawn) continue;
    const readied = resource && before.exhausted && !card.exhausted;
    if (moved || (before.exhausted !== card.exhausted && !readied)) return true;
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
