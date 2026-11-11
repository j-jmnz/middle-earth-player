// Rules: rr.engaged, rr.combat-phase, rr.attacks-outside-the-combat-phase, rr.step-6-4-3 (data/rules/entries.json); the Watcher in the
// Water (142024:A:2), Storm of Howls (142038:A:2), Regiments of Crows (142035:A:2).
//
// An enemy that attacks without being engaged: the Watcher in the Water stays in the staging area but is considered engaged with each
// player, so it attacks every player once in the combat phase; Storm of Howls makes the enemy in the staging area with the highest
// engagement cost attack the player who revealed it. The combat code asks `attackHere` instead of reading the enemy's zone.
import type { Instruction } from "../../../catalog/boundary.ts";
import type { EngineStep } from "../../core/intents.ts";
import { ruleCause } from "../../core/cause.ts";
import { attackBarred } from "../../interpret/constants.ts";
import { beginEnemyAttack } from "../../combat/combat.ts";
import { dealAdditionalShadow, dealOneShadow, type ReduceContext } from "../../interpret/interpret.ts";
import { modifiedStat, placeDamage } from "../../core/keywords.ts";
import { lastPicked } from "../../interpret/player-verbs.ts";
import type { PendingAttack, ScenarioState } from "../../core/state.ts";
import { flagged } from "../../core/state.ts";
import { discardShadowOf } from "../../combat/shadow.ts";
import { patchTop } from "../../windows/windows.ts";
import type { Focus } from "../index.ts";
import { effectData } from "../encounter/moves.ts";
import { activeLocations } from "./locations.ts";

// An enemy in the staging area that is considered engaged with each player (the Watcher in the Water), or with the first player only (the
// Balrog, `engagedWithFirst`, 142044:A:2): it stays in the staging area and attacks from there.
export function engagedWithAll(state: ScenarioState, id: string): boolean {
  return state.cards[id]?.zone === "staging" && (flagged(state, id, "engagedWithAll") || flagged(state, id, "engagedWithFirst"));
}

// An enemy in the staging area that attacks, in the combat phase, each player who has an enemy engaged that relays its attack (`attacksViaRelay` on the Thing in the Depths, `relaysAttack` on Eye of the
// Beast, 12050:A:3): it attacks from the staging area, once for each such player, and is dealt a shadow card for each attack.
export function viaRelay(state: ScenarioState, id: string): boolean {
  return state.cards[id]?.zone === "staging" && flagged(state, id, "attacksViaRelay");
}

function relayedTo(state: ScenarioState, seat: number): boolean {
  return (state.seats[seat]?.engaged ?? []).some((enemy) => flagged(state, enemy, "relaysAttack"));
}

// Whether the enemy in the staging area is considered engaged with this seat: every seat for the Watcher, the first player for the Balrog, the seats with a relaying enemy engaged for the Thing.
function engagedWithSeat(state: ScenarioState, id: string, seat: number): boolean {
  if (state.cards[id]?.zone !== "staging") return false;
  return flagged(state, id, "engagedWithAll") || (flagged(state, id, "engagedWithFirst") && seat === state.firstPlayer) || (viaRelay(state, id) && relayedTo(state, seat));
}

// The enemy is where it can attack from: engaged, in the staging area but considered engaged with every player, or in the staging area
// and making the attack in progress that an effect gave it.
export function attackHere(state: ScenarioState, enemyId: string): boolean {
  const enemy = state.cards[enemyId];
  if (!enemy) return false;
  if (enemy.zone === "engaged") return true;
  return enemy.zone === "staging" && (engagedWithAll(state, enemyId) || viaRelay(state, enemyId) || (state.pendingAttack?.enemyId === enemyId && state.pendingAttack.fromStaging === true));
}

