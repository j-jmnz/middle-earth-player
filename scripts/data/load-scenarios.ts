import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import type { Effect, ScenarioDefinition } from "../../src/catalog/boundary.ts";
import type { Card } from "../../src/catalog/card-facts.ts";
import { campaignDataSchema, parseScenarioData, scenarioDefinition, type CampaignData, type ScenarioData } from "../../src/catalog/scenario-data.ts";
import { DATA_DIR } from "./paths.ts";

// Reads data/scenarios and data/campaigns. Offline.
export function loadScenario(id: string, dataDir = DATA_DIR): ScenarioData {
  return parseScenarioData(JSON.parse(readFileSync(path.join(dataDir, "scenarios", `${id}.json`), "utf8")) as unknown);
}

export function loadCampaign(id = "fellowship-of-the-ring", dataDir = DATA_DIR): CampaignData {
  return campaignDataSchema.parse(JSON.parse(readFileSync(path.join(dataDir, "campaigns", `${id}.json`), "utf8")) as unknown);
}

// Every built campaign (data/campaigns/<id>.json; index.json lists the others, which have no scenario files).
export function loadCampaigns(dataDir = DATA_DIR): CampaignData[] {
  return readdirSync(path.join(dataDir, "campaigns"))
    .filter((name) => name.endsWith(".json") && name !== "index.json")
    .sort()
    .map((name) => loadCampaign(name.replace(/\.json$/, ""), dataDir));
}

// One campaign's scenarios in play order, or, with no id, every built campaign's, each scenario once (the Oath is in two).
export function loadScenarios(campaignId?: string, dataDir = DATA_DIR): ScenarioData[] {
  const campaigns = campaignId === undefined ? loadCampaigns(dataDir) : [loadCampaign(campaignId, dataDir)];
  const ids = [...new Set(campaigns.flatMap((campaign) => campaign.scenarios))];
  return ids.map((id) => loadScenario(id, dataDir));
}

// Every card the campaign deals: the prelude, each scenario's piles, its campaign card, and the cards that card names.
export function dealtCodes(campaign: CampaignData | readonly CampaignData[], scenarios: readonly ScenarioData[]): Set<string> {
  const codes = new Set<string>(asList(campaign).flatMap((one) => one.prelude.map((card) => card.code)));
  for (const scenario of scenarios) {
    codes.add(scenario.campaignCard);
    for (const card of scenario.cards) codes.add(card.code);
    for (const code of scenario.campaignPlaced) codes.add(code);
  }
  return codes;
}

// Every card of the starter decklists.
export function starterCodes(campaign: CampaignData | readonly CampaignData[]): Set<string> {
  return new Set(asList(campaign).flatMap((one) => one.starterDecks.flatMap((deck) => deck.rows.map((row) => row.code))));
}

function asList<T>(value: T | readonly T[]): readonly T[] {
  return Array.isArray(value) ? (value as readonly T[]) : [value as T];
}

// Every card a scenario deals must be a card in data/cards.
export function loadScenarioDefinitions(dataDir: string, cardsByCode: ReadonlyMap<string, Card>, effects: readonly Effect[] = [], campaignId = "fellowship-of-the-ring"): ScenarioDefinition[] {
  const campaign = loadCampaign(campaignId, dataDir);
  return campaign.scenarios.map((id) => {
    const scenario = loadScenario(id, dataDir);
    for (const code of dealtCodes(campaign, [scenario])) {
      const card = cardsByCode.get(code);
      if (!card) throw new Error(`Scenario ${id} is missing card ${code}`);
      if (card.type === "nightmare") throw new Error(`Scenario ${id} card ${code} is a nightmare card`);
    }
    return scenarioDefinition(scenario, campaign, effects);
  });
}
