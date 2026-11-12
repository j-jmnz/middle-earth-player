import { describe, expect, it } from "vitest";

import { definePrinted } from "../../core/printed.ts";
import { runInstruction } from "../../interpret/interpret.ts";
import type { ScenarioState } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import { hero, table } from "../defense/table.ts";

// Rules: mec113.minas-tirith, rr.damage (data/rules/entries.json); ledger lines 145043:A:1, 145044:A:3, 145046:A:1.
// Minas Tirith and City Wall: damage on the objective goes on the wall first, up to its quest points, and only while the wall holds the flag; out of play the objective takes none.

const city = definePrinted({ code: "145043", name: "Minas Tirith", type: "objective" });
const wallCard = definePrinted({ code: "wall", name: "City Wall", type: "location", questPoints: 4, threat: 3 });

function city3(): { state: ScenarioState; ids: Record<string, string>; ctx: ReturnType<typeof table>["ctx"] } {
  const built = table({ cards: [hero("a"), city, wallCard], effects: [], heroes: [{ code: "a" }], staging: [{ code: "145043" }, { code: "wall" }] });
  return { state: built.state, ids: built.ids, ctx: built.ctx };
}

const walled = (state: ScenarioState, mt: string, wall: string): ScenarioState => ({ ...state, modifiers: [...state.modifiers, { instanceId: mt, sourceId: wall, stat: "damageFirst", amount: 1, until: "whileSourceInPlay" }] });
const damage = (state: ScenarioState, ctx: ReturnType<typeof table>["ctx"], amount: number): ScenarioState => runInstruction(state, { verb: "DamageMinasTirith", amount }, { seat: 0, sourceId: null }, ctx, []);

describe("DamageMinasTirith (145044:A:3)", () => {
  it("places the damage on the objective", () => {
    const { state, ids, ctx } = city3();
    expect(damage(state, ctx, 3).cards[ids["145043"]!]?.damage).toBe(3);
  });

  it("does nothing while Minas Tirith is out of play (mec113.minas-tirith)", () => {
    const { state, ids, ctx } = city3();
    const away = moveCard(state, ids["145043"]!, { zone: "setAside" });
    const next = damage(away, ctx, 3);
    expect(next.cards[ids["145043"]!]?.damage).toBe(0);
    expect(next.cards[ids.wall!]?.damage).toBe(0);
  });
});

describe("City Wall (145046:A:1)", () => {
  it("takes the damage meant for Minas Tirith up to its quest points and passes the rest on", () => {
    const { state, ids, ctx } = city3();
    const next = damage(walled(state, ids["145043"]!, ids.wall!), ctx, 6);
    expect(next.cards[ids.wall!]?.damage).toBe(4);
    expect(next.cards[ids["145043"]!]?.damage).toBe(2);
  });

  it("takes all of a smaller packet, and a later one goes past a full wall", () => {
    const { state, ids, ctx } = city3();
    const first = damage(walled(state, ids["145043"]!, ids.wall!), ctx, 3);
    expect([first.cards[ids.wall!]?.damage, first.cards[ids["145043"]!]?.damage]).toEqual([3, 0]);
    const second = damage(first, ctx, 3);
    expect([second.cards[ids.wall!]?.damage, second.cards[ids["145043"]!]?.damage]).toEqual([4, 2]);
  });

  it("redirects nothing without the flag (the wall is not the active location)", () => {
    const { state, ids, ctx } = city3();
    const next = damage(state, ctx, 6);
    expect([next.cards[ids.wall!]?.damage, next.cards[ids["145043"]!]?.damage]).toEqual([0, 6]);
  });
});
