// Rules: rr.attachment-cards, rr.objective-cards, rr.ownership-and-control, rr.damage, rr.step-6-4-3, rr.attacks-outside-the-combat-phase, faq.enemy-attacks-outside-combat (data/rules/entries.json); ledger lines 05019:A:1, 05019:A:2, 05020:A:2, 05024:A:2, 05066:B:3, 05067:B:2.
// Alcaron's Scroll, the objective that hops from a hero to the enemy that damages him: where it goes, the hero that takes the damage of an attack that says so, and the player an enemy in the staging area attacks for it.
import type { Instruction } from "../../../catalog/boundary.ts";

import { frameScope, refCard } from "../../interpret/amounts.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { lastPicked } from "../../interpret/player-verbs.ts";
import { printedOf } from "../../core/printed.ts";
import { queueEvent } from "../../windows/queue.ts";
import { attachBlocked } from "../../interpret/restrictions.ts";
import type { ScenarioState } from "../../core/state.ts";
import { flagged, inPlay, updateCard } from "../../core/state.ts";
import { attachTo, moveCard } from "../../core/zones.ts";
import type { Focus } from "../index.ts";
import { attackNowFromStaging } from "../south/watcher.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

// The card in play with this printed code.
function inPlayWith(state: ScenarioState, code: string): string | undefined {
  return Object.values(state.cards).find((card) => card.code === code && inPlay(card.zone))?.id;
}

// The hero the card with this code is attached to, when it is attached to a hero in play (the hero "with Alcaron's Scroll attached").
function holderOf(state: ScenarioState, code: string): string | null {
  const objective = Object.values(state.cards).find((card) => card.code === code && card.zone === "attached");
  const host = objective?.host ? state.cards[objective.host] : undefined;
  return host?.zone === "heroes" ? host.id : null;
}

/**
 * AttachObjectiveTo: the objective (the source, or the card in play with `code`) leaves its hero, its enemy or the staging area for the enemy the reference names, and stays a claimed objective nobody controls, so it goes back to the staging area when the
 * enemy leaves play. With `orStaging` and no enemy to take it, it goes to the staging area. Nothing happens when the objective is not in play or is on the card already.
 */
export function attachObjectiveTo(state: ScenarioState, instruction: Verb<"AttachObjectiveTo">, focus: Focus, ctx: ReduceContext): ScenarioState {
  const id = instruction.code ? inPlayWith(state, instruction.code) : (focus.sourceId ?? undefined);
  const objective = id ? state.cards[id] : undefined;
  if (!id || !objective || !inPlay(objective.zone)) return state;
  const targetId = instruction.card ? refCard(state, instruction.card, frameScope(state, focus.seat, focus.sourceId)) : lastPicked(state);
  const target = targetId ? state.cards[targetId] : undefined;
  const takes = target != null && target.id !== id && inPlay(target.zone) && printedOf(ctx.cards, target.code).type === "enemy" && !attachBlocked(state, ctx, target.id, objective.code);
  if (!takes) {
    if (instruction.orStaging !== true || objective.zone === "staging") return state;
    return updateCard(moveCard(state, id, { zone: "staging" }), id, { face: "up" });
  }
  if (objective.host === target.id) return state;
  const claimed = objective.claimed === true;
  const attached = updateCard(attachTo(moveCard(state, id, { zone: "attached" }), id, target.id), id, { face: "up", controller: null, ...(claimed ? { claimed: true } : {}) });
  return queueEvent(attached, { trigger: "attached", seat: focus.seat, subject: id, other: target.id });
}

/**
 * AttackScrollHolder: the enemy the answered event is about, in the staging area, attacks the player whose hero has the objective with `code` attached, from the staging area, with a shadow card of its own. With no such hero nothing happens.
 */
export function attackScrollHolder(state: ScenarioState, instruction: Verb<"AttackScrollHolder">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const enemyId = frameScope(state, focus.seat, focus.sourceId).subject;
  const hero = holderOf(state, instruction.code);
  const seat = hero ? state.cards[hero]?.controller : null;
  if (!enemyId || seat == null) return state;
  return attackNowFromStaging(state, enemyId, seat, ctx, steps, { shadow: true });
}

/**
 * The card an attack's damage is placed on when the attacking enemy holds `damageToScroll` (a Shadow effect of this attack): the hero the card holding `takesAttackDamage` is attached to, for damage assigned to a character of the player the attack is against.
 * Null when the enemy holds no such flag, the damage is assigned to another card, or no hero holds the card ("if able"), so the damage stays where it was assigned. Called by damageGoesTo (families/defense/damage.ts) with state alone.
 */
export function scrollDamageTarget(state: ScenarioState, assigned: string): string | null {
  const attack = state.pendingAttack;
  if (!attack || state.modifiers.length === 0 || !flagged(state, attack.enemyId, "damageToScroll")) return null;
  if (state.cards[assigned]?.controller !== attack.seat) return null;
  const objective = Object.values(state.cards).find((card) => card.zone === "attached" && flagged(state, card.id, "takesAttackDamage"));
  const host = objective?.host ? state.cards[objective.host] : undefined;
  return host?.zone === "heroes" && inPlay(host.zone) ? host.id : null;
}
