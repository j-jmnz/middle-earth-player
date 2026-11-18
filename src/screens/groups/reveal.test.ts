import { afterEach, describe, expect, it } from "vitest";

import { resetRevealed, revealSpoilers, spoilersRevealed } from "./reveal";

afterEach(resetRevealed);

describe("the spoiler answer", () => {
  it("is one answer for every group until the app closes", () => {
    expect(spoilersRevealed()).toBe(false);
    revealSpoilers();
    expect(spoilersRevealed()).toBe(true);
    resetRevealed();
    expect(spoilersRevealed()).toBe(false);
  });
});
