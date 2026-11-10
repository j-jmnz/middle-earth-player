// Rules: rr.step-6-8-2, rr.step-6-8-3, rr.step-6-8-4, rr.ranged, rr.defense-strength, rr.destroy (data/rules/entries.json).
//
// What the attack family reads while a player attack resolves: whether a card is attacking (and how), whether the enemy counts
// its Defense, and what the attack's damage leads to (excess damage, the events its attackers hear, cards drawn).
import type { Condition } from "../../../catalog/boundary.ts";

import { effectCause, ruleCause, type Cause } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import { drawMany, type ReduceContext } from "../../interpret/interpret.ts";
import { modifiedStat, placeDamage, placedAmount } from "../../core/keywords.ts";
import { effectsOf, subjectMatches } from "../../windows/listen.ts";
import { printedOf } from "../../core/printed.ts";
import { queueEvent } from "../../windows/queue.ts";
import type { CardInstance, PendingStrike, ScenarioState } from "../../core/state.ts";
import { flagged, inPlay } from "../../core/state.ts";
import { heard } from "./events.ts";
import { playerSource } from "../quest/threat.ts";

type Attacking = Extract<Condition, { kind: "attacking" }>;

// The player attack in progress this character attacks in: the latest one, or one it was declared during. A character is
// attacking until its attack has ended (rr.step-6-8-4).
export function strikeOf(state: ScenarioState, id: string): PendingStrike | undefined {
  for (let strike = state.pendingStrike ?? undefined; strike; strike = strike.outer) {
    if (strike.attackerIds.includes(id)) return strike;
  }
  return undefined;
}

// A ranged attack (rr.ranged): against an enemy engaged with another player than the attacker's, in an attack another player
// declared, or one a card calls ranged (132014:A:2).
export function rangedAttack(strike: PendingStrike, attacker: CardInstance): boolean {
  if (strike.ranged) return true;
  if (strike.engagedSeat != null && strike.engagedSeat !== attacker.controller) return true;
  return attacker.controller !== strike.seat;
}

// The `attacking` condition for this card: it attacks, alone if asked, in a ranged attack if asked, an enemy that matches (or
// does not match) the filter, read from the card's controller's side. `against` is the enemy a stat is read against.
export function attackingHolds(state: ScenarioState, condition: Attacking, holder: CardInstance | undefined, ctx: ReduceContext, against?: string): boolean {
  if (!holder) return false;
  const strike = strikeOf(state, holder.id);
  if (!strike) return false;
  const enemyId = against ?? strike.enemyId;
  if (!state.cards[enemyId]) return false;
  if (condition.alone && strike.attackerIds.length !== 1) return false;
  if (condition.ranged && !rangedAttack(strike, holder)) return false;
  if (condition.enemy && !subjectMatches(state, enemyId, condition.enemy, holder, ctx)) return false;
  return !(condition.notEnemy && subjectMatches(state, enemyId, condition.notEnemy, holder, ctx));
}

// The enemy counts its Defense against this attack unless an attacker says it does not ("While ~ is attacking alone, the
// defending enemy does not count its Defense": ignoresDefense, set while the constant's condition holds).
export function countsDefense(state: ScenarioState, attackerIds: readonly string[]): boolean {
  return !attackerIds.some((id) => flagged(state, id, "ignoresDefense"));
}

// What the attack's combat damage leads to (rr.step-6-8-3). The excess damage a card sends on (08004:A:3) goes to that enemy;
// each attacker hears that the attack damaged the enemy, and that it destroyed it ("participates in an attack that destroys
// an enemy"), with the player the enemy was engaged with for attackDestroyedEngaged; the player who declared the attack
// draws for each card that says so (12114:A:1). `before` is the state before the damage, `raw` the damage dealt.
export function struck(
  before: ScenarioState,
  damaged: ScenarioState,
  seat: number,
  enemyId: string,
  attackerIds: readonly string[],
  raw: number,
  ctx: ReduceContext,
  steps: EngineStep[],
): ScenarioState {
  const was = before.cards[enemyId];
  const now = damaged.cards[enemyId];
  // An enemy that left play before the damage was neither damaged nor destroyed by this attack.
  if (!was || !inPlay(was.zone)) return damaged;
  const destroyed = !now || !inPlay(now.zone);
  const hurt = destroyed || now.damage > was.damage;
  let next = damaged;
  const strike = before.pendingStrike?.enemyId === enemyId ? before.pendingStrike : undefined;
  if (destroyed && strike?.excessTo && next.cards[strike.excessTo]) {
    const remaining = Math.max(0, modifiedStat(before, was, "hitPoints", ctx.cards) - was.damage);
    const excess = placedAmount(before, enemyId, printedOf(ctx.cards, was.code), raw) - remaining;
    if (excess > 0) next = placeDamage(next, strike.excessTo, excess, ctx.cards, steps, "combat", ruleCause("rr.step-6-8-3"));
  }
  const about = { seat, other: enemyId, participants: attackerIds };
  // The damage the attack dealt is the event's amount, and so the Response's X ("a Dwarf deals X damage", 04105:A:1).
  const dealt = destroyed ? placedAmount(before, enemyId, printedOf(ctx.cards, was.code), raw) : (now?.damage ?? 0) - was.damage;
  if (hurt && heard(next, ctx, "attackDamaged")) for (const attackerId of attackerIds) next = queueEvent(next, { trigger: "attackDamaged", cardId: attackerId, amount: dealt, ...about });
  if (!destroyed) return next;
  for (const attackerId of attackerIds) next = queueEvent(next, { trigger: "attackDestroyed", seat, cardId: attackerId, subject: enemyId, other: enemyId, participants: attackerIds });
  const engaged = was.zone === "engaged" ? was.controller : null;
  if (engaged != null && heard(next, ctx, "attackDestroyedEngaged")) {
    for (const attackerId of attackerIds) next = queueEvent(next, { trigger: "attackDestroyedEngaged", cardId: attackerId, subject: enemyId, ...about, seat: engaged });
  }
  for (const modifier of next.modifiers.filter((entry) => entry.stat === "drawOnAttackDestroy" && entry.instanceId === `seat:${seat}`)) {
    const cause = sourceCause(next, modifier.sourceId, ctx);
    next = drawMany(next, seat, modifier.amount, steps, cause, ctx, false, playerSource(next, modifier.sourceId, ctx));
  }
  return next;
}

// The record of the card that gave a seat its draws: the one of that card's records that names drawOnAttackDestroy.
function sourceCause(state: ScenarioState, sourceId: string, ctx: ReduceContext): Cause {
  const code = state.cards[sourceId]?.code;
  const effect = code ? effectsOf(ctx, code).find((entry) => JSON.stringify(entry).includes('"drawOnAttackDestroy"')) : undefined;
  return effect ? effectCause(effect) : ruleCause("rr.lasting-effects");
}
