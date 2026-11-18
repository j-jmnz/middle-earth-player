// Rules: docs/brief.md (The Stone of Erech, Spectral); ledger lines 50312:A:1, 50305:A:1, 50311:A:1. Spectral on an enemy: characters attacking it use their Willpower instead of their Attack to determine attack strength; the enemy's Defense is still
// subtracted, and damage that is not an attack (a card effect, archery) is unaffected. The stat read is the character's current Willpower, so a blank text box, a Willpower set to 0 (Driven by Fear) or a modifier changes it as it changes the stat.
import { printedOf, type PrintedCard } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { flagged } from "../../core/state.ts";

/** Whether the enemy has the Spectral keyword now: printed on it, and not lost (`losesSpectral`, 50311:A:1). */
export function hasSpectral(state: ScenarioState, enemyId: string, cards: ReadonlyMap<string, PrintedCard>): boolean {
  const enemy = state.cards[enemyId];
  if (!enemy) return false;
  return printedOf(cards, enemy.code).keywords.spectral && !flagged(state, enemyId, "losesSpectral");
}

/** The stat a character attacking this enemy reads for its attack strength: its Willpower against a Spectral enemy, its Attack otherwise. */
export function attackStatAgainst(state: ScenarioState, enemyId: string, cards: ReadonlyMap<string, PrintedCard>): "attack" | "willpower" {
  return hasSpectral(state, enemyId, cards) ? "willpower" : "attack";
}
