// Rules: emce.boon-allies, emce.treasure, emce.campaign-log (data/rules/entries.json). The one reading of the conditions that look at the Campaign Log: a "Unique Allies Protecting Wilderland" line is
// recorded, or enough treasures are. The game reads it through the family manifest, and the campaign's Setup (before any game state exists) through logConditionHolds. Pure.
import type { Condition } from "../../../catalog/boundary.ts";
import type { CampaignFacts } from "../../core/campaign-state.ts";

export type LogFacts = Pick<CampaignFacts, "treasures" | "allyLines">;

/** Whether the log holds what a log condition asks, or null for a condition of another kind. Facts left out hold nothing. */
export function logCondition(found: Condition, facts: LogFacts | undefined): boolean | null {
  if (found.kind === "logged") return (facts?.allyLines ?? []).includes(found.line) === (found.is !== false);
  if (found.kind === "treasuresLogged") return (facts?.treasures ?? []).length >= found.min;
  return null;
}
