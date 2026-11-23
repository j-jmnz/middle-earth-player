// Rules: hob.burgle, rr.modifiers, rr.quest-advancement (data/rules/entries.json); ledger lines 132040:A:3, 132043:A:1, 132071:A:1 (docs/scenarios/the-hobbit.md, The Lonely Mountain, The table).
//
// The pieces The Lonely Mountain's cards hold on the table, as top-bar dials: the treasure cards stacked facedown under The Lonely Mountain (the Setup's stack, 132071:A:1; each lowers its Threat by 2 and the top one is the prize of a successful burgle attempt, 132043:A:1, 132072:B:1) and the progress
// on Smaug the Golden against the 6th that advances the players to stage 4A (132040:A:3; a warming dial, since the players cannot place that progress and stay on stage 2). The engine decided every number (the cards under the Mountain, its modified Threat, the tokens); nothing here changes one.
// Empty in any other scenario. Pure, so a test reads it.
import { modifiedStat } from "../../../rules/core/keywords.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import type { ReduceContext } from "../../../rules/engine/reduce.ts";

import { goldenLimitWords, goldenNearWords, goldenWords, stackWords } from "../../words/scenarios/the-hobbit/mountain-table.ts";
import { cardsOf, type TableDial } from "../dials.ts";

const SCENARIO = "the-lonely-mountain";
const MOUNTAIN = "132043";
const GOLDEN = "132040";
/** The Erebor treasure cards the Setup stacks under the Mountain. */
export const STACKED = 5;
/** The progress on Smaug the Golden that advances the players to stage 4A. */
export const SIXTH = 6;
/** How near the sixth progress the dial warns (near) and turns critical. */
const NEAR = 2;
const CRITICAL = 1;

/** The dials The Lonely Mountain's cards hold now: none in any other scenario. */
export function mountainDials(game: ScenarioState, ctx: ReduceContext, nameOf: (code: string) => string): readonly TableDial[] {
  if (game.scenarioId !== SCENARIO) return [];
  const dials: TableDial[] = [];
  const mountain = cardsOf(game, MOUNTAIN)[0];
  if (mountain) {
    const under = Object.values(game.cards).filter((card) => card.zone === "under" && card.host === mountain.id).length;
    const threat = modifiedStat(game, mountain, "threat", ctx.cards);
    dials.push({ id: "stack", testID: "mountain-stack", label: "Stack", name: `Treasure cards under ${nameOf(MOUNTAIN)}`, value: under, limit: STACKED, note: stackWords(nameOf(MOUNTAIN), under, STACKED, threat, ctx.cards.get(MOUNTAIN)?.threat ?? 0) });
  }
  const golden = cardsOf(game, GOLDEN)[0];
  if (golden) {
    const left = Math.max(0, SIXTH - golden.progress);
    const level = left <= CRITICAL ? ("critical" as const) : left <= NEAR ? ("near" as const) : null;
    dials.push({ id: "golden", testID: "mountain-golden", label: "Golden", name: `Progress on ${nameOf(GOLDEN)}`, value: golden.progress, limit: SIXTH, warms: true, ...(level ? { warn: { level, words: goldenNearWords(left) } } : {}), limitWords: goldenLimitWords(SIXTH), note: goldenWords(nameOf(GOLDEN), golden.progress, SIXTH) });
  }
  return dials;
}
