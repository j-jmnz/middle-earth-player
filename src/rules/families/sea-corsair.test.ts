import { describe, expect, it } from "vitest";

import type { Effect, Instruction } from "../../catalog/boundary.ts";
import { definePrinted } from "../printed.ts";
import type { ScenarioState } from "../state.ts";
import { spawn } from "../zones.ts";
import { endCorsairDeck, refillCorsairDeck } from "./sea-corsair.ts";
import { deckOf, enemy, hero, seaTable, send, shipEnemy, until, type Table } from "./sea-table.ts";

// Rules: dcce.corsair-deck, dcce.boarding (data/rules/entries.json). The Corsair deck holds only non-ship enemies and has its own discard pile; a
// non-ship enemy that would be discarded goes to the Corsair discard pile, and the deck refills from it when it runs out.

const event = (code: string, ...instructions: Instruction[]): Effect => ({ id: `${code}:action:1`, cardCode: code, lines: [`${code}:A:1`], timing: "action", instructions });
const card = (code: string) => definePrinted({ code, name: code, type: "event", sphere: "tactics", cost: 0 });

function table(effects: readonly Effect[], seatCount: 1 | 2 = 1, encounter: readonly string[] = ["corsair", "pirate1", "pirate2"]): Table {
  const built = seaTable({
    seatCount,
    cards: [hero("aragorn"), hero("boromir"), shipEnemy("corsair"), enemy("pirate1", { health: 1, defense: 0 }), enemy("pirate2", { health: 1, defense: 0 }), card("prep"), card("reveal"), card("revealAll"), card("end")],
    effects,
    heroes: seatCount === 2 ? [{ code: "aragorn" }, { code: "boromir", seat: 1 }] : [{ code: "aragorn" }],
    hand: [{ code: "prep" }, { code: "reveal" }, { code: "revealAll" }, { code: "end" }],
    encounter,
  });
  return { ...built, state: { ...built.state, mode: "combatActions", phase: "Combat", boundaryPhase: "Combat", window: { kind: "pass" }, passed: [] } };
}

const play = (state: ScenarioState, ctx: Table["ctx"], id: string): ScenarioState => send({ ...state, window: { kind: "pass" }, passed: [] }, { type: "PlayCard", cardId: id, payments: [] }, ctx);
// The attack, through the action windows its steps open (a card in hand has an Action), until the enemy has left play.
const strike = (state: ScenarioState, ctx: Table["ctx"], enemyId: string, attacker: string): ScenarioState =>
  until(send(state, { type: "DeclareAttackers", enemyId, attackerIds: [attacker] }, ctx), ctx, (current) => current.cards[enemyId]?.zone !== "engaged");
const codesIn = (state: ScenarioState, ids: readonly string[]): string[] => ids.map((id) => state.cards[id]?.code ?? "?").sort();

const RECORDS = [event("prep", { verb: "PrepareCorsairDeck" }), event("reveal", { verb: "RevealCorsair", count: 2 }), event("revealAll", { verb: "RevealCorsair", who: "eachSeat" }), event("end", { verb: "EndCorsairDeck" })];
// A card that hears itself enter play (the revealed enemy "put into play" is an encounter card entering play).
const ENTERS: Effect = { id: "pirate1:triggered:1", cardCode: "pirate1", lines: ["pirate1:A:1"], timing: "triggered", trigger: "encounterEnteredPlay", subject: "self", instructions: [{ verb: "PlaceToken", amount: 3 }] };

describe("preparing the Corsair deck (dcce.corsair-deck)", () => {
  it("takes every non-ship enemy out of the encounter deck and keeps the ship-enemies there", () => {
    const { state, ids, ctx } = table(RECORDS);
    const next = play(state, ctx, ids.prep!);
    expect(codesIn(next, deckOf(next, "corsairDeck"))).toEqual(["pirate1", "pirate2"]);
    expect(codesIn(next, next.encounterDeck)).toEqual(["corsair"]);
    expect(next.corsairDiscard).toEqual([]);
    expect(next.cards[ids["deck:pirate1"]!]?.zone).toBe("corsairDeck");
  });

  it("shuffles the Corsair deck, and joins the cards the scenario dealt to it", () => {
    const built = table(RECORDS, 1, ["corsair", "pirate1"]);
    const dealt = spawn({ ...built.state, corsairDeck: [], corsairDiscard: [] }, "pirate2", { zone: "corsairDeck" });
    const next = play(dealt.state, built.ctx, built.ids.prep!);
    expect(codesIn(next, deckOf(next, "corsairDeck"))).toEqual(["pirate1", "pirate2"]);
    expect(next.seedCursor).toBeGreaterThan(dealt.state.seedCursor);
  });
});

