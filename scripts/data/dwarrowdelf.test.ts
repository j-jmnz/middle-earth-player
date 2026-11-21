// Rules: dwd.setup-into-the-pit, dwd.setup-the-seventh-level, dwd.setup-flight-from-moria, dwd.setup-the-redhorn-gate, dwd.setup-road-to-rivendell, dwd.setup-the-watcher-in-the-water,
// dwd.setup-the-long-dark, dwd.setup-foundations-of-stone, dwd.setup-shadow-and-flame, dwd.creating-the-quest-deck (data/rules/entries.json).
// The Dwarrowdelf cycle built from the Khazad-dûm expansion and the six Adventure Packs: its nine scenario files, their piles and counts for Normal and Easy, the rules spans of the
// inserts, and the Nightmare decks. The shape every cycle shares (no campaign card, prelude or booklet) is held for each cycle in cycles.test.ts.
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { encounterCodes, questDeckCodes } from "../../src/catalog/scenario-data.ts";

import { loadCards } from "./load-cards.ts";
import { loadAnyScenario, loadCampaign, loadScenarioDefinitions } from "./load-scenarios.ts";
import { DATA_DIR } from "./paths.ts";
import { scenarioSlug } from "./campaign-defs.ts";
import { NIGHTMARE_DECKS } from "./nightmare-defs.ts";
import { keyOf, loadLedger } from "./printed/ledger.ts";

const cards = loadCards();
const byCode = new Map(cards.map((card) => [card.code, card]));
const cycle = loadCampaign("dwarrowdelf");
const rules = new Map((JSON.parse(readFileSync(path.join(DATA_DIR, "rules", "entries.json"), "utf8")) as { id: string; text: string }[]).map((entry) => [entry.id, entry.text.replace(/\s+/g, " ")]));

// The Normal and Easy encounter decks, the encounter sets (the Misty Mountains, Plundering Goblins and the rest of Khazad-dûm's are printed in the expansion), the stages, and the cards each scenario stages or sets aside.
const DECK = {
  "into-the-pit": { title: "Into the Pit", normal: 50, easy: 33, sets: ["Into the Pit", "Twists and Turns", "Hazards of the Pit", "Goblins of the Deep"], staging: [], setAside: ["03017", "03018"], stages: 3 },
  "the-seventh-level": { title: "The Seventh Level", normal: 34, easy: 26, sets: ["The Seventh Level", "Goblins of the Deep", "Plundering Goblins"], staging: [], setAside: [], stages: 2 },
  "flight-from-moria": { title: "Flight from Moria", normal: 46, easy: 31, sets: ["Flight from Moria", "Hazards of the Pit", "Deeps of Moria", "Plundering Goblins"], staging: ["03025"], setAside: ["03028"], stages: 8 },
  "the-redhorn-gate": { title: "The Redhorn Gate", normal: 37, easy: 28, sets: ["The Redhorn Gate", "Misty Mountains"], staging: ["04015"], setAside: ["04014", "04022"], stages: 3 },
  "road-to-rivendell": { title: "Road to Rivendell", normal: 56, easy: 45, sets: ["Road to Rivendell", "Misty Mountains", "Plundering Goblins"], staging: [], setAside: ["04041"], stages: 3 },
  "the-watcher-in-the-water": { title: "The Watcher in the Water", normal: 43, easy: 33, sets: ["The Watcher in the Water", "Misty Mountains"], staging: [], setAside: ["04065", "04072"], stages: 2 },
  "the-long-dark": { title: "The Long Dark", normal: 60, easy: 44, sets: ["The Long Dark", "Deeps of Moria", "Twists and Turns"], staging: [], setAside: [], stages: 2 },
  "foundations-of-stone": { title: "Foundations of Stone", normal: 41, easy: 28, sets: ["Foundations of Stone", "Goblins of the Deep", "Hazards of the Pit", "Twists and Turns"], staging: [], setAside: [], stages: 8 },
  "shadow-and-flame": { title: "Shadow and Flame", normal: 54, easy: 40, sets: ["Shadow and Flame", "Goblins of the Deep", "Deeps of Moria"], staging: ["04150"], setAside: ["04141"], stages: 3 },
} as const;

