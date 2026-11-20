// Rules: dcce.ships, dcce.ship-enemies, dcce.ship-objectives (data/rules/entries.json). Ships are an enemy (the ship-enemy) and an objective ally (the
// ship-objective) for every purpose, with these exceptions. A ship-enemy's attack can be defended only by a ship-objective, and left undefended its
// damage goes to a ship-objective its player controls instead of a hero. A ship-objective can attack only ship-enemies and defend only against the
// attacks of ship-enemies. A ship-enemy can be attacked by ship-objectives and by non-ship characters alike. The sea manifest's `combat` hook (combat.ts, the defender and attacker
// pickers) and legal.ts (the legal-intent check and its refusal) ask these.
import { printedOf, type PrintedCard } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { flagged } from "../../core/state.ts";

type Cards = ReadonlyMap<string, PrintedCard>;

// The enemy making the attack in progress, as printed.
function attackerOf(state: ScenarioState, cards: Cards): PrintedCard | null {
  const id = state.pendingAttack?.enemyId;
  const enemy = id ? state.cards[id] : undefined;
  return enemy ? printedOf(cards, enemy.code) : null;
}

/** Whether the character may be declared a defender of the attack in progress (dcce.ship-enemies, dcce.ship-objectives): a ship-enemy's attack only
 * by a ship-objective, and a ship-objective only against a ship-enemy's attack. With no attack in progress nothing is barred. */
export function shipMayDefend(state: ScenarioState, defender: PrintedCard, cards: Cards): boolean {
  const attacker = attackerOf(state, cards);
  if (!attacker) return true;
  // "Ship objectives may attack and defend against Sea Monster" (40033:A:1): a ship-objective defends against it as against a ship-enemy, and anyone else defends it as ever.
  const attackerId = state.pendingAttack?.enemyId;
  if (attackerId && attacker.ship !== "enemy" && defender.ship === "objective" && flagged(state, attackerId, "shipFightable")) return true;
  return (attacker.ship === "enemy") === (defender.ship === "objective");
}

/** Why the character may not defend the attack in progress for a ship's sake, or null (the "why not" of the legal-intent check). */
export function shipDefenseReason(state: ScenarioState, defender: PrintedCard, cards: Cards): string | null {
  if (shipMayDefend(state, defender, cards)) return null;
  return defender.ship === "objective" ? "A ship-objective cannot defend against an attack that is not a ship-enemy's" : "Only a ship-objective can defend against a ship-enemy's attack";
}

/** Whether the character may attack the enemy: a ship-objective only a ship-enemy; anything else may attack a ship-enemy as it may any enemy. */
export function shipMayAttack(attacker: PrintedCard, target: PrintedCard): boolean {
  return attacker.ship !== "objective" || target.ship === "enemy";
}

/** Why the attack is barred for a ship's sake, or null. */
export function shipAttackReason(attacker: PrintedCard, target: PrintedCard): string | null {
  return shipMayAttack(attacker, target) ? null : "A ship-objective can only attack a ship-enemy";
}

/** The attack in progress is a ship-enemy's: its undefended damage goes to a ship-objective, not a hero (dcce.ship-enemies). */
export function shipEnemyAttacking(state: ScenarioState, cards: Cards): boolean {
  return attackerOf(state, cards)?.ship === "enemy";
}

/** The ship-objectives among a player's characters: where the damage of an undefended ship-enemy attack may go (dcce.ship-enemies). Empty when the
 * player controls none. A destroyed ship eliminates its controller (the ships' own lines), so a player still in the game has one once the fleet is
 * prepared; before that, or in a game that never prepared a fleet, no rule says where the damage goes, so the caller falls back to the hero rules
 * rather than leave the attack with nowhere to land. */
export function shipObjectivesAmong(ids: readonly string[], state: ScenarioState, cards: Cards): string[] {
  return ids.filter((id) => printedOf(cards, state.cards[id]?.code ?? "").ship === "objective");
}

/** "Only Ship objectives can be declared as attackers against Raider Flagship" (12124:A:3, flag shipAttackersOnly): a character that is not a ship-objective may not be declared as an attacker against the enemy. */
export function shipsOnlyBarred(state: ScenarioState, enemyId: string, attacker: PrintedCard): boolean {
  return flagged(state, enemyId, "shipAttackersOnly") && attacker.ship !== "objective";
}

/** Why the character may not be declared against the enemy for that card's sake, or null. */
export function shipsOnlyReason(state: ScenarioState, enemyId: string, attacker: PrintedCard): string | null {
  return shipsOnlyBarred(state, enemyId, attacker) ? "Only Ship objectives can be declared as attackers against that enemy" : null;
}
