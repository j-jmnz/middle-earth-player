import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { campaignIndexSchema } from "../../src/catalog/scenario-data.ts";
import { DATA_DIR } from "./paths.ts";
import { loadCampaign } from "./load-scenarios.ts";
import { CAMPAIGNS, scenarioProductOf } from "./campaign-defs.ts";
import { buildCampaignIndex } from "./normalize/campaigns.ts";
import { parseOverrides } from "./normalize/overrides.ts";
import { hobScenarioIndexSchema } from "./sources/hallofbeorn.ts";

const overrides = parseOverrides(JSON.parse(readFileSync(path.join(DATA_DIR, "overrides.json"), "utf8")));
const index = campaignIndexSchema.parse(JSON.parse(readFileSync(path.join(DATA_DIR, "campaigns", "index.json"), "utf8")));

describe("data/campaigns/index.json", () => {
  it("lists the built campaigns playable and the later campaigns and cycles locked, with the scenario counts Hall of Beorn lists", () => {
    expect(index.filter((entry) => entry.playable).map((entry) => entry.id)).toEqual(["fellowship-of-the-ring", "mirkwood-paths", "the-dark-of-mirkwood", "dream-chaser", "ered-mithrin", "angmar-awakened", "the-two-towers", "the-return-of-the-king", "shadows-of-mirkwood", "dwarrowdelf", "the-hobbit", "standalone-scenarios"]);
    expect(index.find((entry) => entry.id === "fellowship-of-the-ring")?.scenarioCount).toBe(loadCampaign().scenarios.length);
    // A campaign is playable once one of its scenarios is in PLAYABLE_SCENARIOS. The Return of the King is built (scripts/data/return-of-the-king.test.ts) and playable from its first scenario, its box named by no override. Angmar Awakened is built (scripts/data/angmar-awakened.test.ts) and playable from its first scenario. The other locked entries have no scenario files: the
    // campaigns played in Campaign Mode, under their RCO boxes, then the cycles: scenarios that are part of no campaign (data/overrides.json, campaigns).
    const locked = index.filter((entry) => !entry.playable).map((entry) => [entry.name, entry.kind, entry.scenarioCount]);
    // The Standalone scenarios cycle is built one scenario at a time and playable from its first (The Massing at Osgiliath): its count is the scenarios built.
    expect(locked).toEqual([
      ["Against the Shadow", "cycle", 9],
      ["The Ring-maker", "cycle", 9],
      ["Haradrim", "cycle", 9],
      ["Vengeance of Mordor", "cycle", 9],
    ]);
    // The Shadows of Mirkwood cycle is playable from its first scenario (The Hunt for Gollum), Dwarrowdelf from its first (Into the Pit) and The Hobbit from its first built scenario (The Lonely Mountain) and the Standalone scenarios cycle from The Massing at Osgiliath; the other cycles are locked.
    expect(index.filter((entry) => entry.playable && entry.kind !== "campaign").map((entry) => entry.id)).toEqual(["shadows-of-mirkwood", "dwarrowdelf", "the-hobbit", "standalone-scenarios"]);
    expect(index.filter((entry) => entry.kind === "cycle").every((entry) => entry.box === null)).toBe(true);
    // Every campaign is built, so none is locked.
    expect(index.filter((entry) => !entry.playable && entry.kind === "campaign")).toEqual([]);
  });

  it("orders every campaign and cycle by release, the Lord of the Rings saga boxes together at the Fellowship's release", () => {
    const byPosition = [...index].sort((left, right) => left.position - right.position).map((entry) => `${entry.released} ${entry.id}`);
    expect(index.map((entry) => entry.position).sort((a, b) => a - b)).toEqual(index.map((_, at) => at + 1));
    expect(byPosition).toEqual([
      "2011-07-22 shadows-of-mirkwood",
      "2011-09-21 standalone-scenarios",
      "2012-01-06 dwarrowdelf",
      "2012-08-17 the-hobbit",
      "2012-11-26 against-the-shadow",
      "2014-02-21 the-ring-maker",
      "2016-11-23 haradrim",
      "2019-08-02 vengeance-of-mordor",
      "2022-01-28 mirkwood-paths",
      "2022-02-25 the-dark-of-mirkwood",
      "2022-08-19 angmar-awakened",
      "2022-10-14 fellowship-of-the-ring",
      "2023-10-06 the-two-towers",
      "2024-10-10 the-return-of-the-king",
      "2023-07-07 dream-chaser",
      "2024-06-28 ered-mithrin",
    ]);
  });

  it("accounts for every official product Hall of Beorn lists: built, coming later, or a reprint the app plays from its revised box", () => {
    const index = hobScenarioIndexSchema.parse(JSON.parse(readFileSync(path.join(DATA_DIR, "raw", "hallofbeorn", "Scenarios.json"), "utf8")));
    const products = new Set(index.map((entry) => entry.Product));
    const titles = new Set(index.map((entry) => entry.Title));
    const listed = new Set([...CAMPAIGNS.flatMap((campaign) => campaign.products.map(scenarioProductOf)), ...overrides.campaigns.flatMap((campaign) => campaign.products)]);
    // The 2011 Core Set and the Two-Player Limited Edition Starter print the scenarios the Revised Core Set and The Dark of Mirkwood reprint.
    const reprinted = ["Core Set", "Two-Player Limited Edition Starter"];
    // Fan-made: A Long-extended Party's packs (RingsDB names them "ALeP - ..."), then First Age with its Doom Mastered cycle and
    // Legacy of Fëanor, which RingsDB lists no pack for. The roadmap takes them after the official content (README.md, Roadmap).
    const fanMade = [
      "Children of Eorl", "The Aldburg Plot", "Fire on the Eastemnet", "The Gap of Rohan", "The Glittering Caves", "Mustering of the Rohirrim", "Blood in the Isen",
      "The Scouring of the Shire", "The Nine are Abroad", "The Siege of Erebor", "The Shire's Reckoning", "The Hobbit", "Strange News in Bree", "Fangs in the Dark",
      "First Age", "Trial Upon the Marches", "Among the Outlaws", "The Betrayal of Mîm", "The Fall of Nargothrond", "Skirmish in the Shire", "Down the Baranduin", "Dwarf Lord Battle",
    ];
    // The Standalone scenarios cycle is built one scenario at a time: the products of the ones not built yet are its `later` (scripts/data/campaign-defs.ts), moved to its products as each is built.
    const standaloneToBuild = CAMPAIGNS.flatMap((campaign) => ("later" in campaign ? (campaign.later ?? []) : []));
    const unaccounted = [...products].filter((product) => !listed.has(product) && !reprinted.includes(product) && !fanMade.includes(product) && !standaloneToBuild.includes(product));
    expect(unaccounted).toEqual([]);
    // Each name above is a product Hall of Beorn lists, so a rename upstream fails here rather than hiding a product.
    expect([...reprinted, ...fanMade, ...standaloneToBuild].filter((product) => !products.has(product) && !titles.has(product))).toEqual([]);
    expect([...reprinted, ...fanMade, ...standaloneToBuild].filter((product) => listed.has(product))).toEqual([]);
  });

  it("lists The Two Towers, built from six scenario files, as a playable campaign of six scenarios after Ered Mithrin", () => {
    expect(index.map((entry) => entry.id).slice(0, 8)).toEqual(["fellowship-of-the-ring", "mirkwood-paths", "the-dark-of-mirkwood", "dream-chaser", "ered-mithrin", "angmar-awakened", "the-two-towers", "the-return-of-the-king"]);
    expect(index.find((entry) => entry.id === "the-two-towers")).toMatchObject({ name: "The Two Towers", scenarioCount: 6, playable: true });
    expect(loadCampaign("the-two-towers").scenarios).toHaveLength(6);
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
    const entry = { id: "x", name: "X", kind: "cycle" as const, released: "2011-01-01", products: ["Some Pack", "No Such Pack"], reason: "r", source: "s" };
    const scenarioIndex = [
      ...campaign.scenarios.map((id, at) => ({ Title: id, Slug: id, Product: at < 3 ? "The Black Riders" : "The Road Darkens", Number: at + 1 })),
      { Title: "Some Scenario", Slug: "Some-Scenario", Product: "Some Pack", Number: 1 },
    ];
    expect(() => buildCampaignIndex({ scenarioIndex }, { campaigns: [entry] }, campaign)).toThrow("lists no scenario for: No Such Pack");
  });

  it("refuses an override that names a product another entry already counts, and keeps the override's kind", () => {
    const campaign = loadCampaign();
    const scenarioIndex = [
      ...campaign.scenarios.map((id, at) => ({ Title: id, Slug: id, Product: at < 3 ? "The Black Riders" : "The Road Darkens", Number: at + 1 })),
      { Title: "Some Scenario", Slug: "Some-Scenario", Product: "Some Pack", Number: 1 },
    ];
    const box = { id: "x", name: "X", kind: "cycle" as const, released: "2011-01-01", products: ["Some Pack"], reason: "r", source: "s" };
    expect(buildCampaignIndex({ scenarioIndex }, { campaigns: [box] }, campaign).at(-1)).toEqual({ id: "x", name: "X", scenarioCount: 1, playable: false, kind: "cycle", box: null, released: "2011-01-01", position: 1 });
    expect(buildCampaignIndex({ scenarioIndex }, { campaigns: [{ ...box, kind: "campaign", box: "X Saga Expansion" }] }, campaign).at(-1)).toMatchObject({ kind: "campaign", box: "X Saga Expansion" });
    expect(() => buildCampaignIndex({ scenarioIndex }, { campaigns: [{ ...box, kind: "campaign" }] }, campaign)).toThrow("a campaign names its box");
    expect(() => buildCampaignIndex({ scenarioIndex }, { campaigns: [{ ...box, products: ["The Black Riders"] }] }, campaign)).toThrow("x and fellowship-of-the-ring both name the product The Black Riders");
    expect(() => buildCampaignIndex({ scenarioIndex }, { campaigns: [box, { ...box, id: "y" }] }, campaign)).toThrow("y and x both name the product Some Pack");
  });

  it("lists Ered Mithrin with its nine scenarios, playable once one of them is in PLAYABLE_SCENARIOS (Journey Up the Anduin, phase 52)", () => {
    expect(index.find((entry) => entry.id === "ered-mithrin")).toMatchObject({ name: "Ered Mithrin", scenarioCount: 9, playable: true });
    const campaign = loadCampaign("ered-mithrin");
    expect(campaign.scenarios).toEqual([
      "journey-up-the-anduin",
      "lost-in-mirkwood",
      "the-kings-quest",
      "the-withered-heath",
      "roam-across-rhovanion",
      "fire-in-the-night",
      "the-ghost-of-framsburg",
      "mount-gundabad",
      "the-fate-of-wilderland",
    ]);
    expect(campaign.saga).toBe(false);
    expect(campaign.bookletId).toBe("ered-mithrin");
    expect(campaign.prelude).toEqual([]);
    expect(campaign.starterDecks).toEqual([]);
    // The booklet (MEC115) opens on the page each scenario's setup is printed on (emce.setup-<id>).
    expect(campaign.bookletPages).toEqual({ "journey-up-the-anduin": 5, "lost-in-mirkwood": 6, "the-kings-quest": 8, "the-withered-heath": 10, "roam-across-rhovanion": 13, "fire-in-the-night": 14, "the-ghost-of-framsburg": 16, "mount-gundabad": 20, "the-fate-of-wilderland": 22 });
    expect(campaign.campaignCards).toEqual({
      "journey-up-the-anduin": "120165",
      "lost-in-mirkwood": "12168",
      "the-kings-quest": "12170",
      "the-withered-heath": "12175",
      "roam-across-rhovanion": "12184",
      "fire-in-the-night": "12187",
      "the-ghost-of-framsburg": "12189",
      "mount-gundabad": "12193",
      "the-fate-of-wilderland": "12195",
    });
  });
});
