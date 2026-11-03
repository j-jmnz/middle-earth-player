import { describe, expect, it, vi } from "vitest";

import { readdirSync } from "node:fs";

import index from "../../../data/campaigns/index.json";
import entries from "../../../data/rules/entries.json";
import { BOXES, bookletPageOf, bookletParams, boxOf, campaignIds, campaignOf, campaignOfScenario, scenarioName, scenarioNames, scenarioOf } from "./campaign-data";
import { dealSeed } from "../nav/e2e";

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

describe("the registry", () => {
  it("holds every playable campaign data/campaigns/index.json lists, and nothing else that is built", () => {
    const built = readdirSync("data/campaigns").filter((name) => name !== "index.json").map((name) => name.replace(/\.json$/, "")).sort();
    expect([...campaignIds()].sort()).toEqual(built);
    for (const entry of index) {
      const campaign = campaignOf(entry.id);
      if (built.includes(entry.id)) {
        expect(campaign?.name, entry.id).toBe(entry.name);
        expect(campaign?.scenarios.length, entry.id).toBe(entry.scenarioCount);
      } else expect(campaign, entry.id).toBeNull(); // The Two Towers and The Return of the King are listed locked and not built.
    }
  });

  it("holds every scenario file, and each campaign's scenarios are all in it", () => {
    const files = readdirSync("data/scenarios").map((name) => name.replace(/\.json$/, "")).sort();
    for (const id of files) expect(scenarioOf(id)?.id, id).toBe(id);
    for (const id of campaignIds()) for (const scenario of campaignOf(id)?.scenarios ?? []) expect(files, `${id}: ${scenario}`).toContain(scenario);
  });

  it("answers campaignOf and scenarioNames for any id", () => {
    for (const id of campaignIds()) {
      const campaign = campaignOf(id);
      if (!campaign) throw new Error(`${id} is not registered`);
      expect(Object.keys(scenarioNames(campaign)).sort()).toEqual([...campaign.scenarios].sort());
      for (const scenario of campaign.scenarios) expect(scenarioNames(campaign)[scenario]).not.toBe(scenario);
    }
  });

  it("splits the scenarios into four boxes, each scenario in one, each box inside its own campaign", () => {
    expect(BOXES.map((box) => box.name)).toEqual(["Fellowship of the Ring", "Revised Core Set", "The Dark of Mirkwood", "Dream-chaser"]);
    const listed = BOXES.flatMap((box) => box.scenarios);
    expect(new Set(listed).size).toBe(listed.length);
    const every = new Set(campaignIds().flatMap((id) => campaignOf(id)?.scenarios ?? []));
    expect([...listed].sort()).toEqual([...every].sort());
    for (const box of BOXES) {
      const campaign = campaignOf(box.campaignId);
      for (const scenario of box.scenarios) expect(campaign?.scenarios, `${box.id}: ${scenario}`).toContain(scenario);
    }
    expect(boxOf("the-oath")?.id).toBe("the-dark-of-mirkwood");
    expect(boxOf("journey-along-the-anduin")?.id).toBe("revised-core");
    // One box holds all nine Dream-chaser scenarios, in play order (user decision, 2026-10-30).
    expect(BOXES.find((box) => box.id === "dream-chaser")?.scenarios).toEqual(campaignOf("dream-chaser")?.scenarios);
    expect(boxOf("a-storm-on-cobas-haven")?.id).toBe("dream-chaser");
    expect(boxOf("nowhere")).toBeNull();
  });

  it("takes a standalone game's flags from its box: saga only for the Fellowship", () => {
    expect(campaignOfScenario("a-knife-in-the-dark")?.saga).toBe(true);
    expect(campaignOfScenario("the-drowned-ruins")?.saga).toBe(false);
    expect(campaignOfScenario("passage-through-mirkwood")?.saga).toBe(false);
    expect(campaignOfScenario("the-caves-of-nibin-dum")?.saga).toBe(false);
    expect(campaignOfScenario("nowhere")).toBeNull();
  });

  it("opens each campaign's own booklet, on the scenario's page", () => {
    expect(bookletParams("mirkwood-paths", "passage-through-mirkwood")).toEqual({ id: "learn-to-play", page: "25" });
    expect(bookletParams("the-dark-of-mirkwood", "the-oath")).toEqual({ id: "the-dark-of-mirkwood", page: "3" });
    expect(bookletParams("the-dark-of-mirkwood")).toEqual({ id: "the-dark-of-mirkwood" });
  });

  it("registers Dream-chaser: nine scenarios in order, the XP flag, its own booklet on each scenario's page, no saga", () => {
    const campaign = campaignOf("dream-chaser");
    expect(campaignIds()).toContain("dream-chaser");
    expect(campaign).toMatchObject({ name: "Dream-chaser", saga: false, xp: true, bookletId: "dream-chaser", prelude: [] });
    expect(campaign?.scenarios).toHaveLength(9);
    for (const id of campaign?.scenarios ?? []) expect(scenarioOf(id)?.id).toBe(id);
    expect(scenarioNames(campaign!)["voyage-across-belegaer"]).toBe("Voyage Across Belegaer");
    expect(campaignOf("fellowship-of-the-ring")?.xp).toBeUndefined();
    expect(campaignOf("mirkwood-paths")?.xp).toBeUndefined();
    expect(bookletParams("dream-chaser", "voyage-across-belegaer")).toEqual({ id: "dream-chaser", page: "6" });
    expect(bookletParams("dream-chaser", "the-city-of-corsairs")).toEqual({ id: "dream-chaser", page: "24" });
    expect(bookletParams("dream-chaser")).toEqual({ id: "dream-chaser" });
  });

  it("names a scenario as printed, without Hall of Beorn's \" (Campaign)\" suffix", () => {
    expect(scenarioNames(campaignOf("mirkwood-paths")!)["passage-through-mirkwood"]).toBe("Passage Through Mirkwood");
    expect(scenarioNames(campaignOf("the-dark-of-mirkwood")!)["the-oath"]).toBe("The Oath");
    expect(scenarioName("the-caves-of-nibin-dum")).not.toContain("(Campaign)");
  });

  it("a scenario the campaign's book does not print opens the book of its box (the Oath and the Caves in Mirkwood Paths)", () => {
    expect(bookletPageOf("mirkwood-paths", "the-oath")).toBeNull();
    expect(bookletParams("mirkwood-paths", "the-oath")).toEqual({ id: "the-dark-of-mirkwood", page: String(bookletPageOf("the-dark-of-mirkwood", "the-oath")) });
    expect(bookletParams("mirkwood-paths", "the-caves-of-nibin-dum").id).toBe("the-dark-of-mirkwood");
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
});

describe("the lazy registry", () => {
  it("parses a campaign or a scenario when first asked for and keeps it", () => {
    expect(campaignOf("fellowship-of-the-ring")).toBe(campaignOf("fellowship-of-the-ring"));
    expect(scenarioOf("a-shadow-of-the-past")).toBe(scenarioOf("a-shadow-of-the-past"));
    expect(campaignOf("fellowship-of-the-ring")?.starterDecks.length).toBeGreaterThan(0);
  });

  it("knows only its own ids, not the properties every object has", () => {
    expect(campaignOf("nope")).toBeNull();
    expect(scenarioOf("constructor")).toBeNull();
    expect(campaignOf("__proto__")).toBeNull();
  });
});
