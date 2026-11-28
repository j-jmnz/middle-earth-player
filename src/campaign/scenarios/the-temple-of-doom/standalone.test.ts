// Rules: vom.setup-the-temple-of-doom, vom.power-of-mordor-deck-the-temple-of-doom (data/rules/entries.json).
// What is The Temple of Doom's own in the standalone game: no Nightmare deck, and the Setup, the same on Easy and Normal (the four stage 2 cards in the quest deck, the Power of Mordor deck of five cards, Thane Ulchor and
// Tribute to Mordor in the staging area). The cycle checks (a part of its cycle, no campaign card, playable, scored and recorded as a standalone run with nothing earned, the loss reasons) are the golden suite's
// (test/harness/golden-suite.ts, standalone: true).
import { describe, expect, it } from "vitest";

import { expectOk } from "../../../rules/core/test-fixture.ts";
import { reduce, startScenario } from "../../../rules/engine/reduce.ts";

import { loadAnyScenario } from "../../../../scripts/data/load-scenarios.ts";
import { templedoomStart, templedoomWorld } from "../../../../test/scenarios/the-temple-of-doom/game.ts";

const templedoom = loadAnyScenario("the-temple-of-doom");

async function opened(seatCount: 1 | 2, difficulty: "Easy" | "Normal") {
  const { ctx } = await templedoomWorld();
  let state = startScenario(templedoomStart(seatCount, 1, difficulty), ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  return state;
}
const zonesOf = (state: Awaited<ReturnType<typeof opened>>, code: string) => Object.values(state.cards).filter((card) => card.code === code).map((card) => card.zone);

describe("The Temple of Doom in the vengeance-of-mordor cycle", () => {
  it("has no Nightmare deck to deal", () => {
    expect(templedoom.nightmare).toBeUndefined();
  });

  it("21080:A:1 builds the Power of Mordor deck, keeps the stage 2 cards in the quest deck and stages Thane Ulchor and Tribute to Mordor, on Easy and Normal, one and two players", async () => {
    for (const seatCount of [1, 2] as const) {
      for (const difficulty of ["Easy", "Normal"] as const) {
        const state = await opened(seatCount, difficulty);
        const label = `${seatCount} ${difficulty}`;
        for (const code of ["21066", "21067", "21068", "21069", "21070"]) expect(zonesOf(state, code), `${label} ${code}`).toEqual(["powerOfMordorDeck"]);
        expect(zonesOf(state, "21053"), label).toEqual(["staging"]);
        expect(zonesOf(state, "21054"), label).toEqual(["staging"]);
        expect(state.cards[state.questStage ?? ""], label).toMatchObject({ code: "21080", face: "B" });
        expect(Object.values(state.cards).filter((card) => card.zone === "questDeck").map((card) => card.code).sort(), label).toEqual(["21081", "21083", "21084", "21085"]);
      }
    }
  });
});
