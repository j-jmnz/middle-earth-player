// Rules: rr.forced (data/rules/entries.json); ledger lines 21047:A:2, 21047:A:3 (docs/scenarios/vengeance-of-mordor/danger-in-dorwinion.md, Table).
// The pill on Seedy Tavern while encounter cards lie facedown under it: the count, never which cards. The engine decided the cards (`cardsUnder`); nothing here changes one. Empty on any other location and in any other scenario. Pure.
import { cardsUnder } from "../../../rules/core/zones.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";

const TAVERN = "21047";

/** The pill of Seedy Tavern in the staging area or as the active location, or null. Same shape as the Underworld stack's (readouts/against-the-shadow/stewards-fear.ts). */
export function tavernMark(game: ScenarioState, cardId: string): { text: string; loses: boolean; speech: string; count: number } | null {
  const card = game.cards[cardId];
  if (game.scenarioId !== "danger-in-dorwinion" || card?.code !== TAVERN || (card.zone !== "staging" && card.zone !== "activeLocation")) return null;
  const count = cardsUnder(game, cardId).length;
  return count > 0 ? { text: `${count} facedown`, loses: false, speech: `${count} encounter ${count === 1 ? "card" : "cards"} facedown underneath. Each is revealed when this location is explored.`, count } : null;
}
