import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { campaignIndexSchema } from "../../src/catalog/scenario-data.ts";
import { DATA_DIR } from "./paths.ts";
import { loadCampaign } from "./load-scenarios.ts";
import { buildCampaignIndex } from "./normalize/campaigns.ts";

const index = campaignIndexSchema.parse(JSON.parse(readFileSync(path.join(DATA_DIR, "campaigns", "index.json"), "utf8")));

describe("data/campaigns/index.json", () => {
  it("lists the built campaign playable and the later campaigns locked, with the scenario counts Hall of Beorn lists", () => {
    expect(index.filter((entry) => entry.playable).map((entry) => entry.id)).toEqual(["fellowship-of-the-ring"]);
    expect(index.find((entry) => entry.id === "fellowship-of-the-ring")?.scenarioCount).toBe(loadCampaign().scenarios.length);
    // The campaigns built from the Revised Core Set and The Dark of Mirkwood are listed and stay locked until one of their
    // scenarios is in PLAYABLE_SCENARIOS; the two later sagas have no scenario files at all.
    const locked = index.filter((entry) => !entry.playable);
    expect(locked.map((entry) => entry.name)).toEqual(["Mirkwood Paths", "The Dark of Mirkwood", "The Two Towers", "The Return of the King"]);
    expect(locked.filter((entry) => ["The Two Towers", "The Return of the King"].includes(entry.name)).every((entry) => entry.scenarioCount === 6)).toBe(true);
  });

  it("lists the Mirkwood campaigns with their scenario counts", () => {
    expect(index.find((entry) => entry.id === "mirkwood-paths")).toMatchObject({ scenarioCount: 5, playable: false });
    expect(index.find((entry) => entry.id === "the-dark-of-mirkwood")).toMatchObject({ scenarioCount: 2, playable: false });
    expect(loadCampaign("mirkwood-paths").scenarios).toHaveLength(5);
    expect(loadCampaign("the-dark-of-mirkwood").scenarios).toHaveLength(2);
  });

  it("marks a campaign playable when at least one of its scenarios is", () => {
    const mirkwood = loadCampaign("mirkwood-paths");
    const scenarioIndex = [
      ...["Passage Through Mirkwood (Campaign)", "Journey Along the Anduin (Campaign)", "Escape from Dol Guldur (Campaign)"].map((Title, at) => ({ Title, Slug: Title, Product: "Revised Core Set", Number: at + 1 })),
      ...["The Oath (Campaign)", "The Caves of Nibin-Dûm (Campaign)"].map((Title, at) => ({ Title, Slug: Title, Product: "The Dark of Mirkwood", Number: at + 1 })),
    ];
    const none = buildCampaignIndex({ scenarioIndex }, { campaigns: [] }, mirkwood, []);
    expect(none[0]?.playable).toBe(false);
    const some = buildCampaignIndex({ scenarioIndex }, { campaigns: [] }, mirkwood, ["passage-through-mirkwood"]);
    expect(some[0]?.playable).toBe(true);
  });

  it("refuses a campaign whose built scenarios Hall of Beorn does not list", () => {
    const mirkwood = loadCampaign("mirkwood-paths");
    expect(() => buildCampaignIndex({ scenarioIndex: [] }, { campaigns: [] }, mirkwood)).toThrow("Hall of Beorn lists 0");
  });

  it("refuses an override whose packs Hall of Beorn lists no scenario for", () => {
    const campaign = loadCampaign();
    const entry = { id: "x", name: "X", products: ["No Such Pack"], reason: "r", source: "s" };
    const scenarioIndex = campaign.scenarios.map((id, at) => ({ Title: id, Slug: id, Product: "The Black Riders", Number: at + 1 }));
    expect(() => buildCampaignIndex({ scenarioIndex }, { campaigns: [entry] }, campaign)).toThrow("lists no scenario for");
  });
});
