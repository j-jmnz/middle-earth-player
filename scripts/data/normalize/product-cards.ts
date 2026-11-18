import type { Card } from "../../../src/catalog/card-facts.ts";
import { CAMPAIGN_SUFFIX, PRODUCTS } from "../campaign-defs.ts";
import { NIGHTMARE_PACK, NIGHTMARE_SETS, nightmareCode } from "../nightmare-defs.ts";
import type { HobCard } from "../sources/hallofbeorn.ts";
import type { Overrides } from "./cards.ts";
import type { RawData } from "./load-raw.ts";
import { titleKey } from "./names.ts";

// The boxes whose encounter, quest and campaign cards RingsDB does not carry (Hall of Beorn is their only source), each with the
// RingsDB pack it is printed in (PRODUCTS: the products with no twin pack). A product's cards are taken by CardSet, so its
// Nightmare sets stay out.
const PRODUCT_PACK: ReadonlyMap<string, string> = new Map(PRODUCTS.flatMap((product) => (product.twinPack === null ? [[product.name, product.packs[0] ?? ""] as const] : [])));

// Types of the cards taken from those boxes: what a scenario deals. Player cards of the box are RingsDB's.
const PRODUCT_TYPES = new Set(["Enemy", "Location", "Treachery", "Quest", "Objective", "Objective_Ally", "Objective_Location", "Campaign", "Ship_Enemy", "Ship_Objective", "Treasure", "Encounter_Side_Quest"]);

// A product whose Hall of Beorn codes collide takes the code from its collector number (overrides.productCodes).
export function productCodeOf(overrides: Pick<Overrides, "productCodes">): (card: HobCard) => string | null {
  const rules = [...overrides.productCodes].sort((a, b) => b.from - a.from);
  return (card) => {
    const rule = rules.find((entry) => entry.set === card.CardSet && card.Number >= entry.from);
    if (rule === undefined) return rules.some((entry) => entry.set === card.CardSet) ? null : card.RingsDbCardId;
    return `${rule.prefix}${String(card.Number).padStart(rule.width, "0")}`;
  };
}

// Hall of Beorn files the two sides of a Dream-chaser Campaign Expansion card as two rows with one collector number: the
// base side and the "Campaign Mode only", "Upgraded", "Enraged" or Expert Mode side (the rulebook's p29 sides). One card has two
// sides: the folded row is the base side with the other side's row as its Back (its picture and text). Hall of Beorn's scenario files name
// the base row's slug (the scenarios of Dream-chaser list the original packs' cards, never a DCCE side row).
const FLIP_SLUG = /-(?:Upgraded|Campaign|Enraged)-DCC$|^Expert-Mode-DCC$/;

export function foldTwoSided(hob: readonly HobCard[]): { cards: HobCard[] } {
  const groups = new Map<string, HobCard[]>();
  for (const card of hob) {
    if (card.CardSet !== "Dream-chaser Campaign Expansion") continue;
    const key = `${card.CardSet}\u0000${card.Number}`;
    groups.set(key, [...(groups.get(key) ?? []), card]);
  }
  const replaced = new Map<HobCard, HobCard | null>();
  for (const rows of groups.values()) {
    if (rows.length === 1) continue;
    const flips = rows.filter((row) => FLIP_SLUG.test(row.Slug));
    const front = rows.filter((row) => !FLIP_SLUG.test(row.Slug));
    const first = front[0];
    const second = flips[0];
    if (rows.length !== 2 || front.length !== 1 || flips.length !== 1 || !first || !second) throw new Error(`Dream-chaser Campaign Expansion #${rows[0]?.Number}: ${rows.map((row) => row.Slug).join(", ")} are not one front and one flip side`);
    // The Expert Mode row keeps its text on its own back (Hall of Beorn's layout for it); the picture is its front.
    const side = second.Front.Text.length > 0 || !second.Back ? second.Front : { ...second.Front, Text: second.Back.Text };
    replaced.set(first, { ...first, Back: side });
    replaced.set(second, null);
  }
  return { cards: hob.flatMap((card) => (replaced.has(card) ? (replaced.get(card) ? [replaced.get(card) as HobCard] : []) : [card])) };
}

