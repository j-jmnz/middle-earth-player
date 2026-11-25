// Rules: ats.setup-peril-in-pelargir, ats.setup-into-ithilien, ats.setup-the-siege-of-cair-andros, ats.setup-the-stewards-fear, ats.setup-the-druadan-forest, ats.setup-encounter-at-amon-din,
// ats.setup-assault-on-osgiliath, ats.setup-the-blood-of-gondor, ats.setup-the-morgul-vale, ats.setup-the-stewards-fear-underworld-deck (data/rules/entries.json).
// The Against the Shadow cycle built from the Heirs of Númenor expansion and its six Adventure Packs: its nine scenario files, their piles and counts for Normal and Easy, the pile
// decisions that depart from the DragnCards load lists, and the rules spans of the inserts. The shape every cycle shares (no campaign card, prelude or booklet) is held in cycles.test.ts.
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { encounterCodes } from "../../src/catalog/scenario-data.ts";

import { scenarioSlug } from "./campaign-defs.ts";
import { CYCLE_DEFS } from "./cycle-defs.ts";
import { loadCards } from "./load-cards.ts";
import { loadAnyScenario, loadCampaign, loadScenarioDefinitions } from "./load-scenarios.ts";
import { DATA_DIR } from "./paths.ts";

const byCode = new Map(loadCards().map((card) => [card.code, card]));
const cycle = loadCampaign("against-the-shadow");
const entries = JSON.parse(readFileSync(path.join(DATA_DIR, "rules", "entries.json"), "utf8")) as { id: string; text: string }[];
const rules = new Map(entries.map((entry) => [entry.id, entry.text.replaceAll("’", "'").replace(/\s+/g, " ")]));
const def = CYCLE_DEFS.find((campaign) => campaign.id === "against-the-shadow");

// The Normal and Easy encounter decks (the encounter cards that are not set aside or staged), the encounter sets in rulesheet order, the stages, and the cards each scenario stages or sets aside.
const DECK = {
  "peril-in-pelargir": { title: "Peril in Pelargir", normal: 32, easy: 27, sets: ["Peril in Pelargir", "Streets of Gondor", "Brigands"], staging: [], setAside: [], stages: 3 },
  "into-ithilien": { title: "Into Ithilien", normal: 31, easy: 18, sets: ["Into Ithilien", "Brooding Forest", "Creatures of the Forest", "Southrons"], staging: ["05025", "05027"], setAside: [], stages: 4 },
  "the-siege-of-cair-andros": { title: "The Siege of Cair Andros", normal: 37, easy: 22, sets: ["The Siege of Cair Andros", "Southrons", "Mordor Elite", "Ravaging Orcs"], staging: ["05033", "05034", "05035"], setAside: [], stages: 5 },
  "the-stewards-fear": { title: "The Steward's Fear", normal: 29, easy: 24, sets: ["The Steward's Fear", "Streets of Gondor", "Brigands"], staging: [], setAside: ["05037", "05042", "05043", "05044", "06015", "06016", "06017", "06019", "06026", "06027", "06028", "06029", "06030", "06031"], stages: 3 },
  "the-druadan-forest": { title: "The Drúadan Forest", normal: 36, easy: 25, sets: ["The Drúadan Forest", "Brooding Forest"], staging: [], setAside: ["06045"], stages: 3 },
  "encounter-at-amon-din": { title: "Encounter at Amon Dîn", normal: 33, easy: 26, sets: ["Encounter at Amon Dîn", "Ravaging Orcs"], staging: ["06068", "06069"], setAside: ["06070", "06071"], stages: 2 },
  "assault-on-osgiliath": { title: "Assault on Osgiliath", normal: 50, easy: 34, sets: ["Assault on Osgiliath", "Mordor Elite", "Southrons"], staging: [], setAside: [], stages: 1 },
  "the-blood-of-gondor": { title: "The Blood of Gondor", normal: 34, easy: 25, sets: ["The Blood of Gondor", "Ravaging Orcs"], staging: ["06119", "06123"], setAside: ["06132", "06133"], stages: 2 },
  "the-morgul-vale": { title: "The Morgul Vale", normal: 42, easy: 29, sets: ["The Morgul Vale", "Mordor Elite", "Creatures of the Forest"], staging: ["06147", "06151", "06155"], setAside: ["06152", "06153", "06156"], stages: 3 },
} as const;

