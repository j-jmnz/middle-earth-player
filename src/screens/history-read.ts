// What History reads from the stores on focus: the runs, the open and archived playthroughs (each with the line that words it) and
// the open and archived standalone games.
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import type { RunRecord } from "../campaign/runs";
import type { ListedStandalone } from "../campaign/standalone";
import { campaignOf } from "./campaign-data";
import { listArchivedSaves, listSaves, type ListedSave } from "./campaign-store";
import { listRuns } from "./run-store";
import { saveLine, type SaveLine } from "./save-line";
import { listArchivedStandalone, listStandaloneFresh } from "./standalone-store";

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
    games: listStandaloneFresh(user),
    archivedGames: listArchivedStandalone(user),
  };
}
