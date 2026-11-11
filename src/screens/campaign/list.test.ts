import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, it } from "vitest";

import { campaignListQueries, campaignWords, lockedBoxTiles, lockedCampaignTiles, type CampaignRow } from "./list.ts";

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
    expect(campaignSql).toContain('"rco"');
    expect(campaignSql).toContain('"box"');
  });
});

describe("locked tiles", () => {
  const rows: CampaignRow[] = [
    { id: "fellowship-of-the-ring", name: "Fellowship of the Ring", scenarioCount: 6, playable: true, kind: "campaign", rco: true, box: null },
    { id: "the-return-of-the-king", name: "The Return of the King", scenarioCount: 6, playable: false, kind: "campaign", rco: true, box: "The Return of the King Saga Expansion" },
    { id: "dwarrowdelf", name: "Dwarrowdelf", scenarioCount: 9, playable: false, kind: "cycle", rco: false, box: null },
  ];

  it("lists on the Campaigns tab only the locked campaigns, tagged RCO, with their scenario count", () => {
    expect(lockedCampaignTiles(rows)).toEqual([{ id: "the-return-of-the-king", name: "The Return of the King", caption: "RCO \u00b7 6 scenarios \u00b7 Coming soon" }]);
  });

  it("lists on the Scenarios tab a locked campaign under its RCO box and a cycle tagged Cycle", () => {
    expect(lockedBoxTiles(rows)).toEqual([
      { id: "the-return-of-the-king", name: "The Return of the King Saga Expansion", caption: "RCO \u00b7 6 scenarios \u00b7 Coming soon" },
      { id: "dwarrowdelf", name: "Dwarrowdelf", caption: "Cycle \u00b7 9 scenarios \u00b7 Coming soon" },
    ]);
  });

  it("words a campaign's tile with the RCO tag only for the revised products", () => {
    expect(campaignWords({ rco: true }, 6)).toBe("RCO \u00b7 6 scenarios");
    expect(campaignWords({ rco: false }, 1)).toBe("1 scenario");
  });
});
