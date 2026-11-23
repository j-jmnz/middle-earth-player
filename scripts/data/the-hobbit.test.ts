// Rules: hob.setup-we-must-away-ere-break-of-day, hob.setup-over-the-misty-mountains-grim, hob.setup-dungeons-deep-and-caverns-dim, hob.setup-flies-and-spiders, hob.setup-the-lonely-mountain,
// hob.setup-the-battle-of-five-armies, hob.sack-deck, hob.active-and-inactive-encounter-decks, hob.riddle-area, hob.treasure-ohauh, hob.treasure-otd (data/rules/entries.json).
// The Hobbit cycle built from the two saga boxes (The Hobbit: Over Hill and Under Hill and On the Doorstep): its six scenario files, their piles and counts for Normal and Easy, the rules
// spans of the inserts, and the Nightmare decks. The shape every cycle shares (no campaign card, prelude or booklet) is held for each cycle in cycles.test.ts.
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { encounterCodes } from "../../src/catalog/scenario-data.ts";

import { loadCards } from "./load-cards.ts";
import { loadAnyScenario, loadCampaign, loadScenarioDefinitions } from "./load-scenarios.ts";
import { DATA_DIR } from "./paths.ts";
import { scenarioSlug } from "./campaign-defs.ts";
import { NIGHTMARE_DECKS } from "./nightmare-defs.ts";
import { titleKey } from "./normalize/names.ts";

const cards = loadCards();
const byCode = new Map(cards.map((card) => [card.code, card]));
const cycle = loadCampaign("the-hobbit");
const entries = JSON.parse(readFileSync(path.join(DATA_DIR, "rules", "entries.json"), "utf8")) as { id: string; text: string }[];
const rules = new Map(entries.map((entry) => [entry.id, entry.text.replace(/\s+/g, " ")]));

// The Normal and Easy encounter decks (the cards the encounter deck holds, the second encounter deck and the set-aside Sack and treasure cards apart), the encounter sets in booklet order,
// the stages, and the cards each scenario stages or sets aside. Bilbo Baggins is in no pile: the first player takes control of him at the start of every game (hob.bilbo-baggins-ohauh).
const DECK = {
  "we-must-away-ere-break-of-day": { title: "We Must Away, Ere Break of Day", product: "OHaUH", normal: 32, easy: 20, sets: ["We Must Away, Ere Break of Day", "Western Lands"], staging: [], setAside: ["131032", "131033", "131034", "131037", "131044", "131045", "131046", "131047", "131048", "131049", "131050"], stages: 3 },
  "over-the-misty-mountains-grim": { title: "Over the Misty Mountains Grim", product: "OHaUH", normal: 26, easy: 17, sets: ["Over the Misty Mountains Grim", "Western Lands", "Misty Mountain Goblins", "The Great Goblin"], staging: [], setAside: [], stages: 3 },
  "dungeons-deep-and-caverns-dim": { title: "Dungeons Deep and Caverns Dim", product: "OHaUH", normal: 38, easy: 29, sets: ["Dungeons Deep and Caverns Dim", "Misty Mountain Goblins"], staging: ["131078"], setAside: [], stages: 3 },
  "flies-and-spiders": { title: "Flies and Spiders", product: "OtD", normal: 38, easy: 26, sets: ["Flies and Spiders", "Wilderland"], staging: [], setAside: ["132019", "132025"], stages: 4 },
  "the-lonely-mountain": { title: "The Lonely Mountain", product: "OtD", normal: 35, easy: 24, sets: ["The Lonely Mountain", "Wilderland"], staging: ["132040", "132043"], setAside: ["132020", "132021", "132022", "132023", "132024", "132039", "132041"], stages: 4 },
  "the-battle-of-five-armies": { title: "The Battle of Five Armies", product: "OtD", normal: 43, easy: 33, sets: ["The Battle of Five Armies", "Wilderland"], staging: ["132053"], setAside: [], stages: 5 },
} as const;

