// Rules: dcce.grapple, dcce.stormcaller-and-the-thing, dcce.campaign-mode, rr.shadow-effects, rr.cannot, rr.engaged, rr.hit-points, rr.destroy, rr.winning-the-game, rr.forced (data/rules/entries.json).
// The Thing in the Depths, its Eye and its arms, From the Depths and Sea Serpent: the lines card-lines.test.ts holds no row for (a Creature destroyed by an attack, two players, a grappled enemy, a false case), on the
// scenario's scene of plain-number heroes (test/scenarios/the-thing-in-the-depths/scene.ts).
import { beforeAll, describe, expect, it } from "vitest";

import { modifiedStat } from "../../../rules/core/keywords.ts";
import { updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { grappledWith } from "../../../rules/families/grapple/values.ts";
import { CODES, depthsDrive, depthsFight, depthsTable, finish, idOf, idsOf, loadDepthsWorld, send, start, type DepthsLayout, type DepthsWorld } from "../../../../test/scenarios/the-thing-in-the-depths/scene.ts";

let world: DepthsWorld;

beforeAll(async () => {
  world = await loadDepthsWorld();
});

const make = (layout: DepthsLayout = {}) => depthsTable(world, layout);
const cardOf = (state: ScenarioState, code: string, at = 0) => state.cards[idsOf(state, code)[at] ?? ""];
const onSideB = (state: ScenarioState, code: string): ScenarioState => updateCard(state, idOf(state, code), { face: "B" });
const damageOf = (state: ScenarioState, ids: readonly string[]) => ids.reduce((sum, id) => sum + (state.cards[id]?.damage ?? 0), 0);

// The first hero attacks the engaged enemy `victim` in the player attack step: a Thrashing Arm (Threat 3, Defense 1) with 6 damage on its 7 hit points is destroyed by its 2 Attack. `thing` is the card of The
// Thing in the Depths in the staging area, with `damage`, on `side`.
function destroyArm(thing: string, side: "A" | "B", damage = 0, layout: DepthsLayout = {}) {
  const made = make({ phase: "PlayerAttacks", staging: [{ code: thing, damage }], engaged: [{ code: CODES.thrashing, seat: 0, damage: 6 }], ...layout });
  const state = side === "B" ? onSideB(made.state, thing) : made.state;
  const run = finish(send(start(state), { type: "DeclareAttackers", enemyId: idOf(state, CODES.thrashing), attackerIds: [made.hero] }, made.ctx), made.ctx);
  return run.state;
}

describe("12049 and 110063 The Thing in the Depths", () => {
  it("12049:A:2 is not engaged by an engagement check of a player whose threat is over its engagement cost", () => {
    const made = make({ phase: "Encounter", staging: [CODES.thingOriginal], threat: [55, 0] });
    const run = depthsDrive(start(made.state), made.ctx, (state) => state.phase !== "Encounter").run.state;
    expect(cardOf(run, CODES.thingOriginal)?.zone).toBe("staging");
  });

  it("12049:A:3 gets +3 hit points with 1 player: 8 + 3", () => {
    const made = make({ staging: [CODES.thingOriginal] });
    expect(modifiedStat(made.state, cardOf(made.state, CODES.thingOriginal)!, "hitPoints", world.cards)).toBe(11);
  });

  it("12049:A:4 is dealt damage equal to the Threat of the Creature enemy destroyed: 3 for Thrashing Arm", () => {
    expect(cardOf(destroyArm(CODES.thingOriginal, "A"), CODES.thingOriginal)?.damage).toBe(3);
  });

  it("110063:A:4 is dealt the destroyed Creature's Threat on its side A: 3 for Thrashing Arm", () => {
    expect(cardOf(destroyArm(CODES.thing, "A"), CODES.thing)?.damage).toBe(3);
  });

  it("110063:B:5 is dealt 2 damage on its side B for a Creature enemy destroyed, not that enemy's Threat of 3", () => {
    expect(cardOf(destroyArm(CODES.thing, "B"), CODES.thing)?.damage).toBe(2);
  });

  it("12041:B:3 wins the game when The Thing in the Depths on its side B is destroyed by the 2 damage of a Creature destroyed (110063:B:5)", () => {
    // Side B: 4 + 3 hit points, 5 damage on it.
    const state = destroyArm(CODES.thing, "B", 5, { stage: "12041" });
    expect(cardOf(state, CODES.thing)?.zone).toBe("victory");
    expect(state.stageCleared).toBe(true);
    expect(state.lost).toBe(false);
  });
});

describe("12050 Eye of the Beast", () => {
  // The round from the encounter phase until the next round begins: every attack undefended.
  const round = (layout: DepthsLayout) => {
    const made = make({ phase: "Encounter", deck: Array.from({ length: 6 }, () => "f0"), threat: [20, 20], ...layout });
    return { made, ...depthsDrive(start(made.state), made.ctx, (state) => state.round > made.state.round) };
  };

  it("12050:A:2 makes no attack in the combat phase while engaged", () => {
    const { defenses, made, run } = round({ engaged: [CODES.eye] });
    expect(run.state.round).toBe(1);
    expect(defenses).toEqual([]);
    expect(run.state.cards[made.hero]?.damage).toBe(0);
  });

  it("12050:A:3 makes The Thing in the Depths attack the second player, whom the Eye is engaged with, and not the first", () => {
    const { defenses, made, run } = round({ seats: 2, staging: [CODES.thingOriginal], engaged: [{ code: CODES.eye, seat: 1 }] });
    expect(defenses).toEqual([{ enemy: CODES.thingOriginal, seat: 1 }]);
    expect(run.state.cards[made.seat1Hero ?? ""]?.damage).toBe(5);
    expect(run.state.cards[made.hero]?.damage).toBe(0);
  });
  it("12050:A:3 deals a shadow card to The Thing's attack: Crew Quarters' Shadow gives it +2 Attack", () => {
    const { defenses, made, run } = round({ staging: [CODES.thingOriginal], engaged: [CODES.eye], deck: Array.from({ length: 6 }, () => CODES.crewQuarters) });
    expect(defenses).toEqual([{ enemy: CODES.thingOriginal, seat: 0 }]);
    expect(run.state.cards[made.hero]?.damage).toBe(5 + 2);
  });

  it("12050:A:3 makes The Thing attack each of 2 players who has an Eye of the Beast engaged", () => {
    const { defenses } = round({ seats: 2, staging: [CODES.thingOriginal], engaged: [{ code: CODES.eye, seat: 0 }, { code: CODES.eye, seat: 1 }] });
    expect(defenses).toEqual([{ enemy: CODES.thingOriginal, seat: 0 }, { enemy: CODES.thingOriginal, seat: 1 }]);
  });
});

describe("12053 Grasping Arm", () => {
  it("12053:A:2 makes the second player, whom it is engaged with, exhaust his character before he declares a defender, and not the first player", () => {
    const made = make({ seats: 2, phase: "Encounter", engaged: [{ code: CODES.grasping, seat: 1 }], deck: Array.from({ length: 4 }, () => "f0"), threat: [20, 20] });
    const state = depthsDrive(start(made.state), made.ctx, (now) => now.window?.kind === "defense").run.state;
    expect(state.window).toMatchObject({ kind: "defense", seat: 1 });
    expect(state.cards[made.seat1Hero ?? ""]?.exhausted).toBe(true);
    expect([made.hero, made.hero2].map((id) => state.cards[id]?.exhausted)).toEqual([false, false]);
  });

  it("12053:A:3 does not grapple when the attack is defended", () => {
    const { run } = depthsFight(world, CODES.grasping, "mild", { staging: [CODES.cargoHold] });
    expect(cardOf(run.state, CODES.grasping)?.zone).not.toBe("grappled");
    expect(grappledWith(run.state, idOf(run.state, CODES.cargoHold))).toEqual([]);
  });

  it("12053:A:3 is added to the staging area when the attack is undefended and no location is in the staging area", () => {
    const { run } = depthsFight(world, CODES.grasping, "mild", {}, { undefended: true });
    expect(cardOf(run.state, CODES.grasping)?.zone).toBe("staging");
  });
});

describe("12054 Giant Arm", () => {
  it("12054:A:2 gets +2 Attack against a defending ally only: 6 then, 4 against a defending hero and 4 undefended", () => {
    const ally = depthsFight(world, "f0", CODES.giant, { play: ["ally"] }, { defender: (made) => idOf(made.state, "ally") });
    const attack = (state: ScenarioState) => modifiedStat(state, cardOf(state, CODES.giant)!, "attack", world.cards);
    expect(attack(ally.during)).toBe(6);
    expect(attack(depthsFight(world, "f0", CODES.giant).during)).toBe(4);
    const undefended = depthsFight(world, "f0", CODES.giant, {}, { undefended: true });
    expect(undefended.run.state.cards[undefended.made.hero]?.damage).toBe(4);
  });

  it("12054:A:3 is dealt a shadow card when it comes into play engaged, and grapples with the location of the lowest quest points when it does not", () => {
    const engage = depthsFight(world, CODES.giant, "mild", { staging: [CODES.cargoHold] }, { pick: () => "engage" });
    const giant = idOf(engage.run.state, CODES.giant);
    expect(engage.run.state.cards[giant]).toMatchObject({ zone: "engaged", controller: 0 });
    expect(Object.values(engage.run.state.cards).filter((card) => card.zone === "shadow" && card.host === giant)).toHaveLength(1);
    const grapple = depthsFight(world, CODES.giant, "mild", { staging: [CODES.forecastle, CODES.cargoHold] }, { pick: () => "grapple" });
    // Cargo Hold prints 2 quest points, Forecastle Deck 5.
    expect(grappledWith(grapple.run.state, idOf(grapple.run.state, CODES.cargoHold)).map((id) => grapple.run.state.cards[id]?.code)).toEqual([CODES.giant]);
  });
});

describe("12055 From the Depths", () => {
  it("12055:A:2 counts the enemies grappled with locations in the staging area, not an enemy in the staging area: 2 damage, and the attacker's 1", () => {
    const { run, made } = depthsFight(world, CODES.fromTheDepths, "f0", { staging: [CODES.cargoHold, CODES.forecastle, "f3"], grappled: [[CODES.thrashing, CODES.cargoHold], [CODES.crushing, CODES.forecastle]] }, { undefended: true });
    expect(damageOf(run.state, [made.hero, made.hero2])).toBe(2 + 1);
  });
});

describe("11196 Sea Serpent", () => {
  it("11196:A:3 deals X = 2 damage among the defending player's characters with 2 players, after it destroys a defending ally", () => {
    const { run, made } = depthsFight(world, "f0", CODES.seaSerpent, { seats: 2, play: ["ally"] }, { defender: (table) => idOf(table.state, "ally") });
    expect(cardOf(run.state, "ally")?.zone).toBe("discard");
    expect(damageOf(run.state, [made.hero, made.hero2])).toBe(2);
    expect(run.state.cards[made.seat1Hero ?? ""]?.damage).toBe(0);
  });

  it("11196:A:3 deals nothing when it destroys a hero, or when another enemy destroys an ally", () => {
    const hero = depthsFight(world, "f0", CODES.seaSerpent, { damage: [["dh1", 3]] });
    expect(hero.run.state.cards[hero.made.hero]?.zone).toBe("discard");
    expect(hero.run.state.cards[hero.made.hero2]?.damage).toBe(0);
    const other = depthsFight(world, "f0", "mild", { play: ["ally"], staging: [CODES.seaSerpent] }, { defender: (table) => idOf(table.state, "ally") });
    expect(cardOf(other.run.state, "ally")?.zone).toBe("discard");
    expect(damageOf(other.run.state, [other.made.hero, other.made.hero2])).toBe(0);
  });

  it("11196:B:3 deals X = 4 damage on its Enraged side with 2 players, and its side A line adds nothing", () => {
    const { run, made } = depthsFight(world, "f0", CODES.seaSerpent, { seats: 2, play: ["ally"] }, { defender: (table) => idOf(table.state, "ally"), tweak: (state) => onSideB(state, CODES.seaSerpent) });
    expect(cardOf(run.state, "ally")?.zone).toBe("discard");
    expect(damageOf(run.state, [made.hero, made.hero2])).toBe(4);
  });

  it("11196:A:4 is flipped over and put into play in the staging area, its damage gone, after it is destroyed engaged on its Menacing side", () => {
    const made = make({ phase: "PlayerAttacks", engaged: [{ code: CODES.seaSerpent, seat: 0, damage: 5 }], deck: ["f0"] });
    const serpent = idOf(made.state, CODES.seaSerpent);
    const run = finish(send(start(made.state), { type: "DeclareAttackers", enemyId: serpent, attackerIds: [made.hero] }, made.ctx), made.ctx);
    expect(run.state.cards[serpent]).toMatchObject({ zone: "staging", face: "B", damage: 0 });
    expect(run.state.seats[0]?.engaged).not.toContain(serpent);
  });
});
