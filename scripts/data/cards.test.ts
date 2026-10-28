import { describe, expect, it } from "vitest";

import { loadCards } from "./load-cards.ts";
import { parseKeywordTokens } from "./normalize/keywords.ts";
import { loadRaw } from "./normalize/load-raw.ts";
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
});
