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
import { PixelRatio } from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import { useStore } from "zustand";

import { beatIds } from "./beat-store.ts";
import { cardCorner } from "./card-corner.ts";
import { Leaving, useCardMotion } from "./card-motion.native.tsx";
import { seatTag, stagingWord } from "./area-words.ts";
import { AttackerMark, CardBody, CombatMarkView, RADIUS, StagingTag } from "./canvas-pieces.native.tsx";
import { sphereIcon } from "./icon-map.ts";
import { HandScrub } from "./hand-scrub.native.tsx";
import { useTableGestures } from "./hand-gestures.native.ts";
import { slotBounds, tableLayout, type CardSlot, type Rect } from "./layout.ts";
import { pictureKey } from "./picture-key.ts";
import { areaFacts, areaSpeech } from "./stormcaller-table.ts";
import { grappleDetail } from "./grapple-words.ts";
import { stagePill } from "./stormcaller-words.ts";
import { NO_DRAG, NO_HIGHLIGHT, NO_TARGETS } from "./peek.ts";
import { actingSeat, lookedOf, shownSeat } from "./selectors.ts";
import type { TableCanvasProps } from "./table-canvas-types.ts";
import { ReaderPiles } from "./reader-piles.tsx";
import { useScreenReader } from "./screen-reader.ts";
import { sphereRing, stripText, useViews } from "./table-canvas-views.ts";
import { useBackImages, useTokenImages } from "./table-assets.native.ts";
import { useTableFonts } from "./table-fonts.native.ts";
import { useTableImages } from "./table-images.native.ts";
import { pictureBoxes, pictureRatio } from "./table-pictures.ts";
import { tableSettings } from "./table-settings.ts";
import { TokenFx } from "./token-fx.native.tsx";
import { withAlphaHex, type TableTokens } from "./tokens.ts";
import { useSpotlight } from "./use-spotlight.ts";
import { drawBody, TablePiece } from "./table-piece.native.tsx";
import { bodyProps, pieceProps, type PieceContext } from "./table-piece.ts";
import { useUiScale } from "./ui-scale.ts";
import { useTableTokens } from "./use-table-tokens.ts";

// No card is ringed by a banner beat while the table peeks.
const NO_BEAT: ReadonlySet<string> = new Set();

// A faint word in an empty zone, so the player knows what the space is for.
function ZoneWord({ rect, text, font, t, s }: { rect: Rect; text: string; font: SkFont; t: TableTokens; s: number }) {
  return <Text x={rect.x + 6 * s} y={rect.y + 16 * s} text={text} font={font} color={t.faint} />;
}

