// Rules: emce.treasure, emce.boon-allies, emce.campaign-pool-encounter, emce.campaign-log (data/rules/entries.json). The Ered Mithrin Campaign Log's own columns: the treasures discovered, the
// "Unique Allies Protecting Wilderland" lines, the boxes marked beside Beldis for each player and the encounter cards of the Campaign Pool with their copies. Pure.
import { BELDIS_BOXES } from "../catalog/ally-lines.ts";
import type { Condition } from "../catalog/boundary.ts";
import type { CampaignFacts } from "../rules/core/campaign-state.ts";

import type { CampaignLog } from "./log.ts";

type WilderlandColumns = Pick<CampaignLog, "treasures" | "allyLines" | "beldisUses" | "encounterPool" | "campaignPool">;

/** The campaign these columns belong to (data/campaigns/ered-mithrin.json). */
export const WILDERLAND_CAMPAIGN = "ered-mithrin";

/**
 * The log as the game reads it (CampaignFacts), each fact left out while the log holds none. Only the Ered Mithrin campaign reads them, so every other campaign's game is dealt exactly as before.
 * `pool` lists the Campaign Pool's own cards, for the Resolution that lets each player remove one non-burden card (12187:B).
 */
export function wilderlandFacts(log: WilderlandColumns, campaignId: string): Pick<CampaignFacts, "treasures" | "allyLines" | "beldisUses" | "encounterPool" | "pool"> {
  if (campaignId !== WILDERLAND_CAMPAIGN) return {};
  return {
    ...(log.treasures.length > 0 ? { treasures: log.treasures } : {}),
    ...(log.allyLines.length > 0 ? { allyLines: log.allyLines } : {}),
    ...(log.beldisUses.some((used) => used > 0) ? { beldisUses: log.beldisUses } : {}),
    ...(Object.keys(log.encounterPool).length > 0 ? { encounterPool: log.encounterPool } : {}),
    ...(log.campaignPool.length > 0 ? { pool: log.campaignPool.map((card) => ({ code: card.code, seat: card.seat })) } : {}),
  };
}

/** The boxes marked beside Beldis for a seat (emce.campaign-log), never more than the four the log has. */
export function beldisUsed(log: Pick<CampaignLog, "beldisUses">, seat: number): number {
  return Math.min(BELDIS_BOXES, log.beldisUses[seat] ?? 0);
}

/** The tally of the encounter cards in the pool, no code past the copies one collection holds (emce.campaign-pool-encounter). A code with no known limit keeps its count. */
export function cappedTally(tally: Readonly<Record<string, number>>, copies: ReadonlyMap<string, number> | undefined): Record<string, number> {
  return Object.fromEntries(Object.entries(tally).flatMap(([code, count]) => {
    const kept = Math.min(count, copies?.get(code) ?? count);
    return kept > 0 ? [[code, kept] as const] : [];
  }));
}

/** The codes of the pool's encounter cards, a code once for each copy, in code order: what the deal shuffles into the encounter deck. */
export function poolEncounterCopies(tally: Readonly<Record<string, number>>): string[] {
  return Object.keys(tally).sort().flatMap((code) => Array.from({ length: tally[code] ?? 0 }, () => code));
}

/**
 * Whether a campaign Setup instruction's condition holds, when it reads the Campaign Log ("If there are 6 or more treasures recorded in the campaign log, shuffle Dragon-sickness into
 * the encounter deck", 12193:A). Setup runs before any game state exists, so the log's own facts answer. A condition of any other kind holds, as every Setup line did before this one.
 */
export function logConditionHolds(when: Condition | undefined, facts: Pick<CampaignFacts, "treasures" | "allyLines"> | undefined): boolean {
  return when == null || !readsLog(when) || holdsByLog(when, facts);
}

// Whether the condition, or one it combines, reads the Campaign Log.
function readsLog(when: Condition): boolean {
  switch (when.kind) {
    case "logged":
    case "treasuresLogged":
      return true;
    case "not":
      return readsLog(when.condition);
    case "all":
    case "any":
      return when.conditions.some(readsLog);
    default:
      return false;
  }
}

function holdsByLog(when: Condition, facts: Pick<CampaignFacts, "treasures" | "allyLines"> | undefined): boolean {
  switch (when.kind) {
    case "logged":
      return (facts?.allyLines ?? []).includes(when.line) === (when.is !== false);
    case "treasuresLogged":
      return (facts?.treasures ?? []).length >= when.min;
    case "not":
      return !holdsByLog(when.condition, facts);
    case "all":
      return when.conditions.every((condition) => holdsByLog(condition, facts));
    case "any":
      return when.conditions.some((condition) => holdsByLog(condition, facts));
    default:
      return true;
  }
}
