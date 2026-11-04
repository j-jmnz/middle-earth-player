// Rules: rr.attacks-outside-the-combat-phase, rr.damage, dcce.ship-enemies (data/rules/entries.json); ledger line 12131:A:1. "When Revealed: If you are off-course (Cloud, Rain, or Storm), the engaged Ship enemy with the
// highest Attack makes an immediate attack. Until the end of the phase, add 1 to the total Threat in the staging area for each damage dealt by this attack. If no attack is made as a result of this effect, Ramming Speed!
// gains doomed 2." The Pick filter highestAttack finds the enemy (the revealing player chooses among those tied); AttackWithPicked makes the attack as any effect's immediate attack is made (the attack counts for
// noneReturned) and leaves the raise for the attack's end, where the damage it dealt is known (`{ dealt: true }`, defense/excess.ts).
import type { Instruction } from "../../../catalog/boundary.ts";

import { currentCause, UNATTRIBUTED } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { modifiedStat } from "../../core/keywords.ts";
import { lastPicked } from "../../interpret/player-verbs.ts";
import type { ScenarioState } from "../../core/state.ts";
import { attackWith } from "../burden/attack.ts";

/** Of the cards that matched, only those with the highest Attack as the table shows it; all of them when tied. */
export function highestAttack(state: ScenarioState, found: readonly string[], ctx: ReduceContext): string[] {
  const values = found.map((id) => {
    const card = state.cards[id];
    return card ? modifiedStat(state, card, "attack", ctx.cards) : 0;
  });
  const top = Math.max(...values);
  return found.filter((_id, at) => values[at] === top);
}

/** AttackWithPicked: the last picked enemy, if it is engaged and may attack, makes an immediate attack. */
export function attackWithPicked(state: ScenarioState, instruction: Extract<Instruction, { verb: "AttackWithPicked" }>, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const enemy = lastPicked(state);
  if (!enemy || !state.cards[enemy]) return state;
  const begun = attackWith(state, enemy, ctx, steps);
  const attack = begun.pendingAttack;
  if (!attack || attack === state.pendingAttack || !instruction.raiseStagingThreat) return begun;
  const raise: Instruction = { verb: "RaiseStagingThreat", amount: { dealt: true }, until: instruction.raiseStagingThreat };
  return { ...begun, pendingAttack: { ...attack, after: [...(attack.after ?? []), raise], afterCause: currentCause(steps, UNATTRIBUTED) } };
}
