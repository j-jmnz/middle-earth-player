// Rules: vom.setup-the-river-running, vom.setup-danger-in-dorwinion, vom.setup-the-temple-of-doom, vom.setup-wrath-and-ruin, vom.setup-the-city-of-ulfast, vom.setup-challenge-of-the-wainriders, vom.setup-under-the-ash-mountains,
// vom.setup-the-land-of-sorrow, vom.setup-the-fortress-of-nurn, vom.the-circuit, vom.racing-x-tests, vom.controlling-locations, vom.power-of-mordor-deck-the-temple-of-doom, vom.storm-the-castle (data/rules/entries.json).
// The Vengeance of Mordor cycle built from A Shadow in the East and its six Adventure Packs: its nine scenario files, their piles and counts for Normal and Easy, the pile decisions that depart from the
// DragnCards load lists, the cards the Setup deals out of the encounter deck, and the rules spans of the insert and the rulesheets. The shape every cycle shares (no campaign card, prelude or booklet)
// is held in cycles.test.ts.
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
const cycle = loadCampaign("vengeance-of-mordor");
const entries = JSON.parse(readFileSync(path.join(DATA_DIR, "rules", "entries.json"), "utf8")) as { id: string; text: string }[];
const rules = new Map(entries.map((entry) => [entry.id, entry.text.replaceAll("’", "'").replace(/\s+/g, " ")]));
const def = CYCLE_DEFS.find((campaign) => campaign.id === "vengeance-of-mordor");

// The Normal and Easy encounter decks (the encounter cards that are not set aside or staged), the encounter sets in rulesheet order, the stages, and the cards each scenario stages or sets aside.
// `deck2` is the second deck a Setup builds (The Power of Mordor deck).
const DECK = {
  "the-river-running": { title: "The River Running", deck: "Q09.1", normal: 35, easy: 25, sets: ["The River Running", "Riders of Rhûn", "Easterling Raiders", "Rolling Plains"], staging: ["21012", "21014"], setAside: ["21024"], deck2: [], stages: 2 },
  "danger-in-dorwinion": { title: "Danger in Dorwinion", deck: "Q09.2", normal: 36, easy: 28, sets: ["Danger in Dorwinion", "Servants of Sauron", "City of Rhûn", "Under Guard"], staging: [], setAside: ["21030", "21031", "21032", "21033", "21034", "21035"], deck2: [], stages: 3 },
  "the-temple-of-doom": { title: "The Temple of Doom", deck: "Q09.3", normal: 37, easy: 25, sets: ["The Temple of Doom", "Ulchor's Guard", "Twisted Tunnels", "Easterling Raiders", "The Power of Mordor"], staging: ["21053", "21054"], setAside: [], deck2: ["21066", "21067", "21068", "21069", "21070"], stages: 5 },
  "wrath-and-ruin": { title: "Wrath and Ruin", deck: "Q09.4", normal: 47, easy: 35, sets: ["Wrath and Ruin", "Easterling Raiders", "City of Rhûn"], staging: ["21046", "21047", "22011", "22014", "22015", "22016", "22018"], setAside: [], deck2: [], stages: 2 },
  "the-city-of-ulfast": { title: "The City of Ulfast", deck: "Q09.5", normal: 42, easy: 31, sets: ["The City of Ulfast", "Servants of Sauron", "Under Guard"], staging: ["21049", "21050", "22037", "22041", "22042", "22043", "22044"], setAside: [], deck2: [], stages: 4 },
  "challenge-of-the-wainriders": { title: "Challenge of the Wainriders", deck: "Q09.6", normal: 39, easy: 29, sets: ["Challenge of the Wainriders", "Rolling Plains", "Riders of Rhûn"], staging: ["21025", "21026", "22066", "22070", "22071", "22072"], setAside: ["22064", "22065"], deck2: [], stages: 6 },
  "under-the-ash-mountains": { title: "Under the Ash Mountains", deck: "Q09.7", normal: 37, easy: 28, sets: ["Under the Ash Mountains", "Twisted Tunnels"], staging: ["22099"], setAside: [], deck2: [], stages: 2 },
  "the-land-of-sorrow": { title: "The Land of Sorrow", deck: "Q09.8", normal: 42, easy: 29, sets: ["The Land of Sorrow", "Easterling Raiders", "Rolling Plains"], staging: ["22121", "22122", "22123"], setAside: ["22118", "22119", "22120", "22124", "22125", "22126"], deck2: [], stages: 2 },
  "the-fortress-of-nurn": { title: "The Fortress of Nurn", deck: "Q09.9", normal: 37, easy: 25, sets: ["The Fortress of Nurn", "Ulchor's Guard", "Under Guard", "The Power of Mordor"], staging: ["22148", "22161", "22162", "22163", "22164"], setAside: ["21058"], deck2: ["21066", "21067", "21068", "21069", "21070"], stages: 2 },
} as const;

