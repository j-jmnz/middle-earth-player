import { encounterCodes } from "../../catalog/scenario-fixture.ts";
import type { StartScenario } from "../../rules/setup.ts";
import type { ScenarioScript, ScriptInput } from "../script.ts";

// The Normal encounter deck (42 cards) and the three quest stages come from the fixture.
// The cards outside both piles are put out by the quest-card setup instructions in the definition.
// The quest card's last Setup step is the encounter deck shuffle (MEC109 #28, 141022; read
// via Hall of Beorn 2026-10-24, confirm on the card). The fixture piles cannot express it, so it follows here.
// Every Fellowship scenario starts with The One Ring on the Ring-bearer (card 141085, a local record). The
// first player's Ring-bearer is the host, so the loadout decides who carries it and nothing is inserted.
const RING = "141085";

export const aShadowOfThePast: ScenarioScript = {
  id: "a-shadow-of-the-past",
  start(input: ScriptInput): StartScenario {
    return {
      seatCount: input.seatCount,
      seed: input.seed,
      threatModifier: input.threatModifier,
      definition: {
        ...input.definition,
        setup: [{ verb: "AttachToRingBearer", code: RING }, ...input.definition.setup, { verb: "ShuffleEncounterDeck" }],
      },
      seats: input.seats,
      encounterDeck: encounterCodes(input.fixture),
      questDeck: input.fixture.stages,
    };
  },
};
