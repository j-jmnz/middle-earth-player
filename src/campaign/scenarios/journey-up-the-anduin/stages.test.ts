// Rules: emce.evil-creatures-deck, emce.setup-journey-up-the-anduin, rr.step-3-4, rr.travel, rr.quest-advancement, rr.guarded, rr.explored, rr.campaign-setup-checklist (data/rules/entries.json); ledger lines 18066:A:1 to 18070:A:2.
// The three quest stages of Journey Up the Anduin, Woodmen Village, Haldan and The Old Ford on the scenario's scene.
import { beforeAll, describe, expect, it } from "vitest";

import { restricted, travelBlocked } from "../../../rules/interpret/restrictions.ts";
import { heldAmount, updateCard } from "../../../rules/core/state.ts";
import { moveCard } from "../../../rules/core/zones.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { CODES, finish, idOf, legalIntents, loadUpanduinWorld, resolveRecords, send, start, upanduinTable, type PlayerIntent, type Run, type UpanduinWorld } from "../../../../test/scenarios/journey-up-the-anduin/scene.ts";

let world: UpanduinWorld;
beforeAll(async () => {
  world = await loadUpanduinWorld();
}, 120_000);

const evilCreatureAt = (state: Run["state"], code: string) => {
  const id = idOf(state, code);
  return syncConstants(updateCard(state, id, { deck: "evilCreatures" }), { effects: [], cards: world.cards });
};

describe("18066 Traveling North", () => {
  it("Setup shuffles the Evil Creatures deck and the encounter deck, then discards until one location for each player is discarded and adds each to the staging area", () => {
    const t = upanduinTable(world, { stage: "18066", deck: ["f0", "f0", "place", "f0", "place", "f0"], evilCreatures: [CODES.hillTroll, CODES.wolfRider, CODES.wargs, CODES.marshAdder], seats: 2 });
    const stage = idOf(t.state, "18066");
    const run = resolveRecords(t.state, t.ctx, "18066", "setup", stage);
    expect(run.state.staging.map((id) => run.state.cards[id]?.code)).toEqual(["place", "place"]);
    expect(run.state.encounterDeck.length + run.state.encounterDiscard.length).toBe(4);
    expect(run.state.seedCursor).toBeGreaterThan(t.state.seedCursor);
    // The Evil Creatures deck keeps its four cards, in an order the seed chose.
    expect([...(run.state.piles?.evilCreaturesDeck ?? [])].sort()).toEqual([...(t.state.piles?.evilCreaturesDeck ?? [])].sort());
  });

  it("Setup adds one location with one player", () => {
    const t = upanduinTable(world, { stage: "18066", deck: ["f0", "place", "f0", "place"], evilCreatures: [CODES.hillTroll] });
    const run = resolveRecords(t.state, t.ctx, "18066", "setup", idOf(t.state, "18066"));
    expect(run.state.staging).toHaveLength(1);
  });

  it("places a resource on the stage after progress is placed on it from questing successfully, and none for progress a card places", () => {
    const t = upanduinTable(world, { stage: "18066", phase: "Quest", deck: ["f0", "f0"] });
    let run: Run = start(t.state);
    run = send(run, { type: "Commit", cardIds: [t.hero, t.hero2] } as PlayerIntent, t.ctx);
    run = send(run, { type: "Pass" }, t.ctx);
    run = finish(run, t.ctx);
    const stage = idOf(run.state, "18066");
    expect(run.state.cards[stage]?.progress).toBeGreaterThan(0);
    // The Forced effect resolves where the Response window would be: pass what is offered.
    for (let guard = 0; guard < 6 && run.state.window?.kind !== "pass" && legalIntents(run.state, t.ctx).some((intent) => intent.type === "Pass"); guard += 1) run = send(run, { type: "Pass" }, t.ctx);
    expect(run.state.cards[stage]?.resources).toBe(1);
  });

  it("at the beginning of the encounter phase removes a resource and adds the top Evil Creatures card to the staging area, and adds nothing when no resource could be removed (rr.then)", () => {
    const t = upanduinTable(world, { stage: "18066", phase: "Encounter", evilCreatures: [CODES.hillTroll, CODES.wolfRider] });
    const stage = idOf(t.state, "18066");
    const held = updateCard(t.state, stage, { resources: 1 });
    const one = resolveRecords(held, t.ctx, "18066", "forced", stage);
    expect(one.state.cards[stage]?.resources).toBe(0);
    expect(one.state.staging.map((id) => one.state.cards[id]?.code)).toEqual([CODES.hillTroll]);
    const none = resolveRecords(t.state, t.ctx, "18066", "forced", stage);
    expect(none.state.cards[stage]?.resources).toBe(0);
    expect(none.state.staging).toHaveLength(0);
    expect(none.state.piles?.evilCreaturesDeck).toHaveLength(2);
  });

  it("cannot be defeated while an enemy from the Evil Creatures deck is in play", () => {
    const t = upanduinTable(world, { stage: "18066", staging: [CODES.hillTroll, CODES.goblinSniper] });
    expect(restricted(t.state, t.ctx, "advance")).toHaveLength(0);
    const marked = evilCreatureAt(t.state, CODES.hillTroll);
    expect(restricted(marked, t.ctx, "advance")).toHaveLength(1);
    // An engaged one counts too, and an enemy shuffled into the encounter deck from the pool does not.
    const engaged = moveCard(marked, idOf(marked, CODES.hillTroll), { zone: "engaged", seat: 0 });
    expect(restricted(engaged, t.ctx, "advance")).toHaveLength(1);
  });
});

