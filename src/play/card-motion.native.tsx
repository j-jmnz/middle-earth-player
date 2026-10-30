// The canvas's card motion (docs/design-system.md, Table, Motion; phase 23): when the table changes, each card moves from where it was,
// a drawn card flips and rises on an arc, a played card lifts and lands with a squash, and a card that left shakes and shrinks to
// its pile. motion.ts says what each card does and motion-pose.ts works the pose out of one clock; this file runs that clock on the
// UI thread and draws the cards through it. The canvas still draws only when what it shows changes: the clock runs for one state
// and stops, and there is no idle loop. A touch on the canvas finishes it at once (finishMotions); it never delays an intent.
// A state with a combat spotlight (spotlight-gate.ts) waits for it: its cards stand where they were under the spotlight's enlarged
// copies, and its clocks start when the spotlight ends (or are set to the end when a tap skipped it).
import { Group, vec } from "@shopify/react-native-skia";
import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cancelAnimation, useAnimatedReaction, useDerivedValue, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useStore } from "zustand";

import type { ScenarioState } from "../rules/state.ts";
import type { Clash } from "./clash.ts";
import { cardFrame } from "./frame.ts";
import { tickLand } from "./haptics.ts";
import type { CardSlot, TableLayout } from "./layout.ts";
import { easingOf, useMotionScale } from "./motion-run.ts";
import { ghostPoseAt, landAt, motionEnd, motionSpan, poseAt } from "./motion-pose.ts";
import { kindMoves, motionKind } from "./motion-kind.ts";
import { UpdateLog } from "./update-log.ts";
import { motionsBetween, slotRotation, still, type Ghost, type Motion } from "./motion.ts";
import type { TableStore } from "./store.ts";
import { fxPlan, fxSpan, type Fx } from "./token-fx.ts";
import { tokenDeltas } from "./token-deltas.ts";
import { useSpotlightHold } from "./use-spotlight.ts";

/** What one state's motion is: the cards' motions, the cards that left, the token changes, and which state it is (`at`). */
export type Moves = { motions: ReadonlyMap<string, Motion>; ghosts: readonly Ghost[]; fx: readonly Fx[]; at: number };

/**
 * One state's clock. `progress` runs 0 to 1 over `span` ms (already scaled), `epoch` is the state the UI thread has caught up with
 * (until it has, a slot is drawn where it starts, not where it ends), `k` is the motion scale.
 */
export type Clock = { progress: SharedValue<number>; epoch: SharedValue<number>; at: number; k: number; span: number };

/**
 * A touch on the canvas finishes the running card motions at once: their progress is set to 1, which jumps past the landing and so plays
 * no landing tick (the reaction in `useCardMotion` ticks only as the clock passes the landing, never for a jump to the end), so no haptic
 * follows a card that was snapped into place. `clear` (on the JavaScript thread) also skips a combat spotlight that is playing. The token pops and floating numbers have a clock of their own and keep running.
 */
export function finishMotions(progress: SharedValue<number>, clear: () => void): void {
  "worklet";
  cancelAnimation(progress);
  progress.set(1);
  scheduleOnRN(clear);
}

// `actingLayout`: the last layout drawn from the acting seat's side, which a peek that ends with a new state is diffed from (motion-kind.ts).
type Track = { layout: TableLayout; actingLayout: TableLayout; seat: number; acting: number; moves: Moves; span: number; fxSpan: number };

// The track for a new layout: how its cards move, and the token changes. `log` is read here, not in the hook, because what it holds changes
// without a render; every call is for a layout no call has seen, so the compiler's cache never answers with a stale update.
function nextTrack(track: Track, layout: TableLayout, seat: number, acting: number, k: number, held: boolean, game: ScenarioState, clashes: readonly Clash[], log: UpdateLog): Track {
  const prevGame = log.pending()?.prev ?? game;
  const zoneNow = (cardId: string) => game.cards[cardId]?.zone ?? null;
  // The seat handoff, the state's own motions, or a peek, which is drawn at rest (motion-kind.ts). A peek that ends with a new state is
  // diffed from the layout the acting seat had, so a card played from its hand still lifts and lands and a drawn one is still dealt.
  const kind = motionKind(prevGame, game, track.seat, seat, track.acting, acting);
  const from = kind === "ordinary" && track.seat !== seat ? track.actingLayout : track.layout;
  const sameSize = from.width === layout.width && from.height === layout.height;
  const animate = k > 0 && sameSize && kindMoves(kind);
  const between = animate ? motionsBetween(from, layout, zoneNow, { handoff: kind === "handoff" }) : motionsBetween(null, layout, zoneNow);
  // A token pops once its card has arrived; a card off the table shows none. The damage a spotlight's attacks placed pops in the
  // spotlight, at the end of its burst, so the state's own pop leaves out that much of the change (archery or an effect's damage on
  // the same card keeps its pop and its number).
  const placed = new Map<string, number>();
  if (held) for (const clash of clashes) placed.set(clash.target, (placed.get(clash.target) ?? 0) + clash.damage);
  const deltas = (kind === "peek" ? [] : tokenDeltas(prevGame, game)).flatMap((delta) => {
    const change = delta.change - (delta.token === "damage" ? (placed.get(delta.cardId) ?? 0) : 0);
    return change === 0 ? [] : [{ ...delta, change }];
  });
  const fx = animate
    ? fxPlan(deltas, (cardId) => {
        const slot = layout.slots.find((candidate) => candidate.id === cardId && candidate.kind !== "pile");
        const motion = slot ? between.motions.get(slot.id) : undefined;
        return slot ? (motion && !still(motion) ? motionEnd(motion) : 0) : null;
      })
    : [];
  return { layout, actingLayout: seat === acting ? layout : track.actingLayout, seat, acting, moves: { ...between, fx, at: track.moves.at + 1 }, span: animate ? motionSpan(between) : 0, fxSpan: animate ? fxSpan(fx) : 0 };
}

