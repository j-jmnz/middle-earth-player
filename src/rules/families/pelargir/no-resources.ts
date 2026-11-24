// Rules: rr.resources (data/rules/entries.json); ledger lines 06048:A:2, 06053:A:2.
// "Heroes with no resources in their resource pool" (Drúadan Hunter's X, Men in the Dark's Shadow): a Pick or a count that names `hasResources: false` leaves out every hero whose pool holds a token. The core reads only the `true` form (interpret/pick.ts), so this
// hook of the family is the one reader of `false`. It runs after the core's own filters.
import type { PickSpec } from "../../../catalog/boundary.ts";
import type { ScenarioState } from "../../core/state.ts";

/** False when the pick asks for a card with no resources and the card holds some; true leaves the other filters to decide. */
export function noResourcesMatches(state: ScenarioState, id: string, spec: PickSpec): boolean {
  return spec.hasResources !== false || (state.cards[id]?.resources ?? 0) === 0;
}
