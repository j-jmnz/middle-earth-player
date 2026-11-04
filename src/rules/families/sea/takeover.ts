// Rules: dcce.ships, rr.in-play-and-out-of-play; ledger lines 12123:A:3, 110102:A:3, 110102:B:5. "Forced: When Dol Amroth Warship is destroyed, set it aside, out of play": the source card, from the discard pile it was
// destroyed to, goes to the set-aside zone with no damage and no controller, so that The Beacon can take it again.
import type { ScenarioState } from "../../core/state.ts";
import { updateCard } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import type { Focus } from "../index.ts";

export function setAsideSelf(state: ScenarioState, focus: Focus): ScenarioState {
  const id = focus.sourceId;
  if (!id || !state.cards[id]) return state;
  return updateCard(moveCard(state, id, { zone: "setAside" }), id, { face: "down", controller: null, damage: 0, exhausted: false });
}
