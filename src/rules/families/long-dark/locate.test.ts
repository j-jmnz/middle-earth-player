import { describe, expect, it } from "vitest";

import type { Instruction } from "../../../catalog/boundary.ts";
import { pushEffectFrame } from "../../interpret/effect-frames.ts";
import { settle } from "../../engine/machine.ts";
import { definePrinted } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { legalIntents } from "../../engine/reduce.ts";
import { hero, send, table, type TableSpec } from "../defense/table.ts";
import { STOP as PARK } from "../mount-doom/stop.ts";
import { STOP } from "./locate.ts";

// Rules: dwd.locate-test, dwd.locate-test-example, rr.running-out-of-cards (data/rules/entries.json); ledger lines 04087:B:1, 04094:A:1, 04096:A:1, 901607:A:2. The locate test: the tester discards a hand card to discard the top card of the encounter deck until a PASS card passes it, or stops.

const plain = (code: string) => definePrinted({ code, name: code, type: "treachery" });
const passing = (code: string) => definePrinted({ code, name: code, type: "location", keywords: { pass: true } });
const FAILED: Instruction = { verb: "RaiseThreat", amount: 4, when: { kind: "lastLocateFailed" } };
const PASSED: Instruction = { verb: "RaiseThreat", amount: 1, when: { kind: "lastLocatePassed" } };
const test = (rest: Partial<Extract<Instruction, { verb: "LocateTest" }>> = {}): Instruction => ({ verb: "LocateTest", who: "firstPlayer", ...rest });
const CARDS = [plain("h1"), plain("h2"), plain("h3"), plain("e0"), plain("e1"), passing("p1")];

type Options = Partial<TableSpec> & { instructions?: readonly Instruction[]; phase?: "Quest" | "Encounter" };

// A table whose effect frame runs `instructions` for seat 0, settled to the first window the test opens. Seat 0 holds the hand h1, h2, h3 and the encounter deck is `encounter`, top first.
function begin(options: Options = {}) {
  const { instructions = [test(), FAILED, PASSED], phase = "Quest", effects = [], ...rest } = options;
  const base = table({ cards: [hero("a"), ...CARDS], effects, heroes: [{ code: "a" }], hand: [{ code: "h1" }, { code: "h2" }, { code: "h3" }], threat: 30, ...rest });
  const pushed = pushEffectFrame({ ...base.state, window: null, phase }, { frame: "whenRevealed", sourceId: null, actor: 0, peril: false, effectId: "test", instructions: [...instructions, PARK], cancel: null, blockCancel: null }, []);
  return { ...base, state: settle(pushed, base.ctx, []) };
}

type Begun = ReturnType<typeof begin>;
const threat = (state: ScenarioState) => state.seats[0]?.threat ?? 0;
const choose = (run: Begun, state: ScenarioState, optionId: string) => send(state, { type: "Choose", optionId }, run.ctx);
const discard = (run: Begun, state: ScenarioState, key: string) => choose(run, state, run.ids[key] ?? "");
const codes = (state: ScenarioState, ids: readonly string[]) => ids.map((id) => state.cards[id]?.code);

describe("LocateTest (04087:B:1, 04092:A:1)", () => {
  it("asks the tester which hand card to discard, with the option to stop", () => {
    const run = begin({ encounter: ["e0"] });
    expect(run.state.window).toMatchObject({ kind: "choose", seat: 0 });
    expect(run.state.window?.kind === "choose" ? run.state.window.options : []).toEqual([run.ids.h1, run.ids.h2, run.ids.h3, STOP]);
    expect(legalIntents(run.state, run.ctx).every((intent) => intent.type === "Choose")).toBe(true);
  });

  it("discards the hand card and the top encounter card, and passes on a PASS card", () => {
    const run = begin({ encounter: ["p1", "e0"] });
    const done = discard(run, run.state, "h2");
    expect(codes(done, done.seats[0]?.discard ?? [])).toEqual(["h2"]);
    expect(codes(done, done.encounterDiscard)).toEqual(["p1"]);
    // Passed: the passed branch ran, and nothing else asks.
    expect(threat(done)).toBe(31);
  });

  it("lets him try again on any other card, and fails when he stops", () => {
    const run = begin({ encounter: ["e0", "e1", "p1"] });
    const second = discard(run, run.state, "h1");
    expect(second.window).toMatchObject({ kind: "choose", seat: 0 });
    expect(codes(second, second.encounterDiscard)).toEqual(["e0"]);
    const stopped = choose(run, second, STOP);
    // Failed after one try: the failed branch raised the threat by 4 (and the effect's own choice then waits).
    expect(threat(stopped)).toBe(34);
    expect(codes(stopped, stopped.encounterDiscard)).toEqual(["e0"]);
  });

  it("may be failed at once by discarding no card", () => {
    const run = begin({ encounter: ["p1"] });
    const done = choose(run, run.state, STOP);
    expect(threat(done)).toBe(34);
    expect(done.encounterDiscard).toEqual([]);
    expect(done.seats[0]?.discard).toEqual([]);
  });

  it("goes on while the hand lasts and fails when the hand runs out", () => {
    const run = begin({ encounter: ["e0", "e0", "e0", "p1"] });
    const third = discard(run, discard(run, discard(run, run.state, "h1"), "h2"), "h3");
    expect(threat(third)).toBe(34);
    expect(third.encounterDiscard.length).toBe(3);
    expect(third.seats[0]?.hand).toEqual([]);
  });

  it("is failed at once with an empty hand", () => {
    const run = begin({ hand: [], encounter: ["p1"] });
    expect(threat(run.state)).toBe(34);
  });

  it("refills an empty encounter deck from the discard pile in the quest phase, the test's own discards included", () => {
    const run = begin({ encounter: ["e0"], discard: [], instructions: [test(), FAILED, PASSED] });
    const second = discard(run, run.state, "h1");
    // The deck is empty now; the discard pile holds e0, which is reshuffled in for the next try.
    expect(second.window).toMatchObject({ kind: "choose" });
    const third = discard(run, second, "h2");
    expect(codes(third, third.encounterDiscard)).toEqual(["e0"]);
  });

  it("cannot discard from an empty encounter deck outside the quest phase: the test is failed at once", () => {
    const run = begin({ phase: "Encounter", encounter: [] });
    expect(threat(run.state)).toBe(34);
    const emptied = begin({ phase: "Encounter", encounter: ["e0"] });
    const done = discard(emptied, emptied.state, "h1");
    expect(codes(done, done.encounterDiscard)).toEqual(["e0"]);
    expect(threat(done)).toBe(34);
  });

  it("is made by the actor with no `who`", () => {
    const run = begin({ instructions: [{ verb: "LocateTest" }, FAILED, PASSED], encounter: ["p1"] });
    expect(run.state.window).toMatchObject({ kind: "choose", seat: 0 });
  });
});
