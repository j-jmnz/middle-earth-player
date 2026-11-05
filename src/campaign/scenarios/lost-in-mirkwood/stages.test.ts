// Rules: emce.guarded-x, emce.immune, rr.guarded, rr.explored, rr.quest-advancement, rr.player-elimination, rr.surge, rr.shadow-effects (data/rules/entries.json); ledger lines 18028:A:2, 18029:A:2 to 18032:A:2, 18036:A:2, 18072:B:1, 18073:B:1, 18073:B:2, 18074:A:1 to 18074:B:3, 18075:A:1 to 18075:B:3,
// 18076:A:1 to 18076:B:3, 18077:A:1, 18077:B:1.
// The quest stages of Lost in Mirkwood and the Objective-Locations' Travel effects on the scenario's scene: Carried Away (a hero held by an enemy), Truly Lost (a hand under a location), The Forest of Great Fear (the nemesis) and Escape from Taur-nu-fuin.
import { addStandIns } from "../../../../test/harness/scene-kit.ts";
import { beforeAll, describe, expect, it } from "vitest";

import { UNATTRIBUTED } from "../../../rules/core/cause.ts";
import { destroyCard, modifiedStat, placeDamage } from "../../../rules/core/keywords.ts";
import { flagged, updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { moveCard, spawn } from "../../../rules/core/zones.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import type { EngineStep } from "../../../rules/core/intents.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { afterProgress } from "../../../rules/quest/stage-reveal.ts";
import { placeQuestProgress, questPointsOf } from "../../../rules/quest/quest.ts";
import { restricted } from "../../../rules/interpret/restrictions.ts";
import { CODES, codesIn, finish, idOf, idsOf, loadLostmirkWorld, lostmirkFight, lostmirkTable, resolveRecords, send, start, type LostmirkTable, type LostmirkWorld, type Run } from "../../../../test/scenarios/lost-in-mirkwood/scene.ts";

let world: LostmirkWorld;
beforeAll(async () => {
  world = await loadLostmirkWorld();
  addStandIns(world.cards, ["mild"]);
}, 120_000);

const stageCode = (run: Run): string | undefined => (run.state.questStage ? run.state.cards[run.state.questStage]?.code : undefined);
// Player cards facedown under a location, as Truly Lost leaves them.
function putUnder(state: ScenarioState, locationId: string, code: string, owner: number, count: number): ScenarioState {
  let next = state;
  for (let index = 0; index < count; index += 1) {
    const spawned = spawn(next, code, { zone: "under", locationId });
    next = updateCard(spawned.state, spawned.id, { owner });
  }
  return next;
}
const underOf = (state: ScenarioState, locationId: string) => Object.values(state.cards).filter((card) => card.zone === "under" && card.host === locationId);
const cardsOf = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);
const threatOf = (state: ScenarioState, seat: number): number => state.seats[seat]?.threat ?? 0;
const totalDamage = (state: ScenarioState, ids: readonly string[]): number => ids.reduce((sum, id) => sum + (state.cards[id]?.damage ?? 0), 0);
describe("18028 Searching for a Way Out: progress on the main quest", () => {
  const progressed = (t: LostmirkTable, amount: number): ScenarioState => {
    const steps: EngineStep[] = [];
    const placed = placeQuestProgress(t.state, amount, t.ctx.cards, steps, () => true, true);
    return settle(afterProgress(placed, 0, t.ctx, steps), t.ctx, steps);
  };

  it("with no Objective-Location in play is discarded from the encounter deck, and the topmost Objective-Location in the discard pile enters play, guarded", () => {
    const t = lostmirkTable(world, { stage: "18071", staging: [CODES.searchingForAWayOut], deck: ["f0", "f0", "place"], discard: [CODES.bareHilltop, CODES.overgrownPath] });
    const after = progressed(t, 2);
    expect(after.cards[after.questStage ?? ""]?.progress).toBe(0);
    expect(codesIn(after, "encounterDiscard")).toEqual([CODES.bareHilltop, "f0", "f0"]);
    const path = cardsOf(after, CODES.overgrownPath)[0];
    expect(path?.zone).toBe("staging");
    expect(cardsOf(after, CODES.bareHilltop)[0]?.zone).toBe("encounterDiscard");
    // Overgrown Path is Guarded (location): the next location of the deck guards it.
    expect(cardsOf(after, "place")[0]).toMatchObject({ host: path?.id, guard: true });
  });

  it("with an Objective-Location in play is placed on the quest as usual", () => {
    const t = lostmirkTable(world, { stage: "18071", staging: [CODES.searchingForAWayOut, CODES.bareHilltop], deck: ["f0", "f0"] });
    const after = progressed(t, 2);
    expect(after.cards[after.questStage ?? ""]?.progress).toBe(2);
    expect(after.encounterDeck).toHaveLength(2);
  });
});

