// What the reader table lists and in which order (docs/design-system-table.md, Screen reader): the zones as headings, each with its cards,
// then the piles. The same selectors as the canvas table (table-canvas.native.tsx) give the cards; this file only orders and groups them, so a test
// reads the rows as plain data in node. Pure.
import type { PrintedCard } from "../../rules/core/printed.ts";
import type { ScenarioState } from "../../rules/core/state.ts";
import { lookedIds } from "../../rules/families/sea/sailing.ts";

import { headingLook, headingStepOf } from "../dream-chaser/heading.ts";
import { stagingThreatOf, zoneSpeech } from "../words/card-speech.ts";
import { headingLine, shipsLine } from "../words/scenarios/sea.ts";
import { lookStripWords } from "../words/scenarios/wilderland.ts";
import { PILES, secondPilesOf, pileSelector, victoryPileSelector, zoneSelector, type PileId, type PileView, type ZoneFacts, type ZoneId } from "../store/selectors.ts";
import { nameOfCard } from "./picture-key.ts";
import { pileSpeech } from "./pile-speech.ts";

/** The order of the zones: the quest and the active location(s), staging, engaged, the seat's heroes and play area, the hand. */
export const READER_ZONES: readonly ZoneId[] = ["questStage", "activeLocation", "secondActiveLocation", "staging", "engaged", "play", "hand"];

// A zone with nothing in it still has its heading where the player looks for cards (the active location, staging, engaged, the heroes and play area,
// the hand), and says "no cards"; the quest stage and the second active location leave their heading out until a card stands there.
const SHOWN_EMPTY: ReadonlySet<ZoneId> = new Set(["activeLocation", "staging", "engaged", "play", "hand"]);

export type ReaderItem =
  | { kind: "card"; id: string; zone: ZoneId }
  // `id` is what the canvas tap is given ("pile:discard"); `opens` is whether a tap opens the pile's list.
  | { kind: "pile"; id: string; pile: PileId; label: string; hint: string | null; opens: boolean }
  | { kind: "text"; text: string };

export type ReaderSection = { key: string; heading: string | null; items: readonly ReaderItem[] };

/** What the rows read besides the game: the table's lookups, the printed cards, the piles that wear the play mark, and the Discover look's size. */
export type ReaderRowsDeps = {
  facts: ZoneFacts;
  cards: ReadonlyMap<string, PrintedCard>;
  nameOf: (key: string) => string;
  // The piles (`pile:discard`) that hold a card the open window lets the seat play.
  playable: ReadonlySet<string>;
  // How many cards the banner's beat lays in the Discover look strip (0 when none).
  discover: number;
  // Whether the seat shown plays with the top card of its deck faceup (Gandalf, 142002:A:1): the deck then names that card.
  deckFaceUp?: boolean;
};

// The sea family's lines the reader table prints above the zones: the Heading, the seat's ships with their damage, and the Sailing test's look.
function seaNotes(game: ScenarioState, seat: number, deps: ReaderRowsDeps): ReaderItem[] {
  const notes: string[] = [];
  const step = headingStepOf(game.sea?.heading);
  if (step) notes.push(headingLine(step, headingLook(step).onCourse));
  const owner = game.seats[seat];
  const ships = owner ? [...owner.heroes, ...owner.play].flatMap((id) => (game.cards[id] && deps.facts.shipRank(game.cards[id]?.code ?? "") != null ? [game.cards[id]] : [])) : [];
  if (ships.length > 0) notes.push(shipsLine(ships.map((card) => ({ name: deps.nameOf(card?.code ?? ""), damage: card?.damage ?? 0 }))));
  const looked = lookedIds(game).length;
  if (looked > 0) notes.push(`Sailing test: ${looked} ${looked === 1 ? "card" : "cards"} looked at`);
  if (deps.discover > 0) notes.push(lookStripWords(deps.discover));
  return notes.map((text) => ({ kind: "text", text }));
}

// A pile's words: the count (and the points a victory display scores), a card playable from it, and the card on top or attached, as the reader table says them.
function pileItem(game: ScenarioState, view: PileView, deps: ReaderRowsDeps): ReaderItem {
  const id = `pile:${view.pile}`;
  const speech = pileSpeech({ zone: view.pile, count: view.ids.length, points: view.points }, deps.playable.has(id), view.pile === "grottoDeck" && view.top ? deps.nameOf(view.top.code) : null);
  // The grotto deck's label already names its top card.
  const faceUp = view.pile === "deck" && deps.deckFaceUp ? view.ids[0] : undefined;
  const topId = faceUp ?? (view.top && view.pile !== "grottoDeck" ? view.top.id : undefined);
  const top = topId ? `, ${nameOfCard(game.cards, topId, deps.nameOf)} on top` : "";
  const held = (view.attached ?? []).length > 0 ? `, ${(view.attached ?? []).map((card) => deps.nameOf(card.code)).join(", ")} attached` : "";
  return { kind: "pile", id, pile: view.pile, label: `${speech.label}${top}${held}`, hint: speech.hint, opens: speech.hint != null };
}

/**
 * The sections of the reader table for the seat shown: a leading section of the sea lines when there are any, one section per zone in
 * READER_ZONES order (each heading is `zoneSpeech`), and last the piles: the seat's deck and discard pile, the encounter pair, the second slot's
 * piles and the victory display once it holds a card. A card is followed by what is attached to it and by the characters paired with it in a fight.
 */
export function readerRows(game: ScenarioState, seat: number, deps: ReaderRowsDeps): readonly ReaderSection[] {
  const sections: ReaderSection[] = [];
  const notes = seaNotes(game, seat, deps);
  if (notes.length > 0) sections.push({ key: "notes", heading: null, items: notes });
  const threat = stagingThreatOf(game, seat, deps.cards);
  for (const zone of READER_ZONES) {
    const { entries } = zoneSelector(zone, seat, deps.facts)(game);
    if (entries.length === 0 && !SHOWN_EMPTY.has(zone)) continue;
    const cards = entries.flatMap(({ card, attached, paired }) => [card, ...attached, ...paired]);
    sections.push({
      key: zone,
      heading: zoneSpeech(zone, entries.length, seat, game, zone === "staging" ? threat : null),
      items: cards.map((card): ReaderItem => ({ kind: "card", id: card.id, zone })),
    });
  }
  const piles = [...PILES, ...secondPilesOf(game)].map((pile) => pileSelector(pile, seat)(game));
  const victory = game.victory.length > 0 ? (deps.facts.pointsOf ? victoryPileSelector(deps.facts.pointsOf)(game) : pileSelector("victory", seat)(game)) : null;
  sections.push({ key: "piles", heading: "Piles", items: [...piles, ...(victory ? [victory] : [])].map((view) => pileItem(game, view, deps)) });
  return sections;
}
