// Rules: hob.current-quest-stage, hob.multiple-stages-in-play, rr.first-player (data/rules/entries.json).
// The first player's choice of the current quest stage at the start of each round of The Battle of Five Armies, on the live sheet (docs/design-system-table.md, Choice tray): the question says what the choice changes, and each row names a stage with the
// progress it holds now, the Battle or Siege it has and whether it is the current stage. One player's choice leads with "Player N:" two-handed. Pure.
import type { Instruction } from "../../../../catalog/boundary.ts";
import { modifiedStat } from "../../../../rules/core/keywords.ts";
import type { ScenarioState } from "../../../../rules/core/state.ts";
import { stageKeyword } from "../../../../rules/families/armies/stages.ts";
import type { ReduceContext } from "../../../../rules/interpret/interpret.ts";

import type { ChoiceNames } from "../../choice.ts";
import { seatSays } from "../../seat.ts";

type Choose = Extract<Instruction, { verb: "Choose" }>;

// The Choose the engine builds at the beginning of a round (families/armies/stages.ts askCurrentStage): one branch for each stage in play, each setting it as the current stage.
const isStageChoice = (choose: Choose): boolean => choose.options.length >= 2 && choose.options.every((option) => option.instructions[0]?.verb === "SetCurrentStage");

/** The sentence over the first player's choice of the current stage. Null for any other Choose. */
export function armiesChooseNote(choose: Choose, game: ScenarioState): string | null {
  if (!isStageChoice(choose)) return null;
  const { say } = seatSays(game);
  return say("choose the current quest stage for this round. Progress goes on that stage only, and a card effect that affects the current quest affects that stage only.");
}

/** What each stage of the choice holds now: "3 of 8 progress, Battle, the current stage". Empty for any other Choose. */
export function armiesBranchRows(game: ScenarioState, ctx: ReduceContext, choose: Choose): Readonly<Record<string, string>> {
  if (!isStageChoice(choose)) return {};
  return Object.fromEntries(
    choose.options.map((option): [string, string] => {
      const stage = game.cards[option.id];
      if (!stage) return [option.id, ""];
      const points = modifiedStat(game, stage, "questPoints", ctx.cards);
      const keyword = stageKeyword(ctx, stage.code);
      return [option.id, `${stage.progress} of ${points} progress${keyword ? `, ${keyword}` : ""}${game.questStage === option.id ? ", the current stage" : ""}`];
    }),
  );
}

/** The row of a stage of that choice: "Make Ruins of Dale the current stage (2 of 8 progress)". Null for another Choose. */
export function armiesBranchWords(choose: Choose, optionId: string, names: ChoiceNames, rows?: Readonly<Record<string, string>>): string | null {
  if (!isStageChoice(choose)) return null;
  const held = rows?.[optionId];
  return `Make ${names.card(optionId)} the current stage${held ? ` (${held})` : ""}`;
}
