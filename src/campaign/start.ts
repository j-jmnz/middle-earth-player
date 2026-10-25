import type { Effect, ScenarioDefinition } from "../catalog/boundary.ts";
import { burdenCodes, encounterCodes, recordInstructions, scenarioDefinition, setupInstructions, type CampaignData, type Difficulty, type ScenarioData } from "../catalog/scenario-data.ts";
import type { StartScenario, StartSeat } from "../rules/setup.ts";

// Campaign Mode, or the scenario played as a standalone adventure (mec109.campaign-mode: "players can still play the
// scenarios as standalone adventures"). The campaign card is placed only "while setting up a scenario in Campaign Mode"
// and its Resolution is followed only after a campaign win (rr.campaign-cards), so a standalone game has neither.
export type PlayMode = "campaign" | "standalone";

export type StartInput = {
  campaign: CampaignData;
  scenario: ScenarioData;
  seatCount: 1 | 2;
  seed: number;
  threatModifier: number;
  seats: readonly StartSeat[];
  // The encounter deck size the booklet prints for the difficulty, and on Easy one resource on each hero in Setup step 2
  // (easy-mode.easy-mode). Normal when absent.
  difficulty?: Difficulty;
  // The effect records. The campaign card's Setup and Resolution records are read from them.
  effects?: readonly Effect[];
  // Cards the campaign pool shuffles into the encounter deck (Campaign Setup Checklist step 8).
  poolEncounterCards?: readonly string[];
  // Campaign when absent.
  mode?: PlayMode;
};

// The scenario's piles, the campaign card's Setup records (Campaign Mode only) and the campaign's prelude become the engine's start.
// Printed order: the campaign card's Setup first, then the quest card's. Each prelude card (The One Ring) goes on the
// Ring-bearer first; the first player's Ring-bearer is the host, so the loadout decides who carries it. The campaign
// card's Setup can add a card to staging or attach it to the Ring-bearer (instructions the engine runs in Setup) and
// shuffle cards into the encounter deck (added to the deck here, before the shuffle). Its choices are made by the
// campaign checklist (src/campaign/checklist.ts) before the scenario starts. The quest card's last Setup step is the
// encounter deck shuffle, which the piles cannot express.
export function buildStart(input: StartInput): StartScenario {
  const effects = input.effects ?? [];
  const standalone = input.mode === "standalone";
  const { campaignCard, ...rest }: ScenarioDefinition = scenarioDefinition(input.scenario, input.campaign, effects);
  // Standalone: no campaign card beside the quest deck, so no campaign Setup and no Resolution to follow on a win.
  const definition: ScenarioDefinition = standalone ? { ...rest, resolution: [] } : { ...rest, ...(campaignCard ? { campaignCard } : {}) };
  const campaignSetup = standalone ? [] : recordInstructions(effects, input.scenario.campaignCard, "campaignSetup");
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
        ...setupInstructions(input.scenario, input.difficulty, input.seatCount),
        { verb: "ShuffleEncounterDeck" as const },
      ],
    },
    seats: input.seats,
    encounterDeck: [...encounterCodes(input.scenario, input.difficulty, input.seatCount), ...shuffledIn, ...(input.poolEncounterCards ?? [])],
    questDeck: input.scenario.stages,
    ...(burden.length > 0 ? { burdenDeck: burden } : {}),
    ...(input.difficulty ? { difficulty: input.difficulty } : {}),
  };
}
