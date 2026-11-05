// Rules: dcce.from-sea-to-land, dcce.corsair-deck, dcce.ship-objectives, dcce.indestructible, rr.victory, rr.destroy, rr.search (data/rules/entries.json).
// From Sea to Land (ledger lines 12148:A:1 and 12148:B:1): the ships leave, the first encounter deck and its discard pile are set aside, and the second encounter deck, with the Corsair deck and the cards the stage's search
// carries across, becomes the active one. The verbs SetAsideEncounterDeck and DiscardAllInPlay, the amount damageOn, and the stages 12147 to 12150 that use them, each read from its record on the table of the scenario
// (test/scenarios/the-city-of-corsairs/scene.ts).
import { beforeAll, describe, expect, it } from "vitest";

import { CODES, corsairsTable, finish, idOf, idsOf, loadCorsairsWorld, resolveRecords, type CorsairsLayout, type CorsairsWorld } from "../../../../test/scenarios/the-city-of-corsairs/scene.ts";
import type { ScenarioState } from "../../core/state.ts";
import { updateCard } from "../../core/state.ts";
import { frameScope, resolveAmount } from "../../interpret/amounts.ts";
import { settle } from "../../engine/machine.ts";
import { ruleCause } from "../../core/cause.ts";
import { placeDamage } from "../../core/keywords.ts";
import { runInstruction } from "../../interpret/interpret.ts";
import type { EngineStep } from "../../core/intents.ts";
import { syncConstants } from "../../interpret/constants.ts";
import { moveCard, spawn } from "../../core/zones.ts";
import { stampRoutes } from "./routes.ts";
import { discardAllInPlay, setAsideEncounterDeck } from "./swap.ts";

// The Campaign Mode printings the campaign game deals for the Dream-chaser and the Dawn Star (the scenario's `reprints`).
const DREAM_CHASER = "110136";
const DAWN_STAR = "110137";
let world: CorsairsWorld;
beforeAll(async () => {
  world = await loadCorsairsWorld();
});

type Table = ReturnType<typeof corsairsTable>;
// The table with the sea family's routes stamped, as a dealt game has them (a non-ship enemy discarded goes to the Corsair discard pile while a Corsair deck exists).
const make = (layout: CorsairsLayout = {}): Table => {
  const made = corsairsTable(world, layout);
  return { ...made, state: stampRoutes(made.state, made.ctx.cards) };
};
// The quest stage in play, the encounter card whose effect a verb run by a test is.
const stageOf = (state: ScenarioState): string => state.questStage ?? "";
const zoneOf = (state: ScenarioState, code: string, at = 0): string => state.cards[idsOf(state, code)[at] ?? ""]?.zone ?? "none";
const codesAt = (state: ScenarioState, ids: readonly string[]): string[] => ids.map((id) => state.cards[id]?.code ?? "?").sort();
// The Corsair deck and its discard pile exist, as the stage 1 Setup leaves them; `deck` and `discard` are codes.
function withCorsair(made: Table, deck: readonly string[], discard: readonly string[] = []): Table {
  let state: ScenarioState = { ...made.state, corsairDeck: [], corsairDiscard: [] };
  for (const code of deck) state = spawn(state, code, { zone: "corsairDeck" }, "down").state;
  for (const code of discard) state = spawn(state, code, { zone: "corsairDiscard" }).state;
  return { ...made, state };
}

