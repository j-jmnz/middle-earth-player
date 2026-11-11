import { integer, sqliteTable, text, type SQLiteTable } from "drizzle-orm/sqlite-core";

import type { PrintedKeywords } from "./boundary.ts";

/** The stats the other side of a double-sided card prints in place of its front's: the Upgraded side of a ship-objective (dcce.scalable-upgradable), the Stormcaller's Campaign Mode only side, which adds its Victory and prints no Willpower (an enemy has none). */
export type UpgradedStats = { willpower?: number; threat?: number; engagementCost?: number; attack: number; defense: number; health: number; victory?: number };

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
  scenarioCount: integer("scenario_count").notNull(),
  // False for a campaign the list shows locked: no scenario of it is built.
  playable: integer("playable", { mode: "boolean" }).notNull(),
  // "campaign" (the Campaigns tab lists it) or "cycle" (scenarios that are part of no campaign: the Scenarios tab only).
  kind: text("kind", { enum: ["campaign", "cycle"] }).notNull(),
  // True for the revised, repackaged products (RCO), which the hubs tag "RCO".
  rco: integer("rco", { mode: "boolean" }).notNull(),
  // The RCO product a locked campaign is printed in, the Scenarios tab's name for its tile; null for a built campaign or a cycle.
  box: text("box"),
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
  engagementCost: integer("engagement_cost"),
  // The encounter set a card belongs to, and the campaign-card facts the engine reads (boon or burden, its burden set,
  // and the deck it joins when it is in the campaign pool).
  encounterSet: text("encounter_set"),
  campaignKind: text("campaign_kind"),
  burdenSet: text("burden_set"),
  backType: text("back_type"),
  // Null until the card's keywords have been read. An empty object means none.
  keywords: text("keywords", { mode: "json" }).$type<PrintedKeywords>(),
  // The stats the Upgraded side of a ship-objective prints (dcce.scalable-upgradable): the engine reads them for a card dealt on side B.
  upgraded: text("upgraded", { mode: "json" }).$type<UpgradedStats>(),
  text: text("text"),
  hasErrata: integer("has_errata", { mode: "boolean" }).notNull(),
  errata: text("errata"),
  // The picture to download: a RingsDB path, or the full Hall of Beorn or DragnCards scan URL where RingsDB has none.
  imagesrc: text("imagesrc"),
  // Side B's picture to download, for a card the table shows on its B side (a quest stage, a campaign card): a scan URL, or null when no source has one.
  backImagesrc: text("back_imagesrc"),
  deckLegal: integer("deck_legal", { mode: "boolean" }).notNull(),
  campaignId: text("campaign_id").references(() => campaigns.id),
});

export const meta = sqliteTable("meta", {
  packCode: text("pack_code").primaryKey(),
  fetchedAt: text("fetched_at").notNull(),
});

export const catalogTables: SQLiteTable[] = [packs, campaigns, cards, meta];
