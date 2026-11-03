import { beforeAll, describe, expect, it } from "vitest";

import { definePrinted, type PrintedCard } from "../rules/core/printed.ts";
import { loadPrinted } from "../../scripts/test-catalog.ts";

import { validateLoadout, type LoadoutSeat } from "./loadout.ts";

// The Fellowship's rules unless a test says it is not a saga.
const validate = (seats: Parameters<typeof validateLoadout>[0], cards: Parameters<typeof validateLoadout>[1], saga = true) => validateLoadout(seats, cards, saga);
const SAGA_FRODO = "141001";
const OTHER_SAGA_FRODO = "142001";
const SPIRIT_FRODO = "02025";
const FELLOWSHIP_ARAGORN = "143001";
const RING = "141085";

let cards: Map<string, PrintedCard>;

beforeAll(async () => {
  cards = new Map(await loadPrinted([SAGA_FRODO, OTHER_SAGA_FRODO, SPIRIT_FRODO, FELLOWSHIP_ARAGORN, RING]));
  for (const code of ["h1", "h2", "h3", "h4"]) {
    cards.set(code, definePrinted({ code, name: `Hero ${code}`, type: "hero", sphere: "tactics", threat: 8, willpower: 1, attack: 1, defense: 1, health: 3 }));
  }
  cards.set("c1", definePrinted({ code: "c1", name: "Card", type: "event", sphere: "neutral", cost: 0 }));
});

const DECK = ["c1", "c1", "c1"];
const seat = (heroes: string[], deck: string[] = DECK): LoadoutSeat => ({ heroes, deck });

