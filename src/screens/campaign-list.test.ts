import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, it } from "vitest";

import { campaignListQueries, lockedTiles } from "./campaign-list.ts";

describe("campaignListQueries", () => {
  it("reads campaigns without touching cards", () => {
    const db = drizzle(new Database(":memory:"));
    const queries = campaignListQueries(db);
    const campaignSql = queries.campaigns.toSQL().sql;

    expect(campaignSql.toLowerCase()).not.toContain("cards");
    expect(campaignSql).toContain("campaigns");
    expect(campaignSql).toContain('"id"');
    expect(campaignSql).toContain('"name"');
    expect(campaignSql).toContain("scenario_count");
    expect(campaignSql).toContain("playable");
  });
});

describe("lockedTiles", () => {
  it("lists only the campaigns that are not playable, with name and scenario count", () => {
    const tiles = lockedTiles([
      { id: "fellowship-of-the-ring", name: "Fellowship of the Ring", scenarioCount: 6, playable: true },
      { id: "the-two-towers", name: "The Two Towers", scenarioCount: 6, playable: false },
    ]);
    expect(tiles).toEqual([{ id: "the-two-towers", name: "The Two Towers", caption: "6 scenarios \u00b7 Locked" }]);
  });
});
