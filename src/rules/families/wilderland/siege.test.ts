// Rules: rr.player-elimination, rr.ownership-and-control, rr.in-play-and-out-of-play, rr.the-word-choose, rr.resources (data/rules/entries.json); ledger lines 50815:A:2, 50805:B:2, 50818:A:2.
// The verbs and pick fields The Siege of Annúminas adds, on fixture cards: DiscardHeldHero and ReturnHeldHeroes (the heroes lying under stage 3, Enemy Camp), the pick field atOtherStage (a Standard game has one stage) and the player pick canSpendResources.
import { describe, expect, it } from "vitest";

import { stageNumber } from "../caves/progress.ts";
import { matchesPick, pickCandidates } from "../../interpret/pick.ts";
import { updateCard, type ScenarioState } from "../../core/state.ts";
import { spawn } from "../../core/zones.ts";
import { captureHero } from "../south/captive.ts";
import { discardHeldHero, returnHeldHeroes } from "./carried.ts";
import { ctxOf, table } from "./fixture.ts";

// Two players, the quest on stage 3 of three, each hero held under it as an Epic stage 3 holds the captives (flagged like a guarded hero, so its owner is not eliminated for want of heroes).
function held(stages = 3): { state: ScenarioState; heroes: string[] } {
  let state = table(2);
  state = { ...state, stages: [{ code: "a" }, { code: "b" }, { code: "stage" }].slice(3 - stages) as ScenarioState["stages"] };
  const stageId = state.questStage as string;
  const heroes = state.seats.map((seat) => seat.heroes[0] as string);
  heroes.forEach((hero, seat) => {
    state = captureHero(state, hero, stageId);
    state = updateCard(state, hero, { guardedHero: true, owner: seat, heroSlot: 0 });
  });
  return { state, heroes };
}

describe("DiscardHeldHero and ReturnHeldHeroes (50815:A:2)", () => {
  it("DiscardHeldHero: one hero under stage 3, chosen with the seed, goes to its owner's discard pile; its owner, left with no hero, is eliminated", () => {
    const { state, heroes } = held();
    expect(stageNumber(state)).toBe(3);
    const next = discardHeldHero(state, 3, []);
    const gone = heroes.filter((hero) => next.cards[hero]?.zone === "discard");
    expect(gone).toHaveLength(1);
    const seat = next.cards[gone[0] as string]?.zone === "discard" ? next.seats.findIndex((one) => one.discard.includes(gone[0] as string)) : -1;
    expect(seat).toBeGreaterThanOrEqual(0);
    expect(next.seats[seat]?.eliminated).toBe(true);
    expect(next.cards[gone[0] as string]?.guardedHero).toBeUndefined();
    expect(heroes.filter((hero) => next.cards[hero]?.zone === "captive")).toHaveLength(1);
    expect(next.seedCursor).not.toBe(state.seedCursor);
  });

  it("DiscardHeldHero does nothing at another stage or with no hero under the stage", () => {
    expect(discardHeldHero(held().state, 2, [])).toEqual(held().state);
    const bare = table(2);
    expect(discardHeldHero(bare, 1, [])).toBe(bare);
  });

  it("ReturnHeldHeroes: each hero under stage 3 returns among its owner's heroes where it was, faceup and exhausted", () => {
    const { state, heroes } = held();
    const next = returnHeldHeroes(state, 3);
    for (const [seat, hero] of heroes.entries()) {
      expect(next.cards[hero]).toMatchObject({ zone: "heroes", controller: seat, exhausted: true, face: "up" });
      expect(next.cards[hero]?.guardedHero).toBeUndefined();
      expect(next.seats[seat]?.heroes).toContain(hero);
    }
    expect(returnHeldHeroes(held(2).state, 3)).toEqual(held(2).state);
  });
});

describe("the pick field atOtherStage (50805:B:2)", () => {
  it("matches no card in a game with one stage, so the Response that needs an enemy at another stage is never offered", () => {
    const state = spawn(table(1), "orc", { zone: "staging" });
    const orc = Object.values(state.state.cards).find((card) => card.code === "orc")?.id as string;
    const spec = { type: "enemy" as const, control: "any" as const, staging: true };
    expect(matchesPick(state.state, orc, spec, { seat: 0, sourceId: null }, ctxOf([]))).toBe(true);
    expect(matchesPick(state.state, orc, { ...spec, atOtherStage: true }, { seat: 0, sourceId: null }, ctxOf([]))).toBe(false);
  });
});

describe("the player pick canSpendResources (50818:A:2)", () => {
  it("offers only the players whose heroes hold that many resources between them", () => {
    let state = table(2);
    const [first, second] = state.seats.map((seat) => seat.heroes[0] as string);
    state = updateCard(state, first as string, { resources: 1 });
    expect(pickCandidates(state, { type: "player", control: "any", canSpendResources: 1 }, 0, [], null, ctxOf([]))).toEqual(["seat:0"]);
    expect(pickCandidates(state, { type: "player", control: "any", canSpendResources: 2 }, 0, [], null, ctxOf([]))).toEqual([]);
    state = updateCard(state, second as string, { resources: 2 });
    expect(pickCandidates(state, { type: "player", control: "any", canSpendResources: 2 }, 0, [], null, ctxOf([]))).toEqual(["seat:1"]);
    expect(pickCandidates(state, { type: "player", control: "any" }, 0, [], null, ctxOf([]))).toEqual(["seat:0", "seat:1"]);
  });
});
