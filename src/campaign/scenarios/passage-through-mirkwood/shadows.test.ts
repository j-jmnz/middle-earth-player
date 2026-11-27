// Rules: rr.step-6-4-2, rr.shadow-effects, ltp.undefended-attack, rr.exhausted, rr.discard-pile-and-victory-display, rr.engaged (data/rules/entries.json).
// The Shadow lines of the Passage Through Mirkwood encounter cards, played through a real attack (test/scenarios/passage-through-mirkwood/scene.ts).
import { beforeAll, describe, expect, it } from "vitest";

import { modifiedStat } from "../../../rules/core/keywords.ts";
import { causeProblems } from "../../../../test/harness/cause-check.ts";
import { fight, loadMirkwoodWorld, type MirkwoodWorld } from "../../../../test/scenarios/passage-through-mirkwood/scene.ts";
import { codesOf } from "../../../../test/scenarios/a-shadow-of-the-past/scene.ts";
import { first } from "../../../../test/harness/scene-kit.ts";

let world: MirkwoodWorld;

beforeAll(async () => {
  world = await loadMirkwoodWorld();
});

function exhausted(state: { cards: Readonly<Record<string, { zone: string; exhausted: boolean; code: string }>> }): string[] {
  return Object.values(state.cards).filter((card) => card.zone === "heroes" && card.exhausted).map((card) => card.code).sort();
}

describe("Shadow effects", () => {
  it("King Spider has the defending player exhaust a character, two when the attack is undefended (01074:A:2)", () => {
    // The refresh phase at the end of the round readies everything, so each state of the attack is read.
    const during = (seen: readonly { cards: Readonly<Record<string, { zone: string; exhausted: boolean; code: string }>> }[]) => seen.map((state) => exhausted(state).join());
    const defended = fight(world, "01074", "grunt", { allies: ["ally"] });
    // The defender is exhausted by defending; the shadow card exhausts one more character.
    expect(during(defended.seen)).toContain("mh1,mh2");
    expect(causeProblems(defended.run.steps)).toEqual([]);
    const undefended = fight(world, "01074", "grunt", {}, { undefended: true });
    // Nobody defended, so both ready characters are exhausted.
    expect(during(undefended.seen)).toContain("mh1,mh2");
  });

  it("Hummerhorns deals 1 damage to each character the defending player controls, 2 when undefended (01075:A:2)", () => {
    const defended = fight(world, "01075", "grunt", { allies: ["ally"] });
    for (const code of ["mh1", "mh2", "ally"]) expect(defended.run.state.cards[first(defended.run.state, code)]?.damage, code).toBe(1);
    const undefended = fight(world, "01075", "grunt", { allies: ["ally"] }, { undefended: true });
    expect(undefended.run.state.cards[first(undefended.run.state, "mh2")]?.damage).toBe(2);
    // The attack's own damage (1) lands on the hero as well.
    expect(undefended.run.state.cards[first(undefended.run.state, "mh1")]?.damage).toBe(3);
  });

  it("Ungoliant's Spawn raises the defending player's threat by 4, by 8 when undefended (01076:A:2)", () => {
    expect(fight(world, "01076", "grunt").run.state.seats[0].threat).toBe(32);
    expect(fight(world, "01076", "grunt", {}, { undefended: true }).run.state.seats[0].threat).toBe(36);
  });

  it("Dol Guldur Orcs gives the attacking enemy +1 Attack, +3 when undefended (01089:A:2)", () => {
    const defended = fight(world, "01089", "brute", { firstHero: "strong" });
    expect(defended.run.state.cards[first(defended.run.state, "strong")]?.damage).toBe(7);
    const undefended = fight(world, "01089", "brute", { firstHero: "strong" }, { undefended: true });
    expect(undefended.run.state.cards[first(undefended.run.state, "strong")]?.damage).toBe(12);
  });

  it("Driven by Shadow discards 1 attachment from the defending character, all the attachments the player controls when undefended (01092:A:2)", () => {
    const defended = fight(world, "01092", "grunt", { gear: 3 });
    expect(defended.run.state.cards[defended.hero]?.attachments).toHaveLength(2);
    const undefended = fight(world, "01092", "grunt", { gear: 3 }, { undefended: true });
    expect(undefended.run.state.cards[undefended.hero]?.attachments).toHaveLength(0);
    expect(codesOf(undefended.run.state, undefended.run.state.seats[0].discard).filter((code) => code === "gear")).toHaveLength(3);
  });

  it("Forest Spider makes the defending player discard an attachment they control (01096:A:2)", () => {
    const { run, hero } = fight(world, "01096", "grunt", { gear: 2 });
    expect(run.state.cards[hero]?.attachments).toHaveLength(1);
    expect(codesOf(run.state, run.state.seats[0].discard).filter((code) => code === "gear")).toHaveLength(1);
  });

  it("East Bight Patrol gives +1 Attack, and raises an undefended player's threat by 3 (01097:A:1)", () => {
    const defended = fight(world, "01097", "grunt");
    expect(defended.run.state.seats[0].threat).toBe(28);
    const undefended = fight(world, "01097", "grunt", {}, { undefended: true });
    expect(undefended.run.state.seats[0].threat).toBe(31);
    const attack = defended.seen.map((state) => modifiedStat(state, state.cards[first(state, "grunt")]!, "attack", defended.ctx.cards));
    expect(Math.max(...attack)).toBe(2);
  });

  it("Ungoliant's Swarm comes into play engaged with the defending player (01136:A:2)", () => {
    const { run } = fight(world, "01136", "grunt");
    const swarm = run.state.cards[first(run.state, "01136")];
    expect(swarm?.zone).toBe("engaged");
    expect(swarm?.controller).toBe(0);
    expect(run.state.encounterDiscard.map((id) => run.state.cards[id]?.code)).not.toContain("01136");
  });

  it("Ungoliant's Swarm put into play engaged by its shadow makes no attack in that combat phase (01136:A:2)", () => {
    const { run } = fight(world, "01136", "grunt");
    expect(run.state.resolvedAttacks).toContain(first(run.state, "01136"));
  });

  it("Lingering Venom exhausts each damaged character the defending player controls (01137:A:3)", () => {
    const { seen } = fight(world, "01137", "grunt", { allies: ["ally"], damage: [["mh2", 1]] });
    const after = seen.find((state) => state.cards[first(state, "mh2")]?.exhausted === true);
    expect(after).toBeDefined();
    expect(after?.cards[first(after, "ally")]?.exhausted).toBe(false);
  });
});
