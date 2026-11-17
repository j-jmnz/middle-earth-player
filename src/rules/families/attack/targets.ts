// Rules: rr.step-6-8b, rr.ranged, rr.step-6-8-1, faq.limitations-on-attacks (data/rules/entries.json).
//
// The enemies a player attack may target beyond those engaged with the declaring player: enemies in the staging area a card lets
// a character attack ("Dúnhere can target enemies in the staging area when he attacks alone", "Each Rohan hero can be declared
// as an attacker against enemies in the staging area this phase"), and the targets of a player attack window a card opened
// (OfferAttacks: "You may declare and resolve an attack against each non-unique enemy in the staging area as if it were engaged
// with you"). combat.ts and legal.ts ask these.
import { attackerLimitReason } from "../aflame/attack.ts";
import { attackersAtOnceReason } from "../pelennor/combat.ts";
import type { PlayerIntent } from "../../core/intents.ts";
import { hasKeyword } from "../../core/keywords.ts";
import { printedOf, type PrintedCard } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { flagged } from "../../core/state.ts";

type Cards = ReadonlyMap<string, PrintedCard>;

// The enemies the open player attack window offers, when a card opened it, or null.
export function offeredTargets(state: ScenarioState): readonly string[] | null {
  return state.window?.kind === "playerAttack" && state.window.targets ? state.window.targets : null;
}

// Whether the character may be declared as an attacker by `seat` against this enemy in the staging area. A card's window treats
// its targets as engaged with the declaring player: that player's characters, and ranged characters of the others
// (rr.ranged). Otherwise the character itself must be allowed to attack the staging area (attacksStaging, or attacksStagingAlone
// with the alone rule checked when the attack is declared).
export function stagingAttackable(state: ScenarioState, seat: number, attackerId: string, enemyId: string, cards: Cards): boolean {
  const enemy = state.cards[enemyId];
  const attacker = state.cards[attackerId];
  if (!enemy || !attacker || enemy.zone !== "staging" || printedOf(cards, enemy.code).type !== "enemy") return false;
  if (flagged(state, attackerId, "cannotAttack")) return false;
  const joins = attacker.controller === seat || hasKeyword(state, attackerId, "ranged", cards);
  const offered = offeredTargets(state);
  if (offered) return offered.includes(enemyId) && joins;
  return joins && (flagged(state, attackerId, "attacksStaging") || flagged(state, attackerId, "attacksStagingAlone"));
}

// The enemies a character may be declared as an attacker against: those engaged with a player that it could attack, and the
// enemies in the staging area a card lets it attack; in a card's window, only that window's targets.
export function withCardTargets(state: ScenarioState, engaged: readonly string[], can: (enemyId: string) => boolean): string[] {
  const offered = offeredTargets(state);
  if (offered) return offered.filter(can);
  return [...engaged, ...state.staging.filter(can)];
}

// The rules a card adds to a declared attack, or null when they are met: a card's window takes only its targets, and a
// character that may attack the staging area only alone attacks an enemy there with no other attacker (01009:A:1).
export function attackRuleReason(state: ScenarioState, intent: Extract<PlayerIntent, { type: "DeclareAttackers" }>): string | null {
  const limited = attackerLimitReason(state, intent.enemyId, intent.attackerIds.length) ?? attackersAtOnceReason(state, intent.enemyId, intent.attackerIds.length);
  if (limited) return limited;
  const offered = offeredTargets(state);
  if (offered) return offered.includes(intent.enemyId) ? null : "That enemy cannot be attacked";
  if (state.cards[intent.enemyId]?.zone !== "staging" || intent.attackerIds.length < 2) return null;
  // Any character may choose an attackableByAny enemy there as its target, together with others (06064).
  if (flagged(state, intent.enemyId, "attackableByAny") || flagged(state, intent.enemyId, "attackableAsEngaged") || flagged(state, intent.enemyId, "attackableByRanged") || flagged(state, intent.enemyId, "engagedWithFirst")) return null;
  return intent.attackerIds.every((id) => flagged(state, id, "attacksStaging")) ? null : "That character attacks the staging area only alone";
}
