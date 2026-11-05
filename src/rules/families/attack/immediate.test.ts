// Rules: rr.attacks-outside-the-combat-phase, faq.additional-attacks (data/rules/entries.json). One immediate attack an encounter card makes (attackWith), on The City of Corsairs' table
// (test/scenarios/the-city-of-corsairs/scene.ts): against the player the enemy is engaged with, or against another living player (AttackOtherPlayers, 11216:A:4).
import { beforeAll, describe, expect, it } from "vitest";

import { CODES, corsairsTable, idOf, loadCorsairsWorld, type CorsairsWorld } from "../../../../test/scenarios/the-city-of-corsairs/scene.ts";

import type { ScenarioState } from "../../core/state.ts";
import { attackWith } from "./immediate.ts";

let world: CorsairsWorld;
beforeAll(async () => {
  world = await loadCorsairsWorld();
});

const table = () => corsairsTable(world, { seats: 2, phase: "Encounter", engaged: [{ code: CODES.umbarRaider, seat: 0 }], staging: [CODES.corsairInfiltrator] });
const attack = (state: ScenarioState) => state.pendingAttack;

describe("attackWith", () => {
  it("starts an immediate attack on the player the enemy is engaged with", () => {
    const made = table();
    const raider = idOf(made.state, CODES.umbarRaider);
    const begun = attackWith(made.state, raider, made.ctx, []);
    expect(attack(begun)).toMatchObject({ enemyId: raider, seat: 0, immediate: true });
    // An enemy in the staging area makes no such attack.
    const staged = idOf(made.state, CODES.corsairInfiltrator);
    expect(attackWith(made.state, staged, made.ctx, [])).toBe(made.state);
  });

  it("starts it on another living player when given a seat: the enemy stays engaged with its own player, and an eliminated seat is not attacked", () => {
    const made = table();
    const raider = idOf(made.state, CODES.umbarRaider);
    const begun = attackWith(made.state, raider, made.ctx, [], 1);
    expect(attack(begun)).toMatchObject({ enemyId: raider, seat: 1, immediate: true });
    expect(begun.cards[raider]).toMatchObject({ zone: "engaged", controller: 0 });
    const out = { ...made.state, seats: [made.state.seats[0]!, { ...made.state.seats[1]!, eliminated: true }] } as ScenarioState;
    expect(attackWith(out, raider, made.ctx, [], 1)).toBe(out);
  });
});
