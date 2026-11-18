// Rules: rr.player-elimination, rr.draw, rr.printed, rr.the-word-choose (data/rules/entries.json); ledger lines 04124:A:1, 901703:A:1.
//
// Lost and Alone shuffles a hero into its owner's deck (`ScenarioState.heroesInDeck`, written only by that verb) and the hero is put into play when it is drawn; the Giant Cave Centipede shuffles the hand card with the highest printed cost back.
import type { Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import { currentCause, ruleCause } from "../../core/cause.ts";
import { printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { updateCard } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { lastPicked, putOnDeck } from "../../interpret/player-verbs.ts";
import { askTarget } from "../../windows/choices.ts";
import type { Focus } from "../index.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

/** ShuffleHeroIntoDeck: the picked hero, in play under the actor, is shuffled into its owner's deck and marked. */
export function shuffleHeroIntoDeck(state: ScenarioState): ScenarioState {
  const id = lastPicked(state);
  const card = id ? state.cards[id] : undefined;
  if (!id || !card || card.zone !== "heroes" || card.controller == null) return state;
  const moved = putOnDeck(state, id, "shuffle");
  return { ...moved, heroesInDeck: [...(moved.heroesInDeck ?? []).filter((other) => other !== id), id] };
}

/** The heroes a seat has drawn since they were shuffled into its deck are put into play at once, ready, with no damage or resources; the others stay marked. Nothing in a game that shuffled none. */
export function heroDrawn(state: ScenarioState, seat: number): ScenarioState {
  const marked = state.heroesInDeck;
  if (!marked || marked.length === 0) return state;
  let next = state;
  const left: string[] = [];
  for (const id of marked) {
    const card = next.cards[id];
    if (card && card.zone === "hand" && card.controller === seat) next = updateCard(moveCard(next, id, { zone: "heroes", seat }), id, { exhausted: false, damage: 0, resources: 0, face: "up" });
    else if (card && (card.zone === "deck" || card.zone === "hand")) left.push(id);
  }
  return { ...next, heroesInDeck: left };
}

/** Whether a hero of the seat lies in its deck or hand, waiting to be put into play: the seat is not out of heroes. */
export function heroWaiting(state: ScenarioState, seat: number): boolean {
  return (state.heroesInDeck ?? []).some((id) => state.cards[id]?.controller === seat && (state.cards[id]?.zone === "deck" || state.cards[id]?.zone === "hand"));
}

/** ShuffleHighestCostIntoDeck: see the schema entry; the actor chooses among the tied cards. */
export function shuffleHighestIntoDeck(state: ScenarioState, instruction: Verb<"ShuffleHighestCostIntoDeck">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const hand = state.seats[focus.seat]?.hand ?? [];
  const cost = (id: string) => printedOf(ctx.cards, state.cards[id]?.code ?? "").cost ?? 0;
  const most = Math.max(...hand.map(cost));
  const tied = hand.filter((id) => cost(id) === most);
  if (tied.length === 0) return state;
  const chosen = focus.chosen && tied.includes(focus.chosen) ? focus.chosen : tied.length === 1 ? tied[0] : undefined;
  if (!chosen) return askTarget(state, { instruction, seat: focus.seat, chosen: null, cause: currentCause(steps, ruleCause("rr.the-word-choose")) }, tied);
  return putOnDeck(state, chosen, "shuffle");
}
