// Rules: rr.attacks-outside-the-combat-phase, faq.additional-attacks (data/rules/entries.json).
//
// One attack an encounter card makes outside the combat phase, as an immediate attack: ImmediateAttackEach (families/burden/attack.ts), Ramming Speed! (families/sea/ramming.ts) and
// AttackOtherPlayers (families/sea/attacks.ts) all start theirs here.
import { beginEnemyAttack } from "../../combat/combat.ts";
import { attackBarred } from "../../interpret/constants.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { ScenarioState } from "../../core/state.ts";
import { patchTop } from "../../windows/windows.ts";
import { dealAttackShadow } from "../defense/listen.ts";
import { effectData } from "../encounter/moves.ts";

// One immediate attack by an enemy that may attack. It is dealt a shadow card of its own; one dealt for an earlier attack is discarded first
// (rr.attacks-outside-the-combat-phase, faq.additional-attacks).
// Without a `seat` the enemy must still be engaged and attacks the player it is engaged with; the attack is counted before it starts (the Forced effects of its start push
// frames over the running effect's). With a `seat` the enemy, engaged with another player or in the staging area, attacks that living player and is not counted.
export function attackWith(state: ScenarioState, enemyId: string, ctx: ReduceContext, steps: EngineStep[], seat?: number): ScenarioState {
  const enemy = state.cards[enemyId];
  if (!enemy) return state;
  const target = seat ?? enemy.controller;
  const placed = seat == null ? enemy.zone === "engaged" : (enemy.zone === "engaged" || enemy.zone === "staging") && !state.seats[seat]?.eliminated;
  if (!placed || target == null || attackBarred(state, enemyId, target)) return state;
  const data = seat == null ? effectData(state) : undefined;
  const counted = data ? patchTop(state, { data: { ...data, returned: data.returned + 1 } }) : state;
  const dealt = dealAttackShadow(counted, enemyId, ctx, steps);
  const begun = beginEnemyAttack(dealt, target, enemyId, ctx, steps, enemy.zone === "staging");
  return begun.pendingAttack ? { ...begun, pendingAttack: { ...begun.pendingAttack, immediate: true } } : begun;
}
