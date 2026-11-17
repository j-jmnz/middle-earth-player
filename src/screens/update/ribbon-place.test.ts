// Where the update ribbon shows (src/screens/update/ribbon-place.ts): every route but the table's, unless the window is a short landscape one.
import { describe, expect, it } from "vitest";

import { isTableRoute, ribbonFits } from "./ribbon-place.ts";

describe("the ribbon's place", () => {
  it("knows the table's routes", () => {
    expect(isTableRoute("/table/save-1")).toBe(true);
    expect(isTableRoute("/standalone/table/game-1")).toBe(true);
    expect(isTableRoute("/standalone/briefing/passage")).toBe(false);
    expect(isTableRoute("/settings")).toBe(false);
    expect(isTableRoute("/")).toBe(false);
  });

  it("shows on a hub and a pushed screen, in portrait and on a tablet or a desktop window", () => {
    expect(ribbonFits("/", 390, 844)).toBe(true);
    expect(ribbonFits("/settings", 390, 844)).toBe(true);
    expect(ribbonFits("/decks", 1180, 820)).toBe(true);
    expect(ribbonFits("/card/141001", 1600, 900)).toBe(true);
  });

  it("leaves the table and a phone turned to landscape alone", () => {
    expect(ribbonFits("/table/save-1", 1180, 820)).toBe(false);
    expect(ribbonFits("/card/141001", 844, 390)).toBe(false);
  });
});
