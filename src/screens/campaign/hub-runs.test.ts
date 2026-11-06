import { describe, expect, it } from "vitest";

import type { NextStep, PathNode } from "../../campaign/path.ts";
import type { Box } from "../data/campaign-data.ts";
import { comingScenarios, nextLabel, splitRuns } from "./hub-runs.ts";

const node = (number: number, status: PathNode["status"] = "current"): PathNode => ({ id: `s${number}`, number, name: `Scenario ${number}`, status, reward: [], score: null });

describe("splitRuns", () => {
  const runs = [
    { id: "a", over: true },
    { id: "b", over: false },
    { id: "c", over: false },
    { id: "d", over: true },
  ];
  const unfinished = (run: { over: boolean }) => !run.over;

  it("takes the first unfinished run in list order as the hero and the rest of the unfinished runs after it", () => {
    const { hero, others } = splitRuns(runs, unfinished);
    expect(hero?.id).toBe("b");
    expect(others.map((run) => run.id)).toEqual(["c"]);
  });

  it("leaves a finished run out of both", () => {
    const { hero, others } = splitRuns(runs, unfinished);
    expect([hero, ...others].map((run) => run?.id)).not.toContain("a");
    expect([hero, ...others].map((run) => run?.id)).not.toContain("d");
  });

  it("has no hero and no others when every run is finished, or there are none", () => {
    expect(splitRuns(runs, () => false)).toEqual({ hero: null, others: [] });
    expect(splitRuns([], unfinished)).toEqual({ hero: null, others: [] });
  });

  it("has a hero and no others for one unfinished run", () => {
    expect(splitRuns([runs[1]!], unfinished)).toEqual({ hero: runs[1], others: [] });
  });

  it("does not change the list it reads", () => {
    const list = [...runs];
    splitRuns(list, unfinished);
    expect(list).toEqual(runs);
  });
});

describe("comingScenarios", () => {
  const boxes: Box[] = [
    { id: "one", name: "Box One", campaignId: "one", scenarios: ["a", "b", "c"] },
    { id: "two", name: "Box Two", campaignId: "two", scenarios: ["d", "e"] },
  ];
  const nameOf = (id: string) => `Name of ${id}`;

  it("lists the unplayable scenarios in book order, captioned with their box and place", () => {
    const playable = new Set(["a", "e"]);
    expect(comingScenarios(boxes, (id) => playable.has(id), nameOf)).toEqual([
      { id: "b", name: "Name of b", caption: "Coming soon · Box One · 2" },
      { id: "c", name: "Name of c", caption: "Coming soon · Box One · 3" },
      { id: "d", name: "Name of d", caption: "Coming soon · Box Two · 1" },
    ]);
  });

  it("is empty when every scenario is playable", () => {
    expect(comingScenarios(boxes, () => true, nameOf)).toEqual([]);
  });
});

describe("nextLabel", () => {
  const path = [1, 2, 3, 4, 5, 6].map((n) => node(n));

  it("says Next for the scenario to begin", () => {
    const next: NextStep = { kind: "begin", node: node(3) };
    expect(nextLabel(next, path)).toBe("Next · Scenario 3 of 6");
  });

  it("says On the table for the open scenario", () => {
    const next: NextStep = { kind: "resume", node: node(3) };
    expect(nextLabel(next, path)).toBe("On the table · Scenario 3 of 6");
  });

  it("says Coming soon for a scenario the app cannot deal yet", () => {
    const next: NextStep = { kind: "soon", node: node(7, "soon") };
    expect(nextLabel(next, [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => node(n)))).toBe("Coming soon · Scenario 7 of 9");
  });

  it("says every scenario is won when none is left", () => {
    expect(nextLabel({ kind: "finished" }, path)).toBe("Campaign won");
  });
});
