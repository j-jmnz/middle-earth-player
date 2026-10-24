import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import { campaigns } from "../catalog/schema";
import { saves } from "./user-schema";

export function campaignListQueries<TCatalogRun, TUserRun>(
  catalog: BaseSQLiteDatabase<"sync", TCatalogRun>,
  user: BaseSQLiteDatabase<"sync", TUserRun>,
) {
  return {
    campaigns: catalog
      .select({ id: campaigns.id, name: campaigns.name, scenarioCount: campaigns.scenarioCount, playable: campaigns.playable })
      .from(campaigns),
    saves: user.select({ id: saves.id, campaignId: saves.campaignId }).from(saves),
  };
}

export type CampaignRow = { id: string; name: string; scenarioCount: number; playable: boolean };

// The campaigns the list shows as locked tiles: not playable yet, named with their scenario count. Locking hides no card.
export function lockedTiles(rows: readonly CampaignRow[]): { id: string; name: string; caption: string }[] {
  return rows
    .filter((row) => !row.playable)
    .map((row) => ({ id: row.id, name: row.name, caption: `${row.scenarioCount} scenarios \u00b7 Locked` }));
}
