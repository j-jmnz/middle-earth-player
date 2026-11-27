import { describe, expect, it } from "vitest";

import { loadCards } from "./load-cards.ts";
import { parseKeywordTokens } from "./normalize/keywords.ts";
import { loadRaw } from "./normalize/load-raw.ts";
import { traitKey } from "./normalize/cards.ts";
import { titleKey } from "./normalize/names.ts";

// The 26 dealt cards for A Shadow of the Past, as the MEC109 (The Fellowship of the Ring) printing prints them.
// Numbers, keywords, traits and the unique flag only. A mismatch means data/cards moved away from that reading.
type Row = {
  code: string;
  name: string;
  collector: number;
  unique: boolean;
  traits?: string;
  threat?: number;
  quest?: number;
  victory?: number;
  engagement?: number;
  keywords: Record<string, unknown>;
  // Printed timings on the card (granted text on an attached card is listed with the card that grants it).
  timings: readonly string[];
};

const CARDS: readonly Row[] = [
  { code: "141017", name: "Mr. Underhill", collector: 44, unique: true, traits: "Title.", victory: 1, keywords: { permanent: true }, timings: ["setup", "action"] },
  { code: "141022", name: "Three is Company", collector: 28, unique: false, quest: 1, keywords: {}, timings: ["setup", "triggered", "constant"] },
  { code: "141023", name: "A Shortcut to Mushrooms", collector: 29, unique: false, quest: 14, keywords: {}, timings: ["whenRevealed", "triggered", "constant"] },
  { code: "141024", name: "Escape to Buckland", collector: 30, unique: false, keywords: {}, timings: ["whenRevealed", "whenRevealed", "triggered", "response"] },
  { code: "141031", name: "Bag End", collector: 31, unique: true, traits: "Shire.", threat: 0, quest: 3, victory: 1, keywords: {}, timings: ["response"] },
  { code: "141032", name: "Woody End", collector: 32, unique: true, traits: "Forest.", threat: 1, quest: 1, victory: 1, keywords: {}, timings: ["constant"] },
  { code: "141033", name: "Stock-brook", collector: 33, unique: true, traits: "Forest. Stream.", threat: 1, quest: 5, victory: 1, keywords: {}, timings: ["whenRevealed"] },
  { code: "141034", name: "Bamfurlong", collector: 34, unique: true, traits: "Shire.", threat: 2, quest: 2, victory: 1, keywords: {}, timings: ["response"] },
  { code: "141035", name: "Bucklebury Ferry", collector: 35, unique: true, traits: "River.", threat: 3, quest: 9, keywords: { immune: true }, timings: ["constant", "travel", "questResolution"] },
  { code: "141036", name: "Green Hill Country", collector: 36, unique: false, traits: "Forest.", threat: 2, quest: 3, keywords: {}, timings: ["constant", "shadow"] },
  { code: "141037", name: "Stock Road", collector: 37, unique: false, traits: "Road.", threat: 3, quest: 3, keywords: {}, timings: ["constant", "travel"] },
  { code: "141038", name: "The Marish", collector: 38, unique: false, traits: "Marshland.", threat: 3, quest: 4, keywords: {}, timings: ["forced", "shadow"] },
  { code: "141039", name: "Black Rider", collector: 39, unique: false, traits: "Nazgûl.", threat: 4, engagement: 35, keywords: { hide: 2 }, timings: ["forced", "constant"] },
  { code: "141040", name: "Evil Crow", collector: 40, unique: false, traits: "Creature.", threat: 2, engagement: 25, keywords: {}, timings: ["constant", "shadow"] },
  { code: "141041", name: "Crawling Towards Him", collector: 41, unique: false, keywords: { peril: true, hide: 2 }, timings: ["whenRevealed", "shadow"] },
  { code: "141042", name: "Hunting for the Ring", collector: 42, unique: false, keywords: { doomed: 2 }, timings: ["whenRevealed"] },
  { code: "141043", name: "Have You Seen Baggins?", collector: 43, unique: false, keywords: { peril: true, surge: true }, timings: ["whenRevealed", "forced"] },
  { code: "141072", name: "Pathless Country", collector: 171, unique: false, traits: "Forest.", threat: 2, quest: 3, keywords: {}, timings: ["constant", "shadow"] },
  { code: "141073", name: "Piercing Cry", collector: 172, unique: false, keywords: { peril: true }, timings: ["whenRevealed", "shadow"] },
  { code: "141074", name: "Black Steed", collector: 173, unique: false, traits: "Morgul.", keywords: { surge: true }, timings: ["whenRevealed", "forced", "constant"] },
  { code: "141075", name: "Rode Like a Gale", collector: 174, unique: false, keywords: {}, timings: ["whenRevealed", "shadow"] },
  { code: "141076", name: "Lure of the Ring", collector: 175, unique: false, keywords: { surge: true }, timings: ["whenRevealed", "shadow"] },
  { code: "141077", name: "Gildor Inglorion", collector: 45, unique: true, traits: "Noldor.", keywords: {}, timings: ["whenRevealed", "forced"] },
  { code: "141078", name: "Gandalf's Delay", collector: 46, unique: false, keywords: {}, timings: ["setup", "setup"] },
  { code: "141079", name: "The Ring Draws Them", collector: 47, unique: false, keywords: { surge: true }, timings: ["whenRevealed"] },
  { code: "141085", name: "The One Ring", collector: 166, unique: true, traits: "Artifact. Item. Ring.", keywords: { leavesPlayLoses: true }, timings: ["setup", "constant", "forced"] },
];


