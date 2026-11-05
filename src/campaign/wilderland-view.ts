// Rules: emce.campaign-log, emce.boon-allies, emce.treasure, emce.campaign-pool-encounter (data/rules/entries.json). How the Ered Mithrin Campaign Log's own columns read on the path and the
// log screen: the treasures, the lines, the boxes beside Beldis and the encounter cards of the pool. Pure, so a test reads it.
import { ALLY_LINES, ALLY_LINE_FACTS, BELDIS_BOXES } from "../catalog/ally-lines.ts";

import type { CampaignLog } from "./log.ts";
import { beldisUsed, WILDERLAND_CAMPAIGN } from "./wilderland.ts";
import { markedLabel } from "./xp-view.ts";

/** Whether the campaign keeps the Ered Mithrin columns. */
export function keepsWilderlandLog(campaign: { id: string }): boolean {
  return campaign.id === WILDERLAND_CAMPAIGN;
}

export type WilderlandView = {
  // The treasures discovered, as card codes.
  treasures: readonly string[];
  // The recorded lines, as the log prints them, in the sheet's order.
  lines: readonly string[];
  // Beldis's boxes for each seat, drawn as the Dream-chaser rows are ("■■□□"), with "Player 1: " in front when two play; `speech` is what a screen reader hears, `used` the boxes marked.
  beldis: readonly { prefix: string; boxes: string; used: number; speech: string }[];
  // The pool's encounter cards: the code and its copies.
  encounter: readonly { code: string; copies: number }[];
};

export function wilderlandView(log: Pick<CampaignLog, "treasures" | "allyLines" | "beldisUses" | "encounterPool">, seatCount: number): WilderlandView {
  return {
    treasures: log.treasures,
    lines: ALLY_LINES.filter((line) => log.allyLines.includes(line)).map((line) => ALLY_LINE_FACTS[line].words),
    beldis: Array.from({ length: seatCount }, (_, seat) => {
      const used = beldisUsed(log, seat);
      const prefix = seatCount > 1 ? `Player ${seat + 1}: ` : "";
      return { prefix, boxes: `${"\u25a0".repeat(used)}${"\u25a1".repeat(BELDIS_BOXES - used)}`, used, speech: `${prefix}${markedLabel("Beldis", used, BELDIS_BOXES)}` };
    }),
    encounter: Object.keys(log.encounterPool).sort().map((code) => ({ code, copies: log.encounterPool[code] ?? 0 })),
  };
}

/** What a screen reader hears for the pool's encounter cards, since "×2" says little: "A Growing Threat. Gundabad Hunter, 2 copies". */
export function encounterSpeech(entries: WilderlandView["encounter"], nameOf: (code: string) => string): string {
  return entries.map((entry) => (entry.copies > 1 ? `${nameOf(entry.code)}, ${entry.copies} copies` : nameOf(entry.code))).join(". ");
}

/** The multiplier after a card's name on the path and the log ("×2"); nothing for a single copy. */
export function copiesMark(copies: number): string {
  return copies > 1 ? ` \u00d7${copies}` : "";
}
