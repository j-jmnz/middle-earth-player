import { describe, expect, it } from "vitest";

import { flagValues } from "./plan.ts";

describe("flagValues", () => {
  it("collects every value of a repeated flag, in order, and nothing for a flag not given", () => {
    const args = ["--bump", "patch", "--desktop", "a.exe", "--ipa", "b.ipa", "--desktop", "c.dmg", "--desktop", "d.AppImage"];
    expect(flagValues(args, "--desktop")).toEqual(["a.exe", "c.dmg", "d.AppImage"]);
    expect(flagValues(args, "--apk")).toEqual([]);
  });

  it("refuses a flag with no value", () => {
    expect(() => flagValues(["--desktop"], "--desktop")).toThrow("--desktop needs a value");
    expect(() => flagValues(["--desktop", "--dry-run"], "--desktop")).toThrow("--desktop needs a value");
  });
});
