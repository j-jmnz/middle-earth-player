// Rules: ltp.campaign-log, rr.campaign-log, ltp.campaign-pool, rr.campaign-pool, ltp.campaign-setup-checklist
// (data/rules/entries.json). The life of the open scenario of a save: deal it from a briefing, replay it on load, write
// each intent as it commits, and at the end write the log (a win) or nothing (a loss). Pure.
import type { ReduceContext, ScenarioState } from "../rules/engine/reduce.ts";
import { resolutionResult } from "../rules/setup/resolution.ts";
import type { PlayerIntent } from "../rules/core/intents.ts";
import type { StartScenario } from "../rules/setup/setup.ts";

import { checkState, restoredState, STATE_VERSION, migrateState } from "../rules/engine/state-version.ts";

import { briefing, checklistPlan, startFor, type Briefing, type BriefingInput, type BriefingSeat } from "./briefing.ts";
import { applyResolution } from "./log.ts";
import { usableCheckpoint, type Checkpoint } from "./checkpoint.ts";
import { tableDigest } from "./digest.ts";
import { beginActive, dropLastIntent, fullChecks, oldBase, openingOf, rebased, recordIntent, replay, replayAccepted, restamped, stampedWorld, staleReason, type ActiveScenario, type Rebase, type ReplayObserver } from "./replay.ts";
import type { Save, StoredLoadout } from "./save.ts";
import { NO_COPY_LIMITS } from "./wilderland.ts";
import { dealtCodes, logCodes, worldHash, type World } from "./world.ts";

export function contextOf(world: World): ReduceContext {
  return { effects: world.effects, cards: world.cards };
}

function inputOf(save: Save, world: World, loadout: StoredLoadout): BriefingInput {
  const seats: BriefingSeat[] = loadout.seats.map((seat) => ({ deckId: seat.deckId, heroes: seat.heroes, deck: seat.deck }));
  return {
    world,
    log: save.log,
    seatCount: save.seatCount,
    seats,
    ringBearer: loadout.ringBearer,
    difficulty: loadout.difficulty,
    choices: loadout.choices,
    acceptPenalty: loadout.acceptPenalty,
    modeCard: loadout.modeCard,
  };
}

// The codes of a save's game: its log's and its loadout's. The cards a replay of it reads beyond the scenario's, and so what its world stamp covers (worldHash).
export function savedCodes(save: Pick<Save, "log">, loadout: StoredLoadout | null): string[] {
  return [...logCodes(save.log), ...dealtCodes(loadout)];
}

export type DealResult = { ok: true; save: Save } | { ok: false; briefing: Briefing };

// Deals the scenario: the briefing must be dealable. The save gets the loadout and an open scenario with no intents; the
// log is not touched until the scenario is won. The caller keeps the result with a write.
export function deal(save: Save, world: World, loadout: StoredLoadout, seed: number, startedAt?: number): DealResult {
  const input = inputOf(save, world, loadout);
  const result = briefing(input);
  if (!result.dealable) return { ok: false, briefing: result };
  const start = startFor(input, seed);
  return { ok: true, save: { ...save, loadout, active: beginActive(start, worldHash(world, savedCodes(save, loadout)), startedAt) } };
}

// `stamp` is the game to write once when the replay left it different from what was stored: a stale one that every move matched,
// restamped with the engine version and world it now plays on; a save from before the world stamp; a current one that had no checks.
// `at` on a failure is the index of the first intent a checked replay refused or did not match (it is absent for a game with no checks).
export type Resumed = { ok: true; state: ScenarioState; stamp: ActiveScenario | null } | { ok: false; reason: "none" | "engineVersion" | "dataHash" | "seed" | "intent" | "loadout"; at?: number };

// What a stored table must be for this game, for checkState: its scenario and its seat count.
function expectedOf(world: World, seatCount: number | undefined): { scenarioId: string; seatCount?: number } {
  return seatCount == null ? { scenarioId: world.scenario.id } : { scenarioId: world.scenario.id, seatCount };
}

