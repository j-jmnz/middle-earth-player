// Rules: rr.damage, rr.in-play-and-out-of-play (data/rules/entries.json); ledger lines 51301:B:1, 51307:B:2, 51307:B:3 (docs/scenarios/standalone-scenarios/escape-from-khazad-dum.md, Escape from Khazad-dûm, The table; docs/design-system-table.md, Top bar).
//
// The pieces Escape from Khazad-dûm's cards hold on the table: the damage on the stage 3B against the number that loses the game (a warming dial), Durin's Bane while it lies set aside (a word dial; a tap shows its card). The engine decided every number; nothing here changes one. Empty in any other scenario. Pure, so a test reads it.
import type { ScenarioState } from "../../../rules/core/state.ts";
import { heldAmount } from "../../../rules/core/state.ts";
import { printedOf } from "../../../rules/core/printed.ts";
import type { ReduceContext } from "../../../rules/engine/reduce.ts";

import type { TableDial } from "../dials.ts";
import { baneAsideWords, stageDamageLimitWords, stageDamageNearWords, stageDamageWords } from "./khazad-words.ts";

const SCENARIO = "escape-from-khazad-dum";
const BANE = "51311";

/** The dials Escape from Khazad-dûm's cards hold now: none in any other scenario. */
export function khazadDials(game: ScenarioState, ctx: ReduceContext, nameOf: (code: string) => string): readonly TableDial[] {
  if (game.scenarioId !== SCENARIO) return [];
  const dials: TableDial[] = [];
  const stage = game.questStage ? game.cards[game.questStage] : undefined;
  const limit = stage ? heldAmount(game, stage.id, "loseAtDamage") : 0;
  if (stage && limit > 0) {
    const attack = printedOf(ctx.cards, BANE).attack ?? 0;
    const near = stage.damage + attack >= limit;
    dials.push({
      id: "damage",
      testID: "khazad-damage",
      label: "Damage",
      name: `Damage on ${nameOf(stage.code)}`,
      value: stage.damage,
      limit,
      warms: true,
      cardId: stage.id,
      ...(near ? { warn: { level: stage.damage + 1 >= limit ? ("critical" as const) : ("near" as const), words: stageDamageNearWords(stage.damage, limit, attack) } } : {}),
      limitWords: stageDamageLimitWords(limit),
      note: stageDamageWords(nameOf(stage.code), stage.damage, limit),
    });
  }
  const aside = game.setAside.find((id) => game.cards[id]?.code === BANE);
  if (aside) dials.push({ id: "bane", testID: "khazad-bane", label: "Bane", name: `${nameOf(BANE)} is set aside`, value: 1, word: "Aside", cardId: aside, note: baneAsideWords() });
  return dials;
}
