import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import { campaigns } from "../catalog/schema";
import { saves } from "./user-schema";

export function campaignListQueries<TCatalogRun, TUserRun>(
  catalog: BaseSQLiteDatabase<"sync", TCatalogRun>,
  user: BaseSQLiteDatabase<"sync", TUserRun>,
) {
  return {
    campaigns: catalog.select({ id: campaigns.id, name: campaigns.name }).from(campaigns),
    saves: user.select({ id: saves.id, campaignId: saves.campaignId }).from(saves),
  };
}
