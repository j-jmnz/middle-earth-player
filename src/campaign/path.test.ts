import { describe, expect, it } from "vitest";

import { loadCampaign } from "../../scripts/data/load-scenarios.ts";

import { emptyLog } from "./log.ts";
import { isPlayable } from "./playable.ts";
import { campaignPath, currentNode, nextStep, openNode, soonNode, soonWords, type PathNode } from "./path.ts";

const campaign = loadCampaign("dream-chaser");

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

// The campaign's order is data/campaigns/dream-chaser.json; a scenario is dealt once it is in PLAYABLE_SCENARIOS (src/campaign/playable.ts).
const order = campaign.scenarios;
const won = order.filter(isPlayable);
const soon = order.filter((id) => !isPlayable(id));
const frontier = won.length;
const nameOf = (id: string) => campaignPath(campaign, {}, emptyLog(1)).find((entry) => entry.id === id)?.name ?? id;

describe("a scenario the app cannot deal yet (coming soon)", () => {
  const pathAfter = (completed: readonly string[]) => campaignPath(campaign, {}, { ...emptyLog(1), completed: [...completed] });

  it("lists the playable scenarios first, so the path stops at the first one the app cannot deal", () => {
    expect(order.slice(0, frontier)).toEqual(won);
  });

  it("marks every scenario the app cannot deal coming soon, whatever is won before them, and never current", () => {
    for (const completed of [[], won.slice(0, 3), won]) {
      const path = pathAfter(completed);
      expect(path.filter((entry) => entry.status === "soon").map((entry) => entry.id)).toEqual(soon);
      expect(path.some((entry) => entry.status === "current" && !won.includes(entry.id))).toBe(false);
    }
  });

  it("stops the path at the first scenario the app cannot deal after the last playable one: the next step is coming soon, never Begin, and it is never opened or resumed", () => {
    const path = pathAfter(won);
    const first = soon[0];
    expect(currentNode(path)).toBeNull();
    // Once every scenario is playable there is nothing coming soon, and the path ends with the last one won.
    if (first === undefined) {
      expect(soonNode(path)).toBeNull();
      return;
    }
    expect(soonNode(path)?.id).toBe(first);
    expect(soonWords(soonNode(path)!)).toBe(`${nameOf(first)} is coming soon`);
    expect(nextStep(path, null)).toEqual({ kind: "soon", node: path[frontier] });
    // The stored loadout of an old save may name it: it is not resumed.
    expect(openNode(path, first)).toBeNull();
    expect(nextStep(path, first)).toEqual({ kind: "soon", node: path[frontier] });
  });

  it("begins the last playable scenario while it is the first one not won, and keeps the log of what is won", () => {
    const path = pathAfter(won.slice(0, frontier - 1));
    expect(nextStep(path, null)).toMatchObject({ kind: "begin", node: { id: won[frontier - 1] } });
    expect(path.map((entry) => entry.status).slice(frontier - 2, frontier + 1)).toEqual(["completed", "current", ...(soon.length > 0 ? ["soon" as const] : [])]);
    expect(pathAfter(won).filter((entry) => entry.status === "completed")).toHaveLength(frontier);
  });
});
