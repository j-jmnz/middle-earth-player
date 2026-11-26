// Rules: rr.modifiers, rr.step-6-4-1, rr.step-6-4-3, rr.defending-player (data/rules/entries.json); ledger lines 16062:A:1, 16062:A:2, 16063:A:1, 16065:A:2.
//
// The Threat of an Uruk against the Willpower of the character it meets. `defendersBelowThreat` (an enemy's constant): an ally with less Willpower than the enemy's Threat cannot be declared as a defender against it. The condition `threatAboveWillpower` and the amount
// `willpowerGap` read the enemy attack in progress: its defending character, if one was declared. An undefended attack has none, so the condition is false and the gap 0.
import { modifiedStat } from "../../core/modified-stat.ts";
import { cardTypeOf, type PrintedCard } from "../../core/printed.ts";
import { flagged, type ScenarioState } from "../../core/state.ts";

type Cards = ReadonlyMap<string, PrintedCard>;

// The Threat of the attacking enemy less the Willpower of its defending character, when the enemy `enemyId` is the attacker and a character defends; null otherwise.
function gapOf(state: ScenarioState, enemyId: string | null, cards: Cards): number | null {
  const attack = state.pendingAttack;
  const enemy = enemyId != null ? state.cards[enemyId] : undefined;
  const defender = attack?.defenderId != null ? state.cards[attack.defenderId] : undefined;
  if (!attack || !enemy || !defender || attack.enemyId !== enemy.id) return null;
  return modifiedStat(state, enemy, "threat", cards) - modifiedStat(state, defender, "willpower", cards);
}

/** The `combat.defense` hook: why the ally cannot defend against the attacking enemy that holds `defendersBelowThreat`, or null. */
export function allyBelowThreat(state: ScenarioState, defender: PrintedCard, cards: Cards, defenderId: string): string | null {
  const enemyId = state.pendingAttack?.enemyId;
  const card = state.cards[defenderId];
  const enemy = enemyId != null ? state.cards[enemyId] : undefined;
  if (!enemy || !card || state.modifiers.length === 0 || !flagged(state, enemy.id, "defendersBelowThreat") || cardTypeOf(card, defender) !== "ally") return null;
  return modifiedStat(state, card, "willpower", cards) < modifiedStat(state, enemy, "threat", cards) ? "An ally with less Willpower than that enemy's Threat cannot defend against it" : null;
}

/** The condition `threatAboveWillpower`: the attacking enemy's Threat is greater than its defending character's Willpower. */
export function threatAboveWillpower(state: ScenarioState, cards: Cards): boolean {
  const gap = gapOf(state, state.pendingAttack?.enemyId ?? null, cards);
  return gap != null && gap > 0;
}

/** The amount `willpowerGap` of the source enemy: the gap while it attacks a defending character with less Willpower than its Threat, else 0. */
export function willpowerGap(state: ScenarioState, sourceId: string | null, cards: Cards): number {
  return Math.max(0, gapOf(state, sourceId, cards) ?? 0);
}
