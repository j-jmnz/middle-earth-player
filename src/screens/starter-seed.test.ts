import { describe, expect, it, vi } from "vitest";

import { completeStarterInsert, starterSeedReason, starterSeedStatus } from "./starter-decks.ts";

describe("starter seed", () => {
  it("does not mark the starters ready when the insert throws", () => {
    expect(starterSeedStatus()).toBe("pending");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    completeStarterInsert(() => {
      throw new Error("insert failed");
    });
    expect(starterSeedStatus()).toBe("missing");
    expect(starterSeedReason()).toBe("insert failed");
    completeStarterInsert(() => undefined);
    expect(starterSeedStatus()).toBe("ready");
    expect(starterSeedReason()).toBeNull();
    warn.mockRestore();
  });
});
