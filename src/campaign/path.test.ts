import { describe, expect, it } from "vitest";

import { campaign } from "../../test/scenarios/temple-of-the-deceived/scene.ts";

import { emptyLog } from "./log.ts";
import { campaignPath, currentNode, nextStep, openNode, soonNode, soonWords, type PathNode } from "./path.ts";

function node(id: string, status: PathNode["status"]): PathNode {
  return { id, number: 1, name: id, status, reward: [], score: null };
}

describe("nextStep", () => {
  const path = [node("one", "completed"), node("two", "current"), node("three", "locked")];

  it("resumes the open scenario", () => {
    expect(nextStep(path, "two")).toEqual({ kind: "resume", node: path[1] });
    expect(nextStep(path, "one")).toEqual({ kind: "resume", node: path[0] });
  });

  it("begins the current scenario when none is open, or the open one is locked", () => {
    expect(nextStep(path, null)).toEqual({ kind: "begin", node: path[1] });
    expect(nextStep(path, "three")).toEqual({ kind: "begin", node: path[1] });
  });

  it("is finished when every scenario is won and none is open", () => {
    expect(nextStep([node("one", "completed")], undefined)).toEqual({ kind: "finished" });
  });
});

describe("a scenario the app cannot deal yet (coming soon)", () => {
  const won = ["voyage-across-belegaer", "the-fate-of-numenor", "raid-on-the-grey-havens", "flight-of-the-stormcaller", "the-thing-in-the-depths", "temple-of-the-deceived"];
  const pathAfter = (completed: readonly string[]) => campaignPath(campaign, {}, { ...emptyLog(1), completed: [...completed] });

  it("marks The Drowned Ruins, A Storm on Cobas Haven and The City of Corsairs coming soon, whatever is won before them, and never current", () => {
    for (const completed of [[], won.slice(0, 3), won]) {
      const path = pathAfter(completed);
      expect(path.filter((entry) => entry.status === "soon").map((entry) => entry.id)).toEqual(["the-drowned-ruins", "a-storm-on-cobas-haven", "the-city-of-corsairs"]);
      expect(path.some((entry) => entry.status === "current" && !["voyage-across-belegaer", "the-fate-of-numenor", "raid-on-the-grey-havens", "flight-of-the-stormcaller", "the-thing-in-the-depths", "temple-of-the-deceived"].includes(entry.id))).toBe(false);
    }
  });

  it("stops the path at The Drowned Ruins after Temple of the Deceived: the next step is coming soon, never Begin, and it is never opened or resumed", () => {
    const path = pathAfter(won);
    expect(currentNode(path)).toBeNull();
    expect(soonNode(path)?.id).toBe("the-drowned-ruins");
    expect(soonWords(soonNode(path)!)).toBe(`${path[6]?.name} is coming soon`);
    expect(nextStep(path, null)).toEqual({ kind: "soon", node: path[6] });
    // The stored loadout of an old save may name it: it is not resumed.
    expect(openNode(path, "the-drowned-ruins")).toBeNull();
    expect(nextStep(path, "the-drowned-ruins")).toEqual({ kind: "soon", node: path[6] });
  });

  it("begins Temple of the Deceived while it is the first scenario not won, and keeps the log of what is won", () => {
    const path = pathAfter(won.slice(0, 5));
    expect(nextStep(path, null)).toMatchObject({ kind: "begin", node: { id: "temple-of-the-deceived" } });
    expect(path.map((entry) => entry.status).slice(4, 7)).toEqual(["completed", "current", "soon"]);
    expect(pathAfter(won).filter((entry) => entry.status === "completed")).toHaveLength(6);
  });
});
