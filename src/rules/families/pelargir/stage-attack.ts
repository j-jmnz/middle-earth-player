// Rules: ats.setup-the-druadan-forest, hon.siege (data/rules/entries.json); ledger line 06044:B:2.
// The Passage Out (stage 3 of The Drúadan Forest): "Characters use their Willpower instead of Attack when attacking enemies. If an enemy would be damaged this way, place progress tokens on it instead of damage tokens." The stage's record holds `attackWithWillpower` and
// `attackDamageAsProgress` on the table. The two calls in rules/combat/combat.ts (attackStrength reads the stat, strikeEnemy places the damage) go through the functions below, which do nothing in a game where no card holds the flag. Only the damage a character's attack deals
// becomes progress: damage from an effect, a shadow card or archery stays damage (`placeDamage` with another source is not routed here).
import type { Cause } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import { placeDamage } from "../../core/keywords.ts";
import type { PrintedCard } from "../../core/printed.ts";
import { flagged, inPlay, updateCard, type ScenarioState } from "../../core/state.ts";
import { attackStatAgainst } from "../attack/spectral.ts";

/** The stat a character attacking this enemy reads for its attack strength: its Willpower while the table holds `attackWithWillpower`, otherwise what `attackStatAgainst` says (Willpower against a Spectral enemy, Attack for the rest). */
export function attackStatOf(state: ScenarioState, enemyId: string, cards: ReadonlyMap<string, PrintedCard>): "attack" | "willpower" {
  if (state.modifiers.length > 0 && flagged(state, "table", "attackWithWillpower")) return "willpower";
  return attackStatAgainst(state, enemyId, cards);
}

/** The damage of a character's attack on an enemy: damage tokens as usual, or progress tokens while the table holds `attackDamageAsProgress`. An enemy that cannot take damage, or whose combat damage is canceled, takes no progress either; one that is not in play takes none. */
export function placeAttackDamage(state: ScenarioState, enemyId: string, amount: number, cards: ReadonlyMap<string, PrintedCard>, steps: EngineStep[], cause: Cause): ScenarioState {
  if (state.modifiers.length === 0 || !flagged(state, "table", "attackDamageAsProgress")) return placeDamage(state, enemyId, amount, cards, steps, "combat", cause);
  const enemy = state.cards[enemyId];
  if (!enemy || amount <= 0 || !inPlay(enemy.zone)) return state;
  if ((flagged(state, enemyId, "cannotTakeDamage") && !flagged(state, enemyId, "losesNoDamage")) || flagged(state, enemyId, "combatDamageCanceled")) return state;
  steps.push({ kind: "progress", targetId: enemyId, amount, cause });
  return updateCard(state, enemyId, { progress: enemy.progress + amount });
}