// Replays an open game, a campaign save's scenario or a standalone game, from the start `startOf` builds for its seed (or, for a game rebased onto a
// checkpoint, from its base, which is checked when the engine, the world or the state version moved). A game current on this engine and world replays as it
// stands, with no digest, unless it has no checks: then the replay writes them, once. One from another engine version or world is replayed checked when it
// has checks: every move accepted and matching resumes it with no message, and the first that is not is reported (`at`). One with no checks to compare is not
// rebuilt at all. A start that no longer builds is reported as the loadout. A failure leaves the game as it is: the caller asks the player to continue it or restart it.
export function resumeFrom(active: ActiveScenario | null, startOf: ((seed: number) => StartScenario) | null, world: World, hash: number, observe?: ReplayObserver, seatCount?: number): Resumed {
  if (!active || (!startOf && !active.from)) return { ok: false, reason: "none" };
  const stale = staleReason(active, hash);
  if (stale && (active.intents.length === 0 || !fullChecks(active))) return { ok: false, reason: stale };
  const ctx = contextOf(world);
  const opening = openingOf(active, startOf, ctx);
  if ("reason" in opening) return { ok: false, reason: opening.reason === "loadout" ? "loadout" : (stale ?? "intent") };
  const { start, base } = opening;
  // A rebased game's base is checked against the engine when the engine, the world or the state version moved under it.
  const baseNeedsChecking = active.from != null && (stale != null || oldBase(active));
  if (baseNeedsChecking && checkState(base, ctx, expectedOf(world, seatCount)).length > 0) return { ok: false, reason: stale ?? "intent" };
  if (stale) {
    const checked = replayAccepted(active, base, ctx, observe);
    if (checked.at != null) return { ok: false, reason: stale, at: checked.at };
    return { ok: true, state: checked.state, stamp: restamped(active, checked.accepted, hash, checked.checks) };
  }
  const checks: number[] = [];
  const backfill = !fullChecks(active);
  const replayed = replay(active, start, hash, ctx, backfill ? (before, after, steps, intent) => {
    checks.push(tableDigest(after));
    observe?.(before, after, steps, intent);
  } : observe);
  if (!replayed.ok) return { ok: false, reason: replayed.reason };
  const stamped = stampedWorld(active, hash);
  const stamp = backfill ? { ...stamped, checks } : stamped;
  return { ok: true, state: replayed.state, stamp: stamp === active ? null : stamp };
}

// Replays the open scenario of a save. A failure leaves the save as it is (the log, the decks and the image index are never touched).
export function resume(save: Save, world: World, observe?: ReplayObserver): Resumed {
  const { loadout } = save;
  return resumeFrom(save.active, loadout ? (seed) => startFor(inputOf(save, world, loadout), seed) : null, world, worldHash(world, savedCodes(save, loadout)), observe, save.seatCount);
}

export type Continued<T> = { ok: true; holder: T; accepted: number; total: number; rebased: boolean } | { ok: false; reason: "none" | "loadout" };

// A checkpoint as a base the current engine can play: migrated to the current state version and checked against the world, or null when it fails either.
export function checkedCheckpoint(checkpoint: Checkpoint, world: World, seatCount?: number): Rebase | null {
  const migrated = migrateState(checkpoint.stateVersion, checkpoint.state);
  if (!migrated) return null;
  return checkState(restoredState(migrated), contextOf(world), expectedOf(world, seatCount)).length === 0 ? { stateVersion: STATE_VERSION, state: migrated } : null;
}

// Whether Continue would rebase onto the checkpoint: it is this deal's, was taken within the moves the game has, and passes the check.
export function continuesFromCheckpoint(active: ActiveScenario, checkpoint: Checkpoint | null, world: World, seatCount?: number): boolean {
  const usable = usableCheckpoint(checkpoint, active);
  return usable != null && checkedCheckpoint(usable, world, seatCount) != null;
}

