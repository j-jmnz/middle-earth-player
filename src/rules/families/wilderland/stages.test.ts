// Rules: rr.player-elimination, rr.explored, rr.hit-points, rr.ownership-and-control, rr.step-3-4 (data/rules/entries.json); ledger lines 18074:A:1 to 18076:B:2, 12169:A:2.
// The verbs and engine hooks of Lost in Mirkwood's stages 3 and 4 on fixture cards: a hero held by an enemy (CarryAwayHero, ReleaseGuardedHero, DiscardGuardedHeroes, the elimination guard), a hand under a location (PlaceHandUnderLocation,
// ReturnFacedownToHands, DiscardFacedownUnder), the nemesis (SearchNemesis, NemesisAttacks, the settle sweep), the pick fields, the stage a jump leaves and the failed quest the condition reads.
import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { definePrinted } from "../../core/printed.ts";
import { eliminateEmpties } from "../../core/keywords.ts";
import { updateCard, type ScenarioState } from "../../core/state.ts";
import { moveCard, playerCardsUnder, spawn } from "../../core/zones.ts";
import { noteEvent } from "../costs/pay.ts";
import { pushEffectFrame } from "../../interpret/effect-frames.ts";
import { holds } from "../../interpret/conditions.ts";
import { matchesPick } from "../../interpret/pick.ts";
import { defeatedBefore, noteSkippedStage } from "../quest/branch.ts";
import { carryAwayHero, discardGuardedHeroes, heroGuardedBy, releaseGuardedHero } from "./carried.ts";
import { discardFacedownUnder, placeHandUnderLocation, returnFacedownToHands } from "./lost.ts";
import { clearNemesis, nemesisAttacks, searchNemesis } from "./nemesis.ts";
import { CARDS, ctxOf, deal, table } from "./fixture.ts";

const cards = new Map(CARDS);
cards.set("path", definePrinted({ code: "path", name: "Path", type: "objective", questPoints: 4, objectiveLocation: true }));
cards.set("big", definePrinted({ code: "big", name: "Big Spider", type: "enemy", threat: 3, engagementCost: 30, attack: 3, defense: 2, health: 9, encounterSet: "Spiders of Mirkwood" }));
cards.set("small", definePrinted({ code: "small", name: "Small Spider", type: "enemy", threat: 1, engagementCost: 10, attack: 1, defense: 1, health: 3, encounterSet: "Spiders of Mirkwood" }));
cards.set("twin", definePrinted({ code: "twin", name: "Twin Spider", type: "enemy", threat: 1, engagementCost: 10, attack: 1, defense: 1, health: 9, encounterSet: "Spiders of Mirkwood" }));
cards.set("12169", definePrinted({ code: "12169", name: "Melanwar", type: "ally", sphere: "neutral", cost: 2, willpower: 1, attack: 1, defense: 1, health: 3 }));
cards.set("filler", definePrinted({ code: "filler", name: "Filler", type: "event", sphere: "neutral", cost: 0 }));
const ctx = { effects: [] as readonly Effect[], cards };
const ctxWith = (effects: readonly Effect[]) => ({ ...ctxOf(effects), cards });
const focus = (seat = 0) => ({ seat, sourceId: null });

// The running effect has picked `ids` (the last is the picked card) and, for an event, the card it is about.
function inEffect(state: ScenarioState, picked: readonly string[], subject?: string): ScenarioState {
  return pushEffectFrame(state, { frame: "ResolveEffect", sourceId: null, actor: 0, peril: false, effectId: "x:forced:1", instructions: [], picked: [...picked], ...(subject ? { subject } : {}), cancel: null, blockCancel: null }, []);
}

