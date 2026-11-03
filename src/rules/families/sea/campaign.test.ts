import { describe, expect, it } from "vitest";

import type { Effect, Instruction } from "../../../catalog/boundary.ts";
import { definePrinted } from "../../core/printed.ts";
import { legalIntents } from "../../engine/reduce.ts";
import type { ScenarioState } from "../../core/state.ts";
import { updateCard } from "../../core/state.ts";
import { spawn } from "../../core/zones.ts";
import { enemy, hero, seaTable, send, ship, shipEnemy, type Table } from "./table.ts";

// Rules: dcce.ship-objectives, dcce.prepare-your-fleet, rr.search, rr.the-word-choose (data/rules/entries.json); ledger lines 11171:A:2, 11021:A:1, 11055:A:2. What a Dream-chaser campaign card's
// Setup does to the ships (FitShips: a Modification boon for each ship; TradeShipDamage: 2 damage for a resource), a Ship objective's damage from an encounter card (DamageShip) and the
// search for the Ship enemies with the highest Threat (SearchShips).
const call = (instructions: readonly Instruction[]): Effect => ({ id: "call:action:1", cardCode: "call", lines: ["call:A:1"], timing: "action", instructions: [...instructions] });
const callCard = definePrinted({ code: "call", name: "call", type: "event", sphere: "tactics", cost: 0 });
const boon = (code: string) => definePrinted({ code, name: code, type: "attachment", sphere: "neutral", cost: 0 });

type Setup = { seats?: 1 | 2; ships: readonly { code: string; seat: number }[]; instructions: readonly Instruction[]; extra?: ReturnType<typeof definePrinted>[]; boons?: readonly string[]; heroes?: number };

// A table in the combat phase's pass window with a card in hand whose Action runs the instructions, the ships in play and the boons set aside.
function setup({ seats = 1, ships, instructions, extra = [], boons = [], heroes = 1 }: Setup): Table {
  const built = seaTable({
    seatCount: seats,
    cards: [hero("aragorn"), hero("gimli"), hero("boromir"), callCard, ...ships.map(({ code }) => ship(code, code)), ...boons.map(boon), ...extra],
    effects: [call(instructions)],
    heroes: seats === 2 ? [{ code: "aragorn" }, { code: "boromir", seat: 1 }] : heroes === 2 ? [{ code: "aragorn" }, { code: "gimli" }] : [{ code: "aragorn" }],
    allies: ships.map(({ code, seat }) => ({ code, seat })),
    hand: [{ code: "call" }],
  });
  let state = built.state;
  const ids = { ...built.ids };
  for (const code of boons) {
    const spawned = spawn(state, code, { zone: "setAside" }, "down");
    state = spawned.state;
    ids[code] = spawned.id;
  }
  return { state: { ...state, mode: "combatActions", phase: "Combat", boundaryPhase: "Combat", window: { kind: "pass" }, passed: [] }, ids, ctx: built.ctx };
}

const use = (table: Table): ScenarioState => send(table.state, { type: "PlayCard", cardId: table.ids.call!, payments: [] }, table.ctx);
const choose = (state: ScenarioState, table: Table, option: string): ScenarioState => send(state, { type: "Choose", optionId: option }, table.ctx);

describe("FitShips (11171:A:2)", () => {
  const fit: Instruction = { verb: "FitShips", codes: ["b1", "b2", "b3"] };

  it("asks each ship's controller for a boon, in the order of the fleet, and attaches it; the boons left stay set aside", () => {
    const table = setup({ seats: 2, ships: [{ code: "dc", seat: 0 }, { code: "star", seat: 1 }], instructions: [fit], boons: ["b1", "b2", "b3"] });
    const first = use(table);
    expect(first.window).toMatchObject({ kind: "choose", seat: 0 });
    expect(first.window?.kind === "choose" && first.window.options).toEqual([table.ids.b1, table.ids.b2, table.ids.b3]);
    const second = choose(first, table, table.ids.b2!);
    expect(second.cards[table.ids.b2!]).toMatchObject({ zone: "play", host: table.ids.dc, controller: 0 });
    expect(second.window).toMatchObject({ kind: "choose", seat: 1 });
    expect(second.window?.kind === "choose" && second.window.options).toEqual([table.ids.b1, table.ids.b3]);
    const done = choose(second, table, table.ids.b3!);
    expect(done.cards[table.ids.b3!]).toMatchObject({ zone: "play", host: table.ids.star, controller: 1 });
    expect(done.cards[table.ids.b1!]?.zone).toBe("setAside");
    // The card's window is given back.
    expect(done.window).toEqual({ kind: "pass" });
  });

  it("takes the last boon without asking, and gives a ship that has one nothing more", () => {
    const table = setup({ ships: [{ code: "dc", seat: 0 }], instructions: [fit], boons: ["b1"] });
    const done = use(table);
    expect(done.window?.kind).not.toBe("choose");
    expect(done.cards[table.ids.b1!]).toMatchObject({ zone: "play", host: table.ids.dc });
  });
});

