import { describe, expect, it } from "vitest";

import { nextStep, type PathNode } from "./path.ts";

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