describe("a hero held by an enemy (18074)", () => {
  function held() {
    let state = table(2);
    const hero = state.seats[0]!.heroes[0]!;
    const extra = spawn(state, "frodo", { zone: "heroes", seat: 0 });
    state = extra.state;
    const attach = spawn(state, "blessing", { zone: "play", seat: 0 });
    state = updateCard(attach.state, hero, { damage: 2, resources: 3, attachments: [attach.id] });
    state = updateCard(state, attach.id, { host: hero });
    const enemy = spawn(state, "ec1", { zone: "staging" });
    return { state: enemy.state, hero, spare: extra.id, enemy: enemy.id, attachment: attach.id };
  }

  it("CarryAwayHero: the hero loses its tokens and attachments and lies under the enemy, controlled by no one, flagged as held", () => {
    const { state, hero, enemy, attachment } = held();
    const next = carryAwayHero(inEffect(state, [hero, enemy]), ctx, []);
    expect(next.cards[hero]).toMatchObject({ zone: "captive", host: enemy, controller: null, damage: 0, resources: 0, guardedHero: true, owner: 0, face: "down" });
    expect(next.cards[attachment]?.zone).not.toBe("attached");
    expect(next.seats[0]?.heroes).not.toContain(hero);
    expect(heroGuardedBy(next, enemy)).toBe(hero);
  });

  it("CarryAwayHero does nothing when no enemy was found (the picked card is none) or the first pick is not a hero in play", () => {
    const { state, hero, enemy } = held();
    const noEnemy = inEffect(state, [hero, ""]);
    expect(carryAwayHero(noEnemy, ctx, [])).toBe(noEnemy);
    const noHero = inEffect(state, [enemy, enemy]);
    expect(carryAwayHero(noHero, ctx, [])).toBe(noHero);
  });

  it("ReleaseGuardedHero: the hero comes back among its owner's heroes where it was, faceup and exhausted", () => {
    const { state, hero, enemy } = held();
    const carried = carryAwayHero(inEffect(state, [hero, enemy]), ctx, []);
    const freed = releaseGuardedHero(carried, enemy);
    expect(freed.cards[hero]).toMatchObject({ zone: "heroes", controller: 0, exhausted: true, face: "up" });
    expect(freed.cards[hero]?.guardedHero).toBeUndefined();
    expect(freed.seats[0]?.heroes[0]).toBe(hero);
    expect(releaseGuardedHero(carried, null)).toBe(carried);
  });

  it("DiscardGuardedHeroes: each held hero goes to its owner's discard pile, and a player left with no hero is eliminated", () => {
    let { state, hero, enemy } = held();
    state = carryAwayHero(inEffect(state, [hero, enemy]), ctx, []);
    const other = state.seats[1]!.heroes[0]!;
    state = carryAwayHero(inEffect(state, [other, enemy]), ctx, []);
    expect(state.seats[1]?.eliminated).toBeFalsy();
    const discarded = discardGuardedHeroes(state, []);
    expect(discarded.cards[hero]).toMatchObject({ zone: "discard", guardedHero: undefined });
    expect(discarded.seats[0]?.discard).toContain(hero);
    expect(discarded.seats[1]?.eliminated).toBe(true);
    expect(discarded.seats[0]?.eliminated).toBeFalsy();
    expect(discardGuardedHeroes(table(1), [])).toEqual(table(1));
  });

  it("a player whose only hero is held is not eliminated; one with no hero and none held is", () => {
    const { state, enemy } = held();
    const solo = state.seats[1]!.heroes[0]!;
    const carried = carryAwayHero(inEffect(state, [solo, enemy]), ctx, []);
    expect(eliminateEmpties(carried, []).seats[1]?.eliminated).toBeFalsy();
    const gone = moveCard(state, solo, { zone: "discard", seat: 1 });
    expect(eliminateEmpties(gone, []).seats[1]?.eliminated).toBe(true);
  });

  it("the pick field guardsHero finds the enemy that guards a hero, in play or not", () => {
    const { state, hero, enemy } = held();
    const spec = { type: "enemy", control: "any", guardsHero: true } as const;
    const at = { seat: 0, sourceId: null };
    expect(matchesPick(state, enemy, spec, at, ctx)).toBe(false);
    const carried = carryAwayHero(inEffect(state, [hero, enemy]), ctx, []);
    expect(matchesPick(carried, enemy, spec, at, ctx)).toBe(true);
    expect(matchesPick(moveCard(carried, enemy, { zone: "encounterDiscard" }), enemy, spec, at, ctx)).toBe(true);
  });
});

