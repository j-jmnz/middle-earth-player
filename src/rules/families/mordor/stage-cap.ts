// Rules: rr.lasting-effects, rr.active-location (data/rules/entries.json); ledger line 21085:B:2 (docs/scenarios/vengeance-of-mordor/the-temple-of-doom.md, Readings).
// "Until the end of the round, no more than X progress can be placed on this stage": the cap is held by the stage card itself (`stageProgressCap`), so a side quest chosen as the current quest takes progress freely; the progress the stage took this round is
// a `stageProgressPlaced` count on the stage. A cap of 0 holds the stage shut, which is why the cap is read from the modifiers and not as a flag (a flag needs an amount above 0). The tightest cap held applies.
import type { ScenarioState } from "../../core/state.ts";
import { modifierActive } from "../../core/state.ts";

/** The tightest cap the stage card holds this round and the progress it took under it, or null with no cap. */
export function stageCapOf(state: ScenarioState, stageId: string): { cap: number; placed: number } | null {
  const caps = state.modifiers.filter((modifier) => modifier.stat === "stageProgressCap" && modifier.instanceId === stageId && modifierActive(state, modifier)).map((modifier) => modifier.amount);
  if (caps.length === 0) return null;
  const placed = state.modifiers.filter((modifier) => modifier.stat === "stageProgressPlaced" && modifier.instanceId === stageId).reduce((sum, modifier) => sum + modifier.amount, 0);
  return { cap: Math.min(...caps), placed };
}

/** How much more progress the stage card can take this round under the caps it holds; Number.MAX_SAFE_INTEGER with none. */
export function stageCapRoom(state: ScenarioState, stageId: string): number {
  const held = stageCapOf(state, stageId);
  return held == null ? Number.MAX_SAFE_INTEGER : Math.max(0, held.cap - held.placed);
}

/** Notes the progress the stage took, for its cap this round. */
export function noteStageCapPlaced(state: ScenarioState, stageId: string, amount: number): ScenarioState {
  if (amount <= 0 || !state.modifiers.some((modifier) => modifier.stat === "stageProgressCap" && modifier.instanceId === stageId)) return state;
  return { ...state, modifiers: [...state.modifiers, { instanceId: stageId, sourceId: stageId, stat: "stageProgressPlaced", amount, until: "endOfRound" }] };
}