describe("the Corsair discard pile (dcce.corsair-deck)", () => {
  // The prepared table in the player attack window, with the pirate engaged: the hero kills it.
  function fight(rest: readonly string[] = ["pirate2"]): Table & { pirate: string } {
    const built = table(RECORDS, 1, ["corsair", ...rest]);
    const prepared = play(built.state, built.ctx, built.ids.prep!);
    const pirate = spawn(prepared, "pirate1", { zone: "engaged", seat: 0 });
    return { ...built, state: { ...pirate.state, phase: "Combat", mode: "playerAttacks", window: { kind: "playerAttack" }, passed: [] }, pirate: pirate.id };
  }

  it("takes a non-ship enemy that is destroyed", () => {
    const { state, ids, ctx, pirate } = fight();
    const killed = strike(state, ctx, pirate, ids.aragorn!);
    expect(killed.cards[pirate]?.zone).toBe("corsairDiscard");
    expect(killed.corsairDiscard).toEqual([pirate]);
    expect(killed.encounterDiscard).toEqual([]);
    expect(codesIn(killed, killed.corsairDeck ?? [])).toEqual(["pirate2"]);
  });

  it("leaves a ship-enemy's discard to the encounter discard pile", () => {
    const { state, ids, ctx } = fight();
    const ship = spawn({ ...state, window: { kind: "playerAttack" } }, "corsair", { zone: "engaged", seat: 0 });
    const weak = { ...ship.state, cards: { ...ship.state.cards, [ship.id]: { ...ship.state.cards[ship.id]!, damage: 9 } } };
    const killed = strike(weak, ctx, ship.id, ids.aragorn!);
    expect(killed.cards[ship.id]?.zone).toBe("encounterDiscard");
    expect(killed.corsairDiscard).toEqual([]);
  });

  it("is the encounter discard pile in a game that has not prepared a Corsair deck", () => {
    const built = table(RECORDS, 1, ["corsair"]);
    const pirate = spawn(built.state, "pirate1", { zone: "engaged", seat: 0 });
    const fighting = { ...pirate.state, phase: "Combat" as const, mode: "playerAttacks" as const, window: { kind: "playerAttack" as const }, passed: [] };
    const killed = strike(fighting, built.ctx, pirate.id, built.ids.aragorn!);
    expect(killed.cards[pirate.id]?.zone).toBe("encounterDiscard");
  });

  it("is shuffled back into the Corsair deck at once when the deck runs out", () => {
    // The pirate is the only Corsair card: its discard leaves the deck empty, so the pile is shuffled back before anyone can act.
    const { state, ids, ctx, pirate } = fight([]);
    const killed = strike(state, ctx, pirate, ids.aragorn!);
    expect(killed.cards[pirate]?.zone).toBe("corsairDeck");
    expect(killed.corsairDeck).toEqual([pirate]);
    expect(killed.corsairDiscard).toEqual([]);
  });

  it("refills a deck that is empty and has a discard pile, whatever emptied it", () => {
    const { state, pirate } = fight([]);
    const emptied = { ...state, corsairDeck: [], corsairDiscard: [pirate], cards: { ...state.cards, [pirate]: { ...state.cards[pirate]!, zone: "corsairDiscard" as const } } };
    expect(refillCorsairDeck(emptied).corsairDeck).toEqual([pirate]);
    expect(refillCorsairDeck(emptied).corsairDiscard).toEqual([]);
    // A deck with cards in it, or no pile to refill from, is left alone.
    expect(refillCorsairDeck({ ...emptied, corsairDeck: ["x"] })).toEqual({ ...emptied, corsairDeck: ["x"] });
    expect(refillCorsairDeck({ ...emptied, corsairDiscard: [] }).corsairDeck).toEqual([]);
  });
});

