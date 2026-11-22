// The fixture searches reach the seed of every committed fixture (scripts/e2e/seed-kit.ts, firstSeed), so a bare rerun of
// scripts/e2e/fixtures.ts writes the committed fixtures again instead of losing one found with a raised seed count.
import { describe, expect, it } from "vitest";

import { committedSeed, wonIsWanted } from "./seed-kit.ts";

describe("committedSeed", () => {
  it("reads the seed a committed fixture was found at, by the scenario's file and the fixture's name", () => {
    expect(committedSeed("the-long-dark", "dark-won")).toBe(2);
    expect(committedSeed("the-long-dark", "dark-lost")).toBe(1);
  });

  it("is 0 for a fixture that is not committed and for a scenario with no fixture file", () => {
    expect(committedSeed("the-uruk-hai", "hai-won")).toBe(0);
    expect(committedSeed("no-such-scenario", "none-won")).toBe(0);
  });
});

describe("wonIsWanted", () => {
  it("is true for a won fixture the registry names and for every label that is not a won game", () => {
    expect(wonIsWanted("dark-won")).toBe(true);
    expect(wonIsWanted("hai-lost")).toBe(true);
    expect(wonIsWanted("deep-showcase")).toBe(true);
  });

  it("is false for a won fixture the registry does not name, so no seed is played for it", () => {
    expect(wonIsWanted("hai-won")).toBe(false);
    expect(wonIsWanted("none-won")).toBe(false);
    expect(wonIsWanted("hai-won", {})).toBe(false);
  });

  it("is true for every won game under FIXTURE_TRY_WON=1, the one plain scan after the fixture decks change", () => {
    expect(wonIsWanted("none-won", { FIXTURE_TRY_WON: "1" })).toBe(true);
  });
});
