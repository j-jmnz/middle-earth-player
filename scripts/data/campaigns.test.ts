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
    const locked = index.filter((entry) => !entry.playable);
    expect(locked.map((entry) => entry.name)).toEqual(["The Two Towers", "The Return of the King"]);
    expect(locked.every((entry) => entry.scenarioCount === 6)).toBe(true);
  });

  it("refuses an override whose packs Hall of Beorn lists no scenario for", () => {
    const campaign = loadCampaign();
    const entry = { id: "x", name: "X", products: ["No Such Pack"], reason: "r", source: "s" };
    const scenarioIndex = campaign.scenarios.map((id, at) => ({ Title: id, Slug: id, Product: "The Black Riders", Number: at + 1 }));
    expect(() => buildCampaignIndex({ scenarioIndex }, { campaigns: [entry] }, campaign)).toThrow("lists no scenario for");
  });
});