describe("The Dwarrowdelf cycle", () => {
  it("is the nine scenarios of the Khazad-dûm expansion and its six Adventure Packs, in release order", () => {
    expect(cycle.scenarios).toEqual(Object.keys(DECK));
  });

  it("builds each scenario file from its Hall of Beorn title and the DragnCards decks Q02.n and E02.n", () => {
    for (const [at, [id, pin]] of Object.entries(DECK).entries()) {
      expect(scenarioSlug(pin.title), id).toBe(id);
      const scenario = loadAnyScenario(id);
      expect(scenario.name, id).toBe(pin.title);
      expect(scenario.campaignCard, id).toBeUndefined();
      expect(scenario.source.dragnNormal, id).toBe(`Q02.${at + 1}`);
      expect(scenario.source.dragnEasy, id).toBe(`E02.${at + 1}`);
    }
    expect(() => loadScenarioDefinitions(new URL("../../data/", import.meta.url).pathname, byCode, [], "dwarrowdelf")).not.toThrow();
  });

  it.each(Object.entries(DECK))("%s deals the encounter deck, the encounter sets, the quest stages and the Setup piles the load list and the printed Setup leave", (id, pin) => {
    const scenario = loadAnyScenario(id);
    expect(encounterCodes(scenario)).toHaveLength(pin.normal);
    expect(encounterCodes(scenario, "Easy")).toHaveLength(pin.easy);
    expect(scenario.encounterSets.map((set) => set.name)).toEqual([...pin.sets]);
    expect(scenario.stages).toHaveLength(pin.stages);
    expect(scenario.cards.filter((card) => card.pile === "staging").map((card) => card.code).sort()).toEqual([...pin.staging]);
    expect(scenario.cards.filter((card) => card.pile === "setAside").map((card) => card.code).sort()).toEqual([...pin.setAside]);
  });

  it("attaches Cave Torch (Into the Pit, The Long Dark, Foundations of Stone) and Book of Mazarbul at Setup, and sets the second encounter deck of Foundations of Stone aside", () => {
    for (const id of ["into-the-pit", "the-long-dark", "foundations-of-stone"]) expect(loadAnyScenario(id).cards.find((card) => card.code === "03041"), id).toMatchObject({ pile: "attachedChosen" });
    expect(loadAnyScenario("the-seventh-level").cards.find((card) => card.code === "03024")).toMatchObject({ pile: "attachedChosen" });
    const stone = loadAnyScenario("foundations-of-stone");
    expect(stone.cards.filter((card) => card.pile === "encounterDeck2").map((card) => card.code)).toContain("04119");
    expect(stone.encounterSets.map((set) => set.name)).toContain("Foundations of Stone");
  });

  it("sets aside all four copies of A Foe Beyond (Normal), and keeps Wrapped!, whose Hall of Beorn code is The Long Dark's Háma, as its own six-digit card", () => {
    expect(loadAnyScenario("flight-from-moria").cards.find((card) => card.code === "03028" && card.pile === "setAside")).toMatchObject({ normal: 4, easy: 1 });
    expect(byCode.get("040076")).toMatchObject({ name: "Wrapped!", type: "treachery" });
    expect(byCode.get("04076")?.name).toBe("Háma");
    expect(loadAnyScenario("the-watcher-in-the-water").cards.find((card) => card.code === "040076")).toMatchObject({ pile: "encounter", normal: 4, easy: 2 });
  });

  it("names the seven stage 2 cards of Flight from Moria, all titled Search for an Exit, by their side B titles", () => {
    const flight = loadAnyScenario("flight-from-moria");
    expect(flight.stages.slice(1).map((code) => byCode.get(code)?.name)).toEqual(Array(7).fill("Search for an Exit"));
    expect(questDeckCodes(flight)).toHaveLength(8);
  });

  it("reads the encounter sets of every scenario from its rules insert, the Khazad-dûm expansion's for its three", () => {
    for (const id of Object.keys(DECK)) {
      const text = (rules.get(`dwd.setup-${id}`) ?? "").replaceAll("’", "'");
      expect(text, id).toContain("is played with an encounter deck");
      // The Long Dark's rulesheet lists Hazards of the Pit and Foundations of Stone's Deeps of Moria; the load lists, Hall of Beorn's lists and the printed Nightmare removals say the other way
      // (Stray Goblin and Abandoned Mine are Deeps of Moria's, Cave In is Hazards of the Pit's; docs/brief.md, Dwarrowdelf).
      const unlisted = id === "the-long-dark" ? "Deeps of Moria" : id === "foundations-of-stone" ? "Hazards of the Pit" : "";
      for (const set of DECK[id as keyof typeof DECK].sets.filter((name) => name !== unlisted)) expect(text, `${id} ${set}`).toContain(set);
    }
    expect(rules.get("dwd.ally-objective-arwen")).toContain("the players have lost the game");
    expect(rules.get("dwd.creating-the-quest-deck")).toContain("there is no stage 3");
    expect(rules.get("dwd.durins-bane")).toContain("engaged with all players whose threat is 1 or greater");
    expect(rules.get("dwd.locate-test")).toContain("the test is considered a failure");
  });
});

