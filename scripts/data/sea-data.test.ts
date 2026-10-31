import { describe, expect, it } from "vitest";

import { parseKeywordTokens } from "../../src/catalog/keyword-line.ts";
import type { Card } from "../../src/catalog/card-facts.ts";
import { loadCards } from "./load-cards.ts";
import { LEDGER_KEYWORD_PACKS } from "./normalize/printed.ts";
import { loadLedger } from "./printed/ledger.ts";

// Rules: dcce.ships, dcce.ship-enemies, dcce.ship-objectives, dcce.sailing, dcce.sailing-tests, dcce.boarding (data/rules/entries.json). The Dream-chaser
// ships carry the stats their scans print (data/overrides.json, read into the ledger notes), the keywords the ledger's lines open with, the
// Sailing success symbols the ledger counts and the Sailing keyword of every quest stage that prints it.
const cards = new Map(loadCards().map((card) => [card.code, card]));
const ledger = loadLedger();
const entries = ledger.entries.filter((entry) => cards.has(entry.code) && entry.printing !== "Nightmare");
// A ship is a card with the Ship trait that is not a location (a ship location is a place, not a ship card); its type line, read from its scan, is
// ship-enemy, ship-objective or (the two Nightmare enemies whose scans print ENEMY) enemy.
const ships = [...cards.values()].filter((card) => card.traits.includes("Ship") && card.type !== "location");

// "Stats: Engagement cost 35, Threat 2, Attack 5, Defense 2, Hit points 7; Victory 6." as the numbers it gives.
function noted(notes: string | undefined): Partial<Record<"engagementCost" | "threat" | "attack" | "defense" | "health" | "willpower" | "victory", number>> {
  const read = (label: string): number | undefined => {
    const match = new RegExp(`${label} (\\d+)`).exec(notes ?? "");
    return match?.[1] == null ? undefined : Number(match[1]);
  };
  return { engagementCost: read("Engagement cost"), threat: read("Threat"), attack: read("Attack"), defense: read("Defense"), health: read("Hit points"), willpower: read("Willpower"), victory: read("Victory") };
}

describe("the Dream-chaser ships", () => {
  it("print their stats: a ship-enemy as an enemy has, a ship-objective as an ally has", () => {
    expect(ships.length).toBeGreaterThan(20);
    for (const card of ships) {
      const wanted = card.type === "ship-objective" ? (["willpower", "attack", "defense", "health"] as const) : (["attack", "defense", "health", "threat", "engagementCost"] as const);
      for (const stat of wanted) expect(card[stat], `${card.code} ${card.name} ${stat}`).not.toBeNull();
    }
  });

  it("have the type their scan prints", () => {
    for (const code of ["12151", "905304", "904903", "904904"]) expect(cards.get(code)?.type, code).toBe("ship-enemy");
    for (const code of ["904605", "905402"]) expect(cards.get(code)?.type, code).toBe("enemy");
    for (const code of ["110136", "11080", "12123"]) expect(cards.get(code)?.type, code).toBe("ship-objective");
  });

  it("agree with the stats their scan reading records in the ledger notes", () => {
    let compared = 0;
    for (const entry of entries.filter((candidate) => candidate.side === "A")) {
      const card = cards.get(entry.code) as Card;
      if (!ships.includes(card)) continue;
      const read = noted(entry.notes);
      expect(Object.values(read).some((value) => value != null), `${entry.code} notes carry its stats`).toBe(true);
      for (const [stat, value] of Object.entries(read)) {
        if (value == null) continue;
        expect(card[stat as keyof Card], `${entry.code} ${card.name} ${stat}`).toBe(value);
        compared += 1;
      }
    }
    expect(compared).toBeGreaterThan(80);
  });
});

describe("the Upgraded sides of the ships (dcce.scalable-upgradable)", () => {
  it("carry the stats their side B scan prints, as the ledger notes of side B record them", () => {
    let compared = 0;
    for (const entry of entries.filter((candidate) => candidate.side === "B" && /Ship-objective stats/.test(candidate.notes ?? ""))) {
      const card = cards.get(entry.code) as Card;
      const read = noted(entry.notes);
      for (const stat of ["willpower", "attack", "defense", "health"] as const) {
        expect(card.back?.[stat], `${entry.code} ${card.name} side B ${stat}`).toBe(read[stat]);
        compared += 1;
      }
    }
    expect(compared).toBeGreaterThanOrEqual(24);
  });
});

describe("the keywords the ledger reads", () => {
  it("are on every card whose lines open with them", () => {
    for (const entry of entries.filter((candidate) => candidate.side === "A")) {
      const card = cards.get(entry.code) as Card;
      if (card.deckLegal) continue;
      const sentences: string[] = [];
      for (const line of entry.lines) {
        for (const sentence of line.split(/(?<=\.)\s+/)) {
          const parsed = parseKeywordTokens([sentence]);
          if (parsed.unknown.length > 0 || Object.keys(parsed.keywords).length === 0) break;
          sentences.push(sentence);
        }
      }
      if (!entry.printing || !LEDGER_KEYWORD_PACKS.has(entry.printing)) continue;
      expect(card.keywords, `${entry.code} ${card.name}`).toMatchObject(parseKeywordTokens(sentences).keywords);
    }
  });

  it("include Immune on the ships and the other cards that print it", () => {
    for (const code of ["11080", "11081", "110136", "110138", "12123", "110102", "12124", "11177", "12049"]) expect(cards.get(code)?.keywords?.immune, code).toBe(true);
  });

  it("give every quest stage that prints Sailing the Sailing keyword, and nothing else", () => {
    let stages = 0;
    for (const entry of entries.filter((candidate) => candidate.side === "B" && candidate.lines.includes("Sailing."))) {
      stages += 1;
      expect(cards.get(entry.code)?.keywords?.sailing, entry.code).toBe(true);
    }
    expect(stages).toBeGreaterThan(10);
    for (const card of cards.values()) {
      if (card.keywords?.sailing) expect(entries.some((entry) => entry.code === card.code && entry.side === "B" && entry.lines.includes("Sailing.")) || card.code.startsWith("9"), card.code).toBe(true);
    }
  });

  it("record the Sailing success symbols the ledger counts on each encounter card", () => {
    let counted = 0;
    for (const entry of entries.filter((candidate) => candidate.side === "A" && candidate.sailingSuccess != null)) {
      const card = cards.get(entry.code) as Card;
      expect(card.keywords?.sailingSuccess ?? 0, `${entry.code} ${card.name}`).toBe(entry.sailingSuccess);
      counted += entry.sailingSuccess ?? 0;
    }
    expect(counted).toBeGreaterThan(10);
    expect(cards.get("11050")?.keywords?.sailingSuccess).toBe(2);
  });

  it("give Boarding its value on the ships that print it", () => {
    expect(cards.get("11022")?.keywords?.boarding).toBe(1);
    expect(cards.get("11057")?.keywords?.boarding).toBe(2);
    expect(cards.get("11058")?.keywords?.boarding).toBe(3);
    expect(cards.get("12022")?.keywords?.boarding).toBeUndefined();
  });
});
