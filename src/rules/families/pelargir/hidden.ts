// Rules: ats.hidden-cards, rr.running-out-of-cards, rr.in-play-and-out-of-play, rr.travel (data/rules/entries.json); ledger lines 06117:B:1, 06122:A:1, 06123:A:3, 06128:A:3, 06130:A:2.
// The hidden cards of The Blood of Gondor. A hidden card is the top card of the encounter deck set aside facedown in a player's play area: zone setAside, `face` down, `owner` the seat, `hiddenAt` the order in which cards were taken. It is out of play, so its text is inert, and it is controlled by
// nobody, so no sweep of an eliminated seat moves it. Hidden information: no EngineStep names a card of a hidden list, and the table lists the cards as facedown (AsideSecret in the family manifest). All randomness comes from the game's seed.
import type { AmountExpr, Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import { shuffleIds } from "../../core/seed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { updateCard } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import type { AmountScope } from "../../interpret/amounts.ts";
import { reshuffleDiscard, seatFor } from "../../interpret/verbs.ts";
import type { Focus } from "../index.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

/** The hidden cards of a seat (every seat with `undefined`), the card taken first first. */
export function hiddenIds(state: ScenarioState, seat?: number): string[] {
  return state.setAside
    .filter((id) => state.cards[id]?.hiddenAt != null && (seat == null || state.cards[id]?.owner === seat))
    .sort((left, right) => (state.cards[left]?.hiddenAt ?? 0) - (state.cards[right]?.hiddenAt ?? 0));
}

/** A card leaves the hidden list: it is no longer owned by a seat or set aside in order. */
export function unhide(state: ScenarioState, id: string): ScenarioState {
  return updateCard(state, id, { face: "up", hiddenAt: undefined, owner: undefined });
}

/** The cards a taker can still take: the encounter deck and its discard pile. */
export function hiddenSupply(state: ScenarioState): number {
  return state.encounterDeck.length + state.encounterDiscard.length;
}

/** Takes `amount` cards one at a time: the discard pile is shuffled into an empty deck first, and nothing is taken when both piles are empty (hidden.take-empty-both). */
export function takeHidden(state: ScenarioState, seat: number, amount: number, steps: EngineStep[]): ScenarioState {
  let next = state;
  for (let taken = 0; taken < amount; taken += 1) {
    const ready = reshuffleDiscard(next, steps, "rr.running-out-of-cards");
    const id = ready.encounterDeck[0];
    if (!id) return ready;
    const order = Math.max(0, ...Object.values(ready.cards).map((card) => card.hiddenAt ?? 0)) + 1;
    next = updateCard(moveCard(ready, id, { zone: "setAside" }), id, { face: "down", controller: null, owner: seat, hiddenAt: order });
  }
  return next;
}

/** TakeHiddenCard: the acting player (or the first player) takes the top cards of the encounter deck as hidden cards, unseen and not revealed (hidden.taken-not-revealed). */
export function takeHiddenCard(state: ScenarioState, instruction: Verb<"TakeHiddenCard">, focus: Focus, steps: EngineStep[]): ScenarioState {
  const seat = seatFor(state, instruction.who, focus.seat);
  return state.seats[seat]?.eliminated ? state : takeHidden(state, seat, instruction.amount ?? 1, steps);
}

/** One hidden card of the seat chosen with the game's seed, or null with none; a single card is taken without touching the seed. */
export function randomHidden(state: ScenarioState, seat: number): { id: string; state: ScenarioState } | null {
  const ids = hiddenIds(state, seat);
  if (ids.length <= 1) return ids[0] ? { id: ids[0], state } : null;
  const rolled = shuffleIds(ids, state.seed, state.seedCursor);
  return { id: rolled.ids[0] ?? ids[0] ?? "", state: { ...state, seedCursor: rolled.cursor } };
}

/** DiscardHiddenCard: one hidden card of the seat, chosen at random, goes to the encounter discard pile unresolved: discarding is not turning faceup (06128:A:3). */
export function discardHiddenCard(state: ScenarioState, instruction: Verb<"DiscardHiddenCard">, focus: Focus): ScenarioState {
  const found = randomHidden(state, seatFor(state, instruction.who, focus.seat));
  return found ? moveCard(unhide(found.state, found.id), found.id, { zone: "encounterDiscard" }) : state;
}

/** The amount `hidden`: the cards in the acting player's play area, or in all of them. Null for any other amount. */
export function hiddenAmount(state: ScenarioState, amount: AmountExpr, scope: AmountScope): number | null {
  if (!amount.hidden) return null;
  return hiddenIds(state, amount.hidden === "own" ? scope.actor : undefined).length;
}

/** A Travel cost of this verb cannot be paid: the deck and the discard pile hold fewer cards than it takes (hidden.take-empty-both). */
export function takeHiddenUnpayable(state: ScenarioState, instruction: Instruction): boolean {
  return instruction.verb === "TakeHiddenCard" && hiddenSupply(state) < (instruction.amount ?? 1);
}
