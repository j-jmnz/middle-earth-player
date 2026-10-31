import { describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { definePrinted } from "../printed.ts";
import { legalIntents, reduce } from "../reduce.ts";
import type { ScenarioState } from "../state.ts";
import { spawn } from "../zones.ts";
import { headingOf } from "./sea-heading.ts";
import { fleetChoice } from "./sea-fleet.ts";
import { hero, navigation, seaTable, send, ship, type Table } from "./sea-table.ts";

// Rules: dcce.prepare-your-fleet, dcce.heading (data/rules/entries.json). Each player takes one of the six ships, one of them the Dream-chaser, a lone
// player the Dream-chaser and one other; the ships not used leave the game; the Heading card goes on the Dream-chaser, on-course.

const FLEET = [
  ["dc", "Dream-chaser"],
  ["star", "Dawn Star"],
  ["dusk", "Duskbringer"],
  ["glor", "Glórinaith"],
  ["nare", "Nárelenya"],
  ["wing", "Silver Wing"],
] as const;

const prepare: Effect = { id: "call:action:1", cardCode: "call", lines: ["call:A:1"], timing: "action", instructions: [{ verb: "PrepareFleet" }] };

// The six ships set aside and the Heading card in the staging area, with a card in hand whose Action prepares the fleet.
function fleetTable(seatCount: 1 | 2): Table {
  const built = seaTable({
    seatCount,
    cards: [hero("aragorn"), hero("boromir"), ...FLEET.map(([code, name]) => ship(code, name)), navigation(), definePrinted({ code: "call", name: "call", type: "event", sphere: "tactics", cost: 0 })],
    effects: [prepare],
    heroes: seatCount === 2 ? [{ code: "aragorn" }, { code: "boromir", seat: 1 }] : [{ code: "aragorn" }],
    hand: [{ code: "call" }],
  });
  let state = built.state;
  const ids = { ...built.ids };
  for (const [code] of FLEET) {
    const spawned = spawn(state, code, { zone: "setAside" }, "down");
    state = spawned.state;
    ids[code] = spawned.id;
  }
  const staged = spawn(state, "nav", { zone: "staging" });
  ids.nav = staged.id;
  return { state: { ...staged.state, mode: "combatActions", phase: "Combat", boundaryPhase: "Combat", window: { kind: "pass" }, passed: [] }, ids, ctx: built.ctx };
}

const prepared = (table: Table): ScenarioState => send(table.state, { type: "PlayCard", cardId: table.ids.call!, payments: [] }, table.ctx);
const choose = (state: ScenarioState, table: Table, code: string): ScenarioState => send(state, { type: "Choose", optionId: table.ids[code]! }, table.ctx);

describe("preparing the fleet (dcce.prepare-your-fleet)", () => {
  it("asks each player for a ship in turn and takes the Dream-chaser for the last player who has not got it", () => {
    const table = fleetTable(2);
    const asked = prepared(table);
    // The first player chooses among the six.
    expect(asked.window).toMatchObject({ kind: "choose", seat: 0 });
    expect(asked.window?.kind === "choose" && asked.window.options.length).toBe(6);
    expect(legalIntents(asked, table.ctx)).toHaveLength(6);
    const done = choose(asked, table, "star");
    // The second player is left with the Dream-chaser alone: no question, the ship is theirs.
    expect(done.cards[table.ids.star!]).toMatchObject({ zone: "play", controller: 0 });
    expect(done.cards[table.ids.dc!]).toMatchObject({ zone: "play", controller: 1, face: "up" });
    expect(done.window).toEqual({ kind: "pass" });
  });

  it("lets the first player take the Dream-chaser, and then the second player any other ship", () => {
    const table = fleetTable(2);
    const second = choose(prepared(table), table, "dc");
    expect(second.window).toMatchObject({ kind: "choose", seat: 1 });
    expect(second.window?.kind === "choose" && second.window.options).toEqual(["star", "dusk", "glor", "nare", "wing"].map((code) => table.ids[code]));
    const done = choose(second, table, "wing");
    expect(done.cards[table.ids.dc!]?.controller).toBe(0);
    expect(done.cards[table.ids.wing!]?.controller).toBe(1);
  });

  it("removes the ships not used from the game", () => {
    const table = fleetTable(2);
    const done = choose(choose(prepared(table), table, "dc"), table, "wing");
    for (const code of ["star", "dusk", "glor", "nare"]) {
      expect(done.cards[table.ids[code]!]?.zone).toBe("removed");
      expect(done.removed).toContain(table.ids[code]);
    }
    expect(done.setAside).toEqual([]);
  });

  it("gives a lone player the Dream-chaser without asking, then the ship of their choice", () => {
    const table = fleetTable(1);
    const asked = prepared(table);
    expect(asked.cards[table.ids.dc!]).toMatchObject({ zone: "play", controller: 0 });
    expect(asked.window).toMatchObject({ kind: "choose", seat: 0 });
    expect(asked.window?.kind === "choose" && asked.window.options).toHaveLength(5);
    const done = choose(asked, table, "dusk");
    expect(done.cards[table.ids.dusk!]?.controller).toBe(0);
    expect(done.removed).toHaveLength(4);
  });

  it("attaches the Heading card to the Dream-chaser, on-course", () => {
    const table = fleetTable(2);
    const done = choose(prepared(table), table, "star");
    expect(headingOf(done)).toBe("Sun");
    expect(done.sea?.headingCard).toBe(table.ids.nav);
    expect(done.cards[table.ids.nav!]).toMatchObject({ host: table.ids.dc, zone: "play", controller: 1 });
    expect(done.cards[table.ids.dc!]?.attachments).toEqual([table.ids.nav]);
    expect(done.staging).toEqual([]);
  });

  it("offers a choice the engine can show: the seat that chooses and the ships it may take", () => {
    const table = fleetTable(2);
    const choice = fleetChoice(table.state, table.ctx);
    expect(choice?.seat).toBe(0);
    expect(choice?.options).toHaveLength(6);
  });

  it("refuses a ship that is not one of the options", () => {
    const table = fleetTable(2);
    const asked = prepared(table);
    expect(reduce(asked, { type: "Choose", optionId: "nonsense" }, table.ctx).ok).toBe(false);
  });
});
