// Rules: mec112.setup-journey-to-the-cross-roads (data/rules/entries.json); ledger lines 144027:A:2, 144030:A:2, 144068:B:1.
//
// The pieces of Journey to the Cross-roads' table (docs/design-system-table.md, Cards, Journey to the Cross-roads): the Gate dial (the enemies facedown under The Black Gate against the players + 3 at which the players lose, warming toward it,
// never the accent) and the Harad deck dial (the cards left under The Cross-roads, which sets its Threat and bars its travel). The engine decided every number (`facedownCount`, `modifiedStat`); nothing here changes one. Pure, so a test reads it.
import { modifiedStat } from "../../rules/core/keywords.ts";
import { inPlay, livingSeats } from "../../rules/core/state.ts";
import { pileOf } from "../../rules/core/piles.ts";
import type { ReduceContext, ScenarioState } from "../../rules/engine/reduce.ts";
import { facedownCount } from "../../rules/families/misc/amounts.ts";

import { gateWarn, gateWords, haradWords } from "../words/scenarios/roads.ts";
import { useStableDials, type TableDial } from "./dials.ts";

const BLACK_GATE = "144027";
const CROSS_ROADS = "144030";

/**
 * The dials Journey to the Cross-roads' pieces hold now, in the order the top bar draws them: Gate (while The Black Gate is in play), then Harad (while the game has the Harad deck). The Gate dial warms toward its limit and
 * warns at 2 and at 1 enemy from it, driven by the cards left. Empty in any other scenario.
 */
export function roadsDials(game: ScenarioState, ctx: ReduceContext, nameOf: (code: string) => string): readonly TableDial[] {
  const dials: TableDial[] = [];
  const gate = Object.values(game.cards).find((card) => card.code === BLACK_GATE && inPlay(card.zone));
  if (gate) {
    const count = facedownCount(game, gate.id);
    const limit = livingSeats(game).length + 3;
    const warn = gateWarn(Math.max(0, limit - count));
    dials.push({ id: "gate", testID: "roads-gate", label: "Gate", name: `Enemies facedown under ${nameOf(BLACK_GATE)}, the players lose at ${limit}:`, value: count, limit, warms: true, ...(warn ? { warn } : {}), limitWords: gateWords(count, limit) });
  }
  if (game.piles?.haradDeck !== undefined) {
    const left = pileOf(game, "haradDeck").length;
    const roads = Object.values(game.cards).find((card) => card.code === CROSS_ROADS && inPlay(card.zone));
    dials.push({ id: "harad", testID: "roads-harad", label: "Harad", name: `Cards facedown under ${nameOf(CROSS_ROADS)}:`, value: left, note: haradWords(left, roads ? modifiedStat(game, roads, "threat", ctx.cards) : null) });
  }
  return dials;
}

/** The dials for the top bar: the same list while no dial's words or number changed. */
export function useRoadsDials(game: ScenarioState, ctx: ReduceContext, nameOf: (code: string) => string): readonly TableDial[] {
  return useStableDials(roadsDials(game, ctx, nameOf));
}
