import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import type { RingsDbCard, ScenarioDefinition } from "../src/catalog/boundary.ts";
import { fixtureCards, parseScenarioFixture, scenarioDefinition, type ScenarioFixture } from "../src/catalog/scenario-fixture.ts";

export function loadScenarioFixtures(fixturesDir: string): ScenarioFixture[] {
  if (!existsSync(fixturesDir)) return [];
  return readdirSync(fixturesDir)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => parseScenarioFixture(JSON.parse(readFileSync(path.join(fixturesDir, name), "utf8")) as unknown));
}

export function joinScenarioFixtures(
  fixturesDir: string,
  localCards: readonly RingsDbCard[],
  cardsByCode: ReadonlyMap<string, RingsDbCard>,
): { addedCards: RingsDbCard[]; definitions: ScenarioDefinition[] } {
  const localByCode = new Map(localCards.map((card) => [card.code, card]));
  const addedCards: RingsDbCard[] = [];
  const addedCodes = new Set<string>();
  const definitions: ScenarioDefinition[] = [];

  for (const fixture of loadScenarioFixtures(fixturesDir)) {
    for (const code of new Set(fixtureCards(fixture).map((card) => card.code))) {
      const official = cardsByCode.get(code);
      const card = official ?? localByCode.get(code);
      if (!card) {
        throw new Error(`Scenario ${fixture.id} is missing card ${code}`);
      }
      if (card.type_code === "nightmare") {
        throw new Error(`Scenario ${fixture.id} card ${code} is a nightmare card`);
      }
      if (!official && !addedCodes.has(code)) {
        addedCodes.add(code);
        addedCards.push(card);
      }
    }
    definitions.push(scenarioDefinition(fixture));
  }

  for (const local of localCards) {
    if (addedCodes.has(local.code)) continue;
    const official = cardsByCode.get(local.code);
    if (official) {
      if (official.name !== local.name) {
        throw new Error(`Local card ${local.code} already belongs to a different card`);
      }
      continue;
    }
    if (local.type_code === "nightmare") {
      throw new Error(`Local card ${local.code} is a nightmare card`);
    }
    addedCodes.add(local.code);
    addedCards.push(local);
  }

  return { addedCards, definitions };
}
