import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { encounterCodes } from "../../src/catalog/scenario-data.ts";

import { loadCards } from "./load-cards.ts";
import { loadCampaign, loadScenario, loadScenarioDefinitions } from "./load-scenarios.ts";

const cards = loadCards();
const byCode = new Map(cards.map((card) => [card.code, card]));

describe("scenario data", () => {
  it("deals only cards that data/cards has, and no nightmare card", () => {
    expect(() => loadScenarioDefinitions(new URL("../../data/", import.meta.url).pathname, byCode)).not.toThrow();
  });

  it("lists a scenario for every campaign entry, in booklet order", () => {
    const campaign = loadCampaign();
    expect(campaign.scenarios.length).toBeGreaterThan(0);
    const numbers = campaign.scenarios.map((id) => loadScenario(id).number);
    expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
  });

  it("builds all six scenarios, each with its campaign card", () => {
    const campaign = loadCampaign();
    expect(campaign.scenarios).toEqual(["a-shadow-of-the-past", "a-knife-in-the-dark", "flight-to-the-ford", "the-ring-goes-south", "journey-in-the-dark", "breaking-of-the-fellowship"]);
    for (const id of campaign.scenarios) {
      const scenario = loadScenario(id);
      expect(campaign.campaignCards[id], id).toBe(scenario.campaignCard);
      expect(byCode.get(scenario.campaignCard)?.type, id).toBe("campaign");
      expect(byCode.get(scenario.campaignCard)?.name, id).toBe(scenario.name);
    }
  });
});

describe("Normal deck sizes", () => {
  // The expected sizes are pins, written down from the booklet's setup (the totals of the printed Normal deck), and
  // each is re-derived from Hall of Beorn's printed Normal quantity of every encounter card of the scenario, less
  // the quest stages, the campaign cards and the boons and burdens the campaign deals (they have no encounter row), and the copies the load list sets
  // aside, stages or makes active at Setup. The load list (DragnCards) decides which pile a copy sits in; Hall of
  // Beorn decides how many copies there are, so the two sources have to agree on the total.
  const DECK = { "a-shadow-of-the-past": 40, "a-knife-in-the-dark": 35, "flight-to-the-ford": 38, "the-ring-goes-south": 30, "journey-in-the-dark": 34, "breaking-of-the-fellowship": 30 } as const;
  type Listed = { Title: string; Slug: string; EncounterSet?: string; NormalQuantity: number };
  const bySlug = new Map(cards.flatMap((card) => card.printings.flatMap((printing) => (printing.hobSlug ? [[printing.hobSlug, card.code] as const] : []))));

  it.each(Object.entries(DECK))("%s deals the printed Normal deck of %i", (id, size) => {
    const scenario = loadScenario(id);
    const raw = JSON.parse(readFileSync(new URL(`../../data/raw/hallofbeorn/Scenarios/${scenario.source.hobSlug}.json`, import.meta.url), "utf8")) as { ScenarioCards: Listed[] };
    const listed = raw.ScenarioCards.filter((item) => !/\(Campaign\)$/.test(item.Title) && !/Nightmare$/.test(item.EncounterSet ?? ""));
    const printed = new Map<string, number>();
    for (const item of listed) {
      const code = bySlug.get(item.Slug);
      if (code) printed.set(code, (printed.get(code) ?? 0) + item.NormalQuantity);
    }
    let derived = 0;
    for (const [code, quantity] of printed) {
      const card = byCode.get(code);
      const rows = scenario.cards.filter((item) => item.code === code);
      if (!card || card.type === "quest" || card.campaignKind != null || !rows.some((row) => row.pile === "encounter")) continue;
      // What the load list puts anywhere but the deck (set aside, staging, active location) is not in the deck; the locations the Setup has each
      // player find (`searched`) are in it until then.
      derived += quantity - rows.filter((row) => row.pile !== "encounter" && !row.searched).reduce((sum, row) => sum + row.normal, 0);
    }
    expect(derived).toBe(size);
    expect(encounterCodes(scenario)).toHaveLength(size);
  });
});

