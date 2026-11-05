import type { Card } from "../../../src/catalog/card-facts.ts";
import { PRODUCTS, scenarioSlug } from "../campaign-defs.ts";
import type { Overrides } from "./cards.ts";
import type { RawData } from "./load-raw.ts";
import { sameName } from "./names.ts";

// The catalog card a DragnCards load-list row stands for: by OCTGN guid, by the row's twin pack and collector number (the Fellowship boxes), by its
// box, type and name (the Dream-chaser and Ered Mithrin boxes), through a pack alias, or through an override (overrides.dragnCardCodes).
export function dragnResolver(
  raw: Pick<RawData, "dragn" | "dragnSides">,
  cards: readonly Card[],
  overrides: Pick<Overrides, "dragnCardCodes" | "dragnPackAliases">,
  index: { byCode: ReadonlyMap<string, Card>; byGuid: ReadonlyMap<string, Card>; byPackNumber: ReadonlyMap<string, Card> },
): { resolve: (databaseId: string, side?: "a" | "b", sided?: boolean) => Card | null; sideRow: (databaseId: string, side: "a" | "b") => Record<string, string> | undefined } {
  const { byCode, byGuid, byPackNumber } = index;
  // A Dream-chaser card: DragnCards files each side of a double-sided card as a row of its own, named after that side, and Hall of Beorn
  // has no OCTGN guid for many of them. The row's box (packName) and type find the card: by name when the name is one card's in the
  // box (Dark Abyss), else by the collector number (the "Lost Island" side of Lush Jungle is #30). A card is `type` when it matches the row's type bar.
  const typeKey = (value: string): string => value.toLowerCase().replace(/[\s-]/g, "");
  const byProduct = (row: Record<string, string>): Card | null => {
    const product = PRODUCTS.find((item) => item.name === row.packName && item.twinPack === null && item.load === "dragncards");
    const pack = product?.packs[0];
    if (!pack) return null;
    const mine = cards.filter((card) => card.printings.some((printing) => printing.pack === pack) && typeKey(card.typeName) === typeKey(row.type ?? ""));
    const named = mine.filter((card) => sameName(card.name, row.name ?? ""));
    if (named.length === 1) return named[0] ?? null;
    // Two cards of one name and number (the Grotto and Underwater sides of Shrine to Morgoth): the row's traits name the side.
    const traitsOf = (list: readonly string[]) => [...list].sort().join(",");
    const rowTraits = (row.traits ?? "").split(".").map((trait) => trait.trim()).filter((trait) => trait !== "");
    const bySide = named.filter((card) => traitsOf(card.traits) === traitsOf(rowTraits));
    if (named.length > 1 && bySide.length === 1) return bySide[0] ?? null;
    const numbered = (list: readonly Card[]) => list.filter((card) => card.printings.some((printing) => printing.pack === pack && String(printing.number) === row.numberInPack));
    const byNumber = numbered(named.length > 1 ? named : mine);
    if (byNumber.length === 1 || named.length < 2) return byNumber.length === 1 ? (byNumber[0] ?? null) : null;
    // Cards of one name whose collector number the sources disagree on (Mount Gundabad's seven Exploring Gundabad stages: Hall of Beorn
    // numbers The Upper Levels 135, DragnCards 136): the name of the card's other side, which Hall of Beorn keeps in its slug, finds it.
    const sideName = raw.dragnSides.get(row.databaseId)?.b?.name ?? "";
    const viaSlug = sideName === "" ? [] : named.filter((card) => card.printings.some((printing) => scenarioSlug(printing.hobSlug ?? "").includes(scenarioSlug(sideName))));
    return viaSlug.length === 1 ? (viaSlug[0] ?? null) : null;
  };
  // A DragnCards pack that stands for another pack's cards (overrides.dragnPackAliases): found by collector number and name.
  const packAlias = new Map(overrides.dragnPackAliases.map((alias) => [alias.dragncards, alias.pack]));
  const byAlias = (row: Record<string, string>): Card | null => {
    const pack = packAlias.get(row.packName ?? "");
    const hits = pack ? cards.filter((card) => card.printings.some((printing) => printing.pack === pack && String(printing.number) === row.numberInPack) && sameName(card.name, row.name ?? "")) : [];
    return hits.length === 1 ? (hits[0] ?? null) : null;
  };
  // `sided` (a Dream-chaser deck): the rows of one id are its two sides, and a side resolves to the card of that side's own row. Elsewhere the
  // id's last row is the card, as it always was.
  const sideRow = (databaseId: string, side: "a" | "b") => {
    const sides = raw.dragnSides.get(databaseId);
    return side === "a" ? (sides?.a ?? sides?.b) : sides?.b;
  };
  const resolve = (databaseId: string, side: "a" | "b" = "a", sided = false): Card | null => {
    const direct = side === "a" ? byGuid.get(databaseId) : undefined;
    if (direct) return direct;
    const row = sided ? sideRow(databaseId, side) : raw.dragn.get(databaseId);
    // A row the sources cannot match (overrides.dragnCardCodes).
    const fixed = overrides.dragnCardCodes.find((item) => item.dragncards === row?.packName && String(item.number) === row?.numberInPack && item.side === side);
    if (fixed) return byCode.get(fixed.code) ?? null;
    const pack = PRODUCTS.find((product) => product.name === row?.packName)?.twinPack;
    const hit = pack ? byPackNumber.get(`${pack}:${row?.numberInPack ?? ""}`) : undefined;
    if (hit && row && sameName(hit.name, row.name ?? "")) return hit;
    return row ? (byProduct(row) ?? byAlias(row)) : null;
  };
  return { resolve, sideRow };
}