describe("SetAsideEncounterDeck (12148:B:1, dcce.from-sea-to-land)", () => {
  const carry = { verb: "SetAsideEncounterDeck" as const, carry: [CODES.watchTower, CODES.battleHardened] };

  it("sets the deck and the discard pile aside facedown, but for the carried copies, which end in the deck", () => {
    const made = make({ deck: [CODES.lightCruiser, CODES.watchTower, CODES.waterspout], discard: [CODES.battleHardened, CODES.watchTower, CODES.suddenStorms] });
    const next = setAsideEncounterDeck(made.state, carry);
    expect(codesAt(next, next.encounterDeck)).toEqual([CODES.battleHardened, CODES.watchTower, CODES.watchTower]);
    expect(next.encounterDiscard).toEqual([]);
    expect(codesAt(next, next.setAside)).toEqual([CODES.lightCruiser, CODES.suddenStorms, CODES.waterspout].sort());
    for (const id of next.setAside) expect(next.cards[id]?.face).toBe("down");
    for (const id of next.encounterDeck) expect(next.cards[id]?.zone).toBe("encounterDeck");
  });

  it("leaves a copy of Watch Tower in play where it is", () => {
    const made = make({ deck: [CODES.lightCruiser], staging: [CODES.watchTower], discard: [CODES.watchTower] });
    const next = setAsideEncounterDeck(made.state, carry);
    const inPlay = idsOf(next, CODES.watchTower).map((id) => next.cards[id]?.zone).sort();
    expect(inPlay).toEqual(["encounterDeck", "staging"]);
  });

  it("with nothing to carry sets the whole deck and discard pile aside, and leaves the second deck and the Corsair piles alone", () => {
    const made = withCorsair(make({ deck: [CODES.lightCruiser], discard: [CODES.waterspout], setAside: [CODES.streetsOfUmbar] }), [CODES.umbarRaider]);
    const next = setAsideEncounterDeck(made.state, { verb: "SetAsideEncounterDeck" });
    expect(next.encounterDeck).toEqual([]);
    expect(next.encounterDiscard).toEqual([]);
    expect(zoneOf(next, CODES.streetsOfUmbar)).toBe("setAside");
    expect(next.corsairDeck?.length).toBe(1);
    expect(codesAt(next, next.setAside)).toContain(CODES.lightCruiser);
  });
});

describe("DiscardAllInPlay (12148:A:1, rr.victory, rr.destroy)", () => {
  const ships = { verb: "DiscardAllInPlay", pick: { type: "enemy", control: "any", staging: true, trait: "Ship" } } as const;

  it("discards a Victory enemy to the encounter discard pile, not the victory display, and clears its tokens", () => {
    const made = make({ staging: [{ code: CODES.stormcaller, damage: 4, resources: 1 }, CODES.lightCruiser, CODES.umbarRaider] });
    const next = discardAllInPlay(made.state, ships, { seat: 0, sourceId: stageOf(made.state) }, made.ctx, []);
    expect(zoneOf(next, CODES.stormcaller)).toBe("encounterDiscard");
    expect(zoneOf(next, CODES.lightCruiser)).toBe("encounterDiscard");
    expect(zoneOf(next, CODES.umbarRaider)).toBe("staging");
    expect(next.victory).toEqual([]);
    const gone = next.cards[idOf(next, CODES.stormcaller)];
    expect([gone?.damage, gone?.resources]).toEqual([0, 0]);
  });

  it("discards Ship objectives a player controls, the Dream-chaser among them, without losing the game (it is discarded, not destroyed)", () => {
    const made = make({ play: [DREAM_CHASER, DAWN_STAR] });
    const next = discardAllInPlay(made.state, { verb: "DiscardAllInPlay", pick: { type: "character", control: "any", trait: "Ship" } }, { seat: 0, sourceId: stageOf(made.state) }, made.ctx, []);
    expect(zoneOf(next, DREAM_CHASER)).toBe("encounterDiscard");
    expect(zoneOf(next, DAWN_STAR)).toBe("encounterDiscard");
    expect(next.lost).toBe(false);
  });

  it("discards Ocean locations in the staging area and the active location, and no other location", () => {
    const made = make({ staging: [CODES.waterspout, CODES.watchTower] });
    const active = moveCard(made.state, idOf(made.state, CODES.waterspout), { zone: "activeLocation" });
    const withActive = { ...active, activeLocation: idOf(active, CODES.waterspout) };
    const staged = (code: string): ScenarioState => {
      const spawned = spawn(withActive, code, { zone: "staging" });
      return spawned.state;
    };
    const state = staged(CODES.roughWaters);
    const next = discardAllInPlay(state, { verb: "DiscardAllInPlay", pick: { type: "location", control: "any", trait: "Ocean" } }, { seat: 0, sourceId: stageOf(made.state) }, made.ctx, []);
    expect(zoneOf(next, CODES.waterspout)).toBe("encounterDiscard");
    expect(zoneOf(next, CODES.roughWaters)).toBe("encounterDiscard");
    expect(zoneOf(next, CODES.watchTower)).toBe("staging");
    expect(next.activeLocation).toBeNull();
  });

  it("sends a non-ship enemy to the Corsair discard pile while a Corsair deck exists (dcce.corsair-deck)", () => {
    const made = withCorsair(make({ staging: [CODES.umbarRaider] }), []);
    const next = discardAllInPlay(made.state, { verb: "DiscardAllInPlay", pick: { type: "enemy", control: "any", staging: true } }, { seat: 0, sourceId: stageOf(made.state) }, made.ctx, []);
    expect(zoneOf(next, CODES.umbarRaider)).toBe("corsairDiscard");
  });
});

