// Rules: rr.setup, hrd.setup-race-across-harad, hrd.prepare-the-orcs-area (data/rules/entries.json); ledger line 17047:A:1.
// What is Race Across Harad's own in the standalone game: no Nightmare deck (the cycle's Nightmare decks are not dealt), and the same Setup on Easy and Normal (each player takes a Tamed Mûmak and the others leave the game, the Orcs' area holds Uruk Chieftain with the
// Orcs' stage 1D in play, River Harnen and one Uruk Warg-rider stay set aside). The cycle checks (a part of its cycle, no campaign card, playable, scored and recorded as a standalone run with nothing earned, the loss reasons) are the golden suite's
// (test/harness/golden-suite.ts, standalone: true).
import { describe, expect, it } from "vitest";

import { expectOk } from "../../../rules/core/test-fixture.ts";
import { reduce, startScenario } from "../../../rules/engine/reduce.ts";

import { loadAnyScenario } from "../../../../scripts/data/load-scenarios.ts";
import { haradStart, haradWorld } from "../../../../test/scenarios/race-across-harad/game.ts";

const harad = loadAnyScenario("race-across-harad");

async function opened(seatCount: 1 | 2, difficulty: "Easy" | "Normal") {
  const { ctx } = await haradWorld();
  // Each seat keeps its opening hand, then the Setup runs.
  let state = startScenario(haradStart(seatCount, 1, difficulty), ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  return state;
}
const zonesOf = (state: Awaited<ReturnType<typeof opened>>, code: string) => Object.values(state.cards).filter((card) => card.code === code).map((card) => card.zone).sort();

describe("Race Across Harad in the haradrim cycle", () => {
  it("has no Nightmare deck to deal", () => {
    expect(harad.nightmare).toBeUndefined();
  });

  it("17047:A:1 gives each player a Tamed Mûmak, leaves the other three out of the game and prepares the Orcs' area, on Easy and Normal alike", async () => {
    for (const difficulty of ["Easy", "Normal"] as const) {
      for (const seats of [1, 2] as const) {
        const state = await opened(seats, difficulty);
        expect(zonesOf(state, "17038"), `${difficulty} ${seats}`).toEqual([...Array(seats).fill("play"), ...Array(4 - seats).fill("removed")].sort());
        expect(state.orcs?.number, `${difficulty} ${seats}`).toBe(1);
        expect(state.cards[state.orcs?.stage ?? ""]?.code).toBe("17051");
        // The players start at stage 1, the Orcs' stage: the Chieftain stands in the staging area.
        expect(zonesOf(state, "16061")).toEqual(["staging"]);
        expect(zonesOf(state, "17039")).toEqual(["setAside"]);
        expect(zonesOf(state, "16063").filter((zone) => zone === "setAside")).toHaveLength(1);
      }
    }
  });
});
