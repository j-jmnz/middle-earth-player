// The fixture searches reach the seed of every committed fixture (scripts/e2e/seed-kit.ts, firstSeed), so a bare rerun of
// scripts/e2e/fixtures.ts writes the committed fixtures again instead of losing one found with a raised seed count.
import { describe, expect, it } from "vitest";

import { committedSeed } from "./seed-kit.ts";

describe("committedSeed", () => {
  it("reads the seed a committed fixture was found at, by the scenario's file and the fixture's name", () => {
    expect(committedSeed("the-oath", "oath-won")).toBe(909);
    expect(committedSeed("the-oath", "oath-lost")).toBe(1);
  });

  it("is 0 for a fixture that is not committed and for a scenario with no fixture file", () => {
    expect(committedSeed("the-uruk-hai", "hai-won")).toBe(0);
    expect(committedSeed("no-such-scenario", "none-won")).toBe(0);
  });
});