const cards = new Map(loadCards().map((card) => [card.code, card]));

describe("MEC109 reading of the dealt cards", () => {
  it("covers the 26 dealt cards", () => {
    expect(CARDS).toHaveLength(26);
  });

  it("matches data/cards: name, unique, traits, numbers, engagement, keywords", () => {
    for (const expected of CARDS) {
      const card = cards.get(expected.code);
      expect(card, expected.code).toBeDefined();
      expect(card?.isUnique, `${expected.code} unique`).toBe(expected.unique);
      expect(card?.threat ?? undefined, `${expected.code} threat`).toBe(expected.threat);
      expect(card?.victory ?? undefined, `${expected.code} victory`).toBe(expected.victory);
      expect(card?.engagementCost ?? undefined, `${expected.code} engagement`).toBe(expected.engagement);
      expect(card?.traits.length ? `${card.traits.join(". ")}.` : undefined, `${expected.code} traits`).toBe(expected.traits);
      expect(card?.keywords, `${expected.code} keywords`).toEqual(expected.keywords);
      expect(card?.printings.some((printing) => printing.pack === "TFotR" && printing.number === expected.collector), `${expected.code} MEC109 #${expected.collector}`).toBe(true);
    }
  });

  it("takes quest points from side B for quests and from the front for locations", () => {
    for (const expected of CARDS.filter((card) => card.quest !== undefined)) {
      expect(cards.get(expected.code)?.questPoints, expected.code).toBe(expected.quest);
    }
  });
});

// Hall of Beorn gives Nightmare, campaign and hero-expansion cards the codes of their cycle (02004 is Winged Guardian
// and also Forest Flies), so a code alone does not find a deck-legal card's record.
describe("Hall of Beorn records of deck-legal cards", () => {
  const hob = new Map(loadRaw().hob.map((card) => [card.Slug, card]));
  const legal = [...cards.values()].filter((card) => card.deckLegal);

  it("are the same card", () => {
    const wrong = legal.flatMap((card) =>
      card.printings.flatMap((printing) => (printing.hobSlug && titleKey(hob.get(printing.hobSlug)?.Title ?? "") !== titleKey(card.name) ? [`${card.code} ${card.name}: ${printing.hobSlug}`] : [])),
    );
    expect(wrong).toEqual([]);
  });

  it("give a side B only to a card whose text says Side A, and a shadow only to Wind from the Sea (Encounter)", () => {
    expect(legal.filter((card) => card.back && !/\bSide A\b/.test(card.text ?? "")).map((card) => card.code)).toEqual([]);
    expect(legal.filter((card) => card.shadowText).map((card) => card.code)).toEqual(["17144"]);
  });
});

