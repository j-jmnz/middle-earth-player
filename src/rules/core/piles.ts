// Rules: dcce.corsair-deck, dcce.uncharted-deck, emce.caves-deck, emce.evil-creatures-deck (data/rules/entries.json). The decks that lie beside the encounter deck as zones of their own: where
// each keeps its card list, which discard pile goes with it, and the pure list operations moveCard (zones.ts) and the deck helpers (decks.ts) share. The Corsair deck and the Uncharted deck of the
// Dream-chaser box and the decks of Ered Mithrin read and write their lists through one accessor, so a deck is a row in DECKS and not another copy of the code. Types and pure helpers only.
import { shuffleIds } from "./seed.ts";
import type { CardInstance, ScenarioState } from "./state.ts";
import { updateCard } from "./state.ts";

/** The zones of Ered Mithrin's decks, kept in `ScenarioState.piles`. */
export type PileZone = "cavesDeck" | "evilCreaturesDeck" | "evilCreaturesDiscard" | "spidersDeck" | "orcsDeck";
/** A zone that holds a list of card ids apart from the encounter deck: the Dream-chaser box's keep theirs in `corsairDeck`, `corsairDiscard` and `uncharted.deck`. */
export type DeckZone = PileZone | "corsairDeck" | "corsairDiscard" | "unchartedDeck";

/** A deck and the discard pile it refills from, or null for a deck that has none. */
export type DeckZones = { readonly deck: DeckZone; readonly discard: DeckZone | null };

/** The named decks with a discard pile of their own: a card of the deck that would be discarded goes there, and the deck is shuffled from it when it runs out. */
export const DECKS = {
  corsair: { deck: "corsairDeck", discard: "corsairDiscard" },
  evilCreatures: { deck: "evilCreaturesDeck", discard: "evilCreaturesDiscard" },
} as const satisfies Record<string, DeckZones>;

/** The decks with no discard pile: their cards are discarded to the encounter discard pile like any other encounter card (emce.caves-deck says nothing else), and an empty one stays empty. */
export const PLAIN_PILES = {
  caves: { deck: "cavesDeck", discard: null },
  spiders: { deck: "spidersDeck", discard: null },
  orcs: { deck: "orcsDeck", discard: null },
} as const satisfies Record<string, DeckZones>;

/** The piles a record names (`pile` of the wilderland verbs): every deck of Ered Mithrin. */
export const NAMED_PILES = { evilCreatures: DECKS.evilCreatures, ...PLAIN_PILES } as const;
export type PileName = keyof typeof NAMED_PILES;

/** The decks a card remembers it was dealt into (CardInstance.deck), so it goes back to that deck's own discard pile. */
export type MarkedDeck = NonNullable<CardInstance["deck"]>;
const MARK: Readonly<Partial<Record<DeckZone, MarkedDeck>>> = { evilCreaturesDeck: "evilCreatures", evilCreaturesDiscard: "evilCreatures" };

const NONE: readonly string[] = [];

/** Whether the zone is one of these decks or discard piles. */
export function isDeckZone(zone: string): zone is DeckZone {
  return zone === "corsairDeck" || zone === "corsairDiscard" || zone === "unchartedDeck" || zone === "cavesDeck" || zone === "evilCreaturesDeck" || zone === "evilCreaturesDiscard" || zone === "spidersDeck" || zone === "orcsDeck";
}

/** The ids in the zone, top first; empty when the game has not dealt it. */
export function pileOf(state: Pick<ScenarioState, "corsairDeck" | "corsairDiscard" | "uncharted" | "piles">, zone: DeckZone): readonly string[] {
  switch (zone) {
    case "corsairDeck":
      return state.corsairDeck ?? NONE;
    case "corsairDiscard":
      return state.corsairDiscard ?? NONE;
    case "unchartedDeck":
      return state.uncharted?.deck ?? NONE;
    default:
      return state.piles?.[zone] ?? NONE;
  }
}

/** The state with the zone's list replaced. The Uncharted deck lives inside `uncharted`, so a game without one is returned as it is. */
export function withPile(state: ScenarioState, zone: DeckZone, list: readonly string[]): ScenarioState {
  switch (zone) {
    case "corsairDeck":
      return { ...state, corsairDeck: list };
    case "corsairDiscard":
      return { ...state, corsairDiscard: list };
    case "unchartedDeck":
      return state.uncharted ? { ...state, uncharted: { ...state.uncharted, deck: list } } : state;
    default:
      return { ...state, piles: { ...state.piles, [zone]: list } };
  }
}

/** The card leaves the zone's list; the state is returned as it is when it was not in it. */
export function leavePile(state: ScenarioState, zone: DeckZone, id: string): ScenarioState {
  const list = pileOf(state, zone);
  return list.includes(id) ? withPile(state, zone, list.filter((other) => other !== id)) : state;
}

/** The card joins the bottom of the zone's list (once), and a card dealt into a deck with a discard pile of its own remembers which. */
export function joinPile(state: ScenarioState, zone: DeckZone, id: string): ScenarioState {
  const list = pileOf(state, zone);
  const joined = withPile(state, zone, list.includes(id) ? list : [...list, id]);
  const mark = MARK[zone];
  return mark !== undefined && joined.cards[id]?.deck !== mark ? updateCard(joined, id, { deck: mark }) : joined;
}

/** The zone's list shuffled with the game's seed, which moves the seed even for a deck of fewer than two cards. */
export function shufflePile(state: ScenarioState, zone: DeckZone): ScenarioState {
  const shuffled = shuffleIds(pileOf(state, zone), state.seed, state.seedCursor);
  return { ...withPile(state, zone, shuffled.ids), seedCursor: shuffled.cursor };
}

/** The first card of the zone's list. */
export function topOf(state: Pick<ScenarioState, "corsairDeck" | "corsairDiscard" | "uncharted" | "piles">, zone: DeckZone): string | undefined {
  return pileOf(state, zone)[0];
}

/** Where a card of a deck with a discard pile of its own goes when it would be discarded, or leave play for the victory display: the deck's own discard pile
 * ("place it in a separate Evil Creatures discard pile, even if it has victory points", emce.evil-creatures-deck). Any other destination is kept. */
export function deckRoute<Dest extends { zone: string }>(current: Pick<CardInstance, "deck" | "zone">, dest: Dest, inPlayNow: boolean): Dest | { zone: DeckZone } {
  if (current.deck === undefined) return dest;
  const discard = DECKS[current.deck].discard;
  if (dest.zone === "encounterDiscard" || (dest.zone === "victory" && inPlayNow)) return { zone: discard };
  return dest;
}
