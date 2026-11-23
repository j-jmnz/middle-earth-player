import { describe, expect, it } from "vitest";

import type { Effect, Instruction } from "../../../catalog/boundary.ts";
import { pushEffectFrame } from "../../interpret/effect-frames.ts";
import { settle } from "../../engine/machine.ts";
import { definePrinted } from "../../core/printed.ts";
import { modifiedStat } from "../../core/keywords.ts";
import { spawn } from "../../core/zones.ts";
import { hero, table } from "../defense/table.ts";
import { STOP } from "../mount-doom/stop.ts";
import { stackedUnder } from "./stack.ts";

// Rules: hob.burgle, rr.modifiers (data/rules/entries.json); ledger lines 132071:A:1, 132072:B:1, 132043:A:1, 132045:A:1. The treasures stacked under a card and taken from the top, and the halved Threat.

const location = (code: string) => definePrinted({ code, name: code, type: "location", threat: 12, questPoints: 4 });
const treasure = (code: string) => definePrinted({ code, name: code, type: "treasure" as never, campaignKind: "treasure" });
const CODES = ["t1", "t2", "t3", "t4", "t5"];

function begin(instructions: readonly Instruction[], effects: readonly Effect[] = []) {
  const base = table({ cards: [hero("a"), location("mtn"), ...CODES.map(treasure)], effects, heroes: [{ code: "a" }], staging: [{ code: "mtn" }] });
  let state = base.state;
  for (const code of CODES) state = spawn(state, code, { zone: "setAside" }).state;
  const pushed = pushEffectFrame({ ...state, window: null }, { frame: "setup", sourceId: null, actor: 0, peril: false, effectId: "test", instructions: [...instructions, STOP], cancel: null, blockCancel: null }, []);
  return { ...base, state: settle(pushed, base.ctx, []) };
}

const STACK: Instruction = { verb: "StackUnder", codes: CODES, under: "mtn" };
const TAKE: Instruction = { verb: "TakeStacked", under: "mtn" };

describe("StackUnder and TakeStacked (132071:A:1, 132072:B:1)", () => {
  it("stacks the set-aside cards facedown under the card in a shuffled order, out of play", () => {
    const run = begin([STACK]);
    const host = run.ids.mtn ?? "";
    const stack = stackedUnder(run.state, host);
    expect(stack.length).toBe(5);
    expect(new Set(stack.map((id) => run.state.cards[id]?.code))).toEqual(new Set(CODES));
    expect(run.state.setAside).toEqual([]);
    expect(stack.every((id) => run.state.cards[id]?.zone === "under" && run.state.cards[id]?.face === "down")).toBe(true);
  });

  it("takes the top card of the stack into the first player's hand, one at a time, and nothing from an empty stack", () => {
    const run = begin([STACK, TAKE]);
    const host = run.ids.mtn ?? "";
    const before = begin([STACK]);
    const top = stackedUnder(before.state, host)[0] ?? "";
    expect(run.state.seats[0]?.hand).toEqual([top]);
    expect(run.state.cards[top]?.owner).toBe(0);
    expect(stackedUnder(run.state, host).length).toBe(4);
    const empty = begin([STACK, TAKE, TAKE, TAKE, TAKE, TAKE, TAKE]);
    expect(empty.state.seats[0]?.hand.length).toBe(5);
    expect(stackedUnder(empty.state, host).length).toBe(0);
  });

  it("does nothing with no card in play to stack under", () => {
    const run = begin([{ verb: "StackUnder", codes: CODES, under: "nowhere" }]);
    expect(run.state.setAside.length).toBe(5);
  });
});

describe("threatHalved (132045:A:1)", () => {
  const flag = (id: string) => ({ instanceId: id, sourceId: id, stat: "threatHalved" as const, amount: 1, until: "endOfGame" as const });

  it("halves the Threat after the additive modifiers, rounding up", () => {
    const run = begin([]);
    const id = run.ids.mtn ?? "";
    const card = run.state.cards[id];
    if (!card) throw new Error("no card");
    expect(modifiedStat(run.state, card, "threat", run.ctx.cards)).toBe(12);
    const halved = { ...run.state, modifiers: [flag(id)] };
    expect(modifiedStat(halved, card, "threat", run.ctx.cards)).toBe(6);
    const less = { ...run.state, modifiers: [{ instanceId: id, sourceId: id, stat: "threat" as const, amount: -5, until: "endOfGame" as const }, flag(id)] };
    expect(modifiedStat(less, card, "threat", run.ctx.cards)).toBe(4);
  });
});
