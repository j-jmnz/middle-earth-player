import { EFFECTS } from "../../src/effects/index.ts";
import { scenarioDefinition } from "../../src/catalog/scenario-data.ts";
import type { ScenarioDefinition } from "../../src/catalog/boundary.ts";
import { printedFromCard, type PrintedCard } from "../../src/rules/core/printed.ts";

import type { Card } from "../../src/catalog/card-facts.ts";
import { loadCards } from "../../scripts/data/load-cards.ts";
import { loadCampaign, loadScenario } from "../../scripts/data/load-scenarios.ts";

// Test helper. Reads data/cards and data/scenarios. No network and no built database.

// data/cards by code, read and validated once per worker: data/ does not change while the suite runs, and a world is built
// many times a file (once per golden's decks), each of which read and parsed every card file again. A test that writes cards
// passes its own directory to loadCards. The cards are frozen, so a test that changed one would throw instead of reaching the next.
let byCode: ReadonlyMap<string, Card> | null = null;
function cardsByCode(): ReadonlyMap<string, Card> {
  byCode ??= new Map(loadCards().map((card) => [card.code, deepFreeze(card)]));
  return byCode;
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const field of Object.values(value)) deepFreeze(field);
  return Object.freeze(value);
}

export async function loadPrinted(codes: readonly string[]): Promise<ReadonlyMap<string, PrintedCard>> {
  const byCode = cardsByCode();
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
  return new Map([...cardsByCode().values()].filter((card) => card.campaignKind === "treasure").map((card) => [card.code, printedFromCard(card)]));
}
