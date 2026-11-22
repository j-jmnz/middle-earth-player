// The campaign facts a log gives a game beyond the prisoner, the once-per-campaign uses and the counters: the Dream-chaser log's levels and
// upgraded cards, and the columns of the Wilderland, Two Towers, Return of the King and Angmar Awakened logs (each is none for another
// campaign). The briefing deals a real game with them (src/campaign/briefing.ts) and the test kit deals a test game with the same ones
// (test/harness/game-kit.ts), so a golden starts with the facts a real game has. Pure.
import type { CampaignFacts } from "../rules/core/campaign-state.ts";
import type { PrintedCard } from "../rules/core/printed.ts";

import type { CampaignLog } from "./log.ts";
import { angmarAwakenedFacts } from "./log-angmar-awakened.ts";
import { returnOfTheKingFacts } from "./log-return-of-the-king.ts";
import { twoTowersFacts } from "./log-two-towers.ts";
import { wilderlandFacts } from "./wilderland.ts";
import { xpFacts } from "./xp.ts";

export type LogFacts = Partial<Omit<CampaignFacts, "modeCard" | "prisoner" | "usedOnce" | "counters">>;

/** The facts of `log` (the marks) and of `planned` (the log the Campaign Setup Checklist leaves) for a game of `campaignId`. */
export function logFacts(log: CampaignLog, planned: CampaignLog, campaignId: string, cards: ReadonlyMap<string, PrintedCard>): LogFacts {
  return { ...xpFacts(log), ...wilderlandFacts(planned, campaignId), ...twoTowersFacts(planned, campaignId, cards), ...returnOfTheKingFacts(planned, campaignId), ...angmarAwakenedFacts(planned, campaignId) };
}
