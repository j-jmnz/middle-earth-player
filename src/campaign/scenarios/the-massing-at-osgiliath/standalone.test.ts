// Rules: rr.setup (data/rules/entries.json).
// What is The Massing at Osgiliath's own in the standalone game: Beyond Expectations' Setup and what Easy deals. The cycle checks (a part of its cycle, no campaign card, playable, scored and recorded as a standalone run with nothing earned,
// the loss reasons) are the golden suite's (test/harness/golden-suite.ts, standalone: true). The scenario has no Nightmare deck.
import { describe, expect, it } from "vitest";

import { expectOk } from "../../../rules/core/test-fixture.ts";
import { reduce, startScenario } from "../../../rules/engine/reduce.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";

import { osgiliathStart, osgiliathWorld } from "../../../../test/scenarios/the-massing-at-osgiliath/game.ts";
import { loadAnyScenario } from "../../../../scripts/data/load-scenarios.ts";

const cardsOf = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);
// The game started and the Setup played (every seat keeps its hand), as the golden suite opens one.
async function opened(seatCount: 1 | 2, difficulty: "Normal" | "Easy"): Promise<ScenarioState> {
  const { ctx } = await osgiliathWorld("strong");
  let state = startScenario(osgiliathStart(seatCount, 1, difficulty), ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  return state;
}

describe("The Massing at Osgiliath in the standalone-scenarios cycle", () => {
  it("has no Nightmare deck", () => {
    expect(loadAnyScenario("the-massing-at-osgiliath").nightmare).toBeUndefined();
  });

  it("00016:A:1 Setup adds one of each Scout title for each player to the staging area, sets the Witch-king aside and shuffles the other Scouts into the encounter deck", async () => {
    for (const seatCount of [1, 2] as const) {
      const state = await opened(seatCount, "Normal");
      for (const code of ["00002", "00003", "00004"]) {
        expect(cardsOf(state, code).filter((card) => card.zone === "staging"), `${code} for ${seatCount}`).toHaveLength(seatCount);
        expect(cardsOf(state, code).filter((card) => card.zone === "encounterDeck"), `${code} left in the deck for ${seatCount}`).toHaveLength(4 - seatCount);
      }
      expect(cardsOf(state, "00001").map((card) => card.zone)).toEqual(["setAside"]);
    }
  });

  it("Easy deals the Normal deck: both Rangers of Ithilien and every encounter card", async () => {
    const normal = await opened(1, "Normal");
    const easy = await opened(1, "Easy");
    const counts = (state: ScenarioState) => Object.values(state.cards).reduce<Record<string, number>>((all, card) => ({ ...all, [card.code]: (all[card.code] ?? 0) + 1 }), {});
    expect(counts(easy)).toEqual(counts(normal));
    expect(counts(easy)["00015"]).toBe(2);
  });
});
