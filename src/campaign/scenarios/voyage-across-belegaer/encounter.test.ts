// Rules: dcce.heading, dcce.sailing-tests, dcce.boarding, dcce.corsair-deck, dcce.ship-enemies, rr.step-3-3, rr.engaged, rr.shadow-effects, rr.search, rr.travel, rr.cancel, rr.damage
// (data/rules/entries.json). The encounter cards of Voyage Across Belegaer that no template reads: each line of the ledger (data/printed/dream-chaser.json) has a record, and these
// tests run them on a table of plain-number heroes and the campaign's ships (test/scenarios/voyage-across-belegaer/scene.ts).
import { beforeAll, describe, expect, it } from "vitest";

import { syncConstants } from "../../../rules/interpret/constants.ts";
import { modifiedStat } from "../../../rules/core/keywords.ts";
import { legalAttackEnemies, canAttack } from "../../../rules/combat/combat.ts";
import { stagingThreat } from "../../../rules/quest/quest.ts";
import { legalIntents, legalTargets } from "../../../rules/engine/reduce.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { causeProblems } from "../../../../test/harness/cause-check.ts";
import { first, send, start } from "../../../../test/scenarios/a-shadow-of-the-past/scene.ts";
import {
  BOARDING_PARTY, CALM_WATERS, CORSAIR_WARSHIP, CUNNING_PIRATE, FOG_BANK, LIGHT_CRUISER, ROLLING_SEAS, ROUGH_WATERS, SCOUTING_SHIP, SHIPS, SOUTHRON_SAILOR, STARLIT_SEA, SUDDEN_STORMS, THROWN_OFF_COURSE,
  UMBAR_CAPTAIN, VICIOUS_MARAUDER, WATERSPOUT, WINDS_OF_WRATH, codesIn, loadVoyageWorld, resolveReveal, voyageFight, voyageTable, type VoyageLayout, type VoyageWorld,
} from "../../../../test/scenarios/voyage-across-belegaer/scene.ts";

let world: VoyageWorld;

beforeAll(async () => {
  world = await loadVoyageWorld();
});

function make(layout: VoyageLayout = {}) {
  const made = voyageTable(world, { heading: "Sun", ships: [{ code: SHIPS.dreamChaser, seat: 0 }], ...layout });
  return { ...made, state: syncConstants(made.state, made.ctx) };
}

const heading = (state: ScenarioState) => state.sea?.heading;
const stat = (made: ReturnType<typeof make>, code: string, which: "attack" | "willpower" | "threat" | "engagementCost" | "hitPoints") => modifiedStat(made.state, made.state.cards[first(made.state, code)]!, which, made.ctx.cards);

describe("Scouting Ship (11022:A:2, 11022:A:3)", () => {
  it("cannot have attachments (11022:A:2) and costs 15 less to engage while off-course (11022:A:3)", () => {
    const sun = make({ staging: [SCOUTING_SHIP] });
    expect(sun.state.modifiers.some((modifier) => modifier.stat === "cannotHaveAttachments" && modifier.instanceId === first(sun.state, SCOUTING_SHIP))).toBe(true);
    expect(stat(sun, SCOUTING_SHIP, "engagementCost")).toBe(35);
    expect(stat(make({ staging: [SCOUTING_SHIP], heading: "Cloud" }), SCOUTING_SHIP, "engagementCost")).toBe(20);
  });
});

describe("Starlit Sea (11023:A:1, 11023:A:2)", () => {
  it("gains \"Travel: Raise each player's threat by 3\" only while off-course (11023:A:1)", () => {
    for (const [at, raised] of [["Sun", 0], ["Rain", 3]] as const) {
      const made = make({ seats: 2, staging: [STARLIT_SEA], heading: at, phase: "Travel", threat: [28, 26] });
      const run = send(start(made.state), { type: "Travel", locationId: first(made.state, STARLIT_SEA) }, made.ctx);
      // One more each, for the round that ends after the travel.
      expect(run.state.seats.slice(0, 2).map((seat) => seat.threat), at).toEqual([29 + raised, 27 + raised]);
      expect(causeProblems(run.steps)).toEqual([]);
    }
  });

  it("gives the attacking enemy +1 Attack, +2 while off-course (11023:A:2)", () => {
    // The raider has 2 Attack: against the hero's 2 Defense, +1 Attack deals 1 damage, +2 Attack deals 2.
    for (const [at, damage] of [["Sun", 1], ["Storm", 2]] as const) {
      const hit = voyageFight(world, STARLIT_SEA, "raider", { heading: at });
      expect(hit.run.state.cards[hit.made.hero]?.damage, at).toBe(damage);
    }
  });
});

