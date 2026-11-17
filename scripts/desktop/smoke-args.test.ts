import path from "node:path";

import { describe, expect, it } from "vitest";

import { parseSmokeArgs } from "./smoke-args.ts";

describe("parseSmokeArgs", () => {
  it("launches the checkout's shell with no flags", () => {
    expect(parseSmokeArgs([])).toEqual({ packed: null, skipBuild: false, requireBundle: false, expectVersion: null });
    expect(parseSmokeArgs(["--skip-build"]).skipBuild).toBe(true);
  });

  it("takes a packed app, whether the bundle must carry pictures and booklets, and the version to expect", () => {
    expect(parseSmokeArgs(["--app", "out/app", "--require-bundle", "--expect-version", "1.2.3"])).toEqual({
      packed: path.resolve("out/app"),
      skipBuild: false,
      requireBundle: true,
      expectVersion: "1.2.3",
    });
  });

  it("refuses a flag without its value, and a required bundle with no packed app to look in", () => {
    expect(() => parseSmokeArgs(["--app"])).toThrow("--app needs a value");
    expect(() => parseSmokeArgs(["--app", "--skip-build"])).toThrow("--app needs a value");
    expect(() => parseSmokeArgs(["--app", "x", "--expect-version"])).toThrow("--expect-version needs a value");
    expect(() => parseSmokeArgs(["--require-bundle"])).toThrow("--app");
  });
});
