import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { DatabaseSync } from "node:sqlite";

import { scenarioDefinitionSchema, type ScenarioDefinition } from "../src/catalog/boundary.ts";
import { printedFromCard, type PrintedCard } from "../src/rules/printed.ts";

import { loadCards } from "./data/load-cards.ts";

// Test helper. Cards come from data/cards; scenario definitions still come from the built assets/catalog.db. It lives under scripts/, outside the app bundle,
// and never builds the catalog: run pnpm catalog:build (CI runs ensure-catalog first).
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dbPath = path.join(root, "assets", "catalog.db");

function openCatalog(): DatabaseSync {
  if (!existsSync(dbPath)) {
    throw new Error(`assets/catalog.db is missing. Run pnpm catalog:build, then run the tests again.`);
  }
  return new DatabaseSync(dbPath, { readOnly: true });
}

export async function loadPrinted(codes: readonly string[]): Promise<ReadonlyMap<string, PrintedCard>> {
  const byCode = new Map(loadCards().map((card) => [card.code, card]));
  const cards = new Map<string, PrintedCard>();
  for (const code of codes) {
    const card = byCode.get(code);
    if (!card) throw new Error(`data/cards has no card ${code}`);
    cards.set(code, printedFromCard(card));
  }
  return cards;
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
