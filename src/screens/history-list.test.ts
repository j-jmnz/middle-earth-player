// History: the list sorts, groups and filters.
import { describe, expect, it } from "vitest";

import type { RunRecord } from "../campaign/runs";
import { filterRuns, groupRuns, libraryItems, newestFirst, scopesOf, startedOf, type LibraryInput, type LibraryItem } from "./history-list";
import { courseWords, emptyWords, playthroughWords, resultWords, runDate, scoreWords, seatsWords } from "./history-words";

function run(id: string, overrides: Partial<RunRecord> = {}): RunRecord {
  return { id, kind: "campaign", refId: "save-a", campaignId: "fellowship-of-the-ring", box: "fellowship-of-the-ring", scenarioId: "a-shadow-of-the-past", result: "won", lossCause: null, seatCount: 1, heroes: [["141002"]], rounds: 4, threats: [30], victoryPoints: 0, score: 44, reward: null, startedAt: null, endedAt: 100, engineVersion: 6, backfilled: false, ...overrides };
}

describe("history list", () => {
  const runs = [
    run("a", { endedAt: 100 }),
    run("b", { endedAt: 300, result: "lost", lossCause: "Threat reached 50", score: null }),
    run("c", { endedAt: 200, refId: "save-b", campaignId: "mirkwood-paths", box: "revised-core" }),
    run("d", { kind: "standalone", refId: "game-1", campaignId: null, endedAt: 250, box: "revised-core" }),
    run("e", { kind: "standalone", refId: "game-2", campaignId: null, endedAt: null, startedAt: null, box: "fellowship-of-the-ring", backfilled: true }),
    run("f", { kind: "standalone", refId: "game-3", campaignId: null, endedAt: null, startedAt: null, box: "fellowship-of-the-ring", backfilled: true }),
  ];

  it("sorts newest first; a run with no time sorts last and the one written later first", () => {
    expect(newestFirst(runs).map((item) => item.id)).toEqual(["b", "d", "c", "a", "f", "e"]);
  });

  it("filters by kind, by campaign or box, and by result", () => {
    expect(filterRuns(runs, "campaign", { scope: null, result: null }).map((item) => item.id)).toEqual(["a", "b", "c"]);
    expect(filterRuns(runs, "campaign", { scope: "mirkwood-paths", result: null }).map((item) => item.id)).toEqual(["c"]);
    expect(filterRuns(runs, "campaign", { scope: null, result: "lost" }).map((item) => item.id)).toEqual(["b"]);
    expect(filterRuns(runs, "standalone", { scope: "revised-core", result: null }).map((item) => item.id)).toEqual(["d"]);
    expect(filterRuns(runs, "standalone", { scope: "revised-core", result: "lost" })).toEqual([]);
    expect(scopesOf(runs, "campaign")).toEqual(["fellowship-of-the-ring", "mirkwood-paths"]);
    expect(scopesOf(runs, "standalone")).toEqual(["revised-core", "fellowship-of-the-ring"]);
  });

  it("groups campaign runs under their playthrough, the one with the newest run first, each newest first", () => {
    const groups = groupRuns(filterRuns(runs, "campaign", { scope: null, result: null }));
    expect(groups.map((group) => [group.refId, group.runs.map((item) => item.id)])).toEqual([
      ["save-a", ["b", "a"]],
      ["save-b", ["c"]],
    ]);
  });
});

type Save = { id: string; done: boolean };
type Game = { id: string; playing: boolean };
const save = (id: string, done = false): Save => ({ id, done });
const game = (id: string, playing = false): Game => ({ id, playing });

function library(input: Partial<LibraryInput<Save, Game>> & { runs: RunRecord[] }): LibraryItem<Save, Game>[] {
  return libraryItems<Save, Game>({
    kind: "campaign",
    saves: [],
    archivedSaves: [],
    games: [],
    archivedGames: [],
    filter: { scope: null, result: null },
    folded: () => false,
    finished: (item) => item.done,
    playing: (item) => item.playing,
    ...input,
  });
}
const words = (items: LibraryItem<Save, Game>[]) => items.map((item) => `${item.type}:${item.id}`);

