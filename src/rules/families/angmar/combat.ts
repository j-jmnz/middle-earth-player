// Rules: rr.combat-phase, rr.cannot (data/rules/entries.json); ledger line 10076:A:1. "Damaged characters cannot be declared as attackers or defenders against Goblin Pursuer": the enemy holds `damagedCannotFace`; a character with damage on it is not offered as an attacker against it, nor as a defender of its
// attack. The check is made at the declaration, so a character damaged afterwards stays declared.
import type { PrintedCard } from "../../core/printed.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { flagged, type CardInstance, type ScenarioState } from "../../core/state.ts";
import { hasTrait } from "../../interpret/conditions.ts";

const REASON = "A damaged character cannot be declared against this enemy";

/** Why a damaged character cannot be declared as an attacker against the enemy, or null. */
export function attackerFacing(state: ScenarioState, enemyId: string, attackerId: string): string | null {
  return flagged(state, enemyId, "damagedCannotFace") && (state.cards[attackerId]?.damage ?? 0) > 0 ? REASON : null;
}

/** Why a damaged character cannot be declared as a defender of the attack in progress, or null. `defenderId` is the character (the hook knows its printed card only). */
export function defenderFacing(state: ScenarioState, _defender: PrintedCard, defenderId: string): string | null {
  const enemyId = state.pendingAttack?.enemyId;
  if (!enemyId) return null;
  return flagged(state, enemyId, "damagedCannotFace") && (state.cards[defenderId]?.damage ?? 0) > 0 ? REASON : null;
}

/** The holder is the declared defender of the attack in progress and the attacking enemy has the Trait (the stat condition `defendingAgainst`, 10114:A:2: "+1 Defense while defending against Undead enemies"). Read while the stat is read. */
export function defendingAgainst(state: ScenarioState, holder: CardInstance, trait: string, ctx: ReduceContext): boolean {
  const attack = state.pendingAttack;
  if (!attack || attack.defenderId !== holder.id || attack.undefended) return false;
  return hasTrait(state, attack.enemyId, trait, ctx);
}
