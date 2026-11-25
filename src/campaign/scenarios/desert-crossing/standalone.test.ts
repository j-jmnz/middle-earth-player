// Rules: rr.setup, rr.winning-the-game, hrd.heat-tracker, hrd.setup-desert-crossing (data/rules/entries.json).
// What is Desert Crossing's own in the standalone game: no Nightmare deck (the cycle's Nightmare decks are not dealt), and the same Setup on Easy and Normal (one Burnt Sands staged for each player, the other copies in the encounter deck, the temperature at 10).
// The cycle checks (a part of its cycle, no campaign card, playable, scored and recorded as a standalone run with nothing earned, the loss reasons) are the golden suite's (test/harness/golden-suite.ts, standalone: true).
import { describe, expect, it } from "vitest";

import { temperatureOf } from "../../../rules/families/haradrim/heat.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";
import { reduce, startScenario } from "../../../rules/engine/reduce.ts";

import { loadAnyScenario } from "../../../../scripts/data/load-scenarios.ts";
import { crossingStart, crossingWorld } from "../../../../test/scenarios/desert-crossing/game.ts";

const crossing = loadAnyScenario("desert-crossing");

async function opened(seatCount: 1 | 2, difficulty: "Easy" | "Normal") {
  const { ctx } = await crossingWorld();
  // Each seat keeps its opening hand, then the Setup runs.
  let state = startScenario(crossingStart(seatCount, 1, difficulty), ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  return state;
}
const zonesOf = (state: Awaited<ReturnType<typeof opened>>, code: string) => Object.values(state.cards).filter((card) => card.code === code).map((card) => card.zone);

describe("Desert Crossing in the haradrim cycle", () => {
  it("has no Nightmare deck to deal", () => {
    expect(crossing.nightmare).toBeUndefined();
  });

  it("16068:A:1 stages one Burnt Sands for each player, keeps the other copies of the four in the encounter deck and sets the temperature to 10, on Easy and Normal alike", async () => {
    for (const difficulty of ["Easy", "Normal"] as const) {
      for (const seatCount of [1, 2] as const) {
        const state = await opened(seatCount, difficulty);
        const sands = zonesOf(state, "16025");
        const label = `${difficulty} ${seatCount}`;
        expect(sands, label).toHaveLength(4);
        expect(sands.filter((zone) => zone === "staging"), label).toHaveLength(seatCount);
        expect(sands.filter((zone) => zone === "encounterDeck"), label).toHaveLength(4 - seatCount);
        expect(temperatureOf(state), label).toBe(10);
      }
    }
  });
});
