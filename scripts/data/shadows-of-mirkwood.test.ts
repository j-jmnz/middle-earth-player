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
import { NIGHTMARE_DECKS } from "./nightmare-defs.ts";
import { keyOf, loadLedger } from "./printed/ledger.ts";

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

  it("is listed once, as a cycle with six scenarios and no box, first by release, and is playable once a scenario is (The Hunt for Gollum)", () => {
    const rows = index.filter((entry) => entry.id === "shadows-of-mirkwood");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "cycle", scenarioCount: 6, playable: true, box: null, position: 1 });
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

// Each scenario's Nightmare deck (docs/brief.md, Nightmare): the setup card, the copies its side B removes (the totals are the printed lists') and the copies of the deck shuffled in.
const NIGHTMARE = {
  "the-hunt-for-gollum": { prefix: "9004", setup: "900401", removed: 20, added: 19, setAside: [] },
  "conflict-at-the-carrock": { prefix: "9005", setup: "900501", removed: 28, added: 18, setAside: ["02038", "02039", "02040", "02041"] },
  "a-journey-to-rhosgobel": { prefix: "9006", setup: "900601", removed: 20, added: 19, setAside: [] },
  "the-hills-of-emyn-muil": { prefix: "9007", setup: "900701", removed: 28, added: 19, setAside: [] },
  "the-dead-marshes": { prefix: "9008", setup: "900801", removed: 28, added: 19, setAside: [] },
  "return-to-mirkwood": { prefix: "9009", setup: "900901", removed: 20, added: 19, setAside: [] },
} as const;

describe("The Shadows of Mirkwood Nightmare decks", () => {
  const ledger = loadLedger();

  it.each(Object.entries(NIGHTMARE))("%s carries its deck, and every removal on the setup card resolves to a card the scenario deals", (id, pin) => {
    expect(NIGHTMARE_DECKS.find((deck) => deck.prefix === pin.prefix)?.scenario).toBe(id);
    const scenario = loadAnyScenario(id);
    const nightmare = scenario.nightmare;
    expect(nightmare?.setupCard).toBe(pin.setup);
    expect(byCode.get(pin.setup)?.type).toBe("nightmare");
    const dealt = new Map<string, number>();
    for (const card of scenario.cards) if (card.pile !== "staging" || card.normal > 0) dealt.set(`${card.code}:${card.pile}`, card.normal);
    expect(nightmare?.removed.reduce((sum, item) => sum + item.copies, 0)).toBe(pin.removed);
    for (const item of nightmare?.removed ?? []) expect(dealt.get(`${item.code}:${item.pile}`) ?? 0, `${id} ${item.code}`).toBeGreaterThanOrEqual(item.copies);
    expect(nightmare?.cards.reduce((sum, card) => sum + card.copies, 0)).toBe(pin.added);
    expect(nightmare?.removed.filter((item) => item.pile === "setAside").map((item) => item.code).sort()).toEqual([...pin.setAside]);
  });

  it("records Conflict at the Carrock's Nightmare quest card, Grimbeorn's Folly (stage 3), and no other deck's", () => {
    expect(loadAnyScenario("conflict-at-the-carrock").nightmare?.questCards).toEqual(["900511"]);
    expect(byCode.get("900511")).toMatchObject({ name: "Grimbeorn's Folly", type: "quest", stage: "3A" });
    for (const id of Object.keys(NIGHTMARE).filter((one) => one !== "conflict-at-the-carrock")) expect(loadAnyScenario(id).nightmare?.questCards, id).toBeUndefined();
  });

  it("reads every side of every card of the six decks from its Nightmare proxy picture, the card's printed words over Hall of Beorn's", () => {
    const sides = Object.values(NIGHTMARE).flatMap((pin) => cards.filter((card) => card.code.startsWith(pin.prefix) && card.code.length === pin.prefix.length + 2).flatMap((card) => (card.back ? [`${card.code}.A`, `${card.code}.B`] : [`${card.code}.A`])));
    expect(sides).toHaveLength(63);
    for (const key of sides) {
      const entry = ledger.byKey.get(key);
      expect(entry, key).toBeDefined();
      expect(entry?.readBy, key).toBe("Claude Code, read from the Nightmare proxy picture");
      expect(entry?.printing, key).toBe("Nightmare");
    }
    // Printed words that differ from Hall of Beorn's text: a typo, a dropped keyword line, double quotation marks.
    expect(ledger.byKey.get(keyOf("900801", "B"))?.lines).toContain("2x Giant Marsh Worm");
    expect(ledger.byKey.get(keyOf("900707", "A"))?.lines[0]).toBe("Doomed 2.");
    expect(ledger.byKey.get(keyOf("900503", "A"))?.lines[0]).toContain("Rob & Bob");
  });
});
