import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { keyOf, loadLedger, mergeLedgers, verifyScans } from "./printed/ledger.ts";
import { starterPrints } from "../../src/screens/deck/starter-decks.ts";
import { KNOWN_ERRORS, MEC109_CHANGED, scanTargets, scopeCodes, starterCodes } from "./printed/scope.ts";

// The printed-text ledger (data/printed): every card in scope is read from a pinned scan.
const ledger = loadLedger();

describe("ledger scope", () => {
  it("reads every starter code that src/screens/deck/starter-decks.ts lists", () => {
    // starterCodes() reads the file as text, because Node cannot load its Drizzle import. This keeps the two in step.
    expect(starterCodes()).toEqual([...new Set(starterPrints().map((row) => row.code))].sort());
  });
});

describe("printed-text ledger", () => {
  it("has an entry for each side of each card in scope", () => {
    const missing = scanTargets().filter((target) => !ledger.byKey.has(keyOf(target.code, target.side))).map((target) => `${target.code}.${target.side}`);
    expect(missing).toEqual([]);
    expect(scopeCodes().length).toBeGreaterThan(80);
  });

  // With the scans cached it hashes each one, the Nightmare proxies' about 4 MB apiece: seconds under a full suite's load.
  it("names exactly the scans data/sources.json pins", () => {
    expect(verifyScans(ledger)).toEqual([]);
  }, 60_000);

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

// Mirkwood Paths and The Dark of Mirkwood (phase 27): data/printed/mirkwood-paths.json, read from the pinned scans.
describe("Mirkwood printed-text ledger", () => {
  it("merges every data/printed file, and refuses a card side two files both hold", () => {
    expect(ledger.entries.length).toBeGreaterThan(267);
    const one = { campaign: "a", entries: [ledger.entries[0] as (typeof ledger.entries)[number]], byKey: new Map([[keyOf((ledger.entries[0]?.code ?? ""), (ledger.entries[0]?.side ?? "")), ledger.entries[0] as (typeof ledger.entries)[number]]]) };
    expect(() => mergeLedgers([{ name: "a.json", ledger: one }, { name: "b.json", ledger: one }])).toThrow("both hold");
  });

  it("holds each dealt, campaign, boon and burden card of both boxes, and each entry says who read it", () => {
    const codes = [...Array.from({ length: 65 }, (_, at) => String(1074 + at).padStart(5, "0")), ...Array.from({ length: 51 }, (_, at) => String(41001 + at)), "01013", "01017", "01030"];
    const mine = ledger.entries.filter((entry) => codes.includes(entry.code));
    expect(new Set(mine.map((entry) => entry.code)), "every code has an entry").toEqual(new Set(codes));
    for (const entry of mine) {
      expect(entry.readBy, `${entry.code}.${entry.side}`).toMatch(/read from the scan image/);
      expect(entry.scan.sha256, `${entry.code}.${entry.side}`).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it("reads the printed Setup, not Hall of Beorn's", () => {
    const text = (code: string, side: string) => ledger.byKey.get(keyOf(code, side))?.lines.join(" ") ?? "";
    expect(text("01129", "A")).toContain("Setup: Put Mendor into play.");
    expect(text("01131", "A")).toContain("Attach Appointed by Fate to a hero of the first player's choice");
    expect(text("01123", "A")).toContain("Nazgûl of Dol Guldur face up but out of play");
    expect(text("01126", "A")).toContain("Each player reveals 1 card from the top of the encounter deck");
    expect(text("41004", "A")).toContain("The first player attaches Cave Torch to one of his heroes");
    expect(text("41050", "A")).toContain("Each player chooses 1 Adaptation boon attachment");
    expect(text("41051", "A")).toContain("after drawing their starting hand (including taking a mulligan)");
    expect(text("41001", "A")).toContain("Shuffle the encounter deck.");
  });
});

// Dream-chaser (phase 37): data/printed/dream-chaser.json, read from the pinned scans (the 2023 Campaign Expansion's, where it reprints a card).
describe("Dream-chaser printed-text ledger", () => {
  const file = JSON.parse(readFileSync(new URL("../../data/printed/dream-chaser.json", import.meta.url), "utf8")) as { entries: { code: string; side: string }[] };
  const dream = file.entries.map((entry) => ledger.byKey.get(keyOf(entry.code, entry.side))).filter((entry): entry is NonNullable<typeof entry> => entry !== undefined);
  const text = (code: string, side: string) => ledger.byKey.get(keyOf(code, side))?.lines.join(" ") ?? "";

  it("holds both sides of each of the nine campaign cards and the Hard and Expert Mode card", () => {
    for (const code of ["11171", "11179", "11182", "11191", "11194", "11197", "11200", "11209", "11215", "11217"]) {
      expect(ledger.byKey.has(keyOf(code, "A")), `${code}.A`).toBe(true);
      expect(ledger.byKey.has(keyOf(code, "B")), `${code}.B`).toBe(true);
    }
    expect(dream).toHaveLength(file.entries.length);
    expect(file.entries.length).toBeGreaterThanOrEqual(304);
  });

  it("reads the 2023 text, not Hall of Beorn's 2016 text", () => {
    expect(text("11171", "A")).toContain("Setup: Each player chooses a Modification boon for each of their ship-objectives");
    expect(text("11171", "B")).toContain("1 XP if you ended the game on-course (Sun).");
    expect(text("11016", "A")).toContain("Setup: Prepare the Corsair deck. Players prepare their fleet.");
    expect(text("11016", "B")).toContain("on-course (Sun)");
    expect(text("12147", "A")).toContain("Set The City of Corsairs encounter set aside, as an inactive second encounter deck");
    expect(text("11182", "B")).toContain("If Graxar is in the victory display");
    expect(text("110042", "B")).toContain("Campaign Mode only.");
  });

  it("records the Sailing success symbols of the encounter cards (Calm Waters prints two, Rolling Seas one, Fog Bank none)", () => {
    const sails = (code: string) => ledger.byKey.get(keyOf(code, "A"))?.sailingSuccess;
    expect(sails("11050")).toBe(2);
    expect(sails("11051")).toBe(1);
    expect(sails("11024")).toBe(0);
    expect(sails("11176")).toBe(1);
    // A quest card, a boon and a ship-objective have no encounter back: no reading is recorded for them.
    expect(sails("11016")).toBeUndefined();
    expect(sails("11172")).toBeUndefined();
    expect(sails("11080")).toBeUndefined();
  });

  it("names the scan each side was read from, and who read it", () => {
    for (const entry of dream) {
      expect(entry.readBy, `${entry.code}.${entry.side}`).toMatch(/read from the scan image/);
      expect(entry.scan.sha256, `${entry.code}.${entry.side}`).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});
