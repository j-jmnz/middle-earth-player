// Rules: rr.response, rr.destroyed, rr.staging (data/rules/entries.json); ledger lines 06102:A:2, 06102:A:3.
// Ruined Square: "Response: After an enemy is destroyed, place 1 progress token on Ruined Square" hears every enemy, engaged or not, and "Forced: After a character leaves play while a player controls Ruined Square, return it to the staging area". Built on real moments: Thalin's damage to an enemy as it is revealed, an attack, a hero that is destroyed.
import { describe, expect, it } from "vitest";

import { idOf, legalIntents, send } from "../../../../test/harness/scene-kit.ts";
import { CODES, cardOf, drive, opened, table } from "../../../../test/scenarios/assault-on-osgiliath/table.ts";
import type { PlayerIntent } from "../../engine/reduce.ts";

const THALIN = "01006";
const MORIA_BATS = "04127";
const EOWYN = "01007";
const VANGUARD = "05058";

describe("06102:A:2 Ruined Square: the Response hears an enemy destroyed anywhere", () => {
  it("places 1 progress on it after Thalin destroys an enemy in the staging area as it is revealed", () => {
    const made = table({ phase: "Quest", staging: [CODES.square], heroes: [{ code: THALIN, seat: 0 }], committed: [THALIN], deck: [MORIA_BATS, "f0", "f0"] }, undefined, [THALIN, MORIA_BATS]);
    const run = send(opened(made), { type: "Pass" }, made.ctx);
    const response = legalIntents(run.state, made.ctx).find((intent) => intent.type === "Trigger" && intent.effectId === "06102:response:1");
    expect(response).toBeDefined();
    expect(cardOf(run.state, MORIA_BATS)?.zone).toBe("encounterDiscard");
    const done = send(run, response as PlayerIntent, made.ctx);
    expect(cardOf(done.state, CODES.square)?.progress).toBe(1);
  });
});

describe("06102:A:3 Ruined Square: it returns to the staging area when a character leaves play while a player controls it", () => {
  it("returns to the staging area, with no progress, after an undefended attack destroys a hero", () => {
    const made = table({ phase: "Quest", active: { code: CODES.square, progress: 1 }, committed: ["dh1", "dh2"], heroes: [{ code: EOWYN, seat: 0 }], engaged: [{ code: VANGUARD, seat: 0 }], deck: ["f0", "f0", "f0"] }, undefined, [EOWYN, VANGUARD]);
    const run = drive(made, send(opened(made), { type: "Pass" }, made.ctx), (state) => state.window?.kind === "defense");
    expect(cardOf(run.state, CODES.square)).toMatchObject({ zone: "play", controller: 0 });
    const done = drive(made, send(run, { type: "Undefended", heroId: idOf(run.state, EOWYN) }, made.ctx), (state) => state.pendingAttack == null && state.phase !== "Combat");
    expect(cardOf(done.state, EOWYN)?.zone).toBe("discard");
    expect(cardOf(done.state, CODES.square)).toMatchObject({ zone: "staging", progress: 0, controller: null });
  });

  it("stays where it is when a character leaves play while it is in the staging area", () => {
    const made = table({ phase: "Quest", staging: [{ code: CODES.square, progress: 1 }], committed: ["dh1", "dh2"], heroes: [{ code: EOWYN, seat: 0 }], engaged: [{ code: VANGUARD, seat: 0 }], deck: ["f0", "f0", "f0"] }, undefined, [EOWYN, VANGUARD]);
    const run = drive(made, send(opened(made), { type: "Pass" }, made.ctx), (state) => state.window?.kind === "defense");
    const done = drive(made, send(run, { type: "Undefended", heroId: idOf(run.state, EOWYN) }, made.ctx), (state) => state.pendingAttack == null && state.phase !== "Combat");
    expect(cardOf(done.state, EOWYN)?.zone).toBe("discard");
    expect(cardOf(done.state, CODES.square)).toMatchObject({ zone: "staging", progress: 1 });
  });
});
