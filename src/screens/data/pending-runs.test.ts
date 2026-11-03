import { describe, expect, it } from "vitest";

import { flushRuns, pendingRuns, queueRun } from "./pending-runs.ts";

describe("pending runs", () => {
  it("runs each queued job once, in order, however often it is flushed", () => {
    const seen: string[] = [];
    queueRun(() => seen.push("first"));
    queueRun(() => seen.push("second"));
    expect(pendingRuns()).toBe(2);
    flushRuns();
    flushRuns();
    expect(seen).toEqual(["first", "second"]);
    expect(pendingRuns()).toBe(0);
  });

  it("goes on with the rest when a job throws", () => {
    const seen: string[] = [];
    queueRun(() => {
      throw new Error("will not replay");
    });
    queueRun(() => seen.push("after"));
    expect(() => flushRuns()).not.toThrow();
    expect(seen).toEqual(["after"]);
  });
});
