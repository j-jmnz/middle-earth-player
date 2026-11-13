// Rules: mec108.campaign-mode (data/rules/entries.json). 10125:A:1 "Add 1 copy of Carn Dûm Garrison per player to the staging area": the data's counts, for 1 to 4 players at Normal and Easy.
import { describe, expect, it } from "vitest";

import { encounterCodes, setupInstructions } from "../../../catalog/scenario-data.ts";
import { loadScenario } from "../../../../scripts/data/load-scenarios.ts";

const GARRISON = "10129";
const carnDum = loadScenario("the-battle-of-carn-dum");

describe("The Battle of Carn Dûm's Carn Dûm Garrison", () => {
  it("10125:A:1 is staged once for each player, and the copies the Setup does not stage stay in the encounter deck (the set holds 4, 3 on Easy)", () => {
    for (const [difficulty, copies] of [["Normal", 4], ["Easy", 3]] as const) {
      for (const seats of [1, 2, 3, 4]) {
        const staged = setupInstructions(carnDum, difficulty, seats).filter((step) => step.verb === "AddToStaging" && step.code === GARRISON).length;
        const deck = encounterCodes(carnDum, difficulty, seats).filter((code) => code === GARRISON).length;
        expect(staged, `${difficulty}, ${seats} players`).toBe(Math.min(seats, copies));
        expect(staged + deck, `${difficulty}, ${seats} players`).toBe(copies);
      }
    }
  });
});
