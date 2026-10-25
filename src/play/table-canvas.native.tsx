// The table: one Skia canvas, not a view per card (docs/architecture.md, Table), played in landscape. Zustand subscribers
// read the zone and pile slices it draws. A drag, a card lift and the return run on the UI thread with Gesture Handler and
// Reanimated; JavaScript hears about a drag only when a card is picked up (to compute that card's drop targets) and when the
// finger lifts. A tap picks (the screen decides what), a long press previews; neither sends an intent.
//
// When the state changes, each card moves from where it was to where it is now, a new card comes in from its deck or grows
// in, and a card that left goes to its pile (motion.ts). The motion runs on the UI thread, never gates a rule, and snaps
// under reduced motion; a new gesture cancels the lift in progress.
import { Canvas, Circle, Group, matchFont, RoundedRect, Text, useFont, useImage, vec, type SkFont } from "@shopify/react-native-skia";
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { cancelAnimation, Easing, useDerivedValue, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useStore } from "zustand";

import { Badges, CardBody, CombatMarkView, Leaving, Marks, Moving, Pile, RADIUS, Tokens, withAlpha, type Fonts } from "./canvas-pieces.native.tsx";
import { sphereIcon } from "./icon-map.ts";
import { ICON_FILES } from "./icons/files.generated.ts";
import { hitDrop, hitSlot, tableLayout, type CardSlot, type CombatMark, type DropRect, type LayoutViews, type PileViews, type Rect } from "./layout.ts";
import { motionsBetween, type Ghost, type Motion } from "./motion.ts";
import { PILES, TABLE_ZONES, pileSelector, shownSeat, zoneSelector, type PileId, type ZoneId } from "./selectors.ts";
import { dropRects } from "./selection.ts";
import type { TableCanvasProps } from "./table-canvas-types.ts";
import { useTableImages } from "./table-images.native.ts";
import { tableTokens as t } from "./tokens.ts";

const MARCELLUS = require("../../assets/fonts/Marcellus-Regular.ttf") as number;
const MOVE_MS = 320;

function useViews(store: TableCanvasProps["store"], seat: number): { views: LayoutViews; piles: PileViews } {
  const zones = useMemo(() => Object.fromEntries(TABLE_ZONES.map((zone) => [zone, zoneSelector(zone, seat)])) as Record<ZoneId, ReturnType<typeof zoneSelector>>, [seat]);
  const pileOf = useMemo(() => Object.fromEntries(PILES.map((pile) => [pile, pileSelector(pile, seat)])) as Record<PileId, ReturnType<typeof pileSelector>>, [seat]);
  const questStage = useStore(store, (state) => zones.questStage(state.game));
  const staging = useStore(store, (state) => zones.staging(state.game));
  const activeLocation = useStore(store, (state) => zones.activeLocation(state.game));
  const secondActiveLocation = useStore(store, (state) => zones.secondActiveLocation(state.game));
  const engaged = useStore(store, (state) => zones.engaged(state.game));
  const play = useStore(store, (state) => zones.play(state.game));
  const hand = useStore(store, (state) => zones.hand(state.game));
  const deck = useStore(store, (state) => pileOf.deck(state.game));
  const discard = useStore(store, (state) => pileOf.discard(state.game));
  const encounterDeck = useStore(store, (state) => pileOf.encounterDeck(state.game));
  const encounterDiscard = useStore(store, (state) => pileOf.encounterDiscard(state.game));
  return useMemo(
    () => ({ views: { questStage, staging, activeLocation, secondActiveLocation, engaged, play, hand }, piles: { deck, discard, encounterDeck, encounterDiscard } }),
    [questStage, staging, activeLocation, secondActiveLocation, engaged, play, hand, deck, discard, encounterDeck, encounterDiscard],
  );
}

// A faint word in an empty zone, so the player knows what the space is for.
function ZoneWord({ rect, text, font }: { rect: Rect; text: string; font: SkFont }) {
  return <Text x={rect.x + 6} y={rect.y + 16} text={text} font={font} color={t.faint} />;
}

