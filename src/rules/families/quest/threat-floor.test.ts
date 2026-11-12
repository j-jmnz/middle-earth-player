import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";

import { runInstruction } from "../../interpret/interpret.ts";
import { withThreat, type ScenarioState } from "../../core/state.ts";
import { hero, table } from "../defense/table.ts";
import { recordStartingThreat, startingThreat } from "./threat.ts";

// Rules: rr.initial-threat-level, rr.setup, rr.threat-threat-dial (data/rules/entries.json); ledger line 145064:B:2.
// "Each player cannot reduce his threat below his initial threat level": the flag threatFloor on a seat stops a reduction at the threat set at Setup step 2.

const floorRecord: Effect = { id: "stage:constant:1", cardCode: "stage", lines: ["stage:B:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threatFloor", amount: 1, until: "whileSourceInPlay", target: "eachSeat" }] };

function floored(threat: number, start: number): { state: ScenarioState; ctx: ReturnType<typeof table>["ctx"] } {
  const built = table({ cards: [hero("a")], effects: [floorRecord], heroes: [{ code: "a" }], threat });
  const held = { ...built.state, startingThreat: [start], modifiers: [...built.state.modifiers, { instanceId: "seat:0", sourceId: built.ids.a!, stat: "threatFloor" as const, amount: 1, until: "endOfGame" as const }] };
  return { state: held, ctx: built.ctx };
}

const lower = (state: ScenarioState, ctx: ReturnType<typeof table>["ctx"], amount: number) => runInstruction(state, { verb: "LowerThreat", amount, who: "actor" }, { seat: 0, sourceId: null }, ctx, []);

describe("threatFloor (145064:B:2)", () => {
  it("lowers threat only down to the starting threat level: 5 off 28 with a start of 25 stops at 25", () => {
    const { state, ctx } = floored(28, 25);
    expect(lower(state, ctx, 5).seats[0].threat).toBe(25);
  });

  it("lowers by the whole amount while the floor is not reached", () => {
    const { state, ctx } = floored(31, 25);
    expect(lower(state, ctx, 5).seats[0].threat).toBe(26);
  });

  it("does not lower a threat that is already at or below the floor", () => {
    const { state, ctx } = floored(25, 25);
    expect(lower(state, ctx, 3).seats[0].threat).toBe(25);
    expect(lower(withThreat(state, 0, 20), ctx, 3).seats[0].threat).toBe(20);
  });

  it("is no limit without the flag", () => {
    const built = table({ cards: [hero("a")], effects: [], heroes: [{ code: "a" }], threat: 28 });
    const free = { ...built.state, startingThreat: [25] };
    expect(lower(free, built.ctx, 5).seats[0].threat).toBe(23);
  });

  it("keeps the starting threat level at Setup because a card of the game holds the flag", () => {
    const built = table({ cards: [hero("a")], effects: [floorRecord], heroes: [{ code: "a" }], threat: 28 });
    const withStage = { ...built.state, cards: { ...built.state.cards, s: { ...Object.values(built.state.cards)[0]!, id: "s", code: "stage" } } };
    expect(recordStartingThreat(withStage, built.ctx).startingThreat).toEqual([28]);
    expect(startingThreat(recordStartingThreat(withStage, built.ctx), 0, built.ctx)).toBe(28);
    expect(recordStartingThreat(built.state, built.ctx).startingThreat).toBeUndefined();
  });
});
