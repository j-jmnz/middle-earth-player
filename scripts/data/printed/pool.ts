import type { Card } from "../../../src/catalog/card-facts.ts";
import { poolSides } from "../../../src/catalog/pool-lines.ts";
import { keyOf, type Ledger, type LedgerEntry } from "./ledger.ts";

// The player pool's printed lines. Every deck-legal player card is automated (user decision, 2026-10-26), and the cards
// outside the box have no scan-read ledger entry: their lines are their source text (RingsDB, Hall of Beorn), written to
// the ledger's conventions (one ability per line, icons as words, no markup). A card the box ledger holds keeps its entry.

export const PLAYER_TYPES: ReadonlySet<string> = new Set(["hero", "ally", "attachment", "event", "player-side-quest", "contract"]);

export function isPoolCard(card: Card): boolean {
  return card.deckLegal && PLAYER_TYPES.has(card.type);
}

function entry(card: Card, side: "A" | "B", lines: string[]): LedgerEntry {
  return {
    code: card.code,
    side,
    printing: card.printings[0]?.pack ?? "RingsDB",
    // Not read from a scan: there is no pinned file. The image the catalog shows is the reference.
    scan: { url: card.printings[0]?.imageUrls?.[0] ?? `https://ringsdb.com/bundles/cards/${card.code}.png`, sha256: "" },
    lines,
    inert: [],
    misprints: [],
    readBy: "card text (RingsDB and Hall of Beorn), not read from a scan",
    confirmedBy: null,
  };
}

// The box ledger plus an entry for each side of every pool card it does not hold.
export function withPool(ledger: Ledger, cards: readonly Card[]): Ledger {
  const entries = [...ledger.entries];
  const byKey = new Map(ledger.byKey);
  for (const card of cards) {
    if (!isPoolCard(card) || byKey.has(keyOf(card.code, "A"))) continue;
    const sides = poolSides(card);
    for (const side of ["A", "B"] as const) {
      if (sides[side].length === 0) continue;
      const made = entry(card, side, sides[side]);
      entries.push(made);
      byKey.set(keyOf(card.code, side), made);
    }
  }
  return { campaign: ledger.campaign, entries, byKey };
}

// Whether a ledger entry was read from a scan (the box) or made from source text (the pool).
export function fromScan(entry: LedgerEntry): boolean {
  return entry.scan.sha256 !== "";
}