describe("the damageOn amount (12148:A:1)", () => {
  it("adds up the damage tokens on the cards that match, for the seat asking", () => {
    const made = make({ seats: 2, play: [DREAM_CHASER] });
    const mine = idOf(made.state, DREAM_CHASER);
    const theirs = spawn(made.state, DAWN_STAR, { zone: "play", seat: 1 });
    const state = updateCard(updateCard(theirs.state, mine, { damage: 3 }), theirs.id, { damage: 5 });
    const ship = { type: "character", control: "you", trait: "Ship" } as const;
    expect(resolveAmount(state, { damageOn: ship }, frameScope(state, 0, null), made.ctx)).toBe(3);
    expect(resolveAmount(state, { damageOn: ship }, frameScope(state, 1, null), made.ctx)).toBe(5);
    expect(resolveAmount(state, { damageOn: { ...ship, control: "any" } }, frameScope(state, 0, null), made.ctx)).toBe(8);
    expect(resolveAmount(state, { damageOn: ship, times: 2, plus: 1 }, frameScope(state, 0, null), made.ctx)).toBe(7);
  });
});

// The table with a Heading card set to `heading`, as a prepared fleet leaves it.
const heading = (made: Table, at: "Sun" | "Cloud" | "Rain" | "Storm"): Table => ({ ...made, state: syncConstants({ ...made.state, sea: { heading: at, headingCard: null, routes: made.state.sea?.routes ?? {} } }, made.ctx) });
const answerFirst = (state: ScenarioState): string => (state.window?.kind === "choose" ? (state.window.options[0] ?? "") : "");
// The stage's records of this id left out of the table's effects, so a test runs one record of a stage without the rest.
const without = (made: Table, ...ids: readonly string[]): Table => ({ ...made, ctx: { ...made.ctx, effects: made.ctx.effects.filter((effect) => !ids.includes(effect.id)) } });
const stageCode = (state: ScenarioState): string | undefined => state.cards[state.questStage ?? ""]?.code;

describe("12147 The Coast of Umbar", () => {
  it("12147:A:1 prepares the Corsair deck and the fleet and shuffles the encounter deck", () => {
    const made = make({ stage: "12147", deck: [CODES.lightCruiser, CODES.umbarRaider, CODES.waterspout], setAside: [DREAM_CHASER, DAWN_STAR, CODES.navigation] });
    const done = resolveRecords(made.state, made.ctx, CODES.stage1, "setup", idOf(made.state, CODES.stage1), answerFirst);
    expect(codesAt(done.state, done.state.corsairDeck ?? [])).toEqual([CODES.umbarRaider]);
    expect(idsOf(done.state, DREAM_CHASER).some((id) => done.state.cards[id]?.zone === "play")).toBe(true);
    expect(done.state.seedCursor).toBeGreaterThan(made.state.seedCursor);
  });

  it("12147:B:2 puts no progress on the stage off-course, and all of it on-course", () => {
    const place = (at: "Sun" | "Cloud" | "Rain" | "Storm"): number | undefined => {
      const made = heading(make({ stage: "12147" }), at);
      const next = runInstruction({ ...made.state, window: null }, { verb: "ProgressQuest", amount: 3 }, { seat: 0, sourceId: made.state.questStage }, made.ctx, []);
      return settle(syncConstants(next, made.ctx), made.ctx, []).cards[made.state.questStage ?? ""]?.progress;
    };
    expect(place("Sun")).toBe(3);
    for (const at of ["Cloud", "Rain", "Storm"] as const) expect(place(at), at).toBe(0);
  });

  it("12147:B:3 advances to stage 2 at 15 progress (the stage's quest points), and when the Stormcaller is destroyed", () => {
    const full = make({ stage: "12147", progress: 12 });
    const ofProgress = settle(syncConstants(runInstruction({ ...full.state, window: null }, { verb: "ProgressQuest", amount: 3 }, { seat: 0, sourceId: full.state.questStage }, full.ctx, []), full.ctx), full.ctx, []);
    expect(stageCode(ofProgress)).not.toBe(CODES.stage1);
    // Only the destroyed Stormcaller's record is read: the first stage is left to advance to stage 2 and stop there.
    const made = without(make({ stage: "12147", engaged: [{ code: CODES.stormcaller, seat: 0, damage: 17 }], phase: "Combat" }), "12148:whenRevealed:1", "12148:whenRevealed:2");
    const enemy = idOf(made.state, CODES.stormcaller);
    const steps: EngineStep[] = [];
    const hit = placeDamage(made.state, enemy, 1, made.ctx.cards, steps, "combat", ruleCause("rr.damage"));
    const done = finish({ state: settle({ ...hit, window: null }, made.ctx, steps), steps }, made.ctx);
    expect(done.state.cards[enemy]?.zone).toBe("victory");
    expect(stageCode(done.state)).toBe(CODES.stage2);
  });
});

