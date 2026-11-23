import { describe, expect, it } from "vitest";

import { SYNC_USAGE, syncArguments } from "./sync-args.ts";

describe("syncArguments", () => {
  it("reads the sources named and leaves the values of --pack and --codes out of them", () => {
    expect(syncArguments(["scans", "--pack", "OHaUH", "--codes", "01001,01002", "--verbose"])).toEqual({ wanted: ["scans"], help: false });
    expect(syncArguments([])).toEqual({ wanted: [], help: false });
  });

  it("refuses a flag it does not know with the usage, so a bare run of every source does not start", () => {
    expect(() => syncArguments(["--pakc", "X"])).toThrow(SYNC_USAGE);
    expect(() => syncArguments(["--dry-run"])).toThrow(/Unknown flag --dry-run/);
  });

  it("answers --help with help and names no source", () => {
    expect(syncArguments(["--help"])).toEqual({ wanted: [], help: true });
  });
});
