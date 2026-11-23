// Rules: docs/scenarios/standalone-scenarios/the-battle-of-lake-town.md (The Battle of Lake-town), rr.victory, ltp.scoring (data/rules/entries.json); ledger lines 50201:B:1, 50202:B:1, 50203:B:3, 50207:A:1.
//
// The pieces The Battle of Lake-town's cards hold on the table, as top-bar dials: the damage on Lake-town against the 50 that loses the game (it warms near the limit), on stage 3 the Victory points in the display against that damage (a goal: more points wins, a tie loses), and the damage on
// Smaug against the cap the stage gives him (6 or 12) or, on stage 3, against his hit points. The Smaug deck and its discard pile are piles of the table (store/pile-ids.ts). The engine decided every number (the damage tokens, the `damageCeiling` and `loseAtDamage` constants, the points of
// the cards in the victory display); nothing here changes one. Empty in any other scenario. Pure, so a test reads it.
import { modifiedStat } from "../../../rules/core/keywords.ts";
import { heldAmount } from "../../../rules/core/state.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import type { ReduceContext } from "../../../rules/engine/reduce.ts";
import { lakeTownDamage, lakeTownId, lakeTownLimit, smaugInPlay, victoryPoints } from "../../../rules/families/smaug/cards.ts";

import { scoreLimitWords, scoreWords, smaugLimitWords, smaugWords, townLimitWords, townNearWords, townWords } from "../../words/scenarios/standalone-scenarios/smaug-table.ts";
import type { TableDial } from "../dials.ts";

/** The last stage of the quest: the players win by defeating Smaug there, and the score decides it. */
export const DRAGONS_WRATH = "50203";
/** How near the limit the dial warns (near) and turns critical. */
const NEAR = 10;
const CRITICAL = 3;

/** The dials Lake-town's cards hold now: none in any other scenario. */
export function lakeTownDials(game: ScenarioState, ctx: ReduceContext, nameOf: (code: string) => string): readonly TableDial[] {
  const town = lakeTownId(game);
  if (town == null) return [];
  const dials: TableDial[] = [];
  const damage = lakeTownDamage(game);
  const limit = lakeTownLimit(game);
  const left = Math.max(0, limit - damage);
  const level = left <= CRITICAL ? ("critical" as const) : left <= NEAR ? ("near" as const) : null;
  dials.push({
    id: "town",
    testID: "town-damage",
    label: "Lake-town",
    name: `Damage on ${nameOf("50207")}`,
    value: damage,
    limit,
    warms: true,
    ...(level ? { warn: { level, words: townNearWords(left) } } : {}),
    limitWords: townLimitWords(limit),
    note: townWords(damage, limit),
  });
  const stage = game.questStage ? game.cards[game.questStage] : undefined;
  if (stage?.code === DRAGONS_WRATH) {
    const points = victoryPoints(game, ctx.cards);
    dials.push({ id: "score", testID: "town-score", label: "Points", name: "Victory points in the victory display", value: points, limit: damage + 1, goal: true, limitWords: scoreLimitWords(damage), note: scoreWords(points, damage) });
  }
  const smaug = smaugInPlay(game);
  const card = smaug ? game.cards[smaug] : undefined;
  if (smaug && card) {
    const cap = heldAmount(game, smaug, "damageCeiling");
    const capped = cap > 0;
    const most = capped ? cap : modifiedStat(game, card, "hitPoints", ctx.cards);
    dials.push({ id: "smaug", testID: "town-smaug", label: "Smaug", name: `Damage on ${nameOf(card.code)}`, value: card.damage, limit: most, ...(capped ? {} : { goal: true as const }), limitWords: smaugLimitWords(most, capped), note: smaugWords(card.damage, most, capped) });
  }
  return dials;
}
