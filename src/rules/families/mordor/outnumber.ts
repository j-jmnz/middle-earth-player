// Rules: vom.controlling-locations, rr.staging-area, rr.active-location (data/rules/entries.json); ledger lines 22025:B:3, 22026:B:2.
// The condition `controlsOutnumberStaging` ("more locations under the players' control than in the staging area"): the locations the players control are counted against the locations in the staging area; the active location is not in the staging area (docs/scenarios/vengeance-of-mordor/wrath-and-ruin.md, Readings).
import type { Condition } from "../../../catalog/boundary.ts";

import { printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { controlledLocations } from "../pelargir/location-control.ts";

/** The locations in the staging area (the active location is not one): what the controlled ones are counted against. */
export function stagedLocationCount(state: ScenarioState, ctx: ReduceContext): number {
  return state.staging.filter((id) => {
    const card = state.cards[id];
    return card != null && printedOf(ctx.cards, card.code).type === "location";
  }).length;
}

/** True when the players control more locations than the staging area holds; null for any other condition. */
export function controlsOutnumberStaging(state: ScenarioState, condition: Condition, ctx: ReduceContext): boolean | null {
  if (condition.kind !== "controlsOutnumberStaging") return null;
  return controlledLocations(state).length > stagedLocationCount(state, ctx);
}
