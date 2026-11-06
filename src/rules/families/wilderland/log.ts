// Rules: emce.boon-allies, emce.treasure, emce.campaign-log (data/rules/entries.json). The one reading of the conditions that look at the Campaign Log: a "Unique Allies Protecting Wilderland" line is
// recorded, or enough treasures are. The game reads it through the family manifest, and the campaign's Setup (before any game state exists) through logConditionHolds. Pure.
import type { Condition } from "../../../catalog/boundary.ts";
import type { CampaignFacts } from "../../core/campaign-state.ts";
import type { ScenarioState } from "../../core/state.ts";

export type LogFacts = Pick<CampaignFacts, "treasures" | "allyLines">;

/** Whether the log holds what a log condition asks, or null for a condition of another kind. Facts left out hold nothing. */
export function logCondition(found: Condition, facts: LogFacts | undefined): boolean | null {
  if (found.kind === "logged") return (facts?.allyLines ?? []).includes(found.line) === (found.is !== false);
  if (found.kind === "treasuresLogged") return (facts?.treasures ?? []).length >= found.min;
  return null;
}

/**
 * The log as a condition reads it during the game: the campaign's facts, with the treasures the Resolution has discovered so far counted as recorded ("The players discover each treasure they control", then "If there are 6 or more treasures recorded in the campaign log",
 * 12193:B:3 and B:5): the Resolution's lines are read in their printed order. Before the Resolution nothing was discovered and the facts are returned as they are.
 */
export function logFacts(state: ScenarioState): LogFacts | undefined {
  const found = state.resolutionLog?.treasures ?? [];
  const facts = state.campaignFacts;
  if (found.length === 0) return facts;
  return { allyLines: facts?.allyLines ?? [], treasures: [...new Set([...(facts?.treasures ?? []), ...found])] };
}
