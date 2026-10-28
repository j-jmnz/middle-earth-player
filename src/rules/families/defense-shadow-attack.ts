// Rules: rr.shadow-effects, rr.attacks-outside-the-combat-phase, faq.enemy-attacks-outside-combat, rr.step-6-4-1 (data/rules/entries.json);
// ledger line 01081:A:2.
//
// "Shadow: Wolf Rider attacks the defending player. That player may declare 1 character as a defender. Deal Wolf Rider its own Shadow
// card. After combat, return Wolf Rider to the top of the encounter deck." An enemy card dealt as a shadow card attacks the player the
// attack it was dealt to is made against. The engine runs the second attack when the first has ended, not inside the shadow step (one
// attack is in progress at a time): the shadow card comes into play engaged with the defending player, is dealt a shadow card of its
// own (an attack an effect makes is, defense-listen.ts), the player declares a defender as usual, and once it ends Wolf Rider goes to
// the top of the encounter deck. It does not use up an attack of its own (it is an attack an effect made).
import type { EngineStep } from "../intents.ts";
import type { ReduceContext } from "../interpret.ts";
import { beginEnemyAttack } from "../combat.ts";
import type { PendingAttack, ScenarioState } from "../state.ts";
import { updateCard } from "../state.ts";
import { moveCard } from "../zones.ts";
import { dealAttackShadow } from "./defense-listen.ts";

// ShadowAttacks: the source shadow card joins the attack in progress's list of shadow attackers.
export function shadowAttacks(state: ScenarioState, sourceId: string | null): ScenarioState {
  const attack = state.pendingAttack;
  if (!attack || !sourceId || !state.cards[sourceId]) return state;
  return { ...state, pendingAttack: { ...attack, shadowAttackers: [...(attack.shadowAttackers ?? []), sourceId] } };
}

// The attack `attack` has ended (`ended` is the state after it): the first shadow attacker attacks the defending player now, or null
// when none waits. The shadow card, face up, leaves its enemy and comes into play engaged with that player.
export function startShadowAttack(ended: ScenarioState, attack: PendingAttack, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  const attackerId = (attack.shadowAttackers ?? []).find((id) => ended.cards[id] != null);
  if (!attackerId) return null;
  const moved = updateCard(moveCard(ended, attackerId, { zone: "engaged", seat: attack.seat }), attackerId, { face: "up" });
  const begun = beginEnemyAttack(dealAttackShadow(moved, attackerId, ctx), attack.seat, attackerId, ctx, steps);
  if (!begun.pendingAttack) return begun;
  return { ...begun, pendingAttack: { ...begun.pendingAttack, immediate: true, after: [{ verb: "MoveEncounterCard", card: "self", to: "deckTop" }] } };
}
