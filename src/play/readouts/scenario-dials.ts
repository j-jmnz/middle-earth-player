// The extra top-bar dials of the scenarios that have them, in the order the bar draws them: The Road to Isengard's (readouts/isengard.ts), The Passage of the Marshes' (readouts/marshes.ts) Journey to the Cross-roads' (readouts/roads.ts) and Shelob's Lair's (readouts/lair.ts).
// Each scenario's list is empty in any other scenario, so a new scenario's dials are one more line in `scenarioDials`. The engine decided each number; nothing here changes one. Pure, so a test reads it.
import type { ReduceContext, ScenarioState } from "../../rules/engine/reduce.ts";

import type { TableDial } from "./dials.ts";
import { useStableDials } from "./dials.ts";
import { isengardDials } from "./isengard.ts";
import { lairDials } from "./lair.ts";
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
