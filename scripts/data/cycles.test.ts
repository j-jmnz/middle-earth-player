// Rules: mec109.campaign-mode (data/rules/entries.json). What every cycle (scripts/data/campaign-defs.ts, `kind: "cycle"`) has in common, whichever it is: no campaign card, prelude,
// booklet or starter deck, scenarios in play order and with a Nightmare deck each (but for the Standalone scenarios, which have none), a ledger file of its own, and a place in the campaign index as a cycle with no box. The pins of one
// cycle's cards are in its own test (shadows-of-mirkwood.test.ts, dwarrowdelf.test.ts).
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { CAMPAIGNS } from "./campaign-defs.ts";
import { authoredRel } from "./effects/authored-paths.ts";
import { seedFinderRel } from "./effects/seed-finder-paths.ts";
import { loadAnyScenario, loadCampaign } from "./load-scenarios.ts";
import { DATA_DIR } from "./paths.ts";
import { nightmareDeckOf } from "./nightmare-defs.ts";

// The cycles whose scenarios have no Nightmare block: the Standalone scenarios were printed on their own, with none (guide/roadmap.md, Roadmap); The Hobbit's decks (9055 to 9060), Against the Shadow's (9019 to 9027), The Ring-maker's, Haradrim's and Vengeance of Mordor's are in no scenario until their Nightmare decks are read.
const NO_NIGHTMARE: ReadonlySet<string> = new Set(["standalone-scenarios", "the-hobbit", "against-the-shadow", "the-ring-maker", "haradrim", "vengeance-of-mordor"]);
const cycles = CAMPAIGNS.filter((campaign) => campaign.kind === "cycle");
const index = JSON.parse(readFileSync(path.join(DATA_DIR, "campaigns", "index.json"), "utf8")) as { id: string; kind: string; scenarioCount: number; box: string | null }[];

describe.each(cycles.map((cycle) => [cycle.id, cycle] as const))("the %s cycle", (id, def) => {
  const cycle = loadCampaign(id);

  it("has no campaign card, prelude, booklet or starter deck, and lists its scenarios in the order of its definition", () => {
    expect(cycle.scenarios).toEqual(def.scenarios.map((scenario) => scenario.id));
    expect(cycle.kind).toBe("cycle");
    expect(cycle.saga).toBe(false);
    expect(cycle.bookletId).toBeUndefined();
    expect(cycle.bookletPages).toBeUndefined();
    expect(cycle.campaignCards).toEqual({});
    expect(cycle.prelude).toEqual([]);
    expect(cycle.starterDecks).toEqual([]);
    const raw = JSON.parse(readFileSync(path.join(DATA_DIR, "campaigns", `${id}.json`), "utf8")) as Record<string, unknown>;
    expect(Object.keys(raw)).not.toContain("campaignCards");
    expect(Object.keys(raw)).not.toContain("prelude");
  });

  it("is one row of the campaign index, a cycle with no box, and has a ledger file of its own", () => {
    expect(index.filter((entry) => entry.id === id)).toEqual([expect.objectContaining({ kind: "cycle", scenarioCount: cycle.scenarios.length, box: null })]);
    expect(existsSync(path.join(DATA_DIR, "printed", `${def.ledger ?? id}.json`))).toBe(true);
  });

  it("gives every scenario a Nightmare deck (but for the cycles that have none) and files its authored effects and seed finder in the folder of the cycle's id", () => {
    for (const scenario of cycle.scenarios) {
      if (NO_NIGHTMARE.has(id)) expect(loadAnyScenario(scenario).nightmare, scenario).toBeUndefined();
      else {
        expect(loadAnyScenario(scenario).nightmare, scenario).toBeDefined();
        expect(nightmareDeckOf(scenario), scenario).toBeDefined();
      }
      expect(authoredRel(scenario, id), scenario).toBe(`${id}/${scenario}`);
      expect(seedFinderRel(scenario, id), scenario).toBe(`${id}/${scenario}`);
    }
  });
});