describe("a hand under a location (18075)", () => {
  function hands() {
    let state = table(2);
    const places = deal(state, ["plain", "deepA", "path"], { zone: "staging" });
    state = places.state;
    const mine = deal(state, ["filler", "blessing"], { zone: "hand", seat: 0 });
    const theirs = deal(mine.state, ["filler"], { zone: "hand", seat: 1 });
    return { state: theirs.state, places: places.ids, mine: mine.ids, theirs: theirs.ids };
  }

  it("PlaceHandUnderLocation: with several locations to choose from the actor is asked, then the whole hand lies under the one chosen, facedown and still theirs", () => {
    const { state, places, mine } = hands();
    const asked = placeHandUnderLocation(inEffect(state, []), focus(0), ctx, []);
    expect(asked.window).toMatchObject({ kind: "choose", seat: 0 });
    const done = placeHandUnderLocation(inEffect(state, []), { seat: 0, sourceId: null, chosen: places[2] }, ctx, []);
    expect(playerCardsUnder(done, places[2]!)).toEqual(mine);
    expect(done.cards[mine[0]!]).toMatchObject({ zone: "under", face: "down", controller: null, owner: 0 });
    expect(done.seats[0]?.hand).toEqual([]);
  });

  it("a different location: one that a hand already lies under is not offered, and a lone location is taken without asking", () => {
    const { state, places, theirs } = hands();
    const first = placeHandUnderLocation(inEffect(state, []), { seat: 0, sourceId: null, chosen: places[0] }, ctx, []);
    const second = placeHandUnderLocation(inEffect(first, []), focus(1), ctx, []);
    expect(second.window).toMatchObject({ kind: "choose", options: [places[1], places[2]] });
    const lone = placeHandUnderLocation(inEffect(moveCard(first, places[2]!, { zone: "encounterDiscard" }), []), focus(1), ctx, []);
    expect(lone.window).toBeNull();
    expect(playerCardsUnder(lone, places[1]!)).toEqual(theirs);
  });

  it("an empty hand chooses nothing", () => {
    const { state } = hands();
    const empty = { ...state, seats: state.seats.map((seat) => ({ ...seat, hand: [] })) as unknown as ScenarioState["seats"] };
    const framed = inEffect(empty, []);
    expect(placeHandUnderLocation(framed, focus(0), ctx, [])).toBe(framed);
  });

  it("ReturnFacedownToHands gives each card back to its owner's hand; DiscardFacedownUnder sends the cards under every location to their owners' discard piles", () => {
    const { state, places, mine, theirs } = hands();
    const down = placeHandUnderLocation(inEffect(placeHandUnderLocation(inEffect(state, []), { seat: 0, sourceId: null, chosen: places[0] }, ctx, []), []), { seat: 1, sourceId: null, chosen: places[1] }, ctx, []);
    const back = returnFacedownToHands(down, places[0]!);
    expect(back.seats[0]?.hand).toEqual(expect.arrayContaining(mine));
    expect(back.cards[mine[0]!]).toMatchObject({ zone: "hand", owner: undefined });
    expect(playerCardsUnder(back, places[1]!)).toEqual(theirs);
    const gone = discardFacedownUnder(down);
    expect(gone.seats[0]?.discard).toEqual(expect.arrayContaining(mine));
    expect(gone.seats[1]?.discard).toEqual(theirs);
    expect(playerCardsUnder(gone, places[0]!)).toEqual([]);
    expect(returnFacedownToHands(down, null)).toBe(down);
  });

  it("the pick field hasFacedownUnder is true for a card with a facedown player card under it", () => {
    const { state, places } = hands();
    const spec = { type: "card", control: "any", hasFacedownUnder: true } as const;
    const down = placeHandUnderLocation(inEffect(state, []), { seat: 0, sourceId: null, chosen: places[0] }, ctx, []);
    expect(matchesPick(down, places[0]!, spec, { seat: 0, sourceId: null }, ctx)).toBe(true);
    expect(matchesPick(down, places[1]!, spec, { seat: 0, sourceId: null }, ctx)).toBe(false);
  });
});

describe("the nemesis (18076)", () => {
  function piles(codes: readonly string[]) {
    let state = table(1);
    const made = deal(state, codes, { zone: "spidersDeck" });
    state = { ...made.state, piles: { ...made.state.piles, spidersDeck: made.ids } } as ScenarioState;
    return { state, ids: made.ids };
  }

  it("SearchNemesis: the enemy with the most hit points enters the staging area as the nemesis and is the picked card", () => {
    const { state, ids } = piles(["small", "big", "mist"]);
    const next = searchNemesis(inEffect(state, []), focus(), ctx, []);
    expect(next.cards[ids[1]!]).toMatchObject({ zone: "staging", nemesis: true, face: "up" });
    expect(next.cards[ids[0]!]?.zone).toBe("spidersDeck");
  });

  it("asks the first player among enemies tied for the most hit points, and nothing happens with no enemy set aside", () => {
    const { state, ids } = piles(["big", "twin"]);
    const asked = searchNemesis(inEffect(state, []), focus(), ctx, []);
    expect(asked.window).toMatchObject({ kind: "choose", seat: 0, options: ids });
    const chosen = searchNemesis(inEffect(state, []), { seat: 0, sourceId: null, chosen: ids[1] }, ctx, []);
    expect(chosen.cards[ids[1]!]?.nemesis).toBe(true);
    const empty = inEffect(table(1), []);
    expect(searchNemesis(empty, focus(), ctx, [])).toBe(empty);
  });

  it("NemesisAttacks does nothing without a nemesis in play", () => {
    const state = table(1);
    expect(nemesisAttacks(state, focus(), ctx, [])).toBe(state);
  });

  // A game whose cards search for a nemesis (the sweep does nothing in any other game).
  const ctxNemesis = ctxWith([{ id: "x:whenRevealed:1", cardCode: "big", lines: ["big:A:1"], timing: "whenRevealed", instructions: [{ verb: "SearchNemesis" }] }]);

  it("the settle sweep clears the nemesis flag once the card has left play and its events are heard, not before", () => {
    const { state, ids } = piles(["big"]);
    const nemesis = searchNemesis(inEffect(state, []), focus(), ctx, []);
    const staged = nemesis;
    expect(clearNemesis({ ...staged, stack: [] }, ctxNemesis).cards[ids[0]!]?.nemesis).toBe(true);
    const out = moveCard({ ...staged, stack: [] }, ids[0]!, { zone: "encounterDiscard" });
    expect(clearNemesis({ ...out, pendingEvents: [{ trigger: "enemyDestroyed", seat: 0, subject: ids[0]! }] }, ctxNemesis).cards[ids[0]!]?.nemesis).toBe(true);
    expect(clearNemesis({ ...out, pendingEvents: [] }, ctxNemesis).cards[ids[0]!]?.nemesis).toBeUndefined();
    // In a game with no card that searches for a nemesis the sweep leaves the state alone.
    expect(clearNemesis({ ...out, pendingEvents: [] }, ctx)).toEqual({ ...out, pendingEvents: [] });
  });

  it("the pick field nemesis finds the flagged enemy", () => {
    const { state, ids } = piles(["big", "small"]);
    const next = { ...searchNemesis(inEffect(state, []), focus(), ctx, []), stack: [] };
    const spec = { type: "enemy", control: "any", staging: true, nemesis: true } as const;
    expect(matchesPick(next, ids[0]!, spec, { seat: 0, sourceId: null }, ctx)).toBe(true);
    expect(matchesPick(next, ids[1]!, spec, { seat: 0, sourceId: null }, ctx)).toBe(false);
  });
});

