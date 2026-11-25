// Rules: hrd.heat-tracker, rr.modifiers, rr.forced, rr.threat-threat-dial (data/rules/entries.json); ledger lines 16068:A:1, 16068:B:2, 16068:B:3, 16069:A:1, 16069:B:1, 16069:B:2, 16070:B:3, 16023:A:3, 16025:A:1, 16026:A:1. The heat tracker on its own:
// the verbs SetTemperature, RaiseTemperature and LowerTemperature, the event `temperatureChanged`, the condition and the amount `temperature`, the loss at 60 and the tracker through a save.
import { describe, expect, it } from "vitest";

import type { Amount, Condition, Instruction } from "../../../catalog/boundary.ts";
import { expireModifiers, type ScenarioState } from "../../core/state.ts";
import { holds } from "../../interpret/conditions.ts";
import { frameScope, resolveAmount } from "../../interpret/amounts.ts";
import { finish, idOf, opened, resolveRecords, run as runInstruction, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";
import { settle } from "../../engine/machine.ts";
import { runHeat, temperatureOf } from "./heat.ts";

const table = (layout: Layout = {}) => tableFromLayout("desert-crossing", { seats: 1, stage: "16068", ...layout });
const SCOPE = { actor: 0, sourceId: null } as never;
const events = (state: ScenarioState) => (state.pendingEvents ?? []).filter((event) => event.trigger === "temperatureChanged");
const tracker = (state: ScenarioState) => state.modifiers.filter((modifier) => modifier.instanceId === "table" && modifier.stat === "temperature");

/** The table with the temperature set to `value` and no event queued. */
function heated(value: number, layout: Layout = {}) {
  const made = table(layout);
  const state = runInstruction(made, opened(made).state, { verb: "SetTemperature", value });
  return { made, state };
}
// The verb alone, before the settle announces the event it queued.
const bare = (made: ReturnType<typeof table>, state: ScenarioState, instruction: Instruction) => runHeat(state, instruction, { seat: 0, sourceId: null }, made.ctx) ?? state;
const apply = (made: ReturnType<typeof table>, state: ScenarioState, instruction: Instruction) => runInstruction(made, state, instruction);

describe("SetTemperature (16068:A:1)", () => {
  it("sets the tracker as one table modifier until the end of the game, replaces it and queues no event", () => {
    const { made, state } = heated(10);
    expect(temperatureOf(state)).toBe(10);
    expect(tracker(state)).toEqual([expect.objectContaining({ sourceId: "table", amount: 10, until: "endOfGame" })]);
    const again = bare(made, state, { verb: "SetTemperature", value: 30 });
    expect(tracker(again)).toHaveLength(1);
    expect(temperatureOf(again)).toBe(30);
    expect(events(again)).toHaveLength(0);
  });

  it("is absent until Setup sets it", () => {
    expect(temperatureOf(opened(table()).state)).toBeNull();
  });
});

describe("RaiseTemperature and LowerTemperature (16068:B:2, 16023:A:3)", () => {
  it("do nothing before the tracker is set: no value, no event", () => {
    const made = table();
    const start = opened(made).state;
    for (const verb of ["RaiseTemperature", "LowerTemperature"] as const) {
      const after = bare(made, start, { verb, amount: 4 });
      expect(temperatureOf(after)).toBeNull();
      expect(events(after)).toHaveLength(0);
    }
  });

  it("raise adds the amount, replaces the one modifier and queues temperatureChanged once, for the table", () => {
    const { made, state } = heated(10);
    const after = bare(made, state, { verb: "RaiseTemperature", amount: 4 });
    expect(temperatureOf(after)).toBe(14);
    expect(tracker(after)).toHaveLength(1);
    expect(events(after)).toEqual([{ trigger: "temperatureChanged", seat: null }]);
  });

  it("lower takes the amount off and floors at 0: 5 less 10 is 0 with an event, 0 less 10 changes nothing and queues none", () => {
    const { made, state } = heated(5);
    const floored = bare(made, state, { verb: "LowerTemperature", amount: 10 });
    expect(temperatureOf(floored)).toBe(0);
    expect(events(floored)).toHaveLength(1);
    const again = bare(made, { ...floored, pendingEvents: [] }, { verb: "LowerTemperature", amount: 10 });
    expect(temperatureOf(again)).toBe(0);
    expect(events(again)).toHaveLength(0);
    expect(temperatureOf(apply(made, heated(25).state, { verb: "LowerTemperature", amount: 10 }))).toBe(15);
  });

  it("an amount that reads 0 changes nothing and queues no event (X at a temperature under 10)", () => {
    const { made, state } = heated(5);
    const after = bare(made, state, { verb: "RaiseTemperature", amount: { temperature: "tens" } });
    expect(temperatureOf(after)).toBe(5);
    expect(events(after)).toHaveLength(0);
  });
});

describe("the condition temperature (16068:B:3, 16025:A:1)", () => {
  const cond = (condition: Condition, state: ScenarioState, made: ReturnType<typeof table>) => holds(state, condition, SCOPE, made.ctx);

  it("is false with no tracker, whatever the bounds", () => {
    const made = table();
    const state = opened(made).state;
    expect(cond({ kind: "temperature", min: 0 }, state, made)).toBe(false);
    expect(cond({ kind: "temperature", max: 99 }, state, made)).toBe(false);
  });

  it("reads min and max inclusive", () => {
    const { made, state } = heated(40);
    expect(cond({ kind: "temperature", min: 40 }, state, made)).toBe(true);
    expect(cond({ kind: "temperature", min: 41 }, state, made)).toBe(false);
    expect(cond({ kind: "temperature", max: 40 }, state, made)).toBe(true);
    expect(cond({ kind: "temperature", min: 10, max: 39 }, state, made)).toBe(false);
  });
});

describe("the amount temperature (16026:A:1)", () => {
  const read = (amount: Amount, state: ScenarioState, made: ReturnType<typeof table>) => resolveAmount(state, amount, frameScope(state, 0, null), made.ctx);

  it("is 0 with no tracker, the value or its tens digit with one", () => {
    const made = table();
    expect(read({ temperature: "value" }, opened(made).state, made)).toBe(0);
    expect(read({ temperature: "tens" }, opened(made).state, made)).toBe(0);
    const { made: hot, state } = heated(47);
    expect(read({ temperature: "value" }, state, hot)).toBe(47);
    expect(read({ temperature: "tens" }, state, hot)).toBe(4);
    expect(read({ temperature: "tens" }, apply(hot, state, { verb: "LowerTemperature", amount: 10 }), hot)).toBe(3);
  });
});

describe("the loss at 60 (16068:B:3, 16069:B:2, 16070:B:3)", () => {
  it("a rise that reaches 60 loses the game at once, a rise to 59 does not, and Seek Shade cannot undo it afterwards", () => {
    const { made, state } = heated(56);
    const short = finish({ state: apply(made, state, { verb: "RaiseTemperature", amount: 3 }), steps: [] }, made.ctx);
    expect(short.state.lost).toBe(false);
    const lost = apply(made, state, { verb: "RaiseTemperature", amount: 4 });
    expect(temperatureOf(lost)).toBe(60);
    expect(lost.lost).toBe(true);
  });

  it("holds in the middle of an effect: the 16069 stage's +4 loses before its damage is assigned", () => {
    const { made, state } = heated(56, { stage: "16069", heroes: ["dh1"] });
    const ended = resolveRecords(state, made.ctx, "16069", "forced", idOf(state, "16069"));
    expect(ended.state.lost).toBe(true);
  });

  it("the stage of 16070 loses the same way", () => {
    const { made, state } = heated(58, { stage: "16070" });
    expect(apply(made, state, { verb: "RaiseTemperature", amount: 2 }).lost).toBe(true);
  });

  it("a stage's own When Revealed that reaches 60 loses at once: 16069 at 58 +2", () => {
    const { made, state } = heated(58, { stage: "16069" });
    const revealed = resolveRecords(state, made.ctx, "16069", "whenRevealed", idOf(state, "16069"));
    expect(temperatureOf(revealed.state)).toBe(60);
    expect(revealed.state.lost).toBe(true);
  });

  it("a stage at 59 is not lost while nothing changes the temperature", () => {
    const { made, state } = heated(59, { stage: "16070" });
    expect(apply(made, state, { verb: "RaiseTemperature", amount: { temperature: "tens", times: 0 } }).lost).toBe(false);
  });
});

describe("the tracker through a save", () => {
  it("survives settle, the end of a phase and the end of a round, and a JSON round trip of the state", () => {
    const { made, state } = heated(34);
    const settled = settle(state, made.ctx, []);
    expect(temperatureOf(settled)).toBe(34);
    expect(temperatureOf(expireModifiers(settled, ["endOfPhase", "endOfRound", "endOfCombat", "endOfAttack"]))).toBe(34);
    const loaded = JSON.parse(JSON.stringify(settled)) as ScenarioState;
    expect(temperatureOf(loaded)).toBe(34);
    expect(tracker(loaded)).toHaveLength(1);
    expect(temperatureOf(apply(made, loaded, { verb: "RaiseTemperature", amount: 4 }))).toBe(38);
  });
});
