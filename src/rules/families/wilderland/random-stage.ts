// Rules: rr.quest-advancement, rr.quest-cards-quest-deck, rr.winning-the-game (data/rules/entries.json); ledger lines 19047:B:2, 19048:B:2, 19049:B:2, 19050:B:2.
// Roam Across Rhovanion's quest order: the stages 2 are played in a random order, each once, then stage 3 (AdvanceToRandomStage).
import { shuffleIds } from "../../core/seed.ts";
import type { ScenarioState } from "../../core/state.ts";

/**
 * The stage the quest proceeds to from the stage `currentCode` when that stage names AdvanceToRandomStage: one of the stages it lists that is still in the quest deck, chosen with the game's seed, else its `otherwise`. `remove`: the stage left is removed from the game.
 * Null for a stage that names none, so every other quest is untouched; `id` is undefined when no stage is left to go to.
 */
export function randomStageFrom(state: ScenarioState, currentCode: string): { state: ScenarioState; id: string | undefined; remove: boolean } | null {
  const named = state.stages.find((stage) => stage.code === currentCode)?.randomNext;
  if (!named) return null;
  const inDeck = (code: string): string | undefined => state.questDeck.find((candidate) => state.cards[candidate]?.code === code);
  const left = named.codes.filter((code) => inDeck(code) != null);
  if (left.length === 0) return { state, id: named.otherwise ? inDeck(named.otherwise) : undefined, remove: named.remove === true };
  const rolled = shuffleIds(left, state.seed, state.seedCursor);
  const chosen = rolled.ids[0];
  return { state: { ...state, seedCursor: rolled.cursor }, id: chosen ? inDeck(chosen) : undefined, remove: named.remove === true };
}
