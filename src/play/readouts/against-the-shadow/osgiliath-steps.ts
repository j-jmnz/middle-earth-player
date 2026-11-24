// Rules: ats.controlling-locations, ats.losing-control-of-locations (data/rules/entries.json).
// The control a player took or lost of an Osgiliath location in an intent of Assault on Osgiliath, kept with the round's steps the table holds. The engine moves a location into or out of a play area without a step, so the table writes the change it read from the states
// before and after the intent on its own copy of the intent's last step, as it does for the villager tokens (villager-steps.ts), and the log words them (log.ts). Nothing the engine returns, the save or the step log changes. Empty in any other scenario.
import type { EngineStep, ScenarioState } from "../../../rules/engine/reduce.ts";

import { controlChanges, type ControlChange } from "./osgiliath.ts";

/** A step with the control that changed in its intent, and the seats in the game (the words say "You" solo). */
export type ControlStep = EngineStep & { control?: { changes: readonly ControlChange[]; seatCount: number } };

/** The steps with the intent's last step stamped with the control that changed. The same steps when none changed. */
export function stampControl(steps: readonly EngineStep[], before: ScenarioState, after: ScenarioState): readonly EngineStep[] {
  const changes = controlChanges(before, after);
  if (changes.length === 0 || steps.length === 0) return steps;
  return steps.map((step, at): ControlStep => (at === steps.length - 1 ? { ...step, control: { changes, seatCount: after.seatCount } } : step));
}

/** The control a kept step carries: none when it was kept without it. */
export function controlOf(step: EngineStep): { changes: readonly ControlChange[]; seatCount: number } | null {
  return "control" in step && step.control != null ? (step.control as { changes: readonly ControlChange[]; seatCount: number }) : null;
}
