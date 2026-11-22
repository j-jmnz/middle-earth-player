import { characters, legalAttackEnemies } from "../../../src/rules/combat/combat.ts";
import { modifiedStat } from "../../../src/rules/core/keywords.ts";
import { flagged } from "../../../src/rules/core/state.ts";
import type { LegalIntent, PlayerIntent } from "../../../src/rules/core/intents.ts";
import { legalTargets, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { mustSurvive } from "./score.ts";

// The moves of the engagement, attack and defense windows for the fixture search: who engages, who defends, who attacks what and where the
// archery damage goes. Each function lists the options best first; the style says which kind of option comes first.

export type EngageStyle = "none" | "weak" | "all";
export type AttackStyle = "always" | "never";

const MOST_OPTIONS = 4;

/** How hard an enemy is to fight: its attack, its defense and the hit points it has left. Lower is weaker. */
function toughness(state: ScenarioState, ctx: ReduceContext, id: string): number {
  const card = state.cards[id];
  if (!card) return 0;
  const left = Math.max(0, modifiedStat(state, card, "hitPoints", ctx.cards) - card.damage);
  return modifiedStat(state, card, "attack", ctx.cards) * 3 + modifiedStat(state, card, "defense", ctx.cards) * 2 + left;
}

/** The enemies the seat may engage, the weakest first. */
function weakest(state: ScenarioState, ctx: ReduceContext, ids: readonly string[]): string[] {
  return [...ids].sort((left, right) => toughness(state, ctx, left) - toughness(state, ctx, right));
}

/** The optional engagement step: engage the weakest enemies, or decline. `none` declines first; `weak` engages the weakest while the seat has fewer enemies than heroes; `all` engages the first. */
export function engageOptions(state: ScenarioState, ctx: ReduceContext, legal: readonly LegalIntent[], style: EngageStyle): PlayerIntent[] {
  const seat = state.seats[state.activeSeat];
  const targets = legal.some((intent) => intent.type === "Engage") ? weakest(state, ctx, legalTargets(state, { type: "Engage" }, ctx)).slice(0, 3) : [];
  const engage: PlayerIntent[] = targets.map((enemyId) => ({ type: "Engage", enemyId }));
  const decline: PlayerIntent = { type: "DeclineEngage" };
  const room = seat != null && seat.engaged.length < Math.max(1, seat.heroes.length);
  const first = style === "all" || (style === "weak" && room);
  return first ? [...engage, decline] : [decline, ...engage];
}

/** An enemy chosen by a window (which enemy engages next, which attacks next): the weakest first. */
export function enemyOptions(state: ScenarioState, ctx: ReduceContext): PlayerIntent[] {
  return weakest(state, ctx, legalTargets(state, { type: "ChooseEnemy" }, ctx)).slice(0, MOST_OPTIONS).map((enemyId) => ({ type: "ChooseEnemy", enemyId }));
}

/** What the enemy's attack costs a card that takes it: the damage it deals, and whether the card dies of it. */
function blow(state: ScenarioState, ctx: ReduceContext, enemyId: string, id: string, defends: boolean): { damage: number; dies: boolean } {
  const enemy = state.cards[enemyId];
  const card = state.cards[id];
  if (!enemy || !card) return { damage: 0, dies: false };
  const attack = modifiedStat(state, enemy, "attack", ctx.cards);
  const damage = Math.max(0, attack - (defends ? modifiedStat(state, card, "defense", ctx.cards, enemyId) : 0));
  return { damage, dies: card.damage + damage >= modifiedStat(state, card, "hitPoints", ctx.cards) };
}

/** What taking the blow costs the table, as a number to sort by: a card that dies costs the most, a hero more than an ally, a card the game is lost with most of all. */
function lossOf(state: ScenarioState, ctx: ReduceContext, enemyId: string, id: string, defends: boolean): number {
  const { damage, dies } = blow(state, ctx, enemyId, id, defends);
  const hero = state.cards[id]?.zone === "heroes";
  const safe = mustSurvive(state, ctx, id);
  if (dies) return safe ? 100_000 : hero ? 300 : 60;
  return damage * (hero ? 3 : 1.5) + (safe ? damage * damage * 20 : 0);
}

/** The defense window: the defenders and the undefended hero, the cheapest blow first. */
export function defenseOptions(state: ScenarioState, ctx: ReduceContext, legal: readonly LegalIntent[]): PlayerIntent[] {
  const window = state.window;
  const enemyId = window?.kind === "defense" ? window.enemyId : null;
  if (enemyId == null) return [];
  const defenders = legal.some((intent) => intent.type === "DeclareDefender") ? legalTargets(state, { type: "DeclareDefender" }, ctx) : [];
  const heroes = legal.some((intent) => intent.type === "Undefended") ? legalTargets(state, { type: "Undefended" }, ctx) : [];
  // No hero to name: the engine picks the one the attack lands on.
  if (heroes.length === 0 && defenders.length === 0) return legal.some((intent) => intent.type === "Undefended") ? [{ type: "Undefended" }] : [];
  const options = [
    ...defenders.map((id) => ({ intent: { type: "DeclareDefender", defenderId: id } satisfies PlayerIntent, loss: lossOf(state, ctx, enemyId, id, true) })),
    ...heroes.map((id) => ({ intent: { type: "Undefended", heroId: id } satisfies PlayerIntent, loss: lossOf(state, ctx, enemyId, id, false) })),
  ];
  const undefended = options.filter((option) => option.intent.type === "Undefended").sort((left, right) => left.loss - right.loss).slice(0, 1);
  const defended = options.filter((option) => option.intent.type === "DeclareDefender").sort((left, right) => left.loss - right.loss).slice(0, MOST_OPTIONS - 1);
  return [...defended, ...undefended].sort((left, right) => left.loss - right.loss).map((option) => option.intent);
}

/** The archery damage: all of it on one character, the one with the most hit points left first, never the card the game is lost with while another can take it. */
export function archeryOptions(state: ScenarioState, ctx: ReduceContext): PlayerIntent[] {
  const window = state.window;
  if (window?.kind !== "archery") return [];
  const left = (id: string) => {
    const card = state.cards[id];
    return card ? modifiedStat(state, card, "hitPoints", ctx.cards) - card.damage : 0;
  };
  const recipients = [...legalTargets(state, { type: "Distribute" }, ctx)].sort((a, b) => Number(mustSurvive(state, ctx, a)) - Number(mustSurvive(state, ctx, b)) || left(b) - left(a));
  return recipients.slice(0, 3).map((cardId) => ({ type: "Distribute", assignments: [{ cardId, amount: window.total }] }));
}

/** The attackers that bring `enemy` down together: the fewest that deal enough (the strongest first), or null when none do or all are needed. */
function enough(state: ScenarioState, ctx: ReduceContext, enemyId: string, attackers: readonly string[]): string[] | null {
  const enemy = state.cards[enemyId];
  if (!enemy) return null;
  const defense = modifiedStat(state, enemy, "defense", ctx.cards);
  const need = modifiedStat(state, enemy, "hitPoints", ctx.cards) - enemy.damage;
  const strength = (id: string) => {
    const card = state.cards[id];
    return card ? Math.max(0, modifiedStat(state, card, "attack", ctx.cards, enemyId) - defense) : 0;
  };
  const sorted = [...attackers].sort((left, right) => strength(right) - strength(left));
  const kept: string[] = [];
  let dealt = 0;
  for (const id of sorted) {
    kept.push(id);
    dealt += strength(id);
    if (dealt >= need) return kept.length < attackers.length ? kept : null;
  }
  return null;
}

/** The player attack window: for each enemy in reach, the fewest attackers that kill it and then all of them, the enemy that can be killed first; then declining. `never` declines first. */
export function attackOptions(state: ScenarioState, ctx: ReduceContext, legal: readonly LegalIntent[], style: AttackStyle): PlayerIntent[] {
  const decline: PlayerIntent = { type: "DeclineAttack" };
  if (!legal.some((intent) => intent.type === "DeclareAttackers")) return [decline];
  const seat = state.activeSeat;
  const ready = characters(state, seat, ctx.cards).filter((id) => legalTargets(state, { type: "DeclareAttackers", cardId: id }, ctx).length > 0);
  const reach = new Map<string, string[]>();
  for (const id of ready) {
    for (const enemyId of legalAttackEnemies(state, seat, id, ctx.cards)) reach.set(enemyId, [...(reach.get(enemyId) ?? []), id]);
  }
  const rows = [...reach].map(([enemyId, attackers]) => ({ enemyId, attackers: flagged(state, enemyId, "singleAttacker") ? attackers.slice(0, 1) : attackers, kill: enough(state, ctx, enemyId, attackers) }));
  rows.sort((left, right) => Number(right.kill != null) - Number(left.kill != null) || toughness(state, ctx, left.enemyId) - toughness(state, ctx, right.enemyId));
  const attacks: PlayerIntent[] = rows.slice(0, 3).flatMap((row) => {
    const all: PlayerIntent = { type: "DeclareAttackers", enemyId: row.enemyId, attackerIds: row.attackers };
    return row.kill && !flagged(state, row.enemyId, "singleAttacker") ? [{ type: "DeclareAttackers", enemyId: row.enemyId, attackerIds: row.kill } satisfies PlayerIntent, all] : [all];
  });
  return style === "never" ? [decline, ...attacks] : [...attacks, decline];
}
