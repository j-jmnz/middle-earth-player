// The table: one Skia canvas, not a view per card (docs/architecture.md, Screens), played in landscape. Zustand subscribers
// read the zone and pile slices it draws. A drag, a card lift and the return run on the UI thread with Gesture Handler and
// Reanimated; JavaScript hears about a drag only when a card is picked up (to compute that card's drop targets) and when the
// finger lifts. A tap picks (the screen decides what), a long press previews; neither sends an intent.
//
// When the state changes, each card moves from where it was to where it is now, a new card comes in from its deck or grows
// in, and a card that left goes to its pile (motion.ts, run by card-motion.native.tsx). The motion runs on the UI thread, never
// gates a rule, and snaps under reduced motion; a touch finishes it at once, and a new gesture cancels the lift in progress.
import { Canvas, Group, RadialGradient, Rect as SkRect, RoundedRect, Text, vec, type SkFont } from "@shopify/react-native-skia";
import { memo, useCallback, useEffectEvent, useLayoutEffect, useMemo } from "react";
import { GestureDetector } from "react-native-gesture-handler";
import { useStore } from "zustand";

import { beatIds } from "./beat-store.ts";
import { cardCorner } from "./card-corner.ts";
import { CardMarks, Glow, PickRing } from "./card-marks.native.tsx";
import { Leaving, Moving, useCardMotion } from "./card-motion.native.tsx";
import { AttackerMark, Badges, CardBody, CombatMarkView, DelayedMark, EngagementMark, HeldMark, NotAppliedMark, OptionMarkView, Pile, RADIUS, Tokens, type BackImages, type TokenImages } from "./canvas-pieces.native.tsx";
import { sphereIcon } from "./icon-map.ts";
import { CARD_BACK_FILES, ICON_FILES } from "./icons/files.generated.ts";
import { HandScrub } from "./hand-scrub.native.tsx";
import { useTableGestures } from "./hand-gestures.native.ts";
import { slotBounds, tableLayout, type CardSlot, type Rect } from "./layout.ts";
import { AT_REST } from "./motion.ts";
import { NO_DRAG, NO_HIGHLIGHT, NO_TARGETS } from "./peek.ts";
import { actingSeat, shownSeat } from "./selectors.ts";
import type { TableCanvasProps } from "./table-canvas-types.ts";
import { useScreenReader } from "./screen-reader.ts";
import { sphereRing, stripText, useViews } from "./table-canvas-views.ts";
import { useSharedImage } from "./table-assets.native.ts";
import { useTableFonts } from "./table-fonts.native.ts";
import { useTableImages } from "./table-images.native.ts";
import { pictureBoxes } from "./table-pictures.ts";
import { TokenFx } from "./token-fx.native.tsx";
import { withAlphaHex, type TableTokens } from "./tokens.ts";
import { useSpotlight } from "./use-spotlight.ts";
import { useUiScale } from "./ui-scale.ts";
import { useTableTokens } from "./use-table-tokens.ts";

// No card is ringed by a banner beat while the table peeks.
const NO_BEAT: ReadonlySet<string> = new Set();

// A faint word in an empty zone, so the player knows what the space is for.
function ZoneWord({ rect, text, font, t, s }: { rect: Rect; text: string; font: SkFont; t: TableTokens; s: number }) {
  return <Text x={rect.x + 6 * s} y={rect.y + 16 * s} text={text} font={font} color={t.faint} />;
}

