// Rules: rr.setup, sotm.emyn-muil-victory-points (data/rules/entries.json).
// What is the scenario's own in the standalone game: the Nightmare deck dealt on Nightmare. The cycle checks (a part of its cycle, no campaign card, playable, scored and recorded as a standalone run with nothing earned, the loss reasons) are the golden suite's (test/harness/golden-suite.ts).
import { describe, expect, it } from "vitest";

import { loadAnyScenario } from "../../../../scripts/data/load-scenarios.ts";
import { goldenState } from "../../../../test/harness/golden-state.ts";

const muil = loadAnyScenario("the-hills-of-emyn-muil");

describe("The Hills of Emyn Muil in the shadows-of-mirkwood cycle", () => {
  it("deals its Nightmare deck on Nightmare, and a Nightmare win ends on the one stage with no Emyn Muil location in play", () => {
    const state = goldenState(muil.id, "Nightmare two-handed win");
    expect(Object.values(state.cards).some((card) => card.code === muil.nightmare?.setupCard && card.zone === "nightmare")).toBe(true);
    expect(state.cards[state.questStage ?? ""]?.code).toBe("02082");
  });
});
