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

// Dream-chaser (docs/scenarios/dream-chaser.md, Dream-chaser): built from the seven original sets and the Dream-chaser Campaign Expansion. The
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

  it("deals the four Send for Help cards, which only the booklet's campaign paragraph names (dcce.campaign-setup-a-storm-on-cobas-haven), in the last two parts and no earlier one", () => {
    const sendForHelp = ["11211", "11212", "11213", "11214"];
    for (const id of ["a-storm-on-cobas-haven", "the-city-of-corsairs"]) expect(loadScenario(id).campaignPlaced, id).toEqual(expect.arrayContaining(sendForHelp));
    for (const id of ["voyage-across-belegaer", "the-fate-of-numenor", "raid-on-the-grey-havens", "flight-of-the-stormcaller", "the-thing-in-the-depths", "temple-of-the-deceived", "the-drowned-ruins"]) {
      expect(loadScenario(id).campaignPlaced.filter((code) => sendForHelp.includes(code)), id).toEqual([]);
    }
  });

  it("deals the campaign cards' boons and burdens through the campaign, not the encounter deck", () => {
    expect(loadScenario("voyage-across-belegaer").campaignPlaced).toEqual(expect.arrayContaining(["11172", "11173", "11174", "11175", "11176", "11177", "11178"]));
    expect(loadScenario("the-fate-of-numenor").campaignPlaced).toEqual(expect.arrayContaining(["11180", "11181"]));
    expect(loadScenario("raid-on-the-grey-havens").campaignPlaced).toEqual(expect.arrayContaining(["11183", "11184", "11185", "11186", "11187", "11188", "11189", "11190"]));
  });
});

