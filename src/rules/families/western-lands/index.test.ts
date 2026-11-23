// Rules: hob.setup-we-must-away-ere-break-of-day, rr.encounter-deck (data/rules/entries.json); ledger line 131035:A:2. The western-lands family's verb: a shadow card that shuffles itself back into the encounter deck once its attack has ended.
import { beforeAll, describe, expect, it } from "vitest";

import type { Instruction } from "../../../catalog/boundary.ts";
import { runInstruction } from "../../interpret/interpret.ts";
import type { ScenarioState } from "../../core/state.ts";
import { spawn } from "../../core/zones.ts";
import { encounterWorld, type EncounterWorld } from "../../../../scripts/card-smoke/encounter-world.ts";
import { probeTable } from "../../../../scripts/card-smoke/encounter.ts";

let world: EncounterWorld;
let table: ScenarioState;
const ctxOf = () => world.contexts.strong;

beforeAll(async () => {
  world = await encounterWorld("we-must-away-ere-break-of-day");
  table = probeTable(world);
});

const SHUFFLE: Instruction = { verb: "ShuffleShadowIntoEncounterDeck", code: "131035" };
const run = (state: ScenarioState, sourceId: string | null) => runInstruction(state, SHUFFLE, { seat: 0, sourceId }, ctxOf(), []);

describe("131035:A:2 shuffle the shadow card back", () => {
  it("puts the shadow card the attacking enemy holds into the encounter deck", () => {
    const enemy = spawn(table, "131035", { zone: "staging" });
    const shadow = spawn(enemy.state, "131035", { zone: "shadow", enemyId: enemy.id });
    expect(shadow.state.cards[enemy.id]?.shadowId).toBe(shadow.id);
    const done = run(shadow.state, enemy.id);
    expect(done.cards[shadow.id]?.zone).toBe("encounterDeck");
    expect(done.encounterDeck).toContain(shadow.id);
    expect(done.cards[enemy.id]?.shadowId ?? null).toBeNull();
  });

  it("takes the topmost copy of the encounter discard pile once an immediate attack discarded its shadow cards", () => {
    const enemy = spawn(table, "131035", { zone: "staging" });
    const discarded = spawn(enemy.state, "131035", { zone: "encounterDiscard" });
    const done = run(discarded.state, enemy.id);
    expect(done.cards[discarded.id]?.zone).toBe("encounterDeck");
    expect(done.encounterDiscard).not.toContain(discarded.id);
  });

  it("does nothing when the enemy holds no such shadow card and the discard pile has none", () => {
    const enemy = spawn(table, "131035", { zone: "staging" });
    const done = run(enemy.state, enemy.id);
    expect(done.encounterDeck).toEqual(enemy.state.encounterDeck);
  });
});
