// The table canvas's gestures (docs/design-system-table.md, Gestures; phase 25), moved out of table-canvas.native.tsx with the hand
// scrub. They race: a drag (a pan from 6 pt) plays a card, a tap picks, a long press (350 ms) previews a card on the table, and a
// pan that activates after a 150 ms hold on the hand scrubs through it. A move before the 150 ms is a drag, so the drag-to-play path
// is never delayed; the scrub is a gesture of its own that fails at once for a press that is not on the hand. All of it runs on the
// UI thread: the finger is read there, the canvas draws from the shared values, and only a change of the card under the finger
// (for the selection tick, the preview at the release, and the pick-up on a forward push) crosses to JavaScript.
//
// The first touch of the drag pan is the hurry and the spotlight's skip (finishMotions, `swallow`); a touch that skipped a spotlight
// does nothing else, and its hold never starts a scrub. A scrub sends no intent and picks nothing: a forward push from a rest on a
// playable card picks that card up into the drag, which follows the finger and, as any drag, picks only when dropped on a target.
import { useCallback, useEffect, useLayoutEffect, useMemo } from "react";
import { Gesture } from "react-native-gesture-handler";
import { cancelAnimation, useDerivedValue, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { finishMotions } from "./card-motion.native.tsx";
import { cancelled, NO_SPREAD, pick, pushed, restAt, restMove, SCRUB_HOLD_MS, SCRUB_REST_MS, SCRUB_SLOP, scrubClock, spreadLayout, startCard, startsScrub, type Rest, type Spread } from "./hand-scrub.ts";
import { tickArmed } from "./haptics.ts";
import { hitDrop, hitSlot, type CardSlot, type DropRect, type TableLayout } from "./layout.ts";
import { timing } from "./motion-run.ts";
import { MOTION } from "./motion-tokens.ts";
import { onScrubCancel, scrubMoved, setScrubOpen } from "./scrub-open.ts";
import { dropRects, type DropTarget } from "./selection.ts";

/**
 * What the canvas draws the scrub from: the clocks (0 to 1), the card under the finger (-1 for none), the card the finger left and
 * its settling clock (1 to 0), and the spread it reads.
 */
export type Scrub = { rise: SharedValue<number>; apart: SharedValue<number>; lift: SharedValue<number>; index: SharedValue<number>; left: SharedValue<number>; drop: SharedValue<number>; spread: Spread };

type Args = {
  layout: TableLayout;
  canvas: { width: number; height: number; bottom: number };
  draggable: readonly string[];
  targets: readonly DropTarget[];
  // The motion scale (0 under reduced motion).
  k: number;
  hurry: { progress: SharedValue<number>; clear: () => void };
  // The spotlight's: playing now, and the touch that skipped it.
  live: SharedValue<boolean>;
  swallow: SharedValue<boolean>;
  // Off with a screen reader on: the hand cards stay reachable through the list path, and the 350 ms press previews them.
  scrubOn: boolean;
  select: (cardId: string | null) => void;
  onTap: (cardId: string) => void;
  onPreview: (cardId: string) => void;
  onDrop: (cardId: string, target: string) => void;
};

export function useTableGestures({ layout, canvas, draggable, targets, k, hurry, live, swallow, scrubOn, select, onTap, onPreview, onDrop }: Args) {
  const { progress: hurryProgress, clear: hurryClear } = hurry;
  const liftTiming = useMemo(() => timing(MOTION.dragLift, k), [k]);
  const returnTiming = useMemo(() => timing(MOTION.dragReturn, k), [k]);
  const riseTiming = useMemo(() => timing(MOTION.scrubRise, k), [k]);
  const apartTiming = useMemo(() => timing(MOTION.scrubSpread, k), [k]);
  const scrubLiftTiming = useMemo(() => timing(MOTION.scrubLift, k), [k]);
  const fallTiming = useMemo(() => timing(MOTION.scrubFall, k), [k]);

  // What the worklets read: the slots, which of them can be picked up, the selected card's drop rectangles and the spread hand.
  const slots = useSharedValue<readonly CardSlot[]>(layout.slots);
  const lifts = useSharedValue<readonly boolean[]>([]);
  const drops = useSharedValue<readonly DropRect[]>([]);
  const spreadNow = useSharedValue<Spread>(NO_SPREAD);
  // Which spread cards (hand order) can be played, and where the finger last rested during the scrub.
  const playable = useSharedValue<readonly boolean[]>([]);
  const rest = useSharedValue<Rest>(restAt(0, 0, 0));
  const dragging = useSharedValue(-1);
  const dx = useSharedValue(0);
  const dy = useSharedValue(0);
  const lift = useSharedValue(1);
  const rise = useSharedValue(0);
  const apart = useSharedValue(0);
  const scrubLift = useSharedValue(0);
  const index = useSharedValue(-1);
  const left = useSharedValue(-1);
  const drop = useSharedValue(0);
  const scrubbing = useSharedValue(false);
  // The scrub handed its card to the drag (a forward push): the rest of this touch moves and drops it. Where the finger would be
  // over the card's resting centre, so the card is drawn centred under the finger.
  const carrying = useSharedValue(false);
  const grabX = useSharedValue(0);
  const grabY = useSharedValue(0);
  // A scrub started and JavaScript has not yet been told it closed.
  const begun = useSharedValue(false);

  // The canvas is its three numbers, so a caller's fresh object with the same ones does not spread the hand again.
  const { width: canvasWidth, height: canvasHeight, bottom: canvasBottom } = canvas;
  const spread = useMemo(() => spreadLayout(layout, { width: canvasWidth, height: canvasHeight, bottom: canvasBottom }), [layout, canvasWidth, canvasHeight, canvasBottom]);
  const draggableSet = useMemo(() => new Set(draggable), [draggable]);
  // Set in a layout effect, which runs before the frame is drawn and before a touch can be handled, so a flick that starts right after a
  // render already finds its slots, lifts and drop targets (a passive effect could run a frame later).
  useLayoutEffect(() => {
    slots.set(layout.slots);
    lifts.set(layout.slots.map((slot) => slot.kind === "card" && draggableSet.has(slot.id)));
  }, [layout, draggableSet, slots, lifts]);
  useLayoutEffect(() => {
    drops.set(dropRects(layout, targets));
  }, [layout, targets, drops]);
  useLayoutEffect(() => {
    spreadNow.set(spread);
    playable.set(spread.ids.map((id) => draggableSet.has(id)));
  }, [spread, spreadNow, draggableSet, playable]);

  // The hand goes back down: at once under reduced motion, else over the scrub's fall.
  const settle = useCallback(() => {
    "worklet";
    scrubbing.set(false);
    index.set(-1);
    cancelAnimation(scrubLift);
    scrubLift.set(0);
    cancelAnimation(drop);
    drop.set(0);
    left.set(-1);
    rise.set(k === 0 ? 0 : withTiming(0, fallTiming));
    apart.set(k === 0 ? 0 : withTiming(0, fallTiming));
  }, [scrubbing, index, scrubLift, drop, left, rise, apart, k, fallTiming]);

  // The card under the finger lifts over the lift token (at once under reduced motion); the one it left settles back over the same.
  const lifting = useCallback(
    (next: number) => {
      "worklet";
      const before = index.get();
      index.set(next);
      cancelAnimation(drop);
      left.set(before);
      drop.set(before >= 0 && k !== 0 ? scrubLift.get() : 0);
      if (before >= 0 && k !== 0) drop.set(withTiming(0, scrubLiftTiming));
      cancelAnimation(scrubLift);
      scrubLift.set(0);
      if (next >= 0) scrubLift.set(k === 0 ? 1 : withTiming(1, scrubLiftTiming));
    },
    [index, left, drop, scrubLift, k, scrubLiftTiming],
  );

  // JavaScript hears of the scrub only when the card under the finger changes, to tick, and when it opens and closes (Android Back).
  const onScrub = useCallback((next: number, open: boolean, start = false) => {
    if (scrubMoved(next, open, start)) tickArmed();
  }, []);
  useEffect(() => {
    onScrubCancel(settle);
    return () => {
      onScrubCancel(null);
      setScrubOpen(false);
    };
  }, [settle]);

  // The dragged card is let go at a point: on one of its drop targets the drop picks (the dock asks to confirm it) and the card is
  // drawn where the next state puts it; anywhere else it goes back and nothing is asked. The drag pan and a carried scrub card end here.
  const release = useCallback(
    (x: number, y: number) => {
      "worklet";
      const slot = slots.get()[dragging.get()];
      if (dragging.get() < 0 || !slot) return;
      const target = hitDrop(drops.get(), x, y);
      lift.set(1);
      if (target !== "" || k === 0) {
        dx.set(0);
        dy.set(0);
        dragging.set(-1);
        if (target !== "") scheduleOnRN(onDrop, slot.id, target);
        else scheduleOnRN(select, null);
        return;
      }
      dx.set(withTiming(0, returnTiming));
      dy.set(
        // Finished or cut short by a new touch, the lifted card is put down.
        withTiming(0, returnTiming, () => {
          dragging.set(-1);
          scheduleOnRN(select, null);
        }),
      );
    },
    [slots, dragging, drops, lift, dx, dy, k, returnTiming, onDrop, select],
  );

  const liftTransform = useDerivedValue(() => [{ translateX: dx.get() }, { translateY: dy.get() }, { scale: lift.get() }]);

  // Built once per set of callbacks, not on every render. The worklets read the shared values, never React state.
  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .minDistance(6)
      // A new touch cancels a return still in progress: the card snaps home.
      .onBegin(() => {
        cancelAnimation(dx);
        cancelAnimation(dy);
        cancelAnimation(lift);
        finishMotions(hurryProgress, hurryClear);
        swallow.set(live.get());
        dx.set(0);
        dy.set(0);
        lift.set(1);
        if (dragging.get() >= 0) scheduleOnRN(select, null);
        dragging.set(-1);
      })
      // The drag starts once the finger has moved; a tap never lifts a card. The card is the one under the first touch.
      .onStart((event) => {
        const at = hitSlot(slots.get(), event.x - event.translationX, event.y - event.translationY);
        const slot = slots.get()[at];
        if (at < 0 || !slot || !lifts.get()[at] || swallow.get()) {
          dragging.set(-1);
          return;
        }
        dragging.set(at);
        dx.set(event.translationX);
        dy.set(event.translationY);
        lift.set(k === 0 ? 1.08 : withTiming(1.08, liftTiming));
        scheduleOnRN(select, slot.id);
      })
      .onUpdate((event) => {
        if (dragging.get() < 0) return;
        dx.set(event.translationX);
        dy.set(event.translationY);
      })
      .onEnd((event) => release(event.x, event.y));

    const tap = Gesture.Tap().onEnd((event) => {
      const slot = slots.get()[hitSlot(slots.get(), event.x, event.y)];
      if (slot && !swallow.get()) scheduleOnRN(onTap, slot.id);
    });

    // Held still past the press delay, a face-up card on the table opens large; a discard pile opens its list. On the hand the
    // scrub gets there first (150 ms), and its release opens the same preview.
    const hold = Gesture.LongPress()
      .minDuration(350)
      .onStart((event) => {
        const slot = slots.get()[hitSlot(slots.get(), event.x, event.y)];
        if (!slot || swallow.get()) return;
        if (slot.kind === "pile") scheduleOnRN(onTap, slot.id);
        else if (!slot.faceDown || slot.held) scheduleOnRN(onPreview, slot.id);
      });

    // A press on the hand held still for 150 ms (a move of more than the slop before it fails this and is a drag) raises and
    // spreads the hand; the finger then slides along it. A press anywhere else fails here at once, so the 350 ms press and the tap
    // are untouched. A scrub never starts for the touch that skipped a spotlight.
    const scrub = Gesture.Pan()
      .activateAfterLongPress(SCRUB_HOLD_MS)
      .minDistance(SCRUB_SLOP)
      .maxPointers(1)
      .onTouchesDown((event, manager) => {
        const touch = event.allTouches[0];
        if (!touch || !startsScrub(spreadNow.get(), slots.get(), touch.x, touch.y, hitSlot(slots.get(), touch.x, touch.y))) manager.fail();
      })
      .onStart((event) => {
        carrying.set(false);
        const first = startCard(spreadNow.get(), slots.get(), event.x, event.y);
        if (swallow.get() || first < 0) return;
        scrubbing.set(true);
        cancelAnimation(rise);
        cancelAnimation(apart);
        rise.set(k === 0 ? 1 : withTiming(1, riseTiming));
        apart.set(k === 0 ? 1 : withTiming(1, apartTiming));
        lifting(first);
        // The press was held still on the card to start the scrub, so it has rested there already: a push up plays it at once.
        rest.set(restAt(event.x, event.y, scrubClock() - SCRUB_REST_MS));
        begun.set(true);
        scheduleOnRN(onScrub, first, true, true);
      })
      .onUpdate((event) => {
        if (carrying.get()) {
          dx.set(event.x - grabX.get());
          dy.set(event.y - grabY.get());
          return;
        }
        if (!scrubbing.get()) return;
        const now = spreadNow.get();
        const under = index.get();
        const moved = restMove(rest.get(), under >= 0 && playable.get()[under] ? under : -1, event.x, event.y, scrubClock());
        rest.set(moved);
        // Pushed forward from a rest on a playable card: the hand settles and the card is picked up, as a drag from the hand picks it
        // up, centred under the finger. Its drop targets come with the selection, as a drag's do.
        const pickedUp = pushed(moved, now, event.x, event.y) ? now.ids[moved.armed] : undefined;
        const at = pickedUp === undefined ? -1 : slots.get().findIndex((slot) => slot.id === pickedUp && slot.kind === "card");
        const home = slots.get()[at];
        if (home && pickedUp !== undefined) {
          settle();
          scheduleOnRN(onScrub, -1, false);
          carrying.set(true);
          grabX.set(home.x + home.w / 2);
          grabY.set(home.y + home.h / 2);
          cancelAnimation(dx);
          cancelAnimation(dy);
          dragging.set(at);
          dx.set(event.x - grabX.get());
          dy.set(event.y - grabY.get());
          lift.set(k === 0 ? 1.08 : withTiming(1.08, liftTiming));
          scheduleOnRN(select, pickedUp);
          return;
        }
        // Sliding up past the risen hand without that rest cancels for good; the hand settles back.
        if (cancelled(now, event.y)) {
          settle();
          scheduleOnRN(onScrub, -1, false);
          return;
        }
        // While a push is under way the armed card stays lifted, though the finger drifts toward a neighbour.
        if (moved.armed >= 0) return;
        const next = pick(now, event.x, event.y);
        if (next === under) return;
        lifting(next);
        scheduleOnRN(onScrub, next, true);
      })
      .onEnd((event, success) => {
        // A carried card is dropped like a dragged one; a touch cut short (success false) puts it back.
        if (carrying.get()) {
          carrying.set(false);
          release(success ? event.x : -1, success ? event.y : -1);
          return;
        }
        if (!scrubbing.get()) return;
        const now = spreadNow.get();
        const id = success ? now.ids[pick(now, event.x, event.y)] : undefined;
        settle();
        if (id !== undefined) scheduleOnRN(onPreview, id);
      })
      // However the scrub ended (released, cancelled, or cut short by Back), JavaScript is told it closed, after any move still in flight.
      .onFinalize(() => {
        if (!begun.get()) return;
        begun.set(false);
        scheduleOnRN(onScrub, -1, false);
      });

    return Gesture.Race(pan, ...(scrubOn ? [scrub] : []), hold, tap);
  }, [slots, lifts, spreadNow, playable, rest, carrying, grabX, grabY, dragging, dx, dy, lift, rise, apart, index, scrubbing, begun, k, liftTiming, riseTiming, apartTiming, hurryProgress, hurryClear, swallow, live, scrubOn, settle, lifting, release, select, onTap, onPreview, onScrub]);

  const scrub: Scrub = useMemo(() => ({ rise, apart, lift: scrubLift, index, left, drop, spread }), [rise, apart, scrubLift, index, left, drop, spread]);
  return { gesture, liftTransform, scrub };
}
