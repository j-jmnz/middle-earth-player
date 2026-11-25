// Rules: rr.setup, rr.winning-the-game, hrd.setup-the-long-arm-of-mordor, hrd.heroes-in-the-staging-area (data/rules/entries.json).
// What is The Long Arm of Mordor's own in the standalone game: no Nightmare deck (the cycle's Nightmare decks are not dealt), and the same Setup on Easy and Normal (every hero in the staging area, one Sauron's Enforcers staged for each player and the other copies
// in the encounter deck, the Uruk Chieftain set aside, one objective-hero for each player). The cycle checks (a part of its cycle, no campaign card, playable, scored and recorded as a standalone run with nothing earned, the loss reasons) are the golden
// suite's (test/harness/golden-suite.ts, standalone: true).
import { describe, expect, it } from "vitest";

import { expectOk } from "../../../rules/core/test-fixture.ts";
import { reduce, startScenario } from "../../../rules/engine/reduce.ts";

import { loadAnyScenario } from "../../../../scripts/data/load-scenarios.ts";
import { mordorStart, mordorWorld } from "../../../../test/scenarios/the-long-arm-of-mordor/game.ts";

const mordor = loadAnyScenario("the-long-arm-of-mordor");

async function opened(seatCount: 1 | 2, difficulty: "Easy" | "Normal") {
  const { ctx } = await mordorWorld();
  // Each seat keeps its opening hand, then the Setup runs.
  let state = startScenario(mordorStart(seatCount, 1, difficulty), ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  return state;
}
const zonesOf = (state: Awaited<ReturnType<typeof opened>>, code: string) => Object.values(state.cards).filter((card) => card.code === code).map((card) => card.zone);

describe("The Long Arm of Mordor in the haradrim cycle", () => {
  it("has no Nightmare deck to deal", () => {
    expect(mordor.nightmare).toBeUndefined();
  });

  it("16071:A:1 stages one Sauron's Enforcers for each player and keeps the other copies in the encounter deck, on Easy and Normal alike", async () => {
    for (const difficulty of ["Easy", "Normal"] as const) {
      for (const seatCount of [1, 2] as const) {
        const state = await opened(seatCount, difficulty);
        const enforcers = zonesOf(state, "16035");
        const label = `${difficulty} ${seatCount}`;
        expect(enforcers, label).toHaveLength(4);
        expect(enforcers.filter((zone) => zone === "staging"), label).toHaveLength(seatCount);
        expect(enforcers.filter((zone) => zone === "encounterDeck"), label).toHaveLength(4 - seatCount);
        expect(zonesOf(state, "16061"), label).toEqual(["setAside"]);
      }
    }
  });
});