describe("Fog Bank (11024:A:1, 11024:A:2)", () => {
  it("while it is the active location Ship enemies make no engagement checks, cannot attack and cannot be attacked (11024:A:1)", () => {
    const made = make({ active: FOG_BANK, staging: [SCOUTING_SHIP], engaged: [{ code: LIGHT_CRUISER, seat: 0 }] });
    const flags = ["noEngagementChecks", "cannotAttack", "cannotBeAttacked"];
    for (const flag of flags) {
      for (const code of [SCOUTING_SHIP, LIGHT_CRUISER]) expect(made.state.modifiers.some((modifier) => modifier.stat === flag && modifier.instanceId === first(made.state, code)), `${code} ${flag}`).toBe(true);
    }
    // No character may attack the engaged Ship enemy; without the Fog Bank active it can be attacked.
    const cruiser = first(made.state, LIGHT_CRUISER);
    expect(canAttack(made.state, 0, made.hero, cruiser, made.ctx.cards)).toBe(false);
    const clear = make({ staging: [FOG_BANK], engaged: [{ code: LIGHT_CRUISER, seat: 0 }] });
    expect(canAttack(clear.state, 0, clear.hero, first(clear.state, LIGHT_CRUISER), clear.ctx.cards)).toBe(true);
    // A Ship enemy is no longer among the enemies a character may attack, and other enemies still are.
    const mixed = make({ active: FOG_BANK, engaged: [{ code: LIGHT_CRUISER, seat: 0 }, { code: "brute", seat: 0 }] });
    expect(legalAttackEnemies(mixed.state, 0, mixed.hero, mixed.ctx.cards)).toEqual([first(mixed.state, "brute")]);
  });

  it("makes the attacking enemy attack again after this attack at the worst heading, and not otherwise (11024:A:2)", () => {
    const storm = voyageFight(world, FOG_BANK, "raider", { heading: "Storm" });
    const sun = voyageFight(world, FOG_BANK, "raider", { heading: "Sun" });
    expect(storm.run.state.cards[storm.made.hero]?.damage).toBeGreaterThan(sun.run.state.cards[sun.made.hero]?.damage ?? 0);
  });
});

describe("Calm Waters (11050:A:1, 11050:A:2)", () => {
  it("while it is the active location the Sailing test looks at 2 additional cards (11050:A:1)", () => {
    const made = make({ active: CALM_WATERS });
    expect(made.state.modifiers.some((modifier) => modifier.stat === "sailingLook" && modifier.amount === 2)).toBe(true);
    expect(make({ staging: [CALM_WATERS] }).state.modifiers.some((modifier) => modifier.stat === "sailingLook")).toBe(false);
  });

  it("gives the attacking enemy +1 Attack, +3 if it is a Ship enemy (11050:A:2)", () => {
    expect(voyageFight(world, CALM_WATERS, "raider").run.state.cards[voyageFight(world, CALM_WATERS, "raider").made.hero]?.damage).toBe(1);
    const ship = voyageFight(world, CALM_WATERS, SCOUTING_SHIP, {}, { defender: (made) => made.ships[0] ?? "" });
    // Scouting Ship has 5 Attack, +3 = 8 against the Dream-chaser's 4 Defense.
    expect(ship.run.state.cards[ship.made.ships[0] ?? ""]?.damage).toBe(4);
  });
});

