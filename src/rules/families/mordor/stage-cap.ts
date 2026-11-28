// Rules: rr.lasting-effects, rr.progress (data/rules/entries.json); ledger line 21085:B:2 (docs/scenarios/vengeance-of-mordor/the-temple-of-doom.md, Readings).
// "Until the end of the round, no more than X progress can be placed on this stage": the cap is held by the stage card itself (`stageProgressCap`), so a side quest chosen as the current quest takes progress freely; the progress the stage took this round is
// a `stageProgressPlaced` count on the stage. A cap of 0 holds the stage shut, which is why the cap is read from the modifiers and not as a flag (a flag needs an amount above 0). The tightest cap held applies.
import type { ScenarioState } from "../../core/state.ts";
import { modifierActive } from "../../core/state.ts";

/** How much more progress the stage card can take this round under the caps it holds; Number.MAX_SAFE_INTEGER with none. */
export function stageCapRoom(state: ScenarioState, stageId: string): number {
  const caps = state.modifiers.filter((modifier) => modifier.stat === "stageProgressCap" && modifier.instanceId === stageId && modifierActive(state, modifier)).map((modifier) => modifier.amount);
  if (caps.length === 0) return Number.MAX_SAFE_INTEGER;
  const placed = state.modifiers.filter((modifier) => modifier.stat === "stageProgressPlaced" && modifier.instanceId === stageId).reduce((sum, modifier) => sum + modifier.amount, 0);
  return Math.max(0, Math.min(...caps) - placed);
}

/** Notes the progress the stage took, for its cap this round. */
export function noteStageCapPlaced(state: ScenarioState, stageId: string, amount: number): ScenarioState {
  if (amount <= 0 || !state.modifiers.some((modifier) => modifier.stat === "stageProgressCap" && modifier.instanceId === stageId)) return state;
  return { ...state, modifiers: [...state.modifiers, { instanceId: stageId, sourceId: stageId, stat: "stageProgressPlaced", amount, until: "endOfRound" }] };
}
