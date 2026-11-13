// Rules: mec108.campaign-log, mec108.campaign-log-tracking (data/rules/entries.json). The Angmar Awakened Campaign Log's own rows (MEC108 Campaign Log sheet, PDF page 27, "Damage Tracking"): the damage on Protect the Innocent / Arnor Ravaged, the damage on
// each hero, the unique cards each player lost to the Goblins and the characters marked "determined". Pure.
import type { CampaignFacts, ResolutionLog } from "../rules/core/campaign-state.ts";

import type { CampaignLog } from "./log.ts";

/** The campaign these columns belong to (data/campaigns/angmar-awakened.json). */
export const ANGMAR_AWAKENED_CAMPAIGN = "angmar-awakened";

type AngmarColumns = Pick<CampaignLog, "protectDamage" | "heroDamage" | "determined" | "stolenCards">;

/** The log as a game of Angmar Awakened reads it (`CampaignFacts.angmar`); another campaign's game reads none, and neither does a log that holds nothing in these rows. */
export function angmarAwakenedFacts(log: AngmarColumns, campaignId: string): Pick<CampaignFacts, "angmar"> {
  if (campaignId !== ANGMAR_AWAKENED_CAMPAIGN) return {};
  const empty = log.protectDamage == null && Object.keys(log.heroDamage).length === 0 && log.determined.length === 0 && log.stolenCards.every((cards) => cards.length === 0);
  return empty ? {} : { angmar: { protectDamage: log.protectDamage, heroDamage: log.heroDamage, determined: log.determined, stolen: log.stolenCards } };
}

/** The unique cards each seat lost, with the ones a won Escape from Mount Gram stole (`ResolutionLog.stolen`): each seat's codes added to the logged ones, once each. */
export function stolenAfter(logged: readonly (readonly string[])[], stolen: readonly (readonly string[])[] | undefined): readonly (readonly string[])[] {
  if (!stolen) return logged;
  return Array.from({ length: Math.max(logged.length, stolen.length) }, (_, seat) => [...new Set([...(logged[seat] ?? []), ...(stolen[seat] ?? [])])]);
}

/** Whether the campaign keeps the Damage Tracking rows. */
export function keepsAngmarAwakenedLog(campaign: { id: string }): boolean {
  return campaign.id === ANGMAR_AWAKENED_CAMPAIGN;
}

/** Every card code the rows name, for the screen to look the names up. */
export function angmarAwakenedCodes(log: AngmarColumns): string[] {
  return [...Object.keys(log.heroDamage), ...log.determined, ...log.stolenCards.flat()];
}

/** One line of a row: a prefix ("Player 2: "), the cards it names (none reads "None"), and the number after the first card's name ("Glorfindel: 2"). */
export type AngmarLine = { prefix: string; codes: readonly string[]; amount: number | null };

/**
 * The rows the log shows after Burdens, each once it holds something, labelled as the sheet prints them: "Protect the Innocent / Arnor Ravaged damage" is a bare number (a recorded 0 shows "0"); the others are lines,
 * one hero with its damage per line, one determined character per line, and the unique cards stolen by Goblins one line per seat in two-handed play ("None" for a seat that lost nothing).
 */
export type AngmarRow = { id: "log-protect-damage" | "log-hero-damage" | "log-stolen" | "log-determined"; label: string } & ({ value: string } | { lines: readonly AngmarLine[] });

export function angmarAwakenedRows(log: AngmarColumns, seatCount: number): AngmarRow[] {
  const rows: AngmarRow[] = [];
  if (log.protectDamage != null) rows.push({ id: "log-protect-damage", label: "Damage on Protect the Innocent / Arnor Ravaged", value: String(log.protectDamage) });
  const damaged = Object.entries(log.heroDamage);
  if (damaged.length > 0) rows.push({ id: "log-hero-damage", label: "Damage on Heroes", lines: damaged.map(([code, amount]) => ({ prefix: "", codes: [code], amount })) });
  if (log.stolenCards.some((cards) => cards.length > 0)) {
    const seats = Array.from({ length: seatCount }, (_, seat) => ({ prefix: seatCount > 1 ? `Player ${seat + 1}: ` : "", codes: log.stolenCards[seat] ?? [], amount: null }));
    rows.push({ id: "log-stolen", label: "Unique Cards Stolen by Goblins", lines: seats });
  }
  if (log.determined.length > 0) rows.push({ id: "log-determined", label: "Determined Characters", lines: log.determined.map((code) => ({ prefix: "", codes: [code], amount: null })) });
  return rows;
}

/** The sentences the Resolution screen adds for what the Resolution noted: the damage (`damageNotes`), the starting threat Fend Off Despair lowered and the characters marked determined, as the Two Towers' notes say a recorded count. */
export function angmarAwakenedNotes(log: ResolutionLog, name: (code: string) => string): readonly string[] {
  const notes: string[] = [];
  const { protect, heroes } = log.damageNotes ?? {};
  if (protect != null) notes.push(`${protect} damage on Protect the Innocent / Arnor Ravaged, noted in the campaign log.`);
  if (heroes != null) {
    const damaged = Object.entries(heroes);
    notes.push(damaged.length === 0 ? "No hero has damage to note in the campaign log." : `Damage on heroes noted in the campaign log: ${damaged.map(([code, damage]) => `${name(code)} ${damage}`).join(", ")}.`);
  }
  // The Wastes of Eriador: what the win wrote to the log (Fend Off Despair's lowered starting threat, the characters marked determined), as the Two Towers' notes say a recorded count.
  if (log.startingThreat != null && log.startingThreat !== 0) notes.push(`Each player's starting threat is ${Math.abs(log.startingThreat)} ${log.startingThreat < 0 ? "lower" : "higher"} from now on, noted in the campaign log.`);
  if (log.determined != null && log.determined.length > 0) notes.push(`Marked determined in the campaign log: ${log.determined.map(name).join(", ")}.`);
  return notes;
}
