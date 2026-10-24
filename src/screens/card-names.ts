import { inArray } from "drizzle-orm";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import { cards } from "../catalog/schema";

/** Card names by code, read from catalog.db for only the codes a screen shows. */
export function cardNames<TRun>(catalog: BaseSQLiteDatabase<"sync", TRun>, codes: Iterable<string>): Map<string, string> {
  const wanted = [...new Set(codes)];
  if (wanted.length === 0) return new Map();
  const rows = catalog.select({ code: cards.code, name: cards.name }).from(cards).where(inArray(cards.code, wanted)).all();
  return new Map(rows.map((row) => [row.code, row.name]));
}
