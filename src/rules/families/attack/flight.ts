// Rules: rr.ranged, rr.cannot, rr.traits (data/rules/entries.json); ledger lines 02070:A:1, 02071:A:1, 900606:A:2.
//
// Who may attack or defend against an enemy that holds one of the flags below. `eagleOrRangedOnly` ("Only Eagle characters or characters with ranged can attack or defend against Mirkwood Flock"): a character
// takes part only when it has the Eagle trait or the Ranged keyword. `cannotBeAttackedByRanged` ("Attacking enemy cannot be attacked by characters with the ranged keyword until the end of the phase"): a
// character with the Ranged keyword may not be declared as an attacker against it. A trait a card prints and loses (`losesEagle`, Shot from the Sky) or a keyword it loses (`loseRanged`, Pitch-dark Thicket) is read as lost.
import { hasKeyword } from "../../core/keywords.ts";
import { printedOf, type PrintedCard } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { flagged } from "../../core/state.ts";

type Cards = ReadonlyMap<string, PrintedCard>;

// An Eagle character: the printed trait, unless the card's text is blank or it lost the trait.
function isEagle(state: ScenarioState, id: string, cards: Cards): boolean {
  const card = state.cards[id];
  return card != null && printedOf(cards, card.code).traits.includes("Eagle") && !flagged(state, id, "losesEagle") && !flagged(state, id, "blanksTraits");
}

/** Whether the character may be declared as an attacker against the enemy for the sake of `eagleOrRangedOnly` or `cannotBeAttackedByRanged`. */
export function flightAttackBarred(state: ScenarioState, enemyId: string, attackerId: string, cards: Cards): boolean {
  if (flagged(state, enemyId, "eagleOrRangedOnly") && !isEagle(state, attackerId, cards) && !hasKeyword(state, attackerId, "ranged", cards)) return true;
  return flagged(state, enemyId, "cannotBeAttackedByRanged") && hasKeyword(state, attackerId, "ranged", cards);
}

/** Whether the character may not be declared as a defender against the attack of this enemy for the sake of `eagleOrRangedOnly`. */
export function flightDefenseBarred(state: ScenarioState, enemyId: string, defenderId: string, cards: Cards): boolean {
  return flagged(state, enemyId, "eagleOrRangedOnly") && !isEagle(state, defenderId, cards) && !hasKeyword(state, defenderId, "ranged", cards);
}
