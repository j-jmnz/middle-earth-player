// Rules: rr.setup, rr.winning-the-game, hrd.setup-escape-from-umbar (data/rules/entries.json).
// What is Escape from Umbar's own in the standalone game: the encounter deck's counts on Easy and Normal (Stranded in Umbar's Setup finds the five locations and one Umbar Sentry for each player in it), and no Nightmare deck (the cycle's Nightmare decks are not dealt).
// The cycle checks (a part of its cycle, no campaign card, playable, scored and recorded as a standalone run with nothing earned, the loss reasons) are the golden suite's (test/harness/golden-suite.ts, standalone: true).
import { describe, expect, it } from "vitest";

import { expectOk } from "../../../rules/core/test-fixture.ts";
import { reduce, startScenario } from "../../../rules/engine/reduce.ts";

import { loadAnyScenario } from "../../../../scripts/data/load-scenarios.ts";
import { umbarStart, umbarWorld } from "../../../../test/scenarios/escape-from-umbar/game.ts";

const umbar = loadAnyScenario("escape-from-umbar");

async function opened(seatCount: 1 | 2, difficulty: "Easy" | "Normal") {
  const { ctx } = await umbarWorld();
  // Each seat keeps its opening hand, then the Setup runs and each player picks the first location it offers.
  let state = startScenario(umbarStart(seatCount, 1, difficulty), ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  for (let guard = 0; guard < 10 && state.window?.kind === "choose"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: state.window.options[0] ?? "" }, ctx)).state;
  return state;
}
const zonesOf = (state: Awaited<ReturnType<typeof opened>>, code: string) => Object.values(state.cards).filter((card) => card.code === code).map((card) => card.zone);

describe("Escape from Umbar in the haradrim cycle", () => {
  it("has no Nightmare deck to deal", () => {
    expect(umbar.nightmare).toBeUndefined();
  });

  it("16066:A:1 puts one Umbar Sentry into play engaged with each player, and the encounter deck holds the rest of the five (Normal)", async () => {
    for (const seatCount of [1, 2] as const) {
      const state = await opened(seatCount, "Normal");
      const sentries = zonesOf(state, "16015");
      expect(sentries.filter((zone) => zone === "engaged"), String(seatCount)).toHaveLength(seatCount);
      expect(sentries, String(seatCount)).toHaveLength(5);
    }
  });

  it("16066:A:1 puts only the locations the players picked into the staging area and leaves the others in the encounter deck, on Easy and Normal alike", async () => {
    for (const difficulty of ["Easy", "Normal"] as const) {
      const state = await opened(2, difficulty);
      const locations = ["16016", "16017", "16018", "16019", "16020"].flatMap((code) => zonesOf(state, code));
      expect(locations.filter((zone) => zone === "staging"), difficulty).toHaveLength(2);
      expect(locations.filter((zone) => zone === "encounterDeck").length, difficulty).toBeGreaterThanOrEqual(3);
    }
  });
});