describe("18067 Woodmen Under Attack", () => {
  it("When Revealed: the first player adds Woodmen Village, and each other player reveals an encounter card", () => {
    const t = upanduinTable(world, { stage: "18067", setAside: [CODES.woodmenVillage], deck: ["f0", "f0", "f0"], seats: 2 });
    const run = resolveRecords(t.state, t.ctx, "18067", "whenRevealed", idOf(t.state, "18067"));
    expect(run.state.staging.map((id) => run.state.cards[id]?.code).sort()).toEqual(["f0", CODES.woodmenVillage].sort());
  });

  it("When Revealed, alone: only Woodmen Village is added", () => {
    const t = upanduinTable(world, { stage: "18067", setAside: [CODES.woodmenVillage], deck: ["f0", "f0"] });
    const run = resolveRecords(t.state, t.ctx, "18067", "whenRevealed", idOf(t.state, "18067"));
    expect(run.state.staging.map((id) => run.state.cards[id]?.code)).toEqual([CODES.woodmenVillage]);
  });

  it("allows no more than 1 progress on each location in the staging area each round", () => {
    const t = upanduinTable(world, { stage: "18067", staging: [CODES.lonelyLands, CODES.banksOfTheAnduin] });
    const lands = idOf(t.state, CODES.lonelyLands);
    expect(heldAmount(t.state, lands, "progressCap")).toBe(1);
    expect(heldAmount(t.state, idOf(t.state, CODES.banksOfTheAnduin), "progressCap")).toBe(1);
  });

  it("adds the top Evil Creatures card to the staging area after the players travel to a location", () => {
    const t = upanduinTable(world, { stage: "18067", phase: "Travel", staging: [CODES.banksOfTheAnduin], evilCreatures: [CODES.hillTroll, CODES.wolfRider] });
    const banks = idOf(t.state, CODES.banksOfTheAnduin);
    let run: Run = send(start(t.state), { type: "Travel", locationId: banks }, t.ctx);
    run = finish(run, t.ctx);
    for (let guard = 0; guard < 6 && run.state.cards[idOf(run.state, CODES.hillTroll)]?.zone !== "staging" && legalIntents(run.state, t.ctx).some((intent) => intent.type === "Pass"); guard += 1) run = send(run, { type: "Pass" }, t.ctx);
    expect(run.state.activeLocation).toBe(banks);
    expect(run.state.cards[idOf(run.state, CODES.hillTroll)]?.zone).toBe("staging");
  });

  it("cannot be defeated unless the first player controls Haldan", () => {
    const t = upanduinTable(world, { stage: "18067", progress: 0 });
    expect(restricted(t.state, t.ctx, "advance")).toHaveLength(1);
    const haldan = upanduinTable(world, { stage: "18067", play: [CODES.haldan] });
    expect(restricted(haldan.state, haldan.ctx, "advance")).toHaveLength(0);
  });
});

