// Rules: rr.step-3-2, rr.step-3-4, rr.quest-advancement, rr.discard-pile-and-victory-display (data/rules/entries.json).
// The Rules Reference in data/rules has no span for side quests (it is the core set's), so this follows the printed player side
// quest cards and the Learn to Play: a side quest sits in its player's quest area, a character commits to it instead of the
// current quest, the Willpower committed to it is placed on it as progress (it is not compared with the Threat in the staging
// area), and it is defeated when its progress reaches its quest points.
import { ruleCause } from "../cause.ts";
import type { EngineStep } from "../intents.ts";
import type { ReduceContext } from "../interpret.ts";
import { modifiedStat, releaseAttachments } from "../keywords.ts";
import { effectsOf } from "../listen.ts";
import { queueEvent } from "../queue.ts";
import { printedOf } from "../printed.ts";
import type { ScenarioState } from "../state.ts";
import { updateCard } from "../state.ts";
import { noteHostDefeated } from "./attachments-hold.ts";
import { addToVictory } from "./sidequests-victory.ts";

// The side quests in the players' quest areas, in seat order.
export function sideQuestIds(state: ScenarioState): string[] {
  return state.seats.flatMap((seat, index) => (index < state.seatCount && seat.questStage && state.cards[seat.questStage] ? [seat.questStage] : []));
}

// The characters committed to this side quest.
export function committedToSide(state: ScenarioState, questId: string): string[] {
  return Object.values(state.cards)
    .filter((card) => card.committed && card.questTo === questId)
    .map((card) => card.id);
}

// The stat a side quest reads from its committed characters: Willpower, or the Attack ("Battle") or Defense ("Siege") its
// constant record names.
function questStat(ctx: ReduceContext, code: string): "willpower" | "attack" | "defense" {
  for (const effect of effectsOf(ctx, code)) {
    if (effect.timing !== "constant") continue;
    for (const instruction of effect.instructions) if (instruction.verb === "QuestsWith") return instruction.stat;
  }
  return "willpower";
}

// The progress the characters committed to a side quest place on it.
export function sideQuestProgress(state: ScenarioState, questId: string, ctx: ReduceContext): number {
  const quest = state.cards[questId];
  if (!quest) return 0;
  const stat = questStat(ctx, quest.code);
  let total = 0;
  for (const id of committedToSide(state, questId)) {
    const instance = state.cards[id];
    if (instance) total += modifiedStat(state, instance, stat, ctx.cards);
  }
  return total;
}

// Why a character cannot be committed to this side quest, or null.
export function sideQuestReason(state: ScenarioState, questId: string): string | null {
  return sideQuestIds(state).includes(questId) ? null : "That side quest is not in a quest area";
}

// Quest resolution (rr.step-3-4), after the current quest's: each side quest takes the progress its committed characters make.
// A full one is defeated. `committed` is what the characters committed to each were when the quest began resolving, read before
// resolution clears it.
export function resolveSideQuests(state: ScenarioState, committed: ReadonlyMap<string, number>, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  let next = state;
  for (const [questId, amount] of committed) {
    const quest = next.cards[questId];
    if (!quest || amount <= 0) continue;
    const points = printedOf(ctx.cards, quest.code).questPoints == null ? null : modifiedStat(next, quest, "questPoints", ctx.cards);
    const placed = points == null ? amount : Math.min(amount, Math.max(0, points - quest.progress));
    if (placed > 0) {
      next = updateCard(next, questId, { progress: quest.progress + placed });
      steps.push({ kind: "progress", targetId: questId, amount: placed, cause: ruleCause("rr.step-3-4") });
    }
    const updated = next.cards[questId];
    if (updated && points != null && updated.progress >= points) next = defeatSideQuest(next, questId, ctx, steps);
  }
  return next;
}

// The side quest is defeated: the cards attached to it hear it and are discarded with it, the quest itself hears it
// (`questDefeated`), and it is added to the victory display, or to its owner's discard pile when its limit is reached.
export function defeatSideQuest(state: ScenarioState, questId: string, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const quest = state.cards[questId];
  if (!quest) return state;
  let next = releaseAttachments(noteHostDefeated(state, questId), questId, ctx.cards, steps);
  next = updateCard(addToVictory(next, questId, ctx), questId, { progress: 0, committed: false });
  return queueEvent(next, { trigger: "questDefeated", seat: quest.controller, cardId: questId, subject: questId });
}

// What each side quest in a quest area will take as progress from the characters committed to it now.
export function sideQuestTotals(state: ScenarioState, ctx: ReduceContext): Map<string, number> {
  return new Map(sideQuestIds(state).map((id): [string, number] => [id, sideQuestProgress(state, id, ctx)]));
}
