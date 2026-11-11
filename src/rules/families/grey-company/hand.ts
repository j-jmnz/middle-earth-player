// Rules: rr.effects, rr.play-and-put-into-play (data/rules/entries.json); ledger lines 145063:B:2, 145064:B:3.
// The cards a player's hand loses whole, and the seat that cannot play cards from its hand for a phase.
import type { EngineStep } from "../../core/intents.ts";
import { moveCard } from "../../core/zones.ts";
import { queueEvent } from "../../windows/queue.ts";
import type { ScenarioState } from "../../core/state.ts";
import { heldAmount } from "../../core/state.ts";
import type { Focus } from "../index.ts";

/** DiscardHand: the actor's whole hand goes to its owners' discard piles, in hand order, each announced as discarded from the hand. */
export function discardHand(state: ScenarioState, focus: Focus, _steps: EngineStep[]): ScenarioState {
  let next = state;
  for (const id of [...(state.seats[focus.seat]?.hand ?? [])]) {
    const card = next.cards[id];
    if (!card || card.zone !== "hand") continue;
    const owner = card.owner ?? focus.seat;
    next = queueEvent(moveCard(next, id, { zone: "discard", seat: owner }), { trigger: "discardedFromHand", seat: owner, cardId: id });
  }
  return next;
}

/** Whether the seat holds `cannotPlayCards`: it plays no card from its hand (a card put into play is not played). */
export function playsBarred(state: ScenarioState, seat: number | undefined, putting: boolean | undefined): boolean {
  return putting !== true && seat != null && heldAmount(state, `seat:${seat}`, "cannotPlayCards") > 0;
}

/** The words for a refused play of a seat that holds `cannotPlayCards`. */
export function playsBarredReason(state: ScenarioState): string {
  const who = state.seatCount > 1 ? `Player ${state.activeSeat + 1} cannot` : "You cannot";
  return `${who} play cards this phase.`;
}
