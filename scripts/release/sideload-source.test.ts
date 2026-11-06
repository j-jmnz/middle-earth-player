import { describe, expect, it } from "vitest";

import { MIN_IOS, sourceOf, sourceUrl } from "./sideload-source.ts";

describe("the SideStore and AltStore source (docs/releasing.md, Jobs)", () => {
  const input = { repository: "j-jmnz/middle-earth-lcg", tag: "v0.2.1", ipaName: "middle-earth-lcg-v0.2.1.ipa", ipaBytes: 1234, date: "2026-11-06T00:00:00.000Z", notes: "## New\n" };

  it("lists the release's IPA under the app's bundle id, with the build number the IPA carries", () => {
    const source = sourceOf(input) as { apps: { bundleIdentifier: string; versions: Record<string, unknown>[] }[] };
    expect(source.apps[0]?.bundleIdentifier).toBe("com.middleearth.lcg");
    expect(source.apps[0]?.versions).toEqual([
      {
        version: "0.2.1",
        buildVersion: "2001",
        date: "2026-11-06T00:00:00.000Z",
        localizedDescription: "## New\n",
        downloadURL: "https://github.com/j-jmnz/middle-earth-lcg/releases/download/v0.2.1/middle-earth-lcg-v0.2.1.ipa",
        size: 1234,
        minOSVersion: MIN_IOS,
      },
    ]);
  });

  it("is reached through the latest release, and refuses a tag that is not a release's", () => {
    expect(sourceUrl("j-jmnz/middle-earth-lcg")).toBe("https://github.com/j-jmnz/middle-earth-lcg/releases/latest/download/source.json");
    expect(() => sourceOf({ ...input, tag: "0.2.1" })).toThrow();
  });
});