describe("the Objective-Locations' Travel effects (18029:A:2 to 18032:A:2)", () => {
  const travel = (code: string, layout: Parameters<typeof lostmirkTable>[1]) => {
    const t = lostmirkTable(world, { stage: "18071", phase: "Travel", ...layout, staging: [code, ...(layout?.staging ?? [])] });
    return { t, run: resolveRecords(t.state, t.ctx, code, "travel", idOf(t.state, code), undefined, true) };
  };

  it("18029 shuffles the discard pile into the deck, discards the top card and assigns damage equal to its Threat among the player's characters", () => {
    const { t, run } = travel(CODES.overgrownPath, { deck: ["f3", "f3"], discard: ["f3"] });
    expect(run.state.encounterDiscard).toHaveLength(1);
    expect(run.state.encounterDeck).toHaveLength(2);
    expect(totalDamage(run.state, [t.hero, t.hero2])).toBe(3);
  });

  it("18030 adds each enemy discarded this way to the staging area", () => {
    const { run } = travel(CODES.abandonedVillage, { seats: 2, deck: ["f3", "f3", "f3"] });
    expect(codesIn(run.state, "staging").filter((code) => code === "f3")).toHaveLength(2);
    expect(run.state.encounterDeck).toHaveLength(1);
  });

  it("18030 leaves a location discarded this way in the discard pile", () => {
    const { run } = travel(CODES.abandonedVillage, { deck: ["place"] });
    expect(codesIn(run.state, "staging")).not.toContain("place");
    expect(codesIn(run.state, "encounterDiscard")).toEqual(["place"]);
  });

  it("18031 adds each location discarded this way to the staging area", () => {
    const { run } = travel(CODES.bareHilltop, { seats: 2, deck: ["place", "place", "f3"] });
    expect(codesIn(run.state, "staging").filter((code) => code === "place")).toHaveLength(2);
  });

  it("18032 raises the player's threat by the discarded card's Threat", () => {
    const { run } = travel(CODES.forestClearing, { deck: ["f3", "f3"] });
    expect(threatOf(run.state, 0)).toBe(31);
  });
});

describe("18036 Unseen Danger: the Shadow on an enemy guarding a card (18036:A:2)", () => {
  const fight = (guarding: "objective" | "hero" | null) =>
    lostmirkFight(world, CODES.unseenDanger, "mild", { staging: [CODES.bareHilltop] }, {
      tweak: (state, made) => {
        const enemy = idsOf(state, "mild")[0] ?? "";
        if (guarding === "objective") return updateCard(state, enemy, { host: idOf(state, CODES.bareHilltop), guard: true });
        if (guarding === "hero") return updateCard(moveCard(state, made.hero2, { zone: "captive", hostId: enemy }), made.hero2, { guardedHero: true, owner: 0 });
        return state;
      },
    });

  it("gives an attacker guarding an Objective-Location +2 Attack and +2 Defense for the phase", () => {
    const plain = fight(null);
    const guarded = fight("objective");
    const enemy = idsOf(guarded.during, "mild")[0] ?? "";
    expect(modifiedStat(guarded.during, guarded.during.cards[enemy]!, "defense", world.cards)).toBe(3);
    // The scene's hero defends with 2: 3 + 2 + shadow bonus - 2 against 3 - 2.
    expect(guarded.run.state.cards[guarded.made.hero]?.damage).toBe((plain.run.state.cards[plain.made.hero]?.damage ?? 0) + 2);
  });

  it("gives an attacker guarding a hero the same", () => {
    const plain = fight(null);
    const guarded = fight("hero");
    expect(guarded.run.state.cards[guarded.made.hero]?.damage).toBe((plain.run.state.cards[plain.made.hero]?.damage ?? 0) + 2);
  });
});

