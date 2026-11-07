import { namesTreasures } from "../../src/campaign/world.ts";
import { buildStart } from "../../src/campaign/start.ts";
import type { CampaignData, ScenarioData } from "../../src/catalog/scenario-data.ts";
import { EFFECTS } from "../../src/effects/index.ts";
import { expectOk } from "../../src/rules/core/test-fixture.ts";
import { reduce, startScenario, type ReduceContext, type ScenarioState } from "../../src/rules/engine/reduce.ts";
import type { StartScenario } from "../../src/rules/setup/setup.ts";

import { fillerLoadout, HERO_STATS, RING_BEARER, standInWorld } from "../../test/harness/game-kit.ts";
import { loadTreasures } from "../../test/harness/catalog.ts";
import { addStandIns, sceneEffects } from "../../test/harness/scene-kit.ts";
import { dealtCodes, loadCampaignsInOrder, loadScenario } from "../data/load-scenarios.ts";

// Test helper for scripts/card-smoke/encounter.ts: a scenario dealt as a standalone game to stand-in heroes and a deck of free
// events, with no campaign log (docs/brief.md, Standalone play). The cards are the scenario's own, the heroes' numbers come from a
// profile (test/harness/game-kit.ts, HERO_STATS), and a saga scenario's first seat carries Frodo as its Ring-bearer, as a
// Fellowship game does.

export type Profile = keyof typeof HERO_STATS;

export type EncounterWorld = {
  scenario: ScenarioData;
  campaign: CampaignData;
  // The same cards under every profile's hero numbers.
  contexts: Readonly<Record<Profile, ReduceContext>>;
};

/** The campaign that plays the scenario. */
export function campaignOf(scenarioId: string): CampaignData {
  const found = loadCampaignsInOrder().find((one) => one.scenarios.includes(scenarioId));
  if (!found) throw new Error(`No campaign plays ${scenarioId}`);
  return found;
}

/** The scenario's cards (its piles, its Nightmare deck, its campaign card and what a campaign game deals beside them) under each hero profile. */
export async function encounterWorld(scenarioId: string): Promise<EncounterWorld> {
  const scenario = loadScenario(scenarioId);
  const campaign = campaignOf(scenarioId);
  const codes = [...dealtCodes(campaign, [scenario]), ...(campaign.saga ? [RING_BEARER] : [])];
  const profiles = Object.keys(HERO_STATS) as Profile[];
  const entries = await Promise.all(profiles.map(async (profile) => {
    const cards = await standInWorld(codes, HERO_STATS[profile]);
    // A record that draws a random treasure needs every treasure of the catalog, as the app's world loads them.
    if (namesTreasures(EFFECTS, new Set(codes))) for (const [code, treasure] of loadTreasures()) if (!cards.has(code)) cards.set(code, treasure);
    // The plain enemy a Shadow is dealt to.
    addStandIns(cards, ["f0"]);
    const ctx: ReduceContext = { effects: sceneEffects(), cards };
    return [profile, ctx] as const;
  }));
  return { scenario, campaign, contexts: Object.fromEntries(entries) as Record<Profile, ReduceContext> };
}

/** The standalone start of the scenario for these seats and this seed, the first seat's Ring-bearer Frodo in a saga. */
export function encounterStart(world: EncounterWorld, seatCount: 1 | 2, seed: number): StartScenario {
  const seats = fillerLoadout(seatCount).map((seat, index) => (index === 0 && world.campaign.saga ? { ...seat, heroes: [RING_BEARER, ...seat.heroes] } : seat));
  return buildStart({ campaign: world.campaign, scenario: world.scenario, seatCount, seed, threatModifier: 0, seats, effects: EFFECTS, difficulty: "Normal", mode: "standalone" });
}

/** The state after the first seat keeps its opening hand: the game is ready for the first intent of the first round. */
export function kept(start: StartScenario, ctx: ReduceContext): ScenarioState {
  return expectOk(reduce(startScenario(start, ctx), { type: "Keep" }, ctx)).state;
}
