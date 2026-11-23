// Rules: rr.setup, hob.setup-dungeons-deep-and-caverns-dim, hob.riddle-area, hob.bilbo-baggins-ohauh, easy-mode.the-hobbit (data/rules/entries.json); docs/scenarios/the-hobbit/dungeons-deep-and-caverns-dim.md (Dungeons Deep and Caverns Dim).
import { describe, expect, it } from "vitest";

import { loadAnyScenario } from "../../../../scripts/data/load-scenarios.ts";
import { goldenState } from "../../../../test/harness/golden-state.ts";
import { dimLoadout } from "../../../../test/scenarios/dungeons-deep-and-caverns-dim/game.ts";

// What is Dungeons Deep and Caverns Dim's own in the standalone game: the encounter cards dealt in their Normal counts, the Easy Mode sheet's count of the Goblins' Caves, and the Setup (Bilbo Baggins dealt to the first seat only and no
// Ring-bearer; Lake in the Cavern staged; the riddle area made with Riddles in the Dark and Gollum, the Ring on Bilbo). The Nightmare deck is out of scope of this box's scenarios. The cycle checks (a part of its cycle, no campaign card,
// playable, scored and recorded as a standalone run with nothing earned, the loss reasons) are the golden suite's (test/harness/golden-suite.ts, standalone: true).
const dim = loadAnyScenario("dungeons-deep-and-caverns-dim");
const codesIn = (name: string, zone: string): string[] => Object.values(goldenState(dim.id, name).cards).filter((card) => card.zone === zone).map((card) => card.code);

describe("Dungeons Deep and Caverns Dim in the the-hobbit cycle", () => {
  it("hob.setup-dungeons-deep-and-caverns-dim deals every encounter card in its Normal count, the two sets together", () => {
    const state = goldenState(dim.id, "solo win");
    for (const card of dim.cards.filter((one) => one.pile === "encounter")) {
      const dealt = Object.values(state.cards).filter((one) => one.code === card.code).length;
      expect(dealt, card.code).toBe(card.normal);
    }
  });

  it("easy-mode.the-hobbit keeps 2 Goblins' Caves in Easy, as the Easy Mode sheet says, where DragnCards' file holds 1", () => {
    expect(dim.cards.find((card) => card.code === "131065")?.easy).toBe(2);
  });

  it("131029:A:1 makes the riddle area at Setup: Riddles in the Dark and Gollum lie in it and the quest deck holds Into the Fire alone", () => {
    expect(codesIn("solo loss: threat 50", "riddleArea").sort()).toEqual(["131030", "131074"]);
    expect(codesIn("solo loss: threat 50", "questDeck")).toEqual(["131031"]);
  });

  it("deals Bilbo Baggins to the first seat only, in front of its heroes, and no seat holds a Ring-bearer", () => {
    const seats = dimLoadout(2);
    expect(seats.map((seat) => seat.heroes)).toEqual([["131001", "q1", "q2", "q3"], ["q4", "q5", "q6"]]);
  });

  it("131030:A:1 attaches the one Bilbo's Magic Ring to Bilbo Baggins at Setup", () => {
    const state = goldenState(dim.id, "solo loss: threat 50");
    const rings = Object.values(state.cards).filter((card) => card.code === "131079");
    expect(rings).toHaveLength(1);
    expect(state.cards[rings[0]?.host ?? ""]?.code).toBe("131001");
  });

  it("131078:A:2 stages Lake in the Cavern at Setup, and it leaves the game when stage 3 is reached", () => {
    expect(codesIn("solo win", "removed")).toContain("131078");
    expect(codesIn("solo loss: threat 50", "staging")).toContain("131078");
  });
});
