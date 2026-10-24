import { describe, expect, it } from "vitest";

import { keyOf, loadLedger, verifyScans } from "./printed/ledger.ts";
import { KNOWN_ERRORS, MEC109_CHANGED, scanTargets, scopeCodes } from "./printed/scope.ts";

// The printed-text ledger (data/printed): every card in scope is read from a pinned scan.
const ledger = loadLedger();

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
  });
});
