// The table: one Skia canvas, not a view per card (docs/architecture.md, Table). Zustand subscribers read the zone slices
// it draws. A drag, a card lift and the return run on the UI thread with Gesture Handler and Reanimated; JavaScript hears
// about a drag only when a card is picked up (to compute that card's drop targets) and when the finger lifts (to ask the
// reducer). A new gesture cancels the return in progress; reduced motion snaps it.
import { Canvas, Circle, Group, Image, matchFont, Rect, RoundedRect, Text, type SkFont, type SkImage, vec } from "@shopify/react-native-skia";
import { useCallback, useEffect, useMemo } from "react";
import { Platform } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { cancelAnimation, useDerivedValue, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useStore } from "zustand";

import { hitDrop, hitSlot, tableLayout, type CardSlot, type DropRect, type LayoutViews } from "./layout.ts";
import { TABLE_ZONES, shownSeat, zoneSelector, type ZoneId } from "./selectors.ts";
import { dropRects } from "./selection.ts";
import type { TableCanvasProps } from "./table-canvas-types.ts";
import { useTableImages } from "./table-images.native.ts";
import { tableTokens as t } from "./tokens.ts";

const RADIUS = 6;
const COIN = 10;

function useViews(store: TableCanvasProps["store"], seat: number): LayoutViews {
  const selectors = useMemo(() => Object.fromEntries(TABLE_ZONES.map((zone) => [zone, zoneSelector(zone, seat)])) as Record<ZoneId, ReturnType<typeof zoneSelector>>, [seat]);
  const questStage = useStore(store, (state) => selectors.questStage(state.game));
  const staging = useStore(store, (state) => selectors.staging(state.game));
  const activeLocation = useStore(store, (state) => selectors.activeLocation(state.game));
  const secondActiveLocation = useStore(store, (state) => selectors.secondActiveLocation(state.game));
  const engaged = useStore(store, (state) => selectors.engaged(state.game));
  const play = useStore(store, (state) => selectors.play(state.game));
  const hand = useStore(store, (state) => selectors.hand(state.game));
  return useMemo(
    () => ({ questStage, staging, activeLocation, secondActiveLocation, engaged, play, hand }),
    [questStage, staging, activeLocation, secondActiveLocation, engaged, play, hand],
  );
}

function Coin({ x, y, color, text, textColor, font }: { x: number; y: number; color: string; text: string; textColor: string; font: SkFont }) {
  const width = font.getTextWidth(text);
  return (
    <Group>
      <Circle cx={x} cy={y} r={COIN} color={color} />
      <Text x={x - width / 2} y={y + 4} text={text} font={font} color={textColor} />
    </Group>
  );
}

// One card: its picture or, while the file is missing, its name on a raised card. Face down is the card back with the ring.
function CardFace({
  slot,
  image,
  name,
  font,
  inactive,
  edge,
  dim,
}: {
  slot: CardSlot;
  image: SkImage | null;
  name: string;
  font: SkFont;
  inactive: boolean;
  edge: string | null;
  dim: boolean;
}) {
  const { x, y, w, h } = slot;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const transform = slot.exhausted ? [{ rotate: Math.PI / 2 }] : slot.tilt !== 0 ? [{ rotate: slot.tilt }] : [];
  return (
    <Group transform={transform} origin={vec(cx, cy)} opacity={dim ? 0.35 : slot.exhausted ? 0.7 : 1}>
      <RoundedRect x={x + 1} y={y + 2} width={w} height={h} r={RADIUS} color="rgba(0,0,0,0.45)" />
      {slot.faceDown ? (
        <Group>
          <RoundedRect x={x} y={y} width={w} height={h} r={RADIUS} color={t.raised} />
          <Circle cx={cx} cy={cy} r={Math.min(w, h) / 4} color={t.gold} style="stroke" strokeWidth={2} />
        </Group>
      ) : image ? (
        <Group clip={{ rect: { x, y, width: w, height: h }, rx: RADIUS, ry: RADIUS }}>
          <Image image={image} x={x} y={y} width={w} height={h} fit="cover" />
          {/* Unique text with no effect record is inactive: the text box is veiled, and no control applies it. */}
          {inactive ? <Rect x={x} y={y + h * 0.55} width={w} height={h * 0.45} color="rgba(10,11,14,0.62)" /> : null}
        </Group>
      ) : (
        <Group>
          <RoundedRect x={x} y={y} width={w} height={h} r={RADIUS} color={t.raised} />
          <Group clip={{ x: x + 3, y: y + 3, width: w - 6, height: h - 6 }}>
            <Text x={x + 5} y={y + 16} text={name} font={font} color={t.bone} />
          </Group>
          {inactive ? <Rect x={x} y={y + h * 0.55} width={w} height={h * 0.45} color="rgba(10,11,14,0.62)" /> : null}
        </Group>
      )}
      {edge ? <RoundedRect x={x} y={y} width={w} height={h} r={RADIUS} color={edge} style="stroke" strokeWidth={2} /> : null}
      {slot.resources > 0 ? <Coin x={x + COIN + 2} y={y + h - COIN - 2} color={t.gold} text={String(slot.resources)} textColor={t.onGold} font={font} /> : null}
      {slot.damage > 0 ? <Coin x={x + w - COIN - 2} y={y + COIN + 2} color={t.threat} text={String(slot.damage)} textColor={t.bone} font={font} /> : null}
      {slot.progress > 0 ? <Coin x={x + w - COIN - 2} y={y + h - COIN - 2} color={t.bone} text={String(slot.progress)} textColor={t.ink} font={font} /> : null}
    </Group>
  );
}

