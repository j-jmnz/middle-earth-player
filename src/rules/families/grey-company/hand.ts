// Rules: rr.effects, rr.play-and-put-into-play (data/rules/entries.json); ledger lines 145063:B:2, 145064:B:3.
// The cards a player's hand loses whole, and the seat that cannot play cards from its hand for a phase.
import { discardFromHand } from "../../core/zones.ts";
import type { ScenarioState } from "../../core/state.ts";
import { heldAmount } from "../../core/state.ts";

/** DiscardHand: the whole hand of each seat named (the actor's, or the event seat's) goes to its owners' discard piles, in hand order, each announced as discarded from the hand. */
export function discardHand(state: ScenarioState, seats: readonly number[]): ScenarioState {
  let next = state;
  for (const seat of seats) {
    for (const id of [...(state.seats[seat]?.hand ?? [])]) {
      const card = next.cards[id];
      if (!card || card.zone !== "hand") continue;
      next = discardFromHand(next, id, card.owner ?? seat);
    }
  }
  return next;
}

/** Whether the seat holds `cannotPlayCards`: it plays no card from its hand (a card put into play is not played). */
export function playsBarred(state: ScenarioState, seat: number | undefined, putting: boolean | undefined): boolean {
  return putting !== true && seat != null && heldAmount(state, `seat:${seat}`, "cannotPlayCards") > 0;
}

/** The words for a refused play of a seat that holds `cannotPlayCards`, naming the card (from the hand, the discard pile or a deck). */
export function playsBarredReason(state: ScenarioState, name: string): string {
  const who = state.seatCount > 1 ? `Player ${state.activeSeat + 1} cannot` : "You cannot";
  return `${who} play ${name} or any card this phase.`;
}