// Continue: when the game has a checkpoint that passes the check, it migrates it, replays the moves after it on the current rules as far as each is accepted
// and matches its digest, and rebases the game onto it (`from`): Undo cannot go back past the checkpoint, and the table is the one the player left up to the first
// move that does not match. Otherwise it replays the game from its start (or base) as far as the reducer accepts its intents and, when the game has checks, as far as each
// move rebuilds the table the check saw, and keeps that prefix. Either way the game is stamped with the engine version and the world it now plays on, and
// whatever came after the first refused or unmatched move is gone. Pure: the caller writes the holder it gets back (the rebase and the checkpoint columns too).
export function continueFrom<T extends { active: ActiveScenario | null }>(holder: T, startOf: ((seed: number) => StartScenario) | null, world: World, hash: number, checkpoint: Checkpoint | null = null, seatCount?: number): Continued<T> {
  const { active } = holder;
  if (!active || (!startOf && !active.from)) return { ok: false, reason: "none" };
  const ctx = contextOf(world);
  const usable = usableCheckpoint(checkpoint, active);
  const from = usable ? checkedCheckpoint(usable, world, seatCount) : null;
  if (usable && from) {
    const after = { intents: active.intents.slice(usable.intentCount), ...(fullChecks(active) ? { checks: active.checks?.slice(usable.intentCount) } : {}) };
    const kept = replayAccepted(after, restoredState(from.state), ctx);
    const cut = { checkpointed: usable.intentCount, accepted: kept.accepted };
    return { ok: true, holder: { ...holder, active: rebased(active, from, cut, hash, kept.checks) }, accepted: usable.intentCount + kept.accepted, total: active.intents.length, rebased: true };
  }
  const opening = openingOf(active, startOf, ctx);
  if ("reason" in opening || (active.from && checkState(opening.base, ctx, expectedOf(world, seatCount)).length > 0)) return { ok: false, reason: "loadout" };
  const kept = replayAccepted(active, opening.base, ctx);
  return { ok: true, holder: { ...holder, active: { ...restamped(active, kept.accepted, hash, kept.checks), continued: true } }, accepted: kept.accepted, total: active.intents.length, rebased: false };
}

// Continue on a save's open scenario.
export function continueSave(save: Save, world: World, checkpoint: Checkpoint | null = null): Continued<Save> {
  const { loadout } = save;
  return continueFrom(save, loadout ? (seed) => startFor(inputOf(save, world, loadout), seed) : null, world, worldHash(world, savedCodes(save, loadout)), checkpoint, save.seatCount);
}

// Restart: deals the scenario again with the stored loadout and a new seed. The log and the decks stay, as they do on a drop.
export function restartSave(save: Save, world: World, seed: number, startedAt?: number): DealResult | { ok: false; briefing: null } {
  return save.loadout ? deal(save, world, save.loadout, seed, startedAt) : { ok: false, briefing: null };
}

// Drops the open scenario and keeps everything else.
export function drop(save: Save): Save {
  return { ...save, active: null, loadout: null };
}

// Records one intent the reducer accepted on the open game, a save's scenario or a standalone game, with the digest of the table it
// left (`state`, when the caller has it) when the game keeps checks. The one digest of a tap.
export function record<T extends { active: ActiveScenario | null }>(holder: T, intent: PlayerIntent, state?: ScenarioState): T {
  const { active } = holder;
  if (!active) return holder;
  return { ...holder, active: state && fullChecks(active) ? recordIntent(active, intent, tableDigest(state)) : recordIntent(active, intent) };
}

// Takes back the last intent of the open scenario (the table's Undo, brief: Rules engine).
export function unrecord<T extends { active: ActiveScenario | null }>(holder: T): T {
  return holder.active ? { ...holder, active: dropLastIntent(holder.active) } : holder;
}

export function isWon(state: ScenarioState): boolean {
  return resolutionResult(state) != null;
}

// Ends the open scenario. A loss writes nothing. A win writes the checklist's log and the Resolution's choices through
// applyResolution, which does not grant a scenario that is already on the log a second time.
export function finish(save: Save, world: World, state: ScenarioState): Save {
  const { loadout } = save;
  if (!loadout || state.lost || !isWon(state)) return drop(save);
  if (save.log.completed.includes(state.scenarioId)) return drop(save);
  const plan = checklistPlan(inputOf(save, world, loadout));
  return { ...drop(save), log: applyResolution(plan.log, state.scenarioId, state, world.cards, world.copies ?? NO_COPY_LIMITS) };
}