describe("18072 and 18073: the first Spider (Orc) revealed each quest phase gains surge (18072:B:1, 18073:B:1)", () => {
  const quest = (stage: "18072" | "18073", deck: readonly string[]) => {
    const t = lostmirkTable(world, { stage, deck });
    return finish(send(start(t.state), { type: "Pass" }, t.ctx), t.ctx);
  };

  it("a Spider revealed first gains surge, so one more card is revealed; the second Spider does not", () => {
    const run = quest("18072", [CODES.forestSpider, CODES.forestSpider, "f0", "f0"]);
    expect(run.state.encounterDeck).toHaveLength(2);
    expect(codesIn(run.state, "staging").filter((code) => code === CODES.forestSpider)).toHaveLength(2);
  });

  it("an enemy that is not a Spider does not", () => {
    const run = quest("18072", ["f0", "f0", "f0"]);
    expect(run.state.encounterDeck).toHaveLength(2);
  });

  it("the first Orc gains surge on 18073, and a Spider does not", () => {
    const orc = quest("18073", ["01091", "f0", "f0"]);
    expect(orc.state.encounterDeck).toHaveLength(1);
    const spider = quest("18073", [CODES.forestSpider, "f0", "f0"]);
    expect(spider.state.encounterDeck).toHaveLength(2);
  });
});

describe("18073 Dol Guldur Orcs: an Orc that damages a character (18073:B:2)", () => {
  it("makes the character's controller discard 1 card from hand", () => {
    const fought = lostmirkFight(world, "f0", "01091", { stage: "18073", hand: ["filler", "filler", "filler"] });
    expect(fought.run.state.cards[fought.made.hero]?.damage).toBeGreaterThan(0);
    expect(fought.run.state.seats[0]?.hand).toHaveLength(2);
    expect(fought.run.state.seats[0]?.discard).toHaveLength(1);
  });

  it("does nothing for a defender that took no damage, or an attacker that is not an Orc", () => {
    const spider = lostmirkFight(world, "f0", CODES.forestSpider, { stage: "18073", hand: ["filler", "filler", "filler"] });
    expect(spider.run.state.seats[0]?.hand).toHaveLength(3);
  });
});

