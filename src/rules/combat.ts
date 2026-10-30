// Rules: rr.combat-phase, rr.defending-player, rr.attacks-outside-the-combat-phase, rr.step-6-2, rr.step-6-4b, rr.ranged,
// rr.step-6-8b, rr.step-6-8-1, mec109.archery, faq.limitations-on-attacks, ltp.deal-shadow-cards, ltp.resolve-enemy-attacks,
// ltp.undefended-attack, ltp.resolve-player-attacks (data/rules/entries.json).
import { attackBarred } from "./constants.ts";
import type { EngineStep } from "./intents.ts";
import { modifiedStat, placeDamage } from "./keywords.ts";
import { isAllyLike, isCharacterType, printedOf, type PrintedCard } from "./printed.ts";
import type { ScenarioState } from "./state.ts";
import { flagged, livingSeats, updateCard } from "./state.ts";
import { dealOneShadow, type ReduceContext } from "./interpret.ts";
import { queueEvent } from "./queue.ts";
import { resolveAttack } from "./shadow.ts";
import { engagementCostOf } from "./quest.ts";
import { enemyAttackWindow, playerAttackWindow } from "./step-window.ts";
import { inPlay } from "./zones.ts";
import { titleBarred } from "./families/nightmare-guards.ts";
import { ruleCause } from "./cause.ts";
import { fireForced } from "./triggers.ts";
import { undefendedExtras } from "./families/defense-damage.ts";
import { markDefender, moreDefenders } from "./families/defense-defenders.ts";
import { holdAttack, queueHeard } from "./families/defense-listen.ts";
import { awaitStrike, backAfter, declareStrike, endStrike } from "./families/attack-flow.ts";
import { countsDefense, struck } from "./families/attack-strike.ts";
import { attackHere, dealForAttack, engagedWithAll, stagingAttackers, undefendedLocations } from "./families/south-watcher.ts";
import { offeredTargets, stagingAttackable, withCardTargets } from "./families/attack-targets.ts";

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
    // An ally attached to another card (Wild Stallion) is an attachment, not a character.
    if (isAllyLike(printed) && instance.host == null) ids.push(id);
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
    // An enemy in the staging area that is considered engaged with each player (families/south-watcher.ts).
    const staging = stagingAttackers(state, seat);
    if (enemies.length + staging.length > 0) return { seat, enemies: [...enemies, ...staging] };
  }
  return null;
}

// The shadow card is not turned up yet: it resolves once the defender is declared or the attack is undefended.
// Forced effects "when this enemy attacks" (141069:A:2) resolve as the attack begins (rr.step-6-4b), before the defender is
// declared: the defense window waits for their frames.
export function beginEnemyAttack(
  state: ScenarioState,
  seat: number,
  enemyId: string,
  ctx: ReduceContext,
  steps: EngineStep[],
  // An effect made an enemy in the staging area attack (families/south-watcher.ts).
  fromStaging = false,
): ScenarioState {
  const attacker = state.cards[enemyId];
  const here = attacker != null && (attacker.zone === "engaged" || engagedWithAll(state, enemyId) || (fromStaging && attacker.zone === "staging"));
  if (!attacker || !here || attackBarred(state, enemyId, seat)) return state;
  steps.push({ kind: "attack", side: "enemy", seat, enemyId });
  const dealt = engagedWithAll(state, enemyId) ? dealForAttack(state, enemyId) : state;
  const declared: ScenarioState = { ...dealt, pendingAttack: { enemyId, seat, ...(fromStaging ? { fromStaging: true } : {}) }, activeSeat: seat, window: null };
  const fired = fireForced(declared, { trigger: "attacks", seat, cardId: enemyId }, ctx, steps);
  if (fired.stack.length > declared.stack.length && fired.pendingAttack) {
    return { ...fired, pendingAttack: { ...fired.pendingAttack, defenseWaits: true } };
  }
  return toDefense(declared, ctx);
}

// 6.4b: the attack has begun; an action window comes before the defender is declared. "After an enemy is declared as an
// attacker against you" is announced first, and the defense waits for its Responses (enemyAttacks).
function toDefense(state: ScenarioState, ctx: ReduceContext): ScenarioState {
  const attack = state.pendingAttack;
  if (!attack) return state;
  const begun = queueHeard(state, ctx, { trigger: "enemyAttacks", seat: attack.seat, cardId: attack.enemyId, subject: attack.enemyId });
  return enemyAttackWindow(begun, ctx, "defense") ?? holdAttack(begun, ctx, "defense", ["enemyAttacks"]) ?? { ...begun, window: { kind: "defense", enemyId: attack.enemyId, seat: attack.seat }, activeSeat: attack.seat };
}