describe("parseKeywordTokens", () => {
  it("reads numbered and flag keywords and reports the rest", () => {
    expect(parseKeywordTokens(["Hide 2.", "Surge.", "Immune to player card effects.", "Restricted.", "Encounter."])).toEqual({
      keywords: { hide: 2, surge: true, immune: true, restricted: true },
      unknown: ["Encounter"],
    });
  });

  // Rules: dcce.grapple. Hall of Beorn spaces the parentheses: "Grapple ( highest printed Threat )."
  it("reads Grapple (highest or lowest printed Threat or quest points), also with the spaces Hall of Beorn prints", () => {
    expect(parseKeywordTokens(["Grapple ( highest printed Threat )."]).keywords).toEqual({ grapple: "highestThreat" });
    expect(parseKeywordTokens(["Grapple (lowest printed Threat)."]).keywords).toEqual({ grapple: "lowestThreat" });
    expect(parseKeywordTokens(["Surge. Grapple ( highest printed quest points )"]).keywords).toEqual({ surge: true, grapple: "highestQuestPoints" });
    expect(parseKeywordTokens(["Grapple ( lowest printed quest points )."]).keywords).toEqual({ grapple: "lowestQuestPoints" });
    // The Nightmare arm's criterion is not a printed Threat or quest points: it stays unread.
    expect(parseKeywordTokens(["Grapple (fewest enemies grappled)."])).toEqual({ keywords: {}, unknown: ["Grapple (fewest enemies grappled)"] });
  });

  it("the arms of The Thing in the Depths carry the keyword, and no other card of the scenario does", () => {
    const grapples = [...cards.values()].filter((card) => card.keywords?.grapple != null).map((card) => [card.code, card.keywords?.grapple]);
    expect(grapples).toEqual([["12051", "lowestThreat"], ["12052", "highestQuestPoints"], ["12053", "highestThreat"], ["12054", "lowestQuestPoints"]]);
  });

  it("splits two keywords joined in one entry", () => {
    expect(parseKeywordTokens(["Peril. Toughness 1"]).keywords).toEqual({ peril: true, toughness: 1 });
  });
});

