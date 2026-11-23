import { describe, expect, it } from "vitest";

import { mergePins, packsArg } from "./scans.ts";

// `pnpm data sync scans --pack <id>`: pins one pack's player cards without fetching the other scans again.
describe("scan sync by pack", () => {
  it("reads every --pack value", () => {
    expect(packsArg(["scans", "--pack", "OHaUH", "--verbose", "--pack", "HoN"])).toEqual(["OHaUH", "HoN"]);
    expect(packsArg(["scans", "--pack"])).toEqual([]);
    expect(packsArg(["scans"])).toEqual([]);
  });

  it("merges new pins into the held ones in path order, a new pin replacing the same path", () => {
    const pin = (name: string, sha: string) => ({ path: `scans/${name}.jpg`, url: `https://x.test/${name}.jpg`, sha256: sha.repeat(64), bytes: 1 });
    const merged = mergePins([pin("02.A", "a"), pin("01.A", "a")], [pin("02.A", "b"), pin("03.A", "b")]);
    expect(merged.map((file) => `${file.path}:${file.sha256[0]}`)).toEqual(["scans/01.A.jpg:a", "scans/02.A.jpg:b", "scans/03.A.jpg:b"]);
  });
});
