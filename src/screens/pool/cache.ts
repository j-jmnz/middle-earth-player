// The deck-legal player pool read from catalog.db once per database handle: the rows sorted by name, the same rows by code, the
// packs, and the codes with a printed line the app does not apply. The Cards tab, the pool the deck editor opens, its cards pane
// and the import screen all read this, so none of them queries and sorts about 850 cards on mount. The catalog is read-only while
// the app runs (a new one replaces the file and restarts), so an entry never goes stale; a WeakMap frees it with the handle.
import { eq } from "drizzle-orm";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import { deckPacks } from "../../catalog/collection";
import { cards, packs } from "../../catalog/schema";
import { notAppliedCodes } from "../../play/cards/not-applied";
import { MOTK_PACK } from "../groups/motk";

import { sortPool } from "./filter";

type Db<TRun> = BaseSQLiteDatabase<"sync", TRun>;

const columns = {
  code: cards.code,
  name: cards.name,
  typeCode: cards.typeCode,
  typeName: cards.typeName,
  sphereCode: cards.sphereCode,
  sphereName: cards.sphereName,
  packCode: cards.packCode,
  packCodes: cards.packCodes,
  traits: cards.traits,
  cost: cards.cost,
  threat: cards.threat,
  isUnique: cards.isUnique,
  deckLimit: cards.deckLimit,
  deckLegal: cards.deckLegal,
  imagesrc: cards.imagesrc,
  // The text the app checks and the import reads: the errata when there is one, as on the card screen and in the deck store.
  text: cards.text,
  errata: cards.errata,
};

const packColumns = { code: packs.code, name: packs.name, position: packs.position, cyclePosition: packs.cyclePosition };

function selectPool<TRun>(catalog: Db<TRun>) {
  return catalog.select(columns).from(cards).where(eq(cards.deckLegal, true)).all();
}

// The Messenger of the King's heroes: browse only, so never in the deck-legal rows; the Cards tab shows them under their own type chip.
function selectMotk<TRun>(catalog: Db<TRun>) {
  return catalog.select(columns).from(cards).where(eq(cards.packCode, MOTK_PACK)).all();
}

export type PoolEntry = ReturnType<typeof selectPool>[number];

export type PoolPackRow = { code: string; name: string; position: number; cyclePosition: number };

export type PoolData = {
  /** In name order (sortPool). */
  rows: readonly PoolEntry[];
  byCode: ReadonlyMap<string, PoolEntry>;
  /** The packs that hold one of the rows (deckPacks), in cycle order. */
  packs: readonly PoolPackRow[];
  /** The codes with a printed line the app does not apply. */
  notApplied: ReadonlySet<string>;
  /** The Messenger of the King's heroes, in name order: browse only, never added to a deck. */
  motk: readonly PoolEntry[];
};

const pools = new WeakMap<object, PoolData>();

export function readPool<TRun>(catalog: Db<TRun>): PoolData {
  const rows = sortPool(selectPool(catalog));
  const held = deckPacks(rows);
  return {
    rows,
    byCode: new Map(rows.map((row) => [row.code, row])),
    packs: catalog
      .select(packColumns)
      .from(packs)
      .orderBy(packs.cyclePosition, packs.position)
      .all()
      .filter((pack) => held.has(pack.code)),
    notApplied: notAppliedCodes(rows.map((row) => [row.code, row.errata ?? row.text] as const)),
    motk: sortPool(selectMotk(catalog)),
  };
}

/** The pool of this catalog, read on the first call. */
export function poolOf<TRun>(catalog: Db<TRun>): PoolData {
  let found = pools.get(catalog);
  if (!found) {
    found = readPool(catalog);
    pools.set(catalog, found);
  }
  return found;
}
