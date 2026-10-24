import { traitTokens } from "../catalog/deck-save.ts";
import type { cards } from "../catalog/schema.ts";
import { printedFromCard, type PrintedCard } from "../rules/printed.ts";

// A catalog.db row, as the phone reads it. The screens query the codes a screen needs and build the engine's cards here,
// so the phone never reads data/cards at runtime. The catalog keeps the same fields as data/cards that the engine reads.
export type CatalogRow = typeof cards.$inferSelect;

function kindOf(value: string | null): "boon" | "burden" | null {
  return value === "boon" || value === "burden" ? value : null;
}

function backOf(value: string | null): "player" | "encounter" | null {
  return value === "player" || value === "encounter" ? value : null;
}

export function printedFromRow(row: CatalogRow): PrintedCard {
  return printedFromCard({
    code: row.code,
    name: row.name,
    type: row.typeCode,
    traits: traitTokens(row.traits),
    sphere: row.sphereCode,
    cost: row.cost,
    threat: row.threat,
    willpower: row.willpower,
    attack: row.attack,
    defense: row.defense,
    health: row.health,
    questPoints: row.quest,
    victory: row.victory,
    isUnique: row.isUnique,
    engagementCost: row.engagementCost,
    keywords: row.keywords,
    campaignKind: kindOf(row.campaignKind),
    burdenSet: row.burdenSet,
    backType: backOf(row.backType),
  });
}

// Every card of a list of rows, keyed by code. A row whose type the engine does not know (a nightmare card) is left out.
export function printedMap(rows: readonly CatalogRow[]): Map<string, PrintedCard> {
  const map = new Map<string, PrintedCard>();
  for (const row of rows) {
    try {
      map.set(row.code, printedFromRow(row));
    } catch {
      // The briefing and the log never deal a card the engine cannot print.
    }
  }
  return map;
}
