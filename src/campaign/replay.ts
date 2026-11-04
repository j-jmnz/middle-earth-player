import type { EngineStep, PlayerIntent, ReduceContext, ScenarioState } from "../rules/engine/reduce.ts";
import { reduce } from "../rules/engine/reduce.ts";
import { startScenario, type StartScenario } from "../rules/setup/setup.ts";
import { ENGINE_VERSION } from "../rules/engine/version.ts";

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
  // When it was dealt (ms since the epoch), for the run history. A scenario dealt before phase 28b has none.
  startedAt?: number;
  // The ms the table was on screen with the app in the foreground (the run's playtime). A scenario played before it has none.
  activeMs?: number;
};

export function beginActive(start: StartScenario, dataHash: number, startedAt?: number): ActiveScenario {
  return { engineVersion: ENGINE_VERSION, dataHash, seed: start.seed, intents: [], ...(startedAt == null ? {} : { startedAt }) };
}

export function recordIntent(active: ActiveScenario, intent: PlayerIntent): ActiveScenario {
  return { ...active, intents: [...active.intents, intent] };
}

// Adds the foreground ms the table counted since the last write; nothing to add leaves the scenario as it is.
export function addActive(active: ActiveScenario, ms: number): ActiveScenario {
  return ms > 0 ? { ...active, activeMs: (active.activeMs ?? 0) + ms } : active;
}

// Takes the last intent back (the table's Undo): replaying the rest gives the state before it.
export function dropLastIntent(active: ActiveScenario): ActiveScenario {
  return { ...active, intents: active.intents.slice(0, -1) };
}

export type Replayed =
  | { ok: true; state: ScenarioState }
  | { ok: false; reason: "engineVersion" | "dataHash" | "seed" | "intent" };

// Sees each accepted intent of a replay: the state before, the state after, the engine steps between them, and the intent.
// The table uses it to rebuild the log of the round it reopens on and what Undo can take back.
export type ReplayObserver = (before: ScenarioState, after: ScenarioState, steps: readonly EngineStep[], intent: PlayerIntent) => void;

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
    observe?.(state, result.state, result.steps, intent);
    state = result.state;
  }
  return { ok: true, state };
}
