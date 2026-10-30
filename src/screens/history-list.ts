// What History shows (phase 28b): the runs filtered, sorted newest first and, for a campaign, grouped under their playthrough, and the
// library of playthroughs and games they sit in. Pure. The runs come in the order they were written (run-store.ts listRuns), which breaks a tie between two with no time.
import type { RunKind, RunRecord, RunResult } from "../campaign/runs";

export type RunFilter = {
  // A campaign id (campaign kind) or a box id (standalone kind); null for all.
  scope: string | null;
  result: RunResult | null;
};

export const NO_FILTER: RunFilter = { scope: null, result: null };

/** When a run happened: its end, else its start; null when the store never knew either (a back-filled campaign win). */
export function whenOf(run: RunRecord): number | null {
  return run.endedAt ?? run.startedAt;
}

/** What a run is filtered by: a campaign's id for a campaign run, the box's for a standalone one. */
export function scopeOf(run: RunRecord): string {
  return run.kind === "campaign" ? (run.campaignId ?? run.box) : run.box;
}

/** The runs of one kind that pass the filter, in the order they were given. */
export function filterRuns(runs: readonly RunRecord[], kind: RunKind, filter: RunFilter): RunRecord[] {
  return runs.filter((run) => run.kind === kind && (filter.scope == null || scopeOf(run) === filter.scope) && (filter.result == null || run.result === filter.result));
}

/** The scopes the runs of one kind span, in the order they first appear: the choices of the filter. */
export function scopesOf(runs: readonly RunRecord[], kind: RunKind): string[] {
  return [...new Set(runs.filter((run) => run.kind === kind).map(scopeOf))];
}

/** Newest first. A run with no time sorts below the ones with one, and the one written last comes first among equals. */
export function newestFirst(runs: readonly RunRecord[]): RunRecord[] {
  return runs
    .map((run, index) => ({ run, index }))
    .sort((a, b) => (whenOf(b.run) ?? -1) - (whenOf(a.run) ?? -1) || b.index - a.index)
    .map((entry) => entry.run);
}

export type RunGroup = { refId: string; runs: RunRecord[] };

/** Campaign runs by playthrough: the playthrough with the newest run first, each group's runs newest first. */
export function groupRuns(runs: readonly RunRecord[]): RunGroup[] {
  const sorted = newestFirst(runs);
  const groups = new Map<string, RunRecord[]>();
  for (const run of sorted) groups.set(run.refId, [...(groups.get(run.refId) ?? []), run]);
  return [...groups].map(([refId, list]) => ({ refId, runs: list }));
}

export type LibrarySection = "in-progress" | "finished" | "archived" | "deleted";

/** The fold of a playthrough's runs in History (a viewing's state; `history-<ref id>`). */
export const foldIdOf = (refId: string): string => `history-${refId}`;

/**
 * What the library list draws, flat: a heading for a section, a playthrough (its runs follow unless it is folded) or a standalone game
 * (its run, if it has one, inline), a deleted playthrough's header, and a run. `deleted` is a run whose playthrough or game is gone.
 */
export type LibraryItem<S, G> =
  | { type: "section"; id: string; section: LibrarySection }
  | { type: "save"; id: string; save: S; section: LibrarySection; runs: RunRecord[]; started: number | null; folded: boolean }
  | { type: "game"; id: string; game: G; section: LibrarySection; run: RunRecord | null }
  | { type: "gone"; id: string; group: RunGroup; folded: boolean }
  | { type: "run"; id: string; run: RunRecord; deleted: boolean };

export type LibraryInput<S, G> = {
  kind: RunKind;
  // The open and the archived playthroughs and games, as the stores list them.
  saves: readonly S[];
  archivedSaves: readonly S[];
  games: readonly G[];
  archivedGames: readonly G[];
  runs: readonly RunRecord[];
  filter: RunFilter;
  folded: (foldId: string) => boolean;
  // A playthrough with every scenario won; a game still being played.
  finished: (save: S) => boolean;
  playing: (game: G) => boolean;
};

