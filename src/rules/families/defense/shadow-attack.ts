// Rules: rr.shadow-effects, rr.attacks-outside-the-combat-phase, faq.enemy-attacks-outside-combat, rr.step-6-4-1, rr.step-6-11, ltp.shadow-discard
// (data/rules/entries.json); ledger line 01081:A:2.
//
// "Shadow: Wolf Rider attacks the defending player. That player may declare 1 character as a defender. Deal Wolf Rider its own Shadow
// card. After combat, return Wolf Rider to the top of the encounter deck." An enemy card dealt as a shadow card attacks the player the
// attack it was dealt to is made against. The engine runs the second attack when the first has ended, not inside the shadow step (one
// attack is in progress at a time): the shadow card comes into play engaged with the defending player, is dealt a shadow card of its
// own (an attack an effect makes is, defense/listen.ts), and the player declares a defender as usual. "After combat" is read plainly:
// Wolf Rider stays engaged after its attack until the end of the combat phase, and then, if it is still in play, returns to the top of
// the encounter deck; one the players defeat first goes where a defeated enemy goes. It is counted as having attacked this phase (it
// is not dealt a second normal attack), and as an attack an effect made it does not use up an attack of its own.
// If the attack's own "after" instructions are waiting, the shadow attackers start once they have run (StartShadowAttack); the rest of
// the list goes onto each shadow attack, so several shadow attackers attack one after the other.
import type { Instruction } from "../../../catalog/boundary.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { beginEnemyAttack } from "../../combat/combat.ts";
import type { ScenarioState } from "../../core/state.ts";
import { updateCard } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import { dealAttackShadow } from "./listen.ts";
import { attackKey } from "../south/watcher.ts";

// ShadowAttacks: the source shadow card joins the attack in progress's list of shadow attackers.
export function shadowAttacks(state: ScenarioState, sourceId: string | null): ScenarioState {
  const attack = state.pendingAttack;
  if (!attack || !sourceId || !state.cards[sourceId]) return state;
  return { ...state, pendingAttack: { ...attack, shadowAttackers: [...(attack.shadowAttackers ?? []), sourceId] } };
}

// StartShadowAttack (engine use) and the end of an attack: the first of `attackers` still in the game attacks the player `seat` now, or
// null when none waits. The shadow card, face up, leaves its enemy and comes into play engaged with that player; the attackers after
// it wait on its attack.
export function startShadowAttack(state: ScenarioState, seat: number, attackers: readonly string[], ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  const attackerId = attackers.find((id) => state.cards[id] != null);
  if (!attackerId) return null;
  const rest = attackers.slice(attackers.indexOf(attackerId) + 1);
  const moved = updateCard(moveCard(state, attackerId, { zone: "engaged", seat }), attackerId, { face: "up" });
  // In the combat phase it has made its attack: the enemies that attack in turn do not call it again.
  const counted = moved.phase === "Combat" ? { ...moved, resolvedAttacks: [...moved.resolvedAttacks, attackKey(moved, attackerId, seat)] } : moved;
  const begun = beginEnemyAttack(dealAttackShadow(counted, attackerId, ctx, steps), seat, attackerId, ctx, steps);
  if (!begun.pendingAttack) return begun;
  const stays: Instruction = { verb: "MoveEncounterCard", card: "self", to: "deckTop", when: { kind: "matches", card: "self", inPlay: true } };
  const after: readonly Instruction[] = [{ verb: "Delay", until: "endOfPhase", instructions: [stays] }];
  return { ...begun, pendingAttack: { ...begun.pendingAttack, immediate: true, shadowAttack: true, after, ...(rest.length > 0 ? { shadowAttackers: rest } : {}) } };
}