// The scenario, quest and campaign cards of the Revised Core Set and The Dark of Mirkwood come from Hall of Beorn alone,
// filtered by CardSet. The Revised Core Set's encounter cards reuse the 2011 codes (01074 to 01131) and its printing
// owns them; the boons and burdens RingsDB lists keep that record and take Hall of Beorn's text.
export function addProductCards(
  hob: readonly HobCard[],
  byCode: Map<string, Card>,
  codeOf: (card: HobCard) => string | null,
  merge: (code: string, twin: HobCard | undefined, source: HobCard) => Card,
): void {
  for (const source of hob) {
    const pack = PRODUCT_PACK.get(source.CardSet);
    const code = codeOf(source);
    if (!pack || !code || !PRODUCT_TYPES.has(source.CardType) || byCode.has(code)) continue;
    const merged = merge(code, source, source);
    merged.printings = merged.printings.map((printing) => ({ ...printing, pack }));
    byCode.set(code, merged);
  }
}

// Every card of every Nightmare deck (nightmare-defs.ts), from Hall of Beorn alone: the setup card, the encounter cards and the
// quest cards a deck adds. Coded by its deck's prefix and printed in the Nightmare pack. A Hall of Beorn set no row names is a
// build error, so a new deck in the source is noticed.
export function addNightmareCards(hob: readonly HobCard[], byCode: Map<string, Card>, merge: (code: string, twin: HobCard | undefined, source: HobCard) => Card): void {
  for (const source of hob) {
    if (!/ Nightmare$/.test(source.CardSet)) continue;
    const deck = NIGHTMARE_SETS.get(source.CardSet);
    if (!deck) throw new Error(`Nightmare set "${source.CardSet}" has no row in scripts/data/nightmare-defs.ts`);
    const code = nightmareCode(deck, source.Number);
    if (byCode.has(code)) throw new Error(`Nightmare card ${code} (${source.Title}) is already built`);
    const merged = merge(code, source, source);
    // The source gives a Nightmare side quest or ship enemy of the later decks no encounter set; the deck's own set ("Intruders in Chetwood Nightmare") is its
    // Hall of Beorn card set. The setup card has none (it is the deck's one card of its own).
    if (merged.type !== "nightmare" && merged.encounterSet == null) merged.encounterSet = deck.set;
    merged.printings = merged.printings.map((printing) => ({ ...printing, pack: NIGHTMARE_PACK }));
    byCode.set(code, merged);
  }
}

// Hall of Beorn names the encounter sets of the campaign editions "Spiders of Mirkwood (Campaign)". The suffix is not part
// of the set's name.
// The Dream-chaser Campaign Expansion's sets read "The Fate of Númenor Campaign" (no parentheses) and belong to the scenario's set.
const BUILT_PRODUCT_NAMES: ReadonlySet<string> = new Set(PRODUCTS.map((product) => product.name));
export function setName(name: string | null | undefined, cardSet?: string): string | null {
  if (name == null) return null;
  const plain = name.replace(CAMPAIGN_SUFFIX, "");
  if (cardSet === undefined || !BUILT_PRODUCT_NAMES.has(cardSet)) return plain;
  return plain.replace(/ Campaign$/, "");
}

// The encounter set each scenario file lists a card (by its slug) under, Nightmare sets left out.
function setBySlug(raw: Pick<RawData, "scenarios">): Map<string, string> {
  const bySlug = new Map<string, string>();
  for (const scenario of raw.scenarios) {
    for (const item of scenario.ScenarioCards) if (item.EncounterSet && !/Nightmare$/.test(item.EncounterSet)) bySlug.set(item.Slug, setName(item.EncounterSet) ?? item.EncounterSet);
  }
  return bySlug;
}

