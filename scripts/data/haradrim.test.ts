// Rules: hrd.setup-escape-from-umbar, hrd.setup-desert-crossing, hrd.setup-the-long-arm-of-mordor, hrd.setup-the-mumakil, hrd.setup-race-across-harad, hrd.setup-beneath-the-sands,
// hrd.setup-the-black-serpent, hrd.setup-the-dungeons-of-cirith-gurat, hrd.setup-the-crossings-of-poros, hrd.heat-tracker, hrd.track, hrd.prepare-the-orcs-area, hrd.guarded-x (data/rules/entries.json).
// The Haradrim cycle built from The Sands of Harad expansion and its six Adventure Packs: its nine scenario files, their piles and counts for Normal and Easy, the pile decisions that depart from
// the DragnCards load lists, the cards the Setup deals out of the encounter deck, and the rules spans of the insert and the rulesheets. The shape every cycle shares (no campaign card, prelude or
// booklet) is held in cycles.test.ts.
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
const cycle = loadCampaign("haradrim");
const entries = JSON.parse(readFileSync(path.join(DATA_DIR, "rules", "entries.json"), "utf8")) as { id: string; text: string }[];
const rules = new Map(entries.map((entry) => [entry.id, entry.text.replaceAll("’", "'").replace(/\s+/g, " ")]));
const def = CYCLE_DEFS.find((campaign) => campaign.id === "haradrim");

// The Normal and Easy encounter decks (the encounter cards that are not set aside or staged), the encounter sets in rulesheet order, the stages, and the cards each scenario stages or sets aside.
const DECK = {
  "escape-from-umbar": { title: "Escape from Umbar", deck: "Q07.1", normal: 36, easy: 28, sets: ["Escape from Umbar", "Harad Soldiers", "Harad Territory"], staging: ["16014", "16016", "16017", "16018", "16019", "16020"], setAside: [], stages: 2 },
  "desert-crossing": { title: "Desert Crossing", deck: "Q07.2", normal: 33, easy: 26, sets: ["Desert Crossing", "Desert Creatures", "Desert Sands"], staging: ["16025"], setAside: [], stages: 3 },
  "the-long-arm-of-mordor": { title: "The Long Arm of Mordor", deck: "Q07.3", normal: 29, easy: 22, sets: ["The Long Arm of Mordor", "Mordor Orcs", "Jungle Forest"], staging: ["16035"], setAside: ["16031", "16032", "16033", "16034", "16061"], stages: 4 },
  "the-mumakil": { title: "The Mûmakil", deck: "Q07.4", normal: 32, easy: 25, sets: ["The Mûmakil", "Jungle Forest"], staging: ["16056", "16057", "16058", "17020"], setAside: ["17011", "17012", "17013", "17014", "17015"], stages: 2 },
  "race-across-harad": { title: "Race Across Harad", deck: "Q07.5", normal: 38, easy: 31, sets: ["Race Across Harad", "Desert Sands", "Mordor Orcs"], staging: [], setAside: ["16061", "16063", "17038", "17039", "17051", "17052", "17053", "17054"], stages: 4 },
  "beneath-the-sands": { title: "Beneath the Sands", deck: "Q07.6", normal: 39, easy: 32, sets: ["Beneath the Sands", "Desert Creatures", "Harad Territory"], staging: ["17079"], setAside: ["17065"], stages: 3 },
  "the-black-serpent": { title: "The Black Serpent", deck: "Q07.7", normal: 37, easy: 29, sets: ["The Black Serpent", "Harad Soldiers"], staging: ["17094"], setAside: ["17091", "17092", "17093"], stages: 3 },
  "the-dungeons-of-cirith-gurat": { title: "The Dungeons of Cirith Gurat", deck: "Q07.8", normal: 42, easy: 32, sets: ["The Dungeons of Cirith Gurat", "Mordor Orcs", "Harad Territory"], staging: ["17119", "17125"], setAside: ["16061", "17120"], stages: 3 },
  "the-crossings-of-poros": { title: "The Crossings of Poros", deck: "Q07.9", normal: 15, easy: 12, sets: ["The Crossings of Poros", "Mountains of Shadow", "Desert Sands", "Desert Creatures", "Harad Soldiers", "Mordor Orcs"], staging: ["17146"], setAside: null, stages: 7 },
} as const;

const SETUP_SPANS = {
  "escape-from-umbar": "hrd.setup-escape-from-umbar",
  "desert-crossing": "hrd.setup-desert-crossing",
  "the-long-arm-of-mordor": "hrd.setup-the-long-arm-of-mordor",
  "the-mumakil": "hrd.setup-the-mumakil",
  "race-across-harad": "hrd.setup-race-across-harad",
  "beneath-the-sands": "hrd.setup-beneath-the-sands",
  "the-black-serpent": "hrd.setup-the-black-serpent",
  "the-dungeons-of-cirith-gurat": "hrd.setup-the-dungeons-of-cirith-gurat",
  "the-crossings-of-poros": "hrd.setup-the-crossings-of-poros",
} as const;