// The key under which an attack is counted as made this combat phase: one per player for an enemy engaged with all of them.
export function attackKey(state: ScenarioState, enemyId: string, seat: number): string {
  return engagedWithAll(state, enemyId) || viaRelay(state, enemyId) ? `${enemyId}@${seat}` : enemyId;
}

// The enemies in the staging area that still attack this seat in this combat phase.
export function stagingAttackers(state: ScenarioState, seat: number): string[] {
  return state.staging.filter((id) => engagedWithSeat(state, id, seat) && !state.resolvedAttacks.includes(`${id}@${seat}`) && !attackBarred(state, id, seat));
}

// An enemy that is not engaged is dealt a shadow card of its own when it attacks; one dealt for an earlier attack is discarded first.
export function dealForAttack(state: ScenarioState, enemyId: string, steps: EngineStep[]): ScenarioState {
  return state.cards[enemyId]?.zone === "engaged" ? state : dealOneShadow(discardShadowOf(state, enemyId), enemyId, steps);
}

// The enemy that attacks: the source itself, the card the source is attached to, or the one a Pick chose.
function attackerOf(state: ScenarioState, target: "self" | "host" | undefined, focus: Focus): string {
  if (target === "self") return focus.sourceId ?? "";
  if (target === "host") return state.cards[focus.sourceId ?? ""]?.host ?? "";
  return lastPicked(state);
}

// AttackFromStaging: the picked enemy in the staging area (or the source, `target: self`) attacks the actor now (142038:A:2), or the first
// player (`who: firstPlayer`, 142043:A:2).
export function attackFromStaging(state: ScenarioState, instruction: Extract<Instruction, { verb: "AttackFromStaging" }>, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const id = attackerOf(state, instruction.target, focus);
  const seat = instruction.who === "firstPlayer" ? state.firstPlayer : focus.seat;
  // "Undefended damage from this attack must be dealt to Hrogar's Hill" (19081:A:1): the main quest card takes it.
  return attackNowFromStaging(state, id, seat, ctx, steps, { shadow: true, ...(instruction.shadows ? { shadows: instruction.shadows } : {}), ...(instruction.undefendedToStage ? { toStage: true } : {}), ...(instruction.orEngaged ? { engaged: true } : {}) });
}

// The enemy `id` in the staging area attacks `seat` outside the combat phase, now, and the running effect counts the attack (its frames wait for it). `shadow: false`: no shadow card is dealt. `toStage` and `excessToStage` mark the attack
// in progress (PendingAttack): the main quest card takes the damage left undefended, and the excess past a defender. `engaged`: an enemy engaged with a player attacks too, as an engaged enemy does (its shadow card stays).
export function attackNowFromStaging(state: ScenarioState, id: string, seat: number, ctx: ReduceContext, steps: EngineStep[], flags: { shadow: boolean; shadows?: number; toStage?: boolean; excessToStage?: boolean; engaged?: boolean }): ScenarioState {
  const enemy = id ? state.cards[id] : undefined;
  const placed = enemy?.zone === "staging" || (flags.engaged === true && enemy?.zone === "engaged");
  if (!id || !placed || attackBarred(state, id, seat) || state.seats[seat]?.eliminated) return state;
  const { shadow, shadows, engaged: _engaged, ...marks } = flags;
  const data = effectData(state);
  const counted = data ? patchTop(state, { data: { ...data, returned: data.returned + 1 } }) : state;
  // "Deal and resolve 2 shadow cards for this attack" (143048:A:1): the first as any attack from the staging area, the others additional ones.
  let dealt = shadow ? dealForAttack(counted, id, steps) : counted;
  for (let more = 1; shadow && more < (shadows ?? 1); more += 1) dealt = dealAdditionalShadow(dealt, id, steps);
  const begun = beginEnemyAttack(dealt, seat, id, ctx, steps, { fromStaging: enemy?.zone === "staging", shadow });
  return begun.pendingAttack ? { ...begun, pendingAttack: { ...begun.pendingAttack, immediate: true, ...marks } } : begun;
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
