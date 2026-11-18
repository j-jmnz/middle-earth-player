import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, it } from "vitest";

import { temporaryCatalog } from "../../../test/harness/temp-catalog.ts";
import { poolOf } from "./cache.ts";
import { sortPool } from "./filter.ts";

describe("the pool cache", () => {
  const catalog = drizzle(new Database(temporaryCatalog(), { readonly: true }));

  it("reads the deck-legal pool once per catalog handle, sorted by name", () => {
    const pool = poolOf(catalog);
    expect(poolOf(catalog)).toBe(pool);
    expect(pool.rows.length).toBeGreaterThan(100);
    expect(pool.rows.every((row) => row.deckLegal)).toBe(true);
    expect(sortPool(pool.rows).map((row) => row.code)).toEqual(pool.rows.map((row) => row.code));
    expect(pool.byCode.size).toBe(pool.rows.length);
    expect(pool.byCode.get(pool.rows[0]!.code)).toBe(pool.rows[0]);
  });

  it("keeps the packs in cycle order and the not-applied codes inside the pool", () => {
    const pool = poolOf(catalog);
    expect(pool.packs.length).toBeGreaterThan(0);
    expect(pool.packs.map((pack) => [pack.cyclePosition, pack.position])).toEqual([...pool.packs].map((pack) => [pack.cyclePosition, pack.position]).sort((a, b) => a[0]! - b[0]! || a[1]! - b[1]!));
    for (const code of pool.notApplied) expect(pool.byCode.has(code)).toBe(true);
  });

  it("holds the Messenger of the King heroes apart from the deck-legal pool, sorted by name", () => {
    const pool = poolOf(catalog);
    expect(pool.motk.length).toBe(84);
    expect(pool.motk.every((row) => !row.deckLegal && row.typeCode === "hero")).toBe(true);
    expect(sortPool(pool.motk).map((row) => row.code)).toEqual(pool.motk.map((row) => row.code));
    for (const row of pool.motk) expect(pool.byCode.has(row.code)).toBe(false);
    // Each strip names its ally's pack, so two heroes of one name differ ("(MotK) Anborn", 9906114 and 99144004).
    for (const row of pool.motk) expect(pool.motkNotes.get(row.code), row.code).not.toBe("Ally");
    const anborn = pool.motk.filter((row) => row.name === "(MotK) Anborn").map((row) => pool.motkNotes.get(row.code));
    expect(anborn).toHaveLength(2);
    expect(new Set(anborn).size).toBe(2);
  });

  it("gives another handle its own pool", () => {
    const other = drizzle(new Database(temporaryCatalog(), { readonly: true }));
    expect(poolOf(other)).not.toBe(poolOf(catalog));
    expect(poolOf(other).rows.map((row) => row.code)).toEqual(poolOf(catalog).rows.map((row) => row.code));
  });
});