const SETUP_SPANS = {
  "the-river-running": "vom.setup-the-river-running",
  "danger-in-dorwinion": "vom.setup-danger-in-dorwinion",
  "the-temple-of-doom": "vom.setup-the-temple-of-doom",
  "wrath-and-ruin": "vom.setup-wrath-and-ruin",
  "the-city-of-ulfast": "vom.setup-the-city-of-ulfast",
  "challenge-of-the-wainriders": "vom.setup-challenge-of-the-wainriders",
  "under-the-ash-mountains": "vom.setup-under-the-ash-mountains",
  "the-land-of-sorrow": "vom.setup-the-land-of-sorrow",
  "the-fortress-of-nurn": "vom.setup-the-fortress-of-nurn",
} as const;

describe("The Vengeance of Mordor cycle", () => {
  it("is the nine scenarios of A Shadow in the East expansion and its six Adventure Packs, in release order, with no Campaign Mode", () => {
    expect(cycle.scenarios).toEqual(Object.keys(DECK));
    expect(cycle.kind).toBe("cycle");
    expect(cycle.campaignCards).toEqual({});
  });

  it("builds each scenario file from its Hall of Beorn title and the DragnCards decks Q09.n and E09.n (Q08 is Wilderland's)", () => {
    for (const [at, [id, pin]] of Object.entries(DECK).entries()) {
      expect(scenarioSlug(pin.title), id).toBe(id);
      const scenario = loadAnyScenario(id);
      expect(scenario.name, id).toBe(pin.title);
      expect(scenario.campaignCard, id).toBeUndefined();
      expect(scenario.source.dragnNormal, id).toBe(pin.deck);
      expect(scenario.source.dragnEasy, id).toBe(`E09.${at + 1}`);
    }
    expect(() => loadScenarioDefinitions(new URL("../../data/", import.meta.url).pathname, byCode, [], "vengeance-of-mordor")).not.toThrow();
  });

  it.each(Object.entries(DECK))("%s deals the encounter deck, the encounter sets, the quest stages and the Setup piles the load list and the printed Setup leave", (id, pin) => {
    const scenario = loadAnyScenario(id);
    expect(encounterCodes(scenario)).toHaveLength(pin.normal);
    expect(encounterCodes(scenario, "Easy")).toHaveLength(pin.easy);
    expect(scenario.encounterSets.map((set) => set.name)).toEqual([...pin.sets]);
    expect(scenario.stages).toHaveLength(pin.stages);
    const codesOf = (pile: string) => [...new Set(scenario.cards.filter((card) => card.pile === pile && byCode.get(card.code)?.type !== "quest").map((card) => card.code))].sort();
    expect(codesOf("staging")).toEqual([...pin.staging]);
    expect(codesOf("setAside")).toEqual([...pin.setAside]);
    expect(codesOf("encounterDeck2")).toEqual([...pin.deck2]);
  });

  it("names the rules span that prints each scenario's encounter sets as its Setup span, which the build reads them from (the insert for A Shadow in the East, the rulesheet for a pack)", () => {
    for (const id of Object.keys(DECK)) {
      const span = SETUP_SPANS[id as keyof typeof SETUP_SPANS];
      expect(def?.scenarios.find((scenario) => scenario.id === id)?.setupSpan, id).toBe(span);
      expect(rules.get(span) ?? "", id).toContain("encounter deck");
    }
    expect(def?.scenarios.map((scenario) => scenario.id)).toEqual(Object.keys(DECK));
  });

  it("keeps a rulesheet's \"Wrath and Ruin\" as one encounter set, not two", () => {
    expect(loadAnyScenario("wrath-and-ruin").encounterSets.map((set) => set.name)).toContain("Wrath and Ruin");
    expect(rules.get("vom.setup-wrath-and-ruin")).toContain("Wrath and Ruin, Easterling Raiders, and City of Rhûn");
  });

  it("deals the Setup's own enemies from the encounter deck: the Easterling enemies of The River Running and Makeshift Fortification of Wrath and Ruin", () => {
    const piles = (id: string, code: string) => loadAnyScenario(id).cards.filter((card) => card.code === code).map((card) => card.pile);
    for (const code of ["21013", "21017", "21018", "21020"]) expect(piles("the-river-running", code), code).toEqual(["encounter"]);
    expect(piles("wrath-and-ruin", "22017").sort()).toEqual(["activeLocation", "encounter"]);
    expect(loadAnyScenario("wrath-and-ruin").cards.find((card) => card.code === "22017" && card.pile === "encounter")).toMatchObject({ normal: 2 });
  });

  it("adds Warriors of the East to the Wrath and Ruin encounter deck and the third Ash Mountain Werewolf, which the load lists leave out", () => {
    const dealt = (id: string, code: string) => loadAnyScenario(id).cards.find((card) => card.code === code && card.pile === "encounter");
    expect(dealt("wrath-and-ruin", "21024")).toMatchObject({ normal: 1, easy: 1 });
    expect(dealt("under-the-ash-mountains", "22097")).toMatchObject({ normal: 3, easy: 3 });
  });

  it("builds the circuit of Challenge of the Wainriders from the six quest cards, and keeps The Challengers and The Wainriders set aside for the Setup to place", () => {
    const race = loadAnyScenario("challenge-of-the-wainriders");
    expect(race.stages).toEqual(["22075", "22076", "22077", "22078", "22079", "22080"]);
    expect(race.cards.filter((card) => card.pile === "setAside").map((card) => card.code).sort()).toEqual(["22064", "22065"]);
    expect(rules.get("vom.the-circuit")).toContain("must complete the circuit twice before The Wainriders objective completes the circuit twice");
  });

  it("deals The Champion's Cunning, whose collector number Hall of Beorn shares with Wainrider Chariot", () => {
    expect(byCode.get("220730")?.name).toBe("The Champion's Cunning");
    expect(byCode.get("22073")?.name).toBe("Wainrider Chariot");
    expect(loadAnyScenario("challenge-of-the-wainriders").cards.find((card) => card.code === "220730")).toMatchObject({ pile: "encounter", normal: 3, easy: 2 });
  });

  it("sets the Plot objectives and the Cultist enemies of Danger in Dorwinion aside, and the Power of Mordor deck of the two scenarios that build it", () => {
    const aside = loadAnyScenario("danger-in-dorwinion").cards.filter((card) => card.pile === "setAside").map((card) => byCode.get(card.code)?.traits.join());
    expect(aside.sort()).toEqual(["Cultist", "Cultist", "Cultist", "Plot", "Plot", "Plot"]);
    for (const id of ["the-temple-of-doom", "the-fortress-of-nurn"]) expect(loadAnyScenario(id).cards.filter((card) => card.pile === "encounterDeck2").every((card) => byCode.get(card.code)?.encounterSet === "The Power of Mordor"), id).toBe(true);
  });

  it("deals the four double-sided Storm the Castle side quests of The Fortress of Nurn to the staging area, each with its reverse side", () => {
    const quests = loadAnyScenario("the-fortress-of-nurn").cards.filter((card) => card.pile === "staging" && byCode.get(card.code)?.name === "Storm the Castle");
    expect(quests.map((card) => card.code).sort()).toEqual(["22161", "22162", "22163", "22164"]);
    for (const code of ["22161", "22162", "22163", "22164"]) expect(byCode.get(code)?.back?.text, code).toContain("When this stage is defeated");
  });

  it("names the keywords and rules the cycle owns in the insert and the rulesheets", () => {
    for (const id of ["vom.contracts", "vom.smeagol-gollum", "vom.the-one-ring", "vom.quest-stages-vs-side-quests", "vom.controlling-locations", "vom.losing-control-of-a-location", "vom.the-circuit", "vom.race-keyword", "vom.racing-x-tests", "vom.storm-the-castle"]) {
      expect(rules.get(id), id).toBeDefined();
    }
    expect(rules.get("vom.race-keyword")).toContain("cannot be defeated outside of the quest phase");
    expect(rules.get("vom.the-one-ring")).toContain("immune to non-Master card effects");
  });
});
