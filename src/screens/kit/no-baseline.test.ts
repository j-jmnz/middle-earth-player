import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// `items-baseline` collapsed a row to nothing on Android (the path screen's row, issue 187), so no screen aligns by baseline: a row of one size of text uses `items-center`, a row with a dotted leader `items-end`.
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx$/.test(name) ? [path] : [];
  });
}

describe("row alignment", () => {
  it("never uses items-baseline in a screen or on the table", () => {
    const found = [join(__dirname, ".."), join(__dirname, "../../play")].flatMap(sources).filter((file) => readFileSync(file, "utf8").includes("items-baseline"));
    expect(found).toEqual([]);
  });
});
