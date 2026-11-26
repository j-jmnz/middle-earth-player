// Rules: rr.quest-advancement, rr.quest-cards-quest-deck, rr.winning-the-game (data/rules/entries.json); ledger lines 19047:B:2, 19048:B:2, 19049:B:2, 19050:B:2.
// Roam Across Rhovanion's quest order: the stages 2 are played in a random order, each once, then stage 3 (AdvanceToRandomStage).
import type { RandomNext } from "../../../catalog/random-next.ts";
import { ruleCause, type Cause } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import { shuffleIds } from "../../core/seed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { updateCard } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import { skipAreaStage } from "../riddles/area.ts";
import { stageToVictory } from "../quest/order.ts";
import type { PrintedCard } from "../../core/printed.ts";

/**
 * The stage the quest proceeds to from the stage `currentCode` when that stage names AdvanceToRandomStage: one of the stages it lists that is still in the quest deck, chosen with the game's seed, else its `otherwise`. `remove`: the stage left is removed from the game.
 * Null for a stage that names none, so every other quest is untouched; `id` is undefined when no stage is left to go to. `own` is the set a record names for this one advance (08095:B:2); without it the stage's own set (its defeat) is read.
 */
export function randomStageFrom(state: ScenarioState, currentCode: string, own?: RandomNext): { state: ScenarioState; id: string | undefined; remove: boolean; back: boolean } | null {
  const named = own ?? state.stages.find((stage) => stage.code === currentCode)?.randomNext;
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
 * A stage that leaves the quest for the quest deck without being won (a `different` random stage, 147002:B:2; a bypassed stage, emce.bypassing; a stage the quest deck's search replaces, 19124:A:1): its progress is removed (a progress step), side A is up again and it lies in the quest deck. The
 * cards attached to it are released by the caller, before this.
 */
export function backIntoQuestDeck(state: ScenarioState, id: string, cause: Cause, steps: EngineStep[]): ScenarioState {
  const progress = state.cards[id]?.progress ?? 0;
  if (progress > 0) steps.push({ kind: "progress", targetId: id, amount: -progress, cause });
  return updateCard(moveCard(state, id, { zone: "questDeck" }), id, { progress: 0, face: "A" });
}

/**
 * The defeated stage `id` (code `code`) leaves the quest: to the victory display when its quest does that, out of the game when the random stage `removes` it, back into the quest deck with no progress and side A up when the random stage is a `different` one (the stage 2 comes up again,
 * 147002:B:2), else to the set-aside pile.
 */
export function leaveStage(state: ScenarioState, id: string, code: string, cards: ReadonlyMap<string, PrintedCard>, rolled: { remove: boolean; back: boolean } | null, steps: EngineStep[]): ScenarioState {
  const victory = stageToVictory(state, cards, code);
  if (!victory && rolled?.back) return backIntoQuestDeck(state, id, ruleCause("rr.quest-advancement"), steps);
  return moveCard(state, id, { zone: victory ? "victory" : rolled?.remove ? "removed" : "setAside" });
}

/**
 * The stage after the one at `index` in the quest's order, none of the stages that share a random set with it (the stages 3 of The Nîn-in-Eilph, one of which the quest took from the stages 2): the stages a random set lists are alternatives, so the stage that follows one of them is the first
 * stage after the alternatives (08098:B:2 to 08101). A stage in no random set follows as skipAreaStage reads it.
 */
export function nextInOrder(state: ScenarioState, index: number): string | undefined {
  const own = state.stages[index]?.code;
  const alternatives = own == null ? undefined : state.stages.find((stage) => stage.randomNext?.codes.includes(own))?.randomNext?.codes;
  let next = skipAreaStage(state, index);
  for (let at = index; alternatives != null && next != null && alternatives.includes(next); ) {
    at = state.stages.findIndex((stage) => stage.code === next);
    next = at < 0 ? undefined : skipAreaStage(state, at);
  }
  return next;
}