describe("18074 Carried Away", () => {
  const reveal = (layout: Parameters<typeof lostmirkTable>[1]) => {
    const t = lostmirkTable(world, { stage: "18074", ...layout });
    return { t, run: resolveRecords(t.state, t.ctx, "18074", "whenRevealed", idOf(t.state, "18074")) };
  };

  it("When Revealed: a hero loses its tokens and attachments, the encounter deck is discarded to an enemy, and that enemy guards the hero, which is in play under nobody's control", () => {
    const base = lostmirkTable(world, { stage: "18074", deck: ["place", "f3", "f0"] });
    const hurt = updateCard(updateCard(base.state, base.hero, { damage: 2, resources: 3 }), base.hero2, { damage: 1 });
    const run = resolveRecords(hurt, base.ctx, "18074", "whenRevealed", idOf(hurt, "18074"), (state) => (state.window?.kind === "choose" ? (state.window.options[0] ?? "") : ""));
    const held = Object.values(run.state.cards).filter((card) => card.guardedHero === true);
    expect(held).toHaveLength(1);
    const hero = held[0]!;
    const guard = cardsOf(run.state, "f3")[0]!;
    expect(hero).toMatchObject({ zone: "captive", host: guard.id, controller: null, damage: 0, resources: 0, owner: 0 });
    expect(guard.zone).toBe("staging");
    // The location before the enemy was discarded, the enemy added to the staging area; the held hero is no longer one of the seat's heroes.
    expect(codesIn(run.state, "encounterDiscard")).toEqual(["place"]);
    expect(run.state.seats[0]?.heroes).not.toContain(hero.id);
    expect(run.state.seats[0]?.heroes).toHaveLength(1);
  });

  it("a player whose only hero is held is not eliminated", () => {
    const { run } = reveal({ seats: 2, deck: ["f0", "f0"] });
    expect(run.state.seats[1]?.heroes).toEqual([]);
    expect(run.state.seats[1]?.eliminated).toBeFalsy();
    expect(run.state.lost).toBeFalsy();
  });

  it("each enemy guarding a hero cannot take non-combat damage, and an enemy that guards none can (18074:B:1)", () => {
    const { t, run } = reveal({ deck: ["f3"], staging: ["f0"] });
    const guard = cardsOf(run.state, "f3")[0]!;
    const other = cardsOf(run.state, "f0")[0]!;
    const steps: EngineStep[] = [];
    expect(flagged(run.state, guard.id, "cannotTakeNonCombatDamage")).toBe(true);
    expect(placeDamage(run.state, guard.id, 2, t.ctx.cards, steps, "framework", UNATTRIBUTED).cards[guard.id]?.damage).toBe(0);
    expect(placeDamage(run.state, guard.id, 2, t.ctx.cards, steps, "combat", UNATTRIBUTED).cards[guard.id]?.damage).toBe(2);
    expect(placeDamage(run.state, other.id, 2, t.ctx.cards, steps, "framework", UNATTRIBUTED).cards[other.id]?.damage).toBe(2);
  });

  it("when an enemy guarding a hero is defeated the hero returns to its owner's control, exhausted, in its place among the heroes (18074:B:2)", () => {
    const { t, run } = reveal({ deck: ["f3"] });
    const hero = Object.values(run.state.cards).find((card) => card.guardedHero === true)!;
    const guard = cardsOf(run.state, "f3")[0]!;
    const killed = settle(placeDamage(run.state, guard.id, 3, t.ctx.cards, [], "combat", UNATTRIBUTED), t.ctx, []);
    const back = finish({ state: killed, steps: [] }, t.ctx).state;
    expect(back.cards[guard.id]?.zone).toBe("encounterDiscard");
    expect(back.cards[hero.id]).toMatchObject({ zone: "heroes", controller: 0, exhausted: true, face: "up" });
    expect(back.cards[hero.id]?.guardedHero).toBeUndefined();
    expect(back.seats[0]?.heroes).toContain(hero.id);
    expect(back.seats[0]?.heroes[0]).toBe(hero.id);
  });

  it("a guard that leaves play in any way, discarded by an effect, returns the hero exhausted too (user ruling, 2026-11-05)", () => {
    const { t, run } = reveal({ deck: ["f3"] });
    const hero = Object.values(run.state.cards).find((card) => card.guardedHero === true)!;
    const guard = cardsOf(run.state, "f3")[0]!;
    const gone = finish({ state: settle(moveCard(run.state, guard.id, { zone: "encounterDiscard" }), t.ctx, []), steps: [] }, t.ctx).state;
    expect(gone.cards[guard.id]?.zone).toBe("encounterDiscard");
    expect(gone.cards[hero.id]).toMatchObject({ zone: "heroes", controller: 0, exhausted: true, face: "up" });
    expect(gone.cards[hero.id]?.guardedHero).toBeUndefined();
  });

  it("a guard moving between the staging area and an engagement keeps the hero held", () => {
    const { run } = reveal({ deck: ["f3"] });
    const hero = Object.values(run.state.cards).find((card) => card.guardedHero === true)!;
    const guard = cardsOf(run.state, "f3")[0]!;
    const engaged = moveCard(run.state, guard.id, { zone: "engaged", seat: 0 });
    expect(engaged.cards[hero.id]).toMatchObject({ zone: "captive", guardedHero: true });
  });

  it("a seat whose every hero is held is attacked undefended and takes no damage: the attack ends and the game goes on", () => {
    const hold = (state: ScenarioState, made: LostmirkTable): ScenarioState => {
      const guard = spawn(state, "f3", { zone: "staging" });
      let next = guard.state;
      for (const hero of [made.hero, made.hero2]) next = updateCard(moveCard(next, hero, { zone: "captive", hostId: guard.id }), hero, { guardedHero: true, owner: 0, face: "down" });
      return { ...next, seats: next.seats.map((seat, index) => (index === 0 ? { ...seat, heroes: [] } : seat)) as unknown as ScenarioState["seats"] };
    };
    const fight = lostmirkFight(world, "f0", "f3", {}, { undefended: true, tweak: hold });
    expect(fight.run.state.lost).toBe(false);
    expect(fight.run.state.pendingAttack).toBeNull();
    expect(fight.run.state.seats[0]?.eliminated).toBeFalsy();
    for (const hero of [fight.made.hero, fight.made.hero2]) expect(fight.run.state.cards[hero]).toMatchObject({ zone: "captive", damage: 0 });
  });

  it("advancing from the stage discards each guarded hero to its owner's discard pile (18074:B:3)", () => {
    const first = lostmirkTable(world, { stage: "18074", phase: "Travel", seats: 2, deck: ["f3", "f3", "f3"], staging: [CODES.bareHilltop], spiders: [], orcs: [] });
    const guardA = first.state.encounterDeck[0] ?? "";
    const held = Object.values(first.state.cards).filter((card) => card.code === "dh1" || card.code === "dh3");
    let state = first.state;
    for (const hero of held) state = updateCard(moveCard(state, hero.id, { zone: "captive", hostId: guardA }), hero.id, { guardedHero: true, owner: hero.controller ?? 0, face: "down" });
    state = { ...state, seats: state.seats.map((seat) => ({ ...seat, heroes: seat.heroes.filter((id) => !held.some((hero) => hero.id === id)) })) as unknown as ScenarioState["seats"] };
    const run = finish(send(start(state), { type: "Travel", locationId: idOf(state, CODES.bareHilltop) }, first.ctx), first.ctx);
    expect(stageCode(run)).toBe("18076");
    for (const hero of held) expect(run.state.cards[hero.id]?.zone).toBe("discard");
    expect(run.state.seats[0]?.discard).toContain(held.find((hero) => hero.code === "dh1")?.id);
  });
});