// Each scenario's Nightmare deck (docs/brief.md, Nightmare): the setup card, the copies its side B removes and the copies of the deck shuffled in.
const NIGHTMARE = {
  "into-the-pit": { prefix: "9010", setup: "901001", removed: 19, added: 18, quest: ["03065"], questCards: ["901002"] },
  "the-seventh-level": { prefix: "9011", setup: "901101", removed: 12, added: 19, quest: [], questCards: undefined },
  "flight-from-moria": { prefix: "9012", setup: "901201", removed: 20, added: 16, quest: ["03075"], questCards: ["901202", "901203", "901204"] },
  "the-redhorn-gate": { prefix: "9013", setup: "901301", removed: 17, added: 19, quest: [], questCards: undefined },
  "road-to-rivendell": { prefix: "9014", setup: "901401", removed: 27, added: 18, quest: ["04039"], questCards: ["901402"] },
  "the-watcher-in-the-water": { prefix: "9015", setup: "901501", removed: 12, added: 19, quest: [], questCards: undefined },
  "the-long-dark": { prefix: "9016", setup: "901601", removed: 24, added: 19, quest: [], questCards: undefined },
  "foundations-of-stone": { prefix: "9017", setup: "901701", removed: 22, added: 19, quest: [], questCards: undefined },
  "shadow-and-flame": { prefix: "9018", setup: "901801", removed: 16, added: 19, quest: [], questCards: undefined },
} as const;

describe("The Dwarrowdelf Nightmare decks", () => {
  const ledger = loadLedger();

  it.each(Object.entries(NIGHTMARE))("%s carries its deck, and every removal on the setup card resolves to a card the scenario deals", (id, pin) => {
    expect(NIGHTMARE_DECKS.find((deck) => deck.prefix === pin.prefix)?.scenario).toBe(id);
    const nightmare = loadAnyScenario(id).nightmare;
    expect(nightmare?.setupCard).toBe(pin.setup);
    expect(byCode.get(pin.setup)?.type).toBe("nightmare");
    expect(nightmare?.removed.reduce((sum, item) => sum + item.copies, 0)).toBe(pin.removed);
    expect(nightmare?.cards.reduce((sum, card) => sum + card.copies, 0)).toBe(pin.added);
    expect(nightmare?.removed.filter((item) => item.pile === "quest").map((item) => item.code)).toEqual([...pin.quest]);
    expect(nightmare?.questCards).toEqual(pin.questCards === undefined ? undefined : [...pin.questCards]);
  });

  it("takes Foundations of Stone's removals out of its set-aside encounter set", () => {
    const removed = loadAnyScenario("foundations-of-stone").nightmare?.removed ?? [];
    expect(removed.filter((item) => item.pile === "encounterDeck2").map((item) => byCode.get(item.code)?.name).sort()).toEqual(["Drowned Treasury", "Mithril Lode", "Moria Bats"]);
  });

  it("shuffles Foundations of Stone's Nightmare cards by their set icon: Goblins of the Deep into the standard deck, Foundations of Stone into the set-aside set", () => {
    const cards = loadAnyScenario("foundations-of-stone").nightmare?.cards ?? [];
    expect(cards.filter((card) => card.pile === "encounter").map((card) => card.code)).toEqual(["901702", "901703"]);
    expect(cards.filter((card) => card.pile === "encounterDeck2").map((card) => [card.code, card.copies])).toEqual([["901704", 3], ["901705", 2], ["901706", 3], ["901707", 3], ["901708", 3]]);
    expect(loadAnyScenario("foundations-of-stone").widgets.perSeatStaging).toBe(true);
  });

  it("reads every side of every card of the nine decks from its Nightmare proxy picture, the card's printed words over Hall of Beorn's", () => {
    const sides = Object.values(NIGHTMARE).flatMap((pin) => cards.filter((card) => card.code.startsWith(pin.prefix) && card.code.length === pin.prefix.length + 2).flatMap((card) => (card.back ? [`${card.code}.A`, `${card.code}.B`] : [`${card.code}.A`])));
    expect(sides).toHaveLength(92);
    for (const key of sides) {
      const entry = ledger.byKey.get(key);
      expect(entry, key).toBeDefined();
      expect(entry?.readBy, key).toBe("Claude Code, read from the Nightmare proxy picture");
      expect(entry?.printing, key).toBe("Nightmare");
    }
    // Printed words that differ from Hall of Beorn's: the quest deck named in the removal list, a dropped shadow line, a wrong scenario name.
    expect(ledger.byKey.get(keyOf("901001", "B"))?.lines[1]).toContain("encounter and quest deck");
    expect(ledger.byKey.get(keyOf("901603", "A"))?.lines[0]).toContain("discard that character from play");
    expect(ledger.byKey.get(keyOf("901801", "B"))?.lines[0]).toContain("Shadow and Flame scenario");
  });
});
