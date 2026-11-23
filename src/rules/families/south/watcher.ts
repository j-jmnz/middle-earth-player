// Rules: rr.engaged, rr.combat-phase, rr.attacks-outside-the-combat-phase, rr.step-6-4-3 (data/rules/entries.json); the Watcher in the
// Water (142024:A:2), Storm of Howls (142038:A:2), Regiments of Crows (142035:A:2).
//
// An enemy that attacks without being engaged: the Watcher in the Water stays in the staging area but is considered engaged with each
// player, so it attacks every player once in the combat phase; Storm of Howls makes the enemy in the staging area with the highest
// engagement cost attack the player who revealed it. The combat code asks `attackHere` instead of reading the enemy's zone.
import { undefendedToCity } from "../pelennor/combat.ts";
import type { Instruction, PickSpec } from "../../../catalog/boundary.ts";
import type { EngineStep } from "../../core/intents.ts";
import { currentCause, ruleCause, UNATTRIBUTED } from "../../core/cause.ts";
import { frameScope } from "../../interpret/amounts.ts";
import { attackBarred } from "../../interpret/constants.ts";
import { beginEnemyAttack, characters } from "../../combat/combat.ts";
import { dealAdditionalShadow, dealOneShadow, type ReduceContext } from "../../interpret/interpret.ts";
import { modifiedStat, placeDamage } from "../../core/keywords.ts";
import { lastPicked, seatsFor } from "../../interpret/player-verbs.ts";
import { matchesPick } from "../../interpret/pick.ts";
import type { PendingAttack, ScenarioState } from "../../core/state.ts";
import { flagged, livingSeats } from "../../core/state.ts";
import { shadowCards } from "../../core/zones.ts";
import { discardResolvedShadowOf, discardShadowOf } from "../../combat/shadow.ts";
import { patchTop } from "../../windows/windows.ts";
import type { Focus } from "../index.ts";
import { effectData } from "../encounter/moves.ts";
import { activeLocations } from "./locations.ts";
import { engagedWithThreatening } from "../../core/engaged.ts";

// An enemy in the staging area that is considered engaged with each player (the Watcher in the Water), with the first player only (the
// Balrog, `engagedWithFirst`, 142044:A:2) or with each player whose threat is 1 or greater (Durin's Bane, `engagedWithThreatening`, 04150:A:2): it stays in the staging area and attacks from there.
export function engagedWithAll(state: ScenarioState, id: string): boolean {
  return state.cards[id]?.zone === "staging" && (flagged(state, id, "engagedWithAll") || flagged(state, id, "engagedWithFirst") || flagged(state, id, "engagedWithThreatening"));
}


// The combat phase begins: the seats whose threat is below 1 are noted when an enemy that is engaged by threat is in the staging area. A seat raised to 1 later in the phase is attacked too, with no shadow card dealt for the attack (dwd.durins-bane; docs/scenarios/dwarrowdelf/shadow-and-flame.md, Shadow and Flame). The note is cleared when no such enemy is in the staging area at the next combat phase; every other game's state stays as it was.
export function noteBelowThreat(state: ScenarioState): ScenarioState {
  if (state.modifiers.length === 0 || !state.staging.some((id) => flagged(state, id, "engagedWithThreatening"))) {
    // The enemy has left the staging area: the seats noted for an earlier combat phase no longer apply.
    if (state.belowThreat === undefined) return state;
    const { belowThreat: _noted, ...rest } = state;
    return rest;
  }
  return { ...state, belowThreat: livingSeats(state).filter((seat) => (state.seats[seat]?.threat ?? 0) < 1) };
}

// An enemy in the staging area that attacks, in the combat phase, each player who has an enemy engaged that relays its attack (`attacksViaRelay` on the Thing in the Depths, `relaysAttack` on Eye of the
// Beast, 12050:A:3): it attacks from the staging area, once for each such enemy engaged with the player, and is dealt a shadow card for each attack.
export function viaRelay(state: ScenarioState, id: string): boolean {
  return state.cards[id]?.zone === "staging" && flagged(state, id, "attacksViaRelay");
}

// How many enemies engaged with the seat relay an attack: each is a separate instance of the constant ability (rr.constant-ability), so each gives one attack.
function relays(state: ScenarioState, seat: number): number {
  return (state.seats[seat]?.engaged ?? []).filter((enemy) => flagged(state, enemy, "relaysAttack")).length;
}

function relayedTo(state: ScenarioState, seat: number): boolean {
  return relays(state, seat) > 0;
}

// The attacks the enemy in the staging area makes against the seat in a combat phase: one for each relaying enemy engaged with the seat (12050:A:3), one otherwise.
function attacksOwed(state: ScenarioState, id: string, seat: number): number {
  return viaRelay(state, id) ? Math.max(1, relays(state, seat)) : 1;
}

