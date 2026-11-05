// Rules: emce.caves-deck, emce.deep, emce.guarded-x, emce.campaign-pool-encounter, rr.search (data/rules/entries.json); ledger lines 12170:A:2, 12172:A:1, 18045:A:2, 18050:A:1, 18050:A:2, 18049:A:2, 18055:A:2, 18078:A:1, 18079:A:1, 18080:B:2.
// The King's Quest verbs, one by one, on the family's fixture table.
import { describe, expect, it } from "vitest";

import { definePrinted } from "../../core/printed.ts";
import { pileOf } from "../../core/piles.ts";
import { updateCard } from "../../core/state.ts";
import { cardsUnder, moveCard, spawn } from "../../core/zones.ts";
import { resolveAmount } from "../../interpret/amounts.ts";
import { codesOf, ctxOf, deal, record, table, CARDS } from "./fixture.ts";
import { shuffleIntoNamed } from "./decks.ts";
import { addToStagingWithResources, arrangeCaves, cancelStrike, discardUntilTypes, guardWithDeckTop, putOnPileBottom, returnHeld } from "./kings.ts";

const cards = new Map([...CARDS, ["ally2", definePrinted({ code: "ally2", name: "Ally", type: "ally", sphere: "neutral", cost: 2, willpower: 1, attack: 1, defense: 1, health: 2 })]]);
const ctx = { effects: [record("x:constant:1", "x", "constant", [{ verb: "GuardWithDeckTop" }])], cards };
const focus = (sourceId: string | null) => ({ seat: 0, sourceId });

describe("AddToStagingWithResources (12170:A:2, 12172:A:1)", () => {
  it("spawns the card into the staging area with the resources", () => {
    const placed = addToStagingWithResources(table(), { verb: "AddToStagingWithResources", code: "plain", amount: 3 }, focus(null), ctxOf([]));
    const id = placed.staging[0] ?? "";
    expect(placed.cards[id]).toMatchObject({ code: "plain", zone: "staging", resources: 3 });
  });

  it("places the copy the Setup search set aside, and makes no second copy", () => {
    const aside = spawn(table(), "plain", { zone: "setAside" }, "down");
    const placed = addToStagingWithResources(aside.state, { verb: "AddToStagingWithResources", code: "plain", amount: 2 }, focus(aside.id), ctxOf([]));
    expect(Object.values(placed.cards).filter((card) => card.code === "plain")).toHaveLength(1);
    expect(placed.cards[aside.id]).toMatchObject({ zone: "staging", resources: 2 });
  });
});

describe("DiscardUntilTypes (18078:A:1)", () => {
  it("discards cards until one of the types is discarded", () => {
    const dealt = deal(table(), ["mist", "hazard", "ec1", "plain"], { zone: "encounterDeck" });
    const done = discardUntilTypes(dealt.state, { verb: "DiscardUntilTypes", types: ["enemy", "location"] }, ctxOf([]));
    expect(codesOf(done, done.encounterDiscard)).toEqual(["mist", "hazard", "ec1"]);
    expect(codesOf(done, done.encounterDeck)).toEqual(["plain"]);
  });
});

describe("ArrangeCaves (18055:A:2, 18079:B:2)", () => {
  it("run where nobody can be asked the first card stays on top and the other goes to the bottom", () => {
    const dealt = deal(table(), ["cave1", "cave2", "plain"], { zone: "cavesDeck" });
    const done = arrangeCaves(dealt.state, { verb: "ArrangeCaves", count: 2 }, focus(null), []);
    expect(codesOf(done, pileOf(done, "cavesDeck"))).toEqual(["cave1", "plain", "cave2"]);
  });

  it("with the chosen card it stays on top", () => {
    const dealt = deal(table(), ["cave1", "cave2", "plain"], { zone: "cavesDeck" });
    const done = arrangeCaves(dealt.state, { verb: "ArrangeCaves", count: 2 }, { seat: 0, sourceId: null, chosen: dealt.ids[1] ?? "" }, []);
    expect(codesOf(done, pileOf(done, "cavesDeck"))).toEqual(["cave2", "plain", "cave1"]);
  });

  it("a deck of one card changes nothing", () => {
    const dealt = deal(table(), ["cave1"], { zone: "cavesDeck" });
    expect(arrangeCaves(dealt.state, { verb: "ArrangeCaves", count: 2 }, focus(null), [])).toBe(dealt.state);
  });
});

