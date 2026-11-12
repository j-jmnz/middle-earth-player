import { describe, expect, it } from "vitest";

import { scenarioEndsInDefeat } from "./scenario-ends";

describe("scenarioEndsInDefeat", () => {
  it("is true for the scenario whose campaign card holds endsInDefeat (146074:constant:1) and false for every other", () => {
    expect(scenarioEndsInDefeat("the-black-gate-opens")).toBe(true);
    expect(scenarioEndsInDefeat("the-battle-of-the-pelennor-fields")).toBe(false);
    expect(scenarioEndsInDefeat("a-shadow-of-the-past")).toBe(false);
    expect(scenarioEndsInDefeat("not-a-scenario")).toBe(false);
  });
});
