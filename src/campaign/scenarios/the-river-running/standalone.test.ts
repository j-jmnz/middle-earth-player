// Rules: rr.setup, vom.setup-the-river-running (data/rules/entries.json).
// What is The River Running's own in the standalone game: no Nightmare deck, and the Setup on Easy and Normal alike (Easterling Pursuit and one River Running in the staging area, Warriors of the East set aside, a different Easterling
// enemy for each player staged from the encounter deck, which holds the rest of its 35 cards on Normal and 25 on Easy). The cycle checks (a part of its cycle, no campaign card, playable, scored and recorded as a standalone run with
// nothing earned, the loss reasons) are the golden suite's (test/harness/golden-suite.ts, standalone: true).
import { describe, expect, it } from "vitest";

import { printedOf } from "../../../rules/core/printed.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";
import { reduce, startScenario } from "../../../rules/engine/reduce.ts";

import { loadAnyScenario } from "../../../../scripts/data/load-scenarios.ts";
import { runningStart, runningWorld } from "../../../../test/scenarios/the-river-running/game.ts";

const running = loadAnyScenario("the-river-running");

// The Setup's questions answered with the first option each.
async function opened(seatCount: 1 | 2, difficulty: "Easy" | "Normal") {
  const { cards, ctx } = await runningWorld();
  let state = startScenario(runningStart(seatCount, 1, difficulty), ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  while (state.window?.kind === "choose") state = expectOk(reduce(state, { type: "Choose", optionId: state.window.options[0] ?? "" }, ctx)).state;
  return { state, cards };
}
const zonesOf = (state: Awaited<ReturnType<typeof opened>>["state"], code: string) => Object.values(state.cards).filter((card) => card.code === code).map((card) => card.zone);

describe("The River Running in the vengeance-of-mordor cycle", () => {
  it("has no Nightmare deck to deal", () => {
    expect(running.nightmare).toBeUndefined();
  });

  it("21075:A:1 sets Warriors of the East aside and stages Easterling Pursuit, one River Running and one Easterling enemy for the player, on Easy and Normal, true solo", async () => {
    for (const difficulty of ["Easy", "Normal"] as const) {
      const { state, cards } = await opened(1, difficulty);
      expect(zonesOf(state, "21024"), difficulty).toEqual(["setAside"]);
      expect(zonesOf(state, "21012"), difficulty).toEqual(["staging"]);
      expect(zonesOf(state, "21014").filter((zone) => zone === "staging"), difficulty).toHaveLength(1);
      expect(state.cards[state.questStage ?? ""], difficulty).toMatchObject({ code: "21075", face: "B" });
      const enemies = Object.values(state.cards).filter((card) => card.zone === "staging" && printedOf(cards, card.code).type === "enemy");
      expect(enemies.map((card) => printedOf(cards, card.code).traits.includes("Easterling")), difficulty).toEqual([true]);
      // The deck is the scenario's count less the picked enemy (the other cards the Setup moves are not in the deck count).
      expect(state.encounterDeck.length, difficulty).toBe((difficulty === "Easy" ? 25 : 35) - 1);
    }
  });

  it("21075:A:1 stages a second, different Easterling enemy for the second player", async () => {
    const { state, cards } = await opened(2, "Normal");
    const titles = Object.values(state.cards).filter((card) => card.zone === "staging" && printedOf(cards, card.code).type === "enemy").map((card) => printedOf(cards, card.code).name);
    expect(titles).toHaveLength(2);
    expect(new Set(titles).size).toBe(2);
  });
});
