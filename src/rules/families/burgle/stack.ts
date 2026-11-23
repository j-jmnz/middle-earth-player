// Rules: hob.burgle, rr.in-play-and-out-of-play (data/rules/entries.json); ledger lines 132071:A:1, 132072:B:1. The Erebor treasures stacked facedown under The Lonely Mountain: out of play under it, in the order the Setup shuffled them; the top one goes into the first player's hand.
import type { Instruction } from "../../../catalog/boundary.ts";

import { shuffleIds } from "../../core/seed.ts";
import type { CardInstance, ScenarioState } from "../../core/state.ts";
import { inPlay, updateCard } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import type { Focus } from "../index.ts";

function hostOf(state: ScenarioState, code: string): CardInstance | undefined {
  return Object.values(state.cards).find((card) => card.code === code && inPlay(card.zone));
}

/** The cards stacked under the card, the top one first. */
export function stackedUnder(state: ScenarioState, hostId: string): string[] {
  return Object.values(state.cards)
    .filter((card) => card.zone === "under" && card.host === hostId && card.stackedAt != null)
    .sort((left, right) => (left.stackedAt ?? 0) - (right.stackedAt ?? 0))
    .map((card) => card.id);
}

/** StackUnder: the set-aside cards with these codes are shuffled (the game's seed) and lie facedown, top first, under the card in play with the code `under`. With no such host nothing moves. */
export function stackUnder(state: ScenarioState, instruction: Extract<Instruction, { verb: "StackUnder" }>): ScenarioState {
  const host = hostOf(state, instruction.under);
  const set = state.setAside.filter((id) => instruction.codes.includes(state.cards[id]?.code ?? "")).sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
  if (!host || set.length === 0) return state;
  const rolled = shuffleIds(set, state.seed, state.seedCursor);
  let next: ScenarioState = { ...state, seedCursor: rolled.cursor };
  rolled.ids.forEach((id, place) => {
    next = updateCard(moveCard(next, id, { zone: "under", locationId: host.id }), id, { face: "down", controller: null, stackedAt: place });
  });
  return next;
}

/** TakeStacked: the top card under the card in play with the code `under` joins the hand of the first player, who owns it from now on. An empty stack gives nothing. */
export function takeStacked(state: ScenarioState, instruction: Extract<Instruction, { verb: "TakeStacked" }>, focus: Focus): ScenarioState {
  const host = hostOf(state, instruction.under);
  const top = host ? stackedUnder(state, host.id)[0] : undefined;
  const seat = state.seats[state.firstPlayer]?.eliminated ? focus.seat : state.firstPlayer;
  if (!top || state.seats[seat]?.eliminated) return state;
  const moved = moveCard(state, top, { zone: "hand", seat });
  const card = moved.cards[top];
  if (!card) return moved;
  const { stackedAt: _gone, ...kept } = card;
  return { ...moved, cards: { ...moved.cards, [top]: { ...kept, owner: seat, controller: seat, face: "up" } } };
}
