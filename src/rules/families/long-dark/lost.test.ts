import { describe, expect, it } from "vitest";

import type { Effect, Instruction } from "../../../catalog/boundary.ts";
import { pushEffectFrame } from "../../interpret/effect-frames.ts";
import { settle } from "../../engine/machine.ts";
import { definePrinted } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { spawn } from "../../core/zones.ts";
import { hero, send, table, type TableSpec } from "../defense/table.ts";
import { STOP as PARK } from "../mount-doom/stop.ts";

// Rules: dwd.lost-effects, rr.in-play-and-out-of-play, rr.shadow-effects, faq.simultaneous-effects (data/rules/entries.json); ledger lines 04086:B:2, 04099:A:2, 901604:A:2, 901607:A:1. TriggerLost: every faceup Lost effect in play, one the actor chooses, or a different one for each player.

const location = (code: string) => definePrinted({ code, name: code, type: "location", threat: 1 });
const lost = (code: string, amount: number): Effect => ({ id: `${code}:forced:1`, cardCode: code, lines: [`${code}:A:1`], timing: "forced", trigger: "lost", instructions: [{ verb: "RaiseThreat", amount, who: "eachSeat" }] });
const EFFECTS = [lost("l1", 1), lost("l2", 2), lost("l3", 4)];
const CARDS = [hero("a"), hero("b"), location("l1"), location("l2"), location("l3"), location("plain")];

type Options = Partial<TableSpec> & { instructions: readonly Instruction[] };

function begin(options: Options) {
  const { instructions, ...rest } = options;
  const base = table({ cards: CARDS, effects: EFFECTS, heroes: [{ code: "a" }], threat: 30, ...rest });
  const pushed = pushEffectFrame({ ...base.state, window: null }, { frame: "whenRevealed", sourceId: null, actor: 0, peril: false, effectId: "test", instructions: [...instructions, PARK], cancel: null, blockCancel: null }, []);
  return { ...base, state: settle(pushed, base.ctx, []) };
}

type Begun = ReturnType<typeof begin>;
const threat = (state: ScenarioState, seat = 0) => state.seats[seat]?.threat ?? 0;
const choose = (run: Begun, state: ScenarioState, optionId: string) => send(state, { type: "Choose", optionId }, run.ctx);
const windowOptions = (state: ScenarioState) => (state.window?.kind === "choose" ? state.window.options : []);

describe("TriggerLost all (04086:B:2, 04099:A:2)", () => {
  it("runs the Lost line of every faceup card in play, each in full", () => {
    const run = begin({ instructions: [{ verb: "TriggerLost", mode: "all" }], staging: [{ code: "l1" }, { code: "l2" }, { code: "plain" }] });
    expect(threat(run.state)).toBe(33);
  });

  it("counts each copy as its own Lost effect, and nothing in play as nothing happening", () => {
    const twice = begin({ instructions: [{ verb: "TriggerLost", mode: "all" }], staging: [{ code: "l1", key: "one" }, { code: "l1", key: "two" }] });
    expect(threat(twice.state)).toBe(32);
    const none = begin({ instructions: [{ verb: "TriggerLost", mode: "all" }], staging: [{ code: "plain" }] });
    expect(threat(none.state)).toBe(30);
  });

  it("does not hear a card out of play, a shadow card included", () => {
    const base = begin({ instructions: [], staging: [{ code: "l1" }], enemies: [] });
    const shadowed = spawn(base.state, "l2", { zone: "encounterDiscard" }).state;
    const run = { ...base, state: shadowed };
    const next = settle(pushEffectFrame({ ...run.state, window: null }, { frame: "whenRevealed", sourceId: null, actor: 0, peril: false, effectId: "again", instructions: [{ verb: "TriggerLost", mode: "all" }, PARK], cancel: null, blockCancel: null }, []), run.ctx, []);
    expect(threat(next)).toBe(31);
  });
});

describe("TriggerLost chooseOne (901604:A:2, 901605:A:2)", () => {
  it("asks the actor which card's Lost effect to trigger, and triggers only that one", () => {
    const run = begin({ instructions: [{ verb: "TriggerLost", mode: "chooseOne" }], staging: [{ code: "l1" }, { code: "l2" }] });
    expect(run.state.window).toMatchObject({ kind: "choose", seat: 0 });
    expect(windowOptions(run.state)).toEqual([run.ids.l1, run.ids.l2]);
    expect(threat(choose(run, run.state, run.ids.l2 ?? ""))).toBe(32);
  });

  it("triggers the only Lost effect without asking, and nothing with none", () => {
    expect(threat(begin({ instructions: [{ verb: "TriggerLost", mode: "chooseOne" }], staging: [{ code: "l3" }] }).state)).toBe(34);
    expect(threat(begin({ instructions: [{ verb: "TriggerLost", mode: "chooseOne" }], staging: [{ code: "plain" }] }).state)).toBe(30);
  });
});

describe("TriggerLost eachDifferent (901607:A:1)", () => {
  const two = { seatCount: 2 as const, heroes: [{ code: "a" }, { code: "b", seat: 1 }] };

  it("has each player in turn choose a Lost effect no earlier player chose, and trigger it before the next chooses", () => {
    const run = begin({ ...two, instructions: [{ verb: "TriggerLost", mode: "eachDifferent" }], staging: [{ code: "l1" }, { code: "l2" }, { code: "l3" }] });
    expect(run.state.window).toMatchObject({ kind: "choose", seat: 0 });
    const first = choose(run, run.state, run.ids.l3 ?? "");
    // The first player's effect resolved (4 to each seat); the second player chooses among the two left.
    expect(threat(first, 0)).toBe(34);
    expect(first.window).toMatchObject({ kind: "choose", seat: 1 });
    expect(windowOptions(first)).toEqual([run.ids.l1, run.ids.l2]);
    expect(threat(choose(run, first, run.ids.l1 ?? ""), 0)).toBe(35);
  });

  it("skips a player with no Lost effect left, two copies being two different effects", () => {
    const run = begin({ ...two, instructions: [{ verb: "TriggerLost", mode: "eachDifferent" }], staging: [{ code: "l1", key: "one" }] });
    expect(threat(run.state, 0)).toBe(31);
    expect(run.state.window).not.toMatchObject({ kind: "choose", seat: 1 });
    const copies = begin({ ...two, instructions: [{ verb: "TriggerLost", mode: "eachDifferent" }], staging: [{ code: "l1", key: "one" }, { code: "l1", key: "two" }] });
    expect(copies.state.window).toMatchObject({ kind: "choose", seat: 0 });
    const next = choose(copies, copies.state, copies.ids.one ?? "");
    // The second player's choice is the copy left, triggered without asking: each seat's threat rose by 1 twice.
    expect(threat(next, 1)).toBe(32);
    expect(threat(next, 0)).toBe(32);
  });
});
