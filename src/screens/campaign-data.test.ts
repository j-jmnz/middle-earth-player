import { describe, expect, it, vi } from "vitest";

import entries from "../../data/rules/entries.json";
import { bookletPageOf, bookletParams, campaignOf, scenarioNames, scenarioOf } from "./campaign-data";
import { dealSeed } from "./e2e";

describe("campaign data on the phone", () => {
  it("lists the six scenarios of the Fellowship in book order, each readable", () => {
    const campaign = campaignOf("fellowship-of-the-ring");
    if (!campaign) throw new Error("The Fellowship campaign is not registered");
    expect(campaign.scenarios).toEqual([
      "a-shadow-of-the-past",
      "a-knife-in-the-dark",
      "flight-to-the-ford",
      "the-ring-goes-south",
      "journey-in-the-dark",
      "breaking-of-the-fellowship",
    ]);
    for (const id of campaign.scenarios) expect(scenarioOf(id)?.id).toBe(id);
    expect(scenarioNames(campaign)["a-knife-in-the-dark"]).toBe("A Knife in the Dark");
    expect(campaignOf("another-campaign")).toBeNull();
  });
});

describe("booklet pages", () => {
  it("records the page of each scenario's setup span in the MEC109 booklet, and nothing else", () => {
    const campaign = campaignOf("fellowship-of-the-ring");
    if (!campaign) throw new Error("The Fellowship campaign is not registered");
    for (const id of campaign.scenarios) {
      const span = entries.find((entry) => entry.id === `mec109.setup-${id}`);
      expect(span, id).toBeDefined();
      expect(bookletPageOf("fellowship-of-the-ring", id), id).toBe(span?.page);
      expect(bookletParams("fellowship-of-the-ring", id)).toEqual({ id: "fellowship-of-the-ring", page: String(span?.page) });
    }
    expect(Object.keys(campaign.bookletPages ?? {}).sort()).toEqual([...campaign.scenarios].sort());
  });

  it("passes no page when the scenario has none", () => {
    expect(bookletPageOf("fellowship-of-the-ring", "not-a-scenario")).toBeNull();
    expect(bookletParams("fellowship-of-the-ring", null)).toEqual({ id: "fellowship-of-the-ring" });
  });
});

describe("dealSeed", () => {
  it("deals a random positive seed in a production build", () => {
    vi.stubEnv("EXPO_PUBLIC_E2E_SEED", "");
    const seed = dealSeed(() => 0.5);
    expect(Number.isInteger(seed)).toBe(true);
    expect(seed).toBeGreaterThan(0);
    expect(dealSeed(() => 0.25)).not.toBe(dealSeed(() => 0.75));
    vi.unstubAllEnvs();
  });

  it("deals the fixed seed of the e2e build", () => {
    vi.stubEnv("EXPO_PUBLIC_E2E_SEED", "1");
    expect(dealSeed(() => 0.9)).toBe(1);
    vi.unstubAllEnvs();
  });
});