describe("library items", () => {
  const runs = [run("a", { endedAt: 100 }), run("b", { endedAt: 300 }), run("c", { endedAt: 200, refId: "save-b" })];

  it("sorts the playthroughs into In progress, Finished and Archived, a heading only for a section that holds something", () => {
    const items = library({ saves: [save("save-a"), save("save-b", true)], archivedSaves: [save("save-c")], runs });
    expect(words(items)).toEqual([
      "section:library-in-progress",
      "save:history-save-a",
      "run:run-b",
      "run:run-a",
      "section:library-finished",
      "save:history-save-b",
      "run:run-c",
      "section:library-archived",
      "save:history-save-c",
    ]);
    expect(words(library({ saves: [save("save-a")], runs: [] }))).toEqual(["section:library-in-progress", "save:history-save-a"]);
    expect(library({ runs: [] })).toEqual([]);
  });

  it("a folded playthrough emits its header and no runs", () => {
    const items = library({ saves: [save("save-a"), save("save-b")], runs, folded: (id) => id === "history-save-a" });
    expect(words(items)).toEqual(["section:library-in-progress", "save:history-save-a", "save:history-save-b", "run:run-c"]);
  });

  it("a playthrough with no run is listed with its count and start from the runs it has", () => {
    const [, first] = library({ saves: [save("save-a")], runs: [run("a", { startedAt: 50, endedAt: 100 })] });
    expect(first).toMatchObject({ type: "save", started: 50, runs: [{ id: "a" }] });
    expect(library({ saves: [save("save-z")], runs })[1]).toMatchObject({ type: "save", runs: [], started: null });
  });

  it("puts the runs of a playthrough the stores no longer hold under Deleted, grouped", () => {
    const items = library({ saves: [save("save-a")], runs });
    expect(words(items)).toEqual(["section:library-in-progress", "save:history-save-a", "run:run-b", "run:run-a", "section:library-deleted", "gone:history-save-b", "run:run-c"]);
    expect(items.filter((item) => item.type === "run").map((item) => item.deleted)).toEqual([false, false, true]);
    expect(words(library({ runs, folded: () => true }))).toEqual(["section:library-deleted", "gone:history-save-a", "gone:history-save-b"]);
  });

  it("with a filter on, keeps only the playthroughs with a matching run and only the matching runs", () => {
    const filter = { scope: null, result: "lost" } as const;
    const lost = [run("a", { endedAt: 100 }), run("b", { endedAt: 300, result: "lost", score: null }), run("c", { endedAt: 200, refId: "save-b", campaignId: "mirkwood-paths" }), run("d", { endedAt: 400, refId: "save-b", result: "lost", score: null })];
    expect(words(library({ saves: [save("save-a"), save("save-b"), save("save-z")], archivedSaves: [save("save-y")], runs: lost, filter }))).toEqual([
      "section:library-in-progress",
      "save:history-save-a",
      "run:run-b",
      "save:history-save-b",
      "run:run-d",
    ]);
    // A deleted playthrough's runs are filtered the same way.
    expect(words(library({ runs: lost, filter: { scope: "mirkwood-paths", result: null } }))).toEqual(["section:library-deleted", "gone:history-save-b", "run:run-c"]);
  });

  describe("standalone", () => {
    const games = [
      run("standalone:g1", { kind: "standalone", refId: "g1", campaignId: null, endedAt: 100, box: "revised-core" }),
      run("standalone:g2", { kind: "standalone", refId: "g2", campaignId: null, endedAt: 200, result: "lost", box: "revised-core" }),
      run("standalone:gx", { kind: "standalone", refId: "gx", campaignId: null, endedAt: 50, box: "fellowship-of-the-ring" }),
      run("standalone:gy", { kind: "standalone", refId: "gy", campaignId: null, endedAt: 60, box: "fellowship-of-the-ring" }),
      run("a", { endedAt: 10 }),
    ];

    it("lists playing, finished and archived games, a game's run inline and no fold", () => {
      const items = library({ kind: "standalone", games: [game("g0", true), game("g1"), game("g2"), game("g3")], archivedGames: [game("g4")], runs: games, folded: () => true });
      expect(words(items)).toEqual([
        "section:library-in-progress",
        "game:game-g0",
        "section:library-finished",
        "game:game-g1",
        "game:game-g2",
        "game:game-g3",
        "section:library-archived",
        "game:game-g4",
        "section:library-deleted",
        "run:run-standalone:gy",
        "run:run-standalone:gx",
      ]);
      expect(items.flatMap((item) => (item.type === "game" ? [item.run?.id ?? null] : []))).toEqual([null, "standalone:g1", "standalone:g2", null, null]);
    });

    it("with a filter on, keeps only the games whose run matches", () => {
      const items = library({ kind: "standalone", games: [game("g0", true), game("g1"), game("g2")], runs: games, filter: { scope: null, result: "lost" } });
      expect(words(items)).toEqual(["section:library-finished", "game:game-g2"]);
    });
  });

  it("starts a playthrough at the earliest time a run knows", () => {
    expect(startedOf([run("a", { startedAt: 50, endedAt: 100 }), run("b", { startedAt: null, endedAt: 30 })])).toBe(30);
    expect(startedOf([run("a", { startedAt: null, endedAt: null })])).toBeNull();
  });

  it("tells two playthroughs apart by seats, start and progress", () => {
    expect(playthroughWords("True solo", null, { done: 3, total: 6 })).toBe("True solo · 3 of 6 completed");
    expect(playthroughWords("Two-handed", Date.UTC(2026, 9, 24, 12), null)).toBe("Two-handed · started 24 Oct");
  });
});

describe("history words", () => {
  it("says the result with its cause, and leaves out what the store did not know", () => {
    expect(resultWords(run("x"))).toBe("Won");
    expect(resultWords(run("x", { result: "lost", lossCause: "All heroes died" }))).toBe("Lost · All heroes died");
    expect(resultWords(run("x", { result: "lost", lossCause: null }))).toBe("Lost");
    expect(runDate(run("x", { endedAt: null }))).toBeNull();
    expect(courseWords(run("x", { threats: null, rounds: 3 }))).toBe("3 rounds");
    expect(courseWords(run("x", { threats: null, rounds: null }))).toBeNull();
    expect(courseWords(run("x", { threats: [28, 33], rounds: 1 }))).toBe("1 round · threat 28 / 33");
  });

  it("says the score and the reward of a win, nothing for a loss", () => {
    const name = (code: string) => `N${code}`;
    expect(scoreWords(run("x", { score: 41, victoryPoints: 2, reward: ["1", "2"] }), name)).toBe("Score 41 · 2 victory points · Reward: N1, N2");
    expect(scoreWords(run("x", { result: "lost" }), name)).toBeNull();
    expect(seatsWords(run("x", { seatCount: 2, heroes: [["1"], ["2", "3"]] }), name)).toBe("Two-handed · N1 / N2, N3");
  });

  it("an empty list says so in one line", () => {
    expect(emptyWords("campaign", false)).toBe("No playthrough yet. Start one from Campaigns.");
    expect(emptyWords("standalone", false)).toBe("No game yet. Pick a scenario on Scenarios to deal one.");
    expect(emptyWords("standalone", true)).toBe("No runs match these filters.");
  });
});
