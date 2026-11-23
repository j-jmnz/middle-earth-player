// Rules: hob.setup-we-must-away-ere-break-of-day, rr.quest-advancement, rr.forced (data/rules/entries.json); ledger lines 131024:B:1 and 131024:B:2 (docs/scenarios/the-hobbit/we-must-away-ere-break-of-day.md, We Must Away, Ere Break of Day, Stage 2B).
//
// What the table says of stage 2B, Roast Mutton: progress on it discards encounter cards (`progressDiscards`) and never fills its quest point, so the stage is told by how it advances, not by a quest-point strip. It advances when no Troll enemy is in play or the encounter deck is empty. Pure.
import type { CardInstance, ScenarioState } from "../../../rules/core/state.ts";
import { flagged } from "../../../rules/core/state.ts";

const SCENARIO = "we-must-away-ere-break-of-day";

/** Whether the stage takes no progress that counts: it turns the progress into discards from the encounter deck (as Fog on the Barrow-downs' stage 3B shows no strip for progress it does not take). False in any other scenario. */
export function stageTurnsProgressIntoDiscards(game: ScenarioState, stage: CardInstance): boolean {
  return game.scenarioId === SCENARIO && flagged(game, stage.id, "progressDiscards");
}

/** How the stage advances, with the cards the encounter deck has left. Null for any other stage and in any other scenario. */
export function stageAdvanceWords(game: ScenarioState, stage: CardInstance): string | null {
  return stageTurnsProgressIntoDiscards(game, stage) ? `Advances when no Troll is in play, or the encounter deck is empty (${game.encounterDeck.length} left)` : null;
}