describe("18075 Truly Lost", () => {
  const reveal = (layout: Parameters<typeof lostmirkTable>[1]) => {
    const t = lostmirkTable(world, { stage: "18075", ...layout });
    return { t, run: resolveRecords(t.state, t.ctx, "18075", "whenRevealed", idOf(t.state, "18075")) };
  };
  it("When Revealed: each player discards to a non-objective location and adds it to the staging area, then puts their hand facedown under a different one", () => {
    const { run } = reveal({ seats: 2, deck: ["f0", "place", CODES.bareHilltop, "place", "f0"], hand: ["filler", "event"] });
    // The Objective-Location (Bare Hilltop) is not a non-objective location: it stays in the discard pile.
    expect(codesIn(run.state, "staging")).toEqual(["place", "place"]);
    expect(codesIn(run.state, "encounterDiscard")).toContain(CODES.bareHilltop);
    expect(run.state.seats[0]?.hand).toEqual([]);
    expect(run.state.seats[1]?.hand).toEqual([]);
    const [first, second] = run.state.staging;
    expect(underOf(run.state, first ?? "").map((card) => card.owner)).toEqual([expect.any(Number), expect.any(Number)]);
    expect(new Set(underOf(run.state, first ?? "").map((card) => card.owner)).size).toBe(1);
    expect(new Set(underOf(run.state, second ?? "").map((card) => card.owner)).size).toBe(1);
    expect(underOf(run.state, first ?? "")[0]?.owner).not.toBe(underOf(run.state, second ?? "")[0]?.owner);
    for (const card of underOf(run.state, first ?? "")) expect(card).toMatchObject({ face: "down", controller: null });
  });

  it("a player with an empty hand chooses no location", () => {
    const { run } = reveal({ deck: ["place"] });
    expect(Object.values(run.state.cards).filter((card) => card.zone === "under")).toEqual([]);
  });

  it("Side B: a location gets +1 quest point for each facedown player card under it, an Objective-Location too (18075:B:1)", () => {
    let t = lostmirkTable(world, { stage: "18075", staging: ["place", CODES.bareHilltop] });
    t = { ...t, state: syncConstants(putUnder(putUnder(t.state, idOf(t.state, "place"), "filler", 0, 2), idOf(t.state, CODES.bareHilltop), "event", 0, 1), t.ctx) };
    const place = t.state.cards[idOf(t.state, "place")]!;
    const hilltop = t.state.cards[idOf(t.state, CODES.bareHilltop)]!;
    expect(questPointsOf(t.state, place, t.ctx.cards)).toBe(4);
    expect(questPointsOf(t.state, hilltop, t.ctx.cards)).toBe(5);
    // A card under a location that no player owns (a card of the scenario) is not counted.
    const bare = lostmirkTable(world, { stage: "18075", staging: ["place"] });
    expect(questPointsOf(bare.state, bare.state.cards[idOf(bare.state, "place")]!, bare.ctx.cards)).toBe(2);
  });

  it.each(["staging", "active"] as const)("a location in the %s area with facedown cards under it returns them to their owners' hands when explored (18075:B:2)", (where) => {
    const t = lostmirkTable(world, { stage: "18075", seats: 2, staging: where === "staging" ? ["place"] : [], active: where === "active" ? "place" : undefined });
    const place = idOf(t.state, "place");
    const state = putUnder(putUnder(t.state, place, "filler", 0, 1), place, "event", 1, 1);
    const [mine, theirs] = underOf(state, place).map((card) => card.id);
    const explored = settle(destroyCard(syncConstants(state, t.ctx), place, t.ctx.cards, [], true), t.ctx, []);
    expect(explored.cards[place]?.zone).toBe("encounterDiscard");
    expect(explored.seats[0]?.hand).toContain(mine);
    expect(explored.seats[1]?.hand).toContain(theirs);
    expect(explored.cards[mine ?? ""]).toMatchObject({ zone: "hand", controller: 0 });
    expect(underOf(explored, place)).toEqual([]);
  });

  it("a location without facedown cards under it, or one discarded unexplored, returns nothing", () => {
    const t = lostmirkTable(world, { stage: "18075", staging: ["place"] });
    const place = idOf(t.state, "place");
    const state = putUnder(t.state, place, "filler", 0, 1);
    const discarded = settle(destroyCard(syncConstants(state, t.ctx), place, t.ctx.cards, []), t.ctx, []);
    expect(discarded.seats[0]?.hand).toEqual([]);
    expect(underOf(discarded, place)).toHaveLength(1);
  });

  it("advancing from the stage discards each facedown player card under each location to its owner's discard pile (18075:B:3)", () => {
    const t = lostmirkTable(world, { stage: "18075", phase: "Travel", seats: 2, deck: ["f0", "f0", "f0"], staging: ["place", CODES.abandonedVillage], spiders: [], orcs: [] });
    let state = putUnder(putUnder(t.state, idOf(t.state, "place"), "filler", 0, 2), idOf(t.state, "place"), "event", 1, 1);
    state = syncConstants(state, t.ctx);
    const held = underOf(state, idOf(state, "place")).map((card) => card.id);
    const run = finish(send(start(state), { type: "Travel", locationId: idOf(state, CODES.abandonedVillage) }, t.ctx), t.ctx);
    expect(stageCode(run)).toBe("18077");
    expect(underOf(run.state, idOf(run.state, "place"))).toEqual([]);
    for (const id of held) expect(run.state.cards[id]?.zone).toBe("discard");
    expect(run.state.seats[1]?.discard.filter((id) => held.includes(id))).toHaveLength(1);
  });
});

