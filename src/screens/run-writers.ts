// The two places a run is written: a campaign scenario's end (the Resolution screen: a loss when it is closed, a win when it
// is confirmed) and a standalone game's end (its outcome screen). Both build the record from the engine's final state
// (src/campaign/runs.ts) and write it once; neither touches the campaign log.
import { eq } from "drizzle-orm";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import { campaignRunId, runOf, standaloneRunId, type RunRecord } from "../campaign/runs";
import type { Save } from "../campaign/save";
import type { StandaloneGame } from "../campaign/standalone";
import type { World } from "../campaign/world";
import { ENGINE_VERSION } from "../campaign/replay";
import type { ScenarioState } from "../play/store";
import { boxOf } from "./campaign-data";
import { writeRun } from "./run-store";
import { standaloneGames } from "./user-schema";

type UserDb<TRun> = BaseSQLiteDatabase<"sync", TRun>;

// The heroes as dealt, the Ring-bearer with the first seat's.
function dealtHeroes(seats: readonly { heroes: readonly string[] }[], ringBearer: string | null): string[][] {
  return seats.map((seat, index) => [...seat.heroes, ...(index === 0 && ringBearer && !seat.heroes.includes(ringBearer) ? [ringBearer] : [])]);
}

/**
 * Writes the run of a campaign scenario that ended. `before` is the save as the scenario left it (its open scenario and its
 * loadout are what the run reads), `after` the save `finish` returned: a win's reward is what its log newly earned, and a scenario
 * already on the log was won before and earns nothing again. Returns the run, or null while the scenario is still going.
 */
export function recordCampaignRun<TRun>(user: UserDb<TRun>, before: Save, after: Save, world: World, state: ScenarioState, now: number = Date.now()): RunRecord | null {
  const { active, loadout } = before;
  if (!active || !loadout) return null;
  const fresh = !before.log.completed.includes(state.scenarioId) && after.log.completed.includes(state.scenarioId);
  const run = runOf({
    id: campaignRunId(before.id, state.scenarioId, active.seed),
    kind: "campaign",
    refId: before.id,
    campaignId: before.campaignId,
    box: boxOf(state.scenarioId)?.id ?? before.campaignId,
    state,
    cards: world.cards,
    heroes: dealtHeroes(loadout.seats, loadout.ringBearer),
    reward: fresh ? (after.log.earned[state.scenarioId] ?? []) : null,
    startedAt: active.startedAt ?? null,
    endedAt: now,
    engineVersion: ENGINE_VERSION,
  });
  if (run) writeRun(user, run);
  return run;
}

/** Writes the run of a standalone game that ended. Its start is when it was dealt. */
export function recordStandaloneRun<TRun>(user: UserDb<TRun>, game: StandaloneGame, world: World, state: ScenarioState, now: number = Date.now()): RunRecord | null {
  const dealt = user.select({ createdAt: standaloneGames.createdAt }).from(standaloneGames).where(eq(standaloneGames.id, game.id)).get();
  const run = runOf({
    id: standaloneRunId(game.id),
    kind: "standalone",
    refId: game.id,
    campaignId: null,
    box: boxOf(game.scenarioId)?.id ?? game.campaignId,
    state,
    cards: world.cards,
    heroes: dealtHeroes(game.loadout?.seats ?? [], game.loadout?.ringBearer ?? null),
    reward: null,
    startedAt: dealt?.createdAt ?? null,
    endedAt: now,
    engineVersion: ENGINE_VERSION,
  });
  if (run) writeRun(user, run);
  return run;
}
