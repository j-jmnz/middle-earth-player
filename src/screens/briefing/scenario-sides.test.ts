import { describe, expect, it } from "vitest";

import { questSides } from "./scenario-sides.ts";

describe("the briefing's quest cards (user request, 2026-11-01)", () => {
  it("shows each stage on side A then side B, in stage order, labelled by stage and side", () => {
    expect(questSides(["141023"])).toEqual([
      { code: "141023", side: "A", label: "Stage 1A" },
      { code: "141023", side: "B", label: "Stage 1B" },
    ]);
    expect(questSides(["a", "b", "c"]).map((entry) => entry.label)).toEqual(["Stage 1A", "Stage 1B", "Stage 2A", "Stage 2B", "Stage 3A", "Stage 3B"]);
    expect(questSides([])).toEqual([]);
  });
});
