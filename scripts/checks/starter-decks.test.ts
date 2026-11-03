import { DatabaseSync } from "node:sqlite";

import { describe, expect, it } from "vitest";

import { deckSaveRefusal, type DeckSaveCard } from "../../src/catalog/deck-save.ts";
import {
  resolveStarterCode,
  starterPrints,
  startersToInsert,
  type StarterCandidate,
} from "../../src/screens/starter-decks.ts";
import { temporaryCatalog } from "../../test/harness/temp-catalog.ts";


function candidate(row: {
  code: string;
  name: string;
  type_code: string;
  pack_code: string;
  pack_codes: string;
  position: number;
}): StarterCandidate {
  const packs = JSON.parse(row.pack_codes) as unknown;
  return {
    code: row.code,
    name: row.name,
    typeCode: row.type_code,
    packCode: row.pack_code,
    packCodes: Array.isArray(packs) ? packs.filter((pack): pack is string => typeof pack === "string") : [],
    position: row.position,
  };
}

describe("resolveStarterCode", () => {
  it("prefers pack_code RevCore when a collector position matches more than one row", () => {
    const printed = { name: "Théodred", typeCode: "hero", collector: 2 };
    const rows: StarterCandidate[] = [
      { code: "core", name: "Théodred", typeCode: "hero", packCode: "Core", packCodes: ["Core"], position: 2 },
      { code: "rev", name: "Théodred", typeCode: "hero", packCode: "RevCore", packCodes: ["RevCore"], position: 2 },
    ];
    expect(resolveStarterCode(rows, printed)).toBe("rev");
  });

  it("stops when the saga fallback is not one row", () => {
    const printed = { name: "Frodo Baggins", typeCode: "hero", collector: 8 };
    const rows: StarterCandidate[] = [
      { code: "141001", name: "Frodo Baggins", typeCode: "hero", packCode: "TBR", packCodes: ["TBR"], position: 1 },
      { code: "142001", name: "Frodo Baggins", typeCode: "hero", packCode: "TRD", packCodes: ["TRD"], position: 1 },
    ];
    expect(() => resolveStarterCode(rows, printed)).toThrow(/not one row/);
  });
});

describe("starter decks", () => {
  it("matches the catalog and saves", async () => {
    const dbPath = temporaryCatalog();
    const database = new DatabaseSync(dbPath, { readOnly: true });
    try {
      const inserted = startersToInsert([]);
      expect(inserted.map((deck) => deck.id)).toEqual(["stealth-and-steadfastness", "wisdom-and-wizardry"]);
      expect(startersToInsert(inserted.map((deck) => deck.id))).toEqual([]);

      const codes = inserted.flatMap((deck) => [...deck.heroes, ...deck.cards.map((card) => card.code)]);
      expect(codes).not.toContain("142005");

      for (const deck of inserted) {
        expect(deck.heroes).toHaveLength(3);
        expect(deck.cards.reduce((sum, card) => sum + card.count, 0)).toBe(50);
        const facts = new Map<string, DeckSaveCard>();
        for (const code of [...deck.heroes, ...deck.cards.map((card) => card.code)]) {
          const row = database
            .prepare(
              "select name, type_code, sphere_code, deck_limit, deck_legal, traits from cards where code = ?",
            )
            .get(code) as
            | {
                name: string;
                type_code: string;
                sphere_code: string | null;
                deck_limit: number | null;
                deck_legal: number;
                traits: string | null;
              }
            | undefined;
          expect(row).toBeTruthy();
          if (!row) continue;
          facts.set(code, {
            name: row.name,
            typeCode: row.type_code,
            sphereCode: row.sphere_code,
            deckLimit: row.deck_limit,
            deckLegal: row.deck_legal === 1,
            traits: row.traits,
          });
        }
        expect(deckSaveRefusal(deck.heroes, deck.cards, facts, [])).toBeNull();
      }

      for (const printed of starterPrints()) {
        const stored = database
          .prepare("select name, type_code, position, pack_code, pack_codes from cards where code = ?")
          .get(printed.code) as
          | { name: string; type_code: string; position: number; pack_code: string; pack_codes: string }
          | undefined;
        expect(stored?.name).toBe(printed.name);
        expect(stored?.type_code).toBe(printed.typeCode);
        const matches = database
          .prepare(
            "select code, name, type_code, pack_code, pack_codes, position from cards where name = ? and type_code = ?",
          )
          .all(printed.name, printed.typeCode) as {
          code: string;
          name: string;
          type_code: string;
          pack_code: string;
          pack_codes: string;
          position: number;
        }[];
        expect(resolveStarterCode(matches.map(candidate), printed)).toBe(printed.code);
      }

      for (const code of ["01002", "01007", "01073"]) {
        const row = database.prepare("select pack_codes from cards where code = ?").get(code) as
          | { pack_codes: string }
          | undefined;
        expect(JSON.parse(row?.pack_codes ?? "[]")).toContain("RevCore");
      }

      const tomb = database.prepare("select position from cards where code = ?").get("01053") as
        | { position: number }
        | undefined;
      expect(tomb?.position).toBe(53);
      expect(starterPrints().find((row) => row.code === "01053")?.collector).toBe(63);
    } finally {
      database.close();
    }
  }, 180_000);
});
