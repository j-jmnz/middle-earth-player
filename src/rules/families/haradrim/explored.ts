// Rules: rr.explored (data/rules/entries.json); ledger line 17017:A:2.
//
// "If a location was explored this round" (Territorial Ape's shadow card). While the table holds the flag `noteExplored` (the Setup of The Mûmakil sets it), each location that leaves play explored, the active location or one in the staging
// area, leaves a table note `exploredThisRound` until the end of the round; the condition `locationExploredThisRound` reads it. Every other game has no flag, so its state never changes.
import type { Condition } from "../../../catalog/boundary.ts";

import { isLocationCard, printedOf, type PrintedCard } from "../../core/printed.ts";
import { flagged, type ScenarioState } from "../../core/state.ts";

/** Called where a card leaves play (destroyCard): notes an explored location for the round when the table asks for it, else returns the state as it was. */
export function noteExplored(state: ScenarioState, id: string, explored: boolean, cards: ReadonlyMap<string, PrintedCard>): ScenarioState {
  const card = state.cards[id];
  if (!explored || !card || !isLocationCard(printedOf(cards, card.code)) || !flagged(state, "table", "noteExplored")) return state;
  return { ...state, modifiers: [...state.modifiers, { instanceId: "table", sourceId: id, stat: "exploredThisRound", amount: 1, until: "endOfRound" }] };
}

export function exploredCondition(state: ScenarioState, condition: Condition): boolean | null {
  return condition.kind === "locationExploredThisRound" ? flagged(state, "table", "exploredThisRound") : null;
}
