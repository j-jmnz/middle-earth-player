// Rules: rr.in-play-and-out-of-play (data/rules/entries.json); ledger lines 16035:A:1, 16036:A:1, 51011:A:2, 51113:A:1, 146070:A:2.
// The line a card in play says about itself when its Threat, Attack or Defense is read from the stage number of the main quest: the constant record that does it (ModifyStat of the stage number on itself, with its `times` and `plus`).
// The card prints "X" or a stage-based number, so no badge says the value (a badge is a change to a printed number). The engine decided the value; nothing here changes one.
import { modifiedStat } from "../../rules/core/keywords.ts";
import { printedOf } from "../../rules/core/printed.ts";
import { inPlay } from "../../rules/core/state.ts";
import type { ReduceContext, ScenarioState } from "../../rules/engine/reduce.ts";
import { effectsOf } from "../../rules/windows/listen.ts";

import { stageXWords, type StageStat } from "../words/stage-x.ts";

const STATS = [["threat", "Threat"], ["attack", "Attack"], ["defense", "Defense"]] as const;

// The amount keys a record may hold and still be "the stage number times N plus M": any other key (a divisor, a limit) changes the number, so the line says nothing.
const STAGE_KEYS = new Set(["stage", "times", "plus"]);

/** The preview line of a card in play with a stage-number stat, or null for any other card. */
export function stageXDetail(game: ScenarioState, ctx: ReduceContext, cardId: string): string | null {
  const card = game.cards[cardId];
  if (!card || !inPlay(card.zone) || card.face === "down") return null;
  const printed = printedOf(ctx.cards, card.code);
  const read = new Map<string, StageStat>();
  for (const effect of effectsOf(ctx, card.code)) {
    if (effect.timing !== "constant") continue;
    for (const instruction of effect.instructions) {
      if (instruction.verb !== "ModifyStat" || instruction.target !== "self") continue;
      const amount = instruction.amount;
      if (amount == null || typeof amount !== "object" || amount.stage !== true || !Object.keys(amount).every((key) => STAGE_KEYS.has(key))) continue;
      const stat = STATS.find(([key]) => key === instruction.stat);
      if (stat && printed[stat[0]] == null) read.set(stat[0], { name: stat[1], value: modifiedStat(game, card, stat[0], ctx.cards), times: amount.times ?? 1, plus: amount.plus ?? 0 });
    }
  }
  if (read.size === 0) return null;
  const stage = game.questStage ? game.cards[game.questStage] : undefined;
  return stageXWords([...read.values()], stage != null);
}
