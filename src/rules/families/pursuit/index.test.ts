// Rules: mec112.pursuit, rr.step-6-8b (data/rules/entries.json); ledger lines 143069:A:1, 143069:B:1, 143070:B:2, 143022:A:2. The pursuit family on a table of The Uruk-hai.
import { beforeAll, describe, expect, it } from "vitest";

import type { EngineStep } from "../../core/intents.ts";
import { holds } from "../../interpret/conditions.ts";
import { resolveAmount } from "../../interpret/amounts.ts";
import { runInstruction } from "../../interpret/interpret.ts";
import { syncConstants } from "../../interpret/constants.ts";
import { modifiedStat } from "../../core/keywords.ts";
import type { ScenarioState } from "../../core/state.ts";
import { probeTable } from "../../../../scripts/card-smoke/encounter.ts";
import { encounterWorld, type EncounterWorld } from "../../../../scripts/card-smoke/encounter-world.ts";
import { idOf, resolveRecords } from "../../../../test/harness/scene-kit.ts";

let world: EncounterWorld;
let table: ScenarioState;
const ctxOf = () => world.contexts.strong;

beforeAll(async () => {
  world = await encounterWorld("the-uruk-hai");
  table = probeTable(world);
});

const run = (state: ScenarioState, instruction: Parameters<typeof runInstruction>[1]) => runInstruction(state, instruction, { seat: 0, sourceId: null }, ctxOf(), [] as EngineStep[]);
const scope = { actor: 0, sourceId: null, returned: 0 } as const;

describe("the pursuit tracker", () => {
  it("is set to 10 by the quest card's Setup and changed by the verbs, never below 0", () => {
    expect(table.pursuit).toBe(10);
    expect(run(table, { verb: "RaisePursuit", amount: 3 }).pursuit).toBe(13);
    expect(run(table, { verb: "LowerPursuit", amount: 1 }).pursuit).toBe(9);
    expect(run(table, { verb: "LowerPursuit", amount: 50 }).pursuit).toBe(0);
    expect(run(table, { verb: "SetPursuit", value: 24 }).pursuit).toBe(24);
  });

  it("is none until it is set: raising or lowering a game with no tracker changes nothing", () => {
    const bare = { ...table, pursuit: undefined };
    expect(run(bare, { verb: "RaisePursuit", amount: 3 })).toBe(bare);
    expect(run(bare, { verb: "LowerPursuit", amount: 3 })).toBe(bare);
  });

  it("is read by the amount, the quest points X of both stages, and the condition's bounds", () => {
    expect(resolveAmount(table, { pursuit: true }, scope, ctxOf())).toBe(10);
    expect(resolveAmount({ ...table, pursuit: undefined }, { pursuit: true }, scope, ctxOf())).toBe(0);
    const synced = syncConstants(table, ctxOf());
    const stage = synced.cards[idOf(table, "143069")];
    expect(stage && modifiedStat(synced, stage, "questPoints", ctxOf().cards)).toBe(10);
    const higher = syncConstants(run(table, { verb: "RaisePursuit", amount: 2 }), ctxOf());
    expect(modifiedStat(higher, higher.cards[idOf(table, "143069")] ?? stage!, "questPoints", ctxOf().cards)).toBe(12);
    expect(holds(table, { kind: "pursuit", max: 25 }, scope, ctxOf())).toBe(true);
    expect(holds(table, { kind: "pursuit", max: 9 }, scope, ctxOf())).toBe(false);
    expect(holds(table, { kind: "pursuit", min: 10 }, scope, ctxOf())).toBe(true);
    expect(holds(table, { kind: "pursuit", min: 11, max: 30 }, scope, ctxOf())).toBe(false);
  });
});

describe("To Isengard!'s Forced effect (143022:A:2)", () => {
  it("raises the pursuit value by 1 and loses the game only at 30 or more", () => {
    const isengard = idOf(table, "143022");
    const lower = resolveRecords({ ...table, phase: "Refresh" }, ctxOf(), "143022", "forced", isengard);
    expect(lower.state.pursuit).toBe(11);
    expect(lower.state.lost).toBe(false);
    const edge = resolveRecords({ ...table, phase: "Refresh", pursuit: 29 }, ctxOf(), "143022", "forced", isengard);
    expect(edge.state.pursuit).toBe(30);
    expect(edge.state.lost).toBe(true);
  });
});