describe("revealing from the Corsair deck (dcce.boarding)", () => {
  it("puts the top cards into play engaged with the player", () => {
    const { state, ids, ctx } = table(RECORDS);
    const prepared = play(state, ctx, ids.prep!);
    const next = play(prepared, ctx, ids.reveal!);
    expect(codesIn(next, next.seats[0]?.engaged ?? [])).toEqual(["pirate1", "pirate2"]);
    expect(next.corsairDeck).toEqual([]);
  });

  it("refills the deck from its discard pile between two reveals", () => {
    const { state, ids, ctx } = table(RECORDS, 1, ["corsair", "pirate1"]);
    const prepared = play(state, ctx, ids.prep!);
    const spare = spawn({ ...prepared, corsairDiscard: [] }, "pirate2", { zone: "corsairDiscard" });
    const next = play(spare.state, ctx, ids.reveal!);
    expect(codesIn(next, next.seats[0]?.engaged ?? [])).toEqual(["pirate1", "pirate2"]);
  });

  it("stops when the deck and its discard pile are both empty", () => {
    const { state, ids, ctx } = table(RECORDS, 1, ["corsair", "pirate1"]);
    const next = play(play(state, ctx, ids.prep!), ctx, ids.reveal!);
    expect(codesIn(next, next.seats[0]?.engaged ?? [])).toEqual(["pirate1"]);
  });

  it("reveals one card for each player when it says so", () => {
    const { state, ids, ctx } = table(RECORDS, 2);
    const next = play(play(state, ctx, ids.prep!), ctx, ids.revealAll!);
    expect(codesIn(next, next.seats[0]?.engaged ?? [])).toHaveLength(1);
    expect(codesIn(next, next.seats[1]?.engaged ?? [])).toHaveLength(1);
  });
});

describe("a revealed enemy entering play (dcce.boarding)", () => {
  it("is announced as entering play, as every encounter card put into play is", () => {
    const { state, ids, ctx } = table([...RECORDS, ENTERS], 1, ["corsair", "pirate1"]);
    const next = play(play(state, ctx, ids.prep!), ctx, ids.reveal!);
    const pirate = next.seats[0]?.engaged.find((id) => next.cards[id]?.code === "pirate1");
    expect(pirate).toBeDefined();
    expect(next.cards[pirate!]?.resources).toBe(3);
  });
});

describe("ending the Corsair deck (dcce.from-sea-to-land)", () => {
  it("shuffles the Corsair deck and its discard pile into the encounter deck and leaves no Corsair deck", () => {
    const { state, ids, ctx } = table(RECORDS, 1, ["corsair", "pirate1", "pirate2"]);
    const prepared = play(state, ctx, ids.prep!);
    const spare = spawn(prepared, "pirate1", { zone: "corsairDiscard" });
    const next = play(spare.state, ctx, ids.end!);
    expect(next.corsairDeck).toBeUndefined();
    expect(next.corsairDiscard).toBeUndefined();
    expect(codesIn(next, next.encounterDeck)).toEqual(["corsair", "pirate1", "pirate1", "pirate2"]);
    expect(next.cards[spare.id]?.zone).toBe("encounterDeck");
    expect(next.seedCursor).toBeGreaterThan(spare.state.seedCursor);
  });

  it("sends a non-ship enemy that is discarded afterwards to the encounter discard pile, and Boarding reveals nothing", () => {
    const { state, ids, ctx } = table(RECORDS, 1, ["corsair", "pirate1"]);
    const ended = endCorsairDeck(play(state, ctx, ids.prep!));
    const pirate = spawn(ended, "pirate2", { zone: "engaged", seat: 0 });
    const gone = strike({ ...pirate.state, phase: "Combat", mode: "playerAttacks", window: { kind: "playerAttack" }, passed: [] }, ctx, pirate.id, ids.aragorn!);
    expect(gone.cards[pirate.id]?.zone).toBe("encounterDiscard");
    expect(play(gone, ctx, ids.reveal!).seats[0]?.engaged).toEqual([]);
  });

  it("changes nothing in a game that never prepared a Corsair deck", () => {
    const { state } = table(RECORDS);
    expect(endCorsairDeck(state)).toBe(state);
  });
});
