import type { EngineStep, PlayerIntent, ReduceContext, ScenarioState } from "../rules/reduce.ts";
import { reduce } from "../rules/reduce.ts";
import { startScenario, type StartScenario } from "../rules/setup.ts";
import { ENGINE_VERSION } from "../rules/version.ts";

export { ENGINE_VERSION };

// The open scenario of a save. It is the seed and the intents sent so far, not the table. Loading replays them
// through the reducer from the start the log and the decks produce, so the state is never stored and cannot drift
// from the rules. brief: Save.
export type ActiveScenario = {
  engineVersion: number;
  // The catalog version (a hash of data/) the intents were played against.
  dataHash: number;
  seed: number;
  intents: PlayerIntent[];
};

export function beginActive(start: StartScenario, dataHash: number): ActiveScenario {
  return { engineVersion: ENGINE_VERSION, dataHash, seed: start.seed, intents: [] };
}

export function recordIntent(active: ActiveScenario, intent: PlayerIntent): ActiveScenario {
  return { ...active, intents: [...active.intents, intent] };
}

export type Replayed =
  | { ok: true; state: ScenarioState }
  | { ok: false; reason: "engineVersion" | "dataHash" | "seed" | "intent" };

// Sees each accepted intent of a replay: the state before, the state after, and the engine steps between them. The table
// uses it to rebuild the log of the round it reopens on.
export type ReplayObserver = (before: ScenarioState, after: ScenarioState, steps: readonly EngineStep[]) => void;

// Replays a save. A save from another engine version or another data hash is dropped, not migrated; the caller
// keeps the log, the decks and the image index. An intent the reducer now refuses also drops it.
export function replay(active: ActiveScenario, start: StartScenario, dataHash: number, ctx: ReduceContext, observe?: ReplayObserver): Replayed {
  if (active.engineVersion !== ENGINE_VERSION) return { ok: false, reason: "engineVersion" };
  if (active.dataHash !== dataHash) return { ok: false, reason: "dataHash" };
  if (active.seed !== start.seed) return { ok: false, reason: "seed" };
  let state = startScenario(start, ctx);
  for (const intent of active.intents) {
    const result = reduce(state, intent, ctx);
    if (!result.ok) return { ok: false, reason: "intent" };
    observe?.(state, result.state, result.steps);
    state = result.state;
  }
  return { ok: true, state };
}
