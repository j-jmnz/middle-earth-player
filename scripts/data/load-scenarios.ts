import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import type { Effect, ScenarioDefinition } from "../../src/catalog/boundary.ts";
import type { Card } from "../../src/catalog/card-facts.ts";
import { campaignDataSchema, campaignGameCodes, parseAnyScenarioData, parseScenarioData, scenarioDefinition, type AnyScenarioData, type CampaignData, type ScenarioData } from "../../src/catalog/scenario-data.ts";
import { DATA_DIR } from "./paths.ts";

// Reads data/scenarios and data/campaigns. Offline.
// A campaign's scenario; a cycle's scenario (no campaign card) is `loadAnyScenario`'s.
export function loadScenario(id: string, dataDir = DATA_DIR): ScenarioData {
  return parseScenarioData(JSON.parse(readFileSync(path.join(dataDir, "scenarios", `${id}.json`), "utf8")) as unknown);
}

export function loadAnyScenario(id: string, dataDir = DATA_DIR): AnyScenarioData {
  return parseAnyScenarioData(JSON.parse(readFileSync(path.join(dataDir, "scenarios", `${id}.json`), "utf8")) as unknown);
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

// Every built campaign in the order data/campaigns/index.json lists them (the order the app and the effect barrel use).
export function loadCampaignsInOrder(dataDir = DATA_DIR): CampaignData[] {
  const listed = (JSON.parse(readFileSync(path.join(dataDir, "campaigns", "index.json"), "utf8")) as { id: string }[]).map((entry) => entry.id);
  const built = loadCampaigns(dataDir);
  return listed.flatMap((id) => built.filter((campaign) => campaign.id === id));
}

// Every scenario id of the built campaigns in play order, each once (the Oath is in two).
export function scenarioOrder(dataDir = DATA_DIR): string[] {
  return [...new Set(loadCampaignsInOrder(dataDir).flatMap((campaign) => campaign.scenarios))];
}

// One campaign's scenarios in play order, or, with no id, every built campaign's, each scenario once (the Oath is in two).
// With no id, the cycle's scenarios are among them (no campaign card).
export function loadScenarios(campaignId: string, dataDir?: string): ScenarioData[];
export function loadScenarios(campaignId?: undefined, dataDir?: string): AnyScenarioData[];
export function loadScenarios(campaignId?: string, dataDir = DATA_DIR): AnyScenarioData[] {
  const campaigns = campaignId === undefined ? loadCampaigns(dataDir) : [loadCampaign(campaignId, dataDir)];
  const ids = [...new Set(campaigns.flatMap((campaign) => campaign.scenarios))];
  return campaignId === undefined ? ids.map((id) => loadAnyScenario(id, dataDir)) : ids.map((id) => loadScenario(id, dataDir));
}

// A cycle's scenarios have no printed lines to check until its scan-read ledger (data/printed/<cycle id>.json) exists: they stay out of the printed-text scope and the
// open-lines checks until then. A campaign is never pending (its ledger is part of its box).
export function ledgerPending(campaign: Pick<CampaignData, "id" | "kind">, dataDir = DATA_DIR): boolean {
  return campaign.kind === "cycle" && !existsSync(path.join(dataDir, "printed", `${campaign.id}.json`));
}

// Every scenario of the built campaigns and of the cycles whose ledger exists (`ledgerPending`), each once, in order.
export function loadLedgeredScenarios(dataDir = DATA_DIR): AnyScenarioData[] {
  const ids = [...new Set(loadCampaigns(dataDir).filter((campaign) => !ledgerPending(campaign, dataDir)).flatMap((campaign) => campaign.scenarios))];
  return ids.map((id) => loadAnyScenario(id, dataDir));
}

// Every card the campaign deals: the prelude, each scenario's piles, its campaign card, and the cards that card names.
export function dealtCodes(campaign: CampaignData | readonly CampaignData[], scenarios: readonly AnyScenarioData[], { nightmare = true }: { nightmare?: boolean } = {}): Set<string> {
  const codes = new Set<string>(asList(campaign).flatMap((one) => one.prelude.map((card) => card.code)));
  for (const scenario of scenarios) {
    if (scenario.campaignCard !== undefined) codes.add(scenario.campaignCard);
    // A card with two sides that are two catalog cards (`back`) puts the other side in play on a flip, so both are dealt.
    for (const card of scenario.cards) {
      codes.add(card.code);
      if (card.back != null) codes.add(card.back);
    }
    for (const code of scenario.campaignPlaced) codes.add(code);
    // The saga hero and the attachments the first player starts with (The Two Towers' Aragorn, The One Ring).
    if (scenario.sagaStart) for (const code of "hero" in scenario.sagaStart ? [scenario.sagaStart.hero] : scenario.sagaStart.attached) codes.add(code);
    // The treasure cards a deck may add at the Setup (The Hobbit): the scenario deals them into the players' decks.
    for (const code of scenario.treasures ?? []) codes.add(code);
    for (const code of gameCodes(campaign, scenario)) codes.add(code);
    if (nightmare) for (const code of nightmareCodes([scenario])) codes.add(code);
  }
  return codes;
}

// The cards a campaign game of the scenario deals beyond its piles (campaignGameCodes), for the campaign among these that plays it. With no
// campaign (a scenario read alone) the Hard/Expert Mode card is not among them.
export function gameCodes(campaign: CampaignData | readonly CampaignData[], scenario: AnyScenarioData): string[] {
  const owners = asList(campaign).filter((one) => one.scenarios.includes(scenario.id));
  return campaignGameCodes({ xp: owners.some((one) => one.xp === true) }, scenario);
}

// The cards a scenario deals on Nightmare that it does not deal otherwise: its Nightmare deck's setup card and cards.
export function nightmareCodes(scenarios: readonly AnyScenarioData[]): Set<string> {
  return new Set(scenarios.flatMap((scenario) => (scenario.nightmare ? [scenario.nightmare.setupCard, ...scenario.nightmare.cards.map((card) => card.code), ...(scenario.nightmare.questCards ?? [])] : [])));
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
    const scenario = loadAnyScenario(id, dataDir);
    for (const code of dealtCodes(campaign, [scenario])) {
      const card = cardsByCode.get(code);
      if (!card) throw new Error(`Scenario ${id} is missing card ${code}`);
      if (card.type === "nightmare" && code !== scenario.nightmare?.setupCard) throw new Error(`Scenario ${id} card ${code} is a nightmare card that is not its setup card`);
    }
    return scenarioDefinition(scenario, campaign, effects);
  });
}
