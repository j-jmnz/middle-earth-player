import type { Effect, ScenarioDefinition } from "../catalog/boundary.ts";
import { burdenCodes, campaignScenario, corsairCodes, encounterCodes, recordInstructions, scenarioDefinition, setupInstructions, sideInstructions, type CampaignData, type Difficulty, type ScenarioData } from "../catalog/scenario-data.ts";
import type { CampaignFacts } from "../rules/campaign-state.ts";
import type { StartScenario, StartSeat } from "../rules/setup.ts";

import { MODE_CARD_CODE, MODE_CARD_SIDE, type ModeCard } from "./xp.ts";

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
  // (easy-mode.easy-mode); Nightmare deals the Nightmare deck and places its setup card. Normal when absent.
  difficulty?: Difficulty;
  // The effect records. The campaign card's Setup and Resolution records are read from them.
  effects?: readonly Effect[];
  // Cards the campaign pool shuffles into the encounter deck (Campaign Setup Checklist step 8).
  poolEncounterCards?: readonly string[];
  // Pool cards that are put into play at the start of each scenario (Mendor): the checklist's step 8 left them out of the encounter
  // deck, and each enters play under the first player after the campaign card's own Setup.
  poolIntoPlay?: readonly string[];
  // The campaign log's structured facts, handed to the engine (Campaign Mode only). Left out when the log holds none. The Hard/Expert Mode card
  // the game is played with is `modeCard`, below: the facts take it from there.
  facts?: Omit<CampaignFacts, "modeCard">;
  // Campaign when absent.
  mode?: PlayMode;
  // The Hard/Expert Mode card the players put next to the quest deck (dcce.hard-expert), Campaign Mode only: its Resolution adds its XP.
  modeCard?: ModeCard;
};

// The scenario's piles, the campaign card's Setup records (Campaign Mode only) and the campaign's prelude become the engine's start.
// Printed order: the campaign card's Setup first, then the quest card's. Each prelude card (The One Ring) goes on the
// Ring-bearer first; the first player's Ring-bearer is the host, so the loadout decides who carries it. The campaign
// card's Setup can add a card to staging or attach it to the Ring-bearer (instructions the engine runs in Setup) and
// shuffle cards into the encounter deck (added to the deck here, before the shuffle). Its choices are made by the
// campaign checklist (src/campaign/checklist.ts) before the scenario starts. The quest card's last Setup step is the
// encounter deck shuffle, which the piles cannot express.
const DEALT_VERBS: ReadonlySet<string> = new Set(["AttachToRingBearer", "AddToStaging", "SetAside", "PutObjectiveAllyIntoPlay", "SetAsideEachPlayer"]);
// The campaign card's Setup verbs that name the ships the quest card's Setup prepares: they resolve in a frame after it (ScenarioDefinition.afterSetup).
const AFTER_SETUP_VERBS: ReadonlySet<string> = new Set(["FitShips", "TradeShipDamage"]);

function hasFacts(facts: CampaignFacts): boolean {
  return facts.prisoner != null || facts.usedOnce.length > 0 || Object.keys(facts.counters).length > 0 || facts.levels != null || facts.upgraded != null || facts.modeCard != null;
}

// The facts the engine gets: the log's, and the Hard/Expert Mode card chosen for this game (the log records it when the scenario is won).
function factsOf(input: StartInput): CampaignFacts | undefined {
  const logged = input.facts ?? { prisoner: null, usedOnce: [], counters: {} };
  const facts: CampaignFacts = input.modeCard ? { ...logged, modeCard: input.modeCard } : logged;
  return hasFacts(facts) ? facts : undefined;
}

export function buildStart(start: StartInput): StartScenario {
  const standalone = start.mode === "standalone";
  // A campaign game deals the Campaign Expansion's reprint of each card that has one; a standalone game the original (ScenarioData.reprints).
  const input = standalone ? start : { ...start, scenario: campaignScenario(start.scenario) };
  const effects = input.effects ?? [];
  const full: ScenarioDefinition = scenarioDefinition(input.scenario, input.campaign, effects);
  let definition = full;
  if (standalone) {
    // No campaign card beside the quest deck, so no campaign Setup and no Resolution to follow on a win.
    const { campaignCard: _unused, ...withoutCard } = full;
    definition = { ...withoutCard, resolution: [] };
  } else if (input.modeCard) {
    // The Hard/Expert Mode card goes next to the quest deck, and "if you win the game, resolve this card's resolution" after the campaign card's own.
    const side = MODE_CARD_SIDE[input.modeCard];
    definition = { ...definition, modeCard: { code: MODE_CARD_CODE, side }, resolution: [...definition.resolution, ...sideInstructions(effects, MODE_CARD_CODE, side, "resolution")] };
  }
  const campaignSetup = standalone ? [] : recordInstructions(effects, input.scenario.campaignCard, "campaignSetup");
  // What the engine runs in Setup, in the campaign card's printed order: the Fellowship's two verbs and the Mirkwood ones (an
  // objective ally put into play, a card set aside). AttachChosen, AddToHandAfterMulligan and AddToPool are dealt by the checklist.
  const dealt = campaignSetup.filter((instruction) => DEALT_VERBS.has(instruction.verb));
  const named = new Set(dealt.flatMap((instruction) => (instruction.verb === "PutObjectiveAllyIntoPlay" ? [instruction.code] : [])));
  const poolInPlay = standalone ? [] : (input.poolIntoPlay ?? []).filter((code) => !named.has(code));
  const shuffledIn = campaignSetup.flatMap((instruction) => (instruction.verb === "ShuffleIntoEncounterDeck" ? [instruction.code] : []));
  const afterSetup = campaignSetup.filter((instruction) => AFTER_SETUP_VERBS.has(instruction.verb));
  const burden = burdenCodes(input.scenario);
  // The Corsair deck the scenario deals, and the cards the campaign card shuffles into it ("Shuffle Crowley into the Corsair deck"); the quest card's Setup shuffles it.
  const corsair = [...corsairCodes(input.scenario, input.difficulty), ...campaignSetup.flatMap((instruction) => (instruction.verb === "ShuffleIntoCorsairDeck" ? [instruction.code] : []))];
  // Nightmare: the setup card goes next to the quest deck, its side A faceup (docs/plans/nightmare-mode.md).
  if (input.difficulty === "Nightmare") definition = { ...definition, nightmareCard: input.scenario.nightmare?.setupCard };
  return {
    seatCount: input.seatCount,
    seed: input.seed,
    threatModifier: input.threatModifier,
    definition: {
      ...definition,
      ...(afterSetup.length > 0 ? { afterSetup } : {}),
      setup: [
        ...input.campaign.prelude.map((card) => ({ verb: "AttachToRingBearer" as const, code: card.code })),
        ...dealt,
        ...poolInPlay.map((code) => ({ verb: "PutObjectiveAllyIntoPlay" as const, code })),
        ...setupInstructions(input.scenario, input.difficulty, input.seatCount),
        { verb: "ShuffleEncounterDeck" as const },
      ],
    },
    seats: input.seats,
    encounterDeck: [...encounterCodes(input.scenario, input.difficulty, input.seatCount), ...shuffledIn, ...(input.poolEncounterCards ?? [])],
    questDeck: input.scenario.stages,
    ...(burden.length > 0 ? { burdenDeck: burden } : {}),
    ...(corsair.length > 0 ? { corsairDeck: corsair } : {}),
    ...(input.difficulty ? { difficulty: input.difficulty } : {}),
    ...(!standalone && factsOf(input) ? { facts: factsOf(input) } : {}),
  };
}
