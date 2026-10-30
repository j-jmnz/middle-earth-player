import type { Card } from "../../../src/catalog/card-facts.ts";
import { PRODUCTS } from "../campaign-defs.ts";
import { NIGHTMARE_PACK, NIGHTMARE_SETS, nightmareCode } from "../nightmare-defs.ts";
import type { HobCard } from "../sources/hallofbeorn.ts";
import type { Overrides } from "./cards.ts";

// The boxes whose encounter, quest and campaign cards RingsDB does not carry (Hall of Beorn is their only source), each with the
// RingsDB pack it is printed in (PRODUCTS: the products with no twin pack). A product's cards are taken by CardSet, so its
// Nightmare sets stay out.
const PRODUCT_PACK: ReadonlyMap<string, string> = new Map(PRODUCTS.flatMap((product) => (product.twinPack === null ? [[product.name, product.packs[0] ?? ""] as const] : [])));

// Types of the cards taken from those boxes: what a scenario deals. Player cards of the box are RingsDB's.
const PRODUCT_TYPES = new Set(["Enemy", "Location", "Treachery", "Quest", "Objective", "Objective_Ally", "Campaign", "Ship_Enemy", "Ship_Objective"]);

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
// sides: the folded row is the base side with the other side's row as its Back (its picture and text). The Back's slug is
// returned as an alias of the front's, because Hall of Beorn's scenario files name either row.
const FLIP_SLUG = /-(?:Upgraded|Campaign|Enraged)-DCC$|^Expert-Mode-DCC$/;

export function foldTwoSided(hob: readonly HobCard[]): { cards: HobCard[]; aliases: Map<string, string> } {
  const groups = new Map<string, HobCard[]>();
  for (const card of hob) {
    if (card.CardSet !== "Dream-chaser Campaign Expansion") continue;
    const key = `${card.CardSet}\u0000${card.Number}`;
    groups.set(key, [...(groups.get(key) ?? []), card]);
  }
  const aliases = new Map<string, string>();
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
    aliases.set(second.Slug, first.Slug);
  }
  return { cards: hob.flatMap((card) => (replaced.has(card) ? (replaced.get(card) ? [replaced.get(card) as HobCard] : []) : [card])), aliases };
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
    merged.printings = merged.printings.map((printing) => ({ ...printing, pack: NIGHTMARE_PACK }));
    byCode.set(code, merged);
  }
}
