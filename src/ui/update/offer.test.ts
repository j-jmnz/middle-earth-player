// The rules of the update offer (src/ui/update/offer.ts): which versions are later, what is read from GitHub's answer, when a check is
// due, which builds check, and when the ribbon shows.
import { describe, expect, it } from "vitest";

import {
  CHECK_INTERVAL_MS,
  checkDue,
  checksFor,
  isNewer,
  LATEST_RELEASE_URL,
  offerOf,
  parseLatestRelease,
  parseStoredUpdate,
  parseVersion,
  releasedLine,
  releasePageUrl,
  ribbonShows,
} from "./offer.ts";

describe("versions", () => {
  it("reads plain semver and v tags, and nothing else", () => {
    expect(parseVersion("0.5.0")).toEqual([0, 5, 0]);
    expect(parseVersion("v1.12.3")).toEqual([1, 12, 3]);
    expect(parseVersion("v0.5.0-beta.1")).toBeNull();
    expect(parseVersion("unknown")).toBeNull();
    expect(parseVersion("01.2.3")).toBeNull();
  });

  it("compares major, then minor, then patch", () => {
    expect(isNewer([0, 5, 0], [0, 4, 9])).toBe(true);
    expect(isNewer([0, 10, 0], [0, 9, 0])).toBe(true);
    expect(isNewer([1, 0, 0], [0, 99, 99])).toBe(true);
    expect(isNewer([0, 4, 2], [0, 4, 2])).toBe(false);
    expect(isNewer([0, 4, 1], [0, 4, 2])).toBe(false);
  });
});

describe("GitHub's answer", () => {
  it("asks the repository's latest release and opens its own release page", () => {
    expect(LATEST_RELEASE_URL).toBe("https://api.github.com/repos/j-jmnz/middle-earth-player/releases/latest");
    expect(releasePageUrl("0.5.0")).toBe("https://github.com/j-jmnz/middle-earth-player/releases/tag/v0.5.0");
  });

  it("keeps only the version and the date of a published release", () => {
    expect(parseLatestRelease({ tag_name: "v0.5.0", published_at: "2026-11-15T10:00:00Z", html_url: "https://elsewhere.example", body: "notes" })).toEqual({ version: "0.5.0", publishedAt: "2026-11-15T10:00:00Z" });
    expect(parseLatestRelease({ tag_name: "v0.5.0" })).toEqual({ version: "0.5.0", publishedAt: null });
  });

  it("reads no release from a draft, a prerelease, an odd tag or an error body", () => {
    expect(parseLatestRelease({ tag_name: "v0.5.0", draft: true })).toBeNull();
    expect(parseLatestRelease({ tag_name: "v0.5.0", prerelease: true })).toBeNull();
    expect(parseLatestRelease({ tag_name: "nightly" })).toBeNull();
    expect(parseLatestRelease({ message: "Not Found" })).toBeNull();
    expect(parseLatestRelease(null)).toBeNull();
    expect(parseLatestRelease("v0.5.0")).toBeNull();
  });
});

describe("the stored row", () => {
  it("reads back what was written and empties what is malformed", () => {
    expect(parseStoredUpdate({ checkedAt: 5, latest: { version: "0.5.0", publishedAt: "2026-11-15T10:00:00Z" }, dismissed: "0.5.0" })).toEqual({ checkedAt: 5, latest: { version: "0.5.0", publishedAt: "2026-11-15T10:00:00Z" }, dismissed: "0.5.0" });
    expect(parseStoredUpdate({ checkedAt: "yesterday", latest: { version: "soon" }, dismissed: 3 })).toEqual({ checkedAt: null, latest: null, dismissed: null });
    expect(parseStoredUpdate(null)).toEqual({ checkedAt: null, latest: null, dismissed: null });
  });
});

describe("when a check runs", () => {
  it("is due when never asked, after a day, or when the clock went back", () => {
    expect(checkDue(null, 1000)).toBe(true);
    expect(checkDue(1000, 1000 + CHECK_INTERVAL_MS - 1)).toBe(false);
    expect(checkDue(1000, 1000 + CHECK_INTERVAL_MS)).toBe(true);
    expect(checkDue(5000, 1000)).toBe(true);
  });

  it("runs only in a release build", () => {
    expect(checksFor("0.4.2")).toBe(true);
    expect(checksFor("0.0.0")).toBe(false);
    expect(checksFor("unknown")).toBe(false);
  });
});

describe("the offer and the ribbon", () => {
  const found = { checkedAt: 1, latest: { version: "0.5.0", publishedAt: null }, dismissed: null };

  it("offers a later release while the check is on", () => {
    expect(offerOf(found, "0.4.2", true)).toBe("0.5.0");
    expect(offerOf(found, "0.4.2", false)).toBeNull();
    expect(offerOf(found, "0.5.0", true)).toBeNull();
    expect(offerOf(found, "0.6.0", true)).toBeNull();
    expect(offerOf(found, "0.0.0", true)).toBeNull();
    expect(offerOf({ ...found, latest: null }, "0.4.2", true)).toBeNull();
  });

  it("hides the ribbon for the closed version until a later one", () => {
    expect(ribbonShows("0.5.0", null)).toBe(true);
    expect(ribbonShows("0.5.0", "0.5.0")).toBe(false);
    expect(ribbonShows("0.5.1", "0.5.0")).toBe(true);
    expect(ribbonShows(null, null)).toBe(false);
  });

  it("says the release date in words", () => {
    expect(releasedLine("2026-11-15T23:30:00Z")).toBe("Released 15 November 2026");
    expect(releasedLine(null)).toBeNull();
    expect(releasedLine("not a date")).toBeNull();
  });
});
