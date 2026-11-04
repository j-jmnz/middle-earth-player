import { describe, expect, it } from "vitest";

import { splitCodes } from "./codes.ts";

describe("splitCodes", () => {
  it("splits on commas, on spaces and on both, across arguments", () => {
    const expected = ["12125", "12132"];
    expect(splitCodes(["12125,12132"])).toEqual(expected);
    expect(splitCodes(["12125 12132"])).toEqual(expected);
    expect(splitCodes(["12125", "12132"])).toEqual(expected);
    expect(splitCodes(["12125, 12132"])).toEqual(expected);
    expect(splitCodes(["12125,", " 12132 "])).toEqual(expected);
  });

  it("keeps a single code and drops empty pieces", () => {
    expect(splitCodes(["12125"])).toEqual(["12125"]);
    expect(splitCodes(["", ",,"])).toEqual([]);
    expect(splitCodes([])).toEqual([]);
  });
});