describe("PutOnPileBottom (18079:A:1)", () => {
  it("a set-aside card joins the bottom of the Caves deck", () => {
    const dealt = deal(table(), ["cave1", "cave2"], { zone: "cavesDeck" });
    const aside = spawn(dealt.state, "hoard", { zone: "setAside" }, "up");
    const done = putOnPileBottom(aside.state, { verb: "PutOnPileBottom", pile: "caves", code: "hoard" });
    expect(codesOf(done, pileOf(done, "cavesDeck"))).toEqual(["cave1", "cave2", "hoard"]);
    expect(done.cards[aside.id]?.face).toBe("down");
  });

  it("with no Caves deck dealt nothing changes", () => {
    const aside = spawn(table(), "hoard", { zone: "setAside" }, "up");
    expect(putOnPileBottom(aside.state, { verb: "PutOnPileBottom", pile: "caves", code: "hoard" })).toBe(aside.state);
  });
});

describe("ShuffleIntoPile with placed (12170:A:2)", () => {
  it("spawns the campaign card's copy into a dealt pile, and ignores a pile that is not dealt", () => {
    const dealt = deal(table(), ["cave1"], { zone: "cavesDeck" });
    const done = shuffleIntoNamed(dealt.state, { verb: "ShuffleIntoPile", pile: "caves", code: "plain", placed: true });
    expect(codesOf(done, pileOf(done, "cavesDeck")).sort()).toEqual(["cave1", "plain"]);
    const bare = shuffleIntoNamed(table(), { verb: "ShuffleIntoPile", pile: "caves", code: "plain", placed: true });
    expect(Object.values(bare.cards).some((card) => card.code === "plain")).toBe(false);
    expect(shuffleIntoNamed(dealt.state, { verb: "ShuffleIntoPile", pile: "caves", code: "plain" })).toBe(dealt.state);
  });
});

describe("GuardWithDeckTop and its sweep (18050:A:2)", () => {
  it("the first player's top deck card lies faceup under the source and returns to the hand once the source is out of play", () => {
    const withDeck = deal(table(), ["ally2", "ally2"], { zone: "deck", seat: 0 });
    const enemy = spawn(withDeck.state, "ec1", { zone: "staging" });
    const held = guardWithDeckTop(enemy.state, focus(enemy.id));
    const under = cardsUnder(held, enemy.id);
    expect(under).toEqual([withDeck.ids[0]]);
    expect(held.cards[under[0] ?? ""]).toMatchObject({ face: "up", owner: 0, held: true });
    expect(returnHeld(held, ctx).cards[under[0] ?? ""]?.zone).toBe("under");
    const gone = returnHeld(moveCard(held, enemy.id, { zone: "encounterDiscard" }), ctx);
    expect(gone.cards[under[0] ?? ""]).toMatchObject({ zone: "hand" });
    expect(gone.cards[under[0] ?? ""]?.held).toBeUndefined();
    expect(gone.seats[0]?.hand).toContain(under[0]);
  });

  it("an empty deck holds nothing, and a game with no such record does not look", () => {
    const enemy = spawn(table(), "ec1", { zone: "staging" });
    expect(guardWithDeckTop(enemy.state, focus(enemy.id))).toBe(enemy.state);
    const marked = updateCard(deal(enemy.state, ["ally2"], { zone: "discard", seat: 0 }).state, "i3", { held: true });
    expect(returnHeld(marked, ctxOf([]))).toBe(marked);
  });
});

describe("CancelStrike (18080:B:2)", () => {
  it("marks the player attack in progress as canceled, and does nothing outside an attack", () => {
    const state = table();
    expect(cancelStrike(state)).toBe(state);
    const striking = { ...state, pendingStrike: { seat: 0, enemyId: "e", attackerIds: ["a"] } };
    expect(cancelStrike(striking).pendingStrike?.canceled).toBe(true);
  });
});

describe("the amounts guardedCost and excessOf (18050:A:1, 18049:A:2)", () => {
  it("guardedCost is the printed cost of the cards under the source", () => {
    const withDeck = deal(table(), ["ally2"], { zone: "deck", seat: 0 });
    const enemy = spawn(withDeck.state, "ec1", { zone: "staging" });
    const held = guardWithDeckTop(enemy.state, focus(enemy.id));
    expect(resolveAmount(held, { guardedCost: true }, { actor: 0, sourceId: enemy.id }, { effects: [], cards })).toBe(2);
    expect(resolveAmount(enemy.state, { guardedCost: true }, { actor: 0, sourceId: enemy.id }, { effects: [], cards })).toBe(0);
  });

  it("excessOf is the damage on the subject beyond its printed hit points", () => {
    const ally = spawn(table(), "ally2", { zone: "discard", seat: 0 });
    const hurt = updateCard(ally.state, ally.id, { damage: 5 });
    expect(resolveAmount(hurt, { excessOf: "subject" }, { actor: 0, sourceId: null, subject: ally.id }, { effects: [], cards })).toBe(3);
    expect(resolveAmount(ally.state, { excessOf: "subject" }, { actor: 0, sourceId: null, subject: ally.id }, { effects: [], cards })).toBe(0);
  });
});
