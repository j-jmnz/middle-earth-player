// Rules: rr.combat-phase, rr.defending-player, rr.attacks-outside-the-combat-phase, rr.step-6-2, rr.step-6-4b, rr.ranged,
// rr.step-6-8b, rr.step-6-8-1, mec109.archery, faq.limitations-on-attacks, ltp.deal-shadow-cards, ltp.resolve-enemy-attacks,
// ltp.undefended-attack, ltp.resolve-player-attacks (data/rules/entries.json).
import { familyAttackReason, familyDefenseReason, familyUndefendedTargets } from "../interpret/family-hooks.ts";
import { announceEnemyAttacked, attackerLimitReached } from "../families/aflame/attack.ts";
import { attackBarred } from "../interpret/constants.ts";
import type { EngineStep } from "../core/intents.ts";
import { runAtEnd } from "./attack-end.ts";
import { hasKeyword, modifiedStat, placeDamage } from "../core/keywords.ts";
import { heldAmountByClass } from "../core/holder-classes.ts";
import { isAllyLike, isCharacterType, printedOf, type PrintedCard } from "../core/printed.ts";
import type { CardInstance, ScenarioState } from "../core/state.ts";
import { flagged, heldAmount, livingSeats } from "../core/state.ts";
import { dealStepShadow, type ReduceContext } from "../interpret/interpret.ts";
import { queueEvent } from "../windows/queue.ts";
import { exhaustAnnounced } from "../windows/exhaust.ts";
import { resolveAttack } from "./shadow.ts";
import { engagementCostOf } from "../quest/quest.ts";
import { enemyAttackWindow, playerAttackWindow } from "../engine/step-window.ts";
import { inPlay } from "../core/zones.ts";
import { titleBarred } from "../families/nightmare/guards.ts";
import { stagedCommitted } from "../families/pelargir/committed.ts";
import { ruleCause } from "../core/cause.ts";
import { fireForced } from "../windows/triggers.ts";
import { damageBarred, undefendedExtras } from "../families/defense/damage.ts";
import { exhaustedToDefend, markDefender, moreDefenders, staysReadyToDefend } from "../families/defense/defenders.ts";
import { holdAttack, queueHeard } from "../families/defense/listen.ts";
import { awaitStrike, backAfter, declareStrike, endStrike } from "../families/attack/flow.ts";
import { flightAttackBarred } from "../families/attack/flight.ts";
import { countsDefense, rangedAttack, struck } from "../families/attack/strike.ts";
import { attackStatOf, placeAttackDamage } from "../families/pelargir/stage-attack.ts";
import { mustBeDeclared } from "../families/armies/defender.ts";
import { attackHere, dealForAttack, engagedWithAll, noteBelowThreat, stagingAttackers, undefendedLocations, viaRelay } from "../families/south/watcher.ts";
import { engagedWithThreatening } from "../core/engaged.ts";
import { offeredTargets, stagingAttackable, withCardTargets } from "../families/attack/targets.ts";
import { barredFromDreadnaught } from "../families/sea/dreadnaught.ts";

import { hasTrait } from "../interpret/conditions.ts";

type Cards = ReadonlyMap<string, PrintedCard>;

// The archery one card in play counts: `keyword` is its printed value and what effects added to it ("gains archery 4", dcce.archery; the effects of several
// cards are cumulative), `own` what it gives itself (Archery X with X "the number of players at this stage", 142070:A:1; "+2 archery in the staging area",
// 142078:A:1), which can be negative. The total below and the card preview's keyword chips both read it, so they say the same number.
export function cardArchery(state: ScenarioState, cards: Cards, instance: CardInstance): { keyword: number; own: number } {
  const printed = printedOf(cards, instance.code);
  const keyword = (printed.keywords.archery ?? 0) + heldAmountByClass(state, instance, printed, "archery", (trait) => hasTrait(state, instance.id, trait, { effects: [], cards }));
  if (state.modifiers.length === 0) return { keyword, own: 0 };
  // One player at each separate stage, the players in the game before that.
  const players = flagged(state, instance.id, "archeryPlayers") ? (state.separate ? 1 : livingSeats(state).length) : 0;
  return { keyword, own: heldAmount(state, instance.id, "archeryBonus") + players };
}

