import type { EngineStep, PlayerIntent } from "./intents.ts";
import type { ReduceContext } from "./interpret.ts";
import type { ScenarioState } from "./state.ts";

export type ReduceFn = (
  state: ScenarioState,
  intent: PlayerIntent,
  ctx: ReduceContext,
) => { ok: true; state: ScenarioState; steps: readonly EngineStep[] } | { ok: false; reason: string; state: ScenarioState };

let reduceFn: ReduceFn | null = null;

export function bindReduce(reduce: ReduceFn): void {
  reduceFn = reduce;
}

export function cloneGame(state: ScenarioState): ScenarioState {
  return structuredClone({
    ...state,
    cards: {},
    undo: { phase: state.phase, snapshot: null, cards: null, intents: [], steps: [] },
  });
}

export function noteHistory(
  before: ScenarioState,
  after: ScenarioState,
  intent: PlayerIntent,
  steps: readonly EngineStep[],
): ScenarioState {
  if (after.phase !== before.phase) {
    return {
      ...after,
      undo: {
        phase: after.phase,
        snapshot: cloneGame(after),
        cards: structuredClone(after.cards),
        intents: [],
        steps: [],
      },
    };
  }
  return {
    ...after,
    undo: {
      phase: after.phase,
      snapshot: before.undo.snapshot,
      cards: before.undo.cards,
      intents: [...before.undo.intents, intent],
      steps: [...before.undo.steps, steps],
    },
  };
}

export function replay(
  snapshot: ScenarioState,
  intents: readonly PlayerIntent[],
  ctx: ReduceContext,
  cards: ScenarioState["cards"],
): ScenarioState {
  if (!reduceFn) throw new Error("Replay is available after the reducer loads");
  let state: ScenarioState = { ...snapshot, cards: structuredClone(cards) };
  for (const intent of intents) {
    const result = reduceFn(state, intent, ctx);
    if (!result.ok) throw new Error(result.reason);
    state = result.state;
  }
  return state;
}
