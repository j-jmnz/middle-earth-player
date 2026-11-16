import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import { contextOf } from "../../src/campaign/session.ts";
import { buildStart } from "../../src/campaign/start.ts";
import { loadWorld } from "../../src/campaign/world.ts";
import type { Difficulty } from "../../src/catalog/scenario-data.ts";
import { EFFECTS } from "../../src/effects/index.ts";
import { expectOk } from "../../src/rules/core/test-fixture.ts";
import { reduce, startScenario, type ReduceContext, type ScenarioState } from "../../src/rules/engine/reduce.ts";

import { loadAnyScenario, loadCampaign } from "../../scripts/data/load-scenarios.ts";
import prebuilt from "../../data/decks/prebuilt.json" with { type: "json" };
import { temporaryCatalog } from "./temp-catalog.ts";

// Test helper. A cycle scenario dealt standalone to the Learn to Play's Spirit starter deck (`core-spirit`, data/decks/prebuilt.json): the real cards of data/, the start of a seed as the briefing builds it
// (src/campaign/start.ts, mode "standalone"), and every mulligan kept. The stage tests of a cycle scenario read the table it opens on.

const CORE = prebuilt.find((entry) => entry.id === "core-spirit");
const HEROES = CORE?.heroes ?? [];
const DECK = CORE?.cards.flatMap((card) => Array.from({ length: card.count }, () => card.code)) ?? [];

let catalog: ReturnType<typeof drizzle<Record<string, never>>> | undefined;

/** The table of `scenarioId` of the cycle `campaignId` after Setup, `seatCount` seats each playing the Spirit starter deck, on seed 1. */
export function coreSpiritGame(campaignId: string, scenarioId: string, difficulty: Difficulty, seatCount: 1 | 2 = 1): { state: ScenarioState; ctx: ReduceContext } {
  catalog ??= drizzle<Record<string, never>>(new Database(temporaryCatalog(), { readonly: true }));
  const campaign = loadCampaign(campaignId);
  const world = loadWorld(catalog, campaign, loadAnyScenario(scenarioId), EFFECTS, [...HEROES, ...DECK]);
  const ctx = contextOf(world);
  const seats = Array.from({ length: seatCount }, () => ({ heroes: HEROES, deck: DECK }));
  const start = buildStart({ campaign, scenario: world.scenario, seatCount, seed: 1, threatModifier: 0, seats, difficulty, effects: world.effects, mode: "standalone" });
  let state = startScenario(start, ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  return { state, ctx };
}
