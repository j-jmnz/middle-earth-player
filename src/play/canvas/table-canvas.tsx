// The web build has no Skia canvas (the same split as src/screens/art/backdrop.tsx): it lists each zone's cards and each pile
// by name. A tap picks, as on the canvas, and a long press previews; the cards the open moment lets the player tap are
// outlined, the picked ones filled. The phone draws the canvas in table-canvas.native.tsx.
import { useMemo } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useStore } from "zustand";

import type { CardInstance, ScenarioState } from "../../rules/core/state.ts";

import { stagingWord } from "../words/scenarios/area.ts";
import { beatIds } from "../store/beat-store.ts";
import { lookIdsOf, lookStripWords } from "../words/scenarios/wilderland.ts";
import { treasureSpeech } from "../cards/dungeon-preview.ts";
import { lookedIds } from "../../rules/families/sea/sailing.ts";

import { NO_HIGHLIGHT } from "../store/peek.ts";
import { nameOfCard, pictureKey } from "./picture-key.ts";
import { grappleTell } from "../words/scenarios/grapple.ts";
import { islandTell } from "../words/scenarios/uncharted.ts";
import { stageFactsOf } from "../store/stormcaller-table.ts";
import { areaTell } from "../words/scenarios/stormcaller.ts";
import { headingStepOf, headingLook } from "../dream-chaser/heading.ts";
import { headingLine, pileCountWords, secondSlotLine, shipsLine } from "../words/scenarios/sea.ts";
import { PILE_WORDS, PILES, hidesFace, isPrisoner, pileIds, secondPilesOf, TABLE_ZONES, pileSelector, shownSeat, zoneSelector, type PileId, type ZoneId } from "../store/selectors.ts";
import type { TableCanvasProps } from "./table-canvas-types.ts";
import { marksText } from "./table-canvas-views.ts";
import type { TableTokens } from "../../ui/tokens.ts";
import { useUiScale } from "../../ui/ui-scale.ts";
import { useTableTokens } from "../../ui/use-table-tokens.ts";
import { Text } from "../../ui/text.tsx";

const ZONE_WORD: Record<ZoneId, string> = {
  questStage: "Quest",
  staging: "Staging",
  activeLocation: "Active location",
  secondActiveLocation: "Second active location",
  engaged: "Engaged",
  play: "Play area",
  hand: "Hand",
};

type RowProps = Pick<TableCanvasProps, "store" | "nameOf" | "inactive" | "info" | "facts" | "onTap" | "onPreview" | "highlight"> & { seat: number; t: TableTokens };

function CardButton({ id, label, faceDown, onTap, onPreview, highlight, t }: { id: string; label: string; faceDown: boolean; t: TableTokens } & Pick<TableCanvasProps, "onTap" | "onPreview" | "highlight">) {
  const picked = highlight.picked.get(id) ?? 0;
  const tappable = highlight.tappable.has(id);
  // The number the open pick draws on the card (the damage a defender would take).
  const mark = highlight.marks.get(id);
  const marked = mark ? ` · ${mark.value} ${mark.icon === "damage" ? "damage" : ""}${mark.danger ? ", destroyed" : ""}`.trimEnd() : "";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: picked > 0 }}
      onPress={() => onTap(id)}
      onLongPress={faceDown ? undefined : () => onPreview(id)}
      delayLongPress={350}
    >
      {/* The pressed fill is on a view inside: NativeWind drops a style function on a Pressable that also has a className. */}
      {({ pressed }) => (
        <View
          className={`min-h-touch justify-center rounded-item px-2 ${picked > 0 ? "bg-accentLine" : "bg-raised"} ${tappable ? "border border-accent" : ""}`}
          style={pressed ? { backgroundColor: t.hairline } : undefined}
        >
          <Text className={faceDown ? "text-label text-faint" : "text-label text-bone"}>{`${picked > 1 ? `${label} · ${picked}` : label}${marked}`}</Text>
        </View>
      )}
    </Pressable>
  );
}

// A treasure in the staging area, in words: who guards it, or that it is free to claim (emce.treasure).
function treasureTell(game: ScenarioState, card: CardInstance, facts: TableCanvasProps["facts"], nameOf: TableCanvasProps["nameOf"]): string {
  const said = facts.typeOf(card.code) === "treasure" ? treasureSpeech(game, card.id, (id) => nameOfCard(game.cards, id, nameOf)) : null;
  return said ? ` · ${said}` : "";
}

function ZoneRow({ store, zone, seat, nameOf, inactive, info, facts, onTap, onPreview, highlight, t }: RowProps & { zone: ZoneId }) {
  const select = useMemo(() => zoneSelector(zone, seat), [zone, seat]);
  const view = useStore(store, (state) => select(state.game));
  // The numbers in a card's words come from this state, not the store read in render (the compiler would keep them stale).
  const game = useStore(store, (state) => state.game);
  if (view.entries.length === 0) return null;
  return (
    <View className="mb-2">
      <Text className="text-label text-muted">{zone === "staging" ? stagingWord(game, seat) : ZONE_WORD[zone]}</Text>
      <View className="flex-row flex-wrap gap-1">
        {view.entries.flatMap(({ card, attached, paired, area }) => [{ card, area }, ...[...attached, ...paired].map((other) => ({ card: other, area: undefined }))]).map(({ card, area }) => (
          <CardButton
            key={card.id}
            id={card.id}
            faceDown={hidesFace(card)}
            label={isPrisoner(card) ? `Prisoner: ${nameOf(card.code)}, face down` : card.prisoner === true ? "Face down, held with the prisoner" : card.face === "down" ? "Face down" : `${nameOf(pictureKey(card))}${card.exhausted ? " (exhausted)" : ""}${islandTell(game, card) ? ` · ${islandTell(game, card)}` : ""}${inactive(pictureKey(card)) ? " · Not applied" : ""}${grappleTell(game, card.id)}${treasureTell(game, card, facts, nameOf)}${area ? ` · ${areaTell(area, area === "stage" ? stageFactsOf(game, info(game, seat, card.id).questPoints) : null)}` : ""}${marksText(zone === "hand" ? null : info(game, seat, card.id))}`}
            onTap={onTap}
            onPreview={onPreview}
            highlight={highlight}
            t={t}
          />
        ))}
      </View>
    </View>
  );
}

