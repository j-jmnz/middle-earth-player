// Rules: rr.in-play-and-out-of-play, rr.first-player (data/rules/entries.json); ledger line 09051:A:1. The hands the players place facedown under Lost in the Wilderness.
import type { ReduceContext } from "../../interpret/interpret.ts";
import { updateCard, type ScenarioState } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import type { Focus } from "../index.ts";
import { isSideQuest } from "../wilderland/night-quest.ts";

/** PlaceHandUnderSelf: every card of the actor's hand goes facedown underneath the source, an encounter side quest, out of play and still the actor's (`owner`). An empty hand, or a source that is no side quest, moves nothing. */
export function placeHandUnderSelf(state: ScenarioState, focus: Focus, ctx: ReduceContext): ScenarioState {
  const hostId = focus.sourceId;
  if (!hostId || !isSideQuest(state, hostId, ctx)) return state;
  let next = state;
  for (const id of state.seats[focus.seat]?.hand ?? []) next = updateCard(moveCard(next, id, { zone: "under", locationId: hostId }), id, { owner: next.cards[id]?.owner ?? focus.seat });
  return next;
}