describe("The Hobbit cycle", () => {
  it("is the six scenarios of the two saga boxes, in release order", () => {
    expect(cycle.scenarios).toEqual(Object.keys(DECK));
  });

  it("builds each scenario file from its Hall of Beorn title and the DragnCards decks Q0A.n and E0A.n", () => {
    for (const [at, [id, pin]] of Object.entries(DECK).entries()) {
      expect(scenarioSlug(pin.title), id).toBe(id);
      const scenario = loadAnyScenario(id);
      expect(scenario.name, id).toBe(pin.title);
      expect(scenario.campaignCard, id).toBeUndefined();
      expect(scenario.source.dragnNormal, id).toBe(`Q0A.${at + 1}`);
      expect(scenario.source.dragnEasy, id).toBe(`E0A.${at + 1}`);
    }
    expect(() => loadScenarioDefinitions(new URL("../../data/", import.meta.url).pathname, byCode, [], "the-hobbit")).not.toThrow();
  });

  it.each(Object.entries(DECK))("%s deals the encounter deck, the encounter sets, the quest stages and the Setup piles the load list and the printed Setup leave", (id, pin) => {
    const scenario = loadAnyScenario(id);
    expect(encounterCodes(scenario)).toHaveLength(pin.normal);
    expect(encounterCodes(scenario, "Easy")).toHaveLength(pin.easy);
    expect(scenario.encounterSets.map((set) => set.name)).toEqual([...pin.sets]);
    expect(scenario.stages).toHaveLength(pin.stages);
    expect(scenario.cards.filter((card) => card.pile === "staging").map((card) => card.code).sort()).toEqual([...pin.staging]);
    expect(scenario.cards.filter((card) => card.pile === "setAside").map((card) => card.code).sort()).toEqual([...pin.setAside]);
    // Every card of the scenario is a card of its box, or of the Western Lands, Misty Mountain Goblins, The Great Goblin and Wilderland sets the other box's scenarios share.
    for (const card of scenario.cards) expect(byCode.get(card.code)?.printings.some((printing) => printing.pack === "OHaUH" || printing.pack === "OtD"), card.code).toBe(true);
  });

  it("deals no Bilbo Baggins hero: the first player takes control of him at the start of every game, and the treasure cards are discovered, not dealt", () => {
    for (const id of Object.keys(DECK)) {
      const dealt = loadAnyScenario(id).cards.map((card) => byCode.get(card.code));
      expect(dealt.filter((card) => card?.type === "hero"), id).toEqual([]);
    }
    expect(byCode.get("131001")).toMatchObject({ name: "Bilbo Baggins", type: "hero", sphere: "baggins" });
    expect(byCode.get("132001")).toMatchObject({ name: "Bilbo Baggins", type: "hero", sphere: "baggins" });
    // The Sack cards, the three Trolls and Troll Cave, the Erebor treasure cards and the treasure Bilbo's Magic Ring are set aside, the second encounter deck of the Misty Mountains is its own pile.
    expect(loadAnyScenario("we-must-away-ere-break-of-day").cards.filter((card) => card.pile === "setAside" && byCode.get(card.code)?.traits.includes("Sack"))).toHaveLength(7);
    expect(loadAnyScenario("the-lonely-mountain").cards.filter((card) => card.pile === "setAside" && byCode.get(card.code)?.type === "treasure")).toHaveLength(5);
    expect(loadAnyScenario("flies-and-spiders").cards.find((card) => card.code === "132019")).toMatchObject({ pile: "setAside", normal: 3, easy: 3 });
    expect(loadAnyScenario("over-the-misty-mountains-grim").cards.filter((card) => card.pile === "encounterDeck2").reduce((sum, card) => sum + card.normal, 0)).toBe(30);
  });

  it("starts Gollum, Bilbo's Magic Ring and the first Stone-Giant in the encounter deck: stage 2's Setup and When Revealed find them there, as DragnCards' load lists stage them", () => {
    const riddles = loadAnyScenario("dungeons-deep-and-caverns-dim").cards;
    expect(riddles.find((card) => card.code === "131074")).toMatchObject({ pile: "encounter", normal: 1 });
    expect(riddles.find((card) => card.code === "131079")).toMatchObject({ pile: "encounter", normal: 1 });
    expect(loadAnyScenario("over-the-misty-mountains-grim").cards.find((card) => card.code === "131064")).toMatchObject({ pile: "encounter", normal: 3, easy: 1 });
  });

  it("opens The Battle of Five Armies with its stage 1A, which Hall of Beorn's list leaves out, and keeps the printed title The Gathering of the Clouds", () => {
    const battle = loadAnyScenario("the-battle-of-five-armies");
    expect(battle.stages.map((code) => byCode.get(code)?.name)).toEqual(["The Gathering of the Clouds", "The Eastern Spur", "Battle in the Dale", "The Defense of Ravenhill", "The Clouds Burst"]);
  });

  it("takes the Easy counts of the Wilderland and Misty Mountain Goblins sets from the Easy Mode sheet where DragnCards' Easy decks keep the Normal count", () => {
    const sheet = rules.get("easy-mode.the-hobbit") ?? "";
    expect(sheet).toContain("2x Fighting Among Friends");
    expect(sheet).toContain("1x The Goblins' Caves");
    const mountain = loadAnyScenario("the-lonely-mountain").cards;
    expect(mountain.find((card) => card.code === "132037")).toMatchObject({ normal: 2, easy: 0 });
    expect(mountain.find((card) => card.code === "132038")).toMatchObject({ normal: 2, easy: 1 });
    expect(loadAnyScenario("dungeons-deep-and-caverns-dim").cards.find((card) => card.code === "131065")).toMatchObject({ normal: 3, easy: 2 });
  });

  it("removes in Easy exactly the copies the Easy Mode sheet lists for the encounter sets of the two boxes", () => {
    const lines = (entries.find((entry) => entry.id === "easy-mode.the-hobbit")?.text ?? "").split("\n").map((line) => /^(\d+)x (.+)$/.exec(line.trim()));
    const removed = lines.flatMap((match) => (match ? [[titleKey(match[2] ?? ""), Number(match[1])] as const] : []));
    expect(removed).toHaveLength(33);
    for (const [name, copies] of removed) {
      const dealt = Object.keys(DECK).flatMap((id) => loadAnyScenario(id).cards.filter((card) => card.pile !== "quest" && titleKey(byCode.get(card.code)?.name ?? "") === name).map((card) => [id, card.normal - card.easy] as const));
      expect(dealt.length, name).toBeGreaterThan(0);
      for (const [id, taken] of dealt) expect(taken, `${id} ${name}`).toBe(copies);
    }
  });

  it("reads the encounter sets of every scenario from its rules insert", () => {
    for (const [id, pin] of Object.entries(DECK)) {
      const text = (rules.get(`hob.setup-${id}`) ?? "").replaceAll("’", "'");
      expect(text, id).toContain("is played with");
      // Over the Misty Mountains Grim's insert names the second deck's sets in a sentence of their own; the others' sets are in the one paragraph (Wilderlands is Hall of Beorn's Wilderland).
      for (const set of pin.sets.filter((name) => name !== "Wilderland" && !(id === "over-the-misty-mountains-grim" && /Goblin/.test(name)))) expect(text, `${id} ${set}`).toContain(set);
    }
    expect(rules.get("hob.setup-over-the-misty-mountains-grim")).toContain("Misty Mountain Goblins and The Great Goblin");
    expect(rules.get("hob.sack-deck")).toContain("remove the seven Sack objectives (card numbers 44-50)");
    expect(rules.get("hob.riddle-area")).toContain("The riddle area is a new play area");
    expect(rules.get("hob.treasure-ohauh")).toContain("No more than 1 copy of any treasure card, by title");
    expect(rules.get("hob.treasure-otd")).toContain("The Arkenstone");
    expect(rules.get("hob.baggins-sphere-ohauh")).toContain("cannot gain resources through player card effects");
    expect(rules.get("hob.baggins-sphere-otd")).toContain("cannot gain resources from non-treasure cards");
  });
});

