// Rules: docs/scenarios/standalone-scenarios.md (The Battle of Lake-town), rr.travel, rr.active-location (data/rules/entries.json); ledger line 50223:A:2.
// Fisherman's Dock: "Travel: If there is 1 active location, exhaust a hero to travel here. (There are now 2 active locations.)" With one active location and no second, the players may travel to a Fisherman's Dock in the staging area, which becomes the second
// active location (the one travel of the round); the exhaust is its cost (the record's `when` gates it, interpret/restrictions.ts travelCostUnpayable), so it cannot be paid with no ready hero. With no active location the Dock is traveled to as any location is, and nothing is exhausted.
import type { ScenarioState } from "../../core/state.ts";

/** Fisherman's Dock (50223). */
export const DOCK = "50223";

/** Exactly one active location, and a Fisherman's Dock in the staging area to travel to. */
export function dockSecond(state: ScenarioState): boolean {
  return state.activeLocation != null && state.secondActiveLocation == null && state.staging.some((id) => state.cards[id]?.code === DOCK);
}
