// Rules: rr.travel, rr.active-location (data/rules/entries.json); ledger lines 12044:A:1, 12041:B:1. What the grapple family says about traveling: a location that gains a Travel cost ("each other Deck location
// in play gains: Travel: Each player must exhaust a character he controls to travel here") and the quest stage that lets the players travel while another location is active.
import type { Instruction } from "../../../catalog/boundary.ts";

import type { ScenarioState } from "../../state.ts";
import { flagged, heldAmount } from "../../state.ts";

// "Each player must exhaust a character he controls to travel here" (12044:A:1): the cost of a Travel line, which the players cannot pay without a ready character each (rr.travel).
const EXHAUST_COST: Instruction = { verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "Pick", pick: { type: "character", control: "you", state: "ready" } }, { verb: "Exhaust", target: { kind: "picked" } }] };

/** The Travel cost a card gave the location (flag travelExhaust), after the ones printed on it. */
export function grantedTravel(state: ScenarioState, locationId: string): readonly Instruction[] {
  return flagged(state, locationId, "travelExhaust") ? [EXHAUST_COST] : [];
}

/** The players may travel to a location in the staging area while another location is the active location; it returns to the staging area (flag travelOverActive on the table). */
export function travelsOverActive(state: ScenarioState): boolean {
  return heldAmount(state, "table", "travelOverActive") > 0;
}
