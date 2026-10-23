import { integer, sqliteTable, text, type SQLiteTable } from "drizzle-orm/sqlite-core";

export const packs = sqliteTable("packs", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  position: integer("position").notNull(),
  cyclePosition: integer("cycle_position").notNull(),
  available: integer("available", { mode: "boolean" }).notNull(),
});

export const campaigns = sqliteTable("campaigns", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
});

export const cards = sqliteTable("cards", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  packCode: text("pack_code").notNull(),
  packCodes: text("pack_codes", { mode: "json" }).$type<string[]>().notNull(),
  typeCode: text("type_code").notNull(),
  typeName: text("type_name").notNull(),
  sphereCode: text("sphere_code"),
  sphereName: text("sphere_name"),
  position: integer("position").notNull(),
  traits: text("traits"),
  isUnique: integer("is_unique", { mode: "boolean" }).notNull(),
  cost: text("cost"),
  deckLimit: integer("deck_limit"),
  quantity: integer("quantity").notNull(),
  threat: integer("threat"),
  willpower: integer("willpower"),
  attack: integer("attack"),
  defense: integer("defense"),
  health: integer("health"),
  quest: integer("quest"),
  victory: integer("victory"),
  text: text("text"),
  hasErrata: integer("has_errata", { mode: "boolean" }).notNull(),
  errata: text("errata"),
  imagesrc: text("imagesrc"),
  deckLegal: integer("deck_legal", { mode: "boolean" }).notNull(),
  campaignId: text("campaign_id").references(() => campaigns.id),
});

export const effects = sqliteTable("effects", {
  id: text("id").primaryKey(),
  record: text("record").notNull(),
});

export const scenarios = sqliteTable("scenarios", {
  id: text("id").primaryKey(),
  definition: text("definition").notNull(),
});

export const meta = sqliteTable("meta", {
  packCode: text("pack_code").primaryKey(),
  fetchedAt: text("fetched_at").notNull(),
});

export const catalogTables: SQLiteTable[] = [packs, campaigns, cards, effects, scenarios, meta];
