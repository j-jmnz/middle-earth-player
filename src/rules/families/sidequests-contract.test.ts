// Rules: rr.setup, rr.card-types, rr.play-restrictions-and-permissions, rr.in-play-and-out-of-play, rr.deckbuilding
// (data/rules/entries.json).
// Contracts: begin the game in play, show a side, flip over, restrict what a player plays, and print deckbuilding rules.
import { describe, expect, it } from "vitest";

import { RECORDS } from "../../effects/authored/families/sidequests.ts";
import { deckRulesOf, heroLimit } from "../../catalog/deck-rules.ts";
import { deckSaveRefusal, type DeckSaveCard } from "../../catalog/deck-save.ts";
import { codes, fixtureDefinition } from "../fixture.ts";
import { modifiedStat } from "../keywords.ts";
import { definePrinted } from "../printed.ts";
import { reduce, startScenario } from "../reduce.ts";
import { moveCard } from "../zones.ts";
import { offered, play, put, run, seat, SIDE_CARDS, sideCtx, synced, withContract } from "./sidequests-fixture.ts";

const ctx = sideCtx(RECORDS);
const UNIQUE_ALLIES = ["01019", "02053", "04006", "06057", "10141", "12058"];

function playable(state: Parameters<typeof offered>[0], cardId: string): boolean {
  return offered(state, ctx).some((intent) => intent.type === "PlayCard" && intent.cardId === cardId);
}

describe("a contract at the start of the game", () => {
  it("begins in its player's play area showing side A, not in the deck or the hand", () => {
    const filler = codes("f", 20);
    const cards = new Map([...SIDE_CARDS, ...filler.map((code) => [code, definePrinted({ code, name: code, type: "event", sphere: "neutral", cost: 0 })] as const)]);
    const started = startScenario(
      { seatCount: 1, seed: 3, threatModifier: 0, definition: fixtureDefinition(["stage"]), seats: [{ heroes: ["dwarf"], deck: ["21074", ...filler] }], encounterDeck: [], questDeck: ["stage"] },
      { effects: RECORDS, cards },
    );
    const contract = Object.values(started.cards).find((card) => card.code === "21074");
    expect(contract).toMatchObject({ zone: "play", controller: 0, face: "A" });
    expect(started.seats[0].deck.length + started.seats[0].hand.length).toBe(20);
  });
});

describe("Fellowship (21074)", () => {
  function table() {
    const base = seat(1, ["dwarf", "rohan"]);
    const contract = withContract(base.state, "21074");
    return { base, contract, state: synced(contract.state, ctx) };
  }

  it("side A: non-unique allies cannot be played, unique ones can (21074:A:1)", () => {
    const { state } = table();
    const helper = put(state, "helper", "hand");
    const brok = put(helper.state, "01019", "hand");
    expect(playable(brok.state, helper.id)).toBe(false);
    expect(playable(brok.state, brok.id)).toBe(true);
    // An ally cannot be put into play either: the Pick offers none.
    expect(reduce(brok.state, { type: "PlayCard", cardId: helper.id, payments: [{ heroId: "i2", amount: 2 }] }, ctx).ok).toBe(false);
  });

  it("flips to side B when the player controls exactly 9 unique characters (21074:A:2)", () => {
    const { contract, state } = table();
    let next = state;
    for (const code of UNIQUE_ALLIES) next = put(next, code, "play").state;
    next = synced(next, ctx);
    // 2 heroes and 6 unique allies: 8. The ninth enters play.
    expect(next.cards[contract.id]?.face).toBe("A");
    const ninth = put(next, "144007", "hand");
    const played = play(ninth.state, ninth.id, ctx, [{ heroId: "i3", amount: 2 }]);
    expect(played.cards[contract.id]?.face).toBe("B");
  });

  it("side B: allies cannot be played, each character gets +1 Willpower, Attack and Defense (21074:B:1)", () => {
    const { contract, state } = table();
    const hero = state.seats[0].heroes[0] ?? "";
    const before = ["willpower", "attack", "defense"].map((stat) => modifiedStat(state, state.cards[hero]!, stat as "willpower", ctx.cards));
    const flipped = synced({ ...state, cards: { ...state.cards, [contract.id]: { ...state.cards[contract.id]!, face: "B" } } }, ctx);
    const after = ["willpower", "attack", "defense"].map((stat) => modifiedStat(flipped, flipped.cards[hero]!, stat as "willpower", ctx.cards));
    expect(after).toEqual(before.map((value) => value + 1));
    const brok = put(flipped, "01019", "hand");
    expect(playable(brok.state, brok.id)).toBe(false);
  });

  it("flips back to side A when a character leaves play (21074:B:2)", () => {
    const { contract, state } = table();
    const ally = put(state, "01019", "play");
    const onB = { ...ally.state, cards: { ...ally.state.cards, [contract.id]: { ...ally.state.cards[contract.id]!, face: "B" as const } } };
    const gone = run(moveCard(onB, ally.id, { zone: "discard", seat: 0 }), ctx);
    expect(gone.cards[contract.id]?.face).toBe("A");
    // Side A hears nothing about a character leaving.
    const second = put(gone, "02053", "play");
    const again = run(moveCard(second.state, second.id, { zone: "discard", seat: 0 }), ctx);
    expect(again.cards[contract.id]?.face).toBe("A");
  });
});

