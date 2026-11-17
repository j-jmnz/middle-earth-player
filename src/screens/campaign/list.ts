import { asc } from "drizzle-orm";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import { campaigns } from "../../catalog/schema";

// The campaign list's catalog read. Its saves come from campaign-store (listSaves, listArchivedSaves).
export function campaignListQueries<TCatalogRun>(catalog: BaseSQLiteDatabase<"sync", TCatalogRun>) {
  return {
    campaigns: catalog
      .select({ id: campaigns.id, name: campaigns.name, scenarioCount: campaigns.scenarioCount, playable: campaigns.playable, kind: campaigns.kind, box: campaigns.box })
      .from(campaigns)
      // Release order, the Lord of the Rings saga boxes together at the Fellowship's (the build's `position`).
      .orderBy(asc(campaigns.position)),
  };
}

export type CampaignRow = { id: string; name: string; scenarioCount: number; playable: boolean; kind: "campaign" | "cycle"; box: string | null };

export type LockedTile = { id: string; name: string; caption: string };

// "6 scenarios", "1 scenario": what a campaign's or a cycle's tile says under its name.
export function scenarioWords(count: number): string {
  return `${count} ${count === 1 ? "scenario" : "scenarios"}`;
}

// The Campaigns tab's New playthrough tiles: the campaigns the catalog marks playable. A cycle (Shadows of Mirkwood) has no Campaign Mode and is played from the
// Scenarios tab, so it never offers a new playthrough, playable or not.
export function startableRows(rows: readonly CampaignRow[]): CampaignRow[] {
  return rows.filter((row) => row.playable && row.kind === "campaign");
}

// The Campaigns tab's locked tiles: the campaigns no scenario of is playable yet, named as campaigns. Locking hides no card.
export function lockedCampaignTiles(rows: readonly CampaignRow[]): LockedTile[] {
  return rows
    .filter((row) => !row.playable && row.kind === "campaign")
    .map((row) => ({ id: row.id, name: row.name, caption: `${scenarioWords(row.scenarioCount)} \u00b7 Coming soon` }));
}

// The Scenarios tab's locked tiles: every locked row, a campaign under the RCO box it is printed in and a cycle (scenarios that
// are part of no campaign) captioned "Cycle".
export function lockedBoxTiles(rows: readonly CampaignRow[]): LockedTile[] {
  return rows
    .filter((row) => !row.playable)
    .map((row) => {
      const tag = row.kind === "cycle" ? "Cycle" : null;
      return { id: row.id, name: row.box ?? row.name, caption: [tag, scenarioWords(row.scenarioCount), "Coming soon"].filter((part) => part != null).join(" \u00b7 ") };
    });
}
