// Rules: docs/brief.md (The Battle of Lake-town), rr.victory, ltp.scoring (data/rules/entries.json); ledger lines 50222:A:2, 50203:B:3.
// The amounts of the family: the damage on Lake-town and the Victory points in the victory display, each read when the effect resolves.
import type { Amount } from "../../../catalog/boundary.ts";
import { victoryPointsOf } from "../../core/printed-stat.ts";
import type { ScenarioState } from "../../core/state.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { lakeTownDamage } from "./cards.ts";

/** An amount of this family, or null when the amount is not its own. */
export function smaugAmount(state: ScenarioState, amount: Exclude<Amount, number>, ctx: ReduceContext): number | null {
  if (amount.lakeTownDamage === true) return lakeTownDamage(state);
  if (amount.victoryDisplay === true) return state.victory.reduce((sum, id) => sum + victoryPointsOf(state, id, ctx.cards), 0);
  return null;
}
