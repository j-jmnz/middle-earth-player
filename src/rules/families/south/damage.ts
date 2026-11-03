// Rules: rr.damage, rr.the-word-choose, rr.in-player-order (data/rules/entries.json); Redhorn Pass (142029:A:2).
//
// AssignDamage: "each player assigns X damage among characters he controls". The first call queues one assignment for each player
// in player order; each assignment places one damage at a time on the card its player chooses (one candidate is taken without
// asking) and queues itself again with one damage fewer.
import type { Instruction } from "../../../catalog/boundary.ts";

import { frameScope, resolveAmount } from "../../amounts.ts";
import { askTarget } from "../../choices.ts";
import { currentCause, UNATTRIBUTED } from "../../cause.ts";
import type { EngineStep } from "../../intents.ts";
import type { ReduceContext } from "../../interpret.ts";
import { placeDamage } from "../../keywords.ts";
import { moveCard } from "../../zones.ts";
import { pickCandidates } from "../../pick.ts";
import type { ScenarioState } from "../../state.ts";
import { inPlay, livingSeats } from "../../state.ts";
import type { Focus } from "../index.ts";
import { effectData } from "../encounter/moves.ts";
import { queueFront } from "../play/refs.ts";
import { queueEvent } from "../../queue.ts";

type Assign = Extract<Instruction, { verb: "AssignDamage" }>;

export function assignDamage(state: ScenarioState, instruction: Assign, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const cause = currentCause(steps, UNATTRIBUTED);
  if (instruction.left == null) {
    const total = resolveAmount(state, instruction.amount, frameScope(state, focus.seat, focus.sourceId), ctx);
    if (total <= 0) return state;
    const seats = instruction.who === "eachSeat" ? livingSeats(state) : [focus.seat];
    return queueFront(state, seats.map((seat) => ({ instruction: { ...instruction, who: undefined, left: total, of: total }, seat, chosen: null, cause })));
  }
  if (instruction.left <= 0) return state;
  const options = pickCandidates(state, instruction.pick, focus.seat, [], focus.sourceId, ctx).filter((id) => inPlay(state.cards[id]?.zone ?? "removed"));
  if (options.length === 0) return state;
  const chosen = focus.chosen && options.includes(focus.chosen) ? focus.chosen : options.length === 1 ? options[0] : undefined;
  if (!chosen) return effectData(state) ? askTarget(state, { instruction, seat: focus.seat, chosen: null, cause }, options) : state;
  const dealt = placeDamage(state, chosen, 1, ctx.cards, steps, "framework", cause);
  if (instruction.left <= 1) return dealt;
  return queueFront(dealt, [{ instruction: { ...instruction, left: instruction.left - 1 }, seat: focus.seat, chosen: null, cause }]);
}

// DiscardEach: each card that matches goes to its owner's discard pile, as DiscardPicked sends one.
export function discardEach(state: ScenarioState, instruction: Extract<Instruction, { verb: "DiscardEach" }>, focus: Focus, ctx: ReduceContext): ScenarioState {
  let next = state;
  for (const id of pickCandidates(state, instruction.pick, focus.seat, [], focus.sourceId, ctx)) {
    const card = next.cards[id];
    const seat = card?.owner ?? card?.controller;
    if (!card || seat == null) continue;
    next = moveCard(next, id, { zone: "discard", seat });
    // A card from a hand is "discarded from your hand" (01079:A:1, Eyes of the Forest, makes each player discard the events in his).
    if (card.zone === "hand") next = queueEvent(next, { trigger: "discardedFromHand", seat, cardId: id });
  }
  return next;
}
