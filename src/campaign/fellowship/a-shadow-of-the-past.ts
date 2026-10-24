import { encounterCodes } from "../../catalog/scenario-fixture.ts";
import type { StartScenario } from "../../rules/setup.ts";
import type { ScenarioScript, ScriptInput } from "../script.ts";

// The Normal encounter deck (42 cards) and the three quest stages come from the fixture.
// The cards outside both piles are put out by the quest-card setup instructions in the definition.
export const aShadowOfThePast: ScenarioScript = {
  id: "a-shadow-of-the-past",
  start(input: ScriptInput): StartScenario {
    return {
      seatCount: input.seatCount,
      seed: input.seed,
      threatModifier: input.threatModifier,
      definition: input.definition,
      seats: input.seats,
      encounterDeck: encounterCodes(input.fixture),
      questDeck: input.fixture.stages,
    };
  },
};
