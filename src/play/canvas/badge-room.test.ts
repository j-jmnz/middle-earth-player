// Rules: docs/design-system-table.md (Tokens and effects). The count of effect pills hidden behind the "N more" pill, which badgeReach keeps a word pill clear of.
import { describe, expect, it } from "vitest";

import { BADGE_TOP, badgeRoom, hiddenBadges } from "./badge-room.ts";

const PILL = 15;

describe("hiddenBadges", () => {
  it("two pills on a card with room for one row hide both: the \"2 more\" pill is drawn alone, so the clear space counts it", () => {
    const small = 48;
    expect(badgeRoom(small, 1, PILL)).toBe(1);
    expect(hiddenBadges(2, small, 1, PILL)).toBe(2);
  });

  it("pills that all fit hide none, and past the cap the rest hide behind the pill", () => {
    expect(hiddenBadges(2, 200, 1, PILL)).toBe(0);
    expect(hiddenBadges(3, 200, 1, PILL)).toBe(1);
    expect(hiddenBadges(6, 200, 1, PILL)).toBe(4);
    expect(hiddenBadges(0, 48, 1, PILL)).toBe(0);
  });

  it("the first row stands below the title band, and the room counts only the rows under it", () => {
    expect(BADGE_TOP).toBeGreaterThanOrEqual(18);
    // A card 84 pt tall: the band and the resource token leave 44 pt, two rows of 17.
    expect(badgeRoom(84, 1, PILL)).toBe(2);
    expect(badgeRoom(84 + 17, 1, PILL)).toBe(3);
  });
});
