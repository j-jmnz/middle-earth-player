// The table: one Skia canvas, not a view per card (docs/architecture.md, Table), played in landscape. Zustand subscribers
// read the zone and pile slices it draws. A drag, a card lift and the return run on the UI thread with Gesture Handler and
// Reanimated; JavaScript hears about a drag only when a card is picked up (to compute that card's drop targets) and when the
// finger lifts. A tap picks (the screen decides what), a long press previews; neither sends an intent.
//
// When the state changes, each card moves from where it was to where it is now, a new card comes in from its deck or grows
// in, and a card that left goes to its pile (motion.ts, run by card-motion.native.tsx). The motion runs on the UI thread, never
// gates a rule, and snaps under reduced motion; a touch finishes it at once, and a new gesture cancels the lift in progress.
import { Canvas, Circle, Group, RoundedRect, Text, useImage, vec, type SkFont } from "@shopify/react-native-skia";
import { memo, useCallback, useMemo } from "react";
import { GestureDetector } from "react-native-gesture-handler";
import { useStore } from "zustand";

import { CardMarks, Glow, PickRing } from "./card-marks.native.tsx";
import { Leaving, Moving, useCardMotion } from "./card-motion.native.tsx";
import { AttackerMark, Badges, CardBody, CombatMarkView, DelayedMark, EngagementMark, HeldMark, NotAppliedMark, OptionMarkView, Pile, RADIUS, Tokens, withAlpha, type BackImages, type TokenImages } from "./canvas-pieces.native.tsx";
import { sphereIcon } from "./icon-map.ts";
import { CARD_BACK_FILES, ICON_FILES } from "./icons/files.generated.ts";
import { HandScrub } from "./hand-scrub.native.tsx";
import { useTableGestures } from "./hand-gestures.native.ts";
import { slotBounds, tableLayout, type CardSlot, type Rect } from "./layout.ts";
import { AT_REST } from "./motion.ts";
import { NO_DRAG, NO_HIGHLIGHT, NO_TARGETS } from "./peek.ts";
import { actingSeat, shownSeat } from "./selectors.ts";
import { Spotlight } from "./spotlight.native.tsx";
import type { TableCanvasProps } from "./table-canvas-types.ts";
import { useScreenReader } from "./screen-reader.ts";
import { sphereRing, stripText, useViews } from "./table-canvas-views.ts";
import { useTableFonts } from "./table-fonts.native.ts";
import { useTableImages } from "./table-images.native.ts";
import { TokenFx } from "./token-fx.native.tsx";
import { tableTokens as t } from "./tokens.ts";
import { useSpotlight } from "./use-spotlight.ts";
import { useSpotlightImages } from "./use-spotlight-images.native.ts";

// A faint word in an empty zone, so the player knows what the space is for.
function ZoneWord({ rect, text, font }: { rect: Rect; text: string; font: SkFont }) {
  return <Text x={rect.x + 6} y={rect.y + 16} text={text} font={font} color={t.faint} />;
}