/** Whether the attack the enemy makes on the seat now is counted as made this combat phase: it is for every enemy but one that attacks once for each relaying enemy, which is counted each time. */
export function countsEachAttack(state: ScenarioState, id: string): boolean {
  return viaRelay(state, id);
}

// Whether the enemy in the staging area is considered engaged with this seat: every seat for the Watcher, the first player for the Balrog, the seats with a relaying enemy engaged for the Thing.
function engagedWithSeat(state: ScenarioState, id: string, seat: number): boolean {
  if (state.cards[id]?.zone !== "staging") return false;
  return flagged(state, id, "engagedWithAll") || (flagged(state, id, "engagedWithFirst") && seat === state.firstPlayer) || engagedWithThreatening(state, id, seat) || (viaRelay(state, id) && relayedTo(state, seat));
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
  return state.staging.filter((id) => engagedWithSeat(state, id, seat) && state.resolvedAttacks.filter((key) => key === `${id}@${seat}`).length < attacksOwed(state, id, seat) && !attackBarred(state, id, seat));
}

// An enemy that is not engaged is dealt a shadow card of its own when it attacks; one dealt for an earlier attack is discarded first.
// Durin's Bane: a card already dealt and not turned up belongs to the attack being made (an immediate attack dealt it first), so no second one is dealt; a seat that was below threat 1 when the combat phase began is attacked with no shadow card (`seat`, noteBelowThreat).
export function dealForAttack(state: ScenarioState, enemyId: string, steps: EngineStep[], ctx: ReduceContext, seat?: number): ScenarioState {
  if (state.cards[enemyId]?.zone === "engaged") return state;
  if (state.modifiers.length > 0 && flagged(state, enemyId, "engagedWithThreatening")) {
    if (shadowCards(state.cards[enemyId]).some((id) => state.cards[id]?.face !== "up")) return state;
    const raised = seat != null && state.phase === "Combat" && (state.belowThreat ?? []).includes(seat);
    return raised ? discardShadowOf(state, enemyId) : dealOneShadow(discardShadowOf(state, enemyId), enemyId, steps, ctx);
  }
  // Stage 1B of The Battle of Carn Dûm keeps the shadow cards dealt (10125:B:2): the enemy is dealt one more and all the facedown ones resolve; one an earlier attack turned up is discarded first, not resolved again.
  if (state.modifiers.length > 0 && flagged(state, "table", "keepShadowCards")) return dealAdditionalShadow(discardResolvedShadowOf(state, enemyId), enemyId, steps, ctx);
  // Thaurdir on stage 2B: the shadow cards he holds as his first attack begins resolve with it and go after it; each later attack is dealt and discards a card of its own (10126:B:1, rr.step-6-4-2).
  if (state.modifiers.length > 0 && flagged(state, enemyId, "resolvesHeldShadows") && !state.resolvedAttacks.some((key) => key.startsWith(`${enemyId}@`))) return dealAdditionalShadow(discardResolvedShadowOf(state, enemyId), enemyId, steps, ctx);
  return dealOneShadow(discardShadowOf(state, enemyId), enemyId, steps, ctx);
}

// The enemy that attacks: the source itself, the card the source is attached to, the card the event was about, or the one a Pick chose.
function attackerOf(state: ScenarioState, target: "self" | "host" | "subject" | undefined, focus: Focus): string {
  if (target === "self") return focus.sourceId ?? "";
  if (target === "subject") return frameScope(state, focus.seat, focus.sourceId).subject ?? "";
  if (target === "host") return state.cards[focus.sourceId ?? ""]?.host ?? "";
  return lastPicked(state);
}

// AttackFromStaging: the picked enemy in the staging area (or the source, `target: self`) attacks the actor now (142038:A:2), or the first
// player (`who: firstPlayer`, 142043:A:2).
export function attackFromStaging(state: ScenarioState, instruction: Extract<Instruction, { verb: "AttackFromStaging" }>, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const id = attackerOf(state, instruction.target, focus);
  // `eventSeat`: the player the event happened to (the one who canceled a When Revealed, 146031:A:2); with none the attack is not made.
  const seat = instruction.who === "firstPlayer" ? state.firstPlayer : instruction.who === "eventSeat" ? seatsFor(state, "eventSeat", focus.seat)[0] : focus.seat;
  if (seat == null) return state;
  // "Undefended damage from this attack must be dealt to Hrogar's Hill" (19081:A:1): the main quest card takes it.
  return attackNowFromStaging(state, id, seat, ctx, steps, { shadow: true, ...(instruction.shadows ? { shadows: instruction.shadows } : {}), ...(instruction.undefendedToStage ? { toStage: true } : {}), ...(instruction.excessToStage ? { excessToStage: true } : {}), ...(instruction.orEngaged ? { engaged: true } : {}), ...(instruction.raiseThreatIfDestroys ? { raiseIfDestroys: instruction.raiseThreatIfDestroys } : {}) });
}