/**
 * Works out the motion of each new layout once, during the render (React's pattern for state that follows a prop), and runs the
 * clock for it. With the scale at 0 (reduced motion), or when the canvas changed size, nothing moves and the clock is done.
 */
export function useCardMotion(store: TableStore, layout: TableLayout, seat: number, acting: number): { moves: Moves; clock: Clock; fxClock: Clock; k: number; hurry: { progress: SharedValue<number>; clear: () => void } } {
  const k = useMotionScale();
  const held = useSpotlightHold(store);
  // The state and the attacks a new layout is drawn from, taken from the store here so the compiler sees them as dependencies.
  const game = useStore(store, (state) => state.game);
  const gate = useStore(store, (state) => state.spotlight);
  const [track, setTrack] = useState<Track>(() => ({ layout, actingLayout: layout, seat, acting, moves: { ...motionsBetween(null, layout, () => null), fx: [], at: 1 }, span: 0, fxSpan: 0 }));
  // What moved this layout: each update of the store is used by the first new layout after it (update-log.ts).
  const [log] = useState(() => new UpdateLog(store.getState().game));
  useEffect(() => store.subscribe((state, before) => log.note(state, before)), [store, log]);
  if (track.layout !== layout) setTrack(nextTrack(track, layout, seat, acting, k, held, game, gate.clashes, log));
  const { moves, span } = track;
  const progress = useSharedValue(1);
  const fxProgress = useSharedValue(1);
  const epoch = useSharedValue(0);
  const scaled = Math.ceil(span * k);
  const fxScaled = Math.ceil(track.fxSpan * k);
  // A touch: a spotlight that is playing is skipped (the clock jumping to its end drops the landing tick, below).
  const clear = useCallback(() => {
    store.getState().endSpotlight("skipped");
  }, [store]);
  // The state a spotlight is holding: its clocks wait at 0, so its cards stand where they were.
  const waiting = useRef<number | null>(null);
  // The clocks' lengths, read when a new state starts; a change of either alone does not start the effect.
  const speed = useEffectEvent(() => ({ scaled, fxScaled }));
  // Once per new state: start its clock. A change of the speed setting alone does not
  // play the last state again. A state held for a spotlight starts when the spotlight ends; a skipped one lands at once.
  useLayoutEffect(() => {
    const { scaled, fxScaled } = speed();
    log.consume();
    epoch.set(moves.at);
    cancelAnimation(progress);
    cancelAnimation(fxProgress);
    if (held) {
      waiting.current = moves.at;
      progress.set(0);
      fxProgress.set(0);
      return;
    }
    const landed = waiting.current === moves.at && store.getState().spotlight.ended === "skipped";
    waiting.current = null;
    if (landed) {
      progress.set(1);
      fxProgress.set(1);
      return;
    }
    fxProgress.set(fxScaled === 0 ? 1 : 0);
    if (fxScaled > 0) fxProgress.set(withTiming(1, { duration: fxScaled, easing: easingOf("linear") }));
    if (scaled === 0) {
      progress.set(1);
      return;
    }
    progress.set(0);
    progress.set(withTiming(1, { duration: scaled, easing: easingOf("linear") }));
  }, [moves, held, progress, fxProgress, epoch, log, store]);
  // The tick of a played card's landing, as the clock passes it (the same moment the squash begins): `landing` ms after the state was
  // drawn at the motion scale, if the state plays and a card played from the hand lands in it. None when the state snaps (reduced motion:
  // `scaled` is 0), or waits for a spotlight (the clock stays at 0 until it ends), or the clock is set past the landing (a touch's hurry or
  // a skipped spotlight: it jumps to the end, and a jump is not a pass); a new state replaces this reaction and its landing.
  const landing = landAt(moves.motions);
  const landMs = scaled === 0 || landing == null ? null : landing * k;
  useAnimatedReaction(
    () => progress.get() * scaled,
    (now, was) => {
      if (landMs == null || was == null || now <= was || now >= scaled) return;
      if (was < landMs && now >= landMs) scheduleOnRN(tickLand);
    },
    [landMs, scaled],
  );
  const clock = useMemo((): Clock => ({ progress, epoch, at: moves.at, k, span: Math.max(1, scaled) }), [progress, epoch, moves.at, k, scaled]);
  const fxClock = useMemo((): Clock => ({ progress: fxProgress, epoch, at: moves.at, k, span: Math.max(1, fxScaled) }), [fxProgress, epoch, moves.at, k, fxScaled]);
  const hurry = useMemo(() => ({ progress, clear }), [progress, clear]);
  return { moves, clock, fxClock, k, hurry };
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
