// A script's `--name value` flags (args.ts).
import { describe, expect, it } from "vitest";

import { flagValue, flagValues, requiredFlag } from "./args.ts";

describe("flagValues", () => {
  it("collects every value of a repeated flag, in order, and nothing for a flag not given", () => {
    const args = ["--bump", "patch", "--desktop", "a.exe", "--ipa", "b.ipa", "--desktop", "c.dmg", "--desktop", "d.AppImage"];
    expect(flagValues(args, "--desktop")).toEqual(["a.exe", "c.dmg", "d.AppImage"]);
    expect(flagValues(["--desktop-missing", "--ipa", "b.ipa"], "--desktop")).toEqual([]);
    expect(flagValues(args, "--apk")).toEqual([]);
  });

  it("refuses a flag with no value", () => {
    expect(() => flagValues(["--desktop"], "--desktop")).toThrow("--desktop needs a value");
    expect(() => flagValues(["--desktop", "--dry-run"], "--desktop")).toThrow("--desktop needs a value");
  });
});

describe("flagValue and requiredFlag", () => {
  it("read the first value, undefined or refused when the flag is missing", () => {
    expect(flagValue(["--tag", "v1.2.3"], "--tag")).toBe("v1.2.3");
    expect(flagValue([], "--tag")).toBeUndefined();
    expect(requiredFlag(["--tag", "v1.2.3"], "--tag")).toBe("v1.2.3");
    expect(() => requiredFlag([], "--tag")).toThrow("--tag needs a value");
  });
});
