// The canvas's card motion (docs/design-system.md, Table, Motion; phase 23): when the table changes, each card moves from where it was,
// a drawn card flips and rises on an arc, a played card lifts and lands with a squash, and a card that left shakes and shrinks to
// its pile. motion.ts says what each card does and motion-pose.ts works the pose out of one clock; this file runs that clock on the
// UI thread and draws the cards through it. The canvas still draws only when what it shows changes: the clock runs for one state
// and stops, and there is no idle loop. A touch on the canvas finishes it at once (finishMotions); it never delays an intent.
import { Group, vec } from "@shopify/react-native-skia";
import { useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import { cancelAnimation, useDerivedValue, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";

import { cardFrame } from "./frame.ts";
import { tickLand } from "./haptics.ts";
import type { CardSlot, TableLayout } from "./layout.ts";
import { easingOf, useMotionScale } from "./motion-run.ts";
import { ghostPoseAt, landAt, motionEnd, motionSpan, poseAt } from "./motion-pose.ts";
import { motionsBetween, slotRotation, still, type Ghost, type Motion } from "./motion.ts";
import type { ScenarioState, TableStore } from "./store.ts";
import { fxPlan, fxSpan, type Fx } from "./token-fx.ts";
import { tokenDeltas } from "./token-deltas.ts";

/** What one state's motion is: the cards' motions, the cards that left, the token changes, and which state it is (`at`). */
export type Moves = { motions: ReadonlyMap<string, Motion>; ghosts: readonly Ghost[]; fx: readonly Fx[]; at: number };

/**
 * One state's clock. `progress` runs 0 to 1 over `span` ms (already scaled), `epoch` is the state the UI thread has caught up with
 * (until it has, a slot is drawn where it starts, not where it ends), `k` is the motion scale.
 */
export type Clock = { progress: SharedValue<number>; epoch: SharedValue<number>; at: number; k: number; span: number };

/** A touch on the canvas finishes the running card motions at once: their progress is set to 1. */
export function finishMotions(progress: SharedValue<number>): void {
  "worklet";
  cancelAnimation(progress);
  progress.set(1);
}

type Track = { layout: TableLayout; seat: number; counts: ScenarioState; moves: Moves; span: number };

/**
 * Works out the motion of each new layout once, during the render (React's pattern for state that follows a prop), and runs the
 * clock for it. With the scale at 0 (reduced motion), or when the canvas changed size, nothing moves and the clock is done.
 */
export function useCardMotion(store: TableStore, layout: TableLayout, seat: number): { moves: Moves; clock: Clock; k: number } {
  const k = useMotionScale();
  const [track, setTrack] = useState<Track>(() => ({ layout, seat, counts: store.getState().game, moves: { ...motionsBetween(null, layout, () => null), fx: [], at: 1 }, span: 0 }));
  if (track.layout !== layout) {
    const game = store.getState().game;
    const zoneNow = (cardId: string) => game.cards[cardId]?.zone ?? null;
    const sameSize = track.layout.width === layout.width && track.layout.height === layout.height;
    const animate = k > 0 && sameSize;
    // The acting seat changed: its hand slides up into place, and nothing is dealt.
    const between = animate ? motionsBetween(track.layout, layout, zoneNow, { handoff: seat !== track.seat }) : motionsBetween(null, layout, zoneNow);
    // A token pops once its card has arrived; a card off the table shows none.
    const fx = animate
      ? fxPlan(tokenDeltas(track.counts, game), (cardId) => {
          const slot = layout.slots.find((candidate) => candidate.id === cardId && candidate.kind !== "pile");
          const motion = slot ? between.motions.get(slot.id) : undefined;
          return slot ? (motion && !still(motion) ? motionEnd(motion) : 0) : null;
        })
      : [];
    const span = animate ? Math.max(motionSpan(between), fxSpan(fx)) : 0;
    setTrack({ layout, seat, counts: game, moves: { ...between, fx, at: track.moves.at + 1 }, span });
  }
  const { moves, span } = track;
  const progress = useSharedValue(1);
  const epoch = useSharedValue(0);
  const scaled = Math.ceil(span * k);
  // Once per new state: start its clock, and time the tick of a played card's landing. A change of the speed setting alone does not
  // play the last state again.
  useLayoutEffect(() => {
    epoch.set(moves.at);
    cancelAnimation(progress);
    if (scaled === 0) {
      progress.set(1);
      return;
    }
    progress.set(0);
    progress.set(withTiming(1, { duration: scaled, easing: easingOf("linear") }));
    const landing = landAt(moves.motions);
    const timer = landing == null ? null : setTimeout(tickLand, landing * k);
    return () => {
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the clock starts for a new state (`moves`), not for a new speed.
  }, [moves, progress, epoch]);
  const clock = useMemo((): Clock => ({ progress, epoch, at: moves.at, k, span: Math.max(1, scaled) }), [progress, epoch, moves.at, k, scaled]);
  return { moves, clock, k };
}

/**
 * A slot in its place or moving into it. A card that does not move is drawn plain. One that does is posed by `poseAt` from the
 * clock: where it is, how big, how turned, how visible, and, for a flip, turned about its own axis showing its printed `back` until
 * the midpoint. The card turns (exhausted, the hand's fan) with its `frame` (the halo, edge, veil and beat ring, in
 * card-marks.native.tsx); `overlay` (tokens, effects, the check ring) moves with it but stays upright.
 */
export function Moving({ slot, motion, clock, children, back, frame, overlay }: { slot: CardSlot; motion: Motion; clock: Clock; children: ReactNode; back?: ReactNode; frame?: ReactNode; overlay?: ReactNode }) {
  if (still(motion)) {
    const { cx, cy } = cardFrame(slot);
    return (
      <Group>
        <Group transform={[{ rotate: slotRotation(slot) }]} origin={vec(cx, cy)}>
          {children}
          {frame}
        </Group>
        {overlay}
      </Group>
    );
  }
  return (
    <Live slot={slot} motion={motion} clock={clock} back={back} frame={frame} overlay={overlay}>
      {children}
    </Live>
  );
}

function Live({ slot, motion, clock, children, back, frame, overlay }: { slot: CardSlot; motion: Motion; clock: Clock; children: ReactNode; back?: ReactNode; frame?: ReactNode; overlay?: ReactNode }) {
  const { cx, cy } = cardFrame(slot);
  const origin = vec(cx, cy);
  const { progress, epoch, at, k, span } = clock;
  const pose = useDerivedValue(() => poseAt(motion, epoch.get() === at ? progress.get() * span : 0, k), [motion, at, k, span]);
  const transform = useDerivedValue(() => [{ translateX: pose.get().dx }, { translateY: pose.get().dy }, { scale: pose.get().scale }]);
  const turn = useDerivedValue(() => [{ rotate: pose.get().rot }, { scaleX: pose.get().flipX }]);
  const opacity = useDerivedValue(() => pose.get().opacity);
  const faceOpacity = useDerivedValue(() => (pose.get().back ? 0 : 1));
  const backOpacity = useDerivedValue(() => (pose.get().back ? 1 : 0));
  return (
    <Group transform={transform} origin={origin} opacity={opacity}>
      <Group transform={turn} origin={origin}>
        {back ? (
          <>
            <Group opacity={faceOpacity}>{children}</Group>
            <Group opacity={backOpacity}>{back}</Group>
          </>
        ) : (
          children
        )}
        {frame}
      </Group>
      {/* What is written on the face (tokens, effect pills) shows with the face. */}
      {back ? <Group opacity={faceOpacity}>{overlay}</Group> : overlay}
    </Group>
  );
}

/** A card that left the table: it shakes if it was destroyed or discarded, then shrinks and fades toward its pile. */
export function Leaving({ ghost, clock, children }: { ghost: Ghost; clock: Clock; children: ReactNode }) {
  const { cx, cy } = cardFrame(ghost.slot);
  const { progress, epoch, at, k, span } = clock;
  const pose = useDerivedValue(() => ghostPoseAt(ghost, epoch.get() === at ? progress.get() * span : 0, k), [ghost, at, k, span]);
  const transform = useDerivedValue(() => [{ translateX: pose.get().dx }, { translateY: pose.get().dy }, { scale: pose.get().scale }, { rotate: ghost.rot }]);
  const opacity = useDerivedValue(() => pose.get().opacity);
  return (
    <Group transform={transform} origin={vec(cx, cy)} opacity={opacity}>
      {children}
    </Group>
  );
}
