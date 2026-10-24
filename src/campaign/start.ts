import type { Effect, ScenarioDefinition } from "../catalog/boundary.ts";
import { burdenCodes, encounterCodes, recordInstructions, scenarioDefinition, type CampaignData, type Difficulty, type ScenarioData } from "../catalog/scenario-data.ts";
import type { StartScenario, StartSeat } from "../rules/setup.ts";

export type StartInput = {
  campaign: CampaignData;
  scenario: ScenarioData;
  seatCount: 1 | 2;
  seed: number;
  threatModifier: number;
  seats: readonly StartSeat[];
  // The encounter deck size the booklet prints for the difficulty. Normal when absent.
  difficulty?: Difficulty;
  // The effect records. The campaign card's Setup and Resolution records are read from them.
  effects?: readonly Effect[];
  // Cards the campaign pool shuffles into the encounter deck (Campaign Setup Checklist step 8).
  poolEncounterCards?: readonly string[];
};

// The scenario's piles, the campaign card's Setup records and the campaign's prelude become the engine's start.
// Printed order: the campaign card's Setup first, then the quest card's. Each prelude card (The One Ring) goes on the
// Ring-bearer first; the first player's Ring-bearer is the host, so the loadout decides who carries it. The campaign
// card's Setup can add a card to staging or attach it to the Ring-bearer (instructions the engine runs in Setup) and
// shuffle cards into the encounter deck (added to the deck here, before the shuffle). Its choices are made by the
// campaign checklist (src/campaign/checklist.ts) before the scenario starts. The quest card's last Setup step is the
// encounter deck shuffle, which the piles cannot express.
export function buildStart(input: StartInput): StartScenario {
  const effects = input.effects ?? [];
  const definition: ScenarioDefinition = scenarioDefinition(input.scenario, input.campaign, effects);
  const campaignSetup = recordInstructions(effects, input.scenario.campaignCard, "campaignSetup");
  const dealt = campaignSetup.filter((instruction) => instruction.verb === "AttachToRingBearer" || instruction.verb === "AddToStaging");
  const shuffledIn = campaignSetup.flatMap((instruction) => (instruction.verb === "ShuffleIntoEncounterDeck" ? [instruction.code] : []));
  const burden = burdenCodes(input.scenario);
  return {
    seatCount: input.seatCount,
    seed: input.seed,
    threatModifier: input.threatModifier,
    definition: {
      ...definition,
      setup: [
        ...input.campaign.prelude.map((card) => ({ verb: "AttachToRingBearer" as const, code: card.code })),
        ...dealt,
        ...definition.setup,
        { verb: "ShuffleEncounterDeck" as const },
      ],
    },
    seats: input.seats,
    encounterDeck: [...encounterCodes(input.scenario, input.difficulty), ...shuffledIn, ...(input.poolEncounterCards ?? [])],
    questDeck: input.scenario.stages,
    ...(burden.length > 0 ? { burdenDeck: burden } : {}),
  };
}
