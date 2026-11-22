// Rules: rr.shadow-effects, rr.destroy, rr.step-6-4-2, rr.step-6-4-3, rr.forced, mec109.ringbearers-life (data/rules/entries.json).
// Lines: 141067:A:2, 906302:A:2, 906302:A:3, 906305:A:3, 906307:A:2, 906308:A:3. The Flight to the Ford lines that act on an attack, each read from its printed line in a fight on the scene's table
// (test/scenarios/flight-to-the-ford/scene.ts: Sam defends unless a test names another defender; Frodo bears the Ring and An Evil Wound, so damage dealt to him lowers the life instead) and each fought
// again with the records of its line removed (test/harness/card-spec.ts, withoutLine), where it must not hold. "grunt" is the scene's enemy of 1 Attack, "ally" its ally of 1 Defense and 2 hit points.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { loadPrinted } from "../../../../test/harness/catalog.ts";
import { withoutLine } from "../../../../test/harness/card-spec.ts";
import { MERRY, SAM } from "../../../../test/harness/scene.ts";
import { fightEnemy, first, idOf, sceneEffects, type Fight, type FightOptions, type FightTable } from "../../../../test/harness/scene-kit.ts";
import { fordTable, loadFordWorld, type FordLayout, type FordWorld } from "../../../../test/scenarios/flight-to-the-ford/scene.ts";

const ALL = sceneEffects();
const without = (line: string): readonly Effect[] => withoutLine(ALL, line);

let world: FordWorld;
beforeAll(async () => {
  world = await loadFordWorld();
  for (const [code, card] of await loadPrinted(["906302", "906305", "906307", "906308"])) world.cards.set(code, card);
}, 120_000);

type FordFight = FightTable & { frodo: string };

// The enemy, engaged with the first seat, attacks with `shadow` dealt to it; Sam defends unless `options.defender` names another.
function fight(shadow: string, enemy: string, layout: FordLayout = {}, options: FightOptions<FordFight> = {}): Fight<FordFight> {
  const table = (made: FordLayout): FordFight => {
    const built = fordTable(world, made);
    return { ...built, hero: first(built.state, SAM), hero2: built.frodo };
  };
  return fightEnemy(table, shadow, enemy, layout, options);
}

const byAlly = { defender: (made: FordFight) => idOf(made.state, "ally") };
const zoneOf = (done: Fight<FordFight>, code: string) => done.run.state.cards[idOf(done.run.state, code)]?.zone;

describe("The Nine are Abroad (141067)", () => {
  // "Shadow: Return attacking enemy to the staging area after this attack."
  it("141067:A:2 the attacking enemy returns to the staging area once the attack is over, and is engaged until then", () => {
    const done = fight("141067", "grunt");
    expect(done.during.cards[idOf(done.during, "grunt")]?.zone).toBe("engaged");
    expect(zoneOf(done, "grunt")).toBe("staging");
    expect(zoneOf(fight("141067", "grunt", { effects: without("141067:A:2") }), "grunt")).toBe("engaged");
  });
});

describe("Fell Rider, Nightmare (906302)", () => {
  // "Forced: After Fell Rider attacks and destroys a character, reduce the Ring-bearer's life by 1." Its 5 Attack destroys the ally.
  it("906302:A:2 its attack that destroys a character reduces the Ring-bearer's life by 1", () => {
    const killed = fight("f0", "906302", { allies: ["ally"] }, byAlly);
    expect(zoneOf(killed, "ally")).toBe("discard");
    expect(killed.run.state.life).toBe(14);
    const bare = fight("f0", "906302", { allies: ["ally"], effects: without("906302:A:2") }, byAlly);
    expect(zoneOf(bare, "ally")).toBe("discard");
    expect(bare.run.state.life).toBe(15);
  });

  it("906302:A:2 its attack that destroys no character does not: Frodo defends and An Evil Wound turns the 3 damage into 3 life", () => {
    const spared = fight("f0", "906302", {}, { defender: (made) => made.frodo });
    expect(spared.run.state.cards[spared.made.frodo]?.zone).toBe("heroes");
    expect(spared.run.state.life).toBe(12);
  });

  // "Shadow: Attacking enemy gets +1 Attack (+2 Attack instead if The One Ring is exhausted)." The grunt's 1 Attack against Sam's 1 Defense deals nothing by itself.
  it("906302:A:3 the attacking enemy gets +1 Attack, +2 with The One Ring exhausted", () => {
    const damageOnSam = (done: Fight<FordFight>) => done.run.state.cards[done.made.hero]?.damage;
    expect(damageOnSam(fight("906302", "grunt"))).toBe(1);
    expect(damageOnSam(fight("906302", "grunt", { ring: "exhausted" }))).toBe(2);
    expect(damageOnSam(fight("906302", "grunt", { ring: "exhausted", effects: without("906302:A:3") }))).toBe(0);
  });
});