// The enemy `id` in the staging area attacks `seat` outside the combat phase, now, and the running effect counts the attack (its frames wait for it). `shadow: false`: no shadow card is dealt. `toStage` and `excessToStage` mark the attack
// in progress (PendingAttack): the main quest card takes the damage left undefended, and the excess past a defender. `engaged`: an enemy engaged with a player attacks too, as an engaged enemy does (its shadow card stays).
export function attackNowFromStaging(state: ScenarioState, id: string, seat: number, ctx: ReduceContext, steps: EngineStep[], flags: { shadow: boolean; shadows?: number; toStage?: boolean; excessToStage?: boolean; toLakeTown?: boolean; excessToLakeTown?: boolean; engaged?: boolean; raiseIfDestroys?: number }): ScenarioState {
  const enemy = id ? state.cards[id] : undefined;
  const placed = enemy?.zone === "staging" || (flags.engaged === true && enemy?.zone === "engaged");
  if (!id || !placed || attackBarred(state, id, seat) || state.seats[seat]?.eliminated) return state;
  const { shadow, shadows, engaged: _engaged, raiseIfDestroys, ...marks } = flags;
  const data = effectData(state);
  const counted = data ? patchTop(state, { data: { ...data, returned: data.returned + 1 } }) : state;
  // "Deal and resolve 2 shadow cards for this attack" (143048:A:1): the first as any attack from the staging area, the others additional ones.
  let dealt = shadow ? dealForAttack(counted, id, steps, ctx) : counted;
  for (let more = 1; shadow && more < (shadows ?? 1); more += 1) dealt = dealAdditionalShadow(dealt, id, steps, ctx);
  const begun = beginEnemyAttack(dealt, seat, id, ctx, steps, { fromStaging: enemy?.zone === "staging", shadow });
  // `raiseIfDestroys`: the effect the attack leaves for its end, with X the characters it destroyed (146039:A:2).
  const attack = begun.pendingAttack;
  if (!attack) return begun;
  const after = raiseIfDestroys ? { after: [...(attack.after ?? []), { verb: "RaiseThreat" as const, amount: raiseIfDestroys, who: "actor" as const, when: { kind: "x" as const, min: 1 } }], afterCause: attack.afterCause ?? currentCause(steps, UNATTRIBUTED) } : {};
  return { ...begun, pendingAttack: { ...attack, immediate: true, ...marks, ...after } };
}

// DamageActiveLocation: a shadow effect marks the attack in progress: its undefended damage goes on an active location.
export function markLocationDamage(state: ScenarioState): ScenarioState {
  const attack = state.pendingAttack;
  return attack ? { ...state, pendingAttack: { ...attack, toLocation: true } } : state;
}

// UndefendedDamageTo: a shadow effect marks the attack in progress: its undefended damage must go on a hero that matches the filter, if the defending player has one (900408:A:3). The hero already named that does not match is replaced by the one that does, or the player
// names the hero again among the matching ones (`onlyHeroes`, read by undefendedTargets). A defended attack is as it was.
export function markHeroDamage(state: ScenarioState, pick: PickSpec, focus: Focus, ctx: ReduceContext, character = false): ScenarioState {
  const attack = state.pendingAttack;
  if (!attack) return state;
  // `character`: any player's character that matches (02070:A:2), in play; the defending player's heroes otherwise.
  const pool = character ? livingSeats(state).flatMap((seat) => characters(state, seat, ctx.cards)) : (state.seats[attack.seat]?.heroes ?? []);
  const only = pool.filter((id) => matchesPick(state, id, pick, { seat: attack.seat, sourceId: focus.sourceId, counting: true }, ctx));
  if (only.length === 0) return state;
  const named = attack.heroId;
  const kept = named == null || named === "" || only.includes(named) ? named : only.length === 1 ? only[0] : undefined;
  const { heroId: _named, ...rest } = attack;
  return { ...state, pendingAttack: { ...rest, onlyHeroes: only, ...(kept != null ? { heroId: kept } : {}) } };
}

// The cards the damage of an undefended attack may be assigned to: the active locations when a shadow effect says it goes on one.
export function undefendedLocations(state: ScenarioState): string[] {
  const attack = state.pendingAttack;
  if (attack?.toLocation) return activeLocations(state);
  // Mordor Orc's undefended damage goes on Minas Tirith while it is in play (families/pelennor/combat.ts).
  const city = attack ? undefendedToCity(state, attack.enemyId) : undefined;
  return city ? [city] : [];
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
