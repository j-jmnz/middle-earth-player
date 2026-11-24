// Rules: ats.cair-andros-remove-stage, ats.cair-andros-remove-stage-example, rr.quest-cards-quest-deck, rr.quest-advancement (data/rules/entries.json); ledger lines 05033:A:2, 05034:A:2, 05035:A:2.
// A stage removed from the quest deck is set aside and is no longer part of the quest: the stage defeated before it goes to the next stage still in the quest deck (stage-skip.ts). The current stage is part of the quest deck too: removing it sets it aside and the quest advances at once to the next
// stage still in the quest deck, which is revealed (docs/scenarios/against-the-shadow/the-siege-of-cair-andros.md, Readings).
import type { Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import type { ScenarioState } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { restricted } from "../../interpret/restrictions.ts";
import { advanceStage } from "../../quest/quest.ts";
import { afterProgress } from "../../quest/stage-reveal.ts";

/** RemoveStage: the stage with this code leaves the quest deck. Nothing happens when it is already gone. */
export function removeStage(state: ScenarioState, instruction: Extract<Instruction, { verb: "RemoveStage" }>, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const current = state.questStage ? state.cards[state.questStage] : undefined;
  if (current?.code === instruction.code) {
    const before = steps.length;
    return afterProgress(advanceStage(state, ctx.cards, steps, (now) => !restricted(now, ctx, "advance").length), before, ctx, steps);
  }
  const id = state.questDeck.find((candidate) => state.cards[candidate]?.code === instruction.code);
  return id ? moveCard(state, id, { zone: "setAside" }) : state;
}
