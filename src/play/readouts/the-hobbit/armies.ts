// Rules: hob.multiple-stages-in-play, hob.current-quest-stage, hob.battle, hob.siege (data/rules/entries.json); ledger lines 132076:B:1, 132076:B:2, 132077:B:2, 132077:B:3, 132078:B:2, 132078:B:3.
//
// The three stages of The Battle of Five Armies that are in play at once (docs/design-system-table.md, Cards, The Battle of Five Armies) as top-bar dials, one for each stage: its progress against its quest points, the current stage marked, the Battle or Siege it brings,
// and a warning while it holds no progress (its Forced effect at the end of the round, 132076:B:2, 132077:B:3, 132078:B:3). A tap on a dial shows the stage card. The engine decided every number (`armies`, the progress on each card); nothing here changes one. Empty in
// any other scenario and once stage 5 is reached. Pure, so a test reads it.
import { modifiedStat } from "../../../rules/core/keywords.ts";
import { stageComplete, stageHasNoProgress, stageKeyword, stageNumberOf } from "../../../rules/families/armies/stages.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import type { ReduceContext } from "../../../rules/engine/reduce.ts";

import type { TableDial } from "../dials.ts";

// What each stage does at the end of a round with no progress on it (its Forced effect, in words). Which stage, its number, its keyword and whether it is complete are the engine's answer (families/armies/stages.ts).
const EMPTY: Readonly<Record<string, string>> = {
  "132076": "each player discards 1 random card from his hand",
  "132077": "the first player adds the topmost enemy of the discard pile to the staging area",
  "132078": "each player discards all resources from his heroes",
};

/** The dials of the stages in play together, in quest order: "Stage 3" with its progress against its quest points. Empty with no stages in play together. */
export function armiesDials(game: ScenarioState, ctx: ReduceContext, nameOf: (code: string) => string): readonly TableDial[] {
  return (game.armies?.stages ?? []).flatMap((id): TableDial[] => {
    const card = game.cards[id];
    const empty = card ? EMPTY[card.code] : undefined;
    if (!card || empty == null) return [];
    const number = stageNumberOf(game, card.code);
    const keyword = stageKeyword(ctx, card.code);
    const points = modifiedStat(game, card, "questPoints", ctx.cards);
    const current = game.questStage === id;
    const note = [current ? "Current stage" : "", keyword ?? "", stageComplete(game, id, ctx.cards) ? "Complete" : `${points - card.progress} to go`].filter((part) => part !== "").join(", ");
    return [{
      id: `stage-${number}`,
      testID: `armies-stage-${number}`,
      label: `Stage ${number}`,
      name: `${nameOf(card.code)}, progress against its quest points${current ? ", the current stage" : ""}${keyword ? `, ${keyword}` : ""}:`,
      value: Math.min(card.progress, points),
      limit: points,
      goal: true,
      limitWords: `${points} quest points`,
      note,
      cardId: id,
      ...(stageHasNoProgress(game, id) ? { warn: { level: "near" as const, words: `No progress: at the end of the round ${empty}` } } : {}),
    }];
  });
}