// A table at stage 2: two Ship objectives with damage, the Stormcaller and an Ocean location in play, the Raider and a Watch Tower in play too, the first deck with its discard pile, the second deck set aside, the Corsair piles.
function atStage2(extra: CorsairsLayout = {}): Table {
  const made = make({
    stage: "12148",
    play: [DREAM_CHASER, DAWN_STAR],
    staging: [CODES.stormcaller, CODES.waterspout, CODES.watchTower, CODES.umbarRaider],
    deck: [CODES.lightCruiser, CODES.watchTower, CODES.suddenStorms],
    discard: [CODES.battleHardened, CODES.watchTower, CODES.serpentSTail],
    setAside: [CODES.captainSahir, "110129", CODES.streetsOfUmbar, CODES.streetsOfUmbar, CODES.furyAndMalice],
    ...extra,
  });
  const hurt = [DREAM_CHASER, DAWN_STAR].reduce((state, code, at) => updateCard(state, idOf(state, code), { damage: at === 0 ? 2 : 1 }), made.state);
  return withCorsair({ ...made, state: hurt }, [CODES.umbarSlaver, CODES.corsairInfiltrator], [CODES.raidLeader]);
}

describe("12148 Fate of the Dream-chaser, A side (12148:A:1)", () => {
  it("assigns damage among the non-Ship characters equal to the damage on the Ship objectives, then discards the ships and the Ocean locations", () => {
    const made = without(atStage2(), "12148:whenRevealed:2");
    const done = resolveRecords(made.state, made.ctx, CODES.stage2, "whenRevealed", idOf(made.state, CODES.stage2), answerFirst);
    const heroes = [made.hero, made.hero2].map((id) => done.state.cards[id]?.damage ?? 0);
    expect(heroes[0]! + heroes[1]!).toBe(3);
    for (const code of [DREAM_CHASER, DAWN_STAR, CODES.stormcaller, CODES.waterspout]) expect(zoneOf(done.state, code), code).toBe("encounterDiscard");
    expect(done.state.victory).toEqual([]);
    expect(zoneOf(done.state, CODES.watchTower, 2)).toBe("staging");
    expect(zoneOf(done.state, CODES.umbarRaider)).toBe("staging");
    expect(done.state.lost).toBe(false);
  });

  it("each player assigns the damage of the ships they control, and only among their own characters", () => {
    const made = without(atStage2({ seats: 2 }), "12148:whenRevealed:2");
    const theirs = spawn(made.state, "110138", { zone: "play", seat: 1 });
    const state = updateCard(theirs.state, theirs.id, { damage: 4 });
    const done = resolveRecords(state, made.ctx, CODES.stage2, "whenRevealed", idOf(state, CODES.stage2), answerFirst);
    const taken = (id: string | null): number => done.state.cards[id ?? ""]?.damage ?? 0;
    expect(taken(made.hero) + taken(made.hero2)).toBe(3);
    expect(taken(made.seat1Hero)).toBe(4);
  });
});

