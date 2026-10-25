import { describe, expect, it } from "vitest";

import type { Card } from "../../src/catalog/card-facts.ts";
import type { PrintedRow } from "./decklists.ts";
import { resolveRow, type Catalog, type Scope } from "./prebuilt-decks.ts";
import type { HobCard } from "./sources/hallofbeorn.ts";

// resolveRow on a small catalog: the fields it reads, and nothing else.
function card(code: string, name: string, type: string, sphere: string | null): Card {
  return { code, name, type, sphere, deckLegal: true } as Card;
}

function hob(CardSet: string, Number: number, Title: string, CardType: string, Sphere: string | null, RingsDbCardId: string): HobCard {
  return { CardSet, Number, Title, CardType, Sphere, RingsDbCardId } as HobCard;
}

const cards = [
  card("01007", "Éowyn", "hero", "spirit"),
  card("145002", "Éowyn", "hero", "tactics"),
  card("01011", "Glorfindel", "hero", "lore"),
  card("01073", "Gandalf", "ally", "neutral"),
  card("131010", "Gandalf", "ally", "neutral"),
];
const printings = [
  hob("Revised Core Set", 7, "Éowyn", "Hero", "Spirit", "01007"),
  hob("The Return of the King", 2, "Éowyn", "Hero", "Tactics", "00002"),
  hob("Revised Core Set", 11, "Glorfindel", "Hero", "Lore", "01011"),
  hob("Core Set", 73, "Gandalf", "Ally", null, "01073"),
  hob("The Hobbit: Over Hill and Under Hill", 10, "Gandalf", "Ally", null, "131010"),
];
const catalog = (aliases: Catalog["aliases"] = []): Catalog => ({ hob: printings, byCode: new Map(cards.map((item) => [item.code, item])), legal: cards, aliases });
const row = (name: string, section: PrintedRow["section"], collector: number | null, qualifier: string | null = null): PrintedRow => ({ section, name, collector, qualifier, min: 1, max: 1 });
const scope = (sets: Scope["sets"], renumbered = false): Scope => ({ deck: "test", sets, renumbered });

describe("resolveRow", () => {
  it("picks the printing at the collector number, through a placeholder RingsDB id by name, type and sphere", () => {
    expect(resolveRow(row("Éowyn", "hero", 7), scope(["Revised Core Set", "The Return of the King"]), catalog())).toEqual({ code: "01007" });
    expect(resolveRow(row("Éowyn", "hero", 2), scope(["Revised Core Set", "The Return of the King"]), catalog())).toEqual({ code: "145002" });
  });

  it("refuses a collector number no printing has, unless the deck is renumbered and one card has the name", () => {
    expect(resolveRow(row("Glorfindel", "hero", 12), scope(["Revised Core Set"]), catalog())).toHaveProperty("problem");
    expect(resolveRow(row("Glorfindel", "hero", 12), scope(["Revised Core Set"], true), catalog())).toEqual({ code: "01011" });
    expect(resolveRow(row("Éowyn", "hero", 5), scope(["Revised Core Set", "The Return of the King"], true), catalog())).toHaveProperty("problem", expect.stringContaining("01007 or 145002"));
  });

  it("follows an alias: a collector it names, a sphere, or the products it names", () => {
    const eowyn = { printed: "Éowyn", collector: 5, deck: "test", name: "Éowyn", sphere: "tactics", reason: "r" };
    expect(resolveRow(row("Éowyn", "hero", 5), scope(["Revised Core Set", "The Return of the King"]), catalog([eowyn]))).toEqual({ code: "145002" });
    expect(resolveRow(row("Éowyn", "hero", 5), { ...scope(["Revised Core Set", "The Return of the King"]), deck: "other" }, catalog([eowyn]))).toHaveProperty("problem");
    const gandalf = { printed: "Gandalf", qualifier: "core set", name: "Gandalf", sets: ["Core Set"], reason: "r" };
    expect(resolveRow(row("Gandalf", "ally", null, "core set"), scope(["Core Set", "The Hobbit: Over Hill and Under Hill"]), catalog([gandalf]))).toEqual({ code: "01073" });
    expect(resolveRow(row("Gandalf", "ally", null), scope(["Core Set", "The Hobbit: Over Hill and Under Hill"]), catalog([gandalf]))).toHaveProperty("problem");
  });

  it("looks for a Community Deck List row in the products it prints, and refuses a row that prints none", () => {
    expect(resolveRow(row("Gandalf", "ally", null, "Over Hill and Under Hill"), scope("printed"), catalog())).toEqual({ code: "131010" });
    expect(resolveRow(row("Gandalf", "ally", null), scope("printed"), catalog())).toHaveProperty("problem", '"Gandalf" prints no product');
  });

  it("does not take a hero for an ally of the same name", () => {
    expect(resolveRow(row("Glorfindel", "ally", 11), scope(["Revised Core Set"]), catalog())).toHaveProperty("problem");
  });
});