describe("Great East Road (906305)", () => {
  // "Shadow: After this attack, attacking enemy engages the next player then makes an immediate attack."
  it("906305:A:3 after the attack the enemy engages the next player and attacks him", () => {
    const done = fight("906305", "grunt", { seats: 2 });
    const merry = first(done.run.state, MERRY);
    expect(done.run.state.seats[1].engaged.map((id) => done.run.state.cards[id]?.code)).toEqual(["grunt"]);
    expect(done.run.state.seats[0].engaged).toEqual([]);
    // The second attack, undefended, deals its 1 damage to Merry.
    expect(done.run.state.cards[merry]?.damage).toBe(1);
    const bare = fight("906305", "grunt", { seats: 2, effects: without("906305:A:3") });
    expect(bare.run.state.seats[1].engaged).toEqual([]);
    expect(bare.run.state.cards[first(bare.run.state, MERRY)]?.damage).toBe(0);
  });
});

describe("Ettendales (906307)", () => {
  // "Shadow: Attacking enemy gets +2 Attack. If this attack destroys a character, reduce the Ring-bearer's life by 1."
  it("906307:A:2 the attacking enemy gets +2 Attack, and the life is not reduced when no character is destroyed", () => {
    const done = fight("906307", "grunt");
    expect(done.run.state.cards[done.made.hero]?.damage).toBe(2);
    expect(done.run.state.life).toBe(15);
    const bare = fight("906307", "grunt", { effects: without("906307:A:2") });
    expect(bare.run.state.cards[bare.made.hero]?.damage).toBe(0);
  });

  it("906307:A:2 an attack that destroys a character reduces the Ring-bearer's life by 1", () => {
    const killed = fight("906307", "grunt", { allies: ["ally"] }, byAlly);
    expect(zoneOf(killed, "ally")).toBe("discard");
    expect(killed.run.state.life).toBe(14);
    const bare = fight("906307", "grunt", { allies: ["ally"], effects: without("906307:A:2") }, byAlly);
    expect(zoneOf(bare, "ally")).toBe("play");
    expect(bare.run.state.life).toBe(15);
  });
});

describe("Come Back! (906308)", () => {
  // "Shadow: Either reduce the Ring-bearer's life by 1, or this attack is considered undefended."
  it("906308:A:3 the defending player reduces the life by 1, and the attack stays defended", () => {
    const done = fight("906308", "grunt", {}, { pick: () => "life" });
    expect(done.run.state.life).toBe(14);
    expect(done.during.pendingAttack?.undefended ?? false).toBe(false);
    expect(fight("906308", "grunt", { effects: without("906308:A:3") }, { pick: () => "life" }).run.state.life).toBe(15);
  });

  it("906308:A:3 or the attack is considered undefended", () => {
    const done = fight("906308", "grunt", {}, { pick: () => "undefended" });
    expect(done.during.pendingAttack?.undefended).toBe(true);
    expect(fight("906308", "grunt", { effects: without("906308:A:3") }, { pick: () => "undefended" }).during.pendingAttack?.undefended ?? false).toBe(false);
  });
});
