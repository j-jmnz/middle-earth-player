import type { EngineStep } from "./intents.ts";
import type { ScenarioState } from "./state.ts";

export function withFrame(
  state: ScenarioState,
  frame: string,
  cardId: string | null,
  peril: boolean,
  run: (state: ScenarioState) => ScenarioState,
  steps: EngineStep[],
): ScenarioState {
  steps.push({ kind: "push", frame, cardId, peril });
  const entered: ScenarioState = { ...state, stack: [...state.stack, { frame, cardId }] };
  const ran = run(entered);
  const popped: ScenarioState = { ...ran, stack: ran.stack.slice(0, -1) };
  steps.push({ kind: "pop", frame, cardId, peril });
  return popped;
}
