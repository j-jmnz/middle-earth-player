// Rules: rm.the-orcs-search, rr.in-play-and-out-of-play, rr.damage, rr.shadow-effects (data/rules/entries.json); ledger lines 08124:A:1, 08125:A:1, 08125:A:2, 08126:A:3, 08131:A:3, 08134:A:1, 08134:A:2. The cards underneath The Orcs' Search: the settle sweep that buries a damaged
// location, the amount that counts the cards there, the card from each hand, the character a Shadow effect destroyed and the excess damage a Shadow effect sends to the active location.
import { describe, expect, it } from "vitest";

import { settle } from "../../../rules/engine/machine.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { updateCard } from "../../../rules/core/state.ts";
import { moveCard } from "../../../rules/core/zones.ts";
import { fightEnemy, idOf, idsOf, opened, run, statOf, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

const SCENARIO = "celebrimbors-secret";
const ORCS = "08125";
const BELLACH = "08124";
const CHAMBER = "08126";
const PLAZA = "08130";
const TOWER = "08131";
const FOUNDATION = "08132";
const SHADOW_DESTROYS = "08134";
const table = (layout: Layout) => tableFromLayout(SCENARIO, layout);
const under = (state: ScenarioState): string[] => Object.values(state.cards).filter((card) => card.zone === "under").map((card) => card.code).sort();

describe("BuryDamagedLocations (08125:A:1)", () => {
  it("08125:A:1 a location in the staging area whose damage equals its printed quest points goes facedown underneath The Orcs' Search, its tokens gone", () => {
    const t = table({ staging: [ORCS, { code: PLAZA, damage: 2, progress: 1 }, { code: FOUNDATION, damage: 3 }] });
    const state = settle(t.state, t.ctx, []);
    expect(under(state)).toEqual([PLAZA]);
    const plaza = state.cards[idOf(state, PLAZA)];
    expect(plaza).toMatchObject({ zone: "under", host: idOf(state, ORCS), damage: 0, progress: 0 });
    expect(state.staging).not.toContain(idOf(state, PLAZA));
  });

  it("08125:A:1 damage beyond the printed quest points buries the location too, and the active location is buried as well", () => {
    const t = table({ staging: [ORCS], active: { code: TOWER, damage: 6 } });
    const state = settle(t.state, t.ctx, []);
    expect(under(state)).toEqual([TOWER]);
    expect(state.activeLocation).toBeNull();
  });

  it("08126:A:3 The Secret Chamber buried underneath it loses the game, at 6 damage (its printed quest points)", () => {
    const five = table({ staging: [ORCS, { code: CHAMBER, damage: 5 }] });
    expect(settle(five.state, five.ctx, []).lost).not.toBe(true);
    const six = table({ staging: [ORCS, { code: CHAMBER, damage: 6 }] });
    expect(settle(six.state, six.ctx, []).lost).toBe(true);
  });

  it("buries nothing in a game without The Orcs' Search", () => {
    const t = table({ staging: [{ code: PLAZA, damage: 2 }] });
    expect(under(settle(t.state, t.ctx, []))).toEqual([]);
  });
});

describe("the amount facedownUnder (08124:A:1)", () => {
  it("08124:A:1 Bellach's Threat is the number of cards underneath The Orcs' Search, 0 with none or with the objective out of play", () => {
    const t = table({ staging: [BELLACH, ORCS] });
    expect(statOf(opened(t).state, t.cards, BELLACH, "threat")).toBe(0);
    const two = table({ staging: [BELLACH, ORCS, { code: PLAZA, damage: 2 }, { code: TOWER, damage: 4 }] });
    const buried = opened(two, settle(two.state, two.ctx, [])).state;
    expect(under(buried)).toEqual([PLAZA, TOWER]);
    expect(statOf(buried, two.cards, BELLACH, "threat")).toBe(2);
    const bare = table({ staging: [BELLACH] });
    expect(statOf(opened(bare).state, bare.cards, BELLACH, "threat")).toBe(0);
  });
});

describe("PlaceRandomHandUnder (08134:A:1)", () => {
  it("08134:A:1 each player puts one random card of his hand facedown underneath the objective, still his own", () => {
    const t = table({ seats: 2, staging: [ORCS], hand: ["filler", "ally"] });
    const state = run(t, t.state, { verb: "PlaceRandomHandUnder", code: ORCS });
    const buried = Object.values(state.cards).filter((card) => card.zone === "under");
    expect(buried).toHaveLength(2);
    expect(buried.map((card) => card.owner).sort()).toEqual([0, 1]);
    expect(buried.every((card) => card.host === idOf(state, ORCS) && card.face === "down")).toBe(true);
    expect((state.seats[0]?.hand ?? []).length).toBe(1);
    expect((state.seats[1]?.hand ?? []).length).toBe(1);
  });

  it("08134:A:1 a player with an empty hand places nothing, and nothing is placed with the objective out of play", () => {
    const empty = table({ seats: 1, staging: [ORCS] });
    expect(under(run(empty, empty.state, { verb: "PlaceRandomHandUnder", code: ORCS }))).toEqual([]);
    const none = table({ seats: 1, hand: ["filler"] });
    expect(under(run(none, none.state, { verb: "PlaceRandomHandUnder", code: ORCS }))).toEqual([]);
  });
});

describe("the Shadow effects that read the defender (08131:A:3, 08134:A:2)", () => {
  const hit = (shadow: string, staging: readonly string[]) => fightEnemy(table, shadow, "08129", { staging, active: FOUNDATION }, { tweak: (state, made) => updateCard(state, made.hero, { damage: 5 }) });

  it("08131:A:3 the damage beyond the defender's remaining hit points goes on the active location", () => {
    const fight = hit(TOWER, []);
    const hero = fight.run.state.cards[fight.made.hero];
    expect(hero?.zone).toBe("discard");
    expect(fight.run.state.cards[idOf(fight.run.state, FOUNDATION)]?.damage ?? 0).toBeGreaterThan(0);
  });

  it("08134:A:2 a character the attack destroys goes facedown underneath the objective and stays its owner's", () => {
    const fight = hit(SHADOW_DESTROYS, [ORCS]);
    const state = fight.run.state;
    expect(state.cards[fight.made.hero]).toMatchObject({ zone: "under", host: idOf(state, ORCS), owner: 0 });
  });

  it("08134:A:2 a character the attack does not destroy stays where it is", () => {
    const fight = fightEnemy(table, SHADOW_DESTROYS, "08129", { staging: [ORCS], active: FOUNDATION }, {});
    expect(fight.run.state.cards[fight.made.hero]?.zone).toBe("heroes");
    expect(under(fight.run.state)).toEqual([]);
  });
});

describe("the cards underneath leave play for good", () => {
  it("a card underneath is not in play: moving it back is no part of the effects", () => {
    const t = table({ staging: [ORCS, PLAZA] });
    const state = moveCard(t.state, idOf(t.state, PLAZA), { zone: "under", locationId: idsOf(t.state, ORCS)[0] ?? "" });
    expect(state.staging).not.toContain(idOf(state, PLAZA));
  });
});