describe("12148 Fate of the Dream-chaser, B side (12148:B:1, dcce.from-sea-to-land)", () => {
  // The B record's instructions, but for the advance, run in order.
  function swap(made: Table): ScenarioState {
    const record = made.ctx.effects.find((effect) => effect.id === "12148:whenRevealed:2");
    expect(record?.lines).toEqual(["12148:B:1"]);
    let state = made.state;
    for (const instruction of (record?.instructions ?? []).filter((item) => item.verb !== "AdvanceStage")) state = runInstruction(state, instruction, { seat: 0, sourceId: stageOf(state) }, made.ctx, []);
    return state;
  }

  it("makes the second deck, the Corsair piles and the carried copies the encounter deck, and sets the first deck and discard pile aside", () => {
    const made = atStage2();
    const state = swap(made);
    expect(codesAt(state, state.encounterDeck)).toEqual(
      [CODES.watchTower, CODES.watchTower, CODES.battleHardened, CODES.captainSahir, "110129", CODES.streetsOfUmbar, CODES.streetsOfUmbar, CODES.furyAndMalice, CODES.umbarSlaver, CODES.corsairInfiltrator, CODES.raidLeader].sort(),
    );
    expect(state.encounterDiscard).toEqual([]);
    // (The first stage, 12147, was set aside when the quest advanced past it.)
    expect(codesAt(state, state.setAside).filter((code) => code !== CODES.stage1)).toEqual([CODES.lightCruiser, CODES.suddenStorms, CODES.serpentSTail].sort());
    expect(state.corsairDeck).toBeUndefined();
    expect(state.corsairDiscard).toBeUndefined();
    expect(zoneOf(state, CODES.watchTower, 2)).toBe("staging");
    expect(state.seedCursor).toBeGreaterThan(made.state.seedCursor);
  });

  it("afterwards a non-ship enemy is discarded to the encounter discard pile, the Corsair deck being gone", () => {
    const state = swap(atStage2());
    const raider = idOf(state, CODES.umbarRaider);
    expect(moveCard(state, raider, { zone: "encounterDiscard" }).cards[raider]?.zone).toBe("encounterDiscard");
  });

  it("in Easy Mode, where the dealt deck has no Battle-hardened, carries the Watch Towers alone", () => {
    const made = atStage2({ discard: [CODES.watchTower] });
    const state = swap(made);
    expect(codesAt(state, state.encounterDeck).filter((code) => code === CODES.battleHardened)).toEqual([]);
    expect(codesAt(state, state.encounterDeck).filter((code) => code === CODES.watchTower)).toHaveLength(2);
  });
});

// The resources on each Raider enemy in the staging area (the Raider trait is on the Umbar Raider and the Umbar Slaver).
const raiderResources = (state: ScenarioState): number[] => state.staging.map((id) => state.cards[id]).filter((card) => card?.code === CODES.umbarRaider || card?.code === CODES.umbarSlaver).map((card) => card?.resources ?? 0);

describe("the stages 2 and 3 end to end (12148:A:1, 12148:B:1, 12149:A:1)", () => {
  it("swaps the decks, advances to stage 3, sets Captain Sahir and the Monument aside and adds each player's enemy and location to the staging area", () => {
    const made = atStage2();
    const done = resolveRecords(made.state, made.ctx, CODES.stage2, "whenRevealed", idOf(made.state, CODES.stage2), answerFirst);
    expect(stageCode(done.state)).toBe(CODES.stage3);
    expect(zoneOf(done.state, CODES.captainSahir)).toBe("setAside");
    expect(zoneOf(done.state, "110129")).toBe("setAside");
    const staged = codesAt(done.state, done.state.staging);
    expect(staged.filter((code) => code === CODES.watchTower).length).toBeGreaterThanOrEqual(1);
    // The Stormcaller and the Ocean location left; one enemy and one location came from the second deck for the one player; the Raider and the Watch Tower stayed.
    expect(done.state.staging.length).toBe(made.state.staging.length - 2 + 2);
    // The Stormcaller was discarded, not destroyed, so each Raider enemy in play has a resource.
    expect(raiderResources(done.state).length).toBeGreaterThan(0);
    expect(raiderResources(done.state).every((resources) => resources === 1)).toBe(true);
  });

  it("12149:A:1 adds no resource to the Raiders when the Stormcaller was destroyed at stage 1", () => {
    const made = atStage2({ victory: [CODES.stormcaller] });
    const done = resolveRecords(made.state, made.ctx, CODES.stage2, "whenRevealed", idOf(made.state, CODES.stage2), answerFirst);
    expect(raiderResources(done.state).length).toBeGreaterThan(0);
    expect(raiderResources(done.state).every((resources) => resources === 0)).toBe(true);
  });
});

