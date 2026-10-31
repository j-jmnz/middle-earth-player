import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { campaignIndexSchema } from "../../src/catalog/scenario-data.ts";
import { DATA_DIR } from "./paths.ts";
import { loadCampaign } from "./load-scenarios.ts";
import { buildCampaignIndex } from "./normalize/campaigns.ts";

const index = campaignIndexSchema.parse(JSON.parse(readFileSync(path.join(DATA_DIR, "campaigns", "index.json"), "utf8")));

describe("data/campaigns/index.json", () => {
  it("lists the built campaigns playable and the later campaigns locked, with the scenario counts Hall of Beorn lists", () => {
    expect(index.filter((entry) => entry.playable).map((entry) => entry.id)).toEqual(["fellowship-of-the-ring", "mirkwood-paths", "the-dark-of-mirkwood", "dream-chaser"]);
    expect(index.find((entry) => entry.id === "fellowship-of-the-ring")?.scenarioCount).toBe(loadCampaign().scenarios.length);
    // The campaigns built from the Revised Core Set and The Dark of Mirkwood are listed and stay locked until one of their
    // scenarios is in PLAYABLE_SCENARIOS (Mirkwood Paths since phase 29, The Dark of Mirkwood since phase 32: both hold The Oath; Dream-chaser since phase 40: Voyage Across Belegaer); the two later sagas
    // have no scenario files at all.
    const locked = index.filter((entry) => !entry.playable);
    expect(locked.map((entry) => entry.name)).toEqual(["The Two Towers", "The Return of the King"]);
    expect(locked.filter((entry) => ["The Two Towers", "The Return of the King"].includes(entry.name)).every((entry) => entry.scenarioCount === 6)).toBe(true);
  });

  it("lists the Mirkwood campaigns with their scenario counts", () => {
    expect(index.find((entry) => entry.id === "mirkwood-paths")).toMatchObject({ scenarioCount: 5, playable: true });
    expect(index.find((entry) => entry.id === "the-dark-of-mirkwood")).toMatchObject({ scenarioCount: 2, playable: true });
    expect(loadCampaign("mirkwood-paths").scenarios).toHaveLength(5);
    expect(loadCampaign("the-dark-of-mirkwood").scenarios).toHaveLength(2);
  });

  it("lists Dream-chaser with its nine scenarios, playable once one of them is in PLAYABLE_SCENARIOS (Voyage Across Belegaer, phase 40)", () => {
    expect(index.find((entry) => entry.id === "dream-chaser")).toMatchObject({ name: "Dream-chaser", scenarioCount: 9, playable: true });
    const campaign = loadCampaign("dream-chaser");
    expect(campaign.scenarios).toEqual([
      "voyage-across-belegaer",
      "the-fate-of-numenor",
      "raid-on-the-grey-havens",
      "flight-of-the-stormcaller",
      "the-thing-in-the-depths",
      "temple-of-the-deceived",
      "the-drowned-ruins",
      "a-storm-on-cobas-haven",
      "the-city-of-corsairs",
    ]);
    expect(campaign.saga).toBe(false);
    expect(campaign.bookletId).toBe("dream-chaser");
    expect(campaign.prelude).toEqual([]);
    expect(campaign.starterDecks).toEqual([]);
    expect(campaign.campaignCards).toEqual({
      "voyage-across-belegaer": "11171",
      "the-fate-of-numenor": "11179",
      "raid-on-the-grey-havens": "11182",
      "flight-of-the-stormcaller": "11191",
      "the-thing-in-the-depths": "11194",
      "temple-of-the-deceived": "11197",
      "the-drowned-ruins": "11200",
      "a-storm-on-cobas-haven": "11209",
      "the-city-of-corsairs": "11215",
    });
    // MEC111 is the campaign's booklet (data/rules/dcce.md); its setup paragraphs sit on these pages.
    expect(campaign.bookletPages).toEqual({
      "voyage-across-belegaer": 6,
      "the-fate-of-numenor": 7,
      "raid-on-the-grey-havens": 9,
      "flight-of-the-stormcaller": 12,
      "the-thing-in-the-depths": 14,
      "temple-of-the-deceived": 17,
      "the-drowned-ruins": 20,
      "a-storm-on-cobas-haven": 23,
      "the-city-of-corsairs": 24,
    });
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
