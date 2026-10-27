// The combat spotlight's clock and the hooks that wait for it (docs/design-system.md, Table, Spotlight; phase 24). The store opens a
// gate for each moment's attacks (spotlight-gate.ts); the canvas plays them on one clock (`useSpotlight`), and the scrim over the bar
// and the dock, the banner, the settle after a moment and the canvas's card motions hold while the gate is open (`useSpotlightHold`).
// A tap ends the gate, which lands the table on the new state. Nothing here draws, and nothing gates an intent.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { cancelAnimation, Easing, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useStore } from "zustand";

import type { TableLayout } from "./layout.ts";
import { tickImpact } from "./haptics.ts";
import { useMotionScale } from "./motion-run.ts";
import { hitTime, leaveTime } from "./spotlight-beats.ts";
import { scrimShows, spotlightHolds } from "./spotlight-gate.ts";
import { buildPlan, type SpotlightPlan } from "./spotlight-plan.ts";
import type { TableStore } from "./store.ts";

// The web build lists the table and has no canvas to play a spotlight on.
const CANVAS = Platform.OS !== "web";

/** Whether the table is waiting for the spotlight to play: the banner, the settle and the state's card motions start after it. */
export function useSpotlightHold(store: TableStore): boolean {
  const gate = useStore(store, (state) => state.spotlight);
  return spotlightHolds(gate, useMotionScale(), CANVAS);
}

/** Whether the scrim over the top bar and the dock shows: the spotlight plays and its last attack has not begun to go back. */
export function useScrimShows(store: TableStore): boolean {
  const gate = useStore(store, (state) => state.spotlight);
  return scrimShows(gate, useMotionScale(), CANVAS);
}

type Track = { layout: TableLayout; seq: number; plan: SpotlightPlan | null };

/**
 * The spotlight of the canvas: the plan for a new moment's attacks, worked out once during the render that brings its layout (the
 * same pattern as useCardMotion), and the clock that runs it. `progress` runs 0 to 1 over the plan's span at the motion scale, on the
 * UI thread. The gate ends when the clock does ("done"); a tap, a new canvas size, Undo or a moment that replaces it ends it early
 * ("skipped") and the clock is set to the end. With the scale at 0, or a plan it cannot draw, the gate is ended at once, so nothing
 * waits for a spotlight that does not play.
 */
export function useSpotlight(store: TableStore, layout: TableLayout, k: number): { plan: SpotlightPlan | null; progress: SharedValue<number>; playing: boolean } {
  const gate = useStore(store, (state) => state.spotlight);
  const [track, setTrack] = useState<Track>(() => ({ layout, seq: gate.seq, plan: null }));
  if (track.layout !== layout) {
    const sameSize = track.layout.width === layout.width && track.layout.height === layout.height;
    const shown = store.getState().shown;
    let plan: SpotlightPlan | null = null;
    if (gate.seq !== track.seq) {
      // A new moment's attacks fly from where the cards stood before the state, else from where they stand now.
      if (sameSize && spotlightHolds(gate, k, CANVAS) && shown?.kind === "sent" && shown.seq === gate.seq) {
        plan = buildPlan({ seq: gate.seq, clashes: gate.clashes, canvas: { width: layout.width, height: layout.height }, card: layout.card, prev: shown.before, next: shown.after, layouts: [track.layout, layout] });
      }
    } else if (sameSize) plan = track.plan;
    setTrack({ layout, seq: gate.seq, plan });
  }
  const { plan } = track;
  const playing = plan != null && plan.seq === gate.seq && gate.ended == null;
  const progress = useSharedValue(1);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const stop = () => {
    for (const timer of timers.current) clearTimeout(timer);
    timers.current = [];
  };
  // Once per new plan: run the clock, time the impact haptic of each strike (at most one) and the scrim's fade out.
  useLayoutEffect(() => {
    if (!plan) return;
    const seq = plan.seq;
    const endRun = () => store.getState().endSpotlight("done", seq);
    progress.set(0);
    progress.set(
      withTiming(1, { duration: Math.max(1, Math.ceil(plan.span * k)), easing: Easing.linear }, (finished) => {
        if (finished) scheduleOnRN(endRun);
      }),
    );
    timers.current = [...plan.clashes.map((_, index) => setTimeout(tickImpact, hitTime(index, k))), setTimeout(() => store.getState().leaveSpotlight(seq), leaveTime(plan.clashes.length, k))];
    return () => {
      cancelAnimation(progress);
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the clock starts for a new plan, not for a new speed.
  }, [plan, progress, store]);
  // Skipped: the clock goes to the end and the haptics that have not played are dropped.
  const skipped = gate.ended === "skipped";
  useLayoutEffect(() => {
    if (!skipped) return;
    cancelAnimation(progress);
    progress.set(1);
    stop();
  }, [skipped, gate.seq, progress]);
  // A gate nobody plays (reduced motion, a plan that could not be made, a canvas that changed size) ends at once.
  useEffect(() => {
    if (gate.clashes.length > 0 && gate.ended == null && !playing) store.getState().endSpotlight("skipped", gate.seq);
  }, [gate, playing, store]);
  return { plan, progress, playing };
}
