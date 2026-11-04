// Rules: dcce.aflame (data/rules/entries.json); ledger lines 11038:A:2. What the table says of The Havens Burn and an Aflame location: the pill with the cards underneath against the number that loses, and the
// preview's Aflame line.
import { beforeAll, describe, expect, it } from "vitest";

import { CODES, idOf, loadRaidWorld, raidTable, type RaidLayout, type RaidWorld } from "../../../test/scenarios/raid-on-the-grey-havens/scene.ts";

import { effectLines, slotNumbers } from "../cards/card-effects.ts";
import { logLines } from "../store/log.ts";

let world: RaidWorld;

beforeAll(async () => {
  world = await loadRaidWorld();
});

const make = (layout: RaidLayout = {}) => raidTable(world, layout);

describe("the pill on The Havens Burn (11038:A:2)", () => {
  it("counts the cards underneath against the number that loses, read from the Burn's record: 4 solo, 5 with two players, as a short count and as the words a screen reader hears", () => {
    const solo = make({ under: [CODES.piers] });
    expect(slotNumbers(solo.state, solo.ctx, idOf(solo.state, CODES.burn)).under).toEqual({ text: "1/4", loses: false, speech: "1 under, lose at 4" });
    const duo = make({ seats: 2, under: [CODES.piers, CODES.pillaged] });
    expect(slotNumbers(duo.state, duo.ctx, idOf(duo.state, CODES.burn)).under).toEqual({ text: "2/5", loses: false, speech: "2 under, lose at 5" });
  });

  it("keeps the number that loses in the Burn's record alone: a record that loses at a different number moves the pill, the preview and the red rule together", () => {
    const made = make({ under: [CODES.piers] });
    const edited = made.ctx.effects.map((effect) => (effect.id === "11038:triggered:1" && effect.condition?.kind === "underBurn" ? { ...effect, condition: { ...effect.condition, min: 1 } } : effect));
    const ctx = { ...made.ctx, effects: edited };
    const burn = idOf(made.state, CODES.burn);
    expect(slotNumbers(made.state, ctx, burn).under).toEqual({ text: "1/2", loses: true, speech: "1 under, lose at 2" });
    expect(effectLines(made.state, ctx, burn, (id) => id)).toContain("1 card is facedown underneath it, out of play. The players lose at 2.");
  });

  it("turns threat red when one more card loses the game", () => {
    const made = make({ under: [CODES.piers, CODES.pillaged, CODES.whiteShip] });
    expect(slotNumbers(made.state, made.ctx, idOf(made.state, CODES.burn)).under).toEqual({ text: "3/4", loses: true, speech: "3 under, lose at 4" });
  });

  it("is on no other card", () => {
    const made = make({ under: [CODES.piers] });
    expect(slotNumbers(made.state, made.ctx, idOf(made.state, CODES.dreamChaser)).under).toBeNull();
  });

  it("fits inside a card at every size: the short count is far narrower than the card's 59 pt at Large and 63 pt at 667 x 375", () => {
    // At 10 pt bold a digit is about 6 pt wide; "12/12", the widest count, plus the pill's 10 pt of padding is 40 pt.
    const widest = make({ under: [CODES.piers] });
    const text = slotNumbers(widest.state, widest.ctx, idOf(widest.state, CODES.burn)).under?.text ?? "";
    expect(text.length * 6 + 10).toBeLessThan(59);
  });

  it("names only the count, never which cards lie under it", () => {
    const made = make({ under: [CODES.piers, CODES.pillaged] });
    const burn = idOf(made.state, CODES.burn);
    const said = [slotNumbers(made.state, made.ctx, burn).under?.text, slotNumbers(made.state, made.ctx, burn).under?.speech, ...effectLines(made.state, made.ctx, burn, (id) => id)].join(" ");
    expect(said).not.toMatch(/Burning Piers|Pillaged Ship|11043|11044/);
  });

  it("is told in the preview of the Burn, with the cards out of play", () => {
    const made = make({ under: [CODES.piers] });
    expect(effectLines(made.state, made.ctx, idOf(made.state, CODES.burn), (id) => id)).toContain("1 card is facedown underneath it, out of play. The players lose at 4.");
  });
});

describe("the log of a burning location", () => {
  it("says a location burns and goes facedown underneath The Havens Burn, and never names it", () => {
    const made = make({ staging: [{ code: CODES.piers, damage: 5 }] });
    const target = idOf(made.state, CODES.piers);
    const names = { card: (id: string) => (id === target ? "Burning Piers" : id), code: (code: string) => code, effectCard: () => null, rule: () => null, line: () => null };
    const lines = logLines([{ kind: "destroy", targetId: target, under: true }], names).map((line) => line.text);
    expect(lines).toEqual(["A location burns and is placed facedown underneath The Havens Burn"]);
    expect(logLines([{ kind: "destroy", targetId: target }], names).map((line) => line.text)).toEqual(["Burning Piers is destroyed"]);
  });
});

describe("the mark on an Aflame location", () => {
  it("shows its damage against the value that destroys it, threat red when one more damage destroys it", () => {
    const calm = make({ staging: [{ code: CODES.piers, damage: 2 }] });
    expect(slotNumbers(calm.state, calm.ctx, idOf(calm.state, CODES.piers)).fire).toEqual({ text: "2/5", danger: false });
    const near = make({ staging: [{ code: CODES.piers, damage: 4 }] });
    expect(slotNumbers(near.state, near.ctx, idOf(near.state, CODES.piers)).fire).toEqual({ text: "4/5", danger: true });
    const fresh = make({ staging: [CODES.waveRunner] });
    expect(slotNumbers(fresh.state, fresh.ctx, idOf(fresh.state, CODES.waveRunner)).fire).toEqual({ text: "0/3", danger: false });
  });

  it("is on no other card", () => {
    const made = make({ staging: ["place"], under: [CODES.piers] });
    expect(slotNumbers(made.state, made.ctx, idOf(made.state, "place")).fire).toBeNull();
    expect(slotNumbers(made.state, made.ctx, idOf(made.state, CODES.burn)).fire).toBeNull();
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
