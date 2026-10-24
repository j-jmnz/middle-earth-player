import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { DatabaseSync } from "node:sqlite";

import { scenarioDefinitionSchema, type ScenarioDefinition } from "../src/catalog/boundary.ts";
import { parseKeywords, type CatalogCardRow } from "../src/catalog/card-row.ts";
import { printedFromRow } from "../src/rules/catalog-row.ts";
import type { PrintedCard } from "../src/rules/printed.ts";

// Test helper. Reads the built assets/catalog.db. It lives under scripts/, outside the app bundle,
// and never builds the catalog: run pnpm catalog:build (CI runs ensure-catalog first).
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dbPath = path.join(root, "assets", "catalog.db");

type RawRow = Record<string, string | number | bigint | Uint8Array | null>;

function openCatalog(): DatabaseSync {
  if (!existsSync(dbPath)) {
    throw new Error(`assets/catalog.db is missing. Run pnpm catalog:build, then run the tests again.`);
  }
  return new DatabaseSync(dbPath, { readOnly: true });
}

function text(value: RawRow[string] | undefined): string | null {
  return typeof value === "string" ? value : null;
}

function int(value: RawRow[string] | undefined): number | null {
  return typeof value === "number" ? value : typeof value === "bigint" ? Number(value) : null;
}

function toRow(raw: RawRow): CatalogCardRow {
  return {
    code: String(raw.code),
    name: String(raw.name),
    typeCode: String(raw.type_code),
    sphereCode: text(raw.sphere_code),
    traits: text(raw.traits),
    isUnique: int(raw.is_unique) === 1,
    cost: text(raw.cost),
    threat: int(raw.threat),
    willpower: int(raw.willpower),
    attack: int(raw.attack),
    defense: int(raw.defense),
    health: int(raw.health),
    quest: int(raw.quest),
    victory: int(raw.victory),
    engagementCost: int(raw.engagement_cost),
    keywords: parseKeywords(raw.keywords),
  };
}

export async function loadPrinted(codes: readonly string[]): Promise<ReadonlyMap<string, PrintedCard>> {
  const database = openCatalog();
  try {
    const statement = database.prepare("select * from cards where code = ?");
    const cards = new Map<string, PrintedCard>();
    for (const code of codes) {
      const raw = statement.get(code);
      if (!raw) throw new Error(`Catalog has no card ${code}`);
      cards.set(code, printedFromRow(toRow(raw as RawRow)));
    }
    return cards;
  } finally {
    database.close();
  }
}

export async function loadDefinition(id: string): Promise<ScenarioDefinition> {
  const database = openCatalog();
  try {
    const raw = database.prepare("select definition from scenarios where id = ?").get(id);
    if (!raw) throw new Error(`Catalog has no scenario ${id}`);
    return scenarioDefinitionSchema.parse(JSON.parse(String(raw.definition)));
  } finally {
    database.close();
  }
}