describe("18076 The Forest of Great Fear", () => {
  const nemesisOf = (state: ScenarioState) => Object.values(state.cards).find((card) => card.nemesis === true);
  const reveal = (layout: Parameters<typeof lostmirkTable>[1], pick?: (state: ScenarioState) => string) => {
    const t = lostmirkTable(world, { stage: "18076", ...layout });
    return { t, run: resolveRecords(t.state, t.ctx, "18076", "whenRevealed", idOf(t.state, "18076"), pick) };
  };
  // A table with the nemesis in play (engaged with the first player, or in the staging area).
  const withNemesis = (layout: Parameters<typeof lostmirkTable>[1] = {}, where: "engaged" | "staging" = "staging") => {
    const t = lostmirkTable(world, { stage: "18076", ...layout, ...(where === "engaged" ? { engaged: [CODES.ungoliantSSpawn] } : { staging: [...(layout.staging ?? []), CODES.ungoliantSSpawn] }) });
    const id = idOf(t.state, CODES.ungoliantSSpawn);
    return { t, id, state: syncConstants(updateCard(t.state, id, { nemesis: true }), t.ctx) };
  };

  it("When Revealed: Searching for a Way Out leaves the game and the enemy with the most hit points of the set that stayed set aside enters the staging area as the nemesis", () => {
    const { run } = reveal({ staging: [CODES.searchingForAWayOut], spiders: [CODES.kingSpider, CODES.ungoliantSSpawn, CODES.hummerhorns], orcs: [] });
    expect(cardsOf(run.state, CODES.searchingForAWayOut)[0]?.zone).toBe("removed");
    const nemesis = nemesisOf(run.state);
    expect(nemesis).toMatchObject({ code: CODES.ungoliantSSpawn, zone: "staging" });
    expect(run.state.piles?.spidersDeck).toHaveLength(2);
  });

  it("searches the Orcs set when that is the one left", () => {
    const { run } = reveal({ orcs: [CODES.dolGuldurOrcs, CODES.chieftanUfthak, CODES.dolGuldurBeastmaster], spiders: [] });
    expect(nemesisOf(run.state)?.code).toBe(CODES.chieftanUfthak);
  });

  it("the first player chooses among enemies tied for the most hit points", () => {
    const { run } = reveal({ spiders: [CODES.kingSpider, CODES.hummerhorns], orcs: [] }, (state) => (state.window?.kind === "choose" ? (state.window.options.at(-1) ?? "") : ""));
    const chosen = nemesisOf(run.state);
    expect(chosen?.code).toBe(CODES.hummerhorns);
    expect(run.state.piles?.spidersDeck).toHaveLength(1);
  });

  it("finds no nemesis when neither set is left", () => {
    const { run } = reveal({ spiders: [], orcs: [] });
    expect(nemesisOf(run.state)).toBeUndefined();
  });

  it("Side B: the nemesis gets +2 Threat, +2 Attack, +2 Defense and is immune to player card effects; no other enemy does", () => {
    const { t, id, state } = withNemesis({ staging: ["f3"] });
    const printed = world.cards.get(CODES.ungoliantSSpawn)!;
    const nemesis = state.cards[id]!;
    expect(modifiedStat(state, nemesis, "threat", t.ctx.cards)).toBe((printed.threat ?? 0) + 2);
    expect(modifiedStat(state, nemesis, "attack", t.ctx.cards)).toBe((printed.attack ?? 0) + 2);
    expect(modifiedStat(state, nemesis, "defense", t.ctx.cards)).toBe((printed.defense ?? 0) + 2);
    expect(flagged(state, id, "immuneToPlayerCards")).toBe(true);
    const other = state.cards[idOf(state, "f3")]!;
    expect(modifiedStat(state, other, "attack", t.ctx.cards)).toBe(1);
    expect(flagged(state, other.id, "immuneToPlayerCards")).toBe(false);
  });

  it("Forced: at the end of the round an engaged nemesis returns to the staging area and attacks the first player", () => {
    const { t, id, state } = withNemesis({}, "engaged");
    expect(state.cards[id]?.zone).toBe("engaged");
    const run = resolveRecords(state, t.ctx, "18076", "forced", idOf(state, "18076"));
    expect(run.state.cards[id]?.zone).toBe("staging");
    expect(run.state.seats[0]?.engaged).not.toContain(id);
    expect(run.state.pendingAttack).toMatchObject({ enemyId: id, seat: 0 });
  });

  it("Forced: a nemesis in the staging area attacks the first player too, and nothing happens without a nemesis", () => {
    const { t, id, state } = withNemesis();
    expect(resolveRecords(state, t.ctx, "18076", "forced", idOf(state, "18076")).state.pendingAttack).toMatchObject({ enemyId: id });
    const none = lostmirkTable(world, { stage: "18076", staging: ["f3"] });
    expect(resolveRecords(none.state, none.ctx, "18076", "forced", idOf(none.state, "18076")).state.pendingAttack).toBeNull();
  });

  it("the stage cannot be defeated while the nemesis is in play", () => {
    const { t, state } = withNemesis({ progress: 8 });
    expect(restricted(state, t.ctx, "advance")).toHaveLength(1);
    const free = lostmirkTable(world, { stage: "18076", progress: 8 });
    expect(restricted(free.state, free.ctx, "advance")).toHaveLength(0);
  });

  it("the nemesis cannot take damage with less than 8 progress on the stage, and can with 8", () => {
    const damage = (progress: number): number => {
      const { t, id, state } = withNemesis({ progress });
      return placeDamage(state, id, 2, t.ctx.cards, [], "combat", UNATTRIBUTED).cards[id]?.damage ?? 0;
    };
    expect(damage(7)).toBe(0);
    expect(damage(8)).toBe(2);
  });

  it("defeating the nemesis wins the game, and a nemesis that left play is nemesis no longer", () => {
    const { t, id, state } = withNemesis({ progress: 8 });
    const killed = settle(placeDamage(state, id, 9, t.ctx.cards, [], "combat", UNATTRIBUTED), t.ctx, []);
    const done = finish({ state: killed, steps: [] }, t.ctx).state;
    expect(done.cards[id]?.zone).toBe("encounterDiscard");
    expect(done.stageCleared).toBe(true);
    expect(done.cards[id]?.nemesis).toBeUndefined();
  });

  it("a nemesis defeated with fewer than 8 progress cannot happen: the damage is not placed, so the game goes on", () => {
    const { t, id, state } = withNemesis({ progress: 3 });
    const hit = settle(placeDamage(state, id, 9, t.ctx.cards, [], "combat", UNATTRIBUTED), t.ctx, []);
    expect(hit.cards[id]?.zone).toBe("staging");
    expect(hit.stageCleared).toBeFalsy();
  });
});

