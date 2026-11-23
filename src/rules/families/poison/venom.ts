// Rules: hob.venom-poison (data/rules/entries.json); ledger lines 132028:A:1 to 132032:A:1.
//
// Venom: an enemy with the keyword (the flag `venom` its constant record sets) that damages a character in an attack gives that character 1 poison for that damage, whatever the damage is. A character that took no damage
// (canceled or absorbed) gets none, and neither does one the damage destroyed (it is out of play). Damage an encounter card that is no enemy deals gives none.
import type { ScenarioState } from "../../core/state.ts";
import { flagged, inPlay } from "../../core/state.ts";
import { isCharacterType, printedOf } from "../../core/printed.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { givePoison } from "./poison.ts";

/** The characters the attack in progress damaged between `before` and `after` each get 1 poison when its enemy has Venom. Called where the attack's damage is noted (families/defense/damage.ts noteAttackDamage). */
export function venomPoison(before: ScenarioState, after: ScenarioState, ctx: ReduceContext): ScenarioState {
  const enemyId = after.pendingAttack?.enemyId ?? before.pendingAttack?.enemyId;
  if (!enemyId || after.modifiers.length === 0 || !flagged(after, enemyId, "venom")) return after;
  let next = after;
  for (const now of Object.values(after.cards)) {
    const was = before.cards[now.id];
    if (!was || !inPlay(now.zone) || now.damage <= was.damage || !(now.zone === "heroes" || isCharacterType(printedOf(ctx.cards, now.code)))) continue;
    next = givePoison(next, now.id, 1, ctx);
  }
  return next;
}
