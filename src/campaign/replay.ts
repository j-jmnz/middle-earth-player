import type { EngineStep, PlayerIntent, ReduceContext, ScenarioState } from "../rules/engine/reduce.ts";
import { reduce } from "../rules/engine/reduce.ts";
import { startScenario, type StartScenario } from "../rules/setup/setup.ts";
import { ENGINE_VERSION } from "../rules/engine/version.ts";
import { CATALOG_VERSION } from "../catalog/version.ts";

export { ENGINE_VERSION };

// The open scenario of a save. It is the seed and the intents sent so far, not the table. Loading replays them
// through the reducer from the start the log and the decks produce, so the state is never stored and cannot drift
// from the rules. brief: Save.
export type ActiveScenario = {
  engineVersion: number;
  // The catalog version (a hash of data/) the intents were played against. Kept for a save that has no `world`.
  dataHash: number;
  // The worldHash (world.ts) of the cards, scenario and records the game reads, which the table compares on open. Null for a save
  // dealt before it existed: it is current while its dataHash is the build's catalog version, and is stamped on open.
  world: number | null;
  seed: number;
  intents: PlayerIntent[];
  // When it was dealt (ms since the epoch), for the run history. A scenario dealt before phase 28b has none.
  startedAt?: number;
  // The ms the table was on screen with the app in the foreground (the run's playtime). A scenario played before it has none.
  activeMs?: number;
};

export function beginActive(start: StartScenario, world: number, startedAt?: number): ActiveScenario {
  return { engineVersion: ENGINE_VERSION, dataHash: CATALOG_VERSION, world, seed: start.seed, intents: [], ...(startedAt == null ? {} : { startedAt }) };
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

// Why an open game is not replayed as it stands: another engine version, or other data. `world` is the worldHash of the world the
// game opens on, or null where none is built (a list row): then only a save with no `world` is compared, on the catalog version.
export function staleReason(active: Pick<ActiveScenario, "engineVersion" | "dataHash" | "world">, world: number | null): "engineVersion" | "dataHash" | null {
  if (active.engineVersion !== ENGINE_VERSION) return "engineVersion";
  if (active.world == null) return active.dataHash === CATALOG_VERSION ? null : "dataHash";
  return world != null && world !== active.world ? "dataHash" : null;
}

// The game stamped with the world it is current on: a save from before `world` existed, on its first open.
export function stampedWorld(active: ActiveScenario, world: number): ActiveScenario {
  return active.world === world ? active : { ...active, world };
}

// Replays a save. A save from another engine version or another data hash is not replayed here: the caller asks the player to
// continue it or restart it (session.ts, continueFrom and the restarts); the log, the decks and the image index are never touched.
// An intent the reducer now refuses fails the replay the same way.
export function replay(active: ActiveScenario, start: StartScenario, world: number, ctx: ReduceContext, observe?: ReplayObserver): Replayed {
  const stale = staleReason(active, world);
  if (stale) return { ok: false, reason: stale };
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

// The state after the intents the current reducer accepts, and how many that was: a replay that stops at the first refused intent
// instead of failing. It checks no version and no hash; it is what Continue plays on a game a change reached (session.ts, continueFrom).
export type Accepted = { state: ScenarioState; accepted: number };

export function replayAccepted(active: Pick<ActiveScenario, "intents">, start: StartScenario, ctx: ReduceContext): Accepted {
  let state = startScenario(start, ctx);
  let accepted = 0;
  for (const intent of active.intents) {
    const result = reduce(state, intent, ctx);
    if (!result.ok) break;
    state = result.state;
    accepted += 1;
  }
  return { state, accepted };
}

// The open scenario as Continue keeps it: the first `accepted` intents, stamped with the engine version and the world it now
// plays on. The seed, when it was dealt and the foreground time stay.
export function restamped(active: ActiveScenario, accepted: number, world: number): ActiveScenario {
  return { ...active, engineVersion: ENGINE_VERSION, dataHash: CATALOG_VERSION, world, intents: active.intents.slice(0, accepted) };
}