describe("Rolling Seas (11051:A:1, 11051:A:2)", () => {
  it("shifts the heading off-course when the players travel to it (11051:A:1)", () => {
    const made = make({ staging: [ROLLING_SEAS], phase: "Travel" });
    const run = send(start(made.state), { type: "Travel", locationId: first(made.state, ROLLING_SEAS) }, made.ctx);
    expect(heading(run.state)).toBe("Cloud");
    expect(causeProblems(run.steps)).toEqual([]);
  });

  it("shifts it off-course when the attack deals damage to a Ship objective, and not when it deals none or hits a hero (11051:A:2)", () => {
    const onShip = voyageFight(world, ROLLING_SEAS, SCOUTING_SHIP, {}, { defender: (made) => made.ships[0] ?? "" });
    expect(onShip.run.state.cards[onShip.made.ships[0] ?? ""]?.damage).toBeGreaterThan(0);
    expect(heading(onShip.run.state)).toBe("Cloud");
    const blocked = voyageFight(world, ROLLING_SEAS, "raider", {});
    expect(heading(blocked.run.state)).toBe("Sun");
  });
});

describe("Thrown Off Course (11052:A:1, 11052:A:2)", () => {
  it("lets the players remove all progress from the quest and raise each player's threat by 4 (11052:A:1)", () => {
    const made = make({ stage: "11017", progress: 1, phase: "Encounter" });
    const run = resolveReveal(made.state, made.ctx, THROWN_OFF_COURSE, () => "progress");
    expect(run.state.cards[run.state.questStage ?? ""]?.progress).toBe(0);
    const shifted = resolveReveal(made.state, made.ctx, THROWN_OFF_COURSE, () => "heading");
    expect((run.state.seats[0]?.threat ?? 0) - (shifted.state.seats[0]?.threat ?? 0)).toBe(4);
    expect(heading(run.state)).toBe("Sun");
  });

  it("or shifts the heading off-course (11052:A:1)", () => {
    const made = make({ stage: "11017", progress: 1, phase: "Encounter" });
    const run = resolveReveal(made.state, made.ctx, THROWN_OFF_COURSE, () => "heading");
    expect(heading(run.state)).toBe("Cloud");
    expect(run.state.cards[run.state.questStage ?? ""]?.progress).toBe(1);
  });

  it("shifts the heading when its attack destroys a character, and not otherwise (11052:A:2)", () => {
    // The brute deals 7 damage to a hero with 6 hit points: it is destroyed, and the heading shifts. The raider's attack destroys no one.
    const killed = voyageFight(world, THROWN_OFF_COURSE, "brute");
    expect(killed.run.state.cards[killed.made.hero]?.zone).not.toBe("heroes");
    expect(heading(killed.run.state)).toBe("Cloud");
    expect(heading(voyageFight(world, THROWN_OFF_COURSE, "raider").run.state)).toBe("Sun");
  });
});

describe("Rough Waters (11053:A:1, 11053:A:2)", () => {
  it("in the staging area it cancels a Sailing success symbol of each test (11053:A:1)", () => {
    expect(make({ staging: [ROUGH_WATERS] }).state.modifiers.some((modifier) => modifier.stat === "sailingCancel")).toBe(true);
    expect(make({ active: ROUGH_WATERS }).state.modifiers.some((modifier) => modifier.stat === "sailingCancel")).toBe(false);
  });

  it("gives the attacking enemy +2 Attack while off-course (11053:A:2)", () => {
    expect(voyageFight(world, ROUGH_WATERS, "raider", { heading: "Sun" }).run.state.cards[voyageFight(world, ROUGH_WATERS, "raider", { heading: "Sun" }).made.hero]?.damage).toBe(0);
    const off = voyageFight(world, ROUGH_WATERS, "raider", { heading: "Rain" });
    expect(off.run.state.cards[off.made.hero]?.damage).toBe(2);
  });
});

describe("Waterspout (11054:A:1, 11054:A:2)", () => {
  it("at the worst heading the players must travel to it, if able (11054:A:1)", () => {
    const place = (made: ReturnType<typeof make>) => legalTargets(made.state, { type: "Travel" }, made.ctx);
    const storm = make({ staging: [WATERSPOUT, "place"], phase: "Travel", heading: "Storm" });
    expect(place(storm)).toEqual([first(storm.state, WATERSPOUT)]);
    const rain = make({ staging: [WATERSPOUT, "place"], phase: "Travel", heading: "Rain" });
    expect(place(rain)).toHaveLength(2);
  });

  it("deals 4 damage to each Ship objective after the players travel to it (11054:A:2)", () => {
    const made = make({ seats: 2, staging: [WATERSPOUT], phase: "Travel", ships: [{ code: SHIPS.dreamChaser, seat: 0 }, { code: SHIPS.dawnStar, seat: 1 }] });
    const run = send(start(made.state), { type: "Travel", locationId: first(made.state, WATERSPOUT) }, made.ctx);
    expect(made.ships.map((id) => run.state.cards[id]?.damage)).toEqual([4, 4]);
    expect(run.state.cards[made.hero]?.damage).toBe(0);
    expect(causeProblems(run.steps)).toEqual([]);
  });
});

