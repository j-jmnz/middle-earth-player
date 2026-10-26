// Rules: rr.damage, rr.hit-points, rr.first-player (data/rules/entries.json).
import type { Instruction } from "../../catalog/boundary.ts";

import { frameScope, refCard, resolveAmount } from "../amounts.ts";
import { currentCause, UNATTRIBUTED } from "../cause.ts";
import type { EngineStep } from "../intents.ts";
import { drawOne, type ReduceContext } from "../interpret.ts";
import { placeDamage } from "../keywords.ts";
import type { ScenarioState } from "../state.ts";
import { livingSeats, updateCard } from "../state.ts";
import { pickedList } from "../player-verbs.ts";

import type { Focus } from "./index.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

// DrawEach: every living player draws, the first player first.
function drawEach(state: ScenarioState, instruction: Verb<"DrawEach">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const count = instruction.amount == null ? 1 : resolveAmount(state, instruction.amount, frameScope(state, focus.seat, focus.sourceId), ctx);
  const seats = livingSeats(state);
  const from = Math.max(0, seats.indexOf(state.firstPlayer));
  let next = state;
  for (const seat of [...seats.slice(from), ...seats.slice(0, from)]) for (let draw = 0; draw < count; draw += 1) next = drawOne(next, seat, steps, UNATTRIBUTED);
  return next;
}

// HealQuietly: damage comes off the card with no `healed` event.
function healQuietly(state: ScenarioState, instruction: Verb<"HealQuietly">, focus: Focus, ctx: ReduceContext): ScenarioState {
  const scope = frameScope(state, focus.seat, focus.sourceId);
  const id = refCard(state, instruction.target ?? "subject", scope) ?? "";
  const card = state.cards[id];
  if (!card || card.damage <= 0) return state;
  const amount = Math.min(card.damage, resolveAmount(state, instruction.amount, scope, ctx));
  return amount > 0 ? updateCard(state, id, { damage: card.damage - amount }) : state;
}

// MoveDamage: damage tokens go from the card picked before the last to the last picked card (rr.damage).
function moveDamage(state: ScenarioState, instruction: Verb<"MoveDamage">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const list = pickedList(state).filter((entry) => entry !== "" && !entry.startsWith("seat:"));
  const from = state.cards[list.at(-2) ?? ""];
  const to = state.cards[list.at(-1) ?? ""];
  if (!from || !to || from.id === to.id || from.damage <= 0) return state;
  const wanted = instruction.all ? from.damage : resolveAmount(state, instruction.amount ?? 1, frameScope(state, focus.seat, focus.sourceId), ctx);
  const amount = Math.min(from.damage, wanted);
  if (amount <= 0) return state;
  const taken = updateCard(state, from.id, { damage: from.damage - amount });
  return placeDamage(taken, to.id, amount, ctx.cards, steps, "player", currentCause(steps, UNATTRIBUTED));
}

// The verbs src/catalog/families/misc.ts adds, for constants and responses no other family takes, and the saga heroes and One Ring cards. Null when the verb is not one of them.
export function run(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  switch (instruction.verb) {
    case "DrawEach":
      return drawEach(state, instruction, focus, ctx, steps);
    case "HealQuietly":
      return healQuietly(state, instruction, focus, ctx);
    case "MoveDamage":
      return moveDamage(state, instruction, focus, ctx, steps);
    default:
      return null;
  }
}

