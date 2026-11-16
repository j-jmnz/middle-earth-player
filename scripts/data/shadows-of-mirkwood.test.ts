// Rules: sotm.setup-a-journey-to-rhosgobel, sotm.setup-the-hills-of-emyn-muil, sotm.setup-the-dead-marshes, sotm.setup-return-to-mirkwood, sotm.ally-objective-wilyador,
// sotm.escape-test, sotm.guarding-gollum (data/rules/entries.json).
// The Shadows of Mirkwood cycle built from the six Adventure Packs: its codes, the six scenario files, their piles and counts for Normal and Easy, the rules spans, and the one
// thing that makes it a cycle: no campaign card, prelude or booklet.
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { encounterCodes } from "../../src/catalog/scenario-data.ts";

import { loadCards } from "./load-cards.ts";
import { loadAnyScenario, loadCampaign, loadScenarioDefinitions, scenarioOrder } from "./load-scenarios.ts";
import { DATA_DIR } from "./paths.ts";
import { scenarioSlug } from "./campaign-defs.ts";

const cards = loadCards();
const byCode = new Map(cards.map((card) => [card.code, card]));
const cycle = loadCampaign("shadows-of-mirkwood");
const rules = new Map((JSON.parse(readFileSync(path.join(DATA_DIR, "rules", "entries.json"), "utf8")) as { id: string; text: string }[]).map((entry) => [entry.id, entry.text.replace(/\s+/g, " ")]));
const index = JSON.parse(readFileSync(path.join(DATA_DIR, "campaigns", "index.json"), "utf8")) as { id: string; kind: string; scenarioCount: number; playable: boolean; box: string | null; position: number }[];

// The Normal and Easy encounter decks, the encounter sets (the core sets are the Revised Core Set's printing), and the cards each scenario stages or sets aside.
const DECK = {
  "the-hunt-for-gollum": { title: "The Hunt for Gollum", normal: 48, easy: 34, sets: ["The Hunt for Gollum", "Journey Along the Anduin", "Sauron's Reach"], staging: [], setAside: [], stages: 3 },
  "conflict-at-the-carrock": { title: "Conflict at the Carrock", normal: 44, easy: 28, sets: ["Conflict at the Carrock", "Journey Along the Anduin", "Wilderlands"], staging: ["02043"], setAside: ["02038", "02039", "02040", "02041", "02048"], stages: 2 },
  "a-journey-to-rhosgobel": { title: "A Journey to Rhosgobel", normal: 53, easy: 37, sets: ["A Journey to Rhosgobel", "Spiders of Mirkwood", "Dol Guldur Orcs"], staging: ["02064", "02065"], setAside: [], stages: 3 },
  "the-hills-of-emyn-muil": { title: "The Hills of Emyn Muil", normal: 53, easy: 38, sets: ["The Hills of Emyn Muil", "Dol Guldur Orcs", "Sauron's Reach"], staging: ["02083", "02084"], setAside: [], stages: 1 },
  "the-dead-marshes": { title: "The Dead Marshes", normal: 53, easy: 36, sets: ["The Dead Marshes", "Sauron's Reach", "Wilderlands"], staging: ["02107"], setAside: [], stages: 2 },
  "return-to-mirkwood": { title: "Return to Mirkwood", normal: 53, easy: 35, sets: ["Return to Mirkwood", "Spiders of Mirkwood", "Wilderlands"], staging: [], setAside: ["02130"], stages: 4 },
} as const;

