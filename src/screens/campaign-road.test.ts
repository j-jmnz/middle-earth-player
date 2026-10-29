import { describe, expect, it } from "vitest";

import type { NextStep, NodeStatus, PathNode } from "../campaign/path";
import { campaignRoad } from "./campaign-road";

const node = (number: number, status: NodeStatus, score: number | null = null): PathNode => ({ id: `s${number}`, number, name: `Scenario ${number}`, status, reward: [], score });
const path = (statuses: readonly NodeStatus[], scores: readonly (number | null)[] = []) => statuses.map((status, index) => node(index + 1, status, scores[index] ?? null));
const states = (road: ReturnType<typeof campaignRoad>) => road.stops.map((stop) => `${stop.node.number}:${stop.state}:${stop.into ?? "-"}:${stop.out ?? "-"}`);

describe("campaignRoad", () => {
  it("begins the first scenario: the lit stop, then the road ahead, nothing folded", () => {
    const nodes = path(["current", "locked", "locked"]);
    const road = campaignRoad(nodes, { kind: "begin", node: nodes[0]! });
    expect(road.folded).toBeNull();
    expect(states(road)).toEqual(["1:here:-:ahead", "2:ahead:ahead:ahead", "3:ahead:ahead:-"]);
    expect(road.stops[1]!.spoken).toBe("Scenario 2, not reached");
  });

  it("resumes the current scenario and folds the wins before the last one", () => {
    const nodes = path(["completed", "completed", "completed", "current", "locked"], [80, 90, 70]);
    const road = campaignRoad(nodes, { kind: "resume", node: nodes[3]! });
    expect(road.folded).toEqual({ count: 2, score: 170, spoken: "2 scenarios won, score 170" });
    expect(states(road)).toEqual(["3:won:walked:walked", "4:here:walked:ahead", "5:ahead:ahead:-"]);
    expect(road.stops[0]!.tag).toBe("Won · 70");
  });

  it("replays a won scenario: it keeps its score, and the campaign's next scenario says Next", () => {
    const nodes = path(["completed", "completed", "current", "locked"], [80, 90]);
    const step: NextStep = { kind: "resume", node: nodes[1]! };
    const road = campaignRoad(nodes, step);
    expect(road.folded).toBeNull();
    expect(states(road)).toEqual(["1:won:-:walked", "2:here:walked:ahead", "3:ahead:ahead:ahead", "4:ahead:ahead:-"]);
    expect(road.stops[1]!.tag).toBe("Won · 90");
    expect(road.stops[2]!.tag).toBe("Next");
    expect(road.stops[2]!.spoken).toBe("Scenario 3, next after this");
    expect(road.stops[3]!.spoken).toBe("Scenario 4, not reached");
  });

  it("is finished: every line walked, all but the last win folded, a fold without every score has no total", () => {
    const nodes = path(["completed", "completed", "completed", "completed"], [80, null, 70, 60]);
    const road = campaignRoad(nodes, { kind: "finished" });
    expect(road.folded).toEqual({ count: 3, score: null, spoken: "3 scenarios won" });
    expect(states(road)).toEqual(["4:won:walked:-"]);
  });
});