// Ered Mithrin (docs/scenarios/ered-mithrin.md, Ered Mithrin): built from The Wilds of Rhovanion, the six Adventure Packs and the Ered Mithrin Campaign Expansion.
// The DragnCards Q08 load lists lead the piles, the first two scenarios deal the Revised Core Set's reprints of the Core Set sets they load
// (overrides.dragnPackAliases), and the booklet's paragraph (emce.setup-<id>) and the printed Setup are the checks.
describe("Ered Mithrin campaign", () => {
  const campaign = loadCampaign("ered-mithrin");
  const DECK = {
    "journey-up-the-anduin": { normal: 35, easy: 22, staging: [], setAside: ["18016", "18069"], evil: 8 },
    "lost-in-mirkwood": { normal: 32, easy: 24, staging: ["01096", "18028"], setAside: ["18070"], spiders: 12, orcs: 14 },
    "the-kings-quest": { normal: 35, easy: 25, staging: [], setAside: ["18042", "18043", "18058", "18059"], caves: 6 },
    "the-withered-heath": { normal: 37, easy: 26, staging: [], setAside: ["19011", "19012"], caves: 6 },
    "roam-across-rhovanion": { normal: 40, easy: 26, staging: [], setAside: ["19036", "19037", "19052", "19054"] },
    "fire-in-the-night": { normal: 37, easy: 23, staging: ["19074"], setAside: [], side: 8 },
    "the-ghost-of-framsburg": { normal: 41, easy: 29, staging: ["19101", "19102", "19103", "19104", "19105"], setAside: ["19097"] },
    "mount-gundabad": { normal: 41, easy: 28, staging: ["19125"], setAside: ["19122"], caves: 8 },
    "the-fate-of-wilderland": { normal: 43, easy: 30, staging: ["19155", "19156", "19157"], setAside: [] },
  } as const;
  const copies = (id: string, pile: string): number => loadScenario(id).cards.filter((card) => card.pile === pile).reduce((sum, card) => sum + card.normal, 0);

  it("builds all nine scenarios in play order, each with its campaign card, and deals only cards data/cards has", () => {
    expect(campaign.scenarios).toEqual(Object.keys(DECK));
    expect(() => loadScenarioDefinitions(new URL("../../data/", import.meta.url).pathname, byCode, [], "ered-mithrin")).not.toThrow();
    for (const id of campaign.scenarios) {
      const scenario = loadScenario(id);
      expect(campaign.campaignCards[id], id).toBe(scenario.campaignCard);
      expect(byCode.get(scenario.campaignCard)?.type, id).toBe("campaign");
      expect(scenario.source.dragnNormal, id).toMatch(/^Q08\.\d$/);
      expect(scenario.source.dragnEasy, id).toMatch(/^E08\.\d$/);
      expect(scenario.cards.some((card) => byCode.get(card.code)?.printings.some((printing) => printing.pack === "Nightmare")), `${id} deals no Nightmare card`).toBe(false);
    }
    expect(campaign.campaignCards).toMatchObject({ "journey-up-the-anduin": "120165", "lost-in-mirkwood": "12168", "the-fate-of-wilderland": "12195" });
    expect(campaign.saga).toBe(false);
    expect(campaign.xp).toBeUndefined();
    expect(campaign.bookletId).toBe("ered-mithrin");
  });

  it.each(Object.entries(DECK))("%s deals the encounter deck, the extra decks and the Setup piles the load list and the printed Setup leave", (id, pin) => {
    const scenario = loadScenario(id);
    expect(encounterCodes(scenario)).toHaveLength(pin.normal);
    expect(encounterCodes(scenario, "Easy")).toHaveLength(pin.easy);
    expect(scenario.cards.filter((card) => card.pile === "staging").map((card) => card.code).sort()).toEqual([...pin.staging]);
    expect(scenario.cards.filter((card) => card.pile === "setAside").map((card) => card.code).sort()).toEqual([...pin.setAside]);
    expect(copies(id, "evilCreaturesDeck")).toBe("evil" in pin ? pin.evil : 0);
    expect(copies(id, "cavesDeck")).toBe("caves" in pin ? pin.caves : 0);
    expect(copies(id, "sideQuestDeck")).toBe("side" in pin ? pin.side : 0);
    expect(copies(id, "spidersDeck")).toBe("spiders" in pin ? pin.spiders : 0);
    expect(copies(id, "orcsDeck")).toBe("orcs" in pin ? pin.orcs : 0);
  });

  it("names the encounter sets the booklet's paragraph names, in its order, with the core sets' names as the cards print them", () => {
    expect(loadScenario("journey-up-the-anduin").encounterSets.map((set) => set.name)).toEqual(["Journey up the Anduin", "Grey Mountain Goblins", "Hills of Wilderland", "Lost in Wilderland", "Journey Along the Anduin", "Wilderlands"]);
    expect(loadScenario("lost-in-mirkwood").encounterSets.map((set) => set.name)).toEqual(["Lost in Mirkwood", "Dark Woods", "Gathering Gloom", "Passage Through Mirkwood", "Spiders of Mirkwood", "Dol Guldur Orcs"]);
    expect(loadScenario("mount-gundabad").encounterSets.map((set) => set.name)).toEqual(["Mount Gundabad", "Fell Beasts", "Deep Underground", "Afraid of the Dark", "Lost Caves", "Dragon Might"]);
  });

  it("deals the Revised Core Set's reprints of the Core Set sets Journey Up the Anduin and Lost in Mirkwood load, with the Wilderlands enemies as the Evil Creatures deck", () => {
    const journey = loadScenario("journey-up-the-anduin");
    expect(journey.cards.filter((card) => card.pile === "evilCreaturesDeck").map((card) => byCode.get(card.code)?.name).sort()).toEqual(["Goblin Sniper", "Hill Troll", "Marsh Adder", "Wargs", "Wolf Rider"]);
    for (const card of journey.cards.filter((item) => item.pile === "encounter" || item.pile === "evilCreaturesDeck")) {
      const printed = byCode.get(card.code);
      if (/^01\d{3}$/.test(card.code)) expect(printed?.printings[0]?.pack, card.code).toBe("RevCore");
    }
    const mirkwood = loadScenario("lost-in-mirkwood");
    expect(mirkwood.cards.filter((card) => card.pile === "spidersDeck").every((card) => byCode.get(card.code)?.encounterSet === "Spiders of Mirkwood")).toBe(true);
    expect(mirkwood.cards.filter((card) => card.pile === "orcsDeck").every((card) => byCode.get(card.code)?.encounterSet === "Dol Guldur Orcs")).toBe(true);
    // Woodmen Village and Haldan are the two sides of one card: set aside together, Haldan is not a player card.
    expect(journey.cards.find((card) => card.code === "18069")).toMatchObject({ pile: "setAside", back: "18070" });
    // Lost in Mirkwood's Setup has the first player take control of Haldan: the same card, set aside Haldan faceup.
    expect(mirkwood.cards.find((card) => card.code === "18070")).toMatchObject({ pile: "setAside", back: "18069" });
  });

  it("deals Wormsbane to a hero at Setup, both sides, and keeps the Easy Mode counts Hall of Beorn gives where DragnCards' deck keeps more", () => {
    expect(loadScenario("mount-gundabad").cards.find((card) => card.code === "19143")).toMatchObject({ pile: "attachedChosen", back: "19144" });
    expect(loadScenario("the-ghost-of-framsburg").cards.find((card) => card.code === "19099")).toMatchObject({ normal: 2, easy: 1 });
  });

  it("deals the boons, burdens and allies each campaign card names, and no quest or objective it only mentions", () => {
    const placed = (id: string) => loadScenario(id).campaignPlaced.map((code) => byCode.get(code)?.name);
    expect(placed("journey-up-the-anduin")).toEqual(["Turayn", "A Growing Threat"]);
    expect(placed("the-kings-quest")).toEqual(["Isolde", "The Threat to Wilderland", "Dagnir's Spawn", "Abandoned Ruin"]);
    expect(placed("roam-across-rhovanion")).toEqual(["Urdug's Cunning", "Misplaced Trust"]);
    expect(placed("the-fate-of-wilderland")).toEqual([]);
    for (const id of campaign.scenarios) for (const code of loadScenario(id).campaignPlaced) expect(byCode.get(code)?.campaignKind, `${id} ${code}`).not.toBeNull();
  });
});