const runsByRef = (runs: readonly RunRecord[]): Map<string, RunRecord[]> => new Map(groupRuns(runs).map((group) => [group.refId, group.runs]));

/**
 * The library one kind shows: In progress, Finished, Archived (each only when it holds something) and Deleted. A playthrough or game is
 * listed whether or not it has a run; its runs attach by ref id. A filter keeps only the refs with a matching run, and the runs it
 * leaves out never appear. The runs of a ref the stores no longer hold go under Deleted, a playthrough's grouped, a game's flat. A
 * folded playthrough emits no run items. Pure.
 */
export function libraryItems<S extends { id: string }, G extends { id: string }>(input: LibraryInput<S, G>): LibraryItem<S, G>[] {
  const { kind, runs, filter, folded } = input;
  const filtering = filter.scope != null || filter.result != null;
  const shown = runsByRef(filterRuns(runs, kind, filter));
  const every = runsByRef(runs.filter((run) => run.kind === kind));
  // A save's id and a game's never meet in one kind, so one set names every ref the stores hold.
  const known = new Set([...input.saves, ...input.archivedSaves, ...input.games, ...input.archivedGames].map((ref) => ref.id));

  const saveItems = (list: readonly S[], section: LibrarySection): LibraryItem<S, G>[] =>
    list.flatMap((save): LibraryItem<S, G>[] => {
      const own = shown.get(save.id) ?? [];
      if (filtering && own.length === 0) return [];
      const id = foldIdOf(save.id);
      const isFolded = folded(id);
      return [{ type: "save", id, save, section, runs: own, started: startedOf(every.get(save.id) ?? []), folded: isFolded }, ...(isFolded ? [] : own.map((run): LibraryItem<S, G> => ({ type: "run", id: `run-${run.id}`, run, deleted: false })))];
    });
  const gameItems = (list: readonly G[], section: LibrarySection): LibraryItem<S, G>[] =>
    list.flatMap((game): LibraryItem<S, G>[] => {
      const run = shown.get(game.id)?.[0] ?? null;
      return filtering && !run ? [] : [{ type: "game", id: `game-${game.id}`, game, section, run }];
    });
  const under = (section: LibrarySection, items: LibraryItem<S, G>[]): LibraryItem<S, G>[] => (items.length > 0 ? [{ type: "section", id: `library-${section}`, section }, ...items] : []);

  const campaign = kind === "campaign";
  const inProgress = campaign ? saveItems(input.saves.filter((save) => !input.finished(save)), "in-progress") : gameItems(input.games.filter(input.playing), "in-progress");
  const finished = campaign ? saveItems(input.saves.filter(input.finished), "finished") : gameItems(input.games.filter((game) => !input.playing(game)), "finished");
  const archived = campaign ? saveItems(input.archivedSaves, "archived") : gameItems(input.archivedGames, "archived");

  // The runs of no listed ref: a deleted playthrough or game.
  const orphans = filterRuns(runs, kind, filter).filter((run) => !known.has(run.refId));
  const gone = campaign
    ? groupRuns(orphans).flatMap((group): LibraryItem<S, G>[] => {
        const id = foldIdOf(group.refId);
        const isFolded = folded(id);
        return [{ type: "gone", id, group, folded: isFolded }, ...(isFolded ? [] : group.runs.map((run): LibraryItem<S, G> => ({ type: "run", id: `run-${run.id}`, run, deleted: true })))];
      })
    : newestFirst(orphans).map((run): LibraryItem<S, G> => ({ type: "run", id: `run-${run.id}`, run, deleted: true }));
  return [...under("in-progress", inProgress), ...under("finished", finished), ...under("archived", archived), ...under("deleted", gone)];
}

/** The earliest time any of a playthrough's runs knows, or null (a back-filled win has none). */
export function startedOf(runs: readonly RunRecord[]): number | null {
  const times = runs.flatMap((run) => [run.startedAt, run.endedAt]).filter((time) => time != null);
  return times.length > 0 ? Math.min(...times) : null;
}
