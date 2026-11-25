// Rules: rm.hinder (data/rules/entries.json); ledger lines 07033:A:1, 07034:A:1, 07035:A:1.
// Hinder is two constant flags on the enemy that exist only while it is engaged in the combat phase (the records are Into Fangorn authored effects), so no flag is set while players commit to the quest. The table asks here whether the records bar the enemy's attack in the combat phase,
// to leave it out of the enemies a seat will face. A pure read of the records: no state, no flag.
import type { Condition, Effect } from "../../../catalog/boundary.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { effectsOf } from "../../windows/listen.ts";

// Whether the condition holds only in the combat phase: the phase test itself, or an `all` that holds one.
function onlyInCombat(condition: Condition | undefined): boolean {
  if (condition == null) return false;
  if (condition.kind === "phase") return condition.is === "Combat";
  return condition.kind === "all" && condition.conditions.some(onlyInCombat);
}

const barsAttack = (effect: Effect): boolean => effect.timing === "constant" && onlyInCombat(effect.condition) && effect.instructions.some((instruction) => instruction.verb === "ModifyStat" && instruction.stat === "cannotAttack");

/** Whether the records of this card code bar its attack in the combat phase (the Hinder keyword): such an enemy, engaged, makes no attack in the coming combat phase. False for every other card. */
export function hindersInCombat(ctx: ReduceContext, code: string): boolean {
  return effectsOf(ctx, code).some(barsAttack);
}