describe("the stage left by a jump (18074:B:3, 18075:B:3)", () => {
  function quest() {
    let state: ScenarioState = { ...table(1), stages: [{ code: "s1" }, { code: "s2a" }, { code: "s2c" }, { code: "s3a" }] };
    const s1 = spawn(state, "stage", { zone: "setAside" });
    const s2c = spawn(s1.state, "stage", { zone: "questDeck" });
    state = updateCard(updateCard(s2c.state, s1.id, { code: "s1" }), s2c.id, { code: "s2c" });
    const s2a = spawn(state, "stage", { zone: "questStage" });
    state = updateCard(s2a.state, s2a.id, { code: "s2a" });
    const s3a = spawn(state, "stage", { zone: "questDeck" });
    state = updateCard(s3a.state, s3a.id, { code: "s3a" });
    return { state, s2a: s2a.id, s2c: s2c.id, s3a: s3a.id };
  }

  it("a jump past a stage that was never played remembers the stage that was left; the next stage in order leaves the state as it was", () => {
    const { state, s2a, s3a, s2c } = quest();
    // 2A to 3A passes over 2C, which is still in the quest deck.
    const jumped = noteSkippedStage(state, s3a, s2a);
    expect(jumped.stageLeft).toEqual({ to: s3a, from: s2a });
    expect(defeatedBefore(jumped, s3a)).toBe(s2a);
    // 2C (played) to 3A is the stage before it in order.
    expect(noteSkippedStage(moveCard(state, s2c, { zone: "setAside" }), s3a, s2c)).toEqual(moveCard(state, s2c, { zone: "setAside" }));
    expect(defeatedBefore(state, s3a)).toBe(s2c);
  });
});

describe("the failed quest this round (12169:A:2)", () => {
  const reads: Effect = { id: "12169:response:1", cardCode: "12169", lines: ["12169:A:2"], timing: "response", trigger: "beginningOfPhase", instructions: [{ verb: "PlaceProgressOn", amount: 3, target: "activeLocation", when: { kind: "questFailed" } }] };
  const failed = { trigger: "questFailed", seat: 0 } as const;

  it("is recorded for the seat whose quest failed in a game that reads it, and holds only for that seat and round", () => {
    const state = spawn(table(2), "12169", { zone: "play", seat: 0 }).state;
    const noted = noteEvent(state, failed, ctxWith([reads]));
    expect(noted.quested).toMatchObject({ round: state.round, failed: [0] });
    const scope = (actor: number) => ({ actor, sourceId: null, returned: 0 });
    expect(holds(noted, { kind: "questFailed" }, scope(0), ctxWith([reads]))).toBe(true);
    expect(holds(noted, { kind: "questFailed" }, scope(1), ctxWith([reads]))).toBe(false);
    expect(holds({ ...noted, round: state.round + 1 }, { kind: "questFailed" }, scope(0), ctxWith([reads]))).toBe(false);
    expect(holds(state, { kind: "questFailed" }, scope(0), ctxWith([reads]))).toBe(false);
  });

  it("is not recorded in a game that never reads it, so no other game's state changes", () => {
    const state = table(1);
    expect(noteEvent(state, failed, ctxWith([]))).toBe(state);
  });
});
