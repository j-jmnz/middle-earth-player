// Rules: rr.quest-advancement, rr.step-3-4, mec108.side-quests-in-play, mec108.captured-cards (data/rules/entries.json); ledger line 10176:A:1.
//
// "A quest card in play": the quest cards a player can name when a card places progress on one. The current quest stage of the player's area, the side quests in the staging area, encounter and player.
import type { Instruction } from "../../../catalog/boundary.ts";

import { ruleCause } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import { printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { flagged } from "../../core/state.ts";
import { frameScope, resolveAmount } from "../../interpret/amounts.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { lastPicked } from "../../interpret/player-verbs.ts";
import { restricted } from "../../interpret/restrictions.ts";
import { putOnStage, questPointsOf } from "../../quest/quest.ts";
import { currentSideQuest, isSideQuest } from "../wilderland/night-quest.ts";
import { afterProgress } from "../../quest/stage-reveal.ts";
import { stageOf, stagingOf } from "../breaking/areas.ts";
import { rescueRandom } from "../captured/rescue.ts";
import { placeOnSideQuest } from "../sidequests/quest.ts";
import type { Focus } from "../index.ts";

// The quest cards in play the asking player can name.
export function questCardPool(state: ScenarioState, asking: number, ctx: ReduceContext): string[] {
  const stage = stageOf(state, asking);
  const staged = stagingOf(state, asking).filter((id) => isSideQuest(state, id, ctx));
  return [...(stage ? [stage] : []), ...staged];
}

// PlaceProgressOnQuestCard: see the schema entry.
export function placeProgressOnQuestCard(state: ScenarioState, instruction: Extract<Instruction, { verb: "PlaceProgressOnQuestCard" }>, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const id = lastPicked(state);
  const quest = state.cards[id];
  const amount = resolveAmount(state, instruction.amount, frameScope(state, focus.seat, focus.sourceId), ctx);
  if (!quest || amount <= 0) return state;
  const type = printedOf(ctx.cards, quest.code).type;
  if (type === "quest") {
    if (id !== stageOf(state, focus.seat) || state.stageCleared) return state;
    if (flagged(state, id, "progressRescues")) return rescueRandom(state, id, amount);
    const before = steps.length;
    const placed = putOnStage(state, id, amount, questPointsOf(state, quest, ctx.cards), ctx.cards, steps, (current) => !restricted(current, ctx, "advance").length, ruleCause("rr.step-3-4"), { counted: false, reduced: currentSideQuest(state) == null });
    return afterProgress(placed, before, ctx, steps);
  }
  return placeOnSideQuest(state, id, amount, ruleCause("mec108.side-quests-in-play"), ctx, steps);
}
