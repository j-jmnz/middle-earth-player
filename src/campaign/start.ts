import type { ScenarioDefinition } from "../catalog/boundary.ts";
import { encounterCodes, scenarioDefinition, type CampaignData, type ScenarioData } from "../catalog/scenario-data.ts";
import type { StartScenario, StartSeat } from "../rules/setup.ts";

export type StartInput = {
  campaign: CampaignData;
  scenario: ScenarioData;
  seatCount: 1 | 2;
  seed: number;
  threatModifier: number;
  seats: readonly StartSeat[];
};

// The scenario's piles and the campaign's prelude become the engine's start. The Normal encounter deck
// and the quest stages come from the scenario data. Each prelude card (The One Ring) goes on the
// Ring-bearer first; the first player's Ring-bearer is the host, so the loadout decides who carries it.
// The quest card's last Setup step is the encounter deck shuffle, which the piles cannot express.
export function buildStart(input: StartInput): StartScenario {
  const definition: ScenarioDefinition = scenarioDefinition(input.scenario, input.campaign);
  return {
    seatCount: input.seatCount,
    seed: input.seed,
    threatModifier: input.threatModifier,
    definition: {
      ...definition,
      setup: [
        ...input.campaign.prelude.map((card) => ({ verb: "AttachToRingBearer" as const, code: card.code })),
        ...definition.setup,
        { verb: "ShuffleEncounterDeck" as const },
      ],
    },
    seats: input.seats,
    encounterDeck: encounterCodes(input.scenario),
    questDeck: input.scenario.stages,
  };
}
