import { describe, expect, it } from "vitest";

import { loadCards } from "../../scripts/data/load-cards.ts";
import { loadAnyScenario, loadCampaigns } from "../../scripts/data/load-scenarios.ts";
import { cardSchema } from "./card-facts.ts";
import { isFanMade, originOf } from "./origin.ts";
import { scenarioDataSchema } from "./scenario-data.ts";

describe("origin of a card or a scenario", () => {
  it("is official when the facts carry none, for every card and scenario in data/", () => {
    expect(loadCards().filter((card) => isFanMade(card))).toEqual([]);
    const ids = loadCampaigns().flatMap((campaign) => campaign.scenarios);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) expect(originOf(loadAnyScenario(id)), id).toEqual({ kind: "official" });
  });

  it("reaches a screen through the scenario facts: a fan-made scenario names its publisher", () => {
    const base = loadAnyScenario(loadCampaigns()[0]?.scenarios[0] as string);
    const made = scenarioDataSchema.parse({ ...base, origin: { publisher: "A Long-extended Party" } });
    expect(originOf(made)).toEqual({ kind: "fan-made", publisher: "A Long-extended Party" });
    expect(isFanMade(made)).toBe(true);
  });

  it("names the version of the set on a fan-made card, and refuses an origin with no publisher", () => {
    const card = loadCards()[0] as NonNullable<ReturnType<typeof loadCards>[number]>;
    const made = cardSchema.parse({ ...card, origin: { publisher: "A Long-extended Party", version: "1.2" } });
    expect(originOf(made)).toEqual({ kind: "fan-made", publisher: "A Long-extended Party", version: "1.2" });
    expect(() => cardSchema.parse({ ...card, origin: { version: "1.2" } })).toThrow();
  });
});