function Table({ store, width, height, picture, pictureRevision, nameOf, sphereOf, inactive, facts, success, info, highlight: marked, beats, raised, fight, bottomInset, stageArea, handoff, look, onTap, onPreview, onDrop }: TableCanvasProps) {
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
  const { views, piles } = useViews(store, seat, facts);
  // The cards a Sailing test looked at stand in a strip over the table (look-strip.ts); the rest of the table carries the night veil meanwhile.
  const lookedCards = useStore(store, (state) => lookedOf(state.game));
  const strip = useMemo(() => lookedCards.map((card) => ({ card, success: success(card.code) })), [lookedCards, success]);
  const looking = strip.length > 0;
  // A sea game stacks the cards under a staging card into one counted peek (layout.ts); every other game peeks each as it always did.
  const seaGame = useStore(store, (state) => state.game.sea != null);
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
  const targetIds = useMemo(() => new Set(targets.flatMap((target) => (target.kind === "card" ? [target.cardId] : []))), [targets]);
  // What a row's fold must keep on the table: the cards the open moment asks about, the picked ones, a card being dragged and the banner's beat (row-fold.ts).
  // The moment's own cards (`marked.keep`) count while the tray is open or the table peeks, when nothing glows.
  const keep = useMemo(() => new Set([...marked.keep, ...targetIds, ...beating, ...(selected ? [selected] : [])]), [marked, targetIds, beating, selected]);
  const layout = useMemo(
    () => tableLayout(width, height, views, piles, { raised, deckTop, attacker, preview: fight, bottomInset, scale: s, keep, look: strip, stacks: seaGame }),
    [width, height, views, piles, raised, deckTop, attacker, fight, bottomInset, s, keep, strip, seaGame],
  );
  // The cards the rows folded away are told to the table's pick (a folded card is not on the table) and to the row list (row-fold.ts).
  const foldedKey = (layout.folds ?? []).map((fold) => `${fold.zone}:${fold.cards.join(",")}`).join("|");
  useLayoutEffect(() => {
    const folds = { staging: [] as string[], engaged: [] as string[] };
    for (const fold of layout.folds ?? []) folds[fold.zone].push(...fold.cards);
    store.getState().setRowFolds(folds);
  }, [store, foldedKey, layout]);

  // Each new layout: where every card comes from, which tokens changed, and the clock that runs them (card-motion.native.tsx).
  const { moves, clock, fxClock, k, hurry } = useCardMotion(store, layout, seat, acting);
  // The attacks the state resolved are planned and clocked here, and drawn by the full-screen layer over the whole table
  // (spotlight-layer.native.tsx); the touch that skips them does nothing else.
  const spot = useSpotlight(store, layout, stageArea, k);
  const { swallow, live } = spot;

  // Each face-up code at the largest size it is drawn: a hand card at the scrub's lifted size (table-pictures.ts).
  const boxes = useMemo(() => pictureBoxes([...layout.slots, ...moves.ghosts.map((ghost) => ghost.slot)], layout.card), [layout, moves]);
  const quality = useStore(tableSettings, (state) => state.settings.cardQuality);
  const images = useTableImages(boxes, picture, pictureRevision, pictureRatio(PixelRatio.get(), quality));
  const tokens = useTokenImages();
  const backs = useBackImages();
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

  // Whose area the staging row is once the table is split between players: the tag at the row's left end, the empty row's word, and the quest strip's seat.
  const owner = seatTag(game, seat);
  const targetZones = useMemo(() => targets.flatMap((target) => (target.kind === "zone" ? [layout.zones[target.zone]] : [])), [targets, layout]);

  // What a screen reader hears of a card whose number or place is only on the canvas: The Havens Burn, with the cards under it against the number that loses; the Stormcaller's stage and area.
  const spoken = (slot: CardSlot): string | null => {
    if (slot.kind !== "card" || slot.faceDown || slot.zone === "hand" || slot.zone === "deck") return null;
    const numbers = info(game, seat, slot.id);
    // The Stormcaller's stage and the cards of its area say where they stand and whether they can be reached (stormcaller-table.ts).
    if (slot.stormcaller) return areaSpeech(game, slot.id, (card) => nameOf(pictureKey(card)), numbers.questPoints);
    // The Havens Burn's count, the enemies grappled under a location, and a Ship location's Threat against the total that loses (each is a sentence of its own; none drops another).
    const said = [numbers.under?.speech, grappleDetail(game, slot.id), numbers.loss?.speech].filter((part): part is string => part != null);
    return said.length > 0 ? `${nameOf(slot.picture ?? slot.code)}, ${said.join(". ")}` : null;
  };
  // The Stormcaller's stage wears its number and, while the players are at another stage, the Apart plate.
  const stageFacts = areaFacts(game);
  const stageMarks = stageFacts ? { pill: stagePill(stageFacts), apart: !stageFacts.together } : null;
  // Everything a card's drawing reads, for this render; a card whose props did not change is not drawn again (table-piece.ts).
  const ctx: PieceContext = { stageMarks, highlight, targetIds, looking, peeking, beating, liftedId: lifted?.id ?? null, motions: moves.motions, clock, images, game, seat, owner, contrast, nameOf, sphereOf, inactive, info, fonts, backs, tokens, t, s };
  // The lifted copy draws the same picture, name and sphere as its card on the table.
  const lift = lifted ? bodyProps(lifted, ctx) : null;
  const piece = (slot: CardSlot) => <TablePiece key={`${slot.kind}:${slot.id}`} {...pieceProps(slot, ctx)} />;
  const attackerSlot = layout.attacker ? (layout.slots.find((slot) => slot.id === layout.attacker && slot.kind === "card") ?? null) : null;
  const emptyWords: [Rect, string][] = [
    ...(views.staging.entries.length === 0 ? [[layout.zones.staging, stagingWord(game, seat)] as [Rect, string]] : []),
    ...(views.engaged.entries.length === 0 ? [[layout.zones.engaged, "No enemy engaged"] as [Rect, string]] : []),
    ...(views.activeLocation.entries.length === 0 ? [[layout.zones.activeLocation, "No location"] as [Rect, string]] : []),
  ];

  return (
    <>
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
          {owner && views.staging.entries.length > 0 ? <StagingTag rect={layout.zones.staging} text={stagingWord(game, seat)} font={fonts.small} t={t} s={s} /> : null}
          {emptyWords.map(([rect, text]) => (
            <ZoneWord key={text} rect={rect} text={text} font={fonts.small} t={t} s={s} />
          ))}
          {targetZones.map((rect, index) => (
            <RoundedRect key={`z${index}`} x={rect.x - 4 * s} y={rect.y - 4 * s} width={rect.w + 8 * s} height={rect.h + 8 * s} r={RADIUS * s * 2} color={t.accent} style="stroke" strokeWidth={1.5 * s} />
          ))}
          {moves.ghosts.map((ghost) => (
            <Leaving key={`ghost:${ghost.slot.id}:${moves.at}`} ghost={ghost} clock={clock}>
              {drawBody(bodyProps(ghost.slot, ctx), ghost.slot, false)}
            </Leaving>
          ))}
          {layout.slots.filter((slot) => slot.zone !== "hand").map(piece)}
          <HandScrub slots={layout.slots.filter((slot) => slot.zone === "hand")} scrub={scrub} width={width} height={height} t={t} piece={piece} />
          <TokenFx fx={moves.fx} layout={layout} clock={fxClock} images={tokens} fonts={fonts} t={t} s={s} ringOf={(code) => sphereRing(sphereOf(code), t)} stripOf={(slot) => stripText(slot, info(game, seat, slot.id).questPoints, slot.zone === "questStage" ? owner : null)} contrast={contrast} />
          {attackerSlot ? <AttackerMark rect={slotBounds(attackerSlot)} t={t} s={s} /> : null}
          {layout.marks.map((mark) => (
            <CombatMarkView key={`mark:${mark.enemyId}`} mark={mark} t={t} s={s} />
          ))}
          {lifted && lift ? (
            <Group transform={liftTransform} origin={vec(lifted.x + lifted.w / 2, lifted.y + lifted.h / 2)}>
              <CardBody slot={{ ...lifted, tilt: 0, exhausted: false }} image={lift.image} name={lift.name} sphere={sphereIcon(lift.sphere)} fonts={fonts} encounterBack={false} backs={backs} t={t} s={s} />
              <RoundedRect x={lifted.x} y={lifted.y} width={lifted.w} height={lifted.h} r={cardCorner(lifted.w, lifted.h)} color={t.accent} style="stroke" strokeWidth={2 * s} />
            </Group>
          ) : null}
        </Canvas>
      </GestureDetector>
      {/* A screen reader reaches the piles and the fold stacks through a button over each (reader-piles.tsx). */}
      {reader ? <ReaderPiles slots={layout.slots} onTap={onTap} speak={(slot) => spoken(slot)} /> : null}
    </>
  );
}

// Drawn again only when its props change: the screen keeps them stable while their contents are the same.
export const TableCanvas = memo(Table);
