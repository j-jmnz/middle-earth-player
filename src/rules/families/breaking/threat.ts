// Rules: mec109.multiple-staging-areas (data/rules/entries.json); ledger line 901707:A:1.
//
// A location in a staging area that holds `threatInOtherAreas` adds its Threat to the total Threat in every other player's staging area, once for each area ("it contributes its Threat to the total Threat in each other player's staging area").
import type { PrintedCard } from "../../core/printed.ts";
import { modifiedStat } from "../../core/keywords.ts";
import type { ScenarioState } from "../../core/state.ts";
import { flagged } from "../../core/state.ts";
import { headOf } from "./areas.ts";

/** The cards in the staging areas of the other players that add their Threat to the seat's staging area, with the Threat each adds now. Nothing while stages are not separate or the seat is not asked about. */
export function threatFromOtherAreas(state: ScenarioState, seat: number | undefined, cards: ReadonlyMap<string, PrintedCard>): { id: string; threat: number; area: number }[] {
  const found: { id: string; threat: number; area: number }[] = [];
  if (!state.separate || seat == null || state.modifiers.length === 0) return found;
  const head = headOf(state, seat);
  state.seats.forEach((other, index) => {
    if (index >= state.seatCount || index === head) return;
    for (const id of other.staging) {
      const instance = state.cards[id];
      if (instance && flagged(state, id, "threatInOtherAreas") && !flagged(state, id, "noThreatContribution")) found.push({ id, threat: modifiedStat(state, instance, "threat", cards), area: index });
    }
  });
  return found;
}