function Table({ store, width, height, picture, pictureRevision, nameOf, sphereOf, inactive, info, highlight: marked, beats, raised, fight, bottomInset, stageArea, handoff, look, onTap, onPreview, onDrop }: TableCanvasProps) {
  // The UI scale, read once here and handed down with the tokens: to the layout, the fonts, every piece and the spotlight (user request, 2026-10-28).
  const s = useUiScale();
  const contrast = look?.contrast ?? false;
  // The theme's tokens, read once here and handed to every piece the canvas draws (user request, 2026-10-28).
  const t = useTableTokens();
  // The seat drawn is the seat peeked at, if any (phase 26); the seat acting is the engine's. While peeking nothing glows, nothing can be
  // lifted or dropped, and the hand carries a veil: a tap only opens a preview (use-table-choice.ts).
  const seat = useStore(store, (state) => shownSeat(state.game, state.viewedSeat));
  const acting = useStore(store, (state) => actingSeat(state.game));
  const peeking = useStore(store, (state) => state.viewedSeat != null);
  const highlight = peeking ? NO_HIGHLIGHT : marked;
  // The cards the banner's line names are ringed; this canvas alone reads them, so a beat draws it and not the screen (beat-store.ts).
  const beatKey = useStore(beats, (state) => state.key);
  const beat = useMemo(() => beatIds(beatKey), [beatKey]);
  const beating = peeking ? NO_BEAT : beat;
  const { views, piles } = useViews(store, seat);
  const selected = useStore(store, (state) => state.selected);
  const targets = useStore(store, (state) => (state.viewedSeat != null ? NO_TARGETS : state.targets));
  const draggable = useStore(store, (state) => (state.viewedSeat != null ? NO_DRAG : state.draggable));
  // The state the numbers on cards are read from (info): the effects in play, the shown seat's threat (which enemies in staging engage
  // it), the delayed effects and the attack in progress. The compiler sees this as the dependency, so they are never read stale.
  const game = useStore(store, (state) => state.game);
  const attacker = useStore(store, (state) => state.game.pendingAttack?.enemyId ?? null);
  const deckTopId = useStore(store, (state) => state.game.seats[seat]?.deck[0] ?? null);
  const deckTopCard = useStore(store, (state) => (deckTopId ? (state.game.cards[deckTopId] ?? null) : null));

  // The top of the deck is a card when the rules let it be played from there (Gandalf, 142002).
  const deckTop = deckTopId && draggable.includes(deckTopId) ? deckTopCard : null;
  const layout = useMemo(
    () => tableLayout(width, height, views, piles, { raised, deckTop, attacker, preview: fight, bottomInset, scale: s }),
    [width, height, views, piles, raised, deckTop, attacker, fight, bottomInset, s],
  );

  // Each new layout: where every card comes from, which tokens changed, and the clock that runs them (card-motion.native.tsx).
  const { moves, clock, fxClock, k, hurry } = useCardMotion(store, layout, seat, acting);
  // The attacks the state resolved are planned and clocked here, and drawn by the full-screen layer over the whole table
  // (spotlight-layer.native.tsx); the touch that skips them does nothing else.
  const spot = useSpotlight(store, layout, stageArea, k);
  const { swallow, live } = spot;

  // Each face-up code at the largest size it is drawn: a hand card at the scrub's lifted size (table-pictures.ts).
  const boxes = useMemo(() => pictureBoxes([...layout.slots, ...moves.ghosts.map((ghost) => ghost.slot)]), [layout, moves]);
  const images = useTableImages(boxes, picture, pictureRevision);
  const tokens: TokenImages = {
    resource: useSharedImage(ICON_FILES.resource),
    damage: useSharedImage(ICON_FILES.damage),
    progress: useSharedImage(ICON_FILES.progress),
    questPoints: useSharedImage(ICON_FILES.questPoints),
    engagementCost: useSharedImage(ICON_FILES.engagementCost),
  };
  const backs: BackImages = { player: useSharedImage(CARD_BACK_FILES.player), encounter: useSharedImage(CARD_BACK_FILES.encounter) };
  const fonts = useTableFonts(s);
  // The plan, the clock and the table's decodes go to the layer when the plan, whether it plays, the pictures to decode ahead or the motion scale changes; only the
  // layer listens, so this canvas does not render again for it. The decodes are a fallback until the layer's own are ready.
  const { plan, progress, playing, warm } = spot;
  const decoded = useEffectEvent(() => images);
  useLayoutEffect(() => {
    handoff.setState({ plan, progress, k, playing, warm, tableImages: decoded() });
  }, [handoff, plan, progress, playing, warm, k]);

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
    const image = images.get(slot.picture ?? slot.code) ?? null;
    // A pile, or the top of the deck the rules let the player play (Gandalf): face up and picked like a hand card.
    if (slot.kind === "pile" || slot.zone === "deck") {
      const pile = <Pile slot={slot.zone === "deck" && slot.kind === "card" ? { ...slot, faceDown: false } : slot} image={image} name={nameOf(slot.code)} fonts={fonts} label backs={backs} t={t} s={s} />;
      // A discard pile holding a card the seat may play from it (Elven-light) glows; its list plays the card.
      return slot.kind === "pile" && isTappable(slot) ? (
        <Group>
          <Glow slot={slot} picked={false} t={t} s={s} />
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
        {glows ? <Glow slot={slot} picked={picked} t={t} s={s} /> : null}
        <CardBody slot={slot} image={image} name={nameOf(slot.code)} sphere={sphereIcon(sphereOf(slot.code))} fonts={fonts} encounterBack={encounterBack} backs={backs} t={t} s={s} />
      </Group>
    );
  };
  // What is drawn in the card's shape, inside its turned group: the accent edge, the picked edge, the veil, the beat ring.
  const drawFrame = (slot: CardSlot) => {
    if (slot.kind === "pile") return null;
    const card = slot.kind === "card";
    return <CardMarks slot={slot} tappable={card && isTappable(slot)} picked={card ? pickedCount(slot) : 0} dimmed={card && dimmed(slot)} beat={beating.has(slot.id)} t={t} s={s} veiled={peeking && card && slot.zone === "hand"} />;
  };
  const drawOverlay = (slot: CardSlot) => {
    if (slot.kind === "pile") return null;
    const rect = slotBounds(slot);
    const slotInfo = slot.kind === "card" && !slot.faceDown && slot.zone !== "hand" && slot.zone !== "deck" ? info(game, seat, slot.id) : null;
    const optionMark = highlight.marks.get(slot.id);
    // The veil is drawn in the card's turned group, under this upright layer, so a veiled card's tokens and marks are faded
    // here instead; the option pill stays bright.
    const veiled = slot.kind === "card" && dimmed(slot);
    return (
      <Group>
        <Group opacity={veiled ? 0.55 : 1}>
          {slotInfo ? <Badges slot={slot} rect={rect} effects={slotInfo.effects} willpower={slotInfo.willpower} questPoints={slotInfo.questPoints} fonts={fonts} images={tokens} t={t} s={s} contrast={contrast} /> : null}
          {slotInfo?.engagement ? <EngagementMark rect={rect} cost={slotInfo.engagement.cost} engages={slotInfo.engagement.engages} fonts={fonts} images={tokens} t={t} s={s} /> : null}
          {slotInfo?.delayed ? <DelayedMark rect={rect} t={t} s={s} /> : null}
          <Tokens slot={slot} rect={rect} images={tokens} fonts={fonts} t={t} s={s} ring={slot.resources > 0 ? sphereRing(sphereOf(slot.code), t) : null} contrast={contrast} />
          {slot.kind === "card" && !slot.faceDown && inactive(slot.code) ? <NotAppliedMark rect={rect} t={t} s={s} /> : null}
          {slot.kind === "card" && slot.faceDown && slot.held ? <HeldMark rect={rect} t={t} s={s} /> : null}
        </Group>
        {slot.kind === "card" ? <PickRing rect={rect} picked={pickedCount(slot)} share={highlight.share} dimmed={veiled} fonts={fonts} t={t} s={s} /> : null}
        {slot.kind === "card" && optionMark ? <OptionMarkView rect={rect} mark={optionMark} fonts={fonts} images={tokens} t={t} s={s} /> : null}
      </Group>
    );
  };

  const piece = (slot: CardSlot) => (
    <Moving key={`${slot.kind}:${slot.id}`} slot={slot} motion={moves.motions.get(slot.id) ?? AT_REST} clock={clock} back={moves.motions.get(slot.id)?.flip ? drawBody({ ...slot, faceDown: true }, false) : undefined} frame={drawFrame(slot)} overlay={drawOverlay(slot)}>
      {drawBody(slot, lifted?.id === slot.id && slot.kind === "card")}
    </Moving>
  );
  const attackerSlot = layout.attacker ? (layout.slots.find((slot) => slot.id === layout.attacker && slot.kind === "card") ?? null) : null;
  const emptyWords: [Rect, string][] = [
    ...(views.staging.entries.length === 0 ? [[layout.zones.staging, "Staging"] as [Rect, string]] : []),
    ...(views.engaged.entries.length === 0 ? [[layout.zones.engaged, "No enemy engaged"] as [Rect, string]] : []),
    ...(views.activeLocation.entries.length === 0 ? [[layout.zones.activeLocation, "No location"] as [Rect, string]] : []),
  ];

  return (
    <GestureDetector gesture={gesture}>
      <Canvas style={{ width, height }}>
        {/* No felt and no zone boxes: the screen's fog (ember over the encounter, moonlight over the fellowship) shows through, and
            the engagement area is told apart by a red haze toward its left, where the enemies stand. */}
        <SkRect x={layout.zones.engaged.x - 12 * s} y={layout.zones.engaged.y - 10 * s} width={layout.zones.engaged.w + 24 * s} height={layout.zones.engaged.h + 20 * s}>
          <RadialGradient
            c={vec(layout.zones.engaged.x + layout.zones.engaged.w * 0.18, layout.zones.engaged.y + layout.zones.engaged.h / 2)}
            r={Math.max(layout.zones.engaged.w * 0.5, 1)}
            origin={vec(layout.zones.engaged.x + layout.zones.engaged.w * 0.18, layout.zones.engaged.y + layout.zones.engaged.h / 2)}
            transform={[{ scaleY: Math.min(1, (layout.zones.engaged.h * 0.6) / Math.max(layout.zones.engaged.w * 0.5, 1)) }]}
            colors={[withAlphaHex(t.threat, t.depth === "light" ? 0.18 : 0.3), withAlphaHex(t.threat, 0)]}
          />
        </SkRect>
        {emptyWords.map(([rect, text]) => (
          <ZoneWord key={text} rect={rect} text={text} font={fonts.small} t={t} s={s} />
        ))}
        {targetZones.map((rect, index) => (
          <RoundedRect key={`z${index}`} x={rect.x - 4 * s} y={rect.y - 4 * s} width={rect.w + 8 * s} height={rect.h + 8 * s} r={RADIUS * s * 2} color={t.accent} style="stroke" strokeWidth={1.5 * s} />
        ))}
        {moves.ghosts.map((ghost) => (
          <Leaving key={`ghost:${ghost.slot.id}:${moves.at}`} ghost={ghost} clock={clock}>
            {drawBody(ghost.slot, false)}
          </Leaving>
        ))}
        {layout.slots.filter((slot) => slot.zone !== "hand").map(piece)}
        <HandScrub slots={layout.slots.filter((slot) => slot.zone === "hand")} scrub={scrub} width={width} height={height} t={t} piece={piece} />
        <TokenFx fx={moves.fx} layout={layout} clock={fxClock} images={tokens} fonts={fonts} t={t} s={s} ringOf={(code) => sphereRing(sphereOf(code), t)} stripOf={(slot) => stripText(slot, info(game, seat, slot.id).questPoints)} contrast={contrast} />
        {attackerSlot ? <AttackerMark rect={slotBounds(attackerSlot)} t={t} s={s} /> : null}
        {layout.marks.map((mark) => (
          <CombatMarkView key={`mark:${mark.enemyId}`} mark={mark} t={t} s={s} />
        ))}
        {lifted ? (
          <Group transform={liftTransform} origin={vec(lifted.x + lifted.w / 2, lifted.y + lifted.h / 2)}>
            <CardBody slot={{ ...lifted, tilt: 0, exhausted: false }} image={images.get(lifted.picture ?? lifted.code) ?? null} name={nameOf(lifted.code)} sphere={sphereIcon(sphereOf(lifted.code))} fonts={fonts} encounterBack={false} backs={backs} t={t} s={s} />
            <RoundedRect x={lifted.x} y={lifted.y} width={lifted.w} height={lifted.h} r={cardCorner(lifted.w, lifted.h)} color={t.accent} style="stroke" strokeWidth={2 * s} />
          </Group>
        ) : null}
      </Canvas>
    </GestureDetector>
  );
}

// Drawn again only when its props change: the screen keeps them stable while their contents are the same.
export const TableCanvas = memo(Table);
