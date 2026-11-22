// Rules: rr.forced, rr.quest-advancement (data/rules/entries.json); ledger lines 50603:B:1, 50603:B:2, 50608:A:1, 50615:A:2 (docs/scenarios/standalone-scenarios.md, The Ruins of Belegost, The table).
//
// The pieces The Ruins of Belegost's cards hold on the table, as top-bar dials: the resources on Stalking the Ruins against the 3 that bring Naurlhûg (the number is read from the card's own record; it warms when the next quest phase brings him, and once he is in play the
// dial says his X) and the resources on stage 2D against the 3 it asks for (a goal dial: more is the way on). The Loot objective that lies facedown under Stalking the Ruins is drawn as the peek under any staging card. The engine decided every number (the tokens, the
// records' own limits); nothing here changes one. A tap on a dial shows its card. Empty in any other scenario. Pure, so a test reads it.
import type { Condition } from "../../../catalog/boundary.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import type { ReduceContext } from "../../../rules/engine/reduce.ts";
import { effectsOf } from "../../../rules/windows/listen.ts";

import { stageResourcesLimitWords, stageResourcesWords, stalkingLimitWords, stalkingNearWords, stalkingWords } from "./belegost-words.ts";
import { cardsOf, type TableDial } from "../dials.ts";

const SCENARIO = "the-ruins-of-belegost";
const STALKING = "50608";
const NAURLHUG = "50615";
/** The quest stage that asks for resources on it (2D, the back of Deeper into the Past). */
const STAGE = "50603";

/** The number of tokens a card's Forced record asks for before it adds Naurlhûg ("if there are at least 3 resources here"), read from its `tokens` condition; null when it has none. */
function stalkingLimit(ctx: ReduceContext): number | null {
  for (const effect of effectsOf(ctx, STALKING)) for (const step of effect.instructions) if ("when" in step && step.when?.kind === "tokens" && step.when.code === STALKING && step.when.min != null) return step.when.min;
  return null;
}

/** The number of resources a stage's constant restriction asks for ("at least 3 resources here"), read from its `less` condition on the stage's own resources; null when it has none. */
function stageLimit(ctx: ReduceContext, code: string): number | null {
  const found = (condition: Condition | undefined): number | null => {
    if (condition == null) return null;
    if (condition.kind === "less" && typeof condition.left === "object" && condition.left.stat === "resources" && condition.left.of === "self" && typeof condition.right === "number") return condition.right;
    if (condition.kind === "any" || condition.kind === "all") for (const inner of condition.conditions) { const number = found(inner); if (number != null) return number; }
    return null;
  };
  for (const effect of effectsOf(ctx, code)) { const number = found(effect.condition); if (number != null) return number; }
  return null;
}

/** The dials The Ruins of Belegost's cards hold now: none in any other scenario. */
export function belegostDials(game: ScenarioState, ctx: ReduceContext, nameOf: (code: string) => string): readonly TableDial[] {
  if (game.scenarioId !== SCENARIO) return [];
  const dials: TableDial[] = [];
  const stalking = cardsOf(game, STALKING)[0];
  const limit = stalkingLimit(ctx);
  if (stalking && limit != null) {
    const arrived = cardsOf(game, NAURLHUG).length > 0;
    const near = !arrived && stalking.resources >= limit - 1;
    dials.push({ id: "stalking", testID: "belegost-stalking", label: "Stalking", name: `Resources on ${nameOf(STALKING)}`, value: stalking.resources, limit, warms: true, cardId: stalking.id, ...(near ? { warn: { level: "near" as const, words: stalkingNearWords() } } : {}), limitWords: stalkingLimitWords(limit), note: stalkingWords(stalking.resources, limit, arrived) });
  }
  const stage = game.questStage ? game.cards[game.questStage] : undefined;
  const need = stage?.code === STAGE ? stageLimit(ctx, STAGE) : null;
  if (stage && need != null) dials.push({ id: "stage", testID: "belegost-stage", label: "Resources", name: `Resources on ${nameOf(stage.code)}`, value: stage.resources, limit: need, goal: true, cardId: stage.id, limitWords: stageResourcesLimitWords(need), note: stageResourcesWords(stage.resources, need) });
  return dials;
}