function Table({ store, width, height, picture, pictureRevision, nameOf, sphereOf, inactive, info, highlight: marked, raised, fight, bottomInset, look, onTap, onPreview, onDrop }: TableCanvasProps) {
  const contrast = look?.contrast ?? false;
  // The seat drawn is the seat peeked at, if any (phase 26); the seat acting is the engine's. While peeking nothing glows, nothing can be
  // lifted or dropped, and the hand carries a veil: a tap only opens a preview (use-table-choice.ts).
  const seat = useStore(store, (state) => shownSeat(state.game, state.viewedSeat));
  const acting = useStore(store, (state) => actingSeat(state.game));
  const peeking = useStore(store, (state) => state.viewedSeat != null);
  const highlight = peeking ? NO_HIGHLIGHT : marked;
  const { views, piles } = useViews(store, seat);
  const selected = useStore(store, (state) => state.selected);
  const targets = useStore(store, (state) => (state.viewedSeat != null ? NO_TARGETS : state.targets));
  const draggable = useStore(store, (state) => (state.viewedSeat != null ? NO_DRAG : state.draggable));
  // Only the slices drawn here: a threat change alone does not draw the table again (docs/architecture.md, State). The
  // effects in play and the attack in progress change the numbers on cards.
  const modifiers = useStore(store, (state) => state.game.modifiers);
  // The shown seat's threat sets which enemies in staging engage it (their marks), and the delayed effects mark cards.
  const threat = useStore(store, (state) => state.game.seats[seat]?.threat ?? 0);
  const delayed = useStore(store, (state) => state.game.delayed);
  const attacker = useStore(store, (state) => state.game.pendingAttack?.enemyId ?? null);
  const deckTopId = useStore(store, (state) => state.game.seats[seat]?.deck[0] ?? null);
  const deckTopCard = useStore(store, (state) => (deckTopId ? (state.game.cards[deckTopId] ?? null) : null));

  // The top of the deck is a card when the rules let it be played from there (Gandalf, 142002).
  const deckTop = deckTopId && draggable.includes(deckTopId) ? deckTopCard : null;
  const layout = useMemo(
    () => tableLayout(width, height, views, piles, { raised, deckTop, attacker, preview: fight, bottomInset }),
    [width, height, views, piles, raised, deckTop, attacker, fight, bottomInset],
  );

  // Each new layout: where every card comes from, which tokens changed, and the clock that runs them (card-motion.native.tsx).
  const { moves, clock, fxClock, k, hurry } = useCardMotion(store, layout, seat, acting);
  // The attacks the state resolved play on top of the table first (spotlight.native.tsx); the touch that skips them does nothing else.
  const spot = useSpotlight(store, layout, k);
  const { swallow, live } = spot;

  const codes = useMemo(() => [...new Set([...[...layout.slots, ...moves.ghosts.map((ghost) => ghost.slot)].filter((slot) => !slot.faceDown && slot.code !== "").map((slot) => slot.code)])], [layout, moves]);
  const images = useTableImages(codes, picture, layout.card, pictureRevision);
  const tokens: TokenImages = {
    resource: useImage(ICON_FILES.resource),
    damage: useImage(ICON_FILES.damage),
    progress: useImage(ICON_FILES.progress),
    questPoints: useImage(ICON_FILES.questPoints),
    engagementCost: useImage(ICON_FILES.engagementCost),
  };
  const backs: BackImages = { player: useImage(CARD_BACK_FILES.player), encounter: useImage(CARD_BACK_FILES.encounter) };
  const { fonts, spotFonts } = useTableFonts();
  const spotImages = useSpotlightImages(spot.plan, spot.playing, picture, pictureRevision, images);

  const select = useCallback((cardId: string | null) => store.getState().select(cardId), [store]);
  const reader = useScreenReader();
  // The drag, the tap, the press and the hand scrub (hand-gestures.native.ts).
  const { gesture, liftTransform, scrub } = useTableGestures({ layout, canvas: { width, height, bottom: bottomInset }, draggable, targets, k, hurry, live, swallow, scrubOn: !reader, select, onTap, onPreview, onDrop });
  const lifted = selected ? (layout.slots.find((slot) => slot.id === selected && slot.kind === "card") ?? null) : null;

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
    if (slot.kind === "pile" || slot.zone === "deck") {
      const pile = <Pile slot={slot.zone === "deck" && slot.kind === "card" ? { ...slot, faceDown: false } : slot} image={image} name={nameOf(slot.code)} fonts={fonts} label backs={backs} />;
      // A discard pile holding a card the seat may play from it (Elven-light) glows; its list plays the card.
      return slot.kind === "pile" && isTappable(slot) ? (
        <Group>
          <Glow slot={slot} picked={false} />
          {pile}
        </Group>
      ) : (
        pile
      );
    }
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
    return <CardMarks slot={slot} tappable={card && isTappable(slot)} picked={card ? pickedCount(slot) : 0} dimmed={card && dimmed(slot)} beat={highlight.beat.has(slot.id)} veiled={peeking && card && slot.zone === "hand"} />;
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
          {slot.kind === "card" && slot.faceDown && slot.held ? <HeldMark rect={rect} /> : null}
        </Group>
        {slot.kind === "card" ? <PickRing rect={rect} picked={pickedCount(slot)} share={highlight.share} dimmed={veiled} fonts={fonts} /> : null}
        {slot.kind === "card" && optionMark ? <OptionMarkView rect={rect} mark={optionMark} fonts={fonts} images={tokens} /> : null}
      </Group>
    );
  };

  const piece = (slot: CardSlot) => (
    <Moving key={`${slot.kind}:${slot.id}`} slot={slot} motion={moves.motions.get(slot.id) ?? AT_REST} clock={clock} back={moves.motions.get(slot.id)?.flip ? drawBody({ ...slot, faceDown: true }, false) : undefined} frame={drawFrame(slot)} overlay={drawOverlay(slot)}>
      {drawBody(slot, lifted?.id === slot.id && slot.kind === "card")}
    </Moving>
  );
  const attackerSlot = layout.attacker ? (layout.slots.find((slot) => slot.id === layout.attacker && slot.kind === "card") ?? null) : null;
  // The numbers on cards are read again when the effects in play, the threat or the delayed effects change.
  void modifiers;
  void threat;
  void delayed;
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
        {moves.ghosts.map((ghost) => (
          <Leaving key={`ghost:${ghost.slot.id}:${moves.at}`} ghost={ghost} clock={clock}>
            {drawBody(ghost.slot, false)}
          </Leaving>
        ))}
        {layout.slots.filter((slot) => slot.zone !== "hand").map(piece)}
        <HandScrub slots={layout.slots.filter((slot) => slot.zone === "hand")} scrub={scrub} width={width} height={height} piece={piece} />
        <TokenFx fx={moves.fx} layout={layout} clock={fxClock} images={tokens} fonts={fonts} ringOf={(code) => sphereRing(sphereOf(code))} stripOf={(slot) => stripText(slot, info(slot.id).questPoints)} contrast={contrast} />
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
        {spot.playing && spot.plan ? <Spotlight plan={spot.plan} progress={spot.progress} width={width} height={height} images={spotImages} tokens={tokens} backs={backs} fonts={fonts} spotFonts={spotFonts} nameOf={nameOf} sphereOf={(code) => sphereIcon(sphereOf(code))} k={k} /> : null}
      </Canvas>
    </GestureDetector>
  );
}

// Drawn again only when its props change: the screen keeps them stable while their contents are the same.
export const TableCanvas = memo(Table);