describe("The Haradrim cycle", () => {
  it("is the nine scenarios of The Sands of Harad expansion and its six Adventure Packs, in release order, with no Campaign Mode", () => {
    expect(cycle.scenarios).toEqual(Object.keys(DECK));
    expect(cycle.kind).toBe("cycle");
    expect(cycle.campaignCards).toEqual({});
  });

  it("builds each scenario file from its Hall of Beorn title and the DragnCards decks Q07.n and E07.n", () => {
    for (const [at, [id, pin]] of Object.entries(DECK).entries()) {
      expect(scenarioSlug(pin.title), id).toBe(id);
      const scenario = loadAnyScenario(id);
      expect(scenario.name, id).toBe(pin.title);
      expect(scenario.campaignCard, id).toBeUndefined();
      expect(scenario.source.dragnNormal, id).toBe(pin.deck);
      expect(scenario.source.dragnEasy, id).toBe(`E07.${at + 1}`);
    }
    expect(() => loadScenarioDefinitions(new URL("../../data/", import.meta.url).pathname, byCode, [], "haradrim")).not.toThrow();
  });

  it.each(Object.entries(DECK))("%s deals the encounter deck, the encounter sets, the quest stages and the Setup piles the load list and the printed Setup leave", (id, pin) => {
    const scenario = loadAnyScenario(id);
    expect(encounterCodes(scenario)).toHaveLength(pin.normal);
    expect(encounterCodes(scenario, "Easy")).toHaveLength(pin.easy);
    expect(scenario.encounterSets.map((set) => set.name)).toEqual([...pin.sets]);
    expect(scenario.stages).toHaveLength(pin.stages);
    expect([...new Set(scenario.cards.filter((card) => card.pile === "staging").map((card) => card.code))].sort()).toEqual([...pin.staging]);
    // The Crossings of Poros sets five encounter sets aside: 23 card titles beside Poros Garrison, named by the set and not by code.
    const aside = [...new Set(scenario.cards.filter((card) => card.pile === "setAside").map((card) => card.code))].sort();
    if (pin.setAside === null) expect(aside).toHaveLength(24);
    else expect(aside).toEqual([...pin.setAside]);
  });

  it("names the rules span that prints each scenario's encounter sets as its Setup span, which the build reads them from (the insert for The Sands of Harad, the rulesheet for a pack)", () => {
    for (const id of Object.keys(DECK)) {
      const span = SETUP_SPANS[id as keyof typeof SETUP_SPANS];
      expect(def?.scenarios.find((scenario) => scenario.id === id)?.setupSpan, id).toBe(span);
      expect(rules.get(span) ?? "", id).toContain("encounter deck");
    }
    expect(def?.scenarios.map((scenario) => scenario.id)).toEqual(Object.keys(DECK));
  });

  it("deals the eleven encounter side quests in the encounter deck of the scenarios that use their set, none with a null encounter set", () => {
    for (const code of ["16023", "16040", "16045", "16048", "16053", "16060", "17025", "17075", "17104", "17131", "17156"]) {
      expect(byCode.get(code)?.type, code).toBe("encounter-side-quest");
      expect(byCode.get(code)?.encounterSet, code).not.toBeNull();
    }
    const dealt = (id: string, code: string) => loadAnyScenario(id).cards.find((card) => card.code === code);
    expect(dealt("desert-crossing", "16023")).toMatchObject({ pile: "encounter", normal: 1 });
    expect(dealt("the-mumakil", "17025")).toMatchObject({ pile: "encounter", normal: 1 });
    expect(dealt("beneath-the-sands", "17075")).toMatchObject({ pile: "encounter", normal: 1 });
    expect(dealt("the-black-serpent", "17104")).toMatchObject({ pile: "encounter", normal: 1 });
    expect(dealt("the-dungeons-of-cirith-gurat", "17131")).toMatchObject({ pile: "encounter", normal: 1 });
    expect(dealt("the-crossings-of-poros", "17156")).toMatchObject({ pile: "setAside", normal: 1 });
  });

  it("sets the objective heroes, the Tamed Mûmak, Abaan and Poros Garrison in the pile the printed Setup names", () => {
    const pile = (id: string, code: string) => loadAnyScenario(id).cards.find((card) => card.code === code)?.pile;
    for (const code of ["16031", "16032", "16033", "16034"]) expect(pile("the-long-arm-of-mordor", code), code).toBe("setAside");
    expect(pile("race-across-harad", "17038")).toBe("setAside");
    expect(pile("the-dungeons-of-cirith-gurat", "17120")).toBe("setAside");
    expect(pile("the-crossings-of-poros", "17145")).toBe("setAside");
  });

  it("keeps the Orcs' quest deck of Race Across Harad out of the players' stages and sets it aside, stages 1C to 4C", () => {
    const race = loadAnyScenario("race-across-harad");
    expect(race.stages).toEqual(["17047", "17048", "17049", "17050"]);
    expect(race.cards.filter((card) => card.pile === "setAside" && byCode.get(card.code)?.type === "quest").map((card) => byCode.get(card.code)?.stage)).toEqual(["1C", "2C", "3C", "4C"]);
    expect(rules.get("hrd.prepare-the-orcs-area")).toContain("stage 1C, stage 2C, stage 3C, and stage 4C");
  });

  it("deals the Search objective of Beneath the Sands Off Track faceup, with On Track as its other side", () => {
    expect(loadAnyScenario("beneath-the-sands").cards.find((card) => card.pile === "staging")).toMatchObject({ code: "17079", back: "17080" });
    expect(rules.get("hrd.track")).toContain("flip the Search objective to On Track");
  });

  it("names the keywords and rules the cycle owns in the insert and the rulesheets", () => {
    for (const id of ["hrd.heat-tracker", "hrd.objective-heroes", "hrd.objective-hero-elimination", "hrd.heroes-in-the-staging-area", "hrd.guarded-heroes", "hrd.prepare-the-orcs-area", "hrd.orcs-area", "hrd.search-objective", "hrd.track", "hrd.guarded-x", "hrd.captives-of-cirith-gurat", "hrd.multiple-encounter-sets", "hrd.removed-from-the-game", "hrd.encounter-keyword", "hrd.side-quests", "hrd.archery"]) expect(rules.get(id), id).toBeTruthy();
    expect(rules.get("hrd.heat-tracker")).toContain("If the temperature reaches 60, the players lose the game.");
  });
});
