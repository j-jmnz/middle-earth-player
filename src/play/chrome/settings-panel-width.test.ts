import { describe, expect, it } from "vitest";

import { settingsPanelWidth } from "./settings-panel-width.ts";

describe("settingsPanelWidth", () => {
  it("takes 40% of the canvas between 360 and 460 pt", () => {
    expect(settingsPanelWidth(1000, 1, 2000)).toBe(400);
    expect(settingsPanelWidth(600, 1, 2000)).toBe(360);
    expect(settingsPanelWidth(1600, 1, 2000)).toBe(460);
  });

  it("scales both bounds with the UI scale", () => {
    expect(settingsPanelWidth(600, 1.15, 2000)).toBeCloseTo(414);
    expect(settingsPanelWidth(1600, 1.15, 2000)).toBeCloseTo(529);
    expect(settingsPanelWidth(1000, 0.85, 2000)).toBeCloseTo(391);
  });

  it("never exceeds the room on a small screen", () => {
    expect(settingsPanelWidth(500, 1.15, 380)).toBe(380);
    expect(settingsPanelWidth(500, 1, -5)).toBe(0);
  });
});
