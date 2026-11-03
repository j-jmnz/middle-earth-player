// Rules: dcce.aflame (data/rules/entries.json). The aflame family's Pick filters (effect-schema-pick.ts): a location that prints Aflame, and the lowest Aflame value among those that matched.
import type { PickSpec } from "../../../catalog/boundary.ts";

import type { ReduceContext } from "../../interpret/interpret.ts";
import type { ScenarioState } from "../../core/state.ts";
import { aflameOf } from "./values.ts";

export function aflamePickMatches(state: ScenarioState, id: string, spec: PickSpec, ctx: ReduceContext): boolean {
  return spec.aflame == null || (aflameOf(state, id, ctx) != null) === spec.aflame;
}

/** Of the cards that matched, only those whose Aflame value is the lowest ("the Aflame location in play with the lowest Aflame value", 11036:B:1); all of them when tied. */
export function lowestAflame(state: ScenarioState, found: readonly string[], ctx: ReduceContext): string[] {
  const values = found.map((id) => aflameOf(state, id, ctx) ?? Number.MAX_SAFE_INTEGER);
  const lowest = Math.min(...values);
  return found.filter((_id, at) => values[at] === lowest);
}
