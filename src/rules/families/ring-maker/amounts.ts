// Rules: rr.step-3-4 (data/rules/entries.json); ledger line 07030:A:1.
// The amount `committedWillpower`: the total Willpower of all characters committed to the quest, as the quest compares it with the staging area's Threat. Null for any other amount.
import type { Amount } from "../../../catalog/boundary.ts";

import type { ScenarioState } from "../../core/state.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { committedWillpower } from "../../quest/quest.ts";

export function committedWillpowerAmount(state: ScenarioState, found: Exclude<Amount, number>, ctx: ReduceContext): number | null {
  return found.committedWillpower ? committedWillpower(state, ctx.cards) : null;
}
