// Rules: rr.travel (data/rules/entries.json); ledger lines 09029:A:2, 09018:A:1, 09037:A:2. "Travel: Remove 1 resource token from the Mission objective": a Travel cost that must be paid (rr.travel), so the players cannot travel to the location while no Mission objective holds a resource token.
import type { Instruction } from "../../../catalog/boundary.ts";

import type { ReduceContext } from "../../interpret/interpret.ts";
import { pickCandidates } from "../../interpret/pick.ts";
import type { ScenarioState } from "../../core/state.ts";
import { effectsOf } from "../../windows/listen.ts";
import { topOfEncounterDiscard } from "../nightmare/index.ts";

/** Whether this instruction of a Travel line is a removal of resource tokens from a card the line picks and no card the pick finds holds one. */
export function missionTokenUnpayable(state: ScenarioState, instruction: Instruction, ctx: ReduceContext, locationId: string): boolean {
  if (instruction.verb !== "RemoveResourceTokens" || instruction.on !== "picked") return false;
  const code = state.cards[locationId]?.code;
  const travel = effectsOf(ctx, code ?? "").filter((effect) => effect.timing === "travel").flatMap((effect) => effect.instructions);
  const pick = travel.find((other) => other.verb === "Pick");
  if (pick?.verb !== "Pick") return false;
  return !pickCandidates(state, pick.pick, state.activeSeat, [], locationId, ctx).some((id) => (state.cards[id]?.resources ?? 0) > 0);
}

/**
 * The Travel lines of Angmar Awakened that are costs the players must meet (rr.travel: "If the players cannot pay the Travel cost, then they cannot travel to that location"): Chetwood Forest's "One player chooses and engages an enemy in the staging area" needs an enemy in the staging area
 * (09018:A:1), Norbury Tombs' "Return the topmost enemy in the encounter discard pile to the staging area" needs an enemy in the encounter discard pile (09037:A:2). A Travel line's Pick of an enemy with none to pick, or its PickDiscardTop with none in the pile, cannot be met.
 */
export function travelUnpayable(state: ScenarioState, instruction: Instruction, ctx: ReduceContext, locationId: string): boolean {
  if (instruction.verb === "PickDiscardTop") return topOfEncounterDiscard(state, instruction.types, ctx, instruction.trait) === undefined;
  if (instruction.verb === "Pick" && instruction.pick.type === "enemy") return pickCandidates(state, instruction.pick, state.activeSeat, [], locationId, ctx).length === 0;
  return missionTokenUnpayable(state, instruction, ctx, locationId);
}