describe("Sudden Storms (11055:A:1, 11055:A:2)", () => {
  it("shifts the heading off-course, or deals 1 damage to each exhausted character (11055:A:1)", () => {
    const made = make({ ships: [{ code: SHIPS.dreamChaser, seat: 0 }], phase: "Encounter" });
    const exhausted = { ...made.state, cards: { ...made.state.cards, [made.hero]: { ...made.state.cards[made.hero]!, exhausted: true }, [made.ships[0] ?? ""]: { ...made.state.cards[made.ships[0] ?? ""]!, exhausted: true } } };
    const damage = resolveReveal(exhausted, made.ctx, SUDDEN_STORMS, () => "damage");
    expect(damage.state.cards[made.hero]?.damage).toBe(1);
    expect(damage.state.cards[made.hero2]?.damage).toBe(0);
    expect(damage.state.cards[made.ships[0] ?? ""]?.damage).toBe(1);
    expect(heading(damage.state)).toBe("Sun");
    expect(heading(resolveReveal(made.state, made.ctx, SUDDEN_STORMS, () => "heading").state)).toBe("Cloud");
  });

  it("deals the excess damage of its attack to a Ship objective you control (11055:A:2)", () => {
    // The brute has 9 Attack against the hero's 2 Defense: 7 damage on a hero with 6 hit points and 3 damage already: 3 remain, 4 are excess, and the lone ship takes them.
    const hit = voyageFight(world, SUDDEN_STORMS, "brute", { damage: [["dh1", 3]] });
    expect(hit.run.state.cards[hit.made.ships[0] ?? ""]?.damage).toBe(4);
    expect(causeProblems(hit.run.steps)).toEqual([]);
    // No excess, no damage to the ship.
    const none = voyageFight(world, SUDDEN_STORMS, "raider");
    expect(none.run.state.cards[none.made.ships[0] ?? ""]?.damage).toBe(0);
  });

  it("deals no ship damage when its attack deals exactly the defender's remaining hit points, though the defender is destroyed (11055:A:2)", () => {
    // The bruiser deals 6 damage to a hero with 6 hit points: the hero is destroyed, no damage is beyond its hit points, and X is 0 (not the one character destroyed).
    const hit = voyageFight(world, SUDDEN_STORMS, "bruiser");
    expect(hit.run.state.cards[hit.made.hero]?.zone).not.toBe("play");
    expect(hit.run.state.cards[hit.made.ships[0] ?? ""]?.damage).toBe(0);
  });
});

describe("Winds of Wrath (11056:A:1, 11056:A:2)", () => {
  it("deals 1 damage to each character in play while off-course, and nothing on-course (11056:A:1)", () => {
    const cloud = make({ heading: "Cloud" });
    const run = resolveReveal(cloud.state, cloud.ctx, WINDS_OF_WRATH);
    expect(run.state.cards[cloud.hero]?.damage).toBe(1);
    expect(run.state.cards[cloud.ships[0] ?? ""]?.damage).toBe(1);
    const sun = make({ heading: "Sun" });
    expect(resolveReveal(sun.state, sun.ctx, WINDS_OF_WRATH).state.cards[sun.hero]?.damage).toBe(0);
  });

  it("lets the defender shift the heading off-course or treats the attack as undefended (11056:A:2)", () => {
    const shifted = voyageFight(world, WINDS_OF_WRATH, "raider", {}, { answer: () => ({ type: "Choose", optionId: "heading" }) });
    expect(heading(shifted.run.state)).toBe("Cloud");
    const undefended = voyageFight(world, WINDS_OF_WRATH, "raider", {}, { answer: () => ({ type: "Choose", optionId: "undefended" }) });
    expect(heading(undefended.run.state)).toBe("Sun");
    // Undefended, the raider's 2 Attack lands whole on the hero.
    expect(undefended.run.state.cards[undefended.made.hero]?.damage).toBe(2);
  });
});