describe("The Against the Shadow cycle", () => {
  it("is the nine scenarios of the Heirs of Númenor expansion and its six Adventure Packs, in release order, with no Campaign Mode", () => {
    expect(cycle.scenarios).toEqual(Object.keys(DECK));
    expect(cycle.kind).toBe("cycle");
    expect(cycle.campaignCards).toEqual({});
  });

  it("builds each scenario file from its Hall of Beorn title and the DragnCards decks Q03.n and E03.n", () => {
    for (const [at, [id, pin]] of Object.entries(DECK).entries()) {
      expect(scenarioSlug(pin.title), id).toBe(id);
      const scenario = loadAnyScenario(id);
      expect(scenario.name, id).toBe(pin.title);
      expect(scenario.campaignCard, id).toBeUndefined();
      expect(scenario.source.dragnNormal, id).toBe(`Q03.${at + 1}`);
      expect(scenario.source.dragnEasy, id).toBe(`E03.${at + 1}`);
    }
    expect(() => loadScenarioDefinitions(new URL("../../data/", import.meta.url).pathname, byCode, [], "against-the-shadow")).not.toThrow();
  });

  it.each(Object.entries(DECK))("%s deals the encounter deck, the encounter sets, the quest stages and the Setup piles the load list and the printed Setup leave", (id, pin) => {
    const scenario = loadAnyScenario(id);
    expect(encounterCodes(scenario)).toHaveLength(pin.normal);
    expect(encounterCodes(scenario, "Easy")).toHaveLength(pin.easy);
    expect(scenario.encounterSets.map((set) => set.name)).toEqual([...pin.sets]);
    expect(scenario.stages).toHaveLength(pin.stages);
    expect([...new Set(scenario.cards.filter((card) => card.pile === "staging").map((card) => card.code))].sort()).toEqual([...pin.staging]);
    expect([...new Set(scenario.cards.filter((card) => card.pile === "setAside").map((card) => card.code))].sort()).toEqual([...pin.setAside]);
  });

  it("reads the encounter sets of every scenario from its rulesheet, and names that span as its Setup span", () => {
    for (const [id, pin] of Object.entries(DECK)) {
      const span = `ats.setup-${id}`;
      expect(def?.scenarios.find((scenario) => scenario.id === id)?.setupSpan, id).toBe(span);
      const text = rules.get(span) ?? "";
      expect(text, id).toContain("encounter deck");
      for (const set of pin.sets) expect(text, `${id} ${set}`).toContain(set);
    }
  });

  it("attaches Alcaron's Scroll at Setup, and leaves the five Harbor Thug in the encounter deck (the Leaping Fish prints no Setup line that stages one)", () => {
    const pelargir = loadAnyScenario("peril-in-pelargir");
    expect(pelargir.cards.find((card) => card.code === "05019")).toMatchObject({ pile: "attachedChosen", normal: 1, easy: 1 });
    expect(pelargir.cards.find((card) => card.code === "05020")).toMatchObject({ pile: "encounter", normal: 5, easy: 5 });
    expect(pelargir.cards.find((card) => card.code === "05021")).toMatchObject({ pile: "activeLocation" });
  });

  it("stages the four Southron Company of Into Ithilien in both modes, one for each of up to four players", () => {
    const southron = loadAnyScenario("into-ithilien").cards.filter((card) => card.code === "05027");
    expect(southron).toHaveLength(1);
    expect(southron[0]).toMatchObject({ pile: "staging", normal: 4, easy: 4 });
  });

  it("puts The Fourth Star in the encounter deck of The Steward's Fear, and builds the Underworld deck from the set-aside enemies and Clue objectives", () => {
    const fear = loadAnyScenario("the-stewards-fear");
    expect(fear.cards.find((card) => card.code === "06022")).toMatchObject({ pile: "encounter" });
    expect(fear.cards.filter((card) => card.pile === "setAside").map((card) => byCode.get(card.code)?.type)).toContain("enemy");
    expect(rules.get("ats.setup-the-stewards-fear-underworld-deck")).toContain("shuffle them into a separate deck");
  });

  it("names the rules the cycle owns, Battle, Siege and Archery in the Heirs of Númenor insert and the keywords of the Adventure Packs", () => {
    expect(rules.get("hon.battle")).toBeDefined();
    expect(rules.get("hon.siege")).toBeDefined();
    expect(rules.get("hon.archery")).toBeDefined();
    for (const id of ["ats.underworld", "ats.prowl", "ats.villagers", "ats.controlling-locations", "ats.hidden-cards", "ats.captain-enemies", "ats.ally-objectives"]) expect(rules.get(id), id).toBeTruthy();
  });
});