describe("Fellowship loadout", () => {
  it("refuses the same hero in two seats (rr.unique-cards)", () => {
    const errors = validate([seat([SAGA_FRODO, "h1", "h2"]), seat(["h1", "h3", "h4"])], cards);
    expect(errors.map((error) => error.rule)).toEqual(["sameHero"]);
    expect(errors[0]?.message).toContain("Hero h1");
  });

  it("accepts the Ring-bearer with two or three other heroes", () => {
    expect(validate([seat([SAGA_FRODO, "h1", "h2"])], cards)).toEqual([]);
    expect(validate([seat([SAGA_FRODO, "h1", "h2", "h3"])], cards)).toEqual([]);
    expect(validate([seat(["h1", SAGA_FRODO, "h2", "h3"])], cards)).toEqual([]);
  });

  it("refuses a first seat with no Ring-bearer", () => {
    const errors = validate([seat(["h1", "h2", "h3"])], cards);
    expect(errors.map((error) => error.rule)).toEqual(["noRingBearer"]);
    expect(errors[0]?.message).toContain("Hero h1");
    // A Fellowship hero without the trait is not a Ring-bearer.
    expect(validate([seat([FELLOWSHIP_ARAGORN, "h1"])], cards).map((error) => error.rule)).toEqual(["noRingBearer"]);
  });

  it("refuses two Fellowship-sphere heroes and names the second", () => {
    const errors = validate([seat([SAGA_FRODO, FELLOWSHIP_ARAGORN, "h1"])], cards);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ rule: "twoFellowshipHeroes", code: FELLOWSHIP_ARAGORN, card: "Aragorn" });
    expect(errors[0]?.message).toContain("Aragorn (143001)");
    const across = validate([seat([SAGA_FRODO, "h1"]), seat([FELLOWSHIP_ARAGORN, "h2"])], cards);
    expect(across.map((error) => error.rule)).toEqual(["twoFellowshipHeroes"]);
  });

  it("refuses a second Ring-bearer even in the other seat", () => {
    const errors = validate([seat([SAGA_FRODO, "h1"]), seat([OTHER_SAGA_FRODO, "h2"])], cards);
    expect(errors.map((error) => error.rule).sort()).toEqual(["secondFrodo", "twoFellowshipHeroes"]);
  });

  it("refuses another version of Frodo as a hero or in a deck, naming the card", () => {
    const hero = validate([seat([SAGA_FRODO, SPIRIT_FRODO, "h1"])], cards);
    expect(hero).toHaveLength(1);
    expect(hero[0]).toMatchObject({ rule: "secondFrodo", code: SPIRIT_FRODO });
    const deck = validate([seat([SAGA_FRODO, "h1"], [...DECK, OTHER_SAGA_FRODO])], cards);
    expect(deck).toHaveLength(1);
    expect(deck[0]).toMatchObject({ rule: "secondFrodo", code: OTHER_SAGA_FRODO });
    expect(deck[0]?.message).toContain("Frodo Baggins (142001)");
  });

  it("takes the name from the chosen Ring-bearer, not from a literal", () => {
    const bearer = definePrinted({ code: "rb", name: "Other Bearer", type: "hero", sphere: "fellowship", traits: ["Ring-bearer"], threat: 8, willpower: 1, attack: 1, defense: 1, health: 3 });
    const twin = definePrinted({ code: "rb2", name: "Other Bearer", type: "ally", sphere: "lore", cost: 1 });
    const named = new Map(cards).set("rb", bearer).set("rb2", twin).set("fb", definePrinted({ code: "fb", name: "Frodo Baggins", type: "ally", sphere: "lore", cost: 1 }));
    // Another card called Frodo Baggins is fine when the Ring-bearer is someone else.
    expect(validate([seat(["rb", "h1"], [...DECK, "fb"])], named)).toEqual([]);
    const errors = validate([seat(["rb", "h1"], [...DECK, "rb2"])], named);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ rule: "secondFrodo", code: "rb2", card: "Other Bearer" });
    expect(errors[0]?.message).toContain("Other Bearer (rb2)");
  });

  it("refuses a fourth hero unless the extra hero is the Ring-bearer", () => {
    const errors = validate([seat([SAGA_FRODO, "h1", "h2", "h3", "h4"])], cards);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ rule: "tooManyHeroes", code: "h4" });
    // The second seat has no Ring-bearer, so three is its limit.
    const second = validate([seat([SAGA_FRODO]), seat(["h1", "h2", "h3", "h4"])], cards);
    expect(second.map((error) => error.rule)).toEqual(["tooManyHeroes"]);
  });

  it("refuses The One Ring in a deck and never inserts one", () => {
    const errors = validate([seat([SAGA_FRODO, "h1"], [...DECK, RING])], cards);
    expect(errors.map((error) => error.rule)).toEqual(["ringInDeck"]);
    expect(errors[0]?.message).toContain("The One Ring (141085)");
    const loadout = [seat([SAGA_FRODO, "h1"])];
    validate(loadout, cards);
    expect(loadout[0]?.heroes).toEqual([SAGA_FRODO, "h1"]);
    expect(loadout[0]?.deck).toEqual(DECK);
  });

  it("does not reject two decks that share some other unique card", () => {
    const shared = definePrinted({ code: "u1", name: "Unique", type: "ally", sphere: "lore", cost: 1, isUnique: true });
    const withShared = new Map(cards).set("u1", shared);
    expect(validate([seat([SAGA_FRODO, "h1"], [...DECK, "u1"]), seat(["h2"], [...DECK, "u1"])], withShared)).toEqual([]);
  });

  it("names a card the catalog does not know", () => {
    expect(validate([seat([SAGA_FRODO, "nope"])], cards)[0]).toMatchObject({ rule: "unknownCard", code: "nope" });
  });
});

describe("loadout outside a saga (Mirkwood Paths, The Dark of Mirkwood)", () => {
  it("needs no Ring-bearer: three plain heroes are dealt", () => {
    expect(validate([seat(["h1", "h2", "h3"])], cards, false)).toEqual([]);
    // The same loadout in the saga still has its first-seat error, so the default is unchanged.
    expect(validate([seat(["h1", "h2", "h3"])], cards).map((error) => error.rule)).toEqual(["noRingBearer"]);
  });

  it("refuses a Fellowship-sphere hero and cites the rule", () => {
    for (const hero of [SAGA_FRODO, FELLOWSHIP_ARAGORN]) {
      const errors = validate([seat([hero, "h1"])], cards, false);
      expect(errors.map((error) => error.rule)).toEqual(["fellowshipOutsideSaga"]);
      expect(errors[0]?.message).toContain("mec109.the-fellowship-sphere");
    }
  });

  it("skips the saga-only checks: another Frodo, The One Ring and a fourth hero are not this rule's business", () => {
    expect(validate([seat([SPIRIT_FRODO, "h1"], [...DECK, OTHER_SAGA_FRODO])], cards, false)).toEqual([]);
    expect(validate([seat(["h1", "h2", "h3", "h4"], [...DECK, RING])], cards, false)).toEqual([]);
  });

  it("still refuses the same hero in two seats (rr.unique-cards)", () => {
    expect(validate([seat(["h1", "h2"]), seat(["h1", "h3"])], cards, false).map((error) => error.rule)).toEqual(["sameHero"]);
  });
});
