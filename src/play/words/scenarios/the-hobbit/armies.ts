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
  return say("choose the current quest stage for this round. Progress goes on that stage only. A stage with no progress at the end of the round applies its Forced effect. Cards are drawn next, so this cannot be undone.");
}

const QUESTS_WITH: Readonly<Record<"Battle" | "Siege", string>> = { Battle: "quest with Attack", Siege: "quest with Defense" };

/** What a stage brings and holds now: "Battle, quest with Attack. 3 of 8 progress, the current stage". */
function stageRow(game: ScenarioState, ctx: ReduceContext, id: string): string {
  const stage = game.cards[id];
  if (!stage) return "";
  const points = modifiedStat(game, stage, "questPoints", ctx.cards);
  // The keyword the stage prints (its record gives it while the stage is the current one), so a stage that is not current still tells what choosing it brings.
  const keyword = stageKeyword(ctx, stage.code);
  const brings = keyword ? `${keyword}, ${QUESTS_WITH[keyword]}. ` : "";
  return `${brings}${stage.progress} of ${points} progress${game.questStage === id ? ", the current stage" : ""}`;
}

/** What each stage of the start-of-round choice brings and holds now. Empty for any other Choose. */
export function armiesBranchRows(game: ScenarioState, ctx: ReduceContext, choose: Choose): Readonly<Record<string, string>> {
  return isStageChoice(choose) ? Object.fromEntries(choose.options.map((option): [string, string] => [option.id, stageRow(game, ctx, option.id)])) : {};
}

/** The row of a card Heedless of Order offers (ChooseCurrentQuest): a stage with what it brings and holds, a side quest named as one. Null for another instruction. */
export function armiesOptionLabel(instruction: Instruction, id: string, game: ScenarioState, ctx: ReduceContext, names: ChoiceNames): string | null {
  if (instruction.verb !== "ChooseCurrentQuest" || game.armies == null) return null;
  return `${names.card(id)}: ${game.armies.stages.includes(id) ? stageRow(game, ctx, id) : "a side quest"}`;
}

/** The row of a stage of that choice: "Battle in the Dale: Battle, quest with Attack. 2 of 8 progress". Null for another Choose. */
export function armiesBranchWords(choose: Choose, optionId: string, names: ChoiceNames, rows?: Readonly<Record<string, string>>): string | null {
  if (!isStageChoice(choose)) return null;
  const held = rows?.[optionId];
  return `${names.card(optionId)}${held ? `: ${held}` : ""}`;
}