// Mirkwood Paths and The Dark of Mirkwood (phase 27). The Fellowship assertions above stay as they are.
describe("Mirkwood campaigns", () => {
  const paths = loadCampaign("mirkwood-paths");
  const mini = loadCampaign("the-dark-of-mirkwood");

  it("lists the scenarios of each campaign in play order, the Oath and the Caves in both", () => {
    expect(paths.scenarios).toEqual(["passage-through-mirkwood", "journey-along-the-anduin", "escape-from-dol-guldur", "the-oath", "the-caves-of-nibin-dum"]);
    expect(mini.scenarios).toEqual(["the-oath", "the-caves-of-nibin-dum"]);
    expect(mini.campaignCards).toEqual({ "the-oath": paths.campaignCards["the-oath"], "the-caves-of-nibin-dum": paths.campaignCards["the-caves-of-nibin-dum"] });
  });

  it("are not sagas: no prelude, no starter decks, and each opens its own booklet", () => {
    for (const campaign of [paths, mini]) {
      expect(campaign.saga).toBe(false);
      expect(campaign.prelude).toEqual([]);
      expect(campaign.starterDecks).toEqual([]);
    }
    expect(loadCampaign().saga).toBe(true);
    expect(loadCampaign().bookletId).toBe("fellowship-of-the-ring");
    expect(paths.bookletId).toBe("learn-to-play");
    expect(mini.bookletId).toBe("the-dark-of-mirkwood");
    expect(paths.bookletPages).toEqual({ "passage-through-mirkwood": 25, "journey-along-the-anduin": 25, "escape-from-dol-guldur": 25 });
    expect(mini.bookletPages).toEqual({ "the-oath": 3, "the-caves-of-nibin-dum": 5 });
  });

  it("builds each scenario with its campaign card, and deals only cards data/cards has", () => {
    const dataDir = new URL("../../data/", import.meta.url).pathname;
    for (const campaign of [paths, mini]) {
      expect(() => loadScenarioDefinitions(dataDir, byCode, [], campaign.id)).not.toThrow();
      for (const id of campaign.scenarios) {
        const scenario = loadScenario(id);
        expect(campaign.campaignCards[id], id).toBe(scenario.campaignCard);
        expect(byCode.get(scenario.campaignCard)?.type, id).toBe("campaign");
      }
    }
  });

  it("numbers each box's scenarios in order within the box", () => {
    expect(["passage-through-mirkwood", "journey-along-the-anduin", "escape-from-dol-guldur"].map((id) => loadScenario(id).number)).toEqual([1, 2, 3]);
    expect(["the-oath", "the-caves-of-nibin-dum"].map((id) => loadScenario(id).number)).toEqual([1, 2]);
  });

  // Pins: the printed Normal deck of each scenario, with the Setup moves written down from the quest card's Setup (the ledger),
  // re-derived from Hall of Beorn's Normal quantities. The encounter deck at Normal and Easy is what encounterCodes deals.
  const DECK = {
    "passage-through-mirkwood": { normal: 34, easy: 25, staging: ["01096", "01099"], setAside: [] },
    "journey-along-the-anduin": { normal: 47, easy: 32, staging: [], setAside: [] },
    "escape-from-dol-guldur": { normal: 37, easy: 26, staging: ["01108", "01109", "01110"], setAside: ["01102"] },
    "the-oath": { normal: 31, easy: 23, staging: ["41010"], setAside: ["41019"] },
    "the-caves-of-nibin-dum": { normal: 33, easy: 25, staging: [], setAside: ["41027", "41028"] },
  } as const;

  it.each(Object.entries(DECK))("%s deals the encounter deck the quest card's Setup leaves", (id, pin) => {
    const scenario = loadScenario(id);
    expect(encounterCodes(scenario)).toHaveLength(pin.normal);
    expect(encounterCodes(scenario, "Easy")).toHaveLength(pin.easy);
    expect(scenario.cards.filter((card) => card.pile === "staging").map((card) => card.code).sort()).toEqual([...pin.staging]);
    expect(scenario.cards.filter((card) => card.pile === "setAside").map((card) => card.code).sort()).toEqual([...pin.setAside]);
    expect(scenario.source.dragnNormal).toBeNull();
  });

  it("sets Cave Torch aside for the first player to attach, and Valor, Scarred and the boons to the campaign card", () => {
    expect(loadScenario("the-caves-of-nibin-dum").cards.find((card) => card.code === "41029")?.pile).toBe("attachedChosen");
    expect(loadScenario("journey-along-the-anduin").campaignPlaced).toEqual(["01133", "01135", "01138"]);
    expect(loadScenario("the-oath").campaignPlaced).toEqual(["41041", "41043", "41044", "41045", "41046", "41047"]);
    expect(loadScenario("the-caves-of-nibin-dum").campaignPlaced).toEqual(["41042", "41048", "41049"]);
  });
});

