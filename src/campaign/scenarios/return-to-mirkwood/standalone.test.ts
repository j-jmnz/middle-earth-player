// Rules: rr.setup, sotm.guarding-gollum (data/rules/entries.json).
// What is the scenario's own in the standalone game: the Nightmare deck dealt on Nightmare. The cycle checks (a part of its cycle, no campaign card, playable, scored and recorded as a standalone run with nothing earned, the loss reasons) are the golden suite's (test/harness/golden-suite.ts).
import { describe, expect, it } from "vitest";

import { guardianSeat } from "../../../rules/families/guardian/seats.ts";
import { loadAnyScenario } from "../../../../scripts/data/load-scenarios.ts";
import { goldenState } from "../../../../test/harness/golden-state.ts";

const returnmirkwood = loadAnyScenario("return-to-mirkwood");

describe("Return to Mirkwood in the shadows-of-mirkwood cycle", () => {
  it("deals its Nightmare deck on Nightmare, and a Nightmare win ends on the last stage with Gollum still guarded", () => {
    const state = goldenState(returnmirkwood.id, "Nightmare two-handed win");
    expect(Object.values(state.cards).some((card) => card.code === returnmirkwood.nightmare?.setupCard && card.zone === "nightmare")).toBe(true);
    expect(state.cards[state.questStage ?? ""]?.code).toBe("02129");
    expect(guardianSeat(state)).not.toBeNull();
  });
});
