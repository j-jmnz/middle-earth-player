// Rules: dcce.uncharted, dcce.uncharted-deck (data/rules/entries.json). The Uncharted deck of a new game: the double-sided locations the scenario deals, each Lost Island side up, and the
// codes that go back into it when they would be discarded (every card of the world with the Uncharted keyword, the set-aside Shrine to Morgoth included).
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { ScenarioState } from "../../core/state.ts";
import { updateCard } from "../../core/state.ts";
import { spawn } from "../../core/zones.ts";

export function dealUnchartedDeck(state: ScenarioState, codes: readonly string[], ctx: Pick<ReduceContext, "cards">): ScenarioState {
  const double = [...ctx.cards.values()].filter((printed) => printed.keywords.uncharted).map((printed) => printed.code);
  let next: ScenarioState = { ...state, uncharted: { deck: [], codes: [...new Set([...double, ...codes])] } };
  for (const code of codes) next = spawn(next, code, { zone: "unchartedDeck" }, "B").state;
  return next;
}

/** A card of a scenario with two sides that are two catalog cards: `code` the side dealt faceup, `back` the other. `grottoDeck`: dealt into the Grotto deck; `setAside`: dealt by the Setup's SetAside (data `back`). */
export type DoubleSidedCard = { code: string; back: string; pile: "grottoDeck" | "setAside" };

/**
 * The Grotto deck of a new game (dcce.grotto-deck): each card of the pile in the deck zone, Grotto side faceup with its own Underwater side behind it (`other`, the pairings differ card to card),
 * and the Underwater side of a Grotto card the Setup sets aside (the Shrine to Morgoth). The Grotto codes go back into the deck when they would be discarded. A set-aside pairing of a card that is not a
 * Grotto location (the Stormcaller Elite's sides) is not a Grotto pairing and changes nothing; with nothing to deal the state is returned as it was.
 */
export function dealDoubleSided(state: ScenarioState, cards: readonly DoubleSidedCard[], ctx: Pick<ReduceContext, "cards">): ScenarioState {
  const deck = cards.filter((card) => card.pile === "grottoDeck");
  const aside = cards.filter((card) => card.pile === "setAside" && (ctx.cards.get(card.code)?.traits ?? []).includes("Grotto"));
  if (deck.length === 0 && aside.length === 0) return state;
  const before = state.uncharted;
  const pairs = { ...before?.pairs, ...Object.fromEntries(aside.map((card) => [card.code, card.back])) };
  let next: ScenarioState = {
    ...state,
    uncharted: { deck: before?.deck ?? [], codes: [...new Set([...(before?.codes ?? []), ...deck.map((card) => card.code), ...aside.map((card) => card.code)])], ...(before?.island ? { island: before.island } : {}), ...(Object.keys(pairs).length > 0 ? { pairs } : {}) },
  };
  for (const card of deck) {
    const spawned = spawn(next, card.code, { zone: "unchartedDeck" }, "up");
    next = updateCard(spawned.state, spawned.id, { face: "up", other: card.back });
  }
  return next;
}
