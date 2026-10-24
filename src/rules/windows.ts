import type { EngineStep } from "./intents.ts";
import type { Frame, FrameData, FrameName, ScenarioState } from "./state.ts";

export type FrameSpec = {
  frame: FrameName;
  cardId: string | null;
  seat: number;
  peril: boolean;
  data: FrameData;
};

export function topFrame(state: ScenarioState): Frame | undefined {
  return state.stack[state.stack.length - 1];
}

export function pushFrame(state: ScenarioState, spec: FrameSpec, steps: EngineStep[]): ScenarioState {
  const entry: Frame = { id: `f${state.frameSeq}`, ...spec, step: 0 };
  steps.push({ kind: "push", frame: spec.frame, cardId: spec.cardId, peril: spec.peril });
  return { ...state, frameSeq: state.frameSeq + 1, stack: [...state.stack, entry] };
}

export function popFrame(state: ScenarioState, steps: EngineStep[]): ScenarioState {
  const top = topFrame(state);
  if (!top) return state;
  steps.push({ kind: "pop", frame: top.frame, cardId: top.cardId, peril: top.peril });
  return { ...state, stack: state.stack.slice(0, -1) };
}

export function patchTop(state: ScenarioState, patch: { step?: number; data?: FrameData }): ScenarioState {
  const top = topFrame(state);
  if (!top) return state;
  return { ...state, stack: [...state.stack.slice(0, -1), { ...top, ...patch }] };
}

// A frame that runs to completion inside one call. A frame that must wait for a player
// is pushed with pushFrame and advanced by settle (see frames.ts).
export function withFrame(
  state: ScenarioState,
  frame: FrameName,
  cardId: string | null,
  peril: boolean,
  run: (state: ScenarioState) => ScenarioState,
  steps: EngineStep[],
): ScenarioState {
  const entered = pushFrame(state, { frame, cardId, seat: state.activeSeat, peril, data: { kind: "none" } }, steps);
  return popFrame(run(entered), steps);
}
