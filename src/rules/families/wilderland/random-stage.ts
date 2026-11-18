// Rules: rr.quest-advancement, rr.quest-cards-quest-deck, rr.winning-the-game (data/rules/entries.json); ledger lines 19047:B:2, 19048:B:2, 19049:B:2, 19050:B:2.
// Roam Across Rhovanion's quest order: the stages 2 are played in a random order, each once, then stage 3 (AdvanceToRandomStage).
import { ruleCause } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import { shuffleIds } from "../../core/seed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { updateCard } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import { stageToVictory } from "../quest/order.ts";
import type { PrintedCard } from "../../core/printed.ts";

/**
 * The stage the quest proceeds to from the stage `currentCode` when that stage names AdvanceToRandomStage: one of the stages it lists that is still in the quest deck, chosen with the game's seed, else its `otherwise`. `remove`: the stage left is removed from the game.
 * Null for a stage that names none, so every other quest is untouched; `id` is undefined when no stage is left to go to.
 */
export function randomStageFrom(state: ScenarioState, currentCode: string): { state: ScenarioState; id: string | undefined; remove: boolean; back: boolean } | null {
  const named = state.stages.find((stage) => stage.code === currentCode)?.randomNext;
  if (!named) return null;
  const inDeck = (code: string): string | undefined => state.questDeck.find((candidate) => state.cards[candidate]?.code === code);
  // `different`: never the stage the quest is at, which goes back into the quest deck when it is one of the stages named (147002:B:2).
  const left = named.codes.filter((code) => inDeck(code) != null && !(named.different === true && code === currentCode));
  const back = named.different === true && named.codes.includes(currentCode);
  if (left.length === 0) return { state, id: named.otherwise ? inDeck(named.otherwise) : undefined, remove: named.remove === true, back };
  const rolled = shuffleIds(left, state.seed, state.seedCursor);
  const chosen = rolled.ids[0];
  return { state: { ...state, seedCursor: rolled.cursor }, id: chosen ? inDeck(chosen) : undefined, remove: named.remove === true, back };
}

/**
 * The defeated stage `id` (code `code`) leaves the quest: to the victory display when its quest does that, out of the game when the random stage `removes` it, back into the quest deck with no progress and side A up when the random stage is a `different` one (the stage 2 comes up again,
 * 147002:B:2), else to the set-aside pile.
 */
export function leaveStage(state: ScenarioState, id: string, code: string, cards: ReadonlyMap<string, PrintedCard>, rolled: { remove: boolean; back: boolean } | null, steps: EngineStep[]): ScenarioState {
  const victory = stageToVictory(state, cards, code);
  const next = moveCard(state, id, { zone: victory ? "victory" : rolled?.remove ? "removed" : rolled?.back ? "questDeck" : "setAside" });
  if (victory || !rolled?.back) return next;
  const progress = state.cards[id]?.progress ?? 0;
  if (progress > 0) steps.push({ kind: "progress", targetId: id, amount: -progress, cause: ruleCause("rr.quest-advancement") });
  return updateCard(next, id, { progress: 0, face: "A" });
}