// A table at stage 4: Captain Sahir engaged with the first player with `sahir` tokens, and the layout's other cards.
function atStage4(sahir: { damage?: number; resources?: number } = {}, extra: CorsairsLayout = {}): Table {
  return make({ stage: "12150", phase: "Combat", engaged: [{ code: CODES.captainSahir, seat: 0, ...sahir }], ...extra });
}
// Damage on a card until it is destroyed, with the Forced and triggered effects that answer it settled.
function hit(made: Table, id: string, amount: number): ScenarioState {
  const steps: EngineStep[] = [];
  const hurt = placeDamage(made.state, id, amount, made.ctx.cards, steps, "combat", ruleCause("rr.damage"));
  return finish({ state: settle({ ...hurt, window: null }, made.ctx, steps), steps }, made.ctx).state;
}

describe("12150 Final Confrontation, A side (12150:A:1)", () => {
  it("adds the Monument to the staging area, puts Captain Sahir into play engaged with the first player, searches an enemy for each player, shuffles, and gives each Raider a resource", () => {
    const made = make({ stage: "12150", seats: 2, deck: [CODES.umbarSlaver, CODES.umbarRaider, CODES.furyAndMalice, CODES.lightCruiser], setAside: [CODES.captainSahir, "110129"], staging: [CODES.umbarRaider] });
    const done = resolveRecords(made.state, made.ctx, CODES.stage4, "whenRevealed", idOf(made.state, CODES.stage4), answerFirst);
    expect(zoneOf(done.state, "110129")).toBe("staging");
    const sahir = done.state.cards[idOf(done.state, CODES.captainSahir)];
    expect([sahir?.zone, sahir?.controller]).toEqual(["engaged", made.state.firstPlayer]);
    // Two enemies were searched out for the two players: one each, besides the Raider already there.
    expect(done.state.staging.filter((id) => ["enemy"].includes(world.cards.get(done.state.cards[id]?.code ?? "")?.type ?? "")).length).toBe(3);
    expect(done.state.seedCursor).toBeGreaterThan(made.state.seedCursor);
    // Every Raider in play has a resource, Captain Sahir (a Raider) too.
    expect(sahir?.resources).toBe(1);
    expect(raiderResources(done.state).length).toBeGreaterThan(1);
    expect(raiderResources(done.state).every((resources) => resources === 1)).toBe(true);
  });
});

describe("12150 Final Confrontation, B side (12150:B:1 to B:3)", () => {
  it("12150:B:1 makes Captain Sahir indestructible while any enemy has resources, and not otherwise", () => {
    const sahirId = (state: ScenarioState): string => idOf(state, CODES.captainSahir);
    const guarded = atStage4({ damage: 7 }, { staging: [{ code: CODES.umbarRaider, resources: 1 }] });
    const survives = hit(guarded, sahirId(guarded.state), 3);
    expect(survives.cards[sahirId(survives)]?.zone).toBe("engaged");
    expect(survives.stageCleared).toBe(false);
    const bare = atStage4({ damage: 7 });
    expect(hit(bare, sahirId(bare.state), 1).cards[sahirId(bare.state)]?.zone).toBe("victory");
    // His own resources count: any enemy.
    const own = atStage4({ damage: 7, resources: 1 });
    expect(hit(own, sahirId(own.state), 1).cards[sahirId(own.state)]?.zone).toBe("engaged");
  });

  it("12150:B:2 adds the resources of a destroyed enemy to Captain Sahir", () => {
    const made = atStage4({}, { engaged: [{ code: CODES.captainSahir, seat: 0 }, { code: CODES.umbarRaider, seat: 0, damage: 2, resources: 3 }] });
    const raider = idOf(made.state, CODES.umbarRaider);
    const done = hit(made, raider, 9);
    expect(done.cards[raider]?.zone).not.toBe("engaged");
    expect(done.cards[idOf(done, CODES.captainSahir)]?.resources).toBe(3);
  });

  it("12150:B:2 adds the resources of a destroyed hero to Captain Sahir", () => {
    const made = atStage4();
    const withPool = updateCard(made.state, made.hero, { resources: 4 });
    const done = hit({ ...made, state: withPool }, made.hero, 99);
    expect(done.cards[made.hero]?.zone).toBe("discard");
    expect(done.cards[idOf(done, CODES.captainSahir)]?.resources).toBe(4);
  });

  it("12150:B:3 wins the game when Captain Sahir is destroyed", () => {
    const made = atStage4({ damage: 7 });
    const done = hit(made, idOf(made.state, CODES.captainSahir), 1);
    expect(done.stageCleared).toBe(true);
    expect(done.lost).toBe(false);
  });
});
