// Rules: none (a scenario with no Nightmare deck).
// What is The Hunt for the Dreadnaught's own in the standalone game. Its Setup is the golden suite's opening check (golden.test.ts); the cycle checks (a part of its cycle, no campaign card, playable, scored and recorded as a
// standalone run with nothing earned, the loss reasons) are the golden suite's too (test/harness/golden-suite.ts, standalone: true).
import { describe, expect, it } from "vitest";

import { dreadnaughtStart, dreadnaughtWorld } from "../../../../test/scenarios/the-hunt-for-the-dreadnaught/game.ts";
import { loadAnyScenario } from "../../../../scripts/data/load-scenarios.ts";
import { reduce, startScenario } from "../../../rules/engine/reduce.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";

describe("The Hunt for the Dreadnaught in the standalone-scenarios cycle", () => {
  it("has no Nightmare deck", () => {
    expect(loadAnyScenario("the-hunt-for-the-dreadnaught").nightmare).toBeUndefined();
  });

  it("deals Standard Mode on Normal and Easy Mode on Easy, the Corsair deck of 13 apart from the encounter deck, and 41, 39 and 39 encounter cards after Setup (1 player, 2 players, 1 player on Easy)", async () => {
    const { ctx } = await dreadnaughtWorld();
    const played = (seats: 1 | 2, difficulty: "Easy" | "Normal") => {
      let state = startScenario(dreadnaughtStart(seats, 1, difficulty), ctx);
      while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
      for (let guard = 0; guard < 40 && state.window?.kind === "choose"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: state.window.options[0] ?? "" }, ctx)).state;
      return state;
    };
    const normal = played(1, "Normal");
    const easy = played(1, "Easy");
    expect(Object.values(normal.cards).find((card) => card.zone === "modeCard")?.code).toBe("40002");
    expect(Object.values(easy.cards).find((card) => card.zone === "modeCard")?.code).toBe("40001");
    expect(normal.corsairDeck).toHaveLength(13);
    expect(normal.encounterDeck).toHaveLength(41);
    expect(played(2, "Normal").encounterDeck).toHaveLength(39);
    expect(easy.encounterDeck).toHaveLength(39);
  });
});
