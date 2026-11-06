import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

// app.config.js stamps the release version into the build (.claude/rules/release-standards.md, Versioning).
const require = createRequire(import.meta.url);
const appConfig = require("../../app.config.js") as {
  stamp: (config: Record<string, unknown>, version: string | undefined) => Record<string, unknown>;
  versionCodeOf: (version: string) => number;
};
const app = require("../../app.json") as { expo: Record<string, unknown> };

describe("app.config.js", () => {
  it("keeps app.json's development version without APP_VERSION", () => {
    expect(app.expo.version).toBe("0.0.0");
    expect(appConfig.stamp(app.expo, undefined)).toBe(app.expo);
  });

  it("stamps the version and a versionCode that grows with every release", () => {
    const stamped = appConfig.stamp(app.expo, "1.2.3") as { version: string; android: { versionCode: number; package: string }; ios: { buildNumber: string } };
    expect(stamped.version).toBe("1.2.3");
    expect(stamped.android).toMatchObject({ versionCode: 1_002_003, package: "com.middleearth.lcg" });
    expect(stamped.ios.buildNumber).toBe("1002003");
    const order = ["0.1.0", "0.1.1", "0.2.0", "0.999.999", "1.0.0", "1.0.1"].map(appConfig.versionCodeOf);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("refuses a version that is not plain semver or does not fit", () => {
    for (const version of ["v1.2.3", "1.2", "1.2.3-rc.1", "1.1000.0"]) expect(() => appConfig.versionCodeOf(version)).toThrow();
  });
});
