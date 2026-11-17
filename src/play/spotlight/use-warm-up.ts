// The web layer's warm-up clock (spotlight/held-layer.tsx, warm-plan.ts). Once the layer can play a spotlight and the table has had time to
// settle, the browser is idle for a moment, and then the clock steps through a warm plan one animation frame at a time: each step is one
// frame the layer's persistent canvas draws, hidden, so the pipelines the spotlight needs are compiled before a real attack asks for them.
// It does nothing while a spotlight plays (the real one has the canvas) and starts over if it was cut short; every timer and frame it
// asks for is cancelled when it stops.
import { useEffect, useState } from "react";
import { useSharedValue, type SharedValue } from "react-native-reanimated";

// How long after the layer can play before the browser is asked for an idle moment, and the longest it waits for one (ms).
const SETTLE = 1500;
const IDLE_LIMIT = 4000;
// The frames the warm plan is stepped through, evenly over its run.
export const WARM_STEPS = 18;

type Phase = "waiting" | "warming" | "done";

// Runs `run` when the browser is idle (a timer where it has no idle callback), and returns the call that cancels it.
function whenIdle(run: () => void): () => void {
  const idle = globalThis.requestIdleCallback;
  if (typeof idle !== "function") {
    const timer = setTimeout(run, 0);
    return () => clearTimeout(timer);
  }
  const handle = idle(run, { timeout: IDLE_LIMIT });
  return () => globalThis.cancelIdleCallback(handle);
}

// Waits SETTLE, then an idle moment; returns the call that cancels either.
function afterSettling(run: () => void): () => void {
  let cancelIdle: (() => void) | null = null;
  const timer = setTimeout(() => {
    cancelIdle = whenIdle(run);
  }, SETTLE);
  return () => {
    clearTimeout(timer);
    cancelIdle?.();
  };
}

// Calls `step` with 1, 2, ... `WARM_STEPS` on consecutive animation frames, then `done`; returns the call that cancels it.
function stepFrames(step: (n: number) => void, done: () => void): () => void {
  let frame = 0;
  let n = 0;
  const tick = () => {
    n += 1;
    step(n);
    if (n >= WARM_STEPS) done();
    else frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frame);
}

/**
 * `enabled` is whether a warm-up is wanted at all (the web, a spotlight that can play, its pictures and fonts loaded) and `busy` whether a
 * real spotlight has the canvas. `warming` is whether the layer draws the warm plan now; `clock` is its 0..1 progress.
 */
export function useWarmUp(enabled: boolean, busy: boolean): { warming: boolean; clock: SharedValue<number> } {
  const clock = useSharedValue(0);
  const [phase, setPhase] = useState<Phase>("waiting");
  const running = enabled && !busy;
  useEffect(() => {
    if (!running || phase !== "waiting") return;
    return afterSettling(() => setPhase("warming"));
  }, [running, phase]);
  useEffect(() => {
    if (!running || phase !== "warming") return;
    return stepFrames(
      (n) => clock.set(n / WARM_STEPS),
      () => setPhase("done"),
    );
  }, [running, phase, clock]);
  return { warming: running && phase === "warming", clock };
}
