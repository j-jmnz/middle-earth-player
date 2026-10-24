import { readFileSync } from "node:fs";
import path from "node:path";

import type { ScenarioDefinition } from "../../src/catalog/boundary.ts";
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

export function loadScenarios(dataDir = DATA_DIR): ScenarioData[] {
  return loadCampaign(undefined, dataDir).scenarios.map((id) => loadScenario(id, dataDir));
}

// Every card a scenario deals, and every reward it offers, must be a card in data/cards.
export function loadScenarioDefinitions(dataDir: string, cardsByCode: ReadonlyMap<string, Card>): ScenarioDefinition[] {
  const campaign = loadCampaign(undefined, dataDir);
  return campaign.scenarios.map((id) => {
    const scenario = loadScenario(id, dataDir);
    for (const code of dealtCodes(campaign, [scenario])) {
      const card = cardsByCode.get(code);
      if (!card) throw new Error(`Scenario ${id} is missing card ${code}`);
      if (card.type === "nightmare") throw new Error(`Scenario ${id} card ${code} is a nightmare card`);
    }
    return scenarioDefinition(scenario, campaign);
  });
}

// Every card the campaign deals: the prelude, each scenario's piles, and the rewards its resolution offers.
export function dealtCodes(campaign: CampaignData, scenarios: readonly ScenarioData[]): Set<string> {
  const codes = new Set<string>(campaign.prelude.map((card) => card.code));
  for (const scenario of scenarios) {
    for (const card of scenario.cards) codes.add(card.code);
    for (const group of campaign.authored.resolution[scenario.id] ?? []) for (const choice of group.choices) codes.add(choice.code);
  }
  return codes;
}
