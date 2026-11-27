// Rules: rr.setup, rr.winning-the-game, hrd.setup-beneath-the-sands, hrd.search-objective (data/rules/entries.json).
// What is Beneath the Sands's own in the standalone game: no Nightmare deck (the cycle's Nightmare decks are not dealt), and the Setup of Searching the Caves on Easy and Normal alike (the Search objective Off Track in the staging area,
// Brood Mother set aside, out of play). The cycle checks (a part of its cycle, no campaign card, playable, scored and recorded as a standalone run with nothing earned, the loss reasons) are the golden suite's
// (test/harness/golden-suite.ts, standalone: true).
import { describe, expect, it } from "vitest";

import { expectOk } from "../../../rules/core/test-fixture.ts";
import { reduce, startScenario } from "../../../rules/engine/reduce.ts";

import { loadAnyScenario } from "../../../../scripts/data/load-scenarios.ts";
import { sandsStart, sandsWorld } from "../../../../test/scenarios/beneath-the-sands/game.ts";

const sands = loadAnyScenario("beneath-the-sands");

async function opened(seatCount: 1 | 2, difficulty: "Easy" | "Normal") {
  const { ctx } = await sandsWorld();
  let state = startScenario(sandsStart(seatCount, 1, difficulty), ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  return state;
}
const zonesOf = (state: Awaited<ReturnType<typeof opened>>, code: string) => Object.values(state.cards).filter((card) => card.code === code).map((card) => card.zone);

describe("Beneath the Sands in the haradrim cycle", () => {
  it("has no Nightmare deck to deal", () => {
    expect(sands.nightmare).toBeUndefined();
  });

  it("17076:A:1 sets Brood Mother aside and adds the Search objective Off Track to the staging area, on Easy and Normal, true solo and two-handed", async () => {
    for (const difficulty of ["Easy", "Normal"] as const) {
      for (const seatCount of [1, 2] as const) {
        const state = await opened(seatCount, difficulty);
        const label = `${difficulty} ${seatCount}`;
        expect(zonesOf(state, "17065"), label).toEqual(["setAside"]);
        expect(zonesOf(state, "17079"), label).toEqual(["staging"]);
        expect(state.cards[state.questStage ?? ""], label).toMatchObject({ code: "17076", face: "B" });
      }
    }
  });
});
