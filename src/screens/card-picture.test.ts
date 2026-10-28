import { describe, expect, it } from "vitest";

import { pictureMaxWidth } from "./card-picture";

describe("pictureMaxWidth", () => {
  it("keeps the phone's 300 wide, 96 in from the window", () => {
    expect(pictureMaxWidth("compact", 390, 1, null, false)).toBe(294);
    expect(pictureMaxWidth("compact", 430, 1, null, false)).toBe(300);
    expect(pictureMaxWidth("compact", 430, 1.15, null, false)).toBeCloseTo(319.6);
  });

  it("raises the cap to 360 in the medium column", () => {
    expect(pictureMaxWidth("medium", 834, 1, null, false)).toBe(360);
    expect(pictureMaxWidth("medium", 834, 1.15, null, false)).toBeCloseTo(414);
  });

  it("waits for the expanded picture pane to be measured", () => {
    expect(pictureMaxWidth("expanded", 1194, 1, null, false)).toBeNull();
    expect(pictureMaxWidth("expanded", 1194, 1, { width: 0, height: 700 }, false)).toBeNull();
  });

  it("sizes an expanded portrait card by the pane's height, no wider than 420", () => {
    expect(pictureMaxWidth("expanded", 1194, 1, { width: 640, height: 700 }, false)).toBe(420);
    // An iPhone on its side: 330 tall leaves 298 for the card.
    expect(pictureMaxWidth("expanded", 844, 1, { width: 400, height: 330 }, false)).toBeCloseTo(298 * 0.705, 0);
  });

  it("gives a sideways quest card the height a portrait card would have, within the pane", () => {
    expect(pictureMaxWidth("expanded", 1194, 1, { width: 640, height: 700 }, true)).toBe(596);
    expect(pictureMaxWidth("expanded", 1194, 1, { width: 500, height: 700 }, true)).toBe(468);
  });
});
