import type { ScenarioDefinition } from "../../../src/catalog/boundary.ts";
import { loadCampaign } from "../../../scripts/data/load-scenarios.ts";
import { type PrintedCard, definePrinted } from "../../../src/rules/core/printed.ts";
import { playCost } from "../../../src/rules/player/attach.ts";
import { reduce, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";
import { updateCard } from "../../../src/rules/core/state.ts";

import { paymentsFor } from "../../harness/auto-player.ts";
import { sceneCards } from "../../harness/scene.ts";
import { loadPrinted } from "../../harness/catalog.ts";

// Test helper for the phase 9 starter-card tests. Real starter cards from data/cards on the scenario 1 table of
// test/harness/scene.ts, plus two stand-in enemies whose engagement costs sit either side of the test threat (8).

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

// Resources enough to play a card, taken from the heroes that can pay for it.
export function payFor(state: ScenarioState, ctx: ReduceContext, cardId: string, seat = 0): { heroId: string; amount: number }[] {
  const cost = playCost(state, cardId, seat, ctx);
  if (cost == null) throw new Error(`${cardId} has no cost`);
  const paid = paymentsFor(state, ctx, seat, cardId, cost);
  if (!paid) throw new Error(`Seat ${seat} cannot pay ${cost} for ${cardId}`);
  return paid;
}

// Every hero of the seat holds this many resources.
export function fund(state: ScenarioState, seat: number, resources: number): ScenarioState {
  let next = state;
  for (const id of state.seats[seat]?.heroes ?? []) next = updateCard(next, id, { resources });
  return next;
}
