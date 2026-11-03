import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import { campaigns } from "../../catalog/schema";

// The campaign list's catalog read. Its saves come from campaign-store (listSaves, listArchivedSaves).
export function campaignListQueries<TCatalogRun>(catalog: BaseSQLiteDatabase<"sync", TCatalogRun>) {
  return {
    campaigns: catalog
      .select({ id: campaigns.id, name: campaigns.name, scenarioCount: campaigns.scenarioCount, playable: campaigns.playable })
      .from(campaigns),
  };
}

export type CampaignRow = { id: string; name: string; scenarioCount: number; playable: boolean };

// The campaigns the list shows as locked tiles: coming soon, named with their scenario count. Locking hides no card.
export function lockedTiles(rows: readonly CampaignRow[]): { id: string; name: string; caption: string }[] {
  return rows
    .filter((row) => !row.playable)
    .map((row) => ({ id: row.id, name: row.name, caption: `${row.scenarioCount} scenarios \u00b7 Coming soon` }));
}
