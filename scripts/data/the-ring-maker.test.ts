// Rules: rm.setup-the-fords-of-isen, rm.setup-to-catch-an-orc, rm.setup-into-fangorn, rm.setup-the-dunland-trap, rm.setup-the-three-trials, rm.setup-trouble-in-tharbad,
// rm.setup-the-nin-in-eilph, rm.setup-celebrimbors-secret, rm.setup-the-antlered-crown, rm.time-x, rm.scour, rm.raven-deck (data/rules/entries.json).
// The Ring-maker cycle built from The Voice of Isengard expansion and its six Adventure Packs: its nine scenario files, their piles and counts for Normal and Easy, the pile decisions that
// depart from the DragnCards load lists, and the rules spans of the insert and the rulesheets. The shape every cycle shares (no campaign card, prelude or booklet) is held in cycles.test.ts.
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
const cycle = loadCampaign("the-ring-maker");
const entries = JSON.parse(readFileSync(path.join(DATA_DIR, "rules", "entries.json"), "utf8")) as { id: string; text: string }[];
const rules = new Map(entries.map((entry) => [entry.id, entry.text.replaceAll("’", "'").replace(/\s+/g, " ")]));
const def = CYCLE_DEFS.find((campaign) => campaign.id === "the-ring-maker");

// The Normal and Easy encounter decks (the encounter cards that are not set aside or staged), the encounter sets in rulesheet order, the stages, and the cards each scenario stages or sets aside.
const DECK = {
  "the-fords-of-isen": { title: "The Fords of Isen", deck: "Q04.1", normal: 32, easy: 22, sets: ["The Fords of Isen", "Dunland Raiders", "Dunland Warriors"], staging: ["07017"], setAside: ["07016"], stages: 3 },
  "to-catch-an-orc": { title: "To Catch an Orc", deck: "Q04.2", normal: 33, easy: 27, sets: ["To Catch an Orc", "Misty Mountain Orcs", "Broken Lands"], staging: [], setAside: ["07024", "07025"], stages: 3 },
  "into-fangorn": { title: "Into Fangorn", deck: "Q04.3", normal: 33, easy: 23, sets: ["Into Fangorn", "Ancient Forest", "Weary Travelers"], staging: ["07032"], setAside: ["07031"], stages: 3 },
  "the-dunland-trap": { title: "The Dunland Trap", deck: "Q04.4", normal: 42, easy: 31, sets: ["The Dunland Trap", "Dunland Warriors", "Weary Travelers"], staging: [], setAside: ["08014", "08015"], stages: 3 },
  "the-three-trials": { title: "The Three Trials", deck: "Q04.5", normal: 26, easy: 18, sets: ["The Three Trials", "Ancient Forest"], staging: [], setAside: ["08040", "08041", "08042", "08043", "08044", "08045", "08046", "08047", "08048", "08049"], stages: 5 },
  "trouble-in-tharbad": { title: "Trouble in Tharbad", deck: "Q04.6", normal: 32, easy: 24, sets: ["Trouble in Tharbad", "Misty Mountain Orcs"], staging: ["08072"], setAside: ["08068", "08070", "08071"], stages: 2 },
  "the-nin-in-eilph": { title: "The Nîn-in-Eilph", deck: "Q04.7", normal: 29, easy: 23, sets: ["The Nîn-in-Eilph", "Weary Travelers"], staging: ["08106", "08107", "08108", "08109"], setAside: ["08102", "08103"], stages: 8 },
  "celebrimbors-secret": { title: "Celebrimbor's Secret", deck: "Q04.8", normal: 45, easy: 35, sets: ["Celebrimbor's Secret", "Misty Mountain Orcs", "Broken Lands"], staging: ["08124", "08125", "08126", "08130", "08131", "08132", "08133"], setAside: ["08127"], stages: 2 },
  "the-antlered-crown": { title: "The Antlered Crown", deck: "Q04.9", normal: 28, easy: 20, sets: ["The Antlered Crown", "Dunland Warriors", "Dunland Raiders"], staging: ["08155"], setAside: ["07042", "07043", "07044", "07046", "07047", "07048", "08150", "08151", "08152"], stages: 3 },
} as const;

