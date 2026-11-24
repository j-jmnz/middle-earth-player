// Rules: rr.explored, rr.active-location, rr.staging (data/rules/entries.json). A location is explored as soon as its progress equals its quest points as they stand, whatever changed them: placing progress explores it where it is placed
// (families/south/locations.ts), and this sweep explores one whose quest points dropped under the progress already there (The Old Ford, 18016, when an enemy leaves play; Goblin Gate under Ambush in the Night, 901402:B:2).
import type { EngineStep } from "../../core/intents.ts";
import { syncConstants } from "../../interpret/constants.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { isLocationCard, printedOf } from "../../core/printed.ts";
import { inPlay, type ScenarioState } from "../../core/state.ts";
import { exploreIfFull } from "../south/locations.ts";

/** The settle sweep: each location in play whose progress has reached its quest points is explored (it leaves play with the explored mark, as a full location does when progress is placed). Only a game with progress on a location looks. */
export function exploreFull(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  if (state.lost || state.failure) return state;
  const holding = Object.values(state.cards).filter((card) => card.progress > 0 && inPlay(card.zone) && isLocationCard(printedOf(ctx.cards, card.code)));
  if (holding.length === 0) return state;
  // The quest points are read with the constants as they are now.
  const synced = syncConstants(state, ctx);
  if (synced !== state) return synced;
  let next = state;
  for (const card of holding) next = exploreIfFull(next, card.id, ctx.cards, steps);
  return next;
}
