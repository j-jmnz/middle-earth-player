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
  // When the player last saved the deck (ms since the epoch). The deck list puts the one saved last first. Starter rows
  // and rows from before 0005 read null and follow.
  updatedAt: integer("updated_at"),
  // Where the player dragged the deck in the deck list (0 is first). Null until a reorder writes every deck's position: a deck
  // with no position (new, imported, duplicated) leads the list, and saving a deck keeps its position.
  position: integer("position"),
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
  // When the player put the playthrough away (ms since the epoch). An archived save leaves the campaign list's open
  // playthroughs and keeps its log and its open scenario; restoring clears it.
  archivedAt: integer("archived_at"),
  // When the save was last written (ms since the epoch): a deal, an intent, a resolution, the notes. The campaign list puts
  // the one written last first, as Current. Archive and Restore do not write it. Rows from before 0003 read null.
  updatedAt: integer("updated_at"),
});

// One row per standalone game: one deal of one scenario, outside any campaign (src/campaign/standalone.ts). No log and no
// pool: `loadout` is what was dealt, `activeScenario` the open game's seed and intents, `result` how it ended.
export const standaloneGames = sqliteTable("standalone_games", {
  id: text("id").primaryKey(),
  // The box the scenario is from ("fellowship-of-the-ring").
  campaignId: text("campaign_id").notNull(),
  scenarioId: text("scenario_id").notNull(),
  seatCount: integer("seat_count").notNull(),
  loadout: text("loadout", { mode: "json" }).$type<StoredJson>().notNull(),
  activeScenario: text("active_scenario", { mode: "json" }).$type<StoredJson | null>(),
  result: text("result", { mode: "json" }).$type<StoredJson | null>(),
  // When it was dealt (ms since the epoch); the list shows the newest first.
  createdAt: integer("created_at").notNull(),
  // When the player put it away. An archived game keeps everything and comes back as it was on restore.
  archivedAt: integer("archived_at"),
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

// App-wide settings, one JSON value per key. "table": the table's settings (src/ui/table-settings.ts): stops, free
// Responses always used, readability, the first-game guide.
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value", { mode: "json" }).$type<StoredJson>().notNull(),
});

// One row per scenario that ended, won or lost, campaign or standalone (src/campaign/runs.ts). It is written beside the campaign
// log, never inside it, and never rewritten. It has no foreign key: deleting a save or a game keeps its runs. A null field is
// one a back-filled row could not know.
export const runs = sqliteTable("runs", {
  id: text("id").primaryKey(),
  kind: text("kind").$type<"campaign" | "standalone">().notNull(),
  // The save id (campaign) or the standalone game id.
  refId: text("ref_id").notNull(),
  campaignId: text("campaign_id"),
  box: text("box").notNull(),
  scenarioId: text("scenario_id").notNull(),
  result: text("result").$type<"won" | "lost">().notNull(),
  lossCause: text("loss_cause"),
  seatCount: integer("seat_count").notNull(),
  heroes: text("heroes", { mode: "json" }).$type<string[][]>().notNull(),
  rounds: integer("rounds"),
  threats: text("threats", { mode: "json" }).$type<number[] | null>(),
  victoryPoints: integer("victory_points"),
  score: integer("score"),
  reward: text("reward", { mode: "json" }).$type<string[] | null>(),
  startedAt: integer("started_at"),
  endedAt: integer("ended_at"),
  activeMs: integer("active_ms"),
  engineVersion: integer("engine_version"),
  backfilled: integer("backfilled", { mode: "boolean" }).notNull().default(false),
});

export const meta = sqliteTable(
  "meta",
  {
    id: integer("id").primaryKey(),
    appliedCatalogVersion: integer("applied_catalog_version"),
  },
  (table) => [check("meta_id_check", sql`${table.id} = 1`)],
);
