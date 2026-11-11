// The extra top-bar dials of the scenarios that have them, in the order the bar draws them: The Road to Isengard's (readouts/isengard.ts), The Passage of the Marshes' (readouts/marshes.ts), Journey to the Cross-roads' (readouts/roads.ts) and Shelob's Lair's (readouts/lair.ts).
// Each scenario's list is empty in any other scenario, so a new scenario's dials are one more line in `scenarioDials`. The engine decided each number; nothing here changes one. Pure, so a test reads it.
import { useMemo } from "react";

import type { ReduceContext, ScenarioState } from "../../rules/engine/reduce.ts";

import type { TableDial } from "./dials.ts";
import { useStableDials } from "./dials.ts";
import { isengardDials, isengardHands, type HandMark } from "./isengard.ts";
import { lairDials, lairHands } from "./lair.ts";
import { marshesDials } from "./marshes.ts";
import { roadsDials } from "./roads.ts";

/** Every scenario dial the game holds now. */
export function scenarioDials(game: ScenarioState, ctx: ReduceContext, nameOf: (code: string) => string): readonly TableDial[] {
  return [...isengardDials(game, ctx, nameOf), ...marshesDials(game, ctx, nameOf), ...roadsDials(game, ctx, nameOf), ...lairDials(game, ctx, nameOf)];
}

/** The dials for the top bar: the same list while no dial's words or number changed, so the bar re-renders only when a token, a hit point or a card moves. */
export function useScenarioDials(game: ScenarioState, ctx: ReduceContext, nameOf: (code: string) => string): readonly TableDial[] {
  return useStableDials(scenarioDials(game, ctx, nameOf));
}

/** The marks the seat dials wear: The Road to Isengard's cards in hand on stage 3B and Shelob's Lair's allies this round. */
export function seatMarks(game: ScenarioState, ctx: ReduceContext): readonly HandMark[] {
  return [...isengardHands(game), ...lairHands(game, ctx)];
}

/** The seat marks for the top bar, stable the same way. */
export function useSeatMarks(game: ScenarioState, ctx: ReduceContext): readonly HandMark[] {
  const key = JSON.stringify(seatMarks(game, ctx));
  return useMemo((): readonly HandMark[] => JSON.parse(key), [key]);
}
