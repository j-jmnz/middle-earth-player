// Rules: rr.damage, rr.cancel (data/rules/entries.json); ledger line 06053:A:1.
// "Deals 1 damage to that hero ... If no hero takes damage": the effect's X is set only when the picked card's damage grew, so damage that a response canceled or a rule prevented sets nothing. The responses to the damage are heard before the next step of the effect runs, so
// the step after the damage reads what stayed. The verb queues the damage, then itself with the damage the card held before (`before`, the engine's own field).
import type { Instruction } from "../../../catalog/boundary.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ScenarioState } from "../../core/state.ts";
import { frameScope, refCard } from "../../interpret/amounts.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { runInstruction } from "../../interpret/interpret.ts";
import type { Focus } from "../index.ts";
import { patchTop, topFrame } from "../../windows/windows.ts";

type Verb = Extract<Instruction, { verb: "DamageCardThenSetX" }>;

export function damageCardThenSetX(state: ScenarioState, instruction: Verb, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const id = refCard(state, "picked", frameScope(state, focus.seat, focus.sourceId)) ?? "";
  const card = state.cards[id];
  if (!card) return state;
  if (instruction.before == null) {
    const data = topFrame(state)?.data;
    if (data?.kind !== "effect") return state;
    const queue = [
      { instruction: { verb: "DamageCard", amount: instruction.amount, target: "picked" } as Instruction, seat: focus.seat, chosen: null },
      { instruction: { ...instruction, before: card.damage }, seat: focus.seat, chosen: null },
    ];
    return patchTop(state, { data: { ...data, queue: [...queue, ...data.queue] } });
  }
  return card.damage > instruction.before ? runInstruction(state, { verb: "SetX", value: instruction.value }, focus, ctx, steps) : state;
}
