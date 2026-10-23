import { describe, expect, it } from "vitest";

import {
  deckSaveRefusal,
  type DeckRestriction,
  type DeckSaveCard,
  type DeckSaveEntry,
} from "./deck-save.ts";

function card(overrides: Partial<DeckSaveCard> & Pick<DeckSaveCard, "name" | "typeCode">): DeckSaveCard {
  return {
    sphereCode: "neutral",
    deckLimit: 3,
    deckLegal: true,
    traits: null,
    ...overrides,
  };
}

function heroes(
  spheres: readonly string[],
  traits: readonly (string | null)[] = [],
): { codes: string[]; facts: Map<string, DeckSaveCard> } {
  const facts = new Map<string, DeckSaveCard>();
  const codes = spheres.map((sphere, index) => {
    const code = `h${index}`;
    facts.set(
      code,
      card({
        name: `Hero ${index}`,
        typeCode: "hero",
        sphereCode: sphere,
        deckLimit: 1,
        traits: traits[index] ?? null,
      }),
    );
    return code;
  });
  return { codes, facts };
}

function fill(
  facts: Map<string, DeckSaveCard>,
  count: number,
  sphere = "neutral",
): DeckSaveEntry[] {
  const cards: DeckSaveEntry[] = [];
  for (let index = 0; index < count; index += 1) {
    const code = `c${index}`;
    facts.set(code, card({ name: `Card ${index}`, typeCode: "ally", sphereCode: sphere }));
    cards.push({ code, count: 1 });
  }
  return cards;
}

