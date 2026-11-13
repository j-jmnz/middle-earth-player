// Rules: rr.damage, rr.hit-points, mec108.side-quests-in-play (data/rules/entries.json); ledger line 10074:A:1. "For each excess point of combat damage dealt by Cruel Mountain-troll (damage that is dealt beyond the remaining hit points of the character damaged by its attack) you
// must remove 1 progress from each quest card in play": each quest card in play (the main quest stage, each encounter side quest in the staging area and each player side quest, the quest cards of `questCardPool`) loses as many progress tokens as there are excess points, no more than it holds.
import type { Cause } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { updateCard, type ScenarioState } from "../../core/state.ts";
import { questCardPool } from "../quest/quest-card.ts";

/** `excess` progress comes off each quest card in play (the pool the seat can name); the step of each card records it as a negative amount. */
export function removeProgressFromEachQuest(state: ScenarioState, excess: number, seat: number, ctx: ReduceContext, steps: EngineStep[], cause: Cause): ScenarioState {
  let next = state;
  for (const id of questCardPool(state, seat, ctx)) {
    const card = next.cards[id];
    const removed = card ? Math.min(card.progress, excess) : 0;
    if (!card || removed <= 0) continue;
    steps.push({ kind: "progress", targetId: id, amount: -removed, cause });
    next = updateCard(next, id, { progress: card.progress - removed });
  }
  return next;
}
