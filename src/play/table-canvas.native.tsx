// The table: one Skia canvas, not a view per card (docs/architecture.md, Table), played in landscape. Zustand subscribers
// read the zone and pile slices it draws. A drag, a card lift and the return run on the UI thread with Gesture Handler and
// Reanimated; JavaScript hears about a drag only when a card is picked up (to compute that card's drop targets) and when the
// finger lifts. A tap picks (the screen decides what), a long press previews; neither sends an intent.
//
// When the state changes, each card moves from where it was to where it is now, a new card comes in from its deck or grows
// in, and a card that left goes to its pile (motion.ts). The motion runs on the UI thread, never gates a rule, and snaps
// under reduced motion; a new gesture cancels the lift in progress.
import { Canvas, Circle, Group, matchFont, RoundedRect, Text, useFont, useImage, vec, type SkFont } from "@shopify/react-native-skia";
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { cancelAnimation, Easing, useDerivedValue, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useStore } from "zustand";

import { CardMarks, Glow, PickRing } from "./card-marks.native.tsx";
import { AttackerMark, Badges, CardBody, CombatMarkView, DelayedMark, EngagementMark, Leaving, Moving, NotAppliedMark, OptionMarkView, Pile, RADIUS, Tokens, withAlpha, type BackImages, type Fonts, type TokenImages } from "./canvas-pieces.native.tsx";
import { SPHERE_TINT, sphereIcon } from "./icon-map.ts";
import { CARD_BACK_FILES, ICON_FILES } from "./icons/files.generated.ts";
import { hitDrop, hitSlot, slotBounds, tableLayout, type CardSlot, type DropRect, type LayoutViews, type PileViews, type Rect } from "./layout.ts";
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

// The sphere colour a hero's resource token is ringed with: its resources pay for cards of that sphere (rr.resource-match).
function sphereRing(sphere: string | null): string | null {
  const tint = sphere ? SPHERE_TINT[sphere] : undefined;
  return tint && tint !== "faint" ? t[tint] : null;
}

// A faint word in an empty zone, so the player knows what the space is for.
function ZoneWord({ rect, text, font }: { rect: Rect; text: string; font: SkFont }) {
  return <Text x={rect.x + 6} y={rect.y + 16} text={text} font={font} color={t.faint} />;
}

