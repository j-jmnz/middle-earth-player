// Rules: rr.travel (data/rules/entries.json); ledger line 09029:A:2. "Travel: Remove 1 resource token from the Mission objective": a Travel cost that must be paid (rr.travel), so the players cannot travel to the location while no Mission objective holds a resource token.
import type { Instruction } from "../../../catalog/boundary.ts";

import type { ReduceContext } from "../../interpret/interpret.ts";
import { pickCandidates } from "../../interpret/pick.ts";
import type { ScenarioState } from "../../core/state.ts";

/** Whether this instruction of a Travel line is a removal of resource tokens from a card the line picks and no card the pick finds holds one. */
export function missionTokenUnpayable(state: ScenarioState, instruction: Instruction, ctx: ReduceContext, locationId: string): boolean {
  if (instruction.verb !== "RemoveResourceTokens" || instruction.on !== "picked") return false;
  const code = state.cards[locationId]?.code;
  const travel = ctx.effects.filter((effect) => effect.cardCode === code && effect.timing === "travel").flatMap((effect) => effect.instructions);
  const pick = travel.find((other) => other.verb === "Pick");
  if (pick?.verb !== "Pick") return false;
  return !pickCandidates(state, pick.pick, state.activeSeat, [], locationId, ctx).some((id) => (state.cards[id]?.resources ?? 0) > 0);
}