const SETUP_SPANS = {
  "the-fords-of-isen": "rm.setup-the-fords-of-isen",
  "to-catch-an-orc": "rm.setup-to-catch-an-orc",
  "into-fangorn": "rm.setup-into-fangorn",
  "the-dunland-trap": "rm.setup-the-dunland-trap",
  "the-three-trials": "rm.setup-the-three-trials",
  "trouble-in-tharbad": "rm.setup-trouble-in-tharbad",
  "the-nin-in-eilph": "rm.setup-the-nin-in-eilph",
  "celebrimbors-secret": "rm.setup-celebrimbors-secret",
  "the-antlered-crown": "rm.setup-the-antlered-crown",
} as const;

describe("The Ring-maker cycle", () => {
  it("is the nine scenarios of The Voice of Isengard expansion and its six Adventure Packs, in release order, with no Campaign Mode", () => {
    expect(cycle.scenarios).toEqual(Object.keys(DECK));
    expect(cycle.kind).toBe("cycle");
    expect(cycle.campaignCards).toEqual({});
  });

  it("builds each scenario file from its Hall of Beorn title and the DragnCards decks Q04.n and E04.n", () => {
    for (const [at, [id, pin]] of Object.entries(DECK).entries()) {
      expect(scenarioSlug(pin.title), id).toBe(id);
      const scenario = loadAnyScenario(id);
      expect(scenario.name, id).toBe(pin.title);
      expect(scenario.campaignCard, id).toBeUndefined();
      expect(scenario.source.dragnNormal, id).toBe(pin.deck);
      expect(scenario.source.dragnEasy, id).toBe(`E04.${at + 1}`);
    }
    expect(() => loadScenarioDefinitions(new URL("../../data/", import.meta.url).pathname, byCode, [], "the-ring-maker")).not.toThrow();
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

  it("names the rules span that prints each scenario's encounter sets as its Setup span, which the build reads them from (the insert for The Voice of Isengard, the rulesheet for a pack)", () => {
    for (const id of Object.keys(DECK)) {
      const span = SETUP_SPANS[id as keyof typeof SETUP_SPANS];
      expect(def?.scenarios.find((scenario) => scenario.id === id)?.setupSpan, id).toBe(span);
      expect(rules.get(span) ?? "", id).toContain("encounter deck");
    }
    expect(def?.scenarios.map((scenario) => scenario.id)).toEqual(Object.keys(DECK));
  });

  it("builds the Raven deck of The Antlered Crown from the six enemies of Dunland Warriors and Dunland Raiders, and sets Chief Turch aside for the first player", () => {
    const crown = loadAnyScenario("the-antlered-crown");
    const aside = crown.cards.filter((card) => card.pile === "setAside").map((card) => byCode.get(card.code));
    expect(aside.filter((card) => card?.encounterSet === "Dunland Warriors" || card?.encounterSet === "Dunland Raiders").map((card) => card?.type)).toEqual(Array(6).fill("enemy"));
    expect(crown.cards.find((card) => card.code === "08150")).toMatchObject({ pile: "setAside" });
    expect(rules.get("rm.raven-deck")).toContain("This is the Raven deck.");
  });

  it("leaves the Easy Raven War-camp at two copies, the staged one and one in the encounter deck", () => {
    const camps = loadAnyScenario("the-antlered-crown").cards.filter((card) => card.code === "08155");
    expect(camps.find((card) => card.pile === "staging")).toMatchObject({ normal: 1, easy: 1 });
    expect(camps.find((card) => card.pile === "encounter")).toMatchObject({ normal: 3, easy: 1 });
  });

  it("names the keywords and rules the cycle owns in the insert and the rulesheets", () => {
    for (const id of ["rm.time-x", "rm.immune-to-player-card-effects", "rm.does-not-stack", "rm.doomed-x-player-cards", "rm.searches-x", "rm.hinder", "rm.secrecy", "rm.scour", "rm.the-orcs-search", "rm.current-trial", "rm.parallel-stages", "rm.threat-elimination-level", "rm.attacks-against-nalir", "rm.raven-deck", "rm.out-of-play-deck", "rm.grima-objective-ally"]) expect(rules.get(id), id).toBeTruthy();
    expect(rules.get("rm.time-x")).toContain("remove 1 time counter from each card with the Time X keyword");
  });
});