// Dream-chaser (docs/plans/dream-chaser.md, phase 37): built from the seven original sets and the Dream-chaser Campaign Expansion. The
// DragnCards Q06 load lists lead the piles; the booklet's paragraph and the printed Setup are the checks.
describe("Dream-chaser campaign", () => {
  const campaign = loadCampaign("dream-chaser");
  const DECK = {
    "voyage-across-belegaer": { normal: 27, easy: 19, corsair: 9, staging: ["11022", "11051", "11084"], setAside: ["110138", "110139", "11080", "11081", "11082", "11083"] },
    "the-fate-of-numenor": { normal: 24, easy: 17, unchartedDeck: 10, staging: [], setAside: ["11027", "11028"] },
    "raid-on-the-grey-havens": { normal: 30, easy: 21, staging: ["11038", "11039", "11041"], setAside: ["11076", "11078"] },
    "flight-of-the-stormcaller": { normal: 31, easy: 23, corsair: 13, stormcallerQuests: 3, staging: ["11051"], setAside: ["110138", "110139", "11080", "11081", "11082", "11083", "11084", "12019"] },
    "the-thing-in-the-depths": { normal: 20, easy: 13, encounterDeck2: 18, staging: ["11064", "12042"], setAside: ["11076", "11078", "12049"] },
    "temple-of-the-deceived": { normal: 32, easy: 25, islandMap: 15, staging: ["12070"], setAside: ["11077", "11079", "12071"] },
    "the-drowned-ruins": { normal: 30, easy: 21, grottoDeck: 8, staging: [], setAside: ["11077", "11079", "12094"] },
    "a-storm-on-cobas-haven": { normal: 37, easy: 27, corsair: 16, staging: ["11022", "12124"], setAside: ["110138", "110139", "11080", "11081", "11082", "11083", "11084", "12123"] },
    "the-city-of-corsairs": { normal: 32, easy: 22, corsair: 10, encounterDeck2: 17, staging: ["12151", "12154"], setAside: ["110138", "110139", "11080", "11081", "11082", "11083", "11084"] },
  } as const;
  const copies = (id: string, pile: string): number => loadScenario(id).cards.filter((card) => card.pile === pile).reduce((sum, card) => sum + card.normal, 0);

  it("builds all nine scenarios in play order, each with its campaign card, and deals only cards data/cards has", () => {
    expect(campaign.scenarios).toEqual(Object.keys(DECK));
    expect(() => loadScenarioDefinitions(new URL("../../data/", import.meta.url).pathname, byCode, [], "dream-chaser")).not.toThrow();
    for (const id of campaign.scenarios) {
      const scenario = loadScenario(id);
      expect(campaign.campaignCards[id], id).toBe(scenario.campaignCard);
      expect(byCode.get(scenario.campaignCard)?.type, id).toBe("campaign");
      expect(scenario.source.dragnNormal, id).toMatch(/^Q06\.\d$/);
      expect(scenario.source.dragnEasy, id).toMatch(/^E06\.\d$/);
      expect(scenario.cards.some((card) => byCode.get(card.code)?.printings.some((printing) => printing.pack === "Nightmare")), `${id} deals no Nightmare card`).toBe(false);
    }
    expect(campaign.scenarios.map((id) => loadScenario(id).number)).toEqual([1, 2, 3, 1, 2, 3, 4, 5, 6]);
  });

  it.each(Object.entries(DECK))("%s deals the encounter deck, the extra decks and the Setup piles the load list and the printed Setup leave", (id, pin) => {
    const scenario = loadScenario(id);
    expect(encounterCodes(scenario)).toHaveLength(pin.normal);
    expect(encounterCodes(scenario, "Easy")).toHaveLength(pin.easy);
    expect(scenario.cards.filter((card) => card.pile === "staging").map((card) => card.code).sort()).toEqual([...pin.staging]);
    expect(scenario.cards.filter((card) => card.pile === "setAside").map((card) => card.code).sort()).toEqual([...pin.setAside]);
    expect(copies(id, "corsairDeck")).toBe("corsair" in pin ? pin.corsair : 0);
    expect(copies(id, "encounterDeck2")).toBe("encounterDeck2" in pin ? pin.encounterDeck2 : 0);
    expect(copies(id, "unchartedDeck")).toBe("unchartedDeck" in pin ? pin.unchartedDeck : 0);
    expect(copies(id, "islandMap")).toBe("islandMap" in pin ? pin.islandMap : 0);
    expect(copies(id, "grottoDeck")).toBe("grottoDeck" in pin ? pin.grottoDeck : 0);
    expect(copies(id, "stormcallerQuests")).toBe("stormcallerQuests" in pin ? pin.stormcallerQuests : 0);
  });

  it("keeps the Stormcaller's stages 2C to 4C out of the quest deck, and Nightmare quest cards out of every scenario", () => {
    expect(loadScenario("flight-of-the-stormcaller").stages).toEqual(["12012", "12013", "12014", "12015"]);
    expect(loadScenario("flight-of-the-stormcaller").cards.filter((card) => card.pile === "stormcallerQuests").map((card) => card.code)).toEqual(["12016", "12017", "12018"]);
    expect(loadScenario("voyage-across-belegaer").stages).toEqual(["11016", "11017", "11018", "11019", "11020", "11021"]);
    expect(loadScenario("raid-on-the-grey-havens").stages).toEqual(["11036", "11037"]);
  });

  it("names the encounter sets the booklet's paragraph names, in its order", () => {
    expect(loadScenario("voyage-across-belegaer").encounterSets.map((set) => set.name)).toEqual(["Voyage Across Belegaer", "Vast Oceans", "Stormy Weather", "Umbar Fleet", "Corsair Pirates", "The Dream-chaser's Fleet"]);
    expect(loadScenario("the-city-of-corsairs").encounterSets.map((set) => set.name)).toEqual(["The City of Corsairs", "Coast of Umbar", "Stormy Weather", "Umbar Fleet", "Voyage Across Belegaer", "Corsair Raiders", "The Dream-chaser's Fleet"]);
    expect(loadScenario("the-thing-in-the-depths").encounterSets.map((set) => set.name)).toEqual(["The Thing in the Depths", "The Stormcaller", "Corsair Raiders", "The Stormcaller Elite"]);
  });

  it("stages the copies a Setup says by player count (Rolling Seas in Flight of the Stormcaller, Southern Belfalas in The City of Corsairs)", () => {
    expect(loadScenario("flight-of-the-stormcaller").cards.find((card) => card.code === "11051" && card.pile === "staging")?.byPlayers).toEqual({ few: 1, many: 2, from: 3 });
    expect(loadScenario("the-city-of-corsairs").cards.find((card) => card.code === "12154")?.byPlayers).toEqual({ few: 1, many: 2, from: 3 });
    const flight = loadScenario("flight-of-the-stormcaller");
    expect(encounterCodes(flight, "Normal", 1).filter((code) => code === "11051")).toHaveLength(1 + 1);
    expect(encounterCodes(flight, "Normal", 3).filter((code) => code === "11051")).toHaveLength(1);
  });

  it("stages 1 copy of Sahír's Ravager in Raid on the Grey Havens and leaves the others in the encounter deck, in Normal and Easy", () => {
    const raid = loadScenario("raid-on-the-grey-havens");
    expect(raid.cards.filter((card) => card.code === "11041").map((card) => [card.pile, card.normal, card.easy])).toEqual([["encounter", 2, 0], ["staging", 1, 1]]);
    expect(encounterCodes(raid).filter((code) => code === "11041")).toHaveLength(2);
    expect(encounterCodes(raid, "Easy").filter((code) => code === "11041")).toHaveLength(0);
  });

  it("deals the Grotto deck as three Undersea Grotto, three Cursed Caverns and two Water-logged Halls, each paired with its own Underwater side", () => {
    const grotto = loadScenario("the-drowned-ruins").cards.filter((card) => card.pile === "grottoDeck");
    const faceups = new Map<string, number>();
    for (const card of grotto) faceups.set(byCode.get(card.code)?.name ?? "", (faceups.get(byCode.get(card.code)?.name ?? "") ?? 0) + card.normal);
    expect([...faceups]).toEqual([["Undersea Grotto", 3], ["Cursed Caverns", 3], ["Water-logged Halls", 2]]);
    expect(grotto.every((card) => byCode.get(card.code)?.traits.includes("Grotto") && byCode.get(card.back ?? "")?.traits.includes("Underwater"))).toBe(true);
    // The pairings of dcce.grotto-deck: Dragncards' Q06.7 lines.
    expect(grotto.map((card) => `${byCode.get(card.code)?.name}/${byCode.get(card.back ?? "")?.name} ${card.normal}`).sort()).toEqual([
      "Cursed Caverns/Sunken Temple 1",
      "Cursed Caverns/Twisting Hollow 2",
      "Undersea Grotto/Dark Abyss 2",
      "Undersea Grotto/Twisting Hollow 1",
      "Water-logged Halls/Dark Abyss 1",
      "Water-logged Halls/Sunken Temple 1",
    ]);
    expect(loadScenario("the-drowned-ruins").cards.find((card) => card.code === "12094")?.back).toBe("12095");
  });

  it("deals each Stormcaller Elite card as one two-sided card, the side the Setup names faceup", () => {
    const sides = (id: string) => loadScenario(id).cards.filter((card) => card.pile === "setAside" && byCode.get(card.code)?.encounterSet === "The Stormcaller Elite").map((card) => `${card.code}/${card.back}`);
    // Enemy side faceup (stage 1A names it, Raid on the Grey Havens' stage 2A adds them as enemies); objective-ally sides faceup.
    expect(sides("raid-on-the-grey-havens")).toEqual(["11076/11077", "11078/11079"]);
    expect(sides("the-thing-in-the-depths")).toEqual(["11076/11077", "11078/11079"]);
    expect(sides("temple-of-the-deceived")).toEqual(["11077/11076", "11079/11078"]);
    expect(sides("the-drowned-ruins")).toEqual(["11077/11076", "11079/11078"]);
  });

  it("deals all six ship-objectives of The Dream-chaser's Fleet wherever the Setup prepares the fleet", () => {
    for (const id of ["voyage-across-belegaer", "flight-of-the-stormcaller", "a-storm-on-cobas-haven", "the-city-of-corsairs"]) {
      const ships = loadScenario(id).cards.filter((card) => card.pile === "setAside" && byCode.get(card.code)?.encounterSet === "The Dream-chaser's Fleet" && byCode.get(card.code)?.type === "ship-objective");
      expect(ships.map((card) => byCode.get(card.code)?.name).sort(), id).toEqual(["Dawn Star", "Dream-chaser", "Duskbringer", "Glórinaith", "Nárelenya", "Silver Wing"]);
      expect(ships.every((card) => card.normal === 1 && card.easy === 1), id).toBe(true);
    }
  });

  it("links each card the Campaign Expansion reprints to its reprint, which a campaign game deals", () => {
    expect(loadScenario("flight-of-the-stormcaller").reprints).toMatchObject({ "12019": "110042", "11080": "110136" });
    expect(loadScenario("the-thing-in-the-depths").reprints).toEqual({ "12049": "110063" });
    expect(loadScenario("the-city-of-corsairs").reprints).toMatchObject({ "12159": "110129" });
    // The Stormcaller of The City of Corsairs is the Coast of Umbar's card, which has no reprint.
    expect(loadScenario("the-city-of-corsairs").reprints?.["12151"]).toBeUndefined();
  });

  it("places the campaign cards' named cards: Círdan's Blessing, Calphon of Raid on the Grey Havens, the Black Keys and Sea Serpent of The Thing in the Depths", () => {
    for (const id of ["the-drowned-ruins", "a-storm-on-cobas-haven", "the-city-of-corsairs"]) expect(loadScenario(id).campaignPlaced, id).toEqual(expect.arrayContaining(["11205", "11206", "11207", "11208"]));
    expect(loadScenario("raid-on-the-grey-havens").campaignPlaced).toContain("11028");
    expect(loadScenario("the-thing-in-the-depths").campaignPlaced).toEqual(expect.arrayContaining(["11183", "11192", "11196"]));
  });

  it("deals the campaign cards' boons and burdens through the campaign, not the encounter deck", () => {
    expect(loadScenario("voyage-across-belegaer").campaignPlaced).toEqual(expect.arrayContaining(["11172", "11173", "11174", "11175", "11176", "11177", "11178"]));
    expect(loadScenario("the-fate-of-numenor").campaignPlaced).toEqual(expect.arrayContaining(["11180", "11181"]));
    expect(loadScenario("raid-on-the-grey-havens").campaignPlaced).toEqual(expect.arrayContaining(["11183", "11184", "11185", "11186", "11187", "11188", "11189", "11190"]));
  });
});