function Table({ store, width, height, picture, pictureRevision, nameOf, sphereOf, inactive, info, highlight, raised, fight, bottomInset, look, onTap, onPreview, onDrop }: TableCanvasProps) {
  const contrast = look?.contrast ?? false;
  const seat = useStore(store, (state) => shownSeat(state.game));
  const { views, piles } = useViews(store, seat);
  const selected = useStore(store, (state) => state.selected);
  const targets = useStore(store, (state) => state.targets);
  const draggable = useStore(store, (state) => state.draggable);
  // Only the slices drawn here: a threat change alone does not draw the table again (docs/architecture.md, State). The
  // effects in play and the attack in progress change the numbers on cards.
  const modifiers = useStore(store, (state) => state.game.modifiers);
  // The shown seat's threat sets which enemies in staging engage it (their marks), and the delayed effects mark cards.
  const threat = useStore(store, (state) => state.game.seats[seat]?.threat ?? 0);
  const delayed = useStore(store, (state) => state.game.delayed);
  const attacker = useStore(store, (state) => state.game.pendingAttack?.enemyId ?? null);
  const deckTopId = useStore(store, (state) => state.game.seats[seat]?.deck[0] ?? null);
  const deckTopCard = useStore(store, (state) => (deckTopId ? (state.game.cards[deckTopId] ?? null) : null));
  const reduceMotion = useReducedMotion();

  // The top of the deck is a card when the rules let it be played from there (Gandalf, 142002).
  const deckTop = deckTopId && draggable.includes(deckTopId) ? deckTopCard : null;
  const layout = useMemo(
    () => tableLayout(width, height, views, piles, { raised, deckTop, attacker, preview: fight, bottomInset }),
    [width, height, views, piles, raised, deckTop, attacker, fight, bottomInset],
  );

  // Each new layout: where every card comes from, and the cards that left, worked out once, before it is drawn. The layout
  // the motions were worked out for is kept as state, so a new one is noticed during the render (React's pattern for state
  // that follows a prop), and `at` counts the layouts.
  const [track, setTrack] = useState(() => ({ layout, moves: { ...motionsBetween(null, layout, () => null), at: 1 } }));
  if (track.layout !== layout) {
    const cards = store.getState().game.cards;
    const zoneNow = (cardId: string) => cards[cardId]?.zone ?? null;
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
  const tokens: TokenImages = {
    resource: useImage(ICON_FILES.resource),
    damage: useImage(ICON_FILES.damage),
    progress: useImage(ICON_FILES.progress),
    questPoints: useImage(ICON_FILES.questPoints),
    engagementCost: useImage(ICON_FILES.engagementCost),
  };
  const backs: BackImages = { player: useImage(CARD_BACK_FILES.player), encounter: useImage(CARD_BACK_FILES.encounter) };
  // Names and small words in the system face; numbers in the embedded Marcellus (the system face stands in for the moment
  // the font file takes to load).
  const names = useMemo(() => matchFont({ fontFamily: Platform.select({ ios: "Helvetica", default: "sans-serif" }), fontSize: 11 }), []);
  const small = useMemo(() => matchFont({ fontFamily: Platform.select({ ios: "Helvetica", default: "sans-serif" }), fontSize: 10, fontWeight: "bold" }), []);
  const badge = useMemo(() => matchFont({ fontFamily: Platform.select({ ios: "Helvetica", default: "sans-serif" }), fontSize: 11, fontWeight: "bold" }), []);
  const marcellus = useFont(MARCELLUS, 12);
  const fonts: Fonts = { names, numbers: marcellus ?? names, small, badge };

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

  const isTappable = (slot: CardSlot) => highlight.tappable.has(slot.id) || targetIds.has(slot.id);
  const pickedCount = (slot: CardSlot) => highlight.picked.get(slot.id) ?? 0;
  const dimmed = (slot: CardSlot) => (highlight.dimOthers && !isTappable(slot) && pickedCount(slot) === 0) || highlight.muted.has(slot.id);

  // The card itself (it turns when exhausted), with the glow of the open moment under it, and what is drawn upright on it:
  // tokens, effects, the open moment's marks.
  const drawBody = (slot: CardSlot, dim: boolean) => {
    const image = images.get(slot.code) ?? null;
    // A pile, or the top of the deck the rules let the player play (Gandalf): face up and picked like a hand card.
    if (slot.kind === "pile" || slot.zone === "deck") return <Pile slot={slot.zone === "deck" && slot.kind === "card" ? { ...slot, faceDown: false } : slot} image={image} name={nameOf(slot.code)} fonts={fonts} label backs={backs} />;
    const encounterBack = slot.kind === "shadow" || slot.zone === "staging" || slot.zone === "engaged" || slot.zone === "encounterDeck";
    const picked = pickedCount(slot) > 0;
    const glows = slot.kind === "card" && (picked || isTappable(slot));
    return (
      <Group opacity={dim ? 0.35 : 1}>
        {glows ? <Glow slot={slot} picked={picked} /> : null}
        <CardBody slot={slot} image={image} name={nameOf(slot.code)} sphere={sphereIcon(sphereOf(slot.code))} fonts={fonts} encounterBack={encounterBack} backs={backs} />
      </Group>
    );
  };
  // What is drawn in the card's shape, inside its turned group: the gold edge, the picked edge, the veil, the beat ring.
  const drawFrame = (slot: CardSlot) => {
    if (slot.kind === "pile") return null;
    const card = slot.kind === "card";
    return <CardMarks slot={slot} tappable={card && isTappable(slot)} picked={card ? pickedCount(slot) : 0} dimmed={card && dimmed(slot)} beat={highlight.beat.has(slot.id)} />;
  };
  const drawOverlay = (slot: CardSlot) => {
    if (slot.kind === "pile") return null;
    const rect = slotBounds(slot);
    const slotInfo = slot.kind === "card" && !slot.faceDown && slot.zone !== "hand" && slot.zone !== "deck" ? info(slot.id) : null;
    const optionMark = highlight.marks.get(slot.id);
    // The veil is drawn in the card's turned group, under this upright layer, so a veiled card's tokens and marks are faded
    // here instead; the option pill stays bright.
    const veiled = slot.kind === "card" && dimmed(slot);
    return (
      <Group>
        <Group opacity={veiled ? 0.55 : 1}>
          {slotInfo ? <Badges slot={slot} rect={rect} effects={slotInfo.effects} willpower={slotInfo.willpower} questPoints={slotInfo.questPoints} fonts={fonts} images={tokens} contrast={contrast} /> : null}
          {slotInfo?.engagement ? <EngagementMark rect={rect} cost={slotInfo.engagement.cost} engages={slotInfo.engagement.engages} fonts={fonts} images={tokens} /> : null}
          {slotInfo?.delayed ? <DelayedMark rect={rect} /> : null}
          <Tokens slot={slot} rect={rect} images={tokens} fonts={fonts} ring={slot.resources > 0 ? sphereRing(sphereOf(slot.code)) : null} contrast={contrast} />
          {slot.kind === "card" && !slot.faceDown && inactive(slot.code) ? <NotAppliedMark rect={rect} /> : null}
        </Group>
        {slot.kind === "card" ? <PickRing rect={rect} picked={pickedCount(slot)} share={highlight.share} dimmed={veiled} fonts={fonts} /> : null}
        {slot.kind === "card" && optionMark ? <OptionMarkView rect={rect} mark={optionMark} fonts={fonts} images={tokens} /> : null}
      </Group>
    );
  };

  const attackerSlot = layout.attacker ? (layout.slots.find((slot) => slot.id === layout.attacker && slot.kind === "card") ?? null) : null;
  // The numbers on cards are read again when the effects in play, the threat or the delayed effects change.
  void modifiers;
  void threat;
  void delayed;
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
            {drawBody(ghost.slot, false)}
          </Leaving>
        ))}
        {layout.slots.map((slot) => (
          <Moving key={`${slot.kind}:${slot.id}`} slot={slot} motion={moves.motions.get(slot.id) ?? still} progress={progress} epoch={epoch} at={moves.at} frame={drawFrame(slot)} overlay={drawOverlay(slot)}>
            {drawBody(slot, lifted?.id === slot.id && slot.kind === "card")}
          </Moving>
        ))}
        {attackerSlot ? <AttackerMark rect={slotBounds(attackerSlot)} /> : null}
        {layout.marks.map((mark) => (
          <CombatMarkView key={`mark:${mark.enemyId}`} mark={mark} />
        ))}
        {lifted ? (
          <Group transform={liftTransform} origin={vec(lifted.x + lifted.w / 2, lifted.y + lifted.h / 2)}>
            <CardBody slot={{ ...lifted, tilt: 0, exhausted: false }} image={images.get(lifted.code) ?? null} name={nameOf(lifted.code)} sphere={sphereIcon(sphereOf(lifted.code))} fonts={fonts} encounterBack={false} backs={backs} />
            <RoundedRect x={lifted.x} y={lifted.y} width={lifted.w} height={lifted.h} r={RADIUS} color={t.gold} style="stroke" strokeWidth={2} />
          </Group>
        ) : null}
      </Canvas>
    </GestureDetector>
  );
}

// Drawn again only when its props change: the screen keeps them stable while their contents are the same.
export const TableCanvas = memo(Table);
