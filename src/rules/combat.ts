// Rules: rr.combat-phase, rr.defending-player, rr.attacks-outside-the-combat-phase, mec109.archery (data/rules/entries.json).
import { attackBarred } from "./constants.ts";
import type { EngineStep } from "./intents.ts";
import { modifiedStat, placeDamage } from "./keywords.ts";
import { isAllyLike, isCharacterType, printedOf, type PrintedCard } from "./printed.ts";
import type { ScenarioState } from "./state.ts";
import { livingSeats, updateCard } from "./state.ts";
import { dealOneShadow, type ReduceContext } from "./interpret.ts";
import { resolveAttack } from "./shadow.ts";
import { inPlay } from "./zones.ts";

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

export function dealShadows(state: ScenarioState, _steps: EngineStep[]): ScenarioState {
  let next = state;
  for (const seat of livingSeats(next)) {
    for (const enemyId of next.seats[seat]?.engaged ?? []) {
      next = dealOneShadow(next, enemyId);
    }
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
): boolean {
  const attacker = state.cards[attackerId];
  const enemy = state.cards[enemyId];
  if (!attacker || !enemy || attacker.exhausted || attacker.controller !== seat) return false;
  if (attacker.zone !== "heroes" && attacker.zone !== "play") return false;
  const printed = printedOf(cards, attacker.code);
  if (!isCharacterType(printed)) return false;
  if (enemy.zone !== "engaged") return false;
  if (enemy.controller === seat) return true;
  return printed.keywords.ranged;
}

export function legalAttackEnemies(state: ScenarioState, seat: number, attackerId: string, cards: Cards): string[] {
  const ids: string[] = [];
  for (let index = 0; index < state.seatCount; index += 1) {
    for (const enemyId of state.seats[index]?.engaged ?? []) {
      if (canAttack(state, seat, attackerId, enemyId, cards)) ids.push(enemyId);
    }
  }
  return ids;
}

export function hasLegalAttack(state: ScenarioState, seat: number, cards: Cards): boolean {
  for (const attackerId of characters(state, seat, cards)) {
    if (legalAttackEnemies(state, seat, attackerId, cards).length > 0) return true;
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
  let next = state;
  let attack = 0;
  for (const attackerId of attackerIds) {
    const attacker = next.cards[attackerId];
    if (!attacker) continue;
    attack += modifiedStat(next, attacker, "attack", ctx.cards);
    next = updateCard(next, attackerId, { exhausted: true });
  }
  const defense = modifiedStat(next, enemy, "defense", ctx.cards);
  steps.push({ kind: "attack", side: "player", seat, enemyId });
  const enemyNow = next.cards[enemyId];
  if (!enemyNow) return next;
  return placeDamage(next, enemyId, Math.max(0, attack - defense), ctx.cards, steps, "framework");
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
    next = placeDamage(next, assignment.cardId, assignment.amount, ctx.cards, steps, "framework");
  }
  return { ...next, window: null };
}

export function heroIds(state: ScenarioState, seat: number): string[] {
  return [...(state.seats[seat]?.heroes ?? [])];
}