// The archery total. Once stages are separate it is calculated at each stage (mec109.multiple-staging-areas): `seat`'s staging area, its engaged
// enemies and its stage.
export function archeryTotal(state: ScenarioState, cards: Cards, seat?: number): number {
  const stage = seat != null && state.separate ? new Set([...(state.seats[seat]?.staging ?? []), ...(state.seats[seat]?.engaged ?? []), ...(state.seats[seat]?.stage ? [state.seats[seat]?.stage ?? ""] : [])]) : null;
  let total = 0;
  for (const instance of Object.values(state.cards)) {
    if (!inPlay(instance.zone) || (stage && !stage.has(instance.id))) continue;
    const { keyword, own } = cardArchery(state, cards, instance);
    if (keyword > 0) total += keyword;
    total += own;
  }
  // Archery a seat's stage gains until the end of the round (142082:A:1).
  for (const index of livingSeats(state)) if (seat == null || index === seat) total += heldAmount(state, `seat:${index}`, "archeryBonus");
  // A card that reduces the total ("reduce the archery total by 4", 12137:A:3) leaves it at 0 at the least.
  return Math.max(0, total);
}

// The characters archery damage may go to; once stages are separate, only the characters of the seat at that stage.
export function archeryRecipients(state: ScenarioState, cards: Cards, seat?: number): string[] {
  const ids: string[] = [];
  for (let index = 0; index < state.seatCount; index += 1) {
    const owner = state.seats[index];
    if (!owner || owner.eliminated || (seat != null && state.separate && index !== seat)) continue;
    ids.push(...characters(state, index, cards));
  }
  // An ally objective committed from the staging area is a character in play too (05052:A:1, families/pelargir/committed.ts).
  ids.push(...stagedCommitted(state, seat));
  // "Archery damage must be assigned to allies, if able" (143058:A:2).
  if (state.modifiers.length > 0 && flagged(state, "table", "archeryToAllies")) {
    const allies = ids.filter((id) => {
      const instance = state.cards[id];
      return instance != null && isAllyLike(printedOf(cards, instance.code));
    });
    if (allies.length > 0) return allies;
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
export function dealShadows(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  let next = noteBelowThreat(state);
  for (const seat of livingSeats(next)) {
    const cost = (id: string) => {
      const instance = next.cards[id];
      return instance ? (engagementCostOf(next, instance, ctx.cards) ?? 0) : 0;
    };
    const order = [...(next.seats[seat]?.engaged ?? [])].sort((a, b) => cost(b) - cost(a));
    for (const enemyId of order) next = dealStepShadow(next, enemyId, steps, ctx);
  }
  return next;
}

export function nextEnemyGroup(state: ScenarioState): { seat: number; enemies: string[] } | null {
  for (const seat of livingSeats(state)) {
    const enemies = (state.seats[seat]?.engaged ?? []).filter(
      (id) => !state.resolvedAttacks.includes(id) && !attackBarred(state, id, seat),
    );
    // An enemy in the staging area that is considered engaged with each player (families/south/watcher.ts).
    const staging = stagingAttackers(state, seat);
    if (enemies.length + staging.length > 0) return { seat, enemies: [...enemies, ...staging] };
  }
  return null;
}

// The shadow card is not turned up yet: it resolves once the defender is declared or the attack is undefended.
// Forced effects "when this enemy attacks" (141069:A:2) resolve as the attack begins (rr.step-6-4b), before the defender is
// declared: the defense window waits for their frames.
export type BeginAttackOptions = { readonly fromStaging?: boolean; readonly shadow?: boolean };

export function beginEnemyAttack(
  state: ScenarioState,
  seat: number,
  enemyId: string,
  ctx: ReduceContext,
  steps: EngineStep[],
  options: BeginAttackOptions = {},
): ScenarioState {
  // `fromStaging`: an effect made an enemy in the staging area attack (families/south/watcher.ts). `shadow: false`: no shadow card is dealt for the attack, though the enemy is considered engaged with each player ("Do not deal a shadow card for this attack", 19083:B:1).
  const { fromStaging = false, shadow = true } = options;
  const attacker = state.cards[enemyId];
  const here = attacker != null && (attacker.zone === "engaged" || engagedWithAll(state, enemyId) || viaRelay(state, enemyId) || (fromStaging && (attacker.zone === "staging" || attacker.zone === "riddleArea")));
  if (!attacker || !here || attackBarred(state, enemyId, seat)) return state;
  steps.push({ kind: "attack", side: "enemy", seat, enemyId });
  // An attack an effect makes from the staging area was dealt its shadow card by the effect (attackNowFromStaging, immediateAttack): one deal per attack.
  const dealt = shadow && !fromStaging && (engagedWithAll(state, enemyId) || viaRelay(state, enemyId)) ? dealForAttack(state, enemyId, steps, ctx, seat) : state;
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
export function openDefense(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const attack = state.pendingAttack;
  if (!attack?.defenseWaits) return state;
  const { defenseWaits: _done, ...rest } = attack;
  // The enemy left play while they resolved: the attack is over.
  // What waited on the attack still happens (combat/attack-end.ts).
  if (!attackHere(state, attack.enemyId)) return runAtEnd({ ...state, pendingAttack: null }, attack, steps);
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
  if (!instance || (instance.exhausted && !mustBeDeclared(state, defenderId, cards))) return false;
  if (instance.zone !== "heroes" && instance.zone !== "play") return false;
  const printed = printedOf(cards, instance.code);
  if (!isCharacterType(printed) || instance.host != null) return false;
  if (flagged(state, defenderId, "cannotDefend")) return false;
  // A character that cannot exhaust (Shadow of Fear, 03027:A:1) defends only where it stays ready.
  if (flagged(state, defenderId, "cannotExhaust") && !flagged(state, defenderId, "noExhaustDefend")) return false;
  // A ship-enemy's attack is defended only by a ship-objective, and a ship-objective defends only against one (dcce.ship-enemies).
  if (familyDefenseReason(state, printed, cards, defenderId)) return false;
  if (instance.controller === attackedSeat) return true;
  // The keyword as the table reads it now: a blank text box (Devilry of Saruman, 143043) or a lost Sentinel takes it away, as the declaration's check reads it (engine/legal.ts defenderReason).
  return hasKeyword(state, defenderId, "sentinel", cards);
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
  const ready = staysReadyToDefend(state, defenderId, ctx);
  const declaredState = ready ? state : exhaustAnnounced(state, defenderId, ctx);
  const exhausted: ScenarioState = markDefender(
    {
      ...queueEvent(declaredState, { trigger: "declaredDefender", seat: attack.seat, cardId: defenderId, other: attack.enemyId, ...exhaustedToDefend(state, declaredState, defenderId, ctx) }),
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
  return enemyAttackWindow(exhausted, ctx, "shadow") ?? holdAttack(exhausted, ctx, "shadow", ["declaredDefender", "exhausted"]) ?? resolveAttack(exhausted, ctx, steps);
}

export function applyUndefended(
  state: ScenarioState,
  heroId: string | undefined,
  ctx: ReduceContext,
  steps: EngineStep[],
): ScenarioState {
  const attack = state.pendingAttack;
  if (!attack || !state.cards[attack.enemyId]) return state;
  // No hero is named yet: the attack is left undefended, and the damage is assigned to a hero at the damage step, after the shadow
  // effect (rr.step-6-4-3; resolveAttack asks). A hero named with the declaration stands.
  const left: ScenarioState = { ...state, pendingAttack: heroId == null ? { ...attack, undefended: true } : { ...attack, heroId }, window: null };
  // The attack is undefended (6.4.1); an action window comes before the shadow card is turned up. Once the shadow effects have
  // resolved (the hero is named at the damage step, or a shadow effect made a defended attack undefended), the attack goes straight on.
  if (attack.shadowResolved) return resolveAttack(left, ctx, steps);
  return enemyAttackWindow(left, ctx, "shadow") ?? resolveAttack(left, ctx, steps);
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
  // A character that cannot exhaust (Shadow of Fear, 03027:A:1) attacks only where it stays ready.
  if (flagged(state, attackerId, "cannotExhaust") && !flagged(state, attackerId, "noExhaustAttack")) return false;
  // A ship-objective attacks only ship-enemies (dcce.ship-objectives), and only Ship objectives can be declared as attackers against Raider Flagship (12124:A:3).
  if (familyAttackReason(state, enemyId, printed, printedOf(cards, enemy.code), attackerId)) return false;
  // "Only Eagle characters or characters with ranged can attack ... Mirkwood Flock" (02070:A:1), "cannot be attacked by characters with the ranged keyword" (900606:A:2).
  if (flightAttackBarred(state, enemyId, attackerId, cards)) return false;
  // "Ship enemies ... cannot be attacked" (11024:A:1), "characters you control cannot attack Ship enemies" (11063:A:1).
  if (flagged(state, enemyId, "cannotBeAttacked") || attackerLimitReached(state, enemyId)) return false;
  if (printedOf(cards, enemy.code).ship === "enemy" && flagged(state, attackerId, "cannotAttackShips")) return false;
  // "Engaged player cannot attack the Dreadnaught" (40014:A:2).
  if (barredFromDreadnaught(state, attackerId, enemyId, cards)) return false;
  // "You cannot attack ... enemies with a title other than Marshland Outlaws" (attackOnlyTitle, 900202:A:1).
  if (titleBarred(state, attacker.controller, enemyId, cards)) return false;
  // An enemy in the staging area that is considered engaged with the first player (the Balrog, 142044:A:2): only the first player declares
  // attackers against it, with their own characters and ranged characters of the others (rr.ranged).
  if (enemy.zone === "staging" && flagged(state, enemyId, "engagedWithFirst")) {
    if (flagged(state, attackerId, "cannotAttack") || seat !== state.firstPlayer) return false;
    return attacker.controller === seat || hasKeyword(state, attackerId, "ranged", cards);
  }
  // The Dreadnaught (Massive): in the staging area but engaged with every player, so each player attacks it with their own characters, and ranged characters of the others join (rr.ranged).
  if (enemy.zone === "staging" && flagged(state, enemyId, "attackableEngagedWithAll")) {
    if (flagged(state, attackerId, "cannotAttack") || state.phase !== "Combat") return false;
    return attacker.controller === seat || hasKeyword(state, attackerId, "ranged", cards);
  }
  // An enemy in the staging area that is considered engaged with each player whose threat is 1 or greater (Durin's Bane, 04150:A:2): such a player declares attackers against it, with their own characters and ranged characters of the others (rr.ranged).
  if (enemy.zone === "staging" && flagged(state, enemyId, "engagedWithThreatening")) {
    if (flagged(state, attackerId, "cannotAttack") || !engagedWithThreatening(state, enemyId, seat)) return false;
    return attacker.controller === seat || hasKeyword(state, attackerId, "ranged", cards);
  }
  // Goblin Archer (03032:A:2): in the staging area it is attacked by characters with ranged, of any player, in the combat phase.
  if (enemy.zone === "staging" && flagged(state, enemyId, "attackableByRanged")) return !flagged(state, attackerId, "cannotAttack") && state.phase === "Combat" && hasKeyword(state, attackerId, "ranged", cards);
  // An enemy any character may choose as the target of an attack (attackableByAny) may be in the staging area; others there
  // only when a card lets the character attack it (families/attack/targets.ts).
  const open = flagged(state, enemyId, "attackableByAny");
  // A location in the staging area the first player may attack in the combat phase as if it were engaged with him (Cracked Pillar, 41028:A:1).
  if (enemy.zone === "staging" && flagged(state, enemyId, "attackableAsEngaged")) {
    if (flagged(state, attackerId, "cannotAttack") || state.phase !== "Combat" || seat !== state.firstPlayer) return false;
    return attacker.controller === seat || hasKeyword(state, attackerId, "ranged", cards);
  }
  if (enemy.zone !== "engaged" && !(open && enemy.zone === "staging")) return stagingAttackable(state, seat, attackerId, enemyId, cards);
  // The declaring seat's own characters attack its own enemies. A ranged character may attack an enemy engaged with
  // another player, and may join an attack another player declares (rr.ranged, rr.step-6-8-1).
  if (flagged(state, attackerId, "cannotAttack")) return false;
  if (open) return true;
  if (attacker.controller === seat && enemy.controller === seat) return true;
  return hasKeyword(state, attackerId, "ranged", cards);
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
    if (!flagged(next, attackerId, "noExhaustAttack")) next = exhaustAnnounced(next, attackerId, ctx);
    next = queueEvent(next, { trigger: "declaredAttacker", seat, cardId: attackerId, other: enemyId });
  }
  const declared: ScenarioState = announceEnemyAttacked(declareStrike(next, { seat, enemyId, attackerIds: [...attackerIds], ...backAfter(state.window, enemyId) }), seat, enemyId, attackerIds, ctx);
  // 6.8.1: the attack and its attackers are declared; an action window comes before its strength and damage. The Responses to
  // the declaration ("After ~ is declared as an attacker") resolve before them either way (families/attack/flow.ts).
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
    next = strike.canceled ? { ...state, pendingStrike: declared } : strikeEnemy({ ...state, pendingStrike: declared }, strike.seat, strike.enemyId, strike.attackerIds, ctx, steps);
    const after = playerAttackWindow(next, ctx, "end");
    if (after) return after;
  }
  // 6.8.4: "for this attack" expires, the window the attack came from comes back (families/attack/flow.ts).
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
  // 6.8.2: the characters currently attacking. One that left play after it was declared (Beechbone pays his own last damage,
  // 10118:A:2) adds nothing and takes no part in the attack's damage or its events.
  const attacking = attackerIds.filter((id) => inPlay(state.cards[id]?.zone ?? "removed"));
  const attack = attackStrength(next, attacking, enemyId, ctx.cards);
  // An attacker may say the enemy does not count its Defense (families/attack/strike.ts).
  const defense = countsDefense(next, attacking) ? modifiedStat(next, enemy, "defense", ctx.cards) : 0;
  steps.push({ kind: "attack", side: "player", seat, enemyId, attackerIds: [...attacking] });
  const enemyNow = next.cards[enemyId];
  if (!enemyNow) return next;
  steps.push({ kind: "strike", side: "player", enemyId, targetId: enemyId, attack, defense, undefended: false, cause: ruleCause("rr.step-6-8-3") });
  const damaged = placeAttackDamage(next, enemyId, Math.max(0, attack - defense), ctx.cards, steps, ruleCause("rr.step-6-8-3"));
  // Each attacker hears that the attack damaged or destroyed the enemy ("After Merry participates in an attack that destroys
  // an enemy"), and excess damage goes where a card sends it (families/attack/strike.ts).
  return struck(next, damaged, seat, enemyId, attacking, Math.max(0, attack - defense), ctx, steps);
}

// The attack strength of characters attacking one enemy (rr.step-6-8-2): each attacker's attack, read against that enemy.
export function attackStrength(state: ScenarioState, attackerIds: readonly string[], enemyId: string, cards: Cards): number {
  let attack = 0;
  // "Immune to ranged damage" (Great Cave-troll, 03042:A:1; dwd.immune-to-ranged-damage): a character that takes part through the ranged keyword deals it no damage, a ranged character that attacks it another way does.
  const strike = flagged(state, enemyId, "immuneToRangedDamage") && state.pendingStrike?.enemyId === enemyId ? state.pendingStrike : undefined;
  // Against a Spectral enemy, and while the table holds `attackWithWillpower`, a character's Willpower is its attack strength (families/attack/spectral.ts, families/pelargir/stage-attack.ts).
  const stat = attackStatOf(state, enemyId, cards);
  for (const attackerId of attackerIds) {
    const attacker = state.cards[attackerId];
    if (attacker && strike && rangedAttack(strike, attacker)) continue;
    if (attacker) attack += modifiedStat(state, attacker, stat, cards, enemyId);
  }
  return attack;
}

// An assignment is dealt as one amount on its character (mec109.archery, hon.archery), in the order the player gave. The points not yet dealt are the player's to assign again, so the window opens again with them,
// when a later assignment's character has left play or may no longer take archery damage (an ally destroyed by an earlier one, with `archeryToAllies` holding: 06043:B:1), and when an ally that must take
// the damage first (`archeryToAllies`) would be destroyed with points over: those go to the next character that can take them.
export function assignArchery(
  state: ScenarioState,
  assignments: readonly { cardId: string; amount: number }[],
  ctx: ReduceContext,
  steps: EngineStep[],
): ScenarioState {
  const seat = state.window?.kind === "archery" ? state.window.seat : undefined;
  const total = assignments.reduce((sum, assignment) => sum + Math.max(0, assignment.amount), 0);
  const allies = state.modifiers.length > 0 && flagged(state, "table", "archeryToAllies");
  let next = state;
  let dealt = 0;
  let stopped = false;
  for (const assignment of assignments) {
    if (assignment.amount <= 0) continue;
    if (stopped || (dealt > 0 && !canTakeArchery(next, ctx.cards, assignment.cardId, seat))) {
      stopped = true;
      continue;
    }
    const instance = next.cards[assignment.cardId];
    const room = instance ? modifiedStat(next, instance, "hitPoints", ctx.cards) - instance.damage : assignment.amount;
    const amount = allies && room > 0 ? Math.min(assignment.amount, room) : assignment.amount;
    next = placeDamage(next, assignment.cardId, amount, ctx.cards, steps, "framework", ruleCause("mec109.archery"));
    dealt += amount;
    if (amount < assignment.amount) stopped = true;
  }
  const left = total - dealt;
  if (left > 0 && archeryRecipients(next, ctx.cards, seat).length > 0) return { ...next, window: { kind: "archery", total: left, ...(seat != null ? { seat } : {}) } };
  return { ...next, window: null };
}

// Whether archery damage may go on this character now (a seat's own archery window, or the one window of all seats): it is a recipient and its damage is short of its hit points (a lethal wound a Response may still cancel leaves it in play).
function canTakeArchery(state: ScenarioState, cards: Cards, id: string, seat: number | undefined): boolean {
  const instance = state.cards[id];
  if (!instance || !archeryRecipients(state, cards, seat).includes(id)) return false;
  return instance.damage < modifiedStat(state, instance, "hitPoints", cards);
}

export function heroIds(state: ScenarioState, seat: number): string[] {
  return [...(state.seats[seat]?.heroes ?? [])];
}

// The characters an undefended attack's damage may be assigned to: the seat's heroes, and a character that says damage from
// undefended attacks may be assigned to it (takesUndefendedDamage).
export function undefendedTargets(state: ScenarioState, seat: number, cards: Cards): string[] {
  // A shadow effect sent the damage to an active location (families/south/watcher.ts).
  const locations = undefendedLocations(state);
  if (locations.length > 0) return locations;
  // A family sends the damage elsewhere: a ship-enemy's undefended attack damages a ship-objective its player controls, not a hero (dcce.ship-enemies); an attack on the main quest card
  // damages the quest card (families/wilderland/night.ts).
  const redirected = familyUndefendedTargets(state, () => characters(state, seat, cards), cards);
  if (redirected.length > 0) return [...redirected];
  const heroes = heroIds(state, seat);
  const own = [...heroes, ...characters(state, seat, cards).filter((id) => !heroes.includes(id) && flagged(state, id, "takesUndefendedDamage"))];
  // A character another card lets take it for this player (08093), whoever controls that character.
  const withExtras = [...own, ...undefendedExtras(state, seat, cards).filter((id) => !own.includes(id))];
  // A hero that cannot take this attack's damage is not offered for it (Bilbo Baggins in the riddle area against an attacker other than Gollum, hob.riddle-area; rr.cannot).
  const all = withExtras.filter((id) => !damageBarred(state, id, "combat", null));
  // A shadow effect says the damage must go on one of these heroes (families/south/watcher.ts, 900408:A:3).
  // A character of another player named by the shadow effect (Wilyador, 02070:A:2) is among them though the seat does not control it.
  const only = state.pendingAttack?.onlyHeroes;
  return only ? [...all.filter((id) => only.includes(id)), ...only.filter((id) => !all.includes(id) && state.cards[id] != null && inPlay(state.cards[id].zone))] : all;
}
