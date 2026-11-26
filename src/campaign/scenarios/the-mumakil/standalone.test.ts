// Rules: rr.setup, rr.winning-the-game, hrd.setup-the-mumakil (data/rules/entries.json).
// What is The Mûmakil's own in the standalone game: no Nightmare deck (the cycle's Nightmare decks are not dealt), and the same Setup on Easy and Normal (the four Wild Mûmak and the four Captures set aside, each player adds one
// different location to the staging area, and the quest starts on stage 1). The cycle checks (a part of its cycle, no campaign card, playable, scored and recorded as a standalone run with nothing earned, the loss reasons)
// are the golden suite's (test/harness/golden-suite.ts, standalone: true).
import { describe, expect, it } from "vitest";

import { expectOk } from "../../../rules/core/test-fixture.ts";
import { reduce, startScenario } from "../../../rules/engine/reduce.ts";

import { loadAnyScenario } from "../../../../scripts/data/load-scenarios.ts";
import { mumakilStart, mumakilWorld } from "../../../../test/scenarios/the-mumakil/game.ts";

const mumakil = loadAnyScenario("the-mumakil");

async function opened(seatCount: 1 | 2, difficulty: "Easy" | "Normal") {
  const { ctx } = await mumakilWorld();
  // Each seat keeps its opening hand, then the Setup runs.
  let state = startScenario(mumakilStart(seatCount, 1, difficulty), ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  // Each player picks his different location: the first offered.
  for (let guard = 0; guard < 10 && state.window?.kind === "choose"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: state.window.options[0] ?? "" }, ctx)).state;
  return state;
}
const zonesOf = (state: Awaited<ReturnType<typeof opened>>, codes: readonly string[]) => Object.values(state.cards).filter((card) => codes.includes(card.code)).map((card) => card.zone);

describe("The Mûmakil in the haradrim cycle", () => {
  it("has no Nightmare deck to deal", () => {
    expect(mumakil.nightmare).toBeUndefined();
  });

  it("17026:A:1 sets the four Wild Mûmak and the four Captures aside and adds one different location for each player, on Easy and Normal alike", async () => {
    for (const difficulty of ["Easy", "Normal"] as const) {
      for (const seatCount of [1, 2] as const) {
        const state = await opened(seatCount, difficulty);
        const label = `${difficulty} ${seatCount}`;
        expect(zonesOf(state, ["17015"]), label).toEqual(["setAside", "setAside", "setAside", "setAside"]);
        expect(zonesOf(state, ["17011", "17012", "17013", "17014"]), label).toEqual(["setAside", "setAside", "setAside", "setAside"]);
        const staged = Object.values(state.cards).filter((card) => card.zone === "staging" && ["17020", "16056", "16057", "16058"].includes(card.code));
        expect(staged, label).toHaveLength(seatCount);
        expect(new Set(staged.map((card) => card.code)).size, label).toBe(seatCount);
      }
    }
  });
});