describe("deckbuilding rules of a contract", () => {
  const fact = (name: string, typeCode: string, sphereCode: string | null, deckLimit: number | null = null): DeckSaveCard => ({ name, typeCode, sphereCode, deckLimit, deckLegal: true, traits: null });
  const facts = new Map<string, DeckSaveCard>([
    ["h1", fact("Hero One", "hero", "leadership")],
    ["h2", fact("Hero Two", "hero", "lore")],
    ["h3", fact("Hero Three", "hero", "spirit")],
    ["h4", fact("Hero Four", "hero", "tactics")],
    ["h5", fact("Hero Five", "hero", "lore")],
    ["ally", fact("An Ally", "ally", "leadership")],
    ["event", fact("An Event", "event", "lore")],
    ["att", fact("An Attachment", "attachment", "spirit")],
    ["c21074", fact("Fellowship", "contract", "neutral", 1)],
  ]);
  for (let index = 0; index < 60; index += 1) facts.set(`e${index}`, fact(`Event ${index}`, "event", ["leadership", "lore", "spirit", "tactics"][index % 4] ?? null, 3));
  const events = (count: number) => Array.from({ length: count }, (_, index) => ({ code: `e${index}`, count: 1 }));

  it("a contract is not counted toward the 50 cards, and one is the most a deck holds", () => {
    expect(deckSaveRefusal(["h1"], [...events(49), { code: "c21074", count: 1 }], facts)).toMatchObject({ rule: "At least 50 cards." });
    expect(deckSaveRefusal(["h1"], [...events(50), { code: "c21074", count: 1 }], facts)).toBeNull();
    expect(deckSaveRefusal(["h1"], [...events(50), { code: "c21074", count: 2 }], facts)).toMatchObject({ rule: "At most one contract." });
  });

  it("no allies, one copy by title, one starting hero, 4 heroes of different spheres, 100 cards, 10 per sphere", () => {
    expect(heroLimit([])).toBe(3);
    expect(heroLimit([{ kind: "heroes", max: 1 }])).toBe(1);
    expect(deckSaveRefusal(["h1", "h2"], events(50), facts, [], [{ kind: "heroes", max: 1 }])).toMatchObject({ rule: "At most one hero." });
    expect(deckSaveRefusal(["h1", "h2", "h3", "h4"], events(50), facts, [], [{ kind: "heroes", max: 4, differentSpheres: true }])).toBeNull();
    expect(deckSaveRefusal(["h1", "h2", "h3", "h5"], events(50), facts, [], [{ kind: "heroes", max: 4, differentSpheres: true }])).toMatchObject({ rule: "Each hero must belong to a different sphere." });
    expect(deckSaveRefusal(["h1", "h2", "h3", "h4"], events(50), facts)).toMatchObject({ rule: "At most three heroes." });
    expect(deckSaveRefusal(["h1"], [...events(49), { code: "ally", count: 1 }], facts, [], [{ kind: "noCards", type: "ally" }])).toMatchObject({ cardName: "An Ally" });
    expect(deckSaveRefusal(["h1"], [...events(49), { code: "att", count: 1 }], facts, [], [{ kind: "noCards", type: "attachment" }])).toMatchObject({ cardName: "An Attachment" });
    expect(deckSaveRefusal(["h1"], [{ code: "e1", count: 2 }, ...events(48).slice(2)], facts, [], [{ kind: "copies", max: 1 }])).toMatchObject({ rule: "At most 1 copy by title." });
    expect(deckSaveRefusal(["h1"], events(60), facts, [], [{ kind: "size", min: 100 }])).toMatchObject({ rule: "At least 100 cards." });
    // 50 cards, 12 of Leadership, 12 of Lore, 13 of Spirit and 13 of Tactics.
    expect(deckSaveRefusal(["h1"], events(50), facts, [], [{ kind: "size", exactly: 50 }, { kind: "perSphere", count: 10 }])).toMatchObject({ rule: "Exactly 10 Leadership cards (it has 13)." });
    expect(deckSaveRefusal(["h1"], events(51), facts, [], [{ kind: "size", exactly: 50 }])).toMatchObject({ rule: "Exactly 50 cards." });
  });

  it("reads the rules from the records of the contract", () => {
    expect(deckRulesOf(RECORDS, ["21074", "09014"])).toEqual([]);
  });
});
