// Rules: rm.out-of-play-deck, rm.mugash-player-card-backs, rm.searches-x, rr.in-play-and-out-of-play, rr.ownership-and-control (data/rules/entries.json); ledger lines 07062:A:1, 07029:A:1, 07027:A:2, 07028:A:1, 07026:A:1.
// To Catch an Orc's out-of-play decks: each seat's own facedown stack of 20 cards, the zone `outOfPlay0` or `outOfPlay1` (core/piles.ts, list top first). A card there is out of play, owned by its player (an enemy shuffled in has no owner), and counts for nothing that names
// the player's deck. The four verbs build it, shuffle Mugash and his Guards into it, reveal from it and put a hand card into it. Pure.
import type { Instruction } from "../../../catalog/boundary.ts";

import { currentCause, UNATTRIBUTED } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import { nextUint, shuffleIds } from "../../core/seed.ts";
import { pileOf, shufflePile, withPile, type PileZone } from "../../core/piles.ts";
import { printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { distinctChoices, updateCard } from "../../core/state.ts";
import { moveCard, turnedUp } from "../../core/zones.ts";
import { frameScope, resolveAmount } from "../../interpret/amounts.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { askTarget } from "../../windows/choices.ts";
import { effectData, moveEncounter } from "../encounter/moves.ts";
import type { Focus } from "../index.ts";
import { heldInHand } from "./hand.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

/** The zone of a seat's out-of-play deck: a game has one or two seats. */
export function outOfPlayZone(seat: number): PileZone {
  return seat === 0 ? "outOfPlay0" : "outOfPlay1";
}

/** Whether the game dealt out-of-play decks (07062 built them). False in every other game, so no hook of the family reads a pile there. */
export function hasOutOfPlayDecks(state: ScenarioState): boolean {
  return state.piles?.outOfPlay0 !== undefined;
}

// A card joins the bottom of a seat's pile, facedown, owned by `owner` (an encounter card has none). moveCard leaves the owner and the face as they were and clears the controller.
function putIn(state: ScenarioState, id: string, seat: number, owner: number | undefined): ScenarioState {
  return updateCard(moveCard(state, id, { zone: outOfPlayZone(seat) }), id, { face: "down", owner });
}

/** CreateOutOfPlayDecks: each seat moves the top `count` cards of its deck (all it holds, when fewer) into its pile, facedown and in the same order. Every seat has a pile afterward, empty or not. */
export function createOutOfPlayDecks(state: ScenarioState, instruction: Verb<"CreateOutOfPlayDecks">): ScenarioState {
  let next = state;
  for (let seat = 0; seat < state.seatCount; seat += 1) {
    next = withPile(next, outOfPlayZone(seat), pileOf(next, outOfPlayZone(seat)));
    for (const id of (state.seats[seat]?.deck ?? []).slice(0, instruction.count)) next = putIn(next, id, seat, seat);
  }
  return next;
}

/** ShuffleIntoOutOfPlayDecks: Mugash and one Guard for each other player, the set-aside copies, are dealt to the seats at random, one each, and every pile is shuffled. A game of one seat gets Mugash alone; the Guards left stay set aside. */
export function shuffleIntoOutOfPlayDecks(state: ScenarioState, instruction: Verb<"ShuffleIntoOutOfPlayDecks">): ScenarioState {
  const aside = (code: string): string[] => state.setAside.filter((id) => state.cards[id]?.code === code);
  const dealt = [...aside(instruction.once).slice(0, 1), ...aside(instruction.perOtherPlayer).slice(0, state.seatCount - 1)];
  const order = shuffleIds(dealt, state.seed, state.seedCursor);
  let next: ScenarioState = { ...state, seedCursor: order.cursor };
  order.ids.forEach((id, seat) => {
    next = putIn(next, id, seat, undefined);
  });
  for (let seat = 0; seat < state.seatCount; seat += 1) next = shufflePile(next, outOfPlayZone(seat));
  return next;
}

/**
 * RevealOutOfPlay: the actor reveals the top `amount` cards of its pile (all it holds). Each enemy is added to the staging area, not revealed; any other card goes to its owner's discard pile. With `chooseForHand` the actor picks one of the other cards for its hand first
 * ("Searches X"); the rest are discarded, and the pile is not shuffled. An empty pile reveals nothing. `revealed` is the cards the first step left to choose among.
 */
export function revealOutOfPlay(state: ScenarioState, instruction: Verb<"RevealOutOfPlay">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const seat = focus.seat;
  const zone = outOfPlayZone(seat);
  const chosenFrom = instruction.revealed;
  let next = state;
  let others: readonly string[];
  if (chosenFrom == null) {
    const amount = resolveAmount(state, instruction.amount, frameScope(state, seat, focus.sourceId), ctx);
    const top = pileOf(state, zone).slice(0, Math.max(0, amount));
    for (const id of top) if (printedOf(ctx.cards, state.cards[id]?.code ?? "").type === "enemy") next = moveEncounter(next, id, "staging", seat, ctx, steps);
    others = top.filter((id) => next.cards[id]?.zone === zone);
  } else {
    others = chosenFrom.filter((id) => next.cards[id]?.zone === zone);
  }
  if (instruction.chooseForHand === true && others.length > 0) {
    const options = distinctChoices(next, others);
    const chosen = focus.chosen != null && others.includes(focus.chosen) ? focus.chosen : options.length === 1 || !effectData(next) ? options[0] : undefined;
    if (chosen == null) return askTarget(next, { instruction: { ...instruction, revealed: [...others] }, seat, chosen: null, cause: currentCause(steps, UNATTRIBUTED) }, options);
    next = updateCard(moveCard(next, chosen, { zone: "hand", seat }), chosen, { face: turnedUp(next, chosen), owner: undefined });
    others = others.filter((id) => id !== chosen);
  }
  for (const id of others) next = updateCard(moveCard(next, id, { zone: "discard", seat }), id, { face: "up", owner: undefined });
  return next;
}

/** ShuffleHandCardIntoOutOfPlay: the actor puts one random card of its hand into its pile, facedown, and the pile is shuffled (a random place). A card that cannot leave the hand is not among the cards drawn at random; an empty hand does nothing. */
export function shuffleHandCardIntoOutOfPlay(state: ScenarioState, focus: Focus): ScenarioState {
  const seat = focus.seat;
  if (!hasOutOfPlayDecks(state)) return state;
  const hand = (state.seats[seat]?.hand ?? []).filter((held) => !heldInHand(state, held));
  const id = hand.length === 0 ? undefined : hand[nextUint(state.seed, state.seedCursor) % hand.length];
  if (id == null) return state;
  return shufflePile(putIn({ ...state, seedCursor: state.seedCursor + 1 }, id, seat, seat), outOfPlayZone(seat));
}

/**
 * The settle sweep for an eliminated seat's out-of-play deck (rr.player-elimination: the eliminated player's deck goes to its owners' discard piles). Each card of the pile turns faceup: a player card goes to the discard pile of its owner, and Mugash or a Guard, which no player owns
 * (rr.ownership-and-control), to the encounter discard pile, so a later reset of the encounter deck can reveal him: the game stays winnable. Nothing happens in a game with no out-of-play deck, once the game is lost, or for a seat still in the game.
 */
export function discardEliminatedDecks(state: ScenarioState): ScenarioState {
  if (state.lost || !hasOutOfPlayDecks(state)) return state;
  let next = state;
  for (let seat = 0; seat < state.seatCount; seat += 1) {
    if (!state.seats[seat]?.eliminated) continue;
    for (const id of pileOf(next, outOfPlayZone(seat))) {
      const owner = next.cards[id]?.owner;
      next = updateCard(moveCard(next, id, owner == null ? { zone: "encounterDiscard" } : { zone: "discard", seat: owner }), id, { face: "up" });
    }
  }
  return next;
}
