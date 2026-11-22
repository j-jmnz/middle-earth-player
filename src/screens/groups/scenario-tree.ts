// The encounter sets of the Cards tab's Encounter cards view as data: the products of data/collection.json in its order (Core Set, the cycles with their packs, the saga
// boxes), each pack's encounter sets, and each set's cards under their type's heading. A set carries its scenario's quest cards, which print
// the set's name, and a Nightmare deck is its own product at the end (the decks are sold apart from the boxes), one set to a deck with its setup
// card and every card its code puts in the deck. A pack with no encounter card is left out, and so is a product with no pack left. Pure; groups/cache.ts reads the rows once per catalog.
import { printedSetName } from "../../campaign/printed-name";
import { copiesOf, SCENARIO_TYPES, typeGroups, type Decorate, type EasyCopies, type GroupRow, type TypeGroup } from "./group-types";

/** The packs the Nightmare decks are printed in: none of the catalog's (the pack code is the cards' own). */
export const NIGHTMARE_PACK = "Nightmare";

export type SetNode = {
  /** `<pack>~<set>`: the route's id for the set. */
  key: string;
  name: string;
  /** Copies in the encounter deck (not the quest cards or the setup card), or all of them when that is none. */
  count: number;
  groups: readonly TypeGroup[];
};

export type PackNode = { code: string; name: string; sets: readonly SetNode[] };
export type ProductNode = { id: string; title: string; packs: readonly PackNode[] };

export type ScenarioTree = {
  products: readonly ProductNode[];
  /** A set by its key, with the pack and product it is listed under. */
  byKey: ReadonlyMap<string, { product: ProductNode; pack: PackNode; set: SetNode }>;
};

type CollectionLike = { id: string; title: string; packs: readonly string[] };
type PackLike = { code: string; name: string };

/** Whether a row belongs to a set: an encounter card (a burden is a campaign section's) or a Nightmare deck's card. */
export function isScenarioRow(row: GroupRow): boolean {
  if (row.campaignKind != null || row.typeCode === "treasure" || row.typeCode === "campaign") return false;
  return row.packCode === NIGHTMARE_PACK || row.encounterSet != null;
}

function setName(row: GroupRow): string {
  return row.encounterSet ?? row.name;
}

// The encounter deck's copies: the quest cards and a Nightmare setup card are not shuffled into it.
const NOT_DECK: ReadonlySet<string> = new Set(["quest", "nightmare"]);

function setNode(pack: string, name: string, rows: readonly GroupRow[], decorate: Decorate): SetNode {
  const groups = typeGroups(rows, SCENARIO_TYPES, decorate);
  const deck = typeGroups(rows.filter((row) => !NOT_DECK.has(row.typeCode)), SCENARIO_TYPES);
  return { key: `${pack}~${name}`, name, count: copiesOf(deck) || copiesOf(groups), groups };
}

// A Nightmare card's deck is the first four digits of its code (nightmare-defs.ts: the deck's prefix and the card's two-digit number), and the deck is named by its setup card: a few decks hold a card or three of an
// encounter set of their own ("Crumbling Stairs" of Shadow and Flame, the Stormcaller's cards of The Thing in the Depths), which still lie in their deck's row.
const DECK_DIGITS = 4;
function deckNames(rows: readonly GroupRow[]): ReadonlyMap<string, string> {
  return new Map(rows.filter((row) => row.typeCode === "nightmare").map((row) => [row.code.slice(0, DECK_DIGITS), row.name]));
}

// The sets of one pack in print order: by the number of their first card. `named` gives a row's set when it is not the row's own encounter set (the Nightmare decks').
function packSets(pack: string, rows: readonly GroupRow[], decorate: Decorate, named?: (row: GroupRow) => string | undefined): SetNode[] {
  // A numbered packet of a Fellowship event kit joins its printed set (printedSetName).
  const listed = new Set(rows.map(setName));
  const byName = new Map<string, GroupRow[]>();
  for (const row of rows) {
    const name = named?.(row) ?? printedSetName(setName(row), listed);
    byName.set(name, [...(byName.get(name) ?? []), row]);
  }
  const first = (members: readonly GroupRow[]) => Math.min(...members.map((row) => row.position));
  return [...byName.entries()].sort(([leftName, left], [rightName, right]) => first(left) - first(right) || leftName.localeCompare(rightName)).map(([name, members]) => setNode(pack, name, members, decorate));
}

/** `easy` is what the scenario files say of each card's Easy copies (groups/cache.ts, `scenarioFacts`). */
export function scenarioTree(rows: readonly GroupRow[], collection: readonly CollectionLike[], packs: readonly PackLike[], easy: ReadonlyMap<string, EasyCopies> = new Map()): ScenarioTree {
  const decorate: Decorate = { easy };
  const inScenario = rows.filter(isScenarioRow);
  const packNames = new Map(packs.map((pack) => [pack.code, pack.name]));
  const products: ProductNode[] = [];
  for (const entry of collection) {
    const nodes = entry.packs.flatMap((code): PackNode[] => {
      const members = inScenario.filter((row) => row.packCode !== NIGHTMARE_PACK && row.packCodes.includes(code));
      const sets = packSets(code, members, decorate);
      return sets.length === 0 ? [] : [{ code, name: packNames.get(code) ?? code, sets }];
    });
    if (nodes.length > 0) products.push({ id: entry.id, title: entry.title, packs: nodes });
  }
  const nightmare = inScenario.filter((row) => row.packCode === NIGHTMARE_PACK);
  const names = deckNames(nightmare);
  const decks = packSets(NIGHTMARE_PACK, nightmare, decorate, (row) => names.get(row.code.slice(0, DECK_DIGITS)));
  if (decks.length > 0) products.push({ id: "nightmare", title: "Nightmare decks", packs: [{ code: NIGHTMARE_PACK, name: "Nightmare decks", sets: decks }] });
  const byKey = new Map<string, { product: ProductNode; pack: PackNode; set: SetNode }>();
  for (const product of products) for (const pack of product.packs) for (const set of pack.sets) byKey.set(set.key, { product, pack, set });
  return { products, byKey };
}
