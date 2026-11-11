import type { EngineStep, PlayerIntent, ReduceContext, ScenarioState } from "../rules/engine/reduce.ts";
import { reduce } from "../rules/engine/reduce.ts";
import { startScenario, type StartScenario } from "../rules/setup/setup.ts";
import { ENGINE_VERSION } from "../rules/engine/version.ts";
import { migrateState, restoredState, STATE_VERSION, type StoredState } from "../rules/engine/state-version.ts";
import { CATALOG_VERSION } from "../catalog/version.ts";
import { tableDigest } from "./digest.ts";

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
  // The tableDigest of the table after each intent, one for one with `intents` (digest.ts). A replay on another engine version or
  // other card data compares them move by move. Absent on a save that has none: a list of another length is read as none.
  checks?: number[];
  // The state a replay starts from when the game was rebased onto a checkpoint; absent for a game that replays from its seed.
  from?: Rebase;
  // When it was dealt (ms since the epoch), for the run history. A scenario dealt before phase 28b has none.
  startedAt?: number;
  // The ms the table was on screen with the app in the foreground (the run's playtime). A scenario played before it has none.
  activeMs?: number;
};

// The table a rebased game replays from, in place of the opening state its seed deals: a checkpoint the player chose to continue from after an update
// (session.ts, continueFrom). `intents` and `checks` then hold only the moves after it, and Undo cannot go back past it. It is kept in a column of its own
// (user-schema.ts, saves.rebase), never in the per-intent write.
export type Rebase = { stateVersion: number; state: StoredState };

export function beginActive(start: StartScenario, world: number, startedAt?: number): ActiveScenario {
  return { engineVersion: ENGINE_VERSION, dataHash: CATALOG_VERSION, world, seed: start.seed, intents: [], ...(startedAt == null ? {} : { startedAt }) };
}

// Whether `checks` has one digest for each intent, so a replay can compare them. A game with no intents has them trivially.
export function fullChecks(active: Pick<ActiveScenario, "intents" | "checks">): boolean {
  return (active.checks?.length ?? 0) === active.intents.length;
}

// Appends an intent and, when the save carries a digest for each intent so far, the digest of the table after it. A save that has no
// checks stays without (an open writes them once, session.ts resumeFrom).
export function recordIntent(active: ActiveScenario, intent: PlayerIntent, check?: number): ActiveScenario {
  const intents = [...active.intents, intent];
  return check !== undefined && fullChecks(active) ? { ...active, intents, checks: [...(active.checks ?? []), check] } : { ...active, intents };
}

// Adds the foreground ms the table counted since the last write; nothing to add leaves the scenario as it is.
export function addActive(active: ActiveScenario, ms: number): ActiveScenario {
  return ms > 0 ? { ...active, activeMs: (active.activeMs ?? 0) + ms } : active;
}

// Takes the last intent back (the table's Undo): replaying the rest gives the state before it.
// The last digest goes with it; checks that did not match the intents one for one are dropped.
export function dropLastIntent(active: ActiveScenario): ActiveScenario {
  const { checks, ...rest } = active;
  const intents = active.intents.slice(0, -1);
  if (!checks) return { ...rest, intents };
  return fullChecks(active) ? { ...rest, intents, checks: checks.slice(0, -1) } : { ...rest, intents };
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
  return worldChanged(active, world) ? "dataHash" : null;
}

// Whether the cards or the scenario the game was dealt on changed (the world stamp, or for a save without one the catalog version).
export function worldChanged(active: Pick<ActiveScenario, "dataHash" | "world">, world: number | null): boolean {
  if (active.world == null) return active.dataHash !== CATALOG_VERSION;
  return world != null && world !== active.world;
}

// The game stamped with the world it is current on: a save from before `world` existed, on its first open.
export function stampedWorld(active: ActiveScenario, world: number): ActiveScenario {
  return active.world === world ? active : { ...active, world };
}