export function TableCanvas({ store, width, height, picture, pictureRevision, nameOf, inactive, onInspect, onDrop }: TableCanvasProps) {
  const seat = useStore(store, (state) => shownSeat(state.game));
  const views = useViews(store, seat);
  const selected = useStore(store, (state) => state.selected);
  const targets = useStore(store, (state) => state.targets);
  const draggable = useStore(store, (state) => state.draggable);
  const pending = useStore(store, (state) => state.pendingCommit);
  const reduceMotion = useReducedMotion();

  const layout = useMemo(() => tableLayout(width, height, views), [width, height, views]);
  const codes = useMemo(() => [...new Set(layout.slots.filter((slot) => !slot.faceDown).map((slot) => slot.code))], [layout]);
  const images = useTableImages(codes, picture, layout.card, pictureRevision);
  const font = useMemo(() => matchFont({ fontFamily: Platform.select({ ios: "Helvetica", default: "sans-serif" }), fontSize: 11 }), []);

  // What the worklets read: the slots, which of them can be picked up, and the selected card's drop rectangles.
  const slots = useSharedValue<readonly CardSlot[]>(layout.slots);
  const lifts = useSharedValue<readonly boolean[]>([]);
  const drops = useSharedValue<readonly DropRect[]>([]);
  const dragging = useSharedValue(-1);
  const dx = useSharedValue(0);
  const dy = useSharedValue(0);
  const lift = useSharedValue(1);

  const draggableSet = useMemo(() => new Set(draggable), [draggable]);
  useEffect(() => {
    slots.set(layout.slots);
    lifts.set(layout.slots.map((slot) => slot.kind === "card" && draggableSet.has(slot.id)));
  }, [layout, draggableSet, slots, lifts]);
  useEffect(() => {
    drops.set(dropRects(layout, targets));
  }, [layout, targets, drops]);

  const select = useCallback((cardId: string | null) => store.getState().select(cardId), [store]);
  const lifted = selected ? layout.slots.find((slot) => slot.id === selected && slot.kind === "card") ?? null : null;
  const liftTransform = useDerivedValue(() => [{ translateX: dx.get() }, { translateY: dy.get() }, { scale: lift.get() }]);

  // Built once per set of callbacks, not on every render. The worklets read the shared values, never React state.
  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .minDistance(6)
      // A new touch cancels a return still in progress: the card snaps home.
      .onBegin(() => {
        cancelAnimation(dx);
        cancelAnimation(dy);
        dx.set(0);
        dy.set(0);
        if (dragging.get() >= 0) scheduleOnRN(select, null);
        dragging.set(-1);
      })
      // The drag starts once the finger has moved; a tap never lifts a card. The card is the one under the first touch.
      .onStart((event) => {
        const index = hitSlot(slots.get(), event.x - event.translationX, event.y - event.translationY);
        const slot = slots.get()[index];
        if (index < 0 || !slot || !lifts.get()[index]) {
          dragging.set(-1);
          return;
        }
        dragging.set(index);
        dx.set(event.translationX);
        dy.set(event.translationY);
        lift.set(reduceMotion ? 1.08 : withTiming(1.08, { duration: 90 }));
        scheduleOnRN(select, slot.id);
      })
      .onUpdate((event) => {
        if (dragging.get() < 0) return;
        dx.set(event.translationX);
        dy.set(event.translationY);
      })
      .onEnd((event) => {
        const slot = slots.get()[dragging.get()];
        if (dragging.get() < 0 || !slot) return;
        const target = hitDrop(drops.get(), event.x, event.y);
        lift.set(1);
        if (target !== "") {
          // The reducer decides; the card is drawn where the next state puts it, or back in place when it refuses.
          scheduleOnRN(onDrop, slot.id, target);
          dx.set(0);
          dy.set(0);
          dragging.set(-1);
          return;
        }
        if (reduceMotion) {
          dx.set(0);
          dy.set(0);
          dragging.set(-1);
          scheduleOnRN(select, null);
          return;
        }
        // Dropped on nothing: the card goes back, and nothing is asked.
        dx.set(withTiming(0, { duration: 160 }));
        dy.set(
          withTiming(0, { duration: 160 }, (finished) => {
            dragging.set(-1);
            if (finished) scheduleOnRN(select, null);
          }),
        );
      });

    const tap = Gesture.Tap().onEnd((event) => {
      const slot = slots.get()[hitSlot(slots.get(), event.x, event.y)];
      if (slot && !slot.faceDown) scheduleOnRN(onInspect, slot.id);
    });

    return Gesture.Race(pan, tap);
  }, [slots, lifts, drops, dragging, dx, dy, lift, reduceMotion, select, onDrop, onInspect]);

  const targetIds = useMemo(() => new Set(targets.flatMap((target) => (target.kind === "card" ? [target.cardId] : []))), [targets]);
  const targetZones = useMemo(() => targets.flatMap((target) => (target.kind === "zone" ? [layout.zones[target.zone]] : [])), [targets, layout]);
  const pendingSet = useMemo(() => new Set(pending), [pending]);

  const edgeOf = (slot: CardSlot): string | null => {
    if (slot.kind !== "card") return null;
    if (targetIds.has(slot.id) || pendingSet.has(slot.id)) return t.gold;
    if (slot.zone === "hand" && draggableSet.has(slot.id)) return t.gold;
    return null;
  };

  return (
    <GestureDetector gesture={gesture}>
      <Canvas style={{ width, height }}>
        <Rect x={0} y={0} width={width} height={height} color={t.felt} />
        <Circle cx={width / 2} cy={height * 0.42} r={Math.max(width, height) * 0.55} color={t.feltLight} opacity={0.55} />
        {targetZones.map((rect, index) => (
          <RoundedRect key={`z${index}`} x={rect.x - 4} y={rect.y - 4} width={rect.w + 8} height={rect.h + 8} r={RADIUS * 2} color={t.goldLine} style="stroke" strokeWidth={1.5} />
        ))}
        {layout.slots.map((slot) => (
          <CardFace
            key={`${slot.kind}:${slot.id}`}
            slot={slot}
            image={images.get(slot.code) ?? null}
            name={nameOf(slot.code)}
            font={font}
            inactive={!slot.faceDown && inactive(slot.code)}
            edge={edgeOf(slot)}
            dim={lifted?.id === slot.id && slot.kind === "card"}
          />
        ))}
        {lifted ? (
          <Group transform={liftTransform} origin={vec(lifted.x + lifted.w / 2, lifted.y + lifted.h / 2)}>
            <CardFace slot={{ ...lifted, tilt: 0 }} image={images.get(lifted.code) ?? null} name={nameOf(lifted.code)} font={font} inactive={inactive(lifted.code)} edge={t.gold} dim={false} />
          </Group>
        ) : null}
      </Canvas>
    </GestureDetector>
  );
}
