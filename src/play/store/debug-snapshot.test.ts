import { describe, expect, it } from "vitest";

import { CATALOG_VERSION } from "../../catalog/version.ts";
import { updateCard } from "../../rules/core/state.ts";
import { attachTo, spawn } from "../../rules/core/zones.ts";
import { ENGINE_VERSION } from "../../rules/engine/version.ts";

import { debugSnapshot, debugText, type DebugCard, type DebugInput } from "./debug-snapshot.ts";
import { twoHanded } from "./seat-fixture.ts";

// The Copy game state row (docs/design-system-table.md, Table menu): the whole table as plain values.
describe("debugSnapshot", () => {
  const table = twoHanded();
  const names: Record<string, string> = { aragorn: "Aragorn", gimli: "Gimli", ally: "Faramir", stranger: "Beregond", foe: "Wolf" };
  const input: DebugInput = { build: { app: "0.0.0", platform: "test" }, nameOf: (code) => names[code] ?? code, intents: [{ type: "Pass" }], roundSteps: [] };
  const ids = (cards: unknown) => (cards as DebugCard[]).map((card) => card.id);
  type Seats = { threat: number; heroes: DebugCard[]; hand: DebugCard[]; deck: DebugCard[]; discard: DebugCard[]; engaged: DebugCard[] }[];

  it("writes each seat's cards by zone, with the deck in order, and names every card", () => {
    const seats = debugSnapshot(table.state, input).seats as Seats;
    expect(seats).toHaveLength(2);
    for (const seat of [0, 1]) {
      expect(ids(seats[seat]?.heroes)).toEqual([table.seats[seat]?.hero]);
      expect(ids(seats[seat]?.hand)).toEqual(table.seats[seat]?.hand);
      expect(ids(seats[seat]?.deck)).toEqual(table.seats[seat]?.deck);
      expect(ids(seats[seat]?.discard)).toEqual(table.seats[seat]?.discard);
    }
    expect(seats[0]?.heroes[0]).toMatchObject({ code: "aragorn", name: "Aragorn", resources: 5 });
    expect(seats[1]?.engaged[0]).toMatchObject({ code: "foe", name: "Wolf" });
    // A resting field is left out.
    expect(seats[0]?.hand[0]).toEqual({ id: table.seats[0].hand[0], code: "ally", name: "Faramir" });
  });

  it("writes the scenario's place in the round, the staging area and the versions", () => {
    const snapshot = debugSnapshot(table.state, input);
    expect(snapshot.scenario).toMatchObject({ seatCount: 2, phase: "Planning", mode: "planning", activeSeat: 0, firstPlayer: 0, window: { kind: "pass" }, lost: false });
    expect(ids(snapshot.staging)).toEqual(table.staging);
    expect(snapshot.build).toEqual({ app: "0.0.0", platform: "test", engine: ENGINE_VERSION, catalog: CATALOG_VERSION });
    expect(snapshot.replay).toEqual({ seed: table.state.seed, seedCursor: table.state.seedCursor, intents: [{ type: "Pass" }] });
  });

  it("nests an attachment under its host with its tokens, and lists a card no zone list holds under its zone", () => {
    const hero = table.seats[0].hero;
    const attached = spawn(table.state, "ally", { zone: "attached" });
    const damaged = updateCard(attachTo(attached.state, attached.id, hero), attached.id, { damage: 2, exhausted: true });
    const snapshot = debugSnapshot(damaged, input);
    const host = (snapshot.seats as Seats)[0]?.heroes[0];
    expect(host?.attachments).toEqual([{ id: attached.id, code: "ally", name: "Faramir", damage: 2, exhausted: true, host: hero }]);
    expect(snapshot.other).toEqual({});
    // Every instance is written once.
    const text = debugText(damaged, input);
    for (const id of Object.keys(damaged.cards)) expect(text.split(`"id": "${id}"`).length - 1).toBe(1);
  });

  it("leaves the undo log out, so the text does not hold earlier states", () => {
    expect(debugSnapshot(table.state, input)).not.toHaveProperty("undo");
    expect(JSON.parse(debugText(table.state, input))).toMatchObject({ scenario: { round: table.state.round } });
  });
});