// Replays a save. A save from another engine version or another data hash is not replayed here: the caller asks the player to
// continue it or restart it (session.ts, continueFrom and the restarts); the log, the decks and the image index are never touched.
// An intent the reducer now refuses fails the replay the same way.
export function replay(active: ActiveScenario, start: StartScenario | null, world: number, ctx: ReduceContext, observe?: ReplayObserver): Replayed {
  const stale = staleReason(active, world);
  if (stale) return { ok: false, reason: stale };
  if (start && !active.from && active.seed !== start.seed) return { ok: false, reason: "seed" };
  const base = baseOf(active, start, ctx);
  if (!base) return { ok: false, reason: "intent" };
  let state = base;
  for (const intent of active.intents) {
    const result = reduce(state, intent, ctx);
    if (!result.ok) return { ok: false, reason: "intent" };
    observe?.(state, result.state, result.steps, intent);
    state = result.state;
  }
  return { ok: true, state };
}

// The state after the intents the current reducer accepts, played from `initial` (baseOf), and the tableDigest after each, and how many that was: a replay that stops at
// the first intent it refuses or, when the save has a digest for each intent, whose table does not match its digest. `at` is that
// intent's index, or null when every intent was accepted and matched. It checks no version and no hash; it is the checked replay that
// lets a game another engine version reached resume with no message, and what Continue plays (session.ts, resumeFrom, continueFrom).
// The table a replay of the game starts from: its rebase (migrated to the current state version, so a game rebased under an older build still opens), or the
// opening state `start` deals. Null when there is neither, or the rebase's version is one this build does not know. It does not check the rebase (checkState).
export function baseOf(active: Pick<ActiveScenario, "from">, start: StartScenario | null, ctx: ReduceContext): ScenarioState | null {
  if (active.from) {
    const migrated = migrateState(active.from.stateVersion, active.from.state);
    return migrated ? restoredState(migrated) : null;
  }
  return start ? startScenario(start, ctx) : null;
}

export type Accepted = { state: ScenarioState; accepted: number; checks: number[]; at: number | null };

export function replayAccepted(active: Pick<ActiveScenario, "intents" | "checks">, initial: ScenarioState, ctx: ReduceContext, observe?: ReplayObserver): Accepted {
  const stored = fullChecks(active) ? active.checks : undefined;
  let state = initial;
  const checks: number[] = [];
  for (const [index, intent] of active.intents.entries()) {
    const result = reduce(state, intent, ctx);
    if (!result.ok) return { state, accepted: index, checks, at: index };
    const digest = tableDigest(result.state);
    if (stored && stored[index] !== digest) return { state, accepted: index, checks, at: index };
    observe?.(state, result.state, result.steps, intent);
    state = result.state;
    checks.push(digest);
  }
  return { state, accepted: checks.length, checks, at: null };
}

// The open scenario as Continue keeps it: the first `accepted` intents and their digests, stamped with the engine version and the world
// it now plays on. The seed, when it was dealt and the foreground time stay.
export function restamped(active: ActiveScenario, accepted: number, world: number, checks: readonly number[]): ActiveScenario {
  return { ...active, engineVersion: ENGINE_VERSION, dataHash: CATALOG_VERSION, world, intents: active.intents.slice(0, accepted), checks: checks.slice(0, accepted) };
}

// The open scenario as Continue rebases it onto a checkpoint: the checkpoint's state is the base, and the moves after its `intentCount` that were accepted
// and matched are what remains, with their digests, stamped with the engine version and the world it now plays on.
export function rebased(active: ActiveScenario, from: Rebase, intentCount: number, accepted: number, world: number, checks: readonly number[]): ActiveScenario {
  const { checks: _old, ...rest } = active;
  return { ...rest, engineVersion: ENGINE_VERSION, dataHash: CATALOG_VERSION, world, from, intents: active.intents.slice(intentCount, intentCount + accepted), checks: checks.slice(0, accepted) };
}

/** Whether the game's base needs checking against the engine before it is replayed: its stored version is not the current one. */
export function oldBase(active: Pick<ActiveScenario, "from">): boolean {
  return active.from != null && active.from.stateVersion !== STATE_VERSION;
}
