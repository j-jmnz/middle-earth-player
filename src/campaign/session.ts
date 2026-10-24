// Rules: ltp.campaign-log, rr.campaign-log, ltp.campaign-pool, rr.campaign-pool, ltp.campaign-setup-checklist
// (data/rules/entries.json). The life of the open scenario of a save: deal it from a briefing, replay it on load, write
// each intent as it commits, and at the end write the log (a win) or nothing (a loss). Pure.
import type { ReduceContext, ScenarioState } from "../rules/reduce.ts";
import { resolutionResult } from "../rules/resolution.ts";
import type { PlayerIntent } from "../rules/intents.ts";
import { ENGINE_VERSION } from "../rules/version.ts";

import { briefing, checklistPlan, startFor, type Briefing, type BriefingInput, type BriefingSeat } from "./briefing.ts";
import { applyResolution } from "./log.ts";
import { beginActive, recordIntent, replay, type ActiveScenario } from "./replay.ts";
import type { Save, StoredLoadout } from "./save.ts";
import type { World } from "./world.ts";

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
  };
}

export type DealResult = { ok: true; save: Save } | { ok: false; briefing: Briefing };

// Deals the scenario: the briefing must be dealable. The save gets the loadout and an open scenario with no intents; the
// log is not touched until the scenario is won. The caller keeps the result with a write.
export function deal(save: Save, world: World, loadout: StoredLoadout, seed: number, dataHash: number): DealResult {
  const input = inputOf(save, world, loadout);
  const result = briefing(input);
  if (!result.dealable) return { ok: false, briefing: result };
  const start = startFor(input, seed);
  return { ok: true, save: { ...save, loadout, active: beginActive(start, dataHash) } };
}

// An open scenario played on another engine version or against other data is not replayed. This needs no start.
export function staleReason(active: ActiveScenario, dataHash: number): "engineVersion" | "dataHash" | null {
  if (active.engineVersion !== ENGINE_VERSION) return "engineVersion";
  if (active.dataHash !== dataHash) return "dataHash";
  return null;
}

export type Resumed = { ok: true; state: ScenarioState } | { ok: false; reason: "none" | "engineVersion" | "dataHash" | "seed" | "intent" | "loadout" };

// Replays the open scenario. A save from another engine version or data hash is not rebuilt at all. The caller drops the
// scenario on any failure and keeps the log, the decks and the image index.
export function resume(save: Save, world: World, dataHash: number): Resumed {
  const { active, loadout } = save;
  if (!active || !loadout) return { ok: false, reason: "none" };
  const stale = staleReason(active, dataHash);
  if (stale) return { ok: false, reason: stale };
  let start;
  try {
    start = startFor(inputOf(save, world, loadout), active.seed);
  } catch {
    return { ok: false, reason: "loadout" };
  }
  const replayed = replay(active, start, dataHash, contextOf(world));
  return replayed.ok ? { ok: true, state: replayed.state } : { ok: false, reason: replayed.reason };
}

// Drops the open scenario and keeps everything else.
export function drop(save: Save): Save {
  return { ...save, active: null, loadout: null };
}

// Records one intent the reducer accepted on the open scenario.
export function record(save: Save, intent: PlayerIntent): Save {
  return save.active ? { ...save, active: recordIntent(save.active, intent) } : save;
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
  return { ...drop(save), log: applyResolution(plan.log, state.scenarioId, state, world.cards) };
}
