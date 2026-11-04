import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, it } from "vitest";

import { EFFECTS } from "../effects/index.ts";
import { scenarioCards } from "../catalog/scenario-data.ts";
import { loadCampaign, loadScenario } from "../../scripts/data/load-scenarios.ts";
import { temporaryCatalog } from "../../test/harness/temp-catalog.ts";

import { loadWorld } from "./world.ts";

// Rules: dcce.ships, dcce.ship-enemies, dcce.ship-objectives, dcce.sailing, dcce.boarding (data/rules/entries.json). Every Dream-chaser scenario
// loads as a world: the catalog prints each card it deals, ships included (a ship-enemy is an enemy and a ship-objective an objective ally
// that fights), with the stats the scans print, the keywords of the sea family, and the Sailing success symbols of the ledger.
const campaign = loadCampaign("dream-chaser");
const catalog = drizzle(new Database(temporaryCatalog(), { readonly: true }));

describe("a Dream-chaser world", () => {
  for (const id of campaign.scenarios) {
    it(`${id} loads, and every card it deals prints`, () => {
      const scenario = loadScenario(id);
      const world = loadWorld(catalog, campaign, scenario, EFFECTS);
      for (const placement of scenarioCards(scenario)) expect(world.cards.has(placement.code), `${placement.code} in ${id}`).toBe(true);
      expect(world.cards.has(scenario.stages[0] ?? "")).toBe(true);
    });
  }

  it("prints ships as enemies and objective allies with their stats", () => {
    const world = loadWorld(catalog, campaign, loadScenario("voyage-across-belegaer"), EFFECTS);
    const scouting = world.cards.get("11022");
    expect(scouting).toMatchObject({ type: "enemy", ship: "enemy", attack: 5, defense: 2, health: 7, threat: 2, engagementCost: 35 });
    expect(scouting?.keywords.boarding).toBe(1);
    const dreamChaser = world.cards.get("11080");
    expect(dreamChaser).toMatchObject({ type: "objective", ship: "objective", willpower: 5, attack: 4, defense: 4, health: 18, encounterSet: "The Dream-chaser's Fleet" });
    expect(dreamChaser?.keywords).toMatchObject({ sentinel: true, immuneToPlayerCardEffects: true });
    expect(world.cards.get("11016")?.keywords.sailing).toBe(true);
    expect(world.cards.get("11050")?.keywords.sailingSuccess).toBe(2);
  });
});
