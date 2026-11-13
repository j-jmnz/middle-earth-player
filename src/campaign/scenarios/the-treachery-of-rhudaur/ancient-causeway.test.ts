// Rules: mec108.campaign-mode (data/rules/entries.json). 10094:A:1 "Search the encounter deck for 1 copy of Ancient Causeway, and add it to the staging area (2 copies instead if there are 3 or 4 players in the game)": the data's counts, for 1 to 4 players at Normal and Easy.
import { describe, expect, it } from "vitest";

import { encounterCodes, setupInstructions } from "../../../catalog/scenario-data.ts";
import { loadScenario } from "../../../../scripts/data/load-scenarios.ts";

const CAUSEWAY = "09057";
const rhudaur = loadScenario("the-treachery-of-rhudaur");

describe("The Treachery of Rhudaur's Ancient Causeway", () => {
  it("is staged once with 1 or 2 players and twice with 3 or 4, and the copies the Setup does not stage stay in the encounter deck (the set holds 2)", () => {
    for (const difficulty of ["Normal", "Easy"] as const) {
      for (const seats of [1, 2, 3, 4]) {
        const staged = setupInstructions(rhudaur, difficulty, seats).filter((step) => step.verb === "AddToStaging" && step.code === CAUSEWAY).length;
        const deck = encounterCodes(rhudaur, difficulty, seats).filter((code) => code === CAUSEWAY).length;
        expect(staged, `${difficulty}, ${seats} players`).toBe(seats >= 3 ? 2 : 1);
        expect(staged + deck, `${difficulty}, ${seats} players`).toBe(2);
      }
    }
  });
});
