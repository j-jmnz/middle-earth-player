import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, it } from "vitest";

import { campaignListQueries } from "./campaign-list.ts";

describe("campaignListQueries", () => {
  it("reads campaigns and saves without touching cards", () => {
    const db = drizzle(new Database(":memory:"));
    const queries = campaignListQueries(db, db);
    const campaignSql = queries.campaigns.toSQL().sql;
    const saveSql = queries.saves.toSQL().sql;

    expect(campaignSql.toLowerCase()).not.toContain("cards");
    expect(saveSql.toLowerCase()).not.toContain("cards");
    expect(campaignSql).toContain("campaigns");
    expect(campaignSql).toContain('"id"');
    expect(campaignSql).toContain('"name"');
    expect(saveSql).toContain("saves");
    expect(saveSql).toContain("campaign_id");
  });
});