function PileRow({ store, pile, seat, nameOf, onTap, onPreview, highlight, t }: RowProps & { pile: PileId }) {
  const select = useMemo(() => pileSelector(pile, seat), [pile, seat]);
  const view = useStore(store, (state) => select(state.game));
  const top = view.top ? ` · ${nameOf(view.top.code)} on top` : "";
  // An encounter card attached to the deck (Iron Shackles, 01105:A:1): the list says so, as the canvas draws a chain.
  const held = (view.attached ?? []).length > 0 ? ` · ${(view.attached ?? []).map((card) => nameOf(card.code)).join(", ")} attached` : "";
  return <CardButton id={`pile:${pile}`} faceDown={false} label={`${pileCountWords(PILE_WORDS[pile], view.ids.length)}${top}${held}`} onTap={onTap} onPreview={onPreview} highlight={highlight} t={t} />;
}

// The sea family's pieces in words (docs/design-system-table.md, Cards): the heading, the seat's ships with their damage, and the Corsair pair on one line. The web list does not fold.
function SeaLines({ store, seat, nameOf, facts, t }: Pick<TableCanvasProps, "store" | "nameOf" | "facts"> & { seat: number; t: TableTokens }) {
  const game = useStore(store, (state) => state.game);
  const step = headingStepOf(game.sea?.heading);
  const owner = game.seats[seat];
  const ships = owner ? [...owner.heroes, ...owner.play].flatMap((id) => (game.cards[id] && facts.shipRank(game.cards[id]?.code ?? "") != null ? [game.cards[id]] : [])) : [];
  const pair = secondPilesOf(game).map((pile) => ({ name: PILE_WORDS[pile], count: pileIds(game, pile, seat).length }));
  const looked = lookedIds(game).length;
  if (!step && ships.length === 0 && pair.length === 0 && looked === 0) return null;
  return (
    <View className="mb-2">
      {step ? <Text className="text-label text-bone">{headingLine(step, headingLook(step).onCourse)}</Text> : null}
      {ships.length > 0 ? <Text className="text-label text-bone">{shipsLine(ships.map((card) => ({ name: nameOf(card?.code ?? ""), damage: card?.damage ?? 0 })))}</Text> : null}
      {pair.length > 0 ? <Text className="text-label text-bone">{secondSlotLine(pair)}</Text> : null}
      {looked > 0 ? <Text className="text-label text-muted" style={{ color: t.muted }}>{`Sailing test: ${looked} ${looked === 1 ? "card" : "cards"} looked at`}</Text> : null}
    </View>
  );
}

// The Discover look strip, in words, while the banner is on the beat that lays cards in it (emce.discover).
function DiscoverLook({ store, beats }: Pick<TableCanvasProps, "store" | "beats">) {
  const key = useStore(beats, (state) => state.key);
  const peeking = useStore(store, (state) => state.viewedSeat != null);
  const count = peeking ? 0 : lookIdsOf(beatIds(key)).length;
  return count > 0 ? <Text className="mb-2 text-label text-bone">{lookStripWords(count)}</Text> : null;
}

export function TableCanvas({ store, width, height, nameOf, inactive, facts, info, beats, onTap, onPreview, highlight: marked }: TableCanvasProps) {
  const t = useTableTokens();
  const s = useUiScale();
  const seat = useStore(store, (state) => shownSeat(state.game, state.viewedSeat));
  // Peeking at the other seat: nothing is outlined or filled, and a tap only previews (use-table-choice.ts).
  const highlight = useStore(store, (state) => state.viewedSeat != null) ? NO_HIGHLIGHT : marked;
  const rowProps = { store, seat, nameOf, inactive, info, facts, onTap, onPreview, highlight, t };
  const second = useStore(store, (state) => secondPilesOf(state.game));
  // The victory display is listed while a card is in it, as the canvas draws it.
  const victory = useStore(store, (state) => state.game.victory.length > 0);
  return (
    <ScrollView style={{ width, height }} contentContainerStyle={{ padding: 12 * s }}>
      <SeaLines store={store} seat={seat} nameOf={nameOf} facts={facts} t={t} />
      <DiscoverLook store={store} beats={beats} />
      {TABLE_ZONES.map((zone) => (
        <ZoneRow key={zone} zone={zone} {...rowProps} />
      ))}
      <View className="flex-row flex-wrap gap-1">
        {[...PILES, ...second, ...(victory ? (["victory"] as const) : [])].map((pile) => (
          <PileRow key={pile} pile={pile} {...rowProps} />
        ))}
      </View>
    </ScrollView>
  );
}
