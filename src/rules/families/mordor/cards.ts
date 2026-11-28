// Rules: rr.discard-pile-and-victory-display, rr.printed, rr.card-types (data/rules/entries.json); ledger lines 21083:B:1, 21084:B:1 (docs/scenarios/vengeance-of-mordor/the-temple-of-doom.md, Readings).
// What the stage 2B cards of The Temple of Doom read of the cards their effect discarded: the different card types among the encounter cards discarded (Memory of the Dark Years), and the copies of a player's discarded cards that he holds (Shrine to Sauron).
import type { Amount } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import { printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { inPlay } from "../../core/state.ts";
import { destroyCard } from "../../core/keywords.ts";
import { moveCard } from "../../core/zones.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { effectData } from "../encounter/moves.ts";
import type { Focus } from "../index.ts";

/** The amount `discardedEncounterTypes`: how many different card types the running effect's DiscardEncounterTop discarded. Null for another amount. */
export function discardedTypesAmount(state: ScenarioState, found: Exclude<Amount, number>, ctx: ReduceContext): number | null {
  if (!found.discardedEncounterTypes) return null;
  return new Set((effectData(state)?.looked ?? []).map((id) => printedOf(ctx.cards, state.cards[id]?.code ?? "").type)).size;
}

/** DiscardCopiesOfLooked: the actor discards each card in his hand, and each card he controls in play, that has the title of a card the running effect just discarded from his deck (DiscardFromDeck). */
export function discardCopiesOfLooked(state: ScenarioState, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const titles = new Set((effectData(state)?.looked ?? []).map((id) => printedOf(ctx.cards, state.cards[id]?.code ?? "").name));
  if (titles.size === 0) return state;
  const seat = state.seats[focus.seat];
  if (!seat) return state;
  const copies = (id: string): boolean => titles.has(printedOf(ctx.cards, state.cards[id]?.code ?? "").name);
  const held = seat.hand.filter(copies).reduce((next, id) => moveCard(next, id, { zone: "discard", seat: focus.seat }), state);
  const controlled = Object.values(held.cards).filter((card) => inPlay(card.zone) && card.controller === focus.seat && card.host == null && copies(card.id));
  return controlled.reduce((next, card) => destroyCard(next, card.id, ctx.cards, steps), held);
}
