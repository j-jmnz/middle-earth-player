import { describe, expect, it } from "vitest";

import { keyOf, loadLedger, verifyScans } from "./printed/ledger.ts";
import { starterPrints } from "../../src/screens/starter-decks.ts";
import { KNOWN_ERRORS, MEC109_CHANGED, scanTargets, scopeCodes, starterCodes } from "./printed/scope.ts";

// The printed-text ledger (data/printed): every card in scope is read from a pinned scan.
const ledger = loadLedger();

describe("ledger scope", () => {
  it("reads every starter code that src/screens/starter-decks.ts lists", () => {
    // starterCodes() reads the file as text, because Node cannot load its Drizzle import. This keeps the two in step.
    expect(starterCodes()).toEqual([...new Set(starterPrints.map((row) => row.code))].sort());
  });
});

describe("printed-text ledger", () => {
  it("has an entry for each side of each card in scope", () => {
    const missing = scanTargets().filter((target) => !ledger.byKey.has(keyOf(target.code, target.side))).map((target) => `${target.code}.${target.side}`);
    expect(missing).toEqual([]);
    expect(scopeCodes().length).toBeGreaterThan(80);
  });

  it("names exactly the scans data/sources.json pins", () => {
    expect(verifyScans(ledger)).toEqual([]);
  });

  it("writes apostrophes and plain quotes, one reading per line", () => {
    for (const entry of ledger.entries) {
      for (const line of entry.lines) {
        expect(line, `${entry.code}.${entry.side}`).not.toMatch(/[`‘’“”]/);
        expect(line.trim(), `${entry.code}.${entry.side}`).toBe(line);
      }
    }
  });

  it("settles the nine MEC109 changes from named sources", () => {
    expect(MEC109_CHANGED).toHaveLength(9);
    for (const code of MEC109_CHANGED) {
      const entry = ledger.byKey.get(keyOf(code, "A"));
      expect(entry?.confirmedBy, code).toBe("sources");
      expect(entry?.basis?.length, code).toBeGreaterThan(1);
    }
  });

  it("corrects the known Hall of Beorn errors", () => {
    expect(ledger.byKey.get(keyOf("141029", "B"))?.lines.filter((line) => line.includes("+15 quest points"))).toHaveLength(1);
    expect(ledger.byKey.get(keyOf("141025", "B"))?.lines.join(" ")).toContain("The Prancing Pony");
    expect(ledger.byKey.get(keyOf("142062", "B"))?.lines.join(" ")).toContain("Frodo's Choice");
    expect(KNOWN_ERRORS).toContain("141026");
    expect(ledger.byKey.get(keyOf("142019", "A"))?.lines.join(" ")).toContain("Sting, Mithril Shirt, Glamdring, and Andúril");
    const text = (code: string, side: string) => ledger.byKey.get(keyOf(code, side))?.lines.join(" ") ?? "";
    expect(text("141026", "B")).toContain("either remove X progress");
    expect(text("141056", "A")).toContain("After an enemy is declared");
    expect(text("141056", "B")).toContain("each burden card in play");
    expect(text("142039", "A")).toContain("burden treachery cards");
    expect(text("142039", "B")).toContain("burden treachery cards");
  });
});
