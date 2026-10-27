import type { Card } from "../../../src/catalog/card-facts.ts";
import { PRODUCTS } from "../campaign-defs.ts";
import type { HobCard } from "../sources/hallofbeorn.ts";
import type { Overrides } from "./cards.ts";

// The boxes whose encounter, quest and campaign cards RingsDB does not carry (Hall of Beorn is their only source), each with the
// RingsDB pack it is printed in (PRODUCTS: the products with no twin pack). A product's cards are taken by CardSet, so its
// Nightmare sets stay out.
const PRODUCT_PACK: ReadonlyMap<string, string> = new Map(PRODUCTS.flatMap((product) => (product.twinPack === null ? [[product.name, product.packs[0] ?? ""] as const] : [])));

// Types of the cards taken from those boxes: what a scenario deals. Player cards of the box are RingsDB's.
const PRODUCT_TYPES = new Set(["Enemy", "Location", "Treachery", "Quest", "Objective", "Objective_Ally", "Campaign"]);

// A product whose Hall of Beorn codes collide takes the code from its collector number (overrides.productCodes).
export function productCodeOf(overrides: Pick<Overrides, "productCodes">): (card: HobCard) => string | null {
  const prefixes = new Map(overrides.productCodes.map((entry) => [entry.set, entry.prefix]));
  return (card) => {
    const prefix = prefixes.get(card.CardSet);
    return prefix === undefined ? card.RingsDbCardId : `${prefix}${String(card.Number).padStart(2, "0")}`;
  };
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
