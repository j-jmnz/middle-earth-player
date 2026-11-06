// Rules: emce.side-quests, emce.side-quests-in-play (data/rules/entries.json). The reads of the encounter side quests that the quest code shares: whether the game has a side quest deck, the side quests in the staging area, the current quest and the progress placed on it.
// Pure helpers over the state, with no import of the combat or the frames, so the quest code (rules/quest/quest.ts) can read them.
import { ruleCause } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import { modifiedStat } from "../../core/keywords.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { NAMED_PILES, pileDealt } from "../../core/piles.ts";
import { printedOf } from "../../core/printed.ts";
import type { CardInstance, ScenarioState } from "../../core/state.ts";
import { flagged, updateCard } from "../../core/state.ts";

/** The game deals a side quest deck (emce.side-quests): the other games never read any of this. */
export function hasSideQuests(state: Pick<ScenarioState, "piles">): boolean {
  return pileDealt(state, NAMED_PILES.sideQuests.deck);
}

export const isSideQuest = (state: ScenarioState, id: string, ctx: Pick<ReduceContext, "cards">): boolean => printedOf(ctx.cards, state.cards[id]?.code ?? "").type === "encounter-side-quest";

/** The side quests in the staging area, in the order they were added. */
export function stagedSideQuests(state: ScenarioState, ctx: Pick<ReduceContext, "cards">): string[] {
  return state.staging.filter((id) => isSideQuest(state, id, ctx));
}

/** The quest points a side quest needs to be full, as modified now, or null when it prints none. */
export function sideQuestPoints(state: ScenarioState, quest: CardInstance, cards: ReduceContext["cards"]): number | null {
  return printedOf(cards, quest.code).questPoints == null ? null : modifiedStat(state, quest, "questPoints", cards);
}

/** The side quest that is the current quest until the end of the phase, or null (emce.side-quests-in-play). */
export function currentSideQuest(state: ScenarioState): string | null {
  if (!hasSideQuests(state)) return null;
  return state.staging.find((id) => flagged(state, id, "currentQuest")) ?? null;
}

/**
 * Progress that is left after the active locations is placed on the current side quest instead of the main quest card (emce.side-quests-in-play): it takes what it needs to be full and the rest is discarded, never placed on any other quest card. Returns the
 * state and the progress still to place (all of it when no side quest is the current quest). A full side quest is defeated by the sweep (defeatFullSideQuests), once the effect that placed the progress is done.
 */
export function placeOnCurrentSideQuest(state: ScenarioState, amount: number, cards: ReduceContext["cards"], steps: EngineStep[]): { state: ScenarioState; remaining: number } {
  const id = currentSideQuest(state);
  const quest = id ? state.cards[id] : undefined;
  if (!id || !quest) return { state, remaining: amount };
  const points = sideQuestPoints(state, quest, cards);
  const placed = points == null ? amount : Math.min(amount, Math.max(0, points - quest.progress));
  if (placed <= 0) return { state, remaining: 0 };
  steps.push({ kind: "progress", targetId: id, amount: placed, cause: ruleCause("emce.side-quests-in-play") });
  return { state: updateCard(state, id, { progress: quest.progress + placed }), remaining: 0 };
}

/** Whether the card is a quest card or a side quest: damage it deals is no "non-quest effect" (Dagnir's cap, 19074:A:2). */
export function isQuestSource(state: ScenarioState, sourceId: string | null, ctx: Pick<ReduceContext, "cards">): boolean {
  const type = sourceId ? printedOf(ctx.cards, state.cards[sourceId]?.code ?? "").type : null;
  return type === "quest" || type === "encounter-side-quest";
}

