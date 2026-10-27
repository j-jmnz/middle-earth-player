// History: the list sorts, groups and filters.
import { describe, expect, it } from "vitest";

import type { RunRecord } from "../campaign/runs";
import { filterRuns, groupRuns, newestFirst, scopesOf } from "./history-list";
import { courseWords, emptyWords, resultWords, runDate, scoreWords, seatsWords } from "./history-words";

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
    expect(scoreWords(run("x", { score: 41, victoryPoints: 2, reward: ["1", "2"] }), name)).toBe("Score 41 · 2 victory points · N1, N2");
    expect(scoreWords(run("x", { result: "lost" }), name)).toBeNull();
    expect(seatsWords(run("x", { seatCount: 2, heroes: [["1"], ["2", "3"]] }), name)).toBe("Two-handed · N1 / N2, N3");
  });

  it("an empty list says so in one line", () => {
    expect(emptyWords("campaign", false)).toMatch(/^No campaign run yet/);
    expect(emptyWords("standalone", true)).toBe("No runs match these filters.");
  });
});