// Each scenario's Nightmare deck (docs/scenarios/nightmare.md, Nightmare): the setup card, the copies its side B removes and the copies of the deck shuffled in.
const NIGHTMARE = {
  "we-must-away-ere-break-of-day": { prefix: "9055", setup: "905501", removed: 9, added: 19 },
  "over-the-misty-mountains-grim": { prefix: "9056", setup: "905601", removed: 16, added: 19 },
  "dungeons-deep-and-caverns-dim": { prefix: "9057", setup: "905701", removed: 13, added: 19 },
  "flies-and-spiders": { prefix: "9058", setup: "905801", removed: 15, added: 19 },
  "the-lonely-mountain": { prefix: "9059", setup: "905901", removed: 14, added: 19 },
  "the-battle-of-five-armies": { prefix: "9060", setup: "906001", removed: 18, added: 19 },
} as const;

describe("The Hobbit Nightmare decks", () => {
  it.each(Object.entries(NIGHTMARE))("%s carries its deck, and every removal on the setup card resolves to a card the scenario deals", (id, pin) => {
    expect(NIGHTMARE_DECKS.find((deck) => deck.prefix === pin.prefix)?.scenario).toBe(id);
    const nightmare = loadAnyScenario(id).nightmare;
    expect(nightmare?.setupCard).toBe(pin.setup);
    expect(byCode.get(pin.setup)?.type).toBe("nightmare");
    expect(nightmare?.removed.reduce((sum, item) => sum + item.copies, 0)).toBe(pin.removed);
    expect(nightmare?.cards.reduce((sum, card) => sum + card.copies, 0)).toBe(pin.added);
  });
});
