// Rules: ats.cair-andros-remove-stage, rr.quest-advancement (data/rules/entries.json); ledger lines 05072:B:2, 05033:A:2, 05034:A:2, 05035:A:2.
// The advance the family makes at once (no Battleground location left, the current stage removed): the quest moves to the next stage still in the deck, and what that stage reveals resolves.
import type { EngineStep } from "../../core/intents.ts";
import type { ScenarioState } from "../../core/state.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { advanceAndReveal } from "../../quest/stage-reveal.ts";

/** The quest advances now, unless a restriction forbids an advance, and the new stage's When Revealed effects resolve. */
export function advanceNow(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  return advanceAndReveal(state, ctx, steps);
}
