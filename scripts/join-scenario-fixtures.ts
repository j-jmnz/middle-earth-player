import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import type { ScenarioDefinition } from "../src/catalog/boundary.ts";
import type { Card } from "../src/catalog/card-facts.ts";
import { fixtureCards, parseScenarioFixture, scenarioDefinition, type ScenarioFixture } from "../src/catalog/scenario-fixture.ts";

export function loadScenarioFixtures(fixturesDir: string): ScenarioFixture[] {
  if (!existsSync(fixturesDir)) return [];
  return readdirSync(fixturesDir)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => parseScenarioFixture(JSON.parse(readFileSync(path.join(fixturesDir, name), "utf8")) as unknown));
}

// A reward name must match exactly one card the fixture deals. The build fails on none or on several.
function codeForName(fixture: ScenarioFixture, name: string, cardsByCode: ReadonlyMap<string, Card>): string {
  const matches = new Set<string>();
  for (const { code } of fixtureCards(fixture)) {
    if (cardsByCode.get(code)?.name === name) matches.add(code);
  }
  const [only, ...rest] = [...matches];
  if (only === undefined) throw new Error(`Scenario ${fixture.id} resolution names "${name}", which is not a dealt card`);
  if (rest.length > 0) throw new Error(`Scenario ${fixture.id} resolution name "${name}" is ambiguous: ${[only, ...rest].join(", ")}`);
  return only;
}

export function joinScenarioFixtures(fixturesDir: string, cardsByCode: ReadonlyMap<string, Card>): ScenarioDefinition[] {
  const definitions: ScenarioDefinition[] = [];
  for (const fixture of loadScenarioFixtures(fixturesDir)) {
    for (const code of new Set(fixtureCards(fixture).map((card) => card.code))) {
      const card = cardsByCode.get(code);
      if (!card) throw new Error(`Scenario ${fixture.id} is missing card ${code}`);
      if (card.type === "nightmare") throw new Error(`Scenario ${fixture.id} card ${code} is a nightmare card`);
    }
    definitions.push(scenarioDefinition(fixture, (name) => codeForName(fixture, name, cardsByCode)));
  }
  return definitions;
}
