import { describe, expect, it, vi } from "vitest";

import { campaignOf, scenarioNames, scenarioOf } from "./campaign-data";
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
