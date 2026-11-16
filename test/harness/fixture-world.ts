// The world a Maestro fixture's game is replayed in (src/campaign/fixtures.test.ts and the per-campaign fixture tests): the catalog the fixtures are checked against and the world a fixture's loadout and log deal.
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import { fixture, standaloneFixture, type FixtureName } from "../../src/campaign/fixtures.ts";
import { loadWorld, logCodes } from "../../src/campaign/world.ts";
import { EFFECTS } from "../../src/effects/index.ts";
import { loadAnyScenario, loadCampaign, loadScenario } from "../../scripts/data/load-scenarios.ts";

import { temporaryCatalog } from "./temp-catalog.ts";

export const catalog = drizzle(new Database(temporaryCatalog(), { readonly: true }));

export function worldFor(name: FixtureName) {
  const { loadout, log, campaignId } = fixture(name);
  const codes = [...(loadout.ringBearer ? [loadout.ringBearer] : []), ...loadout.seats.flatMap((seat) => [...seat.heroes, ...seat.deck]), ...logCodes(log)];
  return loadWorld(catalog, loadCampaign(campaignId), loadScenario(loadout.scenarioId), EFFECTS, codes);
}

/** The world a standalone fixture (a scenario of a cycle) is dealt and replayed in: the cycle's data and the scenario, with no log. */
export function worldForStandalone(name: FixtureName) {
  const { loadout, campaignId } = standaloneFixture(name);
  const codes = [...(loadout.ringBearer ? [loadout.ringBearer] : []), ...loadout.seats.flatMap((seat) => [...seat.heroes, ...seat.deck])];
  return loadWorld(catalog, loadCampaign(campaignId), loadAnyScenario(loadout.scenarioId), EFFECTS, codes);
}
