// Rules: mec112.campaign-mode-aragorn (data/rules/entries.json); the Campaign Log columns of The Two Towers (docs/brief.md, The Two Towers). How the log's own columns
// read on the log screen: the threat each seat starts with, the choice each seat made in The Passage of the Marshes and the enemies under The Black Gate. Pure, so a test reads it.
import type { CampaignLog, MarshesChoice } from "./log.ts";

/** The campaign whose log keeps these columns (data/campaigns/the-two-towers.json). */
export const TWO_TOWERS_CAMPAIGN = "the-two-towers";

/** Whether the campaign keeps The Two Towers columns. */
export function keepsTwoTowersLog(campaign: { id: string }): boolean {
  return campaign.id === TWO_TOWERS_CAMPAIGN;
}

/** The permanent starting threat penalty a seat takes: the table's `threatPenalty` and the seat's own. */
export function seatPenalty(log: Pick<CampaignLog, "threatPenalty" | "threatPenaltyBySeat">, seat: number): number {
  return log.threatPenalty + (log.threatPenaltyBySeat[seat] ?? 0);
}

/** The Threat Modifiers row: one number for every player ("None", "+1") until a seat has a penalty of its own, then each seat's ("Player 1: +3 · Player 2: +1"). */
export function threatWords(log: Pick<CampaignLog, "threatPenalty" | "threatPenaltyBySeat">, seatCount: number): string {
  const seats = Array.from({ length: seatCount }, (_, seat) => seat);
  if (seats.every((seat) => (log.threatPenaltyBySeat[seat] ?? 0) === 0)) return log.threatPenalty === 0 ? "None" : `+${log.threatPenalty}`;
  if (seatCount === 1) return `+${seatPenalty(log, 0)}`;
  return seats.map((seat) => `Player ${seat + 1}: +${seatPenalty(log, seat)}`).join(" · ");
}

const CHOICE_WORDS: Readonly<Record<MarshesChoice, string>> = { penalty: "a permanent +2 starting threat penalty", searchingEye: "The Searching Eye" };

/** What each seat chose in The Passage of the Marshes, one line a seat that has chosen ("Player 1: a permanent +2 starting threat penalty"). */
export function marshesLines(log: Pick<CampaignLog, "marshesChoice">, seatCount: number): string[] {
  return Array.from({ length: seatCount }, (_, seat) => {
    const choice = log.marshesChoice[seat];
    return choice ? [`${seatCount > 1 ? `Player ${seat + 1}: ` : ""}${CHOICE_WORDS[choice]}`] : [];
  }).flat();
}

/** The enemies underneath The Black Gate, by card code, with their quantity: what Journey to the Cross-roads recorded in the notes section. */
export function blackGateEnemies(log: Pick<CampaignLog, "blackGate">): { code: string; count: number }[] {
  return Object.keys(log.blackGate).sort().map((code) => ({ code, count: log.blackGate[code] ?? 0 }));
}
