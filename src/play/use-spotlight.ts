// The combat spotlight's clock and the hooks that wait for it (docs/design-system.md, Table, Spotlight; phase 24). The store opens a
// gate for each moment's attacks (spotlight-gate.ts); the canvas plays them on one clock (`useSpotlight`), and the scrim over the bar
// and the dock, the banner, the settle after a moment and the canvas's card motions hold while the gate is open (`useSpotlightHold`).
// A tap ends the gate, which lands the table on the new state. Nothing here draws, and nothing gates an intent.
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import { cancelAnimation, useAnimatedReaction, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useStore } from "zustand";

import { tickImpact } from "./haptics.ts";
import type { TableLayout } from "./layout.ts";
import { easingOf, useMotionScale } from "./motion-run.ts";
import { hitTime, leaveTime, spotlightRun } from "./spotlight-beats.ts";
import { scrimShows, spotlightHolds } from "./spotlight-gate.ts";
import { buildPlan, type SpotlightPlan } from "./spotlight-plan.ts";
import { useScreenReader } from "./screen-reader.ts";
import type { TableStore } from "./store.ts";
import { tableSettings } from "./table-settings.ts";

// The web build lists the table and has no canvas to play a spotlight on.
const CANVAS = Platform.OS !== "web";

/**
 * The motion scale the spotlight plays at: the table's scale (1 Normal, 0.6 Quick), or 0, which plays none, when the player turned the
 * Combat spotlight off in the table settings, when reduced motion is on, or when a screen reader is (the banner carries the attack).
 */
export function useSpotlightScale(): number {
  const on = useStore(tableSettings, (state) => state.settings.spotlight);
  const reader = useScreenReader();
  const scale = useMotionScale();
  return on && !reader ? scale : 0;
}

/** Whether the table is waiting for the spotlight to play: the banner, the settle and the state's card motions start after it. */
export function useSpotlightHold(store: TableStore): boolean {
  const gate = useStore(store, (state) => state.spotlight);
  return spotlightHolds(gate, useSpotlightScale(), CANVAS);
}

/** The scrim over the top bar and the dock: `shows` while the spotlight plays and its last attack has not begun to go back, `catches` while it is held at all. */
export function useScrim(store: TableStore): { shows: boolean; catches: boolean } {
  const gate = useStore(store, (state) => state.spotlight);
  const scale = useSpotlightScale();
  return { shows: scrimShows(gate, scale, CANVAS), catches: spotlightHolds(gate, scale, CANVAS) };
}

type Track = { layout: TableLayout; seq: number; plan: SpotlightPlan | null };

/**
 * The spotlight of the canvas: the plan for a new moment's attacks, worked out once during the render that brings its layout (the
 * same pattern as useCardMotion), and the clock that runs it. `progress` runs 0 to 1 over the plan's span at the motion scale, on the
 * UI thread. The gate ends when the clock does ("done"); a tap, a new canvas size, Undo or a moment that replaces it ends it early
 * ("skipped") and the clock is set to the end. With the scale at 0, or a plan it cannot draw, the gate is ended at once, so nothing
 * waits for a spotlight that does not play.
 */
export function useSpotlight(store: TableStore, layout: TableLayout, k: number): { plan: SpotlightPlan | null; progress: SharedValue<number>; playing: boolean; live: SharedValue<boolean>; swallow: SharedValue<boolean> } {
  const gate = useStore(store, (state) => state.spotlight);
  const gateScale = useSpotlightScale();
  const [track, setTrack] = useState<Track>(() => ({ layout, seq: gate.seq, plan: null }));
  if (track.layout !== layout) {
    const sameSize = track.layout.width === layout.width && track.layout.height === layout.height;
    const shown = store.getState().shown;
    let plan: SpotlightPlan | null = null;
    if (gate.seq !== track.seq) {
      // A new moment's attacks fly from where the cards stood before the state, else from where they stand now.
      if (sameSize && spotlightHolds(gate, gateScale, CANVAS) && shown?.kind === "sent" && shown.seq === gate.seq) {
        plan = buildPlan({ seq: gate.seq, clashes: gate.clashes, canvas: { width: layout.width, height: layout.height }, card: layout.card, prev: shown.before, next: shown.after, layouts: [track.layout, layout] });
      }
    } else if (sameSize) plan = track.plan;
    setTrack({ layout, seq: gate.seq, plan });
  }
  const { plan } = track;
  const playing = plan != null && plan.seq === gate.seq && gate.ended == null;
  const progress = useSharedValue(1);
  // Whether the spotlight is on the canvas right now, for the touch that skips it (the canvas's pan reads it on the UI thread), and
  // whether the touch in progress began on one: it then does nothing else.
  const live = useSharedValue(false);
  const swallow = useSharedValue(false);
  useLayoutEffect(() => live.set(playing), [playing, live]);
  const count = plan?.clashes.length ?? 1;
  const total = Math.max(1, spotlightRun(count, k));
  const seq = plan?.seq ?? 0;
  // Once per new plan: run the clock.
  useLayoutEffect(() => {
    if (!plan) return;
    const endRun = () => store.getState().endSpotlight("done", plan.seq);
    progress.set(0);
    progress.set(
      withTiming(1, { duration: total, easing: easingOf("linear") }, (finished) => {
        if (finished) scheduleOnRN(endRun);
      }),
    );
    return () => cancelAnimation(progress);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the clock starts for a new plan, not for a new speed.
  }, [plan, progress, store]);
  // The strikes land (one impact haptic each) and the last attack begins to go back (the scrim fades) as the clock passes them. A skip
  // jumps the clock to its end, past every one of them, and plays none.
  const hits = useMemo(() => Array.from({ length: count }, (_, index) => hitTime(index, count, k)), [count, k]);
  const leaveAt = leaveTime(count, k);
  const leave = useCallback(() => store.getState().leaveSpotlight(seq), [store, seq]);
  useAnimatedReaction(
    () => progress.get() * total,
    (now, was) => {
      if (was == null || now <= was || now >= total) return;
      for (const at of hits) if (was < at && now >= at) scheduleOnRN(tickImpact);
      if (was < leaveAt && now >= leaveAt) scheduleOnRN(leave);
    },
    [hits, total, leaveAt, leave],
  );
  // Skipped: the clock goes to the end.
  const skipped = gate.ended === "skipped";
  useLayoutEffect(() => {
    if (!skipped) return;
    cancelAnimation(progress);
    progress.set(1);
  }, [skipped, gate.seq, progress]);
  // A gate nobody plays (reduced motion, a plan that could not be made, a canvas that changed size) ends at once.
  useEffect(() => {
    if (gate.clashes.length > 0 && gate.ended == null && !playing) store.getState().endSpotlight("skipped", gate.seq);
  }, [gate, playing, store]);
  return { plan, progress, playing, live, swallow };
}
