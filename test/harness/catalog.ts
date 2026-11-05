import { EFFECTS } from "../../src/effects/index.ts";
import { scenarioDefinition } from "../../src/catalog/scenario-data.ts";
import type { ScenarioDefinition } from "../../src/catalog/boundary.ts";
import { printedFromCard, type PrintedCard } from "../../src/rules/core/printed.ts";

import { loadCards } from "../../scripts/data/load-cards.ts";
import { loadCampaign, loadScenario } from "../../scripts/data/load-scenarios.ts";

// Test helper. Reads data/cards and data/scenarios. No network and no built database.
export async function loadPrinted(codes: readonly string[]): Promise<ReadonlyMap<string, PrintedCard>> {
  const byCode = new Map(loadCards().map((card) => [card.code, card]));
  const cards = new Map<string, PrintedCard>();
  for (const code of codes) {
    const card = byCode.get(code);
    if (!card) throw new Error(`data/cards has no card ${code}`);
    cards.set(code, printedFromCard(card));
  }
  return cards;
}

export async function loadDefinition(id: string): Promise<ScenarioDefinition> {
  return scenarioDefinition(loadScenario(id), loadCampaign(), EFFECTS);
}

/** Every treasure of the Ered Mithrin campaign: the pool a record that draws a random treasure (AttachRandomTreasure) draws from, as the app's world loads it (src/campaign/world.ts). */
export function loadTreasures(): ReadonlyMap<string, PrintedCard> {
  return new Map(loadCards().filter((card) => card.campaignKind === "treasure").map((card) => [card.code, printedFromCard(card)]));
}