// The Forced effects of the attack's start are done: the defender is declared next.
export function openDefense(state: ScenarioState, ctx: ReduceContext): ScenarioState {
  const attack = state.pendingAttack;
  if (!attack?.defenseWaits) return state;
  const { defenseWaits: _done, ...rest } = attack;
  // The enemy left play while they resolved: the attack is over.
  if (!attackHere(state, attack.enemyId)) return { ...state, pendingAttack: null };
  return toDefense({ ...state, pendingAttack: rest }, ctx);
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
  if (!isCharacterType(printed) || instance.host != null) return false;
  if (flagged(state, defenderId, "cannotDefend")) return false;
  if (instance.controller === attackedSeat) return true;
  return printed.keywords.sentinel || flagged(state, defenderId, "sentinel");
}

export function applyDefense(
  state: ScenarioState,
  defenderId: string,
  ctx: ReduceContext,
  steps: EngineStep[],
): ScenarioState {
  const attack = state.pendingAttack;
  if (!attack || !state.cards[attack.enemyId] || !state.cards[defenderId]) return state;
  // A character with "does not exhaust to defend" stays ready (rr.exhausted). Its declaration is announced ("After ~ is
  // declared as a defender").
  const ready = flagged(state, defenderId, "noExhaustDefend");
  const declaredState = ready ? state : updateCard(state, defenderId, { exhausted: true });
  const exhausted: ScenarioState = markDefender(
    {
      ...queueEvent(declaredState, { trigger: "declaredDefender", seat: attack.seat, cardId: defenderId, other: attack.enemyId }),
      pendingAttack: { ...attack, defenderId },
      window: null,
    },
    defenderId,
    ctx,
  );
  // A player who may declare more defenders declares them next (01038).
  const more = moreDefenders(exhausted, ctx, steps);
  if (more) return more;
  // 6.4.1: the defender is declared; an action window comes before the shadow card is turned up. The Responses to the
  // declaration ("After ~ is declared as a defender") come before the shadow card too.
  return enemyAttackWindow(exhausted, ctx, "shadow") ?? holdAttack(exhausted, ctx, "shadow", ["declaredDefender"]) ?? resolveAttack(exhausted, ctx, steps);
}

export function applyUndefended(
  state: ScenarioState,
  heroId: string,
  ctx: ReduceContext,
  steps: EngineStep[],
): ScenarioState {
  const attack = state.pendingAttack;
  if (!attack || !state.cards[attack.enemyId]) return state;
  const named: ScenarioState = { ...state, pendingAttack: { ...attack, heroId }, window: null };
  // The attack is undefended (6.4.1); an action window comes before the shadow card is turned up. A shadow effect that
  // made a defended attack undefended has already resolved, so the attack goes straight on.
  if (attack.shadowResolved) return resolveAttack(named, ctx, steps);
  return enemyAttackWindow(named, ctx, "shadow") ?? resolveAttack(named, ctx, steps);
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
  if (!isCharacterType(printed) || attacker.host != null) return false;
  // "You cannot attack ... enemies with a title other than Marshland Outlaws" (attackOnlyTitle, 900202:A:1).
  if (titleBarred(state, attacker.controller, enemyId, cards)) return false;
  // An enemy any character may choose as the target of an attack (attackableByAny) may be in the staging area; others there
  // only when a card lets the character attack it (families/attack-targets.ts).
  const open = flagged(state, enemyId, "attackableByAny");
  // A location in the staging area the first player may attack in the combat phase as if it were engaged with him (Cracked Pillar, 41028:A:1).
  if (enemy.zone === "staging" && flagged(state, enemyId, "attackableAsEngaged")) {
    if (flagged(state, attackerId, "cannotAttack") || state.phase !== "Combat" || seat !== state.firstPlayer) return false;
    return attacker.controller === seat || printed.keywords.ranged || flagged(state, attackerId, "ranged");
  }
  if (enemy.zone !== "engaged" && !(open && enemy.zone === "staging")) return stagingAttackable(state, seat, attackerId, enemyId, cards);
  // The declaring seat's own characters attack its own enemies. A ranged character may attack an enemy engaged with
  // another player, and may join an attack another player declares (rr.ranged, rr.step-6-8-1).
  if (flagged(state, attackerId, "cannotAttack")) return false;
  if (open) return true;
  if (attacker.controller === seat && enemy.controller === seat) return true;
  return printed.keywords.ranged || flagged(state, attackerId, "ranged");
}

export function legalAttackEnemies(state: ScenarioState, seat: number, attackerId: string, cards: Cards, exhaustedOk = false): string[] {
  const ids: string[] = [];
  for (let index = 0; index < state.seatCount; index += 1) {
    for (const enemyId of state.seats[index]?.engaged ?? []) {
      if (canAttack(state, seat, attackerId, enemyId, cards, exhaustedOk)) ids.push(enemyId);
    }
  }
  // Enemies in the staging area a card lets it attack; in a window a card opened, only that window's targets.
  return withCardTargets(state, ids, (enemyId) => canAttack(state, seat, attackerId, enemyId, cards, exhaustedOk));
}

