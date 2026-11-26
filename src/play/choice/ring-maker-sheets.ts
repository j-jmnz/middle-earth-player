// Rules: rm.time-x, rr.forced (data/rules/entries.json); ledger lines 07022:A:1, 07059:B:2, 07060:B:3, 07061:B:2, 07038:A:1, 07039:A:1, 07055:A:2, 07063:B:2, 07064:B:2, 07065:B:2, 07066:B:2, 07067:B:2.
// What the time row of Down from the Hills says before the tap (the Choose of 07022:whenRevealed:1): the counters left now and after it, and, when the counters the players still to choose can take reach the last one, what that last counter does on the stage.
// The engine decided every number (the counters on the quest, the Choose still to come in the effect's queue); nothing here changes one.
import type { Instruction } from "../../catalog/boundary.ts";
import type { ScenarioState } from "../../rules/engine/reduce.ts";
import { newLevels } from "../readouts/ring-maker/fords.ts";
import { lastCounterWords } from "../words/scenarios/ring-maker/fords-table.ts";

type Choose = Extract<Instruction, { verb: "Choose" }>;

// Whether this Choose has the row that takes a time counter off the current quest.
const takesTime = (choose: Choose, optionId: string): boolean => choose.options.find((option) => option.id === optionId)?.instructions.some((step) => step.verb === "RemoveTimeFromQuest") === true;

// The players that still choose, the one asking now included: the time rows still in the queue of the running effect and the one being asked.
function choosersLeft(game: ScenarioState): number {
  const top = game.stack.at(-1)?.data;
  if (top?.kind !== "effect") return 1;
  const queued = top.queue.filter((item) => item.instruction.verb === "Choose" && item.instruction.options.some((option) => option.instructions.some((step) => step.verb === "RemoveTimeFromQuest"))).length;
  const asking = top.wait?.kind === "branch" ? top.wait.item : null;
  return Math.max(1, queued + (asking != null && !top.queue.includes(asking) ? 1 : 0));
}

function stageOf(game: ScenarioState): { code: string; left: number } | null {
  const stage = game.questStage ? game.cards[game.questStage] : undefined;
  return stage && lastCounterWords(stage.code) != null ? { code: stage.code, left: stage.resources } : null;
}

/** The count on the time row: "2 left, 1 after" (null for another row or when the stage holds no counter). */
export function fordsTimeCount(game: ScenarioState, choose: Choose, optionId: string): string | null {
  const stage = takesTime(choose, optionId) ? stageOf(game) : null;
  return stage && stage.left > 0 ? `${stage.left} left, ${stage.left - 1} after` : null;
}

/** "Tap again: the last time counter comes off, Gríma is discarded and the players lose." when the tap, or the players still to choose, can take the last counter; null otherwise. */
export function fordsTimeCaution(game: ScenarioState, choose: Choose, optionId: string): string | null {
  const stage = takesTime(choose, optionId) ? stageOf(game) : null;
  if (!stage || stage.left <= 0 || stage.left > choosersLeft(game)) return null;
  const last = lastCounterWords(stage.code, newLevels(game)) ?? "";
  return stage.left === 1 ? `Tap again: the last time counter comes off, ${last}` : `Tap again: ${stage.left} counters are left, and the players still to choose can take them all. With the last counter gone, ${last}`;
}

/** A row's label with its count after it: "Remove 1 time counter from the current quest (2 left, 1 after)"; the label as it is when there is no count. */
export const withCount = (label: string | undefined, count: string | null): string | undefined => (label != null && count != null ? `${label} (${count})` : label);
