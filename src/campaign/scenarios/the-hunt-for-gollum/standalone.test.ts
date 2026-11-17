// Rules: rr.setup (data/rules/entries.json).
// What is the scenario's own in the standalone game: the Nightmare deck dealt on Nightmare. The cycle checks (a part of its cycle, no campaign card, playable, scored and recorded as a standalone run with nothing earned, the loss reasons) are the golden suite's (test/harness/golden-suite.ts).
import { describe, expect, it } from "vitest";

import { loadAnyScenario } from "../../../../scripts/data/load-scenarios.ts";
import { goldenState } from "../../../../test/harness/golden-state.ts";

const gollum = loadAnyScenario("the-hunt-for-gollum");

describe("The Hunt for Gollum in the shadows-of-mirkwood cycle", () => {
  it("deals its Nightmare deck on Nightmare (every card of it has a record)", () => {
    const state = goldenState(gollum.id, "Nightmare two-handed win");
    expect(Object.values(state.cards).some((card) => card.code === gollum.nightmare?.setupCard && card.zone === "nightmare")).toBe(true);
  });
});
