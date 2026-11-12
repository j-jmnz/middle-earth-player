import { describe, expect, it } from "vitest";

import { definePrinted } from "../../core/printed.ts";
import { holds } from "../../interpret/conditions.ts";
import { runInstruction } from "../../interpret/interpret.ts";
import type { ScenarioState } from "../../core/state.ts";
import { spawn } from "../../core/zones.ts";
import { hero, table } from "../defense/table.ts";
import { dialCopy } from "./dial.ts";

// Rules: rr.attachment-cards, rr.ownership-and-control, rr.in-play-and-out-of-play (data/rules/entries.json); ledger lines 145016:A:1, 145016:A:3, 145022:A:2, 145063:A:1, 145065:A:1.
// A copy of Overcome by Fear on a player's threat dial: attached from the set-aside copies, one to a dial, detached back to them, the rest removed from the game.

const FEAR = "145016";
const fear = definePrinted({ code: FEAR, name: "Overcome by Fear", type: "objective", sphere: "neutral" });

function setAside(copies: number, seats: 1 | 2 = 1) {
  const built = table({ seatCount: seats, cards: [hero("a"), hero("c"), fear], effects: [], heroes: seats === 2 ? [{ code: "a" }, { code: "c", seat: 1 }] : [{ code: "a" }] });
  let state = built.state;
  const ids: string[] = [];
  for (let at = 0; at < copies; at += 1) {
    const spawned = spawn(state, FEAR, { zone: "setAside" }, "down");
    state = spawned.state;
    ids.push(spawned.id);
  }
  return { state, ids, ctx: built.ctx };
}

const run = (state: ScenarioState, ctx: ReturnType<typeof setAside>["ctx"], instruction: Parameters<typeof runInstruction>[1], seat = 0) => runInstruction(state, instruction, { seat, sourceId: null }, ctx, []);

describe("AttachToDial (145063:A:1, 145022:A:2)", () => {
  it("puts a set-aside copy in the actor's play area under their control, attached to no card, faceup", () => {
    const { state, ids, ctx } = setAside(4);
    const next = run(state, ctx, { verb: "AttachToDial", code: FEAR });
    const id = dialCopy(next, 0, FEAR);
    expect(id).toBe(ids[0]);
    expect(next.cards[id!]).toMatchObject({ zone: "play", controller: 0, host: null, face: "up" });
    expect(next.setAside).toHaveLength(3);
  });

  it("holds one copy for each dial (Limit 1 per threat dial, 145016:A:1): a second attach does nothing", () => {
    const { state, ctx } = setAside(4);
    const once = run(state, ctx, { verb: "AttachToDial", code: FEAR });
    const twice = run(once, ctx, { verb: "AttachToDial", code: FEAR });
    expect(twice).toBe(once);
    expect(twice.setAside).toHaveLength(3);
  });

  it("gives each seat its own copy", () => {
    const { state, ctx } = setAside(4, 2);
    const both = run(run(state, ctx, { verb: "AttachToDial", code: FEAR }, 0), ctx, { verb: "AttachToDial", code: FEAR }, 1);
    expect([dialCopy(both, 0, FEAR), dialCopy(both, 1, FEAR)].every((id) => id != null)).toBe(true);
    expect(dialCopy(both, 0, FEAR)).not.toBe(dialCopy(both, 1, FEAR));
  });

  it("does nothing when no copy is set aside", () => {
    const { state, ctx } = setAside(0);
    expect(run(state, ctx, { verb: "AttachToDial", code: FEAR })).toBe(state);
  });

  it("attaches the source card itself with no code: the Setup of a copy that waits in the pool (145016:A:1)", () => {
    const { state, ids, ctx } = setAside(1);
    const next = runInstruction(state, { verb: "AttachToDial" }, { seat: 0, sourceId: ids[0]! }, ctx, []);
    expect(dialCopy(next, 0, FEAR)).toBe(ids[0]);
  });
});

describe("DetachFromDial and RemoveSetAside (145016:A:3, 145065:A:1, 145063:A:1)", () => {
  it("sets the copy on the actor's dial aside, out of play, where a player may attach it again", () => {
    const { state, ids, ctx } = setAside(2);
    const attached = run(state, ctx, { verb: "AttachToDial", code: FEAR });
    const detached = run(attached, ctx, { verb: "DetachFromDial", code: FEAR });
    expect(dialCopy(detached, 0, FEAR)).toBeUndefined();
    expect(detached.cards[ids[0]!]?.zone).toBe("setAside");
    expect(detached.setAside).toHaveLength(2);
    expect(dialCopy(run(detached, ctx, { verb: "AttachToDial", code: FEAR }), 0, FEAR)).toBeDefined();
  });

  it("detaches only from the dial it is told, and nothing from an empty one", () => {
    const { state, ctx } = setAside(2, 2);
    const attached = run(state, ctx, { verb: "AttachToDial", code: FEAR }, 0);
    expect(run(attached, ctx, { verb: "DetachFromDial", code: FEAR }, 1)).toBe(attached);
  });

  it("removes every set-aside copy from the game, leaving the attached ones", () => {
    const { state, ids, ctx } = setAside(4);
    const attached = run(state, ctx, { verb: "AttachToDial", code: FEAR });
    const removed = run(attached, ctx, { verb: "RemoveSetAside", code: FEAR });
    expect(removed.setAside).toEqual([]);
    expect(removed.removed).toEqual(ids.slice(1));
    expect(dialCopy(removed, 0, FEAR)).toBe(ids[0]);
  });
});

describe("the conditions onDial and canAttachToDial", () => {
  it("offers an attach only while a copy is set aside and the dial holds none, and a detach only with one on the dial", () => {
    const { state, ctx } = setAside(1);
    const scope = { actor: 0, sourceId: null, returned: 0 };
    const attach = { kind: "canAttachToDial", code: FEAR } as const;
    const on = { kind: "onDial", code: FEAR } as const;
    expect([holds(state, attach, scope, ctx), holds(state, on, scope, ctx)]).toEqual([true, false]);
    const attached = run(state, ctx, { verb: "AttachToDial", code: FEAR });
    expect([holds(attached, attach, scope, ctx), holds(attached, on, scope, ctx)]).toEqual([false, true]);
    // The last copy is on the dial: none is left to attach, whatever the dial holds.
    const other = { ...scope, actor: 1 };
    expect(holds(attached, attach, other, ctx)).toBe(false);
  });
});
