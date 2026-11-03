// What the table's zone selectors read of a card's printing (selectors.ts, ZoneFacts): its type, for staging's fold order, and its place among the ships,
// for the play area's order (dcce.ship-objectives: a seat's ships stand first, the Dream-chaser before any other), and the Victory points a card in the victory display
// scores on the side it lies (the victory pile's coin; the same count campaign/score.ts adds up). Built once per reduce context.
import { DREAM_CHASER } from "../rules/families/sea-fleet.ts";
import type { PrintedCard } from "../rules/printed.ts";
import { victoryPointsOf } from "../rules/printed-stat.ts";

import type { ZoneFacts } from "./selectors.ts";

/** The facts of a printed-card map. A code the map does not hold is no ship and has no type. */
export function zoneFactsOf(cards: ReadonlyMap<string, PrintedCard>): ZoneFacts {
  return {
    typeOf: (code) => cards.get(code)?.type ?? null,
    shipRank: (code) => {
      const printed = cards.get(code);
      if (printed?.ship !== "objective") return null;
      return printed.name === DREAM_CHASER ? 0 : 1;
    },
    pointsOf: (game, cardId) => victoryPointsOf(game, cardId, cards),
  };
}
