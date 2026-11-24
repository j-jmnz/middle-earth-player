// Rules: rr.cannot, rr.resources (data/rules/entries.json); ledger line 05058:A:1.
// Orc Vanguard in the staging area: no resource can be spent from the pool of a hero with a Leadership, Spirit or Lore icon. Resources can still be gained and moved. A constant on the hero sets `cannotSpendResources`; the payments read it (costs/pay.ts payerOk, costs/verbs.ts spendablePools).
import { flagged, type ScenarioState } from "../../core/state.ts";

/** Whether resources cannot be spent from this card's pool. */
export function resourcesLocked(state: ScenarioState, id: string): boolean {
  return state.modifiers.length > 0 && flagged(state, id, "cannotSpendResources");
}
