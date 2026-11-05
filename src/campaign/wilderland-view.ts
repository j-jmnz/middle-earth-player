// Rules: emce.campaign-log, emce.boon-allies, emce.treasure, emce.campaign-pool-encounter (data/rules/entries.json). How the Ered Mithrin Campaign Log's own columns read on the path and the
// log screen: the treasures, the lines, the boxes beside Beldis and the encounter cards of the pool. Pure, so a test reads it.
import { ALLY_LINES, ALLY_LINE_FACTS, BELDIS_BOXES } from "../catalog/ally-lines.ts";

import type { CampaignLog } from "./log.ts";
import { beldisUsed, WILDERLAND_CAMPAIGN } from "./wilderland.ts";

/** Whether the campaign keeps the Ered Mithrin columns. */
export function keepsWilderlandLog(campaign: { id: string }): boolean {
  return campaign.id === WILDERLAND_CAMPAIGN;
}

export type WilderlandView = {
  // The treasures discovered, as card codes.
  treasures: readonly string[];
  // The recorded lines, as the log prints them, in the sheet's order.
  lines: readonly string[];
  // Beldis's boxes for each seat: "2 of 4 used", with "Player 1: " in front when two play.
  beldis: readonly string[];
  // The pool's encounter cards: the code and its copies.
  encounter: readonly { code: string; copies: number }[];
};

export function wilderlandView(log: Pick<CampaignLog, "treasures" | "allyLines" | "beldisUses" | "encounterPool">, seatCount: number): WilderlandView {
  return {
    treasures: log.treasures,
    lines: ALLY_LINES.filter((line) => log.allyLines.includes(line)).map((line) => ALLY_LINE_FACTS[line].words),
    beldis: Array.from({ length: seatCount }, (_, seat) => `${seatCount > 1 ? `Player ${seat + 1}: ` : ""}${beldisUsed(log, seat)} of ${BELDIS_BOXES} used`),
    encounter: Object.keys(log.encounterPool).sort().map((code) => ({ code, copies: log.encounterPool[code] ?? 0 })),
  };
}
