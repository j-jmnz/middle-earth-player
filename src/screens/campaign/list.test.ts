import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, it } from "vitest";

import { campaignListQueries, lockedBoxTiles, lockedCampaignTiles, scenarioWords, type CampaignRow } from "./list.ts";

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
    expect(campaignSql).toContain('"kind"');
    expect(campaignSql).toContain('"box"');
    expect(campaignSql).toMatch(/order by "campaigns"\."position" asc/);
  });
});

describe("locked tiles", () => {
  const rows: CampaignRow[] = [
    { id: "fellowship-of-the-ring", name: "Fellowship of the Ring", scenarioCount: 6, playable: true, kind: "campaign", box: null },
    { id: "the-return-of-the-king", name: "The Return of the King", scenarioCount: 6, playable: false, kind: "campaign", box: "The Return of the King Saga Expansion" },
    { id: "dwarrowdelf", name: "Dwarrowdelf", scenarioCount: 9, playable: false, kind: "cycle", box: null },
  ];

  it("lists on the Campaigns tab only the locked campaigns, with their scenario count", () => {
    expect(lockedCampaignTiles(rows)).toEqual([{ id: "the-return-of-the-king", name: "The Return of the King", caption: "6 scenarios \u00b7 Coming soon" }]);
  });

  it("lists on the Scenarios tab a locked campaign under its RCO box and a cycle captioned Cycle", () => {
    expect(lockedBoxTiles(rows)).toEqual([
      { id: "the-return-of-the-king", name: "The Return of the King Saga Expansion", caption: "6 scenarios \u00b7 Coming soon" },
      { id: "dwarrowdelf", name: "Dwarrowdelf", caption: "Cycle \u00b7 9 scenarios \u00b7 Coming soon" },
    ]);
  });

  it("counts a tile's scenarios", () => {
    expect(scenarioWords(6)).toBe("6 scenarios");
    expect(scenarioWords(1)).toBe("1 scenario");
  });
});
