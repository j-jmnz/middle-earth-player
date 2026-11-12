// Rules: emce.side-quests, emce.side-quests-in-play (data/rules/entries.json). The reads of the encounter side quests that the quest code shares: whether the game has a side quest deck, the side quests in the staging area, the current quest and the progress placed on it.
// Pure helpers over the state, with no import of the combat or the frames, so the quest code (rules/quest/quest.ts) can read them.
import { ruleCause } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import { modifiedStat } from "../../core/keywords.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { noteQuestPlaced, questRoom } from "../caves/progress.ts";
import { NAMED_PILES, pileDealt } from "../../core/piles.ts";
import { printedOf } from "../../core/printed.ts";
import type { CardInstance, ScenarioState } from "../../core/state.ts";
import { flagged, updateCard } from "../../core/state.ts";

/** The game deals encounter side quests, in a side quest deck of its own (emce.side-quests) or in its encounter deck (mec108.side-quests, `sideQuests`): the other games never read any of this. */
export function hasSideQuests(state: Pick<ScenarioState, "piles" | "sideQuests">): boolean {
  return state.sideQuests === true || pileDealt(state, NAMED_PILES.sideQuests.deck);
}

/** The start of a game that deals an encounter side quest outside a side quest deck notes it (`sideQuests`); a game with the deck, or with none, is left as it is. */
export function markSideQuests(state: ScenarioState, cards: ReduceContext["cards"]): ScenarioState {
  if (hasSideQuests(state) || !Object.values(state.cards).some((card) => cards.get(card.code)?.type === "encounter-side-quest")) return state;
  return { ...state, sideQuests: true };
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
 * Progress that is left after the active locations is placed on the current side quest instead of the main quest card (emce.side-quests-in-play, mec108.side-quests-in-play): it takes what it needs to be full and the rest is discarded, never placed on any other quest card. Returns the
 * state and the progress still to place (all of it when no side quest is the current quest). A full side quest is defeated by the sweep (defeatFullSideQuests), once the effect that placed the progress is done. "No more than 3 progress tokens can be placed on the current quest each
 * round" (09023:A:1) bounds what a side quest takes as it does the main quest (`questRoom`, families/caves/progress.ts), and the progress counts toward the round's tally. A side quest that holds `progressRemovesDamage` (Protect the Innocent, 10158:A:2) takes the progress as
 * damage removed from it instead: no more than it holds, the rest is lost.
 */
export function placeOnCurrentSideQuest(state: ScenarioState, amount: number, cards: ReduceContext["cards"], steps: EngineStep[]): { state: ScenarioState; remaining: number } {
  const id = currentSideQuest(state);
  const quest = id ? state.cards[id] : undefined;
  if (!id || !quest) return { state, remaining: amount };
  const room = Math.min(amount, questRoom(state));
  if (room <= 0) return { state, remaining: 0 };
  if (flagged(state, id, "progressRemovesDamage")) {
    const removed = Math.min(room, quest.damage);
    if (removed > 0) steps.push({ kind: "damage", targetId: id, amount: -removed, cause: ruleCause("mec108.side-quests-in-play") });
    return { state: noteQuestPlaced(removed > 0 ? updateCard(state, id, { damage: quest.damage - removed }) : state, room), remaining: 0 };
  }
  const points = sideQuestPoints(state, quest, cards);
  const placed = points == null ? room : Math.min(room, Math.max(0, points - quest.progress));
  if (placed <= 0) return { state: noteQuestPlaced(state, room), remaining: 0 };
  steps.push({ kind: "progress", targetId: id, amount: placed, cause: ruleCause("emce.side-quests-in-play") });
  return { state: noteQuestPlaced(updateCard(state, id, { progress: quest.progress + placed }), room), remaining: 0 };
}

/** Whether the card is a quest card or a side quest: damage it deals is no "non-quest effect" (Dagnir's cap, 19074:A:2). */
export function isQuestSource(state: ScenarioState, sourceId: string | null, ctx: Pick<ReduceContext, "cards">): boolean {
  const type = sourceId ? printedOf(ctx.cards, state.cards[sourceId]?.code ?? "").type : null;
  return type === "quest" || type === "encounter-side-quest";
}

