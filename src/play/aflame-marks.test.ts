// Rules: dcce.aflame (data/rules/entries.json); ledger lines 11038:A:2. What the table says of The Havens Burn and an Aflame location: the pill with the cards underneath against the number that loses, and the
// preview's Aflame line.
import { beforeAll, describe, expect, it } from "vitest";

import { CODES, idOf, loadRaidWorld, raidTable, type RaidLayout, type RaidWorld } from "../../scripts/raid-scene.ts";

import { effectLines, slotNumbers } from "./card-effects.ts";

let world: RaidWorld;

beforeAll(async () => {
  world = await loadRaidWorld();
});

const make = (layout: RaidLayout = {}) => raidTable(world, layout);

describe("the pill on The Havens Burn (11038:A:2)", () => {
  it("counts the cards underneath against the number that loses: 4 solo, 5 with two players", () => {
    const solo = make({ under: [CODES.piers] });
    expect(slotNumbers(solo.state, solo.ctx, idOf(solo.state, CODES.burn)).under).toEqual({ text: "1 under · lose at 4", loses: false });
    const duo = make({ seats: 2, under: [CODES.piers, CODES.pillaged] });
    expect(slotNumbers(duo.state, duo.ctx, idOf(duo.state, CODES.burn)).under).toEqual({ text: "2 under · lose at 5", loses: false });
  });

  it("turns threat red when one more card loses the game", () => {
    const made = make({ under: [CODES.piers, CODES.pillaged, CODES.whiteShip] });
    expect(slotNumbers(made.state, made.ctx, idOf(made.state, CODES.burn)).under).toEqual({ text: "3 under · lose at 4", loses: true });
  });

  it("is on no other card", () => {
    const made = make({ under: [CODES.piers] });
    expect(slotNumbers(made.state, made.ctx, idOf(made.state, CODES.dreamChaser)).under).toBeNull();
  });

  it("is told in the preview of the Burn, with the cards out of play", () => {
    const made = make({ under: [CODES.piers] });
    expect(effectLines(made.state, made.ctx, idOf(made.state, CODES.burn), (id) => id)).toContain("1 card is facedown underneath it, out of play. The players lose at 4.");
  });
});

describe("the preview of an Aflame location", () => {
  it("says its Aflame value, the damage on it and what destroys it", () => {
    const made = make({ staging: [{ code: CODES.piers, damage: 2 }] });
    expect(effectLines(made.state, made.ctx, idOf(made.state, CODES.piers), (id) => id)).toContain("Aflame 5: 2 of 5 damage, 3 more damage place it underneath The Havens Burn");
    const nearly = make({ staging: [{ code: CODES.piers, damage: 4 }] });
    expect(effectLines(nearly.state, nearly.ctx, idOf(nearly.state, CODES.piers), (id) => id)).toContain("Aflame 5: 4 of 5 damage, 1 more damage places it underneath The Havens Burn");
  });
});
