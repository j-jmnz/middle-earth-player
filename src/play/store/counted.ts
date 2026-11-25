// Rules: hon.battle, hon.siege (data/rules/entries.json).
// The stat a quest step counted, kept with the round's steps the table holds. The engine's quest step carries only the total (`willpower`), whatever the stat was, and the stage that counted it may be gone by the time the log is read (a Response removed it, a victory
// point turned its Siege into Battle). So the table writes the stat on its own copy of the quest step when the intent is accepted, read from the state before the intent, as the banner reads it (momentOf). Nothing the engine returns, the save or the step log changes; a line
// kept without the stat (a step list that did not pass here) is worded without one in the log (log.ts).
import type { EngineStep, ReduceContext, ScenarioState } from "../../rules/engine/reduce.ts";

import { questStatNow, type QuestStat } from "../phases/quest-stat.ts";

/** A quest step with the stat it counted. */
export type CountedStep = EngineStep & { counted?: QuestStat };

/** The steps with each quest step stamped with the stat the quest counted before the intent. The same steps when none is a quest step. */
export function stampCounted(steps: readonly EngineStep[], before: ScenarioState, ctx: ReduceContext | undefined): readonly EngineStep[] {
  if (!ctx || !steps.some((step) => step.kind === "quest")) return steps;
  const counted = questStatNow(before, ctx);
  return steps.map((step): CountedStep => (step.kind === "quest" ? { ...step, counted } : step));
}

/** The stat a kept quest step counted, or null when it was kept without one. */
export function countedOf(step: EngineStep): QuestStat | null {
  return step.kind === "quest" && "counted" in step && typeof step.counted === "string" ? (step.counted as QuestStat) : null;
}
