import { asc } from "drizzle-orm";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import { campaigns } from "../../catalog/schema";

// The campaign list's catalog read. Its saves come from campaign-store (listSaves, listArchivedSaves).
export function campaignListQueries<TCatalogRun>(catalog: BaseSQLiteDatabase<"sync", TCatalogRun>) {
  return {
    campaigns: catalog
      .select({ id: campaigns.id, name: campaigns.name, scenarioCount: campaigns.scenarioCount, playable: campaigns.playable, kind: campaigns.kind, rco: campaigns.rco, box: campaigns.box })
      .from(campaigns)
      // Release order (the US release of the product that starts each), then id for one day's releases.
      .orderBy(asc(campaigns.released), asc(campaigns.id)),
  };
}

export type CampaignRow = { id: string; name: string; scenarioCount: number; playable: boolean; kind: "campaign" | "cycle"; rco: boolean; box: string | null };

type LockedTile = { id: string; name: string; caption: string };

// What a campaign's tile says under its name: "RCO · 6 scenarios" for one played from the revised, repackaged products.
export function campaignWords(row: Pick<CampaignRow, "rco">, count: number): string {
  return [row.rco ? "RCO" : null, `${count} ${count === 1 ? "scenario" : "scenarios"}`].filter((part) => part != null).join(" \u00b7 ");
}

// The Campaigns tab's locked tiles: the campaigns no scenario of is playable yet, named as campaigns. Locking hides no card.
export function lockedCampaignTiles(rows: readonly CampaignRow[]): LockedTile[] {
  return rows
    .filter((row) => !row.playable && row.kind === "campaign")
    .map((row) => ({ id: row.id, name: row.name, caption: `${campaignWords(row, row.scenarioCount)} \u00b7 Coming soon` }));
}

// The Scenarios tab's locked tiles: every locked row, a campaign under the RCO box it is printed in and a cycle (scenarios that
// are part of no campaign) tagged "Cycle".
export function lockedBoxTiles(rows: readonly CampaignRow[]): LockedTile[] {
  return rows
    .filter((row) => !row.playable)
    .map((row) => {
      const tag = row.kind === "cycle" ? "Cycle" : row.rco ? "RCO" : null;
      const count = `${row.scenarioCount} ${row.scenarioCount === 1 ? "scenario" : "scenarios"}`;
      return { id: row.id, name: row.box ?? row.name, caption: [tag, count, "Coming soon"].filter((part) => part != null).join(" \u00b7 ") };
    });
}
