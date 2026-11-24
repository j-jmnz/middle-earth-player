// Rules: ats.villagers (data/rules/entries.json).
// The villager tokens that moved in an intent of Encounter at Amon Dîn, kept with the round's steps the table holds. The engine reports no step for a token that is placed, moved or discarded from a card's resources, so the table writes the changes it read from the
// states before and after the intent on its own copy of the intent's last step, as it does for the stat a quest step counted (counted.ts), and the log words them (log.ts). Nothing the engine returns, the save or the step log changes. Empty in any other scenario.
import type { EngineStep, ScenarioState } from "../../rules/engine/reduce.ts";

import { villagerChanges, type VillagerChange } from "../readouts/against-the-shadow/amon-din.ts";

/** A step with the villager tokens that changed in its intent. */
export type VillagerStep = EngineStep & { villagers?: readonly VillagerChange[] };

/** The steps with the intent's last step stamped with the villager tokens that changed. The same steps when none changed. */
export function stampVillagers(steps: readonly EngineStep[], before: ScenarioState, after: ScenarioState): readonly EngineStep[] {
  const changes = villagerChanges(before, after);
  if (changes.length === 0 || steps.length === 0) return steps;
  return steps.map((step, at): VillagerStep => (at === steps.length - 1 ? { ...step, villagers: changes } : step));
}

/** The villager tokens a kept step carries: none when it was kept without them. */
export function villagersOf(step: EngineStep): readonly VillagerChange[] {
  return "villagers" in step && Array.isArray(step.villagers) ? (step.villagers as readonly VillagerChange[]) : [];
}
