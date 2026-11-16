// Rules: rr.damage, rr.forced (data/rules/entries.json); ledger line 900704:A:1.
// "Deal 1 damage to that character if it has not been dealt damage by another copy of Brambles and Thorns this round": the first copy to resolve deals it and marks the character for the round by the title; the others find the mark and deal nothing.
import type { Instruction } from "../../../catalog/boundary.ts";

import { frameScope, refCard, resolveAmount } from "../../interpret/amounts.ts";
import { currentCause, UNATTRIBUTED } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { addModifier, placeDamage } from "../../core/keywords.ts";
import type { ScenarioState } from "../../core/state.ts";
import type { Focus } from "../index.ts";

/** DamageOncePerRound: damage from the source unless a card of its title already dealt the target damage this round; the target is marked when the damage grew. */
export function damageOncePerRound(state: ScenarioState, instruction: Extract<Instruction, { verb: "DamageOncePerRound" }>, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const scope = frameScope(state, focus.seat, focus.sourceId);
  const id = refCard(state, instruction.target ?? "subject", scope);
  const target = id ? state.cards[id] : undefined;
  const title = focus.sourceId ? state.cards[focus.sourceId]?.code : undefined;
  if (!id || !target || !focus.sourceId || title == null) return state;
  if (state.modifiers.some((modifier) => modifier.instanceId === id && modifier.stat === "damagedByTitle" && state.cards[modifier.sourceId]?.code === title)) return state;
  const dealt = placeDamage(state, id, resolveAmount(state, instruction.amount, scope, ctx), ctx.cards, steps, "framework", currentCause(steps, UNATTRIBUTED));
  return (dealt.cards[id]?.damage ?? 0) > target.damage ? addModifier(dealt, id, focus.sourceId, "damagedByTitle", 1, "endOfRound") : dealt;
}
