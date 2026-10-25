// Rules: rr.combat-phase, rr.defending-player, rr.attacks-outside-the-combat-phase, rr.step-6-2, rr.ranged, rr.step-6-8b,
// rr.step-6-8-1, mec109.archery, faq.limitations-on-attacks, ltp.deal-shadow-cards, ltp.resolve-enemy-attacks,
// ltp.undefended-attack, ltp.resolve-player-attacks (data/rules/entries.json).
import { attackBarred } from "./constants.ts";
import type { EngineStep } from "./intents.ts";
import { modifiedStat, placeDamage } from "./keywords.ts";
import { isAllyLike, isCharacterType, printedOf, type PrintedCard } from "./printed.ts";
import type { ScenarioState } from "./state.ts";
import { livingSeats, updateCard } from "./state.ts";
import { dealOneShadow, type ReduceContext } from "./interpret.ts";
import { queueEvent } from "./queue.ts";
import { resolveAttack } from "./shadow.ts";
import { engagementCostOf } from "./quest.ts";
import { inPlay } from "./zones.ts";
import { ruleCause } from "./cause.ts";

type Cards = ReadonlyMap<string, PrintedCard>;

export function archeryTotal(state: ScenarioState, cards: Cards): number {
  let total = 0;
  for (const instance of Object.values(state.cards)) {
    if (!inPlay(instance.zone)) continue;
    const value = printedOf(cards, instance.code).keywords.archery;
    if (value != null && value > 0) total += value;
  }
  return total;
}

export function archeryRecipients(state: ScenarioState, cards: Cards): string[] {
  const ids: string[] = [];
  for (let index = 0; index < state.seatCount; index += 1) {
    const seat = state.seats[index];
    if (!seat || seat.eliminated) continue;
    ids.push(...characters(state, index, cards));
  }
  return ids;
}

export function characters(state: ScenarioState, seat: number, cards: Cards): string[] {
  const ids = [...(state.seats[seat]?.heroes ?? [])];
  for (const id of state.seats[seat]?.play ?? []) {
    const instance = state.cards[id];
    if (!instance) continue;
    const printed = printedOf(cards, instance.code);
    if (isAllyLike(printed)) ids.push(id);
  }
  return ids;
}

// Each seat's enemies in player order, the highest engagement cost first (rr.step-6-2). Equal costs keep the order
// they engaged in.
export function dealShadows(state: ScenarioState, cards: Cards): ScenarioState {
  let next = state;
  for (const seat of livingSeats(next)) {
    const cost = (id: string) => {
      const instance = next.cards[id];
      return instance ? (engagementCostOf(next, instance, cards) ?? 0) : 0;
    };
    const order = [...(next.seats[seat]?.engaged ?? [])].sort((a, b) => cost(b) - cost(a));
    for (const enemyId of order) next = dealOneShadow(next, enemyId);
  }
  return next;
}

export function nextEnemyGroup(state: ScenarioState): { seat: number; enemies: string[] } | null {
  for (const seat of livingSeats(state)) {
    const enemies = (state.seats[seat]?.engaged ?? []).filter(
      (id) => !state.resolvedAttacks.includes(id) && !attackBarred(state, id, seat),
    );
    if (enemies.length > 0) return { seat, enemies };
  }
  return null;
}

// The shadow card is not turned up yet: it resolves once the defender is declared or the attack is undefended.
export function beginEnemyAttack(
  state: ScenarioState,
  seat: number,
  enemyId: string,
  _ctx: ReduceContext,
  steps: EngineStep[],
): ScenarioState {
  const attacker = state.cards[enemyId];
  if (!attacker || attacker.zone !== "engaged" || attackBarred(state, enemyId, seat)) return state;
  steps.push({ kind: "attack", side: "enemy", seat, enemyId });
  return {
    ...state,
    pendingAttack: { enemyId, seat },
    window: { kind: "defense", enemyId, seat },
    activeSeat: seat,
  };
}

export function defenderIds(state: ScenarioState, attackedSeat: number, cards: Cards): string[] {
  const ids: string[] = [];
  for (let index = 0; index < state.seatCount; index += 1) {
    if (state.seats[index]?.eliminated) continue;
    for (const id of characters(state, index, cards)) {
      if (canDefend(state, attackedSeat, id, cards)) ids.push(id);
    }
  }
  return ids;
}

export function canDefend(state: ScenarioState, attackedSeat: number, defenderId: string, cards: Cards): boolean {
  const instance = state.cards[defenderId];
  if (!instance || instance.exhausted) return false;
  if (instance.zone !== "heroes" && instance.zone !== "play") return false;
  const printed = printedOf(cards, instance.code);
  if (!isCharacterType(printed)) return false;
  if (instance.controller === attackedSeat) return true;
  return printed.keywords.sentinel;
}

export function applyDefense(
  state: ScenarioState,
  defenderId: string,
  ctx: ReduceContext,
  steps: EngineStep[],
): ScenarioState {
  const attack = state.pendingAttack;
  if (!attack || !state.cards[attack.enemyId] || !state.cards[defenderId]) return state;
  const exhausted = updateCard(state, defenderId, { exhausted: true });
  return resolveAttack({ ...exhausted, pendingAttack: { ...attack, defenderId } }, ctx, steps);
}