// The framework gives a seat one declared attack against each enemy each combat phase; an attack a card effect makes
// (Quick Strike, a card's attack window) is extra and does not count (faq.limitations-on-attacks).
export function attackDeclared(state: ScenarioState, seat: number, enemyId: string): boolean {
  return offeredTargets(state) == null && state.declaredAttacks.includes(`${seat}:${enemyId}`);
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
  // An attack in a window a card opened is extra: it is not counted against the one attack per enemy.
  const extra = offeredTargets(state) != null;
  let next: ScenarioState = { ...state, declaredAttacks: extra ? state.declaredAttacks : [...state.declaredAttacks, `${seat}:${enemyId}`], window: null };
  for (const attackerId of attackerIds) {
    if (!next.cards[attackerId]) continue;
    if (!flagged(next, attackerId, "noExhaustAttack")) next = updateCard(next, attackerId, { exhausted: true });
    next = queueEvent(next, { trigger: "declaredAttacker", seat, cardId: attackerId, other: enemyId });
  }
  const declared: ScenarioState = declareStrike(next, { seat, enemyId, attackerIds: [...attackerIds], ...backAfter(state.window, enemyId) });
  // 6.8.1: the attack and its attackers are declared; an action window comes before its strength and damage. The Responses to
  // the declaration ("After ~ is declared as an attacker") resolve before them either way (families/attack-flow.ts).
  return playerAttackWindow(declared, ctx, "strike") ?? awaitStrike(declared, ctx) ?? continueStrike(declared, ctx, steps);
}

// The rest of a declared player attack after its step window: the damage (6.8.2, 6.8.3), the window after it, and the end
// of the attack (6.8.4), when the active player may declare the next one.
export function continueStrike(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const strike = state.pendingStrike;
  if (!strike) return state;
  let next = state;
  const { awaiting, awaitDepth: _depth, ...declared } = strike;
  if (awaiting !== "end") {
    next = strikeEnemy({ ...state, pendingStrike: declared }, strike.seat, strike.enemyId, strike.attackerIds, ctx, steps);
    const after = playerAttackWindow(next, ctx, "end");
    if (after) return after;
  }
  // 6.8.4: "for this attack" expires, the window the attack came from comes back (families/attack-flow.ts).
  return endStrike({ ...next, pendingStrike: next.pendingStrike ?? declared }, ctx, steps);
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
  const attack = attackStrength(next, attackerIds, enemyId, ctx.cards);
  // An attacker may say the enemy does not count its Defense (families/attack-strike.ts).
  const defense = countsDefense(next, attackerIds) ? modifiedStat(next, enemy, "defense", ctx.cards) : 0;
  steps.push({ kind: "attack", side: "player", seat, enemyId, attackerIds: [...attackerIds] });
  const enemyNow = next.cards[enemyId];
  if (!enemyNow) return next;
  steps.push({ kind: "strike", side: "player", enemyId, targetId: enemyId, attack, defense, undefended: false, cause: ruleCause("rr.step-6-8-3") });
  const damaged = placeDamage(next, enemyId, Math.max(0, attack - defense), ctx.cards, steps, "combat", ruleCause("rr.step-6-8-3"));
  // Each attacker hears that the attack damaged or destroyed the enemy ("After Merry participates in an attack that destroys
  // an enemy"), and excess damage goes where a card sends it (families/attack-strike.ts).
  return struck(next, damaged, seat, enemyId, attackerIds, Math.max(0, attack - defense), ctx, steps);
}

// The attack strength of characters attacking one enemy (rr.step-6-8-2): each attacker's attack, read against that enemy.
export function attackStrength(state: ScenarioState, attackerIds: readonly string[], enemyId: string, cards: Cards): number {
  let attack = 0;
  for (const attackerId of attackerIds) {
    const attacker = state.cards[attackerId];
    if (attacker) attack += modifiedStat(state, attacker, "attack", cards, enemyId);
  }
  return attack;
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

// The characters an undefended attack's damage may be assigned to: the seat's heroes, and a character that says damage from
// undefended attacks may be assigned to it (takesUndefendedDamage).
export function undefendedTargets(state: ScenarioState, seat: number, cards: Cards): string[] {
  // A shadow effect sent the damage to an active location (families/south-watcher.ts).
  const locations = undefendedLocations(state);
  if (locations.length > 0) return locations;
  const heroes = heroIds(state, seat);
  const own = [...heroes, ...characters(state, seat, cards).filter((id) => !heroes.includes(id) && flagged(state, id, "takesUndefendedDamage"))];
  // A character another card lets take it for this player (08093), whoever controls that character.
  return [...own, ...undefendedExtras(state, seat, cards).filter((id) => !own.includes(id))];
}
