// Rules: rr.forced, rr.in-play-and-out-of-play (data/rules/entries.json); ledger lines 11199:A:2, 11199:A:3. A card that is not a player card and moves between a hand and play: "Forced: When Recurring
// Nightmare enters your hand, add it to the staging area" (the draw announces it) and "When Recurring Nightmare leaves play, shuffle it into any player's deck" (settle announces every way out of play).
import type { Effect, Trigger } from "../../../catalog/boundary.ts";

import { gameReads } from "../../core/game-reads.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { effectsOfCard } from "../misc/text.ts";
import { queueEvent } from "../../windows/queue.ts";
import type { CardInstance, ScenarioState } from "../../core/state.ts";
import { inPlay } from "../../core/state.ts";

function listens(state: ScenarioState, instance: CardInstance, trigger: Trigger, ctx: ReduceContext): boolean {
  return effectsOfCard(state, ctx, instance).some((effect: Effect) => effect.trigger === trigger);
}

/** Each card a draw of `seat` put into its hand that has a record hearing `enteredHand` is announced (about the card, for the seat that drew it). Nothing is read in a game with no such card. */
export function announceEnteredHand(before: ScenarioState, after: ScenarioState, seat: number, ctx: ReduceContext): ScenarioState {
  if (!gameReads(after, ctx, '"trigger":"enteredHand"')) return after;
  const had = new Set(before.seats[seat]?.hand ?? []);
  let next = after;
  for (const id of after.seats[seat]?.hand ?? []) {
    const card = after.cards[id];
    if (!had.has(id) && card && listens(after, card, "enteredHand", ctx)) next = queueEvent(next, { trigger: "enteredHand", seat, cardId: id });
  }
  return next;
}

/** Every card in play that hears `exitedPlay` is watched; once one is out of play, however it left (destroyed, discarded, shuffled into a deck, returned to a hand, removed from the game), its own
 * `exitedPlay` is announced, once, to the card itself. The watch list is kept only in a game with such a card, so no other game's state changes. */
export function announceExits(state: ScenarioState, ctx: ReduceContext): ScenarioState {
  if (!gameReads(state, ctx, '"trigger":"exitedPlay"')) return state;
  const watched = state.exitWatch ?? [];
  let next = state;
  const now: string[] = [];
  for (const id of watched) {
    const card = state.cards[id];
    if (card && !inPlay(card.zone)) next = queueEvent(next, { trigger: "exitedPlay", seat: null, cardId: id });
    else if (card) now.push(id);
  }
  for (const card of Object.values(state.cards)) {
    if (inPlay(card.zone) && !watched.includes(card.id) && listens(state, card, "exitedPlay", ctx)) now.push(card.id);
  }
  const same = now.length === watched.length && now.every((id, at) => id === watched[at]);
  return same ? next : { ...next, exitWatch: now };
}
