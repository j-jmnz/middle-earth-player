// Rules: rr.explored, rr.active-location, rr.staging (data/rules/entries.json). A location is explored as soon as its progress equals its quest points as they stand, whatever changed them: placing progress explores it where it is placed
// (families/south/locations.ts), and this sweep explores one whose quest points dropped under the progress already there (The Old Ford, 18016, when an enemy leaves play; Goblin Gate under Ambush in the Night, 901402:B:2).
import type { EngineStep } from "../../core/intents.ts";
import { syncConstants } from "../../interpret/constants.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { isLocationCard, printedOf } from "../../core/printed.ts";
import { inPlay, type ScenarioState } from "../../core/state.ts";
import { gameReads } from "../../core/game-reads.ts";
import { announceExplored } from "../../quest/stage-reveal.ts";
import { exploreIfFull } from "../south/locations.ts";

/** The settle sweep: each location in play whose progress has reached its quest points is explored (it leaves play with the explored mark, as a full location does when progress is placed). Only a game with progress on a location looks. */
export function exploreFull(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  if (state.lost || state.failure) return state;
  const holding = Object.values(state.cards).filter((card) => card.progress > 0 && inPlay(card.zone) && isLocationCard(printedOf(ctx.cards, card.code)));
  if (holding.length === 0) return state;
  // The quest points are read with the constants as they are now; only a game with a record that changes quest points needs the sync.
  const synced = gameReads(state, ctx, '"stat":"questPoints"') ? syncConstants(state, ctx) : state;
  if (synced !== state) return synced;
  let next = state;
  for (const card of holding) {
    const explored = exploreIfFull(next, card.id, ctx.cards, steps);
    // The location left play explored: its questResolution records and the cards that answer its leaving resolve as when progress explores it.
    next = explored === next || inPlay(explored.cards[card.id]?.zone ?? "discard") ? explored : announceExplored(explored, card.id, ctx, steps);
  }
  return next;
}