describe("The Shadows of Mirkwood cycle", () => {
  it("is a cycle of the six Adventure Packs in pack order, with no campaign card, prelude, booklet or starter deck", () => {
    expect(cycle.scenarios).toEqual(Object.keys(DECK));
    expect(cycle.kind).toBe("cycle");
    expect(cycle.saga).toBe(false);
    expect(cycle.xp).toBeUndefined();
    expect(cycle.bookletId).toBeUndefined();
    expect(cycle.bookletPages).toBeUndefined();
    expect(cycle.campaignCards).toEqual({});
    expect(cycle.prelude).toEqual([]);
    expect(cycle.starterDecks).toEqual([]);
    const raw = JSON.parse(readFileSync(path.join(DATA_DIR, "campaigns", "shadows-of-mirkwood.json"), "utf8")) as Record<string, unknown>;
    expect(Object.keys(raw)).not.toContain("campaignCards");
    expect(Object.keys(raw)).not.toContain("prelude");
  });

  it("is listed once, as a cycle with six scenarios and no box, first by release, and is not playable until a scenario is", () => {
    const rows = index.filter((entry) => entry.id === "shadows-of-mirkwood");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "cycle", scenarioCount: 6, playable: false, box: null, position: 1 });
  });

  it("builds the six scenario files, each named for its Hall of Beorn title, in release order after the campaigns", () => {
    expect(scenarioOrder().slice(-6)).toEqual(Object.keys(DECK));
    for (const [at, [id, pin]] of Object.entries(DECK).entries()) {
      expect(scenarioSlug(pin.title), id).toBe(id);
      const scenario = loadAnyScenario(id);
      expect(scenario.name, id).toBe(pin.title);
      expect(scenario.number, id).toBe(at + 1);
      expect(scenario.campaignCard, id).toBeUndefined();
      expect(scenario.campaignPlaced, id).toEqual([]);
      expect(scenario.source.dragnNormal, id).toBe(`Q01.${at + 4}`);
      expect(scenario.source.dragnEasy, id).toBe(`E01.${at + 4}`);
    }
    expect(() => loadScenarioDefinitions(new URL("../../data/", import.meta.url).pathname, byCode, [], "shadows-of-mirkwood")).not.toThrow();
  });

  it.each(Object.entries(DECK))("%s deals the encounter deck, the encounter sets, the quest stages and the Setup piles the load list and the printed Setup leave", (id, pin) => {
    const scenario = loadAnyScenario(id);
    expect(encounterCodes(scenario)).toHaveLength(pin.normal);
    expect(encounterCodes(scenario, "Easy")).toHaveLength(pin.easy);
    expect(scenario.encounterSets.map((set) => set.name)).toEqual([...pin.sets]);
    expect(scenario.encounterSets.reduce((sum, set) => sum + set.count, 0)).toBe(pin.normal);
    expect(scenario.stages).toHaveLength(pin.stages);
    expect(scenario.cards.filter((card) => card.pile === "staging").map((card) => card.code).sort()).toEqual([...pin.staging]);
    expect(scenario.cards.filter((card) => card.pile === "setAside").map((card) => card.code).sort()).toEqual([...pin.setAside]);
  });

  it("takes the core encounter sets from the Revised Core Set's printing", () => {
    for (const id of Object.keys(DECK)) {
      for (const card of loadAnyScenario(id).cards) {
        const printed = byCode.get(card.code);
        if (printed?.encounterSet && ["Journey Along the Anduin", "Sauron's Reach", "Spiders of Mirkwood", "Dol Guldur Orcs", "Wilderlands"].includes(printed.encounterSet)) expect(printed.printings[0]?.pack, `${id} ${printed.name}`).toBe("RevCore");
      }
    }
  });

  it("sets aside the four unique Trolls and four 'Sacked!' (shuffling one per player back), stages The Carrock, and keeps the fifth 'Sacked!' in the Normal encounter deck only", () => {
    const carrock = loadAnyScenario("conflict-at-the-carrock");
    expect(carrock.cards.find((card) => card.code === "02048" && card.pile === "setAside")).toMatchObject({ normal: 4, easy: 4 });
    expect(carrock.cards.find((card) => card.code === "02048" && card.pile === "encounter")).toMatchObject({ normal: 1, easy: 0 });
    for (const code of ["02038", "02039", "02040", "02041"]) expect(byCode.get(code)).toMatchObject({ type: "enemy", isUnique: true, traits: ["Troll"] });
  });

  it("stages Wilyador and Rhosgobel, Amon Hen and Amon Lhaw, and Gollum as each Setup says, and sets the guarded Gollum of Return to Mirkwood aside", () => {
    expect(byCode.get("02064")).toMatchObject({ name: "Wilyador" });
    expect(byCode.get("02107")).toMatchObject({ name: "Gollum", type: "objective" });
    expect(byCode.get("02130")).toMatchObject({ name: "Gollum", type: "objective" });
    expect(byCode.get("02083")?.name).toBe("Amon Hen");
    expect(byCode.get("02084")?.name).toBe("Amon Lhaw");
  });

  it("reads the encounter sets of four packs from their rulesheets (The Hunt for Gollum's and Conflict at the Carrock's have no text layer)", () => {
    for (const id of ["a-journey-to-rhosgobel", "the-hills-of-emyn-muil", "the-dead-marshes", "return-to-mirkwood"]) {
      const text = rules.get(`sotm.setup-${id}`) ?? "";
      expect(text, id).toContain("is played with an encounter deck built with all the cards from the following encounter sets");
      for (const set of DECK[id as keyof typeof DECK].sets) expect(text.replaceAll("’", "'"), `${id} ${set}`).toContain(set);
    }
    for (const id of ["the-hunt-for-gollum", "conflict-at-the-carrock"]) expect(rules.has(`sotm.setup-${id}`), id).toBe(false);
    expect(rules.get("sotm.ally-objective-wilyador")).toContain("If Wilyador leaves play for any reason, the players have lost the game");
    expect(rules.get("sotm.escape-test")).toContain("the escape test is failed");
    expect(rules.get("sotm.guarding-gollum")).toContain("If Gollum is destroyed, or leaves play for any reason, the players have lost the game");
  });
});
