import { describe, expect, it } from "vitest";

import { parseArgs } from "./cli-args.ts";

const USAGE = "usage: pnpm thing <id> [--won]";

describe("parseArgs", () => {
  it("reads positional words, flags with and without a value, and the log flags", () => {
    const parsed = parseArgs(["the-id", "--won", "--seeds=1-6", "--verbose"], USAGE, { flags: ["won", "seeds"] });
    expect(parsed.positional).toEqual(["the-id"]);
    expect(parsed.help).toBe(false);
    expect([...parsed.flags]).toEqual([["won", null], ["seeds", "1-6"], ["verbose", null]]);
  });

  it("takes the value of a spaced flag as its value, not as a positional word", () => {
    const parsed = parseArgs(["scans", "--pack", "OHaUH", "--codes", "01001,01002"], USAGE, { spaced: ["pack", "codes"] });
    expect(parsed.positional).toEqual(["scans"]);
    expect(parsed.flags.get("pack")).toBe("OHaUH");
    expect(parsed.flags.get("codes")).toBe("01001,01002");
  });

  it("refuses a flag it does not know and prints the usage with it", () => {
    expect(() => parseArgs(["--wno"], USAGE, { flags: ["won"] })).toThrow(/Unknown flag --wno\.\nusage: pnpm thing/);
    expect(() => parseArgs(["-x"], USAGE)).toThrow(/Unknown flag -x/);
    // A flag of another script is unknown too, and a spaced flag may be written with `=`.
    expect(parseArgs(["--pack=A", "scans"], USAGE, { spaced: ["pack"] })).toMatchObject({ positional: ["scans"], flags: new Map([["pack", "A"]]) });
    expect(() => parseArgs(["--search"], USAGE, { flags: ["won"] })).toThrow(/Unknown flag --search/);
  });

  it("answers --help and -h with help, whatever else is given", () => {
    expect(parseArgs(["--help"], USAGE).help).toBe(true);
    expect(parseArgs(["the-id", "-h"], USAGE, { flags: ["won"] }).help).toBe(true);
  });
});
