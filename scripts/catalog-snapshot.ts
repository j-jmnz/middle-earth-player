import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";
import { getTableConfig, type SQLiteTable } from "drizzle-orm/sqlite-core";

import { cards, effects as effectsTable, packs, scenarios } from "../src/catalog/schema.ts";

// What the last build wrote, and the version number that follows from comparing it to the next build.

export type SqlValue = string | number | bigint | Buffer | null;
export type Row = Record<string, SqlValue>;
type SqliteDatabase = InstanceType<typeof Database>;

export type CatalogSnapshot = {
  packs: string;
  cards: string;
  effects: string;
  scenarios: string;
};

export function quoteIdent(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function readRows(db: SqliteDatabase, table: SQLiteTable): Row[] {
  const config = getTableConfig(table);
  const columnNames = config.columns.map((column) => quoteIdent(column.name));
  const sql = `select ${columnNames.join(", ")} from ${quoteIdent(config.name)}`;
  return db.prepare(sql).all() as Row[];
}

function canonicalRows(rows: Row[], idColumn: string, jsonColumns: string[]): string {
  const normalized = rows
    .map((row) => {
      const copy: Record<string, unknown> = {};
      for (const key of Object.keys(row).sort()) {
        const value = row[key];
        copy[key] = jsonColumns.includes(key) && typeof value === "string" ? JSON.parse(value) : value;
      }
      return copy;
    })
    .sort((left, right) => String(left[idColumn]).localeCompare(String(right[idColumn])));
  return JSON.stringify(normalized);
}

export function snapshotCatalog(dbPath: string): CatalogSnapshot | null {
  if (!existsSync(dbPath)) return null;
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  try {
    return {
      packs: canonicalRows(readRows(db, packs), "code", []),
      cards: canonicalRows(readRows(db, cards), "code", ["pack_codes", "keywords"]),
      effects: canonicalRows(readRows(db, effectsTable), "id", ["record"]),
      scenarios: canonicalRows(readRows(db, scenarios), "id", ["definition"]),
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    // A database from before a column was added differs from any new build, so the version moves.
    if (/no such column: (engagement_cost|keywords)/.test(reason)) return { packs: "", cards: "", effects: "", scenarios: "" };
    throw new Error(`Could not read existing catalog at ${dbPath}: ${reason}`, { cause: error });
  } finally {
    db.close();
  }
}

function readCatalogVersion(versionPath: string): number | null {
  if (!existsSync(versionPath)) return null;
  const source = readFileSync(versionPath, "utf8");
  const match = /export const CATALOG_VERSION = (\d+);/.exec(source);
  if (!match?.[1]) {
    throw new Error(`Could not read CATALOG_VERSION from ${versionPath}`);
  }
  return Number(match[1]);
}

export function writeCatalogVersion(versionPath: string, version: number): void {
  const declaration = `export const CATALOG_VERSION = ${version};`;
  if (!existsSync(versionPath)) {
    mkdirSync(path.dirname(versionPath), { recursive: true });
    writeFileSync(versionPath, `${declaration}\n`);
    return;
  }

  const current = readFileSync(versionPath, "utf8");
  if (!/export const CATALOG_VERSION = \d+;/.test(current)) {
    throw new Error(`Could not read CATALOG_VERSION from ${versionPath}`);
  }
  const next = current.replace(/export const CATALOG_VERSION = \d+;/, declaration);
  if (next !== current) writeFileSync(versionPath, next);
}

export function nextVersion(
  previous: CatalogSnapshot | null,
  packRows: Row[],
  cardRows: Row[],
  effectRows: Row[],
  scenarioRows: Row[],
  versionPath: string,
): number {
  const current = readCatalogVersion(versionPath);
  if (!previous) return current ?? 1;
  const matches =
    previous.packs === canonicalRows(packRows, "code", []) &&
    previous.cards === canonicalRows(cardRows, "code", ["pack_codes", "keywords"]) &&
    previous.effects === canonicalRows(effectRows, "id", ["record"]) &&
    previous.scenarios === canonicalRows(scenarioRows, "id", ["definition"]);
  if (matches) return current ?? 1;
  return (current ?? 0) + 1;
}
