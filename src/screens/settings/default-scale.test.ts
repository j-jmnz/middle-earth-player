// The desktop's first-launch interface size (default-scale.ts).
import { describe, expect, it } from "vitest";

import { defaultUiScale, hasStoredScale } from "./default-scale.ts";

describe("defaultUiScale", () => {
  it("starts a large window at Large and a very large one at Extra large", () => {
    expect(defaultUiScale(844, 390)).toBe("medium");
    expect(defaultUiScale(1280, 720)).toBe("medium");
    expect(defaultUiScale(1600, 900)).toBe("large");
    expect(defaultUiScale(1920, 1080)).toBe("large");
    expect(defaultUiScale(2400, 1350)).toBe("xlarge");
    expect(defaultUiScale(3840, 2160)).toBe("xlarge");
  });

  it("needs both sides, so a wide, short window stays smaller", () => {
    expect(defaultUiScale(2560, 800)).toBe("medium");
    expect(defaultUiScale(3000, 1000)).toBe("large");
  });
});

describe("hasStoredScale", () => {
  it("is true only for settings that hold a valid interface size", () => {
    expect(hasStoredScale({ uiScale: "medium" })).toBe(true);
    expect(hasStoredScale({ uiScale: "small" })).toBe(true);
    expect(hasStoredScale({ theme: "dark" })).toBe(false);
    expect(hasStoredScale({ uiScale: "huge" })).toBe(false);
    expect(hasStoredScale(null)).toBe(false);
  });
});
