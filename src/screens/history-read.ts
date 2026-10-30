// What History reads from the stores on focus: the runs, the open and archived playthroughs (each with the line that words it) and
// the open and archived standalone games.
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import type { RunRecord } from "../campaign/runs";
import { droppedIfStale, type ListedStandalone } from "../campaign/standalone";
import { CATALOG_VERSION } from "../catalog/version";
import { campaignOf } from "./campaign-data";
import { listArchivedSaves, listSaves, type ListedSave } from "./campaign-store";
import { listRuns } from "./run-store";
import { saveLine, type SaveLine } from "./save-panels";
import { listArchivedStandalone, listStandalone, writeStandaloneActive } from "./standalone-store";

type UserDb<TRun> = BaseSQLiteDatabase<"sync", TRun>;

/** A playthrough with the line that words it (its name, seats, progress and next step). */
export type LibrarySave = { id: string; save: ListedSave; line: SaveLine };

export type Library = { runs: RunRecord[]; saves: LibrarySave[]; archivedSaves: LibrarySave[]; games: ListedStandalone[]; archivedGames: ListedStandalone[] };

export const EMPTY_LIBRARY: Library = { runs: [], saves: [], archivedSaves: [], games: [], archivedGames: [] };

const worded = (save: ListedSave): LibrarySave => ({ id: save.id, save, line: saveLine(save, campaignOf(save.campaignId)?.name ?? save.campaignId) });

export function readLibrary<TRun>(user: UserDb<TRun>): Library {
  return {
    runs: listRuns(user),
    saves: listSaves(user).map(worded),
    archivedSaves: listArchivedSaves(user).map(worded),
    // A game in progress from another engine version or against other card data is dropped on the read, as the Scenarios hub does.
    games: listStandalone(user).map((game) => {
      const dropped = droppedIfStale(game, CATALOG_VERSION);
      if (!dropped) return game;
      writeStandaloneActive(user, dropped);
      return dropped;
    }),
    archivedGames: listArchivedStandalone(user),
  };
}
