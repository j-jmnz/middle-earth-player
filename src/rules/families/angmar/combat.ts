// Rules: rr.combat-phase, rr.cannot (data/rules/entries.json); ledger line 10076:A:1. "Damaged characters cannot be declared as attackers or defenders against Goblin Pursuer": the enemy holds `damagedCannotFace`; a character with damage on it is not offered as an attacker against it, nor as a defender of its
// attack. The check is made at the declaration, so a character damaged afterwards stays declared.
import type { PrintedCard } from "../../core/printed.ts";
import { flagged, type ScenarioState } from "../../core/state.ts";

const REASON = "A damaged character cannot be declared against this enemy";

/** Why a damaged character cannot be declared as an attacker against the enemy, or null. */
export function attackerFacing(state: ScenarioState, enemyId: string, attackerId: string): string | null {
  return flagged(state, enemyId, "damagedCannotFace") && (state.cards[attackerId]?.damage ?? 0) > 0 ? REASON : null;
}

/** Why a damaged character cannot be declared as a defender of the attack in progress, or null. `defenderId` is the character (the hook knows its printed card only). */
export function defenderFacing(state: ScenarioState, _defender: PrintedCard, defenderId: string | undefined): string | null {
  const enemyId = state.pendingAttack?.enemyId;
  if (!enemyId || !defenderId) return null;
  return flagged(state, enemyId, "damagedCannotFace") && (state.cards[defenderId]?.damage ?? 0) > 0 ? REASON : null;
}