export function TableCanvas({ store, width, height, picture, pictureRevision, nameOf, sphereOf, inactive, info, highlight, raised, onTap, onPreview, onDrop }: TableCanvasProps) {
  const seat = useStore(store, (state) => shownSeat(state.game));
  const { views, piles } = useViews(store, seat);
  const selected = useStore(store, (state) => state.selected);
  const targets = useStore(store, (state) => state.targets);
  const draggable = useStore(store, (state) => state.draggable);
  const game = useStore(store, (state) => state.game);
  const reduceMotion = useReducedMotion();

  // The top of the deck is a card when the rules let it be played from there (Gandalf, 142002).
  const deckTopId = game.seats[seat]?.deck[0];
  const deckTop = deckTopId && draggable.includes(deckTopId) ? (game.cards[deckTopId] ?? null) : null;
  const defending = useCallback(
    (enemy: { id: string }): CombatMark["kind"] => {
      if (game.pendingStrike?.enemyId === enemy.id) return "attack";
      const attack = game.pendingAttack;
      return attack?.enemyId === enemy.id && (attack.undefended || attack.defenderId == null) ? "undefended" : "defense";
    },
    [game.pendingAttack, game.pendingStrike],
  );
  const layout = useMemo(() => tableLayout(width, height, views, piles, { raised, deckTop }, defending), [width, height, views, piles, raised, deckTop, defending]);

  // Each new layout: where every card comes from, and the cards that left, worked out once, before it is drawn. The layout
  // the motions were worked out for is kept as state, so a new one is noticed during the render (React's pattern for state
  // that follows a prop), and `at` counts the layouts.
  const [track, setTrack] = useState(() => ({ layout, moves: { ...motionsBetween(null, layout, () => null), at: 1 } }));
  if (track.layout !== layout) {
    const zoneNow = (cardId: string) => game.cards[cardId]?.zone ?? null;
    const sameSize = track.layout.width === layout.width && track.layout.height === layout.height;
    const between = reduceMotion || !sameSize ? motionsBetween(null, layout, zoneNow) : motionsBetween(track.layout, layout, zoneNow);
    setTrack({ layout, moves: { ...between, at: track.moves.at + 1 } });
  }
  const moves = track.moves;
  const progress = useSharedValue(1);
  const epoch = useSharedValue(0);
  useLayoutEffect(() => {
    epoch.set(moves.at);
    if (reduceMotion) {
      progress.set(1);
      return;
    }
    progress.set(0);
    progress.set(withTiming(1, { duration: MOVE_MS, easing: Easing.out(Easing.cubic) }));
  }, [moves, progress, epoch, reduceMotion]);

  const codes = useMemo(() => [...new Set([...layout.slots, ...moves.ghosts.map((ghost) => ghost.slot)].filter((slot) => !slot.faceDown && slot.code !== "").map((slot) => slot.code))], [layout, moves]);
  const images = useTableImages(codes, picture, layout.card, pictureRevision);
  const tokens = { resource: useImage(ICON_FILES.resource), damage: useImage(ICON_FILES.damage), progress: useImage(ICON_FILES.progress) };
  // Names and small words in the system face; numbers in the embedded Marcellus (the system face stands in for the moment
  // the font file takes to load).
  const names = useMemo(() => matchFont({ fontFamily: Platform.select({ ios: "Helvetica", default: "sans-serif" }), fontSize: 11 }), []);
  const small = useMemo(() => matchFont({ fontFamily: Platform.select({ ios: "Helvetica", default: "sans-serif" }), fontSize: 10, fontWeight: "bold" }), []);
  const marcellus = useFont(MARCELLUS, 12);
  const fonts: Fonts = { names, numbers: marcellus ?? names, small };

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
  const lifted = selected ? (layout.slots.find((slot) => slot.id === selected && slot.kind === "card") ?? null) : null;
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
        dx.set(0);
        dy.set(0);
        lift.set(1);
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
          // The drop picks; the dock asks to confirm it. The card is drawn where the next state puts it.
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
          // Finished or cut short by a new touch, the lifted card is put down.
          withTiming(0, { duration: 160 }, () => {
            dragging.set(-1);
            scheduleOnRN(select, null);
          }),
        );
      });

    const tap = Gesture.Tap().onEnd((event) => {
      const slot = slots.get()[hitSlot(slots.get(), event.x, event.y)];
      if (slot) scheduleOnRN(onTap, slot.id);
    });

    // Held still past the press delay, a face-up card opens large; a discard pile opens its list.
    const hold = Gesture.LongPress()
      .minDuration(350)
      .onStart((event) => {
        const slot = slots.get()[hitSlot(slots.get(), event.x, event.y)];
        if (!slot) return;
        if (slot.kind === "pile") scheduleOnRN(onTap, slot.id);
        else if (!slot.faceDown) scheduleOnRN(onPreview, slot.id);
      });

    return Gesture.Race(pan, hold, tap);
  }, [slots, lifts, drops, dragging, dx, dy, lift, reduceMotion, select, onDrop, onTap, onPreview]);

  const targetIds = useMemo(() => new Set(targets.flatMap((target) => (target.kind === "card" ? [target.cardId] : []))), [targets]);
  const targetZones = useMemo(() => targets.flatMap((target) => (target.kind === "zone" ? [layout.zones[target.zone]] : [])), [targets, layout]);

  const drawSlot = (slot: CardSlot, dim: boolean) => {
    const image = images.get(slot.code) ?? null;
    if (slot.kind === "pile") return <Pile slot={slot} image={image} fonts={fonts} label />;
    // The top of the deck the rules let the player play (Gandalf): the pile, face up, picked like a hand card.
    if (slot.zone === "deck") {
      return (
        <Group opacity={dim ? 0.35 : 1}>
          <Pile slot={{ ...slot, faceDown: false }} image={image} fonts={fonts} label />
          <Marks slot={slot} tappable={highlight.tappable.has(slot.id) || targetIds.has(slot.id)} picked={highlight.picked.get(slot.id) ?? 0} share={highlight.share} fonts={fonts} />
        </Group>
      );
    }
    const encounterBack = slot.kind === "shadow" || slot.zone === "staging" || slot.zone === "engaged" || slot.zone === "encounterDeck";
    const slotInfo = slot.kind === "card" && !slot.faceDown && slot.zone !== "hand" ? info(slot.id) : null;
    return (
      <Group opacity={dim ? 0.35 : 1}>
        <CardBody slot={slot} image={image} name={nameOf(slot.code)} sphere={sphereIcon(sphereOf(slot.code))} fonts={fonts} inactive={!slot.faceDown && inactive(slot.code)} encounterBack={encounterBack} />
        {slotInfo ? <Badges slot={slot} effects={slotInfo.effects} willpower={slotInfo.willpower} questPoints={slotInfo.questPoints} fonts={fonts} /> : null}
        <Tokens slot={slot} images={tokens} fonts={fonts} />
        {slot.kind === "card" ? <Marks slot={slot} tappable={highlight.tappable.has(slot.id) || targetIds.has(slot.id)} picked={highlight.picked.get(slot.id) ?? 0} share={highlight.share} fonts={fonts} /> : null}
      </Group>
    );
  };

  const still: Motion = { dx: 0, dy: 0, scale: 1, fromRot: 0, toRot: 0, fromOpacity: 1 };
  const emptyWords: [Rect, string][] = [
    ...(views.staging.entries.length === 0 ? [[layout.zones.staging, "Staging"] as [Rect, string]] : []),
    ...(views.engaged.entries.length === 0 ? [[layout.zones.engaged, "No enemy engaged"] as [Rect, string]] : []),
    ...(views.activeLocation.entries.length === 0 ? [[layout.zones.activeLocation, "No location"] as [Rect, string]] : []),
  ];

  return (
    <GestureDetector gesture={gesture}>
      <Canvas style={{ width, height }}>
        <RoundedRect x={0} y={0} width={width} height={height} r={0} color={t.felt} />
        <Circle cx={width / 2} cy={height * 0.45} r={Math.max(width, height) * 0.55} color={t.feltLight} opacity={0.55} />
        {/* The engagement area is a band of its own, between staging and the player's cards. */}
        <RoundedRect x={layout.zones.engaged.x - 4} y={layout.zones.engaged.y - 3} width={layout.zones.engaged.w + 8} height={layout.zones.engaged.h + 6} r={RADIUS * 2} color={withAlpha(t.threat, 0.07)} />
        {emptyWords.map(([rect, text]) => (
          <ZoneWord key={text} rect={rect} text={text} font={fonts.small} />
        ))}
        {targetZones.map((rect, index) => (
          <RoundedRect key={`z${index}`} x={rect.x - 4} y={rect.y - 4} width={rect.w + 8} height={rect.h + 8} r={RADIUS * 2} color={t.gold} style="stroke" strokeWidth={1.5} />
        ))}
        {moves.ghosts.map((ghost: Ghost) => (
          <Leaving key={`ghost:${ghost.slot.id}:${moves.at}`} ghost={ghost} progress={progress} epoch={epoch} at={moves.at}>
            {drawSlot(ghost.slot, false)}
          </Leaving>
        ))}
        {layout.slots.map((slot) => (
          <Moving key={`${slot.kind}:${slot.id}`} slot={slot} motion={moves.motions.get(slot.id) ?? still} progress={progress} epoch={epoch} at={moves.at}>
            {drawSlot(slot, lifted?.id === slot.id && slot.kind === "card")}
          </Moving>
        ))}
        {layout.marks.map((mark) => (
          <CombatMarkView key={`mark:${mark.enemyId}`} mark={mark} />
        ))}
        {lifted ? (
          <Group transform={liftTransform} origin={vec(lifted.x + lifted.w / 2, lifted.y + lifted.h / 2)}>
            <CardBody slot={{ ...lifted, tilt: 0, exhausted: false }} image={images.get(lifted.code) ?? null} name={nameOf(lifted.code)} sphere={sphereIcon(sphereOf(lifted.code))} fonts={fonts} inactive={inactive(lifted.code)} encounterBack={false} />
            <RoundedRect x={lifted.x} y={lifted.y} width={lifted.w} height={lifted.h} r={RADIUS} color={t.gold} style="stroke" strokeWidth={2} />
          </Group>
        ) : null}
      </Canvas>
    </GestureDetector>
  );
}
