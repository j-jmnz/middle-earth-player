import { sql } from "drizzle-orm";
import { check, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export type DeckCard = {
  code: string;
  count: number;
};

export type StoredJson =
  | string
  | number
  | boolean
  | null
  | StoredJson[]
  | { [key: string]: StoredJson };

export const decks = sqliteTable("decks", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  heroes: text("heroes", { mode: "json" }).$type<string[]>().notNull(),
  cards: text("cards", { mode: "json" }).$type<DeckCard[]>().notNull(),
});

export const saves = sqliteTable("saves", {
  id: text("id").primaryKey(),
  campaignId: text("campaign_id").notNull(),
  seatCount: integer("seat_count").notNull(),
  log: text("log", { mode: "json" }).$type<StoredJson>().notNull(),
  pool: text("pool", { mode: "json" }).$type<StoredJson>().notNull(),
  // { engineVersion, dataHash, seed, intents }, replayed through the reducer on load (src/campaign/replay.ts).
  activeScenario: text("active_scenario", { mode: "json" }).$type<StoredJson | null>(),
  // What the briefing chose for the open scenario (src/campaign/save.ts StoredLoadout), so a relaunch rebuilds the same start.
  loadout: text("loadout", { mode: "json" }).$type<StoredJson | null>(),
});

// One row per stored booklet PDF. `path` is relative to the document directory (booklets/<id>.pdf), so the row survives
// the system moving the app container. `lastPage` is 1-based.
export const booklets = sqliteTable("booklets", {
  id: text("id").primaryKey(),
  path: text("path").notNull(),
  originalFilename: text("original_filename").notNull(),
  byteSize: integer("byte_size").notNull(),
  sha256: text("sha256").notNull(),
  pageCount: integer("page_count").notNull(),
  lastPage: integer("last_page").notNull().default(1),
});

export const imageFiles = sqliteTable("image_files", {
  code: text("code").primaryKey(),
  path: text("path"),
  width: integer("width"),
  height: integer("height"),
  byteSize: integer("byte_size"),
  mediaType: text("media_type"),
  sha256: text("sha256"),
});

export const meta = sqliteTable(
  "meta",
  {
    id: integer("id").primaryKey(),
    appliedCatalogVersion: integer("applied_catalog_version"),
  },
  (table) => [check("meta_id_check", sql`${table.id} = 1`)],
);
