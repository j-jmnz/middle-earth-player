// Rules: rr.encounter-deck, rr.reveal, rr.staging, rr.ownership-and-control, rr.in-play-and-out-of-play, rr.removed-from-game
// (data/rules/entries.json). The Rules Reference in data/rules has no span for the Encounter keyword; this follows the printed
// cards (Ranger Summons, Flight of the Eagles, Tom Bombadillo!): a card with the Encounter keyword is not drawn with the player's
// deck but set aside at the start of the game, a player card effect shuffles it into the encounter deck, and it is revealed there
// like an encounter card.
import type { Instruction } from "../../catalog/boundary.ts";
import type { ReduceContext } from "../interpret.ts";
import { effectsOf } from "../listen.ts";
import type { PrintedCard } from "../printed.ts";
import { queueEvent } from "../queue.ts";
import type { ScenarioState } from "../state.ts";
import { updateCard } from "../state.ts";
import { shuffleIntoEncounterDeck } from "../verbs.ts";
import { moveCard } from "../zones.ts";
import type { Focus } from "./index.ts";
import { lastPickedSeat } from "./play-refs.ts";

// Whether the card prints the Encounter keyword (an `EncounterKeyword` constant).
export function hasEncounterKeyword(ctx: Pick<ReduceContext, "effects">, code: string): boolean {
  return effectsOf(ctx, code).some((effect) => effect.timing === "constant" && effect.instructions.some((instruction) => instruction.verb === "EncounterKeyword"));
}

// Setup: the cards of a player's deck with the Encounter keyword are set aside, still that player's cards (owner), before the deck
// is shuffled and the opening hand is drawn.
export function setAsideEncounterCards(state: ScenarioState, seat: number, ctx: ReduceContext): ScenarioState {
  let next = state;
  for (const id of state.seats[seat]?.deck ?? []) {
    const card = next.cards[id];
    if (!card || !hasEncounterKeyword(ctx, card.code)) continue;
    next = updateCard(moveCard(next, id, { zone: "setAside" }), id, { owner: seat });
  }
  return next;
}

// A revealed card that is a player card (an Encounter-keyword ally or event) and is still in the staging area once its When Revealed
// effects are done is discarded, as a treachery is (rr.treachery-cards).
export function discardsAfterReveal(printed: PrintedCard): boolean {
  return printed.type === "event" || printed.type === "ally";
}

// ShuffleSetAsideIntoEncounterDeck: one set-aside copy of the card (the actor's own with `own`) is shuffled into the encounter deck.
export function shuffleSetAside(state: ScenarioState, instruction: Extract<Instruction, { verb: "ShuffleSetAsideIntoEncounterDeck" }>, focus: Focus): ScenarioState {
  const found = state.setAside.find((id) => {
    const card = state.cards[id];
    return card != null && card.code === instruction.code && (!instruction.own || (card.owner ?? card.controller) === focus.seat);
  });
  return found ? shuffleIntoEncounterDeck(state, found) : state;
}

// TakeRevealedCard: the source card, an Encounter-keyword player card just revealed into the staging area, enters the chosen
// player's play area: ready (or committed to the quest), controlled by that player, and still its owner's card.
export function takeRevealed(state: ScenarioState, instruction: Extract<Instruction, { verb: "TakeRevealedCard" }>, focus: Focus): ScenarioState {
  const card = focus.sourceId ? state.cards[focus.sourceId] : undefined;
  if (!card || card.zone !== "staging") return state;
  const seat = instruction.who === "picked" ? lastPickedSeat(state) : instruction.who === "firstPlayer" ? state.firstPlayer : focus.seat;
  if (seat == null || state.seats[seat]?.eliminated) return state;
  const clock = state.clock + 1;
  let next = moveCard({ ...state, clock }, card.id, { zone: "play", seat });
  next = updateCard(next, card.id, { face: "up", exhausted: false, committed: instruction.committed === true, enteredPlay: clock });
  return queueEvent(next, { trigger: "enteredPlay", seat, cardId: card.id });
}
