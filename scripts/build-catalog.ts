import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Database from "better-sqlite3";
import { getTableConfig, type SQLiteTable } from "drizzle-orm/sqlite-core";

import {
  parseRingsDbCards,
  parseRingsDbPacks,
  type RingsDbCard,
  type RingsDbPack,
} from "../src/catalog/boundary.ts";
import { deckLegal } from "../src/catalog/deck-legal.ts";
import { campaigns, cards, catalogTables, meta, packs } from "../src/catalog/schema.ts";

const PACKS_URL = "https://ringsdb.com/api/public/packs/";
const ALEP_PREFIX = "ALeP -";
const FELLOWSHIP_CAMPAIGN_ID = "fellowship-of-the-ring";
const FELLOWSHIP_PACK_CODES = new Set(["TBR", "TRD"]);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const RULE_FIELDS = [
  "name",
  "text",
  "cost",
  "deck_limit",
  "type_code",
  "type_name",
  "sphere_code",
  "traits",
  "is_unique",
  "has_errata",
  "threat",
  "willpower",
  "attack",
  "defense",
  "health",
  "quest",
  "victory",
] as const;

type RuleField = (typeof RULE_FIELDS)[number];
type SqlValue = string | number | bigint | Buffer | null;
type Row = Record<string, SqlValue>;
type Manifest = Record<string, string>;
type SqliteDatabase = InstanceType<typeof Database>;

type CardCopy = {
  pack: RingsDbPack;
  card: RingsDbCard;
};

type CatalogSnapshot = {
  packs: string;
  cards: string;
};

export type BuildCatalogOptions = {
  fetch?: typeof fetch;
  cacheDir?: string;
  dbPath?: string;
  versionPath?: string;
};

export type BuildCatalogResult = {
  version: number;
  packCount: number;
  cardCount: number;
};

function repoRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
}

function quoteIdent(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function packsCacheKey(): string {
  return "packs.json";
}

function cardsCacheKey(packCode: string): string {
  return `cards/${packCode}.json`;
}

function cardUrl(packCode: string): string {
  return `https://ringsdb.com/api/public/cards/${encodeURIComponent(packCode)}.json`;
}

function utcDay(): string {
  return new Date().toISOString().slice(0, 10);
}

function manifestPath(cacheDir: string): string {
  return path.join(cacheDir, "manifest.json");
}

function readManifest(cacheDir: string): Manifest {
  const filePath = manifestPath(cacheDir);
  if (!existsSync(filePath)) return {};
  const parsed: unknown = JSON.parse(readFileSync(filePath, "utf8"));
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Cache manifest is not an object");
  }
  const manifest: Manifest = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value !== "string") {
      throw new Error(`Cache manifest date for ${key} is not a string`);
    }
    manifest[key] = value;
  }
  return manifest;
}

function writeManifest(cacheDir: string, manifest: Manifest): void {
  const sorted: Manifest = {};
  for (const key of Object.keys(manifest).sort()) {
    const value = manifest[key];
    if (value !== undefined) sorted[key] = value;
  }
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(manifestPath(cacheDir), `${JSON.stringify(sorted, null, 2)}\n`);
}

async function loadPayload(
  fetchImpl: typeof fetch,
  cacheDir: string,
  manifest: Manifest,
  key: string,
  url: string,
): Promise<unknown> {
  const filePath = path.join(cacheDir, key);
  if (existsSync(filePath)) {
    if (!manifest[key]) {
      throw new Error(`Cache file ${key} has no fetched_at in the manifest`);
    }
    try {
      return JSON.parse(readFileSync(filePath, "utf8")) as unknown;
    } catch {
      throw new Error(`Cache file ${key} is not valid JSON`);
    }
  }

  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`GET ${url} failed with status ${response.status}`);
  }
  const body = await response.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(body) as unknown;
  } catch {
    throw new Error(`GET ${url} returned invalid JSON`);
  }
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, body);
  manifest[key] = utcDay();
  writeManifest(cacheDir, manifest);
  return parsed;
}

