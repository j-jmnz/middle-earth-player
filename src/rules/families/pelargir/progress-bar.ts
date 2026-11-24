// Rules: rr.staging-area, rr.cannot, rr.in-play-and-out-of-play (data/rules/entries.json); ledger line 06091:B:1.
// "Player card effects cannot place progress tokens on locations in the staging area": the table holds `noProgressInStagingByPlayer` while the stage is in play, and the progress a player card's effect would place on a location that lies in the staging area is not placed. A location that is
// active or in a player's play area is not in the staging area, and an encounter card's or a location's own effect is no player card effect.
import { flagged, type ScenarioState } from "../../core/state.ts";

/** A player card's effect may not place progress on this location: the bar holds and the location is in the staging area. False for an effect of any other card. */
export function playerProgressBarredOn(state: ScenarioState, id: string, byPlayerCard: boolean): boolean {
  return byPlayerCard && state.modifiers.length > 0 && state.cards[id]?.zone === "staging" && flagged(state, "table", "noProgressInStagingByPlayer");
}
