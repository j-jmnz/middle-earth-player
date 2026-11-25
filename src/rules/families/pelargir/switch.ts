// Rules: rr.step-6-4-3, rr.shadow-effects, faq.additional-attacks, faq.next-player (data/rules/entries.json); ledger line 06148:A:2.
// "Attacking enemy engages the next player and makes an immediate attack, if able": the shadow record marks the attacker `attackSwitched` for the rest of the attack and leaves, for the end of the attack, the engagement with the next player and the immediate attack (EngageNextPlayer, ImmediateAttack).
// The attack in progress ends when its shadow has resolved: it deals no damage and the shadow cards still facedown do not resolve (the new attack is dealt its own card, which discards them). The enemy's attack of the round is used up by this attack, as the immediate attack does not use it up.
import type { ScenarioState } from "../../core/state.ts";
import { flagged } from "../../core/state.ts";

/** Whether a shadow effect ended the attack in progress (the enemy holds `attackSwitched`): the attack goes on to nothing but its end. False in every game without the flag. */
export function attackSwitched(state: ScenarioState): boolean {
  const attack = state.pendingAttack;
  return state.modifiers.length > 0 && attack != null && flagged(state, attack.enemyId, "attackSwitched");
}
