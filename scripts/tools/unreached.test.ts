// Rules: none (a listing helper). The report of the records no golden resolves names each record and marks those no test of the scenario names.
import { describe, expect, it } from "vitest";

import { namedIn, unreachedReport } from "./unreached.ts";

const rows = [
  { id: "04097:forced:1", timing: "forced", lines: ["04097:A:2"] },
  { id: "04098:response:2", timing: "response", lines: ["04098:A:1"] },
] as const;

describe("the unreached records", () => {
  it("counts a record as tested when a test names its id or one of its lines as a whole token", () => {
    expect(namedIn(rows[0], ['it("04097:A:2 engages")'])).toBe(true);
    expect(namedIn(rows[0], ['it("04097:A:20 engages")'])).toBe(false);
    expect(namedIn(rows[1], ['effectId: "04098:response:2"'])).toBe(true);
    expect(namedIn(rows[1], ["nothing"])).toBe(false);
  });

  it("lists each record and says how many have no test", () => {
    const lines = unreachedReport(rows, ['it("04097:A:2 engages")']);
    expect(lines[0]).toBe("unreached  2 records no golden resolves, 1 that no test of the scenario names:");
    expect(lines[1]).toContain("tested   04097:forced:1");
    expect(lines[2]).toContain("NO TEST  04098:response:2");
    expect(unreachedReport([], [])).toEqual(["unreached  no record is left that no golden resolves"]);
  });
});
