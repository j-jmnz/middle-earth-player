// Rules: rr.the-word-choose, rr.effects (data/rules/entries.json). An effect that divides a total one token at a time among cards (Dark Covenant's progress, 08153's time counters): the chooser picks the card each time, a single card is taken
// without asking, and the rest of the total waits in a queued copy of the instruction (`left`).
import type { Instruction } from "../../../catalog/boundary.ts";

import { currentCause, UNATTRIBUTED } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ScenarioState } from "../../core/state.ts";
import { askTarget } from "../../windows/choices.ts";
import { effectData } from "../encounter/moves.ts";
import type { Focus } from "../index.ts";
import { queueFront } from "../play/refs.ts";

export interface OneAtATime {
  /** The instruction, with `left` set to the tokens still to place, as the queued copy carries it. */
  readonly instruction: Extract<Instruction, { verb: "RemoveTimeCounters" | "RemoveProgressAmong" }>;
  readonly left: number;
  /** Who chooses. */
  readonly seat: number;
  /** The cards the next token may come off. */
  readonly options: readonly string[];
  readonly focus: Focus;
  readonly steps: EngineStep[];
  /** Takes one token off the card. */
  readonly takeOne: (state: ScenarioState, id: string) => ScenarioState;
}

/** One token comes off the card the chooser picks among the options (asked when more than one), and the rest waits in a queued copy until none is left or no card holds one. */
export function distributeOneAtATime(state: ScenarioState, step: OneAtATime): ScenarioState {
  const { left, options, focus, seat } = step;
  if (left <= 0 || options.length === 0) return state;
  const chosen = focus.chosen && options.includes(focus.chosen) ? focus.chosen : options.length === 1 ? options[0] : undefined;
  const cause = currentCause(step.steps, UNATTRIBUTED);
  if (!chosen) return effectData(state) ? askTarget(state, { instruction: { ...step.instruction, left }, seat, chosen: null, cause }, [...options]) : state;
  const taken = step.takeOne(state, chosen);
  return left > 1 ? queueFront(taken, [{ instruction: { ...step.instruction, left: left - 1 }, seat, chosen: null, cause }]) : taken;
}