// The Revised Core Set and The Dark of Mirkwood (Mirkwood Paths, phase 27): their scenario, quest and campaign cards come from
// Hall of Beorn alone, by CardSet. Hall of Beorn's encounter-set names end " (Campaign)", which the build drops.
describe("Mirkwood Paths cards", () => {
  const all = [...cards.values()];
  const range = (from: number, to: number, pad = 5) => Array.from({ length: to - from + 1 }, (_, at) => String(from + at).padStart(pad, "0"));

  it("holds every Revised Core Set encounter, quest, campaign, boon and burden card, 01074 to 01138, under the RevCore printing", () => {
    for (const code of range(1074, 1138)) {
      const card = cards.get(code);
      expect(card, code).toBeDefined();
      expect(card?.printings[0]?.pack, `${code} printing`).toBe("RevCore");
    }
    expect(cards.get("01121")?.name).toBe("A Chosen Path");
    expect(cards.get("01122")?.name).toBe("A Chosen Path");
    expect(cards.get("01129")?.type).toBe("campaign");
    expect(cards.get("01135")?.typeName).toBe("Objective Ally");
    expect(cards.get("01136")).toMatchObject({ campaignKind: "burden", burdenSet: "Passage Through Mirkwood", encounterSet: "Passage Through Mirkwood" });
    // Stalking Goblin's printed Threat 2 and engagement cost 10 (the scan; Hall of Beorn has neither) come from an override.
    expect(cards.get("41041")).toMatchObject({ campaignKind: "burden", type: "enemy", threat: 2, engagementCost: 10, attack: 2, defense: 2, health: 2 });
    expect(cards.get("01136")).toMatchObject({ campaignKind: "burden", type: "enemy", threat: 3, engagementCost: 33, attack: 2, defense: 2, health: 5 });
  });

  it("codes The Dark of Mirkwood 410 and the collector number, as RingsDB does for its burdens and boons", () => {
    for (const number of range(1, 51, 2)) {
      const code = `410${number}`;
      const card = cards.get(code);
      expect(card, code).toBeDefined();
      expect(card?.printings[0], code).toMatchObject({ pack: "TDoM", number: Number(number) });
    }
    expect(cards.get("41041")).toMatchObject({ name: "Stalking Goblin", campaignKind: "burden" });
    expect(cards.get("41001")?.name).toBe("After the Raid");
    expect(cards.get("41050")?.type).toBe("campaign");
    // The Hunt for Gollum keeps its own 020NN codes: Hall of Beorn's 02004 is not The Dark of Mirkwood's The Dark of Nibin-Dûm.
    expect(cards.get("02004")?.name).not.toBe("The Dark of Nibin-Dûm");
  });

  it("names encounter sets without the campaign-edition suffix, and builds no Nightmare set", () => {
    expect(all.filter((card) => /\(Campaign\)/.test(`${card.encounterSet ?? ""}${card.burdenSet ?? ""}`)).map((card) => card.code)).toEqual([]);
    const mirkwood = all.filter((card) => card.printings.some((printing) => printing.pack === "RevCore" || printing.pack === "TDoM"));
    expect(mirkwood.filter((card) => /Nightmare/.test(card.encounterSet ?? "")).map((card) => card.code)).toEqual([]);
    expect(cards.get("01074")?.encounterSet).toBe("Spiders of Mirkwood");
    expect(cards.get("41008")?.encounterSet).toBe("The Oath");
  });

  // Dream-chaser (phase 37).
  it("codes the Dream-chaser Campaign Expansion 11 and the collector number from 171 on, 110 and the collector number below it", () => {
    // RingsDB's own codes for the boons and burdens, and the same pattern for the campaign cards it does not list.
    expect(cards.get("11171")).toMatchObject({ name: "Voyage Across Belegaer", type: "campaign" });
    expect(cards.get("11172")).toMatchObject({ name: "Armor Plating", campaignKind: "boon", type: "attachment" });
    expect(cards.get("11215")).toMatchObject({ name: "The City of Corsairs", type: "campaign" });
    expect(cards.get("11217")).toMatchObject({ name: "Hard Mode", type: "objective" });
    // The 2023 reprints of Adventure Pack cards take 110 and their number: the packs keep 12019 (the Stormcaller) and 11080 (the Dream-chaser).
    expect(cards.get("110042")).toMatchObject({ name: "Stormcaller", type: "ship-enemy" });
    expect(cards.get("110042")?.printings[0]).toMatchObject({ pack: "DCCE", number: 42 });
    expect(cards.get("12019")).toMatchObject({ name: "Stormcaller", type: "ship-enemy" });
    expect(cards.get("12019")?.printings[0]).toMatchObject({ pack: "FotS" });
    expect(cards.get("110136")?.name).toBe("Dream-chaser");
    expect(cards.get("11080")).toMatchObject({ name: "Dream-chaser", type: "ship-objective", typeName: "Ship-objective", encounterSet: "The Dream-chaser's Fleet" });
    // Ered Mithrin keeps 12166 to 12204: the Expansion's Hall of Beorn codes (12171 and the rest) are not built.
    expect(cards.get("12171")?.printings[0]?.pack).toBe("EMCE");
    expect(cards.get("12166")?.printings[0]?.pack).toBe("EMCE");
  });

  it("folds the two Hall of Beorn rows of a two-sided Expansion card into one card with a back", () => {
    expect(cards.get("110042")?.text).toContain("Boarding 2");
    expect(cards.get("110042")?.back?.text).toContain("Campaign Mode only.");
    expect(cards.get("110136")?.back?.text).toContain("counts as 3 characters");
    expect(cards.get("11172")?.back?.text).toContain("discard 1 shadow card from another enemy");
    expect(cards.get("11196")?.back?.text).toContain("makes an attack against the first player");
    expect(cards.get("11217")?.back?.text).toContain("Gain 2 XP");
    expect(all.filter((card) => /^Dream-chaser Campaign Expansion$/.test(card.printings[0]?.pack ?? "") && card.printings.length > 1)).toEqual([]);
  });

  it("types the boons and burdens by their type bar, and merges them with RingsDB's treasure rows", () => {
    expect(cards.get("11177")).toMatchObject({ campaignKind: "burden", type: "ship-enemy", deckLegal: false });
    expect(cards.get("11176")).toMatchObject({ campaignKind: "burden", type: "treachery", burdenSet: "Voyage Across Belegaer" });
    expect(cards.get("11193")).toMatchObject({ campaignKind: "boon", type: "objective", typeName: "Objective Ally" });
    expect(cards.get("11184")).toMatchObject({ campaignKind: "boon", type: "event", deckLegal: false });
    expect(all.filter((card) => card.printings.some((printing) => printing.pack === "DCCE") && card.type === "treasure")).toEqual([]);
    expect(all.filter((card) => card.printings.some((printing) => printing.pack === "DCCE") && card.campaignKind != null)).toHaveLength(37);
  });

  it("names the Expansion's encounter sets without the Campaign suffix", () => {
    const dream = all.filter((card) => card.printings.some((printing) => printing.pack === "DCCE"));
    expect(dream.filter((card) => / Campaign$/.test(`${card.encounterSet ?? ""}${card.burdenSet ?? ""}`)).map((card) => card.code)).toEqual([]);
    expect(cards.get("11188")).toMatchObject({ burdenSet: "Raid on the Grey Havens", encounterSet: "Raid on the Grey Havens" });
  });

  // Ered Mithrin (phase 49).
  it("codes the Ered Mithrin Campaign Expansion 12 and the collector number from 166 on, 120 and the collector number below it", () => {
    // RingsDB's own codes for the 31 boons, burdens and treasures, and the same pattern for the eight campaign cards it does not list.
    expect(cards.get("12168")).toMatchObject({ name: "Lost in Mirkwood", type: "campaign" });
    expect(cards.get("12195")).toMatchObject({ name: "The Fate of Wilderland", type: "campaign" });
    // 12165 is Fury and Malice of The City of Corsairs: the Journey Up the Anduin campaign card (number 165 in Hall of Beorn and RingsDB, 164 on the scan) takes the unused 120 prefix.
    expect(cards.get("12165")).toMatchObject({ name: "Fury and Malice" });
    expect(cards.get("12165")?.printings[0]?.pack).toBe("CoC");
    expect(cards.get("120165")).toMatchObject({ name: "Journey Up the Anduin", type: "campaign" });
    expect(cards.get("120165")?.printings[0]).toMatchObject({ pack: "EMCE", number: 165 });
    // Hall of Beorn's 19165 to 19170 are The Fate of Wilderland's own cards.
    expect(cards.get("19165")).toMatchObject({ name: "Fierce Attack" });
    expect(cards.get("19165")?.printings[0]?.pack).toBe("TFoW");
    expect(all.filter((card) => card.printings.some((printing) => printing.pack === "EMCE"))).toHaveLength(40);
  });

  it("types the Expansion's boons, burdens and treasures by their type bar and keeps treasures out of the card pool", () => {
    expect(cards.get("12166")).toMatchObject({ name: "Turayn", campaignKind: "boon", type: "ally", deckLegal: false, backType: "player" });
    expect(cards.get("12176")).toMatchObject({ name: "Master of the Hunt", campaignKind: "boon", type: "attachment" });
    expect(cards.get("12190")).toMatchObject({ name: "Ashen Brazier", campaignKind: "boon", type: "objective" });
    expect(cards.get("12167")).toMatchObject({ name: "A Growing Threat", campaignKind: "burden", type: "treachery", burdenSet: "Journey up the Anduin", backType: "encounter" });
    expect(cards.get("12173")).toMatchObject({ name: "Dagnir's Spawn", campaignKind: "burden", type: "enemy", burdenSet: "The King's Quest" });
    for (const code of ["12196", "12197", "12198", "12199", "12200", "12201", "12202", "12203", "12204"]) {
      expect(cards.get(code), code).toMatchObject({ campaignKind: "treasure", type: "treasure", typeName: "Treasure", deckLegal: false, backType: "player" });
    }
    expect(all.filter((card) => card.printings.some((printing) => printing.pack === "EMCE") && card.campaignKind != null)).toHaveLength(31);
    // The Hobbit saga's Treasure rows (Sting) are RingsDB's "treasure / Campaign" cards and stay as they were.
    expect(cards.get("131020")).toMatchObject({ name: "Sting", type: "treasure", typeName: "Campaign", campaignKind: null });
  });

  it("reads the keyword sentences that open a ledger line as keywords of the Ered Mithrin boxes' cards (Hall of Beorn lists Immune to player card effects as text only)", () => {
    expect(cards.get("18016")?.keywords).toMatchObject({ immune: true });
    expect(cards.get("19053")?.keywords).toMatchObject({ indestructible: true, immune: true });
    expect(cards.get("19074")?.keywords).toMatchObject({ immune: true });
    expect(cards.get("18020")?.keywords).not.toMatchObject({ immune: true });
  });

  it("reads \"Immune to player card effects\" that opens a line of a card's text as the keyword in every pack (Hall of Beorn lists it as text only), and only then", () => {
    // A location of an adventure pack with a ledger, an enemy and a location of a box with no ledger entry, an objective ally and an enemy of the saga and standalone boxes.
    for (const code of ["17068", "21030", "21047", "17145", "50204", "145068", "17015"]) expect(cards.get(code)?.keywords, code).toMatchObject({ immune: true });
    expect(cards.get("17015")?.keywords).toMatchObject({ indestructible: true, immune: true });
    // A card whose text names the keyword without opening a line with it does not have it (the Immune of "Immune to non-Fellowship player card effects" is its own thing).
    expect(cards.get("17069")?.keywords).not.toMatchObject({ immune: true });
    expect(cards.get("144075")?.keywords).not.toMatchObject({ immune: true });
  });

  it("types an objective-location, names the Expansion's encounter sets without the Campaign suffix, and gives the side quests Fire in the Night's set", () => {
    expect(cards.get("18029")).toMatchObject({ name: "Overgrown Path", type: "objective", typeName: "Objective Location" });
    expect(cards.get("18016")).toMatchObject({ name: "The Old Ford", type: "location" });
    expect(cards.get("12185")).toMatchObject({ burdenSet: "Roam Across Rhovanion", encounterSet: "Roam Across Rhovanion" });
    expect(all.filter((card) => card.printings.some((printing) => printing.pack === "EMCE") && / Campaign$/.test(`${card.encounterSet ?? ""}${card.burdenSet ?? ""}`))).toEqual([]);
    for (const code of ["19066", "19067", "19068", "19069", "19070", "19071", "19072", "19073"]) {
      expect(cards.get(code), code).toMatchObject({ type: "encounter-side-quest", encounterSet: "Fire in the Night" });
    }
  });
});

// A trait check compares spellings exactly, so a trait two sources spell two ways ("Dunedain", "Dúnedain") would miss the cards of one.
describe("trait spellings", () => {
  it("spells each trait one way", () => {
    const spellings = new Map<string, Set<string>>();
    for (const card of cards.values()) for (const trait of card.traits) spellings.set(traitKey(trait), (spellings.get(traitKey(trait)) ?? new Set()).add(trait));
    expect([...spellings.values()].filter((set) => set.size > 1).map((set) => [...set])).toEqual([]);
  });

  it("gives Thurindir the Dúnedain trait (issue 121)", () => {
    expect(cards.get("17028")?.traits).toEqual(["Dúnedain", "Ranger"]);
  });
});
