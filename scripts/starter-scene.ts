import type { ScenarioDefinition } from "../src/catalog/boundary.ts";
import { loadCampaign } from "./data/load-scenarios.ts";
import { type PrintedCard, definePrinted } from "../src/rules/printed.ts";
import { reduce, type PlayerIntent, type ReduceContext, type ScenarioState } from "../src/rules/reduce.ts";

import { sceneCards } from "./test-scene.ts";
import { loadPrinted } from "./test-catalog.ts";

// Test helper for the phase 9 starter-card tests. Real starter cards from data/cards on the scenario 1 table of
// scripts/test-scene.ts, plus two stand-in enemies whose engagement costs sit either side of the test threat (8).

export const STARTER_CODES = [...new Set(loadCampaign().starterDecks.flatMap((deck) => deck.rows.map((row) => row.code)))];
export const ARAGORN = "01001";
export const CHEAP = "cheap";
export const DEAR = "dear";

export async function starterBase(): Promise<{ definition: ScenarioDefinition; cards: Map<string, PrintedCard> }> {
  const base = await sceneCards();
  const cards = new Map([...base.cards, ...(await loadPrinted([...STARTER_CODES, ARAGORN]))]);
  cards.set(CHEAP, definePrinted({ code: CHEAP, name: "Cheap", type: "enemy", threat: 1, engagementCost: 2, attack: 2, defense: 1, health: 6 }));
  cards.set(DEAR, definePrinted({ code: DEAR, name: "Dear", type: "enemy", threat: 1, engagementCost: 50, attack: 2, defense: 1, health: 6 }));
  return { definition: base.definition, cards };
}

// The reason a reducer would give for an intent, or null when it would accept it.
export function refusal(state: ScenarioState, intent: PlayerIntent, ctx: ReduceContext): string | null {
  const result = reduce(state, intent, ctx);
  return result.ok ? null : result.reason;
}
