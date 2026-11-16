// The combat spotlight's clock and the hooks that wait for it (docs/design-system-table.md, Spotlight; phase 24). The store opens a
// gate for each moment's attacks (spotlight/gate.ts); the canvas plays them on one clock (`useSpotlight`), and the scrim over the bar
// and the dock, the banner, the settle after a moment and the canvas's card motions hold while the gate is open (`useSpotlightHold`).
// A tap ends the gate, which lands the table on the new state. Nothing here draws, and nothing gates an intent.
import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useMemo, useState } from "react";
import { cancelAnimation, useAnimatedReaction, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useStore } from "zustand";

import type { ScenarioState } from "../../rules/core/state.ts";

import { tickImpact } from "../../ui/haptics.ts";
import type { TableLayout } from "../layout/layout.ts";
import { easingOf, useMotionScale } from "../../ui/motion-run.ts";
import { hitTime, leaveTime, spotlightRun } from "./beats.ts";
import { spotlightHolds } from "./gate.ts";
import { buildPlan, type SpotlightPlan } from "./plan.ts";
import { sameArea, type StageArea } from "./stage.ts";
import { warmFor, type Warm } from "./warm.ts";
import { useReaderMode, useScreenReader } from "../../ui/screen-reader.ts";
import type { TableStore } from "../store/store.ts";
import { tableSettings } from "../../ui/table-settings.ts";

// A canvas draws the spotlight on every platform (the web's once CanvasKit has loaded, and until then the list table ends each gate: reader-gate.ts).
const CANVAS = true;

/**
 * The motion scale the spotlight plays at: the table's scale (1 Normal, 0.6 Quick), or 0, which plays none, when the player turned the
 * Combat spotlight off in the table settings, when reduced motion is on, or when a screen reader is (the banner carries the attack).
 */
export function useSpotlightScale(): number {
  const on = useStore(tableSettings, (state) => state.settings.spotlight);
  const reader = useScreenReader();
  // The phone's reader table (also forced in a dev build) mounts no canvas.
  const readerTable = useReaderMode();
  const scale = useMotionScale();
  return on && !reader && !readerTable ? scale : 0;
}

/** Whether the table is waiting for the spotlight to play: the banner, the settle and the state's card motions start after it. */
export function useSpotlightHold(store: TableStore): boolean {
  const gate = useStore(store, (state) => state.spotlight);
  return spotlightHolds(gate, useSpotlightScale(), CANVAS);
}

/** Whether the skip catcher over the top bar and the dock takes touches: while the spotlight is held at all. */
export function useScrim(store: TableStore): boolean {
  const gate = useStore(store, (state) => state.spotlight);
  return spotlightHolds(gate, useSpotlightScale(), CANVAS);
}

type Track = { layout: TableLayout; area: StageArea; seq: number; plan: SpotlightPlan | null };

/**
 * The spotlight of the canvas: the plan for a new moment's attacks, worked out once during the render that brings its layout (the
 * same pattern as useCardMotion), and the clock that runs it. `progress` runs 0 to 1 over the plan's span at the motion scale, on the
 * UI thread. The gate ends when the clock does ("done"); a tap, a new canvas size, Undo or a moment that replaces it ends it early
 * ("skipped") and the clock is set to the end. `area` is the screen the stage fills (spotlight/stage.ts); a new one ends a spotlight like a new canvas size. With the scale at 0, or a plan it cannot draw, the gate is ended at once, so nothing
 * waits for a spotlight that does not play.
 */
export function useSpotlight(store: TableStore, layout: TableLayout, area: StageArea, k: number): { plan: SpotlightPlan | null; progress: SharedValue<number>; playing: boolean; live: SharedValue<boolean>; swallow: SharedValue<boolean>; warm: Warm | null } {
  const gate = useStore(store, (state) => state.spotlight);
  const gateScale = useSpotlightScale();
  const [track, setTrack] = useState<Track>(() => ({ layout, area, seq: gate.seq, plan: null }));
  if (track.layout !== layout || !sameArea(track.area, area)) {
    const sameSize = track.layout.width === layout.width && track.layout.height === layout.height && sameArea(track.area, area);
    let plan: SpotlightPlan | null = null;
    if (gate.seq !== track.seq) {
      // A new moment's attacks fly from where the cards stood before the state, else from where they stand now.
      // The gate's own states: the moments the table answered after it in the same tap may have moved on (gate.ts, nextGate).
      if (sameSize && spotlightHolds(gate, gateScale, CANVAS) && gate.before && gate.after) {
        plan = buildPlan({ seq: gate.seq, clashes: gate.clashes, canvas: { width: layout.width, height: layout.height }, area, card: layout.card, prev: gate.before, next: gate.after, layouts: [track.layout, layout], scale: layout.scale ?? 1 });
      }
    } else if (sameSize) plan = track.plan;
    setTrack({ layout, area, seq: gate.seq, plan });
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
  // The clock's length, read when a plan starts; a new speed alone does not start the effect.
  const runFor = useEffectEvent(() => total);
  // Once per new plan: run the clock.
  useLayoutEffect(() => {
    if (!plan) return;
    const endRun = () => store.getState().endSpotlight("done", plan.seq);
    progress.set(0);
    progress.set(
      withTiming(1, { duration: runFor(), easing: easingOf("linear") }, (finished) => {
        if (finished) scheduleOnRN(endRun);
      }),
    );
    return () => cancelAnimation(progress);
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
  // The pictures of an attack still pending, for the layer to decode at the stage's size before the spotlight starts (spotlight/warm.ts): the
  // enemy when the attack is declared, its defender when one is chosen. Nothing when no spotlight would play.
  const enemyCode = useStore(store, (state) => codeOf(state.game, state.game.pendingAttack?.enemyId));
  const defenderCode = useStore(store, (state) => codeOf(state.game, state.game.pendingAttack?.defenderId));
  const cardW = layout.card.w;
  const cardH = layout.card.h;
  const stageScale = layout.scale ?? 1;
  const warm = useMemo(
    () => (gateScale > 0 && CANVAS ? warmFor([enemyCode, defenderCode], area, { w: cardW, h: cardH }, stageScale) : null),
    [gateScale, enemyCode, defenderCode, area, cardW, cardH, stageScale],
  );
  return { plan, progress, playing, live, swallow, warm };
}

// The code of a card of the game, or null.
function codeOf(game: ScenarioState, id: string | undefined): string | null {
  return id ? (game.cards[id]?.code ?? null) : null;
}
