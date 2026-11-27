import { describe, expect, it } from "vitest";

import { stageStepLine } from "./stage-steps.ts";

const name = (id: string) => `Card ${id}`;

describe("the log line of a stage that leaves the quest or of control that passes", () => {
  it("tells a removed stage, a stage set aside and control passing with the first player token", () => {
    expect(stageStepLine({ kind: "stageLeaves", cardId: "7", how: "removed", cause: { rule: "r" } }, name)).toBe("Card 7 leaves the game");
    expect(stageStepLine({ kind: "stageLeaves", cardId: "7", how: "setAside", cause: { rule: "r" } }, name)).toBe("Card 7 is set aside");
    expect(stageStepLine({ kind: "controlPasses", cardId: "9", seat: 1, cause: { rule: "r" } }, name)).toBe("Card 9 passes to Player 2 with the first player token");
  });
});