// Hall of Beorn gives the Dream-chaser ships no encounter info, but its scenario files list each ship under its set ("Umbar Fleet", "The
// Dream-chaser's Fleet"). A ship takes the set its slug is listed under; a 2023 reprint (Dream-chaser Campaign Expansion) takes its original's.
// Ships are Dream-chaser cards only, so the Dream-chaser boxes' packs are the whole scope.
const DREAM_CHASER_PACKS: ReadonlySet<string> = new Set(PRODUCTS.filter((product) => product.home === "dream-chaser").flatMap((product) => product.packs));
export function fillShipSets(raw: RawData, byCode: Map<string, Card>): void {
  const bySlug = setBySlug(raw);
  const ships = [...byCode.values()].filter((card) => (card.type === "ship-enemy" || card.type === "ship-objective") && card.campaignKind == null && card.printings.some((printing) => DREAM_CHASER_PACKS.has(printing.pack)));
  const named = new Map<string, string>();
  for (const card of ships) {
    const set = card.printings.map((printing) => (printing.hobSlug ? bySlug.get(printing.hobSlug) : undefined)).find((name) => name !== undefined);
    if (set) named.set(`${card.name}\u0000${card.type}`, set);
  }
  for (const card of ships) {
    const set = named.get(`${card.name}\u0000${card.type}`);
    if (card.encounterSet == null && set) byCode.set(card.code, { ...card, encounterSet: set });
  }
}

// Hall of Beorn gives the eight encounter side quests of Fire in the Night no encounter info, but its scenario file lists each under its set ("Fire in the
// Night"). A side quest of a built box takes the set its slug is listed under.
export function fillSideQuestSets(raw: Pick<RawData, "scenarios">, byCode: Map<string, Card>): void {
  const bySlug = setBySlug(raw);
  const products = new Set(PRODUCTS.flatMap((product) => product.packs));
  for (const card of byCode.values()) {
    if (card.type !== "encounter-side-quest" || card.encounterSet != null || !card.printings.some((printing) => products.has(printing.pack))) continue;
    const set = card.printings.map((printing) => (printing.hobSlug ? bySlug.get(printing.hobSlug) : undefined)).find((name) => name !== undefined);
    if (set) byCode.set(card.code, { ...card, encounterSet: set });
  }
}

type DragnRow = Record<string, string>;

// The numeric cell of a DragnCards row ("" and "-" are no value).
const cell = (row: DragnRow, key: string): string | null => (/^\d+$/.test(row[key] ?? "") ? (row[key] as string) : null);

// A DragnCards side as a Hall of Beorn side: the stats, traits, keywords and text the row carries. DragnCards separates the lines of a
// text box with two spaces. The text is a candidate only: the printed-text ledger replaces it from the scan (data/printed).
function hobSideOf(row: DragnRow, picture: string): HobCard["Front"] {
  const stats: Record<string, string | null> = {};
  for (const [stat, key] of [["EngagementCost", "engagementCost"], ["Threat", "threat"], ["Willpower", "willpower"], ["Attack", "attack"], ["Defense", "defense"], ["HitPoints", "hitPoints"], ["QuestPoints", "questPoints"]] as const) {
    const value = cell(row, key);
    if (value !== null) stats[stat] = value;
  }
  const victory = cell(row, "victoryPoints");
  const keywords = [...(row.keywords ?? "").split(/(?<=\.)\s+/).filter((token) => token !== ""), ...(victory ? [`Victory ${victory}.`] : [])];
  return {
    Stats: stats,
    Traits: (row.traits ?? "").split(/(?<=\.)\s+/).filter((token) => token !== ""),
    Keywords: keywords,
    Text: [(row.text ?? "").split(/\s{2,}/).join("\n")],
    Shadow: null,
    ImagePath: picture,
  };
}

