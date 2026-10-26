// The curves the canvas draws a motion with, as pure functions of time so the UI thread works a card's pose out from one clock
// and a Vitest reads them (the functions marked "worklet" run on the UI thread; in Node the directive is an unused string).
// motion-tokens.ts names the curves and springs; motion-run.ts gives Reanimated the same names for the chrome.
import { SHAPE, springOmega, type EasingName, type Spring } from "./motion-tokens.ts";

export function clamp01(x: number): number {
  "worklet";
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/** The curve `name` at `x` in 0..1: 0 at the start, 1 at the end ("outBack" runs past 1 on the way and settles on it). */
export function ease(name: EasingName, x: number): number {
  "worklet";
  const v = clamp01(x);
  switch (name) {
    case "linear":
      return v;
    case "outCubic":
      return 1 - (1 - v) * (1 - v) * (1 - v);
    case "inCubic":
      return v * v * v;
    case "outQuad":
      return 1 - (1 - v) * (1 - v);
    case "inQuad":
      return v * v;
    case "outBack": {
      const u = v - 1;
      return u * u * ((SHAPE.backOvershoot + 1) * u + SHAPE.backOvershoot) + 1;
    }
  }
}

/**
 * A spring's step response at `t` ms, from 0 to 1: it overshoots 1 and settles, and is exactly 1 from the token's `ms` on.
 * The same damped oscillator Reanimated's withSpring integrates, in closed form (mass 1, no initial speed).
 */
export function springStep(t: number, token: Spring): number {
  "worklet";
  if (t <= 0) return 0;
  if (t >= token.ms) return 1;
  const omega = springOmega(token);
  const zeta = token.zeta;
  const seconds = t / 1000;
  if (zeta >= 1) return 1 - Math.exp(-omega * seconds) * (1 + omega * seconds);
  const damped = omega * Math.sqrt(1 - zeta * zeta);
  return 1 - Math.exp(-zeta * omega * seconds) * (Math.cos(damped * seconds) + ((zeta * omega) / damped) * Math.sin(damped * seconds));
}

/** A spring token stretched or squeezed by the motion scale (motionScale): same damping ratio, settling in `scale` times as long. */
export function scaledSpring(token: Spring, scale: number): Spring {
  "worklet";
  return { ms: Math.max(1, token.ms * scale), zeta: token.zeta };
}