function comparePacks(left: RingsDbPack, right: RingsDbPack): number {
  if (left.cycle_position !== right.cycle_position) {
    return left.cycle_position - right.cycle_position;
  }
  if (left.position !== right.position) {
    return left.position - right.position;
  }
  if (left.code < right.code) return -1;
  if (left.code > right.code) return 1;
  return 0;
}

function ruleValue(card: RingsDbCard, field: RuleField): string | number | boolean | null {
  const value = card[field];
  if (value === undefined || value === null) return null;
  return value;
}

function assertRulesMatch(code: string, left: RingsDbCard, right: RingsDbCard): void {
  for (const field of RULE_FIELDS) {
    if (ruleValue(left, field) !== ruleValue(right, field)) {
      throw new Error(`Card ${code}: pack files disagree on ${field}`);
    }
  }
}

function deckLegalBit(card: RingsDbCard): number {
  try {
    return deckLegal(card.type_code, card.type_name) ? 1 : 0;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Card ${card.code}: ${reason}`, { cause: error });
  }
}

function nullableText(value: string | null | undefined): string | null {
  return value ?? null;
}

function nullableInt(value: number | null | undefined): number | null {
  return value ?? null;
}

function bit(value: boolean): number {
  return value ? 1 : 0;
}

// RingsDB `available` is a release date. The column stores whether that date is present.
function availableFlag(releaseDate: string): number {
  return releaseDate.trim() === "" ? 0 : 1;
}

function campaignIdFor(packCodes: string[]): string | null {
  return packCodes.some((code) => FELLOWSHIP_PACK_CODES.has(code)) ? FELLOWSHIP_CAMPAIGN_ID : null;
}

function rowFrom(table: SQLiteTable, values: Record<string, SqlValue>): Row {
  const config = getTableConfig(table);
  const row: Row = {};
  for (const column of config.columns) {
    const value = values[column.name];
    if (value === undefined) {
      throw new Error(`Missing value for ${config.name}.${column.name}`);
    }
    row[column.name] = value;
  }
  return row;
}

function cardRow(copies: CardCopy[]): Row {
  const ordered = [...copies].sort((left, right) => comparePacks(left.pack, right.pack));
  const primary = ordered[0];
  if (!primary) {
    throw new Error("Cannot build a card row from no printings");
  }
  const card = primary.card;
  const packCodes = ordered.map((copy) => copy.pack.code);
  // When has_errata is set, the payload text is the errata line. There is no second field.
  const errata = card.has_errata ? nullableText(card.text) : null;
  return rowFrom(cards, {
    code: card.code,
    name: card.name,
    pack_code: primary.pack.code,
    pack_codes: JSON.stringify(packCodes),
    type_code: card.type_code,
    type_name: card.type_name,
    sphere_code: nullableText(card.sphere_code),
    sphere_name: nullableText(card.sphere_name),
    position: card.position,
    traits: nullableText(card.traits),
    is_unique: bit(card.is_unique),
    cost: nullableText(card.cost),
    deck_limit: nullableInt(card.deck_limit),
    quantity: card.quantity,
    threat: nullableInt(card.threat),
    willpower: nullableInt(card.willpower),
    attack: nullableInt(card.attack),
    defense: nullableInt(card.defense),
    health: nullableInt(card.health),
    quest: nullableInt(card.quest),
    victory: nullableInt(card.victory),
    text: nullableText(card.text),
    has_errata: bit(card.has_errata),
    errata,
    imagesrc: nullableText(card.imagesrc),
    deck_legal: deckLegalBit(card),
    campaign_id: campaignIdFor(packCodes),
  });
}

function mergeCopy(groups: Map<string, CardCopy[]>, pack: RingsDbPack, card: RingsDbCard): void {
  const copies = groups.get(card.code) ?? [];
  const samePack = copies.find((copy) => copy.pack.code === pack.code);
  if (samePack) {
    assertRulesMatch(card.code, samePack.card, card);
    return;
  }
  const first = copies[0];
  if (first) assertRulesMatch(card.code, first.card, card);
  copies.push({ pack, card });
  groups.set(card.code, copies);
}

function createTableStatement(table: SQLiteTable): string {
  const config = getTableConfig(table);
  const columns = config.columns.map((column) => {
    const parts = [quoteIdent(column.name), column.getSQLType()];
    if (column.primary) parts.push("primary key");
    if (column.notNull) parts.push("not null");
    return parts.join(" ");
  });
  const foreignKeys = config.foreignKeys.map((foreignKey) => {
    const reference = foreignKey.reference();
    const localColumns = reference.columns.map((column) => quoteIdent(column.name)).join(", ");
    const foreignTable = quoteIdent(getTableConfig(reference.foreignTable).name);
    const foreignColumns = reference.foreignColumns.map((column) => quoteIdent(column.name)).join(", ");
    return `foreign key (${localColumns}) references ${foreignTable} (${foreignColumns})`;
  });
  return `create table ${quoteIdent(config.name)} (${[...columns, ...foreignKeys].join(", ")})`;
}

function tablesInCreateOrder(tables: SQLiteTable[]): SQLiteTable[] {
  const byName = new Map(tables.map((table) => [getTableConfig(table).name, table]));
  const ordered: SQLiteTable[] = [];
  const visiting = new Set<string>();

  function visit(table: SQLiteTable): void {
    const name = getTableConfig(table).name;
    if (ordered.some((item) => getTableConfig(item).name === name)) return;
    if (visiting.has(name)) {
      throw new Error(`Cycle in catalog foreign keys at ${name}`);
    }
    visiting.add(name);
    for (const foreignKey of getTableConfig(table).foreignKeys) {
      const targetName = getTableConfig(foreignKey.reference().foreignTable).name;
      const target = byName.get(targetName);
      if (target) visit(target);
    }
    visiting.delete(name);
    ordered.push(table);
  }

  for (const table of tables) visit(table);
  return ordered;
}

function insertRows(db: SqliteDatabase, table: SQLiteTable, rows: Row[]): void {
  if (rows.length === 0) return;
  const config = getTableConfig(table);
  const columnNames = config.columns.map((column) => quoteIdent(column.name));
  const sql = `insert into ${quoteIdent(config.name)} (${columnNames.join(", ")}) values (${columnNames.map(() => "?").join(", ")})`;
  const statement = db.prepare(sql);
  for (const row of rows) {
    statement.run(
      ...config.columns.map((column) => {
        const value = row[column.name];
        return value === undefined ? null : value;
      }),
    );
  }
}

function writeDatabase(filePath: string, built: { campaigns: Row[]; packs: Row[]; cards: Row[]; meta: Row[] }): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  const db = new Database(filePath);
  try {
    db.pragma("foreign_keys = ON");
    db.pragma("journal_mode = DELETE");
    for (const table of tablesInCreateOrder(catalogTables)) {
      db.exec(createTableStatement(table));
    }
    const insertAll = db.transaction(() => {
      insertRows(db, campaigns, built.campaigns);
      insertRows(db, packs, built.packs);
      insertRows(db, cards, built.cards);
      insertRows(db, meta, built.meta);
    });
    insertAll();
  } finally {
    db.close();
  }
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

function snapshotCatalog(dbPath: string): CatalogSnapshot | null {
  if (!existsSync(dbPath)) return null;
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  try {
    return {
      packs: canonicalRows(readRows(db, packs), "code", []),
      cards: canonicalRows(readRows(db, cards), "code", ["pack_codes"]),
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
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

function writeCatalogVersion(versionPath: string, version: number): void {
  const source = `export const CATALOG_VERSION = ${version};\n`;
  if (existsSync(versionPath) && readFileSync(versionPath, "utf8") === source) return;
  mkdirSync(path.dirname(versionPath), { recursive: true });
  writeFileSync(versionPath, source);
}

function nextVersion(previous: CatalogSnapshot | null, packRows: Row[], cardRows: Row[], versionPath: string): number {
  const current = readCatalogVersion(versionPath);
  if (!previous) return 1;
  const matches =
    previous.packs === canonicalRows(packRows, "code", []) &&
    previous.cards === canonicalRows(cardRows, "code", ["pack_codes"]);
  if (matches) return current ?? 1;
  return (current ?? 0) + 1;
}

function fetchedAtFor(manifest: Manifest, packCode: string): string {
  const fetchedAt = manifest[cardsCacheKey(packCode)];
  if (!fetchedAt || !DATE_PATTERN.test(fetchedAt)) {
    throw new Error(`Pack ${packCode} is missing a fetched_at date`);
  }
  return fetchedAt;
}

export async function buildCatalog(options: BuildCatalogOptions = {}): Promise<BuildCatalogResult> {
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const root = repoRoot();
  const cacheDir = options.cacheDir ?? path.join(root, ".cache", "ringsdb");
  const dbPath = options.dbPath ?? path.join(root, "assets", "catalog.db");
  const versionPath = options.versionPath ?? path.join(root, "src", "catalog", "version.ts");

  const manifest = readManifest(cacheDir);
  const packPayload = await loadPayload(fetchImpl, cacheDir, manifest, packsCacheKey(), PACKS_URL);
  const officialPacks = parseRingsDbPacks(packPayload).filter((pack) => !pack.name.startsWith(ALEP_PREFIX));

  const included: RingsDbPack[] = [];
  const groups = new Map<string, CardCopy[]>();
  for (const pack of officialPacks) {
    const payload = await loadPayload(fetchImpl, cacheDir, manifest, cardsCacheKey(pack.code), cardUrl(pack.code));
    const packCards = parseRingsDbCards(payload, pack.code);
    if (packCards.length === 0) continue;
    included.push(pack);
    for (const card of packCards) mergeCopy(groups, pack, card);
  }

  const packRows = [...included]
    .sort(comparePacks)
    .map((pack) =>
      rowFrom(packs, {
        code: pack.code,
        name: pack.name,
        position: pack.position,
        cycle_position: pack.cycle_position,
        available: availableFlag(pack.available),
      }),
    );
  const cardRows = [...groups.values()].map((copies) => cardRow(copies)).sort((left, right) => {
    return String(left.code).localeCompare(String(right.code));
  });
  const metaRows = included.map((pack) =>
    rowFrom(meta, {
      pack_code: pack.code,
      fetched_at: fetchedAtFor(manifest, pack.code),
    }),
  );
  const campaignRows = [
    rowFrom(campaigns, {
      id: FELLOWSHIP_CAMPAIGN_ID,
      name: "Fellowship of the Ring",
    }),
  ];

  const previous = snapshotCatalog(dbPath);
  const version = nextVersion(previous, packRows, cardRows, versionPath);
  // Write the version before replacing the database. A crash in between can skip
  // a number on the next run. A matching catalog still leaves the constant unchanged.
  writeCatalogVersion(versionPath, version);
  const temporaryPath = path.join(path.dirname(dbPath), `.${path.basename(dbPath)}.building`);
  rmSync(temporaryPath, { force: true });
  try {
    writeDatabase(temporaryPath, {
      campaigns: campaignRows,
      packs: packRows,
      cards: cardRows,
      meta: metaRows,
    });
    mkdirSync(path.dirname(dbPath), { recursive: true });
    renameSync(temporaryPath, dbPath);
  } catch (error) {
    rmSync(temporaryPath, { force: true });
    throw error;
  }

  return {
    version,
    packCount: packRows.length,
    cardCount: cardRows.length,
  };
}

function isMainModule(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  return path.resolve(entry) === fileURLToPath(import.meta.url);
}

if (isMainModule()) {
  void Promise.resolve()
    .then(() => buildCatalog())
    .then((result) => {
      console.log(`catalog ${result.version}: ${result.packCount} packs, ${result.cardCount} cards`);
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
