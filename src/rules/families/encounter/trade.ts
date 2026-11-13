// Rules: rr.the-word-choose (data/rules/entries.json). The question the trade verbs share (TradeShipDamage, TradeDamageForThreat, TradeDamageForResources): a player decides whether to trade or keep.
import type { Cause } from "../../core/cause.ts";
import type { Instruction } from "../../../catalog/boundary.ts";
import type { ScenarioState } from "../../core/state.ts";
import { askTarget } from "../../windows/choices.ts";
import { effectData } from "./moves.ts";
import type { Focus } from "../index.ts";

/**
 * Asks `seat` to "trade" or "keep" (the instruction comes back with that answer in `focus.chosen`). Returns the state to carry on with: the question asked, `failure` set when no effect is open to ask it, or `goOn` of the state once the player kept. Null once the player
 * chose to trade: the caller then does the trade.
 */
export function askTradeOrKeep(state: ScenarioState, focus: Focus, asked: { instruction: Instruction; seat: number; cause: Cause }, failure: string, goOn: (state: ScenarioState) => ScenarioState): ScenarioState | null {
  if (focus.chosen == null) return effectData(state) ? askTarget(state, { ...asked, chosen: null }, ["trade", "keep"]) : { ...state, failure };
  return focus.chosen === "trade" ? null : goOn(state);
}
