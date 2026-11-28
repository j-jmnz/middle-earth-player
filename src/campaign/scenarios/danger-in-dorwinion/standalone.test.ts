// Rules: vom.setup-danger-in-dorwinion (data/rules/entries.json).
// What is Danger in Dorwinion's own in the standalone game: no Nightmare deck, and the Setup, the same on Easy and Normal (the Plot objectives and the Cultist enemies set aside, each player's searched location, Side
// Street the first player's, in the staging area). The cycle checks (a part of its cycle, no campaign card, playable, scored and recorded as a standalone run with nothing earned, the loss reasons) are the golden suite's
// (test/harness/golden-suite.ts, standalone: true).
import { describe, expect, it } from "vitest";

import { printedOf } from "../../../rules/core/printed.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";
import { reduce, startScenario } from "../../../rules/engine/reduce.ts";

import { loadAnyScenario } from "../../../../scripts/data/load-scenarios.ts";
import { dorwinionStart, dorwinionWorld } from "../../../../test/scenarios/danger-in-dorwinion/game.ts";

const dorwinion = loadAnyScenario("danger-in-dorwinion");

// The Setup's questions answered with the first option each.
async function opened(seatCount: 1 | 2, difficulty: "Easy" | "Normal") {
  const { cards, ctx } = await dorwinionWorld();
  let state = startScenario(dorwinionStart(seatCount, 1, difficulty), ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  while (state.window?.kind === "choose") state = expectOk(reduce(state, { type: "Choose", optionId: state.window.options[0] ?? "" }, ctx)).state;
  return { state, cards };
}
const zonesOf = (state: Awaited<ReturnType<typeof opened>>["state"], code: string) => Object.values(state.cards).filter((card) => card.code === code).map((card) => card.zone);

describe("Danger in Dorwinion in the vengeance-of-mordor cycle", () => {
  it("has no Nightmare deck to deal", () => {
    expect(dorwinion.nightmare).toBeUndefined();
  });

  it("21077:A:1 sets the Plot objectives and the Cultist enemies aside and adds Side Street to the staging area, on Easy and Normal, true solo", async () => {
    for (const difficulty of ["Easy", "Normal"] as const) {
      const { state, cards } = await opened(1, difficulty);
      for (const code of ["21033", "21034", "21035", "21030", "21031", "21032"]) expect(zonesOf(state, code), `${difficulty} ${code}`).toEqual(["setAside"]);
      const staged = Object.values(state.cards).filter((card) => card.zone === "staging").map((card) => card.code);
      expect(staged, difficulty).toContain("21049");
      expect(printedOf(cards, "21049").type).toBe("location");
      expect(state.cards[state.questStage ?? ""], difficulty).toMatchObject({ code: "21077", face: "B" });
    }
  });

  it("21077:A:1 adds a different location for the second player, and Side Street is the first player's", async () => {
    const { state, cards } = await opened(2, "Normal");
    const locations = Object.values(state.cards).filter((card) => card.zone === "staging" && printedOf(cards, card.code).type === "location");
    expect(locations.length).toBeGreaterThanOrEqual(2);
    expect(new Set(locations.map((card) => printedOf(cards, card.code).name)).size).toBeGreaterThanOrEqual(2);
    expect(locations.some((card) => card.code === "21049")).toBe(true);
  });
});
