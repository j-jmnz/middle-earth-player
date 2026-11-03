import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Database from "better-sqlite3";
import { getTableConfig, type SQLiteTable } from "drizzle-orm/sqlite-core";

import { parseRingsDbPacks, type RingsDbPack } from "../../src/catalog/boundary.ts";
import type { Card } from "../../src/catalog/card-facts.ts";
import { campaignIndexSchema } from "../../src/catalog/scenario-data.ts";
import { campaigns, cards, catalogTables, meta, packs } from "../../src/catalog/schema.ts";
import { contentVersion, writeCatalogVersion } from "./catalog-version.ts";
import { catalogStamp } from "../../src/catalog/version.ts";
import { bytes, createLog, runScript } from "../log.ts";
import { PACK_CAMPAIGN } from "../data/campaign-defs.ts";
import { loadCards } from "../data/load-cards.ts";
import { DATA_DIR } from "../data/paths.ts";
import { parseLedger } from "../data/printed/ledger.ts";

const log = createLog("catalog:build");

type SqliteDatabase = InstanceType<typeof Database>;
type SqlValue = string | number | bigint | Buffer | null;
type Row = Record<string, SqlValue>;

function quoteIdent(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

// Offline: data/cards and data/raw/ringsdb/packs.json in, assets/catalog.db out. Scenarios and effect records
// are not in the database: the app imports them from data/ and src/effects.
export type BuildCatalogOptions = {
  dataDir?: string;
  dbPath?: string;
  versionPath?: string;
  cards?: readonly Card[];
};

export type BuildCatalogResult = {
  version: number;
  packCount: number;
  cardCount: number;
};

function repoRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
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

// The scan each ledgered card side was read from (data/printed), by code: side A's in `fronts`, side B's in `backs`. Each is pinned in
// data/sources.json.
function ledgerScans(dataDir: string): { fronts: Map<string, string>; backs: Map<string, string> } {
  const fronts = new Map<string, string>();
  const backs = new Map<string, string>();
  const dir = path.join(dataDir, "printed");
  if (!existsSync(dir)) return { fronts, backs };
  for (const name of readdirSync(dir).filter((file) => file.endsWith(".json")).sort()) {
    const ledger = parseLedger(JSON.parse(readFileSync(path.join(dir, name), "utf8")) as unknown);
    for (const entry of ledger.entries) (entry.side === "A" ? fronts : backs).set(entry.code, entry.scan.url);
  }
  return { fronts, backs };
}

// The picture the phone downloads: RingsDB's `imagesrc` path. A card RingsDB has no picture for (quest and encounter cards)
// gets the full URL of its scan instead: the ledgered front, else the Hall of Beorn front of its MEC109 printing, else of
// another printing (docs/brief.md, Card images).
export function pictureOf(card: Card, fronts: ReadonlyMap<string, string>): string | null {
  if (card.imagesrc) return card.imagesrc;
  const ledgered = fronts.get(card.code);
  if (ledgered) return ledgered;
  const printings = [...card.printings].sort((left, right) => Number(right.pack === "TFotR") - Number(left.pack === "TFotR"));
  const urls = printings.flatMap((printing) => printing.imageUrls ?? []);
  return urls.find((url) => !url.includes("dragncards")) ?? urls[0] ?? null;
}

// The side B picture the phone downloads for a card lying on its B side (a quest stage, a campaign card, an Upgraded ship): the ledgered
// back, else a back from `imageUrls` (a Hall of Beorn quest stage's `<name>-<stage>B.jpg`, then a DragnCards `<guid>.B.jpg`), else none
// (docs/brief.md, Card images).
export function backPictureOf(card: Card, backs: ReadonlyMap<string, string>): string | null {
  const ledgered = backs.get(card.code);
  if (ledgered) return ledgered;
  const urls = card.printings.flatMap((printing) => printing.imageUrls ?? []);
  return urls.find((url) => url.includes("hallofbeorn") && /-\d+B\.jpg$/.test(url)) ?? urls.find((url) => url.includes("dragncards") && url.endsWith(".B.jpg")) ?? null;
}

// A card belongs to the campaign of the first catalog pack it is printed in that PACK_CAMPAIGN lists (a Fellowship card also in the
// Starter box keeps its tag). A player card of the Core Set is also printed in the Revised Core Set and belongs to no campaign.
function campaignOfPacks(packCodes: readonly string[]): string | null {
  if (packCodes.includes("Core")) return null;
  for (const code of packCodes) {
    const campaign = PACK_CAMPAIGN.get(code);
    if (campaign) return campaign;
  }
  return null;
}

// The stats of the Upgraded side, when the card has them all (dcce.scalable-upgradable).
function upgradedOf(card: Card): string | null {
  const back = card.back;
  // A location's other side prints a Threat and no combat stats (the Temple of the Deceived side of a map location; dcce.uncharted).
  if (back?.threat != null && back.attack == null && back.defense == null && back.health == null) return JSON.stringify({ threat: back.threat, attack: 0, defense: 0, health: 0 });
  if (back?.attack == null || back.defense == null || back.health == null) return null;
  return JSON.stringify({ ...(back.willpower != null ? { willpower: back.willpower } : {}), ...(back.threat != null ? { threat: back.threat } : {}), ...(back.engagementCost != null ? { engagementCost: back.engagementCost } : {}), attack: back.attack, defense: back.defense, health: back.health, ...(back.victory != null ? { victory: back.victory } : {}) });
}

function cardRow(card: Card, knownPacks: ReadonlySet<string>, scans: { fronts: ReadonlyMap<string, string>; backs: ReadonlyMap<string, string> }): Row {
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
    encounter_set: card.encounterSet,
    campaign_kind: card.campaignKind,
    burden_set: card.burdenSet,
    back_type: card.backType,
    keywords: card.keywords ? JSON.stringify(card.keywords) : null,
    upgraded: upgradedOf(card),
    text: card.text,
    has_errata: bit(card.hasErrata),
    errata: card.errata,
    imagesrc: pictureOf(card, scans.fronts),
    back_imagesrc: backPictureOf(card, scans.backs),
    deck_legal: bit(card.deckLegal),
    campaign_id: campaignOfPacks(packCodes),
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
  built: { campaigns: Row[]; packs: Row[]; cards: Row[]; meta: Row[] },
  version: number,
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
      insertRows(db, meta, built.meta);
    });
    insertAll();
    db.pragma(`user_version = ${catalogStamp(version)}`);
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
  const allCards = options.cards ?? log.step("read data/cards", () => loadCards(dataDir));

  const allPacks = parseRingsDbPacks(JSON.parse(readFileSync(path.join(dataDir, "raw", "ringsdb", "packs.json"), "utf8")) as unknown);
  const used = new Set(allCards.flatMap((card) => card.printings.map((printing) => printing.pack)));
  const included = allPacks.filter((pack) => used.has(pack.code));
  const knownPacks = new Set(included.map((pack) => pack.code));
  log.info(`${allCards.length} cards; ${included.length} of RingsDB's ${allPacks.length} packs carry them`);
  const unlisted = [...used].filter((pack) => !knownPacks.has(pack)).sort();
  if (unlisted.length > 0) log.debug(`printings in packs RingsDB does not list (kept on the card, not as catalog packs): ${unlisted.join(", ")}`);


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
  const scans = ledgerScans(dataDir);
  const cardRows = allCards.map((card) => cardRow(card, knownPacks, scans)).sort((left, right) => String(left.code).localeCompare(String(right.code)));
  const day = fetchedDay(dataDir);
  const metaRows = included.map((pack) => rowFrom(meta, { pack_code: pack.code, fetched_at: day }));
  const campaignRows = campaignIndexSchema
    .parse(JSON.parse(readFileSync(path.join(dataDir, "campaigns", "index.json"), "utf8")) as unknown)
    .map((entry) => rowFrom(campaigns, { id: entry.id, name: entry.name, scenario_count: entry.scenarioCount, playable: bit(entry.playable) }));

  const version = contentVersion([packRows, cardRows, campaignRows]);
  const before = existsSync(versionPath) ? /CATALOG_VERSION = (\d+);/.exec(readFileSync(versionPath, "utf8"))?.[1] : undefined;
  // The version is written before the database is replaced. A crash in between leaves a number the next run rewrites.
  writeCatalogVersion(versionPath, version);
  // A path under the repository reads relative to it; a temporary build (tests, fixtures) keeps its full path.
  const shown = (file: string) => (path.relative(root, file).startsWith("..") ? file : path.relative(root, file));
  if (before === String(version)) log.info(`version ${version}, unchanged`);
  else if (options.versionPath) log.info(`version ${before ?? "none"} -> ${version} in ${shown(versionPath)}`);
  else log.info(`version ${before ?? "none"} -> ${version}: commit ${shown(versionPath)}`);
  const temporaryPath = path.join(path.dirname(dbPath), `.${path.basename(dbPath)}.building`);
  rmSync(temporaryPath, { force: true });
  try {
    writeDatabase(temporaryPath, {
      campaigns: campaignRows,
      packs: packRows,
      cards: cardRows,
      meta: metaRows,
    }, version);
    mkdirSync(path.dirname(dbPath), { recursive: true });
    renameSync(temporaryPath, dbPath);
    log.info(`wrote ${shown(dbPath)} (${bytes(statSync(dbPath).size)}): ${packRows.length} packs, ${cardRows.length} cards, ${campaignRows.length} campaigns, ${metaRows.length} meta rows`);
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

if (isMainModule()) void runScript("catalog:build", () => void buildCatalog());
