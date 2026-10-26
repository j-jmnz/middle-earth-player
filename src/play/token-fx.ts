// The pop of a token whose count changed and the number that floats up from it (phase 23). Pure functions of time, run on the UI
// thread by token-fx.native.tsx (the functions marked "worklet" run there; in Node the directive is an unused string).
import { clamp01, ease, scaledSpring, springStep } from "./motion-curves.ts";
import { MOTION, SHAPE } from "./motion-tokens.ts";
import type { TokenDelta } from "./token-deltas.ts";

function length(token: { ms: number }, k: number): number {
  "worklet";
  return Math.max(1, token.ms * k);
}

/** The scale of a popping token `t` ms after its count changed: 1 up to the pop, then back to 1 on a spring. */
export function tokenPopScale(t: number, k: number): number {
  "worklet";
  if (t <= 0) return 1;
  const rise = length(MOTION.tokenPopRise, k);
  const bump = SHAPE.tokenPop - 1;
  if (t < rise) return 1 + bump * ease("outCubic", t / rise);
  return 1 + bump * (1 - springStep(t - rise, scaledSpring(MOTION.tokenPopSettle, k)));
}

/** How long the pop runs, unscaled. */
export const POP_MS = MOTION.tokenPopRise.ms + MOTION.tokenPopSettle.ms;

/** How long the floating number lives, unscaled: shown while it rises, then fading out, 700 ms in all. */
export const FLOAT_MS = SHAPE.floatFadeFrom + MOTION.floatFade.ms;

/** The floating number `t` ms in: how far it has risen (up is negative) and how visible it is. */
export function floatAt(t: number, k: number): { dy: number; opacity: number } {
  "worklet";
  if (t < 0) return { dy: 0, opacity: 0 };
  const rise = ease("outCubic", t / length(MOTION.floatRise, k));
  const fadeFrom = SHAPE.floatFadeFrom * k;
  const fade = clamp01((t - fadeFrom) / length(MOTION.floatFade, k));
  return { dy: -SHAPE.floatRise * rise, opacity: 1 - ease("inQuad", fade) };
}

/** A token change to show: when it starts (ms after the state was drawn, unscaled) and what changed. */
export type Fx = { delta: TokenDelta; start: number };

/**
 * The pops and floating numbers of a state. `startOf` says when the card's own motion ends (0 when it stays where it is) or
 * null when the card is not on the table: a pop waits for the card to arrive, and a card off the table shows none.
 */
export function fxPlan(deltas: readonly TokenDelta[], startOf: (cardId: string) => number | null): readonly Fx[] {
  const out: Fx[] = [];
  for (const delta of deltas) {
    const start = startOf(delta.cardId);
    if (start != null) out.push({ delta, start });
  }
  return out;
}

/** How long a state's pops and floating numbers take together, unscaled. */
export function fxSpan(fx: readonly Fx[]): number {
  return fx.reduce((span, item) => Math.max(span, item.start + FLOAT_MS), 0);
}
