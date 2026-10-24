import { mkdirSync, readFileSync, renameSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Database from "better-sqlite3";
import { getTableConfig, type SQLiteTable } from "drizzle-orm/sqlite-core";

import { parseRingsDbPacks, type Effect, type RingsDbPack } from "../src/catalog/boundary.ts";
import type { Card } from "../src/catalog/card-facts.ts";
import { EFFECTS } from "../src/effects/index.ts";
import { campaigns, cards, catalogTables, effects as effectsTable, meta, packs, scenarios } from "../src/catalog/schema.ts";
import { nextVersion, quoteIdent, snapshotCatalog, writeCatalogVersion, type Row, type SqlValue } from "./catalog-snapshot.ts";
import { loadCards } from "./data/load-cards.ts";
import { DATA_DIR } from "./data/paths.ts";
import { joinScenarioFixtures } from "./join-scenario-fixtures.ts";
import { validateEffects } from "./validate-effects.ts";

const FELLOWSHIP_CAMPAIGN_ID = "fellowship-of-the-ring";
const FELLOWSHIP_PACK_CODES = new Set(["TBR", "TRD"]);

type SqliteDatabase = InstanceType<typeof Database>;

// Offline: data/cards and data/raw/ringsdb/packs.json in, assets/catalog.db out.
export type BuildCatalogOptions = {
  dataDir?: string;
  dbPath?: string;
  versionPath?: string;
  fixturesDir?: string;
  cards?: readonly Card[];
  effects?: readonly Effect[];
};

export type BuildCatalogResult = {
  version: number;
  packCount: number;
  cardCount: number;
};

function repoRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
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

function bit(value: boolean): number {
  return value ? 1 : 0;
}

// RingsDB `available` is a release date. The column stores whether that date is present.
function availableFlag(releaseDate: string): number {
  return releaseDate.trim() === "" ? 0 : 1;
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

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function cardRow(card: Card, knownPacks: ReadonlySet<string>): Row {
  const primary = card.printings[0];
  if (!primary) throw new Error(`Card ${card.code} has no printing`);
  // Printings from packs the pack list does not know (the MEC109 box) are not catalog packs.
  const packCodes = card.printings.map((printing) => printing.pack).filter((pack) => knownPacks.has(pack));
  return rowFrom(cards, {
    code: card.code,
    name: card.name,
    pack_code: primary.pack,
    pack_codes: JSON.stringify(packCodes),
    type_code: card.type,
    type_name: card.typeName,
    sphere_code: card.sphere,
    sphere_name: card.sphere ? capitalize(card.sphere) : null,
    position: primary.number,
    traits: card.traits.length > 0 ? `${card.traits.join(". ")}.` : null,
    is_unique: bit(card.isUnique),
    cost: card.cost,
    deck_limit: card.deckLimit,
    quantity: card.quantity,
    threat: card.threat,
    willpower: card.willpower,
    attack: card.attack,
    defense: card.defense,
    health: card.health,
    quest: card.questPoints,
    victory: card.victory,
    engagement_cost: card.engagementCost,
    keywords: card.keywords ? JSON.stringify(card.keywords) : null,
    text: card.text,
    has_errata: bit(card.hasErrata),
    errata: card.errata,
    imagesrc: card.imagesrc,
    deck_legal: bit(card.deckLegal),
    campaign_id: packCodes.some((code) => FELLOWSHIP_PACK_CODES.has(code)) ? FELLOWSHIP_CAMPAIGN_ID : null,
  });
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

function writeDatabase(
  filePath: string,
  built: { campaigns: Row[]; packs: Row[]; cards: Row[]; effects: Row[]; scenarios: Row[]; meta: Row[] },
): void {
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
      insertRows(db, effectsTable, built.effects);
      insertRows(db, scenarios, built.scenarios);
      insertRows(db, meta, built.meta);
    });
    insertAll();
  } finally {
    db.close();
  }
}

function fetchedDay(dataDir: string): string {
  const sources = JSON.parse(readFileSync(path.join(dataDir, "sources.json"), "utf8")) as { sources: Record<string, { fetchedAt: string }> };
  const fetchedAt = sources.sources.ringsdb?.fetchedAt;
  if (!fetchedAt) throw new Error("data/sources.json has no ringsdb fetchedAt. Run pnpm data:sync.");
  return fetchedAt.slice(0, 10);
}

export function buildCatalog(options: BuildCatalogOptions = {}): BuildCatalogResult {
  const root = repoRoot();
  const dataDir = options.dataDir ?? DATA_DIR;
  const dbPath = options.dbPath ?? path.join(root, "assets", "catalog.db");
  const versionPath = options.versionPath ?? path.join(root, "src", "catalog", "version.ts");
  const fixturesDir = options.fixturesDir ?? path.join(root, "fixtures");
  const effectRecords = validateEffects(options.effects ?? EFFECTS);
  const allCards = options.cards ?? loadCards(dataDir);

  const allPacks = parseRingsDbPacks(JSON.parse(readFileSync(path.join(dataDir, "raw", "ringsdb", "packs.json"), "utf8")) as unknown);
  const used = new Set(allCards.flatMap((card) => card.printings.map((printing) => printing.pack)));
  const included = allPacks.filter((pack) => used.has(pack.code));
  const knownPacks = new Set(included.map((pack) => pack.code));

  const cardsByCode = new Map(allCards.map((card) => [card.code, card]));
  const definitions = joinScenarioFixtures(fixturesDir, cardsByCode);

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
  const cardRows = allCards.map((card) => cardRow(card, knownPacks)).sort((left, right) => String(left.code).localeCompare(String(right.code)));
  const day = fetchedDay(dataDir);
  const metaRows = included.map((pack) => rowFrom(meta, { pack_code: pack.code, fetched_at: day }));
  const campaignRows = [rowFrom(campaigns, { id: FELLOWSHIP_CAMPAIGN_ID, name: "Fellowship of the Ring" })];
  const scenarioRows = definitions.map((definition) => rowFrom(scenarios, { id: definition.id, definition: JSON.stringify(definition) }));
  const effectRows = effectRecords.map((effect) => rowFrom(effectsTable, { id: effect.id, record: JSON.stringify(effect) }));

  const previous = snapshotCatalog(dbPath);
  const version = nextVersion(previous, packRows, cardRows, effectRows, scenarioRows, versionPath);
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
      effects: effectRows,
      scenarios: scenarioRows,
      meta: metaRows,
    });
    mkdirSync(path.dirname(dbPath), { recursive: true });
    renameSync(temporaryPath, dbPath);
  } catch (error) {
    rmSync(temporaryPath, { force: true });
    throw error;
  }

  return { version, packCount: packRows.length, cardCount: cardRows.length };
}

function isMainModule(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  return path.resolve(entry) === fileURLToPath(import.meta.url);
}

if (isMainModule()) {
  try {
    const result = buildCatalog();
    console.log(`catalog ${result.version}: ${result.packCount} packs, ${result.cardCount} cards`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
