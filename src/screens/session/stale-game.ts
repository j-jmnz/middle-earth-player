// What the campaign and the standalone sessions share when an open game's engine version or world moved (docs/brief.md, Persistence and shipping): the world a
// choice loads, what the stale open reports, and the two choices of the sheet, Continue and Restart. The writers and the rules calls are the caller's. Pure of React.
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import { staleChanges } from "../../campaign/changes";
import type { Checkpoint } from "../../campaign/checkpoint";
import type { ActiveScenario } from "../../campaign/replay";
import { continuesFromCheckpoint, type Continued } from "../../campaign/session";
import { loadWorld, worldHash, type World } from "../../campaign/world";
import { EFFECTS } from "../../effects";

import { campaignOf, scenarioOf } from "../data/campaign-data";
import { CANNOT_CONTINUE, MISSING_GAME, restartProblems, type StaleChoice } from "./stale-words";

/** What a stale open reports besides its reason (TableSession, StandaloneSession): what changed under the game, and what Continue would do. `at` is the index a checked replay stopped at, or null when nothing was compared. */
export type StaleFields = { changes: readonly string[]; takenBack: number | null; fromCheckpoint: boolean };

export function staleFields(active: ActiveScenario, scenarioId: string, world: World, codes: readonly string[], at: number | null, checkpoint: Checkpoint | null, seatCount: number | undefined): StaleFields {
  return {
    changes: staleChanges(active, scenarioId, worldHash(world, codes)),
    takenBack: at == null ? null : active.intents.length - at,
    fromCheckpoint: continuesFromCheckpoint(active, checkpoint, world, seatCount),
  };
}

/** The world of an open game, or null when its campaign or scenario is not in the build or its cards do not load. */
export function gameWorld<TCatalog>(catalog: BaseSQLiteDatabase<"sync", TCatalog>, campaignId: string, scenarioId: string | undefined, codes: readonly string[]): World | null {
  const campaign = campaignOf(campaignId);
  const scenario = scenarioId ? scenarioOf(scenarioId) : null;
  if (!campaign || !scenario) return null;
  try {
    return loadWorld(catalog, campaign, scenario, EFFECTS, codes);
  } catch {
    return null;
  }
}

/** Continue on a game read now: `run` replays it on the new rules (rebased or cut back) and `write` stores what comes back, in one statement. */
export function continueChoice<H>(game: H | null, world: World | null, run: (game: H, world: World) => Continued<H>, write: (held: H) => void): StaleChoice {
  if (!game || !world) return { ok: false, message: MISSING_GAME };
  const continued = run(game, world);
  if (!continued.ok) return { ok: false, message: CANNOT_CONTINUE };
  write(continued.holder);
  return { ok: true };
}

/** What a deal gives back for a Restart: the dealt game, or the briefing's problems (null when the game has no loadout to deal). */
export type Dealt<H> = { ok: true; holder: H } | { ok: false; problems: readonly { message: string }[] | null };

/** Restart on a game read now: `run` deals it again and `write` stores the new deal, in one statement. */
export function restartChoice<H>(game: H | null, world: World | null, run: (game: H, world: World) => Dealt<H>, write: (held: H) => void): StaleChoice {
  if (!game || !world) return { ok: false, message: MISSING_GAME };
  const dealt = run(game, world);
  if (!dealt.ok) return { ok: false, message: restartProblems(dealt.problems) };
  write(dealt.holder);
  return { ok: true };
}