describe("TradeShipDamage (11171:A:2)", () => {
  const trade: Instruction = { verb: "TradeShipDamage", damage: 2, resources: 1 };

  it("asks the controller of each ship to trade or keep: a trade deals 2 damage to the ship and adds a resource to the hero", () => {
    const table = setup({ ships: [{ code: "dc", seat: 0 }, { code: "star", seat: 0 }], instructions: [trade] });
    const asked = use(table);
    expect(asked.window).toMatchObject({ kind: "choose", seat: 0, options: ["trade", "keep"] });
    // The first ship trades; the lone hero takes the resource. The second ship is asked next and keeps.
    const second = choose(asked, table, "trade");
    expect(second.cards[table.ids.dc!]?.damage).toBe(2);
    expect(second.cards[table.ids.aragorn!]?.resources).toBe(4);
    expect(second.window).toMatchObject({ kind: "choose", options: ["trade", "keep"] });
    const done = choose(second, table, "keep");
    expect(done.cards[table.ids.star!]?.damage).toBe(0);
    expect(done.cards[table.ids.aragorn!]?.resources).toBe(4);
  });

  it("asks which hero's pool when the controller has several", () => {
    const table = setup({ ships: [{ code: "dc", seat: 0 }], heroes: 2, instructions: [trade] });
    const asked = use(table);
    const picked = choose(asked, table, "trade");
    expect(picked.window?.kind === "choose" && picked.window.options).toEqual([table.ids.aragorn, table.ids.gimli]);
    const done = choose(picked, table, table.ids.gimli!);
    expect(done.cards[table.ids.gimli!]?.resources).toBe(4);
    expect(done.cards[table.ids.aragorn!]?.resources).toBe(3);
    expect(done.cards[table.ids.dc!]?.damage).toBe(2);
  });
});

describe("DamageShip (11055:A:2)", () => {
  it("deals damage to the Ship objective picked, which is immune to player card effects but not to this", () => {
    const table = setup({ ships: [{ code: "dc", seat: 0 }], instructions: [{ verb: "Pick", pick: { type: "character", control: "you", trait: "Ship" } }, { verb: "DamageShip", amount: 3 }] });
    // The stand-in ship is immune to player card effects, as the real ships are.
    const immune = { ...table, state: updateCard(table.state, table.ids.dc!, {}) };
    expect(use(immune).cards[table.ids.dc!]?.damage).toBe(3);
  });
});

describe("SearchShips (11021:A:1)", () => {
  const search = (count: number): Instruction => ({ verb: "SearchShips", count });
  const cards = [shipEnemy("low", { threat: 1 }), shipEnemy("mid", { threat: 3 }), shipEnemy("midb", { threat: 3 }), shipEnemy("top", { threat: 4 }), enemy("pirate", { threat: 9 })];

  function deckTable(count: number, deck: readonly string[], discard: readonly string[] = []): Table {
    const table = setup({ ships: [{ code: "dc", seat: 0 }], instructions: [search(count)], extra: cards });
    let state = table.state;
    for (const code of deck) state = spawn(state, code, { zone: "encounterDeck" }, "down").state;
    for (const code of discard) state = spawn(state, code, { zone: "encounterDiscard" }).state;
    return { ...table, state };
  }
  const staging = (state: ScenarioState): string[] => state.staging.map((id) => state.cards[id]?.code ?? "").sort();

  it("adds the Ship enemy with the highest Threat from the deck or the discard pile to the staging area, never a non-ship enemy", () => {
    expect(staging(use(deckTable(1, ["low", "pirate", "top", "mid"])))).toEqual(["top"]);
    expect(staging(use(deckTable(1, ["low"], ["top"])))).toEqual(["top"]);
  });

  it("adds the two highest with a count of 2, the first player choosing between Ship enemies tied that are not copies of one card", () => {
    const table = deckTable(2, ["top", "mid", "midb", "low"]);
    const asked = use(table);
    expect(asked.window?.kind === "choose" && asked.window.options.map((id) => asked.cards[id]?.code)).toEqual(["mid", "midb"]);
    expect(staging(asked)).toEqual(["top"]);
    const done = choose(asked, table, asked.window?.kind === "choose" ? (asked.window.options[1] ?? "") : "");
    expect(staging(done)).toEqual(["midb", "top"]);
    // Copies of one card are the same choice: no question.
    const copies = deckTable(2, ["top", "mid", "mid"]);
    expect(use(copies).window?.kind).not.toBe("choose");
    expect(staging(use(copies))).toEqual(["mid", "top"]);
  });

  it("finds nothing when no Ship enemy is there", () => {
    expect(staging(use(deckTable(1, ["pirate"])))).toEqual([]);
    expect(legalIntents(use(deckTable(1, ["pirate"])), deckTable(1, ["pirate"]).ctx).length).toBeGreaterThan(0);
  });
});
