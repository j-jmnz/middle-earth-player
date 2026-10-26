// The phase title sweep (docs/design-system.md, Table, Motion; phase 23): when the round moves into a new phase, its name crosses the
// canvas once. Pure: whether it shows and what it says. The view is phase-sweep.tsx.
import type { Speed } from "./motion-tokens.ts";
import { ROUND_PHASES } from "./rail.ts";

/**
 * How long the table waits after a phase change before it sweeps. The table passes a whole phase for the player (Stops on, an
 * action window that is not a stop) in the moments after it begins, and a phase the player never stopped in does not get a title:
 * a second change inside this wait takes the first one's place. A gate, not a motion, so it is outside the scale.
 */
export const SETTLE_MS = 150;

/**
 * The name to sweep when the game's phase went from `before` to `now`, or null: only one of the round's seven phases is named
 * (not Setup, the Mulligan or the beginning and end of the round), and nothing sweeps under Quick or reduced motion (`scale` 0).
 */
export function sweepName(before: string, now: string, speed: Speed, scale: number): string | null {
  if (before === now || speed === "quick" || scale === 0) return null;
  return ROUND_PHASES.includes(now) ? now : null;
}

/** The sweep's opacity and the slide it has made, at `x` in 0..1 of its run: fades in over the first quarter, out over the last. */
export function sweepFrame(x: number, slide: number): { opacity: number; offset: number } {
  "worklet";
  const v = x < 0 ? 0 : x > 1 ? 1 : x;
  const opacity = v < 0.25 ? v / 0.25 : v > 0.75 ? (1 - v) / 0.25 : 1;
  return { opacity, offset: (v - 0.5) * slide };
}
