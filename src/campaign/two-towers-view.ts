// Rules: mec112.campaign-mode-aragorn (data/rules/entries.json); the Campaign Log columns of The Two Towers (docs/brief.md, The Two Towers). How the log's own columns
// read on the log screen: the threat each seat starts with, the choice each seat made in The Passage of the Marshes and the enemies under The Black Gate. Pure, so a test reads it.
import type { CampaignLog, MarshesChoice } from "./log.ts";

/** The permanent starting threat penalty a seat takes: the table's `threatPenalty` and the seat's own. */
export function seatPenalty(log: Pick<CampaignLog, "threatPenalty" | "threatPenaltyBySeat">, seat: number): number {
  return log.threatPenalty + (log.threatPenaltyBySeat[seat] ?? 0);
}

/** A starting threat modifier with its sign: "+3", "-2" (a reduction, Fend Off Despair, 10173:A:2), "+0". */
export function signed(amount: number): string {
  return amount < 0 ? `${amount}` : `+${amount}`;
}

/** The Threat Modifiers row: one number for every player ("None", "+1") until a seat has a penalty of its own, then each seat's ("Player 1: +3 · Player 2: +1"). */
export function threatWords(log: Pick<CampaignLog, "threatPenalty" | "threatPenaltyBySeat">, seatCount: number): string {
  const seats = Array.from({ length: seatCount }, (_, seat) => seat);
  if (seats.every((seat) => (log.threatPenaltyBySeat[seat] ?? 0) === 0)) return log.threatPenalty === 0 ? "None" : signed(log.threatPenalty);
  if (seatCount === 1) return signed(seatPenalty(log, 0));
  return seats.map((seat) => `Player ${seat + 1}: ${seatPenalty(log, seat) === 0 ? "None" : signed(seatPenalty(log, seat))}`).join(" · ");
}

const CHOICE_WORDS: Readonly<Record<Exclude<MarshesChoice, "searchingEye">, string>> = { penalty: "a permanent +2 starting threat penalty" };

/** The Searching Eye, the card a seat may earn instead of the penalty: its name is a dotted, previewable card on the log. */
export const SEARCHING_EYE = "144015";

/** One part of a log line: its text, and the card it opens when it names one. */
export type LogPart = { text: string; code?: string };

/** What each seat chose in The Passage of the Marshes, one line a seat that has chosen ("Player 1: a permanent +2 starting threat penalty"); the Searching Eye is a card part. */
export function marshesLines(log: Pick<CampaignLog, "marshesChoice">, seatCount: number, nameOf: (code: string) => string): LogPart[][] {
  return Array.from({ length: seatCount }, (_, seat) => {
    const choice = log.marshesChoice[seat];
    if (!choice) return [];
    const who = { text: seatCount > 1 ? `Player ${seat + 1}: ` : "" };
    return [choice === "searchingEye" ? [who, { text: nameOf(SEARCHING_EYE), code: SEARCHING_EYE }] : [who, { text: CHOICE_WORDS[choice] }]];
  }).flat();
}

/** The enemies underneath The Black Gate, by card code, with their quantity: what Journey to the Cross-roads recorded in the notes section. */
export function blackGateEnemies(log: Pick<CampaignLog, "blackGate">): { code: string; count: number }[] {
  return Object.keys(log.blackGate).sort().map((code) => ({ code, count: log.blackGate[code] ?? 0 }));
}
