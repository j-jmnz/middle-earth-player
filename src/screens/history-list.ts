// What History shows (docs/design-system.md, History): the playthroughs or standalone games of one kind, each one entry with the
// runs it wrote, in the sections In progress and Finished, then the fold Archived. Pure. The runs come in the order
// they were written (run-store.ts listRuns), which breaks a tie between two with no time.
import type { RunKind, RunRecord } from "../campaign/runs";

/** When a run happened: its end, else its start; null when the store never knew either (a back-filled campaign win). */
export function whenOf(run: RunRecord): number | null {
  return run.endedAt ?? run.startedAt;
}

/** Newest first. A run with no time sorts below the ones with one, and the one written last comes first among equals. */
export function newestFirst(runs: readonly RunRecord[]): RunRecord[] {
  return runs
    .map((run, index) => ({ run, index }))
    .sort((a, b) => (whenOf(b.run) ?? -1) - (whenOf(a.run) ?? -1) || b.index - a.index)
    .map((entry) => entry.run);
}

export type RunGroup = { refId: string; runs: RunRecord[] };

/** Runs by the playthrough or game that wrote them: the one with the newest run first, each group's runs newest first. */
export function groupRuns(runs: readonly RunRecord[]): RunGroup[] {
  const sorted = newestFirst(runs);
  const groups = new Map<string, RunRecord[]>();
  for (const run of sorted) groups.set(run.refId, [...(groups.get(run.refId) ?? []), run]);
  return [...groups].map(([refId, list]) => ({ refId, runs: list }));
}

/** The earliest time any of a playthrough's runs knows, or null (a back-filled win has none). */
export function startedOf(runs: readonly RunRecord[]): number | null {
  const times = runs.flatMap((run) => [run.startedAt, run.endedAt]).filter((time) => time != null);
  return times.length > 0 ? Math.min(...times) : null;
}

/** The two sections that are always open, and the fold under them. */
export type OpenSection = "in-progress" | "finished";
export type FoldedSection = "archived";

/**
 * What the library list draws, flat: an open section's heading, a fold's header (with how many entries it holds), a playthrough or a
 * game with its runs.
 */
export type LibraryItem<S, G> =
  | { type: "heading"; id: string; section: OpenSection }
  | { type: "fold"; id: string; section: FoldedSection; count: number; folded: boolean }
  | { type: "save"; id: string; save: S; archived: boolean; runs: RunRecord[]; started: number | null }
  | { type: "game"; id: string; game: G; archived: boolean; run: RunRecord | null };

export type LibraryInput<S, G> = {
  kind: RunKind;
  // The open and the archived playthroughs and games, as the stores list them.
  saves: readonly S[];
  archivedSaves: readonly S[];
  games: readonly G[];
  archivedGames: readonly G[];
  runs: readonly RunRecord[];
  folded: (section: FoldedSection) => boolean;
  // A playthrough with every scenario won; a game still being played.
  finished: (save: S) => boolean;
  playing: (game: G) => boolean;
};

/**
 * The library one kind shows: In progress and Finished (each only when it holds something), then the fold Archived (only when it holds
 * something). A playthrough or game is listed whether or not it has a run; its runs attach by ref id, newest first. The runs of a ref
 * the stores no longer hold are not listed. A folded fold emits its header and nothing under it. Pure.
 */
export function libraryItems<S extends { id: string }, G extends { id: string }>(input: LibraryInput<S, G>): LibraryItem<S, G>[] {
  const { kind, folded } = input;
  const ofKind = input.runs.filter((run) => run.kind === kind);
  const byRef = new Map(groupRuns(ofKind).map((group) => [group.refId, group.runs]));

  const saveItems = (list: readonly S[], archived: boolean): LibraryItem<S, G>[] =>
    list.map((save) => {
      const runs = byRef.get(save.id) ?? [];
      return { type: "save", id: `save-${save.id}`, save, archived, runs, started: startedOf(runs) };
    });
  const gameItems = (list: readonly G[], archived: boolean): LibraryItem<S, G>[] => list.map((game) => ({ type: "game", id: `game-${game.id}`, game, archived, run: byRef.get(game.id)?.[0] ?? null }));
  const heading = (section: OpenSection, items: LibraryItem<S, G>[]): LibraryItem<S, G>[] => (items.length > 0 ? [{ type: "heading", id: `library-${section}`, section }, ...items] : []);
  const fold = (section: FoldedSection, items: LibraryItem<S, G>[]): LibraryItem<S, G>[] => {
    if (items.length === 0) return [];
    const isFolded = folded(section);
    return [{ type: "fold", id: `library-${section}`, section, count: items.length, folded: isFolded }, ...(isFolded ? [] : items)];
  };

  const campaign = kind === "campaign";
  const inProgress = campaign ? saveItems(input.saves.filter((save) => !input.finished(save)), false) : gameItems(input.games.filter(input.playing), false);
  const finished = campaign ? saveItems(input.saves.filter(input.finished), false) : gameItems(input.games.filter((game) => !input.playing(game)), false);
  const archived = campaign ? saveItems(input.archivedSaves, true) : gameItems(input.archivedGames, true);

  return [...heading("in-progress", inProgress), ...heading("finished", finished), ...fold("archived", archived)];
}
