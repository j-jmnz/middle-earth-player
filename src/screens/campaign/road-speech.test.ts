import { describe, expect, it } from "vitest";

import { stopLabel, stopStanding, stopState } from "./road-speech";

describe("a path stop's spoken label", () => {
  it("says a won stop's score", () => {
    expect(stopLabel("Flight to the Ford", "completed", "42")).toBe("Flight to the Ford, Won, score 42");
    expect(stopStanding("completed", null)).toBe("Won");
  });
  it("says Ended for the stop of a scenario that ends when its last player falls", () => {
    expect(stopLabel("The Black Gate Opens", "completed", "310", true)).toBe("The Black Gate Opens, Ended, score 310");
    expect(stopStanding("completed", null, true)).toBe("Ended");
    expect(stopStanding("current", null, true)).toBe("Next");
  });
  it("names the other standings", () => {
    expect(stopLabel("The Ring Goes South", "current", undefined)).toBe("The Ring Goes South, Next");
    expect(stopStanding("locked", "9")).toBe("Locked");
    expect(stopStanding("soon", null)).toBe("Coming soon");
  });
  it("marks a stop that cannot be opened as disabled", () => {
    expect(stopState(false)).toEqual({ disabled: true });
    expect(stopState(true)).toEqual({ disabled: false });
  });
});