describe("18068 The Passage of the Ford", () => {
  it("When Revealed: the first player adds The Old Ford and each other player adds the top Evil Creatures card to the staging area", () => {
    const t = upanduinTable(world, { stage: "18068", setAside: [CODES.theOldFord], evilCreatures: [CODES.hillTroll, CODES.wolfRider, CODES.wargs], seats: 2 });
    const run = resolveRecords(t.state, t.ctx, "18068", "whenRevealed", idOf(t.state, "18068"));
    expect(run.state.staging.map((id) => run.state.cards[id]?.code).sort()).toEqual([CODES.hillTroll, CODES.theOldFord].sort());
  });

  it("bars travel to The Old Ford, and only to it, until there are 5 progress on the stage", () => {
    const early = upanduinTable(world, { stage: "18068", progress: 4, staging: [CODES.theOldFord, CODES.banksOfTheAnduin] });
    expect(travelBlocked(early.state, early.ctx, idOf(early.state, CODES.theOldFord))).toBe(true);
    expect(travelBlocked(early.state, early.ctx, idOf(early.state, CODES.banksOfTheAnduin))).toBe(false);
    const ready = upanduinTable(world, { stage: "18068", progress: 5, staging: [CODES.theOldFord] });
    expect(travelBlocked(ready.state, ready.ctx, idOf(ready.state, CODES.theOldFord))).toBe(false);
  });

  it("adds the top Evil Creatures card to the staging area at the beginning of each quest phase", () => {
    const t = upanduinTable(world, { stage: "18068", evilCreatures: [CODES.hillTroll] });
    const run = resolveRecords(t.state, t.ctx, "18068", "forced", idOf(t.state, "18068"));
    expect(run.state.staging.map((id) => run.state.cards[id]?.code)).toEqual([CODES.hillTroll]);
  });

  it("cannot be defeated while The Old Ford is in play, and the players win when it is explored", () => {
    const t = upanduinTable(world, { stage: "18068", staging: [CODES.theOldFord] });
    expect(restricted(t.state, t.ctx, "advance")).toHaveLength(1);
    expect(restricted(upanduinTable(world, { stage: "18068" }).state, t.ctx, "advance")).toHaveLength(0);
    // The Old Ford is the active location, with 1 progress; the quest (4 Willpower against nothing in the staging area) explores it.
    const quest = upanduinTable(world, { stage: "18068", phase: "Quest", active: CODES.theOldFord });
    const ford = idOf(quest.state, CODES.theOldFord);
    let run: Run = start(updateCard(quest.state, ford, { progress: 1 }));
    run = send(run, { type: "Commit", cardIds: [quest.hero, quest.hero2] } as PlayerIntent, quest.ctx);
    run = finish(send(run, { type: "Pass" }, quest.ctx), quest.ctx);
    expect(run.state.stageCleared).toBe(true);
    expect(run.state.lost).toBe(false);
  });
});

// Woodmen Village is the active location with 3 of its 4 quest points; the two heroes quest and explore it. The choices it opens are answered with the first option.
function exploreVillage(layout: Parameters<typeof upanduinTable>[1]): { run: Run; t: ReturnType<typeof upanduinTable>; village: string } {
  const t = upanduinTable(world, { phase: "Quest", active: CODES.woodmenVillage, ...layout });
  const village = idOf(t.state, CODES.woodmenVillage);
  let run: Run = start(updateCard(t.state, village, { progress: 3 }));
  run = send(run, { type: "Commit", cardIds: [t.hero, t.hero2] } as PlayerIntent, t.ctx);
  run = finish(send(run, { type: "Pass" }, t.ctx), t.ctx);
  return { run, t, village };
}

describe("18069 Woodmen Village and 18070 Haldan", () => {
  it("explored, adds the top Evil Creatures card to the staging area and flips over to Haldan, attached to it as a guarded objective", () => {
    const { run, village } = exploreVillage({ evilCreatures: [CODES.hillTroll] });
    const troll = idOf(run.state, CODES.hillTroll);
    expect(run.state.cards[troll]?.zone).toBe("staging");
    expect(run.state.cards[village]).toMatchObject({ code: CODES.haldan, zone: "staging", other: CODES.woodmenVillage });
    // The enemy is attached to Haldan as the guard of the objective (rr.guarded).
    expect(run.state.cards[village]?.attachments).toContain(troll);
    expect(run.state.cards[troll]).toMatchObject({ host: village, guard: true });
  });

  it("flips over to an unguarded Haldan, which the first player controls at once, when the Evil Creatures deck and its discard pile are empty", () => {
    const { run, village } = exploreVillage({ evilCreatures: [] });
    expect(run.state.cards[village]).toMatchObject({ code: CODES.haldan, zone: "play", controller: 0, host: null });
  });

  it("is controlled by the first player once free of encounters, and not while a guard holds him", () => {
    const { run, t, village } = exploreVillage({ evilCreatures: [CODES.hillTroll] });
    const settled = settle({ ...run.state }, t.ctx, []);
    expect(settled.cards[village]?.controller ?? null).toBeNull();
    const troll = idOf(settled, CODES.hillTroll);
    const freed = settle(moveCard(settled, troll, { zone: "encounterDiscard" }), t.ctx, []);
    expect(freed.cards[village]).toMatchObject({ controller: freed.firstPlayer });
    expect(freed.cards[village]?.zone).toBe("play");
  });

  it("does not exhaust to quest while there is an active location", () => {
    const withActive = upanduinTable(world, { play: [CODES.haldan], active: CODES.banksOfTheAnduin });
    expect(heldAmount(withActive.state, idOf(withActive.state, CODES.haldan), "noExhaustQuest")).toBe(1);
    const without = upanduinTable(world, { play: [CODES.haldan] });
    expect(heldAmount(without.state, idOf(without.state, CODES.haldan), "noExhaustQuest")).toBe(0);
  });
});
