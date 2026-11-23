import { beforeAll, describe, expect, it } from "vitest";

import type { Effect, Instruction } from "../../src/catalog/boundary.ts";
import { EFFECTS } from "../../src/effects/index.ts";

import { formatIdle } from "./idle.ts";
import { KNOWN_IDLE, staleKnownIdle } from "./idle-known.ts";
import { smokeCard, smokeWorld, type SmokeWorld } from "./run.ts";

// The idle check of the card smoke (scripts/card-smoke/idle.ts): an Action that is offered, used and changes nothing is reported, one that changes the table is not. Sam Gamgee (141002) is
// on the table from the start of the smoke game, so an Action added to his records is offered there.
const SAM = "141002";

let world: SmokeWorld;
beforeAll(async () => {
  world = await smokeWorld([SAM]);
}, 60_000);

const action = (id: string, instructions: Instruction[]): Effect => ({ id, cardCode: SAM, lines: [`${SAM}:A:1`], timing: "action", instructions });
const withRecord = (record: Effect) => ({ ...world, ctx: { ...world.ctx, effects: [...EFFECTS, record] } });

describe("the idle check of the card smoke", () => {
  it("reports an Action that was offered, used and changed nothing, with its record id", () => {
    // SwitchActor only says who carries out the steps after it: the engine cannot tell the Action does nothing, and the table does not move.
    const idle = action(`${SAM}:action:98`, [{ verb: "SwitchActor", to: "picked" }]);
    const summary = smokeCard(SAM, { world: withRecord(idle) });
    expect(summary.problems).toEqual([]);
    expect(summary.idle.map((hit) => hit.recordId)).toContain(idle.id);
    expect(formatIdle(summary.idle[0]!)).toContain(`offered ${summary.idle[0]!.recordId} and it changed nothing`);
  });

  it("does not report an Action that changes the table", () => {
    const draws = action(`${SAM}:action:97`, [{ verb: "Draw", amount: 1 }]);
    const summary = smokeCard(SAM, { world: withRecord(draws) });
    expect(summary.problems).toEqual([]);
    expect(summary.idle.map((hit) => hit.recordId)).not.toContain(draws.id);
  });

  it("holds no known idle ability whose record is gone", () => {
    expect(staleKnownIdle()).toEqual([]);
    expect(Object.values(KNOWN_IDLE).every((reason) => reason.length > 20)).toBe(true);
  });
});