describe("18077 Escape from Taur-nu-fuin", () => {
  it("When Revealed: Searching for a Way Out leaves the game and each player discards to an enemy and puts it into play engaged with them", () => {
    const t = lostmirkTable(world, { stage: "18077", seats: 2, staging: [CODES.searchingForAWayOut], deck: ["place", "f0", "place", "f3"] });
    const run = resolveRecords(t.state, t.ctx, "18077", "whenRevealed", idOf(t.state, "18077"));
    expect(cardsOf(run.state, CODES.searchingForAWayOut)[0]?.zone).toBe("removed");
    expect(run.state.seats[0]?.engaged.map((id) => run.state.cards[id]?.code)).toEqual(["f0"]);
    expect(run.state.seats[1]?.engaged.map((id) => run.state.cards[id]?.code)).toEqual(["f3"]);
    expect(codesIn(run.state, "encounterDiscard")).toEqual(["place", "place"]);
  });

  it("Forced: at the end of the round each player raises their threat by 1 for each enemy engaged with them", () => {
    const t = lostmirkTable(world, { stage: "18077", seats: 2, engaged: [{ code: "f0", seat: 0 }, { code: "f3", seat: 0 }, { code: "f3", seat: 1 }] });
    const run = resolveRecords(t.state, t.ctx, "18077", "forced", idOf(t.state, "18077"));
    expect(threatOf(run.state, 0)).toBe(30);
    expect(threatOf(run.state, 1)).toBe(29);
  });

  it("defeating the stage wins the game", () => {
    const t = lostmirkTable(world, { stage: "18077" });
    const steps: EngineStep[] = [];
    const placed = placeQuestProgress(t.state, 16, t.ctx.cards, steps, () => true, true);
    expect(placed.stageCleared).toBe(true);
  });
});
