// Rules: rr.damage, rr.step-6-4-3, faq.enemy-attacks-outside-combat (data/rules/entries.json); ledger line 10158:A:1. "After an attack damages a character": the attack that dealt damage to a character, heard once as the attack ends.
// The damage an enemy attack places on a character is noted as it is placed (noteHurt, called from families/defense/excess.ts combatDamage) and read as the attack ends (announceHurt, called from combat/shadow.ts finishAttack): damage a Response canceled in between is not
// damage the attack dealt, and a character the damage destroyed counts. Only a game with a card that hears `attackDamagedCharacter` notes or announces anything.
import type { ReduceContext } from "../../interpret/interpret.ts";
import { isCharacterType, printedOf } from "../../core/printed.ts";
import { inPlay, type ScenarioState } from "../../core/state.ts";
import type { PendingAttack } from "../../windows/frame-types.ts";
import { queueEvent } from "../../windows/queue.ts";
import { listened } from "../defense/listen.ts";

const HEARD = ["attackDamagedCharacter"] as const;

/** The enemy attack in progress placed `landed` damage on `targetId`, a character with `before` damage: remembered for the end of the attack (the first damage a character takes in it counts from what it held then). */
export function noteHurt(state: ScenarioState, targetId: string, before: number, landed: number, ctx: ReduceContext): ScenarioState {
  const attack = state.pendingAttack;
  if (!attack || landed <= 0 || attack.defense?.hurt?.[targetId] != null) return state;
  const target = state.cards[targetId];
  if (!target || !isCharacterType(printedOf(ctx.cards, target.code)) || !listened(state, ctx, HEARD)) return state;
  return { ...state, pendingAttack: { ...attack, defense: { ...attack.defense, hurt: { ...attack.defense?.hurt, [targetId]: before } } } };
}

/** The attack ends: when a character it damaged still holds more damage than before it, or was destroyed by it, the attack's enemy announces it, once (the other card is the character, the first one damaged). */
export function announceHurt(state: ScenarioState, attack: PendingAttack): ScenarioState {
  const hurt = Object.entries(attack.defense?.hurt ?? {}).find(([id, before]) => {
    const card = state.cards[id];
    return card != null && (!inPlay(card.zone) || card.damage > before);
  });
  return hurt ? queueEvent(state, { trigger: "attackDamagedCharacter", seat: attack.seat, cardId: attack.enemyId, other: hurt[0] }) : state;
}
