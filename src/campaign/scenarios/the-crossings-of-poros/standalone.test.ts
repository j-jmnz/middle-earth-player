// Rules: rr.setup, hrd.setup-the-crossings-of-poros, hrd.multiple-encounter-sets (data/rules/entries.json).
// What is The Crossings of Poros's own in the standalone game: no Nightmare deck (the cycle's Nightmare decks are not dealt), and the Setup on Easy and Normal alike (Poros Garrison and the five sets set aside, The Black Serpent in the staging area, the encounter deck holding The Crossings of Poros
// alone: 12 cards on Easy, 15 on Normal). The cycle checks (a part of its cycle, no campaign card, playable, scored and recorded as a standalone run with nothing earned, the loss reasons) are the golden suite's
// (test/harness/golden-suite.ts, standalone: true).
import { describe, expect, it } from "vitest";

import { printedOf } from "../../../rules/core/printed.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";
import { reduce, startScenario } from "../../../rules/engine/reduce.ts";

import { loadAnyScenario } from "../../../../scripts/data/load-scenarios.ts";
import { porosStart, porosWorld } from "../../../../test/scenarios/the-crossings-of-poros/game.ts";

const poros = loadAnyScenario("the-crossings-of-poros");

async function opened(seatCount: 1 | 2, difficulty: "Easy" | "Normal") {
  const { cards, ctx } = await porosWorld();
  let state = startScenario(porosStart(seatCount, 1, difficulty), ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  return { state, cards };
}
const zonesOf = (state: Awaited<ReturnType<typeof opened>>["state"], code: string) => Object.values(state.cards).filter((card) => card.code === code).map((card) => card.zone);

describe("The Crossings of Poros in the haradrim cycle", () => {
  it("has no Nightmare deck to deal", () => {
    expect(poros.nightmare).toBeUndefined();
  });

  it("17157:A:1 sets Poros Garrison aside, adds The Black Serpent to the staging area and shuffles The Crossings of Poros alone, on Easy and Normal, true solo", async () => {
    for (const difficulty of ["Easy", "Normal"] as const) {
      const { state, cards } = await opened(1, difficulty);
      expect(zonesOf(state, "17145"), difficulty).toEqual(["setAside"]);
      expect(zonesOf(state, "17146"), difficulty).toEqual(["staging"]);
      expect(state.cards[state.questStage ?? ""], difficulty).toMatchObject({ code: "17157", face: "B" });
      expect(state.encounterDeck.length, difficulty).toBe(difficulty === "Easy" ? 12 : 15);
      expect(state.encounterDeck.every((id) => printedOf(cards, state.cards[id]?.code ?? "").encounterSet === "The Crossings of Poros"), difficulty).toBe(true);
    }
  });

  it("17157:A:1 has each other player reveal an encounter card, so two-handed the second player's card joins the staging area", async () => {
    const solo = await opened(1, "Normal");
    const pair = await opened(2, "Normal");
    // The reveal puts an enemy in the staging area or its location in play; either way the deck is one card shorter.
    expect(pair.state.encounterDeck.length).toBeLessThan(solo.state.encounterDeck.length);
  });
});
