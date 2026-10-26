// Rules: rr.engaged, rr.combat-phase, rr.attacks-outside-the-combat-phase, rr.step-6-4-3 (data/rules/entries.json); the Watcher in the
// Water (142024:A:2), Storm of Howls (142038:A:2), Regiments of Crows (142035:A:2).
//
// An enemy that attacks without being engaged: the Watcher in the Water stays in the staging area but is considered engaged with each
// player, so it attacks every player once in the combat phase; Storm of Howls makes the enemy in the staging area with the highest
// engagement cost attack the player who revealed it. The combat code asks `attackHere` instead of reading the enemy's zone.
import type { EngineStep } from "../intents.ts";
import { ruleCause } from "../cause.ts";
import { attackBarred } from "../constants.ts";
import { beginEnemyAttack } from "../combat.ts";
import { dealOneShadow, type ReduceContext } from "../interpret.ts";
import { modifiedStat, placeDamage } from "../keywords.ts";
import { lastPicked } from "../player-verbs.ts";
import type { PendingAttack, ScenarioState } from "../state.ts";
import { flagged } from "../state.ts";
import { discardShadowOf } from "../shadow.ts";
import { patchTop } from "../windows.ts";
import type { Focus } from "./index.ts";
import { effectData } from "./encounter-moves.ts";
import { activeLocations } from "./south-locations.ts";

// An enemy in the staging area that is considered engaged with each player.
export function engagedWithAll(state: ScenarioState, id: string): boolean {
  return state.cards[id]?.zone === "staging" && flagged(state, id, "engagedWithAll");
}

// The enemy is where it can attack from: engaged, in the staging area but considered engaged with every player, or in the staging area
// and making the attack in progress that an effect gave it.
export function attackHere(state: ScenarioState, enemyId: string): boolean {
  const enemy = state.cards[enemyId];
  if (!enemy) return false;
  if (enemy.zone === "engaged") return true;
  return enemy.zone === "staging" && (engagedWithAll(state, enemyId) || (state.pendingAttack?.enemyId === enemyId && state.pendingAttack.fromStaging === true));
}

// The key under which an attack is counted as made this combat phase: one per player for an enemy engaged with all of them.
export function attackKey(state: ScenarioState, enemyId: string, seat: number): string {
  return engagedWithAll(state, enemyId) ? `${enemyId}@${seat}` : enemyId;
}

// The enemies in the staging area that still attack this seat in this combat phase.
export function stagingAttackers(state: ScenarioState, seat: number): string[] {
  return state.staging.filter((id) => engagedWithAll(state, id) && !state.resolvedAttacks.includes(`${id}@${seat}`) && !attackBarred(state, id, seat));
}

// An enemy that is not engaged is dealt a shadow card of its own when it attacks; one dealt for an earlier attack is discarded first.
export function dealForAttack(state: ScenarioState, enemyId: string): ScenarioState {
  return state.cards[enemyId]?.zone === "engaged" ? state : dealOneShadow(discardShadowOf(state, enemyId), enemyId);
}

// AttackFromStaging: the picked enemy in the staging area attacks the actor now (142038:A:2).
export function attackFromStaging(state: ScenarioState, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const id = lastPicked(state);
  const enemy = id ? state.cards[id] : undefined;
  if (!id || enemy?.zone !== "staging" || attackBarred(state, id, focus.seat) || state.seats[focus.seat]?.eliminated) return state;
  const data = effectData(state);
  const counted = data ? patchTop(state, { data: { ...data, returned: data.returned + 1 } }) : state;
  const begun = beginEnemyAttack(dealForAttack(counted, id), focus.seat, id, ctx, steps, true);
  return begun.pendingAttack ? { ...begun, pendingAttack: { ...begun.pendingAttack, immediate: true } } : begun;
}

// DamageActiveLocation: a shadow effect marks the attack in progress: its undefended damage goes on an active location.
export function markLocationDamage(state: ScenarioState): ScenarioState {
  const attack = state.pendingAttack;
  return attack ? { ...state, pendingAttack: { ...attack, toLocation: true } } : state;
}

// The cards the damage of an undefended attack may be assigned to: the active locations when a shadow effect says it goes on one.
export function undefendedLocations(state: ScenarioState): string[] {
  return state.pendingAttack?.toLocation ? activeLocations(state) : [];
}

// The damage of the undefended attack in progress goes on an active location (142035:A:2): the one location, or the one the defending
// player named (the `Undefended` intent names the card). Null when the damage goes on a hero as usual; a state with the defense window
// open when the player must still name the location.
export function locationDamage(state: ScenarioState, attack: PendingAttack, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  const actives = undefendedLocations(state);
  const enemy = state.cards[attack.enemyId];
  if (actives.length === 0 || !enemy) return null;
  const named = attack.heroId != null && actives.includes(attack.heroId) ? attack.heroId : actives.length === 1 ? actives[0] : undefined;
  if (!named) {
    const { heroId: _hero, ...rest } = attack;
    return { ...state, pendingAttack: rest, window: { kind: "defense", enemyId: attack.enemyId, seat: attack.seat } };
  }
  const strength = modifiedStat(state, enemy, "attack", ctx.cards);
  steps.push({ kind: "strike", side: "enemy", enemyId: attack.enemyId, targetId: named, attack: strength, defense: 0, undefended: true, cause: ruleCause("rr.step-6-4-3") });
  return placeDamage({ ...state, pendingAttack: { ...attack, heroId: named } }, named, strength, ctx.cards, steps, "combat", ruleCause("rr.step-6-4-3"));
}