describe("Light Cruiser (11057:A:2, 11057:A:3) and Corsair Warship (11058:A:2, 11058:A:3)", () => {
  it("cannot have attachments (11057:A:2, 11058:A:2)", () => {
    const made = make({ staging: [LIGHT_CRUISER, CORSAIR_WARSHIP] });
    for (const code of [LIGHT_CRUISER, CORSAIR_WARSHIP]) expect(made.state.modifiers.some((modifier) => modifier.stat === "cannotHaveAttachments" && modifier.instanceId === first(made.state, code)), code).toBe(true);
  });

  it("puts 1 resource on each Raider its Boarding reveals (11057:A:3)", () => {
    const made = make({ staging: [LIGHT_CRUISER], corsair: ["raider", "raider", "raider"] });
    const engaged = send(start({ ...made.state, mode: "optionalEngage", phase: "Encounter", window: { kind: "optionalEngage" } }), { type: "Engage", enemyId: first(made.state, LIGHT_CRUISER) }, made.ctx);
    // Settle the boarding event.
    const raiders = Object.values(engaged.state.cards).filter((card) => card.code === "raider" && card.zone === "engaged");
    expect(raiders).toHaveLength(2);
    expect(raiders.map((card) => card.resources)).toEqual([1, 1]);
  });

  it("cannot be damaged and gains archery 4 while it is in the staging area (11058:A:3)", () => {
    const staged = make({ staging: [CORSAIR_WARSHIP] });
    const warship = first(staged.state, CORSAIR_WARSHIP);
    expect(staged.state.modifiers.filter((modifier) => modifier.instanceId === warship).map((modifier) => modifier.stat).sort()).toEqual(expect.arrayContaining(["archery", "cannotTakeDamage"]));
    const engaged = make({ engaged: [{ code: CORSAIR_WARSHIP, seat: 0 }] });
    expect(engaged.state.modifiers.some((modifier) => modifier.instanceId === first(engaged.state, CORSAIR_WARSHIP) && modifier.stat === "cannotTakeDamage")).toBe(false);
  });
});

describe("Boarding Party (11059:A:1, 11059:A:2)", () => {
  it("has each player reveal the top card of the Corsair deck into play engaged with him (11059:A:1)", () => {
    const made = make({ seats: 2, corsair: ["raider", "raider", "raider"] });
    const run = resolveReveal(made.state, made.ctx, BOARDING_PARTY);
    expect(run.state.seats.slice(0, 2).map((seat) => seat.engaged.length)).toEqual([1, 1]);
    expect(run.state.corsairDeck).toHaveLength(1);
  });

  it("gives the attacking enemy +1 Attack, +2 if you control an exhausted Ship objective (11059:A:2)", () => {
    const ready = voyageFight(world, BOARDING_PARTY, "raider", {});
    expect(ready.run.state.cards[ready.made.hero]?.damage).toBe(1);
    const tired = voyageFight(world, BOARDING_PARTY, "raider", { exhaustedShips: true });
    expect(tired.run.state.cards[tired.made.hero]?.damage).toBe(2);
  });
});

describe("Southron Sailor (11060:A:1)", () => {
  it("makes each Ship enemy engaged with you contribute its Threat to the staging area's, while it is engaged with you (11060:A:1)", () => {
    const alone = make({ engaged: [{ code: LIGHT_CRUISER, seat: 0 }], staging: ["f3"] });
    expect(stagingThreat(alone.state, alone.ctx.cards)).toBe(3);
    const sailing = make({ engaged: [{ code: LIGHT_CRUISER, seat: 0 }, { code: SOUTHRON_SAILOR, seat: 0 }], staging: ["f3"] });
    expect(stagingThreat(sailing.state, sailing.ctx.cards)).toBe(3 + 4);
  });
});

