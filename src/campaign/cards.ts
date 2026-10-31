// Rules: rr.campaign-cards, rr.boons, rr.burdens (data/rules/entries.json).
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
    encounterSet: row.encounterSet,
  });
}

// The row the engine cannot print (a nightmare card), with why. Undefined when it prints.
export function unprintable(row: CatalogRow): string | undefined {
  try {
    printedFromRow(row);
    return undefined;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

// The campaign card is read as effect records (campaignSetup, resolution), never dealt as an engine card, so a scenario's
// code list names it and the map leaves it out on purpose. Every other row must print.
const NOT_AN_ENGINE_CARD: ReadonlySet<string> = new Set(["campaign"]);

// Every card of a list of rows, keyed by code. The briefing, the log and a deal name only cards the engine prints, so a row
// it cannot print is a data fault: it throws, naming every such code, instead of leaving the card out of the map.
export function printedMap(rows: readonly CatalogRow[]): Map<string, PrintedCard> {
  const map = new Map<string, PrintedCard>();
  const faults: string[] = [];
  for (const row of rows) {
    if (NOT_AN_ENGINE_CARD.has(row.typeCode)) continue;
    const why = unprintable(row);
    if (why) faults.push(`${row.code} ${row.name}: ${why}`);
    else map.set(row.code, printedFromRow(row));
  }
  if (faults.length > 0) throw new Error(`Cards the engine cannot print: ${faults.join("; ")}`);
  return map;
}
