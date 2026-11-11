// Rules: mec113.campaign-mode, rr.campaign-log (data/rules/entries.json). The Return of the King's columns of the Campaign Log (docs/brief.md, The Return of the King): what the box's later campaign cards' Setup reads from the notes
// section ("each Harad enemy recorded in the campaign log", "the number recorded in the campaign log", "the number of resource tokens on The Black Gate, as recorded in the campaign log"), handed to the game as facts. Pure.
import type { CampaignFacts } from "../rules/core/campaign-state.ts";

import type { CampaignLog } from "./log.ts";
import { RETURN_OF_THE_KING_CAMPAIGN } from "./saga.ts";

/** The notes of the log as a game of The Return of the King reads them (`CampaignFacts.notes`); another campaign's game reads none. */
export function returnOfTheKingFacts(log: Pick<CampaignLog, "blackGate" | "corsairFleet" | "blackGateTokens">, campaignId: string): Pick<CampaignFacts, "notes"> {
  if (campaignId !== RETURN_OF_THE_KING_CAMPAIGN) return {};
  return { notes: { blackGate: log.blackGate, corsairFleet: log.corsairFleet, blackGateTokens: log.blackGateTokens } };
}

/** One row of the log's notes section that The Return of the King adds: what it records, and where it was recorded. */
export type NoteRow = { id: "log-corsair-fleet" | "log-black-gate-tokens" | "log-ring"; label: string; value: string };

const plural = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`;

/** The notes rows a log holds, in the order the scenarios record them: the resources on The Corsair Fleet, the resource tokens on The Black Gate, how the saga ended. A row appears once it holds something. */
export function returnOfTheKingRows(log: Pick<CampaignLog, "corsairFleet" | "blackGateTokens" | "campaignEnd">): NoteRow[] {
  const rows: NoteRow[] = [];
  if (log.corsairFleet != null) rows.push({ id: "log-corsair-fleet", label: "The Siege of Gondor", value: `${plural(log.corsairFleet, "resource", "resources")} on The Corsair Fleet` });
  if (log.blackGateTokens != null) rows.push({ id: "log-black-gate-tokens", label: "The Black Gate Opens", value: `${plural(log.blackGateTokens, "resource token", "resource tokens")} on The Black Gate` });
  if (log.campaignEnd != null) rows.push({ id: "log-ring", label: "The One Ring", value: log.campaignEnd === "won" ? "Destroyed: the players win the campaign" : "Kept: the players lose the campaign" });
  return rows;
}