// A card of a Dream-chaser product that Hall of Beorn has no row for and DragnCards does (the Dream-chaser Campaign Expansion's #129, the
// reprint of The Shattered Monument): built from the DragnCards rows of its two sides, front and back, as one Hall of Beorn card. Its
// encounter set is the original's (overrides.cards).
export function dragnOnlyCards(raw: Pick<RawData, "dragnSides" | "dragnImagePrefix">, hob: readonly HobCard[]): HobCard[] {
  const have = new Set(hob.map((card) => `${card.CardSet}\u0000${card.Number}`));
  const built: HobCard[] = [];
  for (const [id, sides] of raw.dragnSides) {
    const front = sides.a;
    const product = PRODUCTS.find((item) => item.name === front?.packName && item.twinPack === null && item.load === "dragncards");
    const number = Number(front?.numberInPack);
    const type = (front?.type ?? "").replaceAll(" ", "_");
    if (!front || !product || number >= 900 || have.has(`${product.name}\u0000${number}`) || !PRODUCT_TYPES.has(type)) continue;
    const picture = (row: DragnRow) => `${raw.dragnImagePrefix}${row.imageUrl ?? ""}`;
    built.push({
      Title: front.name ?? id,
      Slug: `${(front.name ?? id).normalize("NFD").replace(/\p{M}/gu, "").replace(/[^A-Za-z0-9']+/g, "-")}-DCC`,
      IsUnique: front.unique === "1",
      CardType: type,
      CardSubType: null,
      Sphere: null,
      Front: hobSideOf(front, picture(front)),
      Back: sides.b ? hobSideOf(sides.b, picture(sides.b)) : null,
      CardSet: product.name,
      EncounterInfo: null,
      Number: number,
      Quantity: Number(front.deckbuilderQuantity) || 1,
      HasErrata: false,
      OctgnGuid: null,
      RingsDbCardId: null,
    });
  }
  return built;
}

// Hall of Beorn files no second side for some Dream-chaser cards that DragnCards pictures on both sides (Calphon, Dol Amroth Warship,
// Duskbringer and Glórinaith of the Dream-chaser Campaign Expansion; the Heading card Navigation of The Grey Havens): the card is the
// one of its pack and collector number whose type bar matches the row's, and its second side's text is the DragnCards row's, a
// candidate the ledger replaces from the scan.
export function addDragnBacks(raw: Pick<RawData, "dragnSides">, byCode: Map<string, Card>): void {
  const typeKey = (value: string) => value.toLowerCase().replace(/[\s-]/g, "");
  for (const sides of raw.dragnSides.values()) {
    const { a, b } = sides;
    const product = PRODUCTS.find((item) => item.name === a?.packName && item.sidedDragnRows === true);
    // Both rows are one card only when they carry one name and one type: the Grotto locations differ in name, the Stormcaller Elite in type.
    if (!a || !b || !product || Number(a.numberInPack) >= 900 || titleKey(a.name ?? "") !== titleKey(b.name ?? "") || a.type !== b.type) continue;
    const mine = [...byCode.values()].filter(
      (card) => card.back === null && typeKey(card.typeName) === typeKey(a.type ?? "") && card.printings.some((printing) => product.packs.includes(printing.pack) && printing.number === Number(a.numberInPack)),
    );
    // A card whose other side is a card of its own in the same pack (the Grotto and Underwater sides of Shrine to Morgoth) is not one.
    const only = mine.length === 1 ? mine[0] : undefined;
    const sibling = only && [...byCode.values()].some((card) => card.code !== only.code && titleKey(card.name) === titleKey(only.name) && card.printings.some((printing) => only.printings.some((own) => own.pack === printing.pack)));
    if (only && !sibling) byCode.set(only.code, { ...only, back: { name: null, text: (b.text ?? "").split(/\s{2,}/).join("\n") || null, questPoints: cell(b, "questPoints") ? Number(cell(b, "questPoints")) : null, stage: null } });
  }
}

// The DragnCards row of a Hall of Beorn card by its OCTGN guid. `dragn` keeps the last row of an id, which is the second side of a
// double-sided card; a Dream-chaser card takes the side that bears its title (else the front), so its keywords and Victory are its own.
export function dragnRowOf(raw: Pick<RawData, "dragn" | "dragnSides">, guid: string, card: Pick<HobCard, "CardSet" | "Title">): Record<string, string> | undefined {
  const sides = raw.dragnSides.get(guid);
  if (!sides || !PRODUCTS.some((product) => product.name === card.CardSet && product.sidedDragnRows === true)) return raw.dragn.get(guid);
  return [sides.a, sides.b].find((row) => row !== undefined && titleKey(row.name ?? "") === titleKey(card.Title)) ?? sides.a ?? sides.b;
}
