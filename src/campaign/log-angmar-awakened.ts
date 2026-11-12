// Rules: mec108.campaign-log, mec108.campaign-log-tracking (data/rules/entries.json). The Angmar Awakened Campaign Log's own rows (MEC108 p.31 to 32, "Damage Tracking"): the damage on Protect the Innocent / Arnor Ravaged, the damage on
// each hero, the unique cards each player lost to the Goblins and the characters marked "determined". Pure.
import type { CampaignFacts } from "../rules/core/campaign-state.ts";

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

/** The rows the log shows for the box, each once it holds something: the damage on Protect the Innocent (Arnor Ravaged from the third scenario), the damage on each hero, and the characters that are determined. */
export type AngmarRow = { id: "log-protect-damage" | "log-hero-damage" | "log-stolen" | "log-determined"; label: string; codes: readonly string[]; value: string | null };

export function angmarAwakenedRows(log: AngmarColumns, seatCount: number): AngmarRow[] {
  const rows: AngmarRow[] = [];
  if (log.protectDamage != null) rows.push({ id: "log-protect-damage", label: "Damage on Protect the Innocent / Arnor Ravaged", codes: [], value: String(log.protectDamage) });
  const damaged = Object.entries(log.heroDamage);
  if (damaged.length > 0) rows.push({ id: "log-hero-damage", label: "Damage on Heroes", codes: damaged.map(([code]) => code), value: damaged.map(([, damage]) => String(damage)).join(", ") });
  if (log.stolenCards.some((cards) => cards.length > 0)) {
    rows.push({ id: "log-stolen", label: "Unique Cards Stolen by Goblins", codes: log.stolenCards.slice(0, seatCount).flat(), value: null });
  }
  if (log.determined.length > 0) rows.push({ id: "log-determined", label: "Determined Characters", codes: log.determined, value: null });
  return rows;
}