export function applyUndefended(
  state: ScenarioState,
  heroId: string,
  ctx: ReduceContext,
  steps: EngineStep[],
): ScenarioState {
  const attack = state.pendingAttack;
  if (!attack || !state.cards[attack.enemyId]) return state;
  return resolveAttack({ ...state, pendingAttack: { ...attack, heroId } }, ctx, steps);
}

export function canAttack(
  state: ScenarioState,
  seat: number,
  attackerId: string,
  enemyId: string,
  cards: Cards,
  // An attack an effect declares after the attacker was exhausted to pay for it.
  exhaustedOk = false,
): boolean {
  const attacker = state.cards[attackerId];
  const enemy = state.cards[enemyId];
  if (!attacker || !enemy || (attacker.exhausted && !exhaustedOk) || attacker.controller == null) return false;
  if (attacker.zone !== "heroes" && attacker.zone !== "play") return false;
  const printed = printedOf(cards, attacker.code);
  if (!isCharacterType(printed)) return false;
  if (enemy.zone !== "engaged") return false;
  // The declaring seat's own characters attack its own enemies. A ranged character may attack an enemy engaged with
  // another player, and may join an attack another player declares (rr.ranged, rr.step-6-8-1).
  if (attacker.controller === seat && enemy.controller === seat) return true;
  return printed.keywords.ranged;
}

export function legalAttackEnemies(state: ScenarioState, seat: number, attackerId: string, cards: Cards, exhaustedOk = false): string[] {
  const ids: string[] = [];
  for (let index = 0; index < state.seatCount; index += 1) {
    for (const enemyId of state.seats[index]?.engaged ?? []) {
      if (canAttack(state, seat, attackerId, enemyId, cards, exhaustedOk)) ids.push(enemyId);
    }
  }
  return ids;
}

// The framework gives a seat one declared attack against each enemy each combat phase; an attack a card effect makes
// (Quick Strike) is extra and does not count (faq.limitations-on-attacks).
export function attackDeclared(state: ScenarioState, seat: number, enemyId: string): boolean {
  return state.declaredAttacks.includes(`${seat}:${enemyId}`);
}

// The enemies the seat may still declare an attack against with this character.
export function declarableEnemies(state: ScenarioState, seat: number, attackerId: string, cards: Cards): string[] {
  return legalAttackEnemies(state, seat, attackerId, cards).filter((enemyId) => !attackDeclared(state, seat, enemyId));
}

export function hasLegalAttack(state: ScenarioState, seat: number, cards: Cards): boolean {
  for (const attackerId of characters(state, seat, cards)) {
    if (declarableEnemies(state, seat, attackerId, cards).length > 0) return true;
  }
  return false;
}

export function applyPlayerAttack(
  state: ScenarioState,
  seat: number,
  enemyId: string,
  attackerIds: readonly string[],
  ctx: ReduceContext,
  steps: EngineStep[],
): ScenarioState {
  const enemy = state.cards[enemyId];
  if (!enemy) return state;
  let next: ScenarioState = { ...state, declaredAttacks: [...state.declaredAttacks, `${seat}:${enemyId}`] };
  for (const attackerId of attackerIds) {
    if (next.cards[attackerId]) next = updateCard(next, attackerId, { exhausted: true });
  }
  return strikeEnemy(next, seat, enemyId, attackerIds, ctx, steps);
}

// The attackers' strength against the enemy's defense, as combat damage. The attackers are already exhausted: a player
// attack exhausts them when it is declared, and Quick Strike when it is paid for.
export function strikeEnemy(
  state: ScenarioState,
  seat: number,
  enemyId: string,
  attackerIds: readonly string[],
  ctx: ReduceContext,
  steps: EngineStep[],
): ScenarioState {
  const enemy = state.cards[enemyId];
  if (!enemy) return state;
  const next = state;
  let attack = 0;
  for (const attackerId of attackerIds) {
    const attacker = next.cards[attackerId];
    if (attacker) attack += modifiedStat(next, attacker, "attack", ctx.cards, enemyId);
  }
  const defense = modifiedStat(next, enemy, "defense", ctx.cards);
  steps.push({ kind: "attack", side: "player", seat, enemyId });
  const enemyNow = next.cards[enemyId];
  if (!enemyNow) return next;
  const damaged = placeDamage(next, enemyId, Math.max(0, attack - defense), ctx.cards, steps, "framework", ruleCause("rr.step-6-8-3"));
  // Each attacker hears that the attack destroyed the enemy ("After Merry participates in an attack that destroys an enemy").
  if (damaged.cards[enemyId]?.zone === "engaged") return damaged;
  return attackerIds.reduce((current, attackerId) => queueEvent(current, { trigger: "attackDestroyed", seat, cardId: attackerId, subject: enemyId, participants: attackerIds }), damaged);
}

export function assignArchery(
  state: ScenarioState,
  assignments: readonly { cardId: string; amount: number }[],
  ctx: ReduceContext,
  steps: EngineStep[],
): ScenarioState {
  let next = state;
  for (const assignment of assignments) {
    if (assignment.amount <= 0) continue;
    next = placeDamage(next, assignment.cardId, assignment.amount, ctx.cards, steps, "framework", ruleCause("mec109.archery"));
  }
  return { ...next, window: null };
}

export function heroIds(state: ScenarioState, seat: number): string[] {
  return [...(state.seats[seat]?.heroes ?? [])];
}