describe("deckSaveRefusal", () => {
  it("saves three heroes and 50 matching cards", () => {
    const { codes, facts } = heroes(["leadership", "tactics", "spirit"]);
    const cards = fill(facts, 50, "leadership");
    expect(deckSaveRefusal(codes, cards, facts, [])).toBeNull();
  });

  it("refuses 2 heroes, 4 heroes, and 49 cards", () => {
    const two = heroes(["leadership", "tactics"]);
    expect(deckSaveRefusal(two.codes, fill(two.facts, 50), two.facts)).toEqual({
      cardCode: null,
      cardName: null,
      rule: "Exactly three heroes.",
    });

    const four = heroes(["leadership", "tactics", "spirit", "lore"]);
    expect(deckSaveRefusal(four.codes, fill(four.facts, 50), four.facts)).toEqual({
      cardCode: "h3",
      cardName: "Hero 3",
      rule: "Exactly three heroes.",
    });

    const three = heroes(["leadership", "tactics", "spirit"]);
    expect(deckSaveRefusal(three.codes, fill(three.facts, 49), three.facts)?.rule).toBe("At least 50 cards.");
  });

  it("refuses a fourth copy", () => {
    const { codes, facts } = heroes(["leadership", "tactics", "spirit"]);
    const cards = fill(facts, 46);
    facts.set("extra", card({ name: "Gandalf", typeCode: "ally" }));
    cards.push({ code: "extra", count: 4 });
    const refusal = deckSaveRefusal(codes, cards, facts, []);
    expect(refusal?.cardName).toBe("Gandalf");
    expect(refusal?.rule).toBe("At most three copies.");
  });

  it("refuses split lines of the same card once the counts are summed", () => {
    const { codes, facts } = heroes(["leadership", "tactics", "spirit"]);
    const cards = fill(facts, 46);
    facts.set("01073", card({ name: "Gandalf", typeCode: "ally", sphereCode: "neutral", deckLimit: 3 }));
    cards.push({ code: "01073", count: 3 }, { code: "01073", count: 1 });
    const refusal = deckSaveRefusal(codes, cards, facts, []);
    expect(refusal).toEqual({
      cardCode: "01073",
      cardName: "Gandalf",
      rule: "At most three copies.",
    });
  });

  it("refuses two copies when deck_limit is 1", () => {
    const { codes, facts } = heroes(["leadership", "tactics", "spirit"]);
    const cards = fill(facts, 48);
    facts.set("once", card({ name: "Unique Ally", typeCode: "ally", deckLimit: 1 }));
    cards.push({ code: "once", count: 2 });
    expect(deckSaveRefusal(codes, cards, facts)?.rule).toBe("Deck limit is 1.");
  });

  it("saves three copies of a unique card when deck_limit is 3", () => {
    const { codes, facts } = heroes(["leadership", "tactics", "lore"]);
    const cards = fill(facts, 47);
    facts.set(
      "01073",
      card({ name: "Gandalf", typeCode: "ally", sphereCode: "neutral", deckLimit: 3 }),
    );
    cards.push({ code: "01073", count: 3 });
    expect(deckSaveRefusal(codes, cards, facts, [])).toBeNull();
  });

  it("allows a null sphere and a neutral sphere", () => {
    const { codes, facts } = heroes(["leadership", "tactics", "spirit"]);
    const cards = fill(facts, 48);
    facts.set("open", card({ name: "Open", typeCode: "event", sphereCode: null }));
    facts.set("neutral", card({ name: "Neutral", typeCode: "event", sphereCode: "neutral" }));
    cards.push({ code: "open", count: 1 }, { code: "neutral", count: 1 });
    expect(deckSaveRefusal(codes, cards, facts, [])).toBeNull();
  });

  it("saves a fellowship-sphere card with no fellowship hero", () => {
    const { codes, facts } = heroes(["leadership", "tactics", "lore"]);
    const cards = fill(facts, 47);
    facts.set(
      "141012",
      card({ name: "Frodo's Intuition", typeCode: "event", sphereCode: "fellowship", deckLimit: 3 }),
    );
    cards.push({ code: "141012", count: 3 });
    expect(deckSaveRefusal(codes, cards, facts, [])).toBeNull();
  });

  it("refuses a leadership card with no leadership hero", () => {
    const { codes, facts } = heroes(["tactics", "spirit", "lore"]);
    const cards = fill(facts, 49);
    facts.set("lead", card({ name: "Sneak Attack", typeCode: "event", sphereCode: "leadership" }));
    cards.push({ code: "lead", count: 1 });
    const refusal = deckSaveRefusal(codes, cards, facts, []);
    expect(refusal?.cardName).toBe("Sneak Attack");
    expect(refusal?.rule).toBe("Sphere must match a hero.");
  });

  it("saves a fellowship hero among the three heroes", () => {
    const { codes, facts } = heroes(["leadership", "tactics", "fellowship"]);
    expect(deckSaveRefusal(codes, fill(facts, 50), facts, [])).toBeNull();
  });

  it("does not refuse a card with campaignId when restrictions is empty", () => {
    const { codes, facts } = heroes(["leadership", "tactics", "spirit"]);
    const cards = fill(facts, 49);
    facts.set(
      "owned",
      card({
        name: "Boon",
        typeCode: "event",
        sphereCode: "neutral",
        campaignId: "fellowship-of-the-ring",
      }),
    );
    cards.push({ code: "owned", count: 1 });
    expect(deckSaveRefusal(codes, cards, facts, [])).toBeNull();
  });

  it("refuses a trait restriction until a hero has that trait", () => {
    const restricted: DeckRestriction = { cardCode: "c0", kind: "trait", trait: "Hobbit" };
    const without = heroes(["leadership", "tactics", "spirit"], ["Dwarf.", "Hobbiton.", "Noble Hobbit."]);
    const cards = fill(without.facts, 50);
    expect(deckSaveRefusal(without.codes, cards, without.facts, [restricted])?.rule).toBe("Requires a Hobbit hero.");

    const withHobbit = heroes(["leadership", "tactics", "spirit"], ["Hobbit.", null, null]);
    const next = fill(withHobbit.facts, 50);
    expect(deckSaveRefusal(withHobbit.codes, next, withHobbit.facts, [restricted])).toBeNull();
  });

  it("does not refuse when no restriction record is passed", () => {
    const { codes, facts } = heroes(["leadership", "tactics", "spirit"]);
    const cards = fill(facts, 50);
    expect(deckSaveRefusal(codes, cards, facts)).toBeNull();
  });

  it("names a missing code and refuses a campaign restriction", () => {
    const { codes, facts } = heroes(["leadership", "tactics", "spirit"]);
    const cards = fill(facts, 50);
    expect(deckSaveRefusal([...codes, "missing"], cards, facts)?.cardName).toBe("missing");

    const restriction: DeckRestriction = { cardCode: "c0", kind: "campaignId" };
    expect(deckSaveRefusal(codes, cards, facts, [restriction])?.rule).toBe("Campaign restriction.");
  });
});