describe("Cunning Pirate (11061:A:1, 11061:A:2)", () => {
  it("gets +1 Attack and +1 Defense for each resource on it (11061:A:1)", () => {
    const made = make({ engaged: [{ code: CUNNING_PIRATE, seat: 0 }] });
    const pirate = first(made.state, CUNNING_PIRATE);
    const loaded = syncConstants({ ...made.state, cards: { ...made.state.cards, [pirate]: { ...made.state.cards[pirate]!, resources: 3 } } }, made.ctx);
    expect(modifiedStat(loaded, loaded.cards[pirate]!, "attack", made.ctx.cards)).toBe(2 + 3);
    expect(modifiedStat(loaded, loaded.cards[pirate]!, "defense", made.ctx.cards)).toBe(2 + 3);
  });

  it("discards an attachment you control when it engages you and takes resources equal to its printed cost (11061:A:2)", () => {
    const made = make({ staging: [CUNNING_PIRATE], attachments: ["blade"], threat: [50, 50] });
    const engaged = send(start({ ...made.state, mode: "optionalEngage", phase: "Encounter", window: { kind: "optionalEngage" } }), { type: "Engage", enemyId: first(made.state, CUNNING_PIRATE) }, made.ctx);
    expect(engaged.state.cards[first(engaged.state, CUNNING_PIRATE)]?.resources).toBe(3);
    expect(codesIn(engaged.state, "discard")).toEqual(["blade"]);
    // With no attachment it gets none.
    const bare = make({ staging: [CUNNING_PIRATE], threat: [50, 50] });
    const none = send(start({ ...bare.state, mode: "optionalEngage", phase: "Encounter", window: { kind: "optionalEngage" } }), { type: "Engage", enemyId: first(bare.state, CUNNING_PIRATE) }, bare.ctx);
    expect(none.state.cards[first(none.state, CUNNING_PIRATE)]?.resources).toBe(0);
  });
});

describe("Vicious Marauder (11062:A:1, 11062:A:2) and Umbar Captain (11063:A:1)", () => {
  it("discards a random card from your hand when it engages you and takes resources equal to its printed cost (11062:A:1)", () => {
    const made = make({ staging: [VICIOUS_MARAUDER], hand: ["blade"], threat: [50, 50] });
    const engaged = send(start({ ...made.state, mode: "optionalEngage", phase: "Encounter", window: { kind: "optionalEngage" } }), { type: "Engage", enemyId: first(made.state, VICIOUS_MARAUDER) }, made.ctx);
    const marauder = engaged.state.cards[first(engaged.state, VICIOUS_MARAUDER)];
    expect(marauder?.resources).toBe(3);
    expect(codesIn(engaged.state, "discard")).toEqual(["blade"]);
  });

  it("distributes damage equal to the resources on it when it attacks you (11062:A:2)", () => {
    // Two resources on it: 2 damage among the characters of the attacked player before the attack, one at a time on the character chosen (the first option each time).
    const hit = voyageFight(world, "f0", VICIOUS_MARAUDER, {}, { tweak: (state) => ({ ...state, cards: { ...state.cards, [first(state, VICIOUS_MARAUDER)]: { ...state.cards[first(state, VICIOUS_MARAUDER)]!, resources: 2 } } }) });
    const total = ["dh1", "dh2"].reduce((sum, code) => sum + (hit.run.state.cards[first(hit.run.state, code)]?.damage ?? 0), 0) + (hit.run.state.cards[hit.made.ships[0] ?? ""]?.damage ?? 0);
    // The Marauder's own attack (3 Attack against the defender's 2 Defense) adds 1.
    expect(total).toBe(2 + 1);
  });

  it("stops the characters you control from attacking Ship enemies while you are engaged with Umbar Captain (11063:A:1)", () => {
    const made = make({ engaged: [{ code: UMBAR_CAPTAIN, seat: 0 }, { code: LIGHT_CRUISER, seat: 0 }] });
    expect(canAttack(made.state, 0, made.hero, first(made.state, LIGHT_CRUISER), made.ctx.cards)).toBe(false);
    expect(canAttack(made.state, 0, made.hero, first(made.state, UMBAR_CAPTAIN), made.ctx.cards)).toBe(true);
    expect(legalIntents(made.state, made.ctx).length).toBeGreaterThan(0);
  });
});
