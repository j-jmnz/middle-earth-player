// Rules: rr.in-play-and-out-of-play (data/rules/entries.json); ledger line 16016:A:1.
//
// PlaceUnderSelfFaceup: the last picked card goes under the source location faceup and out of play. The core's PlaceUnderSelf leaves it facedown (141049:A:1); a card faceup under a location can be read by every player.
import type { EngineStep } from "../../core/intents.ts";
import { updateCard, type ScenarioState } from "../../core/state.ts";
import { placeUnderHost } from "../encounter/moves.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { lastPicked } from "../../interpret/player-verbs.ts";
import { inPlay } from "../../core/zones.ts";
import type { Focus } from "../index.ts";

export function placeUnderFaceup(state: ScenarioState, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const id = lastPicked(state);
  const card = state.cards[id];
  if (!focus.sourceId || !card || !state.cards[focus.sourceId] || !inPlay(card.zone)) return state;
  const placed = placeUnderHost(state, id, focus.sourceId, ctx, steps);
  return updateCard(placed, id, { face: "up" });
}
