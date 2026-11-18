// Rules: rr.delayed-effects (data/rules/entries.json).
import type { Instruction } from "../../catalog/boundary.ts";

import type { Cause } from "../core/cause.ts";
import { pushEffectFrame } from "../interpret/effect-frames.ts";
import { lastPicked } from "../interpret/player-verbs.ts";
import type { EngineStep } from "../core/intents.ts";
import type { ReduceContext } from "../interpret/interpret.ts";
import type { ScenarioState } from "../core/state.ts";
import type { VerbFocus } from "../interpret/verbs.ts";

type DelayInstruction = Extract<Instruction, { verb: "Delay" }>;

// Records instructions to run when the current phase or round ends. Plain data in ScenarioState.
export function scheduleDelayed(
  state: ScenarioState,
  instruction: DelayInstruction,
  focus: VerbFocus,
  _ctx: ReduceContext,
  cause: Cause,
): ScenarioState {
  const entry = {
    id: `d${state.delayed.length}:${state.round}`,
    until: instruction.until,
    sourceId: focus.sourceId,
    seat: focus.seat,
    phase: state.phase,
    instructions: instruction.instructions,
    uncancelable: instruction.uncancelable ?? null,
    cause,
    ...(instruction.subject === "picked" && lastPicked(state) ? { subjectId: lastPicked(state) } : {}),
  };
  return { ...state, delayed: [...state.delayed, entry] };
}

// Delayed effects that come due when `ended` finishes. An end-of-round effect comes due when the
// End of round phase finishes.
function due(state: ScenarioState, ended: string, until: "endOfPhase" | "endOfRound" | "startOfGame" | "beginningOfTravel") {
  return state.delayed.filter((entry) =>
    until === "endOfPhase"
      ? entry.until === "endOfPhase" && entry.phase === ended
      : until === "startOfGame" || until === "beginningOfTravel"
        ? entry.until === until
        : entry.until === "endOfRound" && ended === "End of round",
  );
}

// Pushes one frame per due entry and drops them from the list. The first entry resolves first.
export function pushDue(
  state: ScenarioState,
  ended: string,
  until: "endOfPhase" | "endOfRound" | "startOfGame" | "beginningOfTravel",
  steps: EngineStep[],
): ScenarioState {
  const entries = due(state, ended, until);
  if (entries.length === 0) return state;
  let next: ScenarioState = { ...state, delayed: state.delayed.filter((entry) => !entries.includes(entry)) };
  for (const entry of [...entries].reverse()) {
    next = pushEffectFrame(
      next,
      {
        frame: "delayed",
        sourceId: entry.sourceId,
        actor: entry.seat,
        peril: false,
        effectId: entry.id,
        instructions: entry.instructions,
        cancel: null,
        blockCancel: entry.uncancelable,
        ...(entry.subjectId ? { picked: [entry.subjectId] } : {}),
        ...(entry.cause ? { cause: entry.cause } : {}),
      },
      steps,
    );
  }
  return next;
}
