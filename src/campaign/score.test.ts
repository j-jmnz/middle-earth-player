import { beforeAll, describe, expect, it } from "vitest";

import { definePrinted, printedOf, type PrintedCard } from "../rules/core/printed.ts";
import type { ScenarioState } from "../rules/core/state.ts";
import { updateCard, withThreat } from "../rules/core/state.ts";
import { moveCard, spawn } from "../rules/core/zones.ts";
import { loadWorld, table, type World } from "../../test/scenarios/a-shadow-of-the-past/scene.ts";
import { first } from "../../test/harness/scene-kit.ts";

import { scoreOf } from "./score.ts";

// Learn to Play: final threat, plus the threat cost of each destroyed hero, plus damage on surviving heroes, plus 10
// per completed round, minus victory points (ltp.scoring, rr.scoring). An eliminated player counts 50 and all their
// heroes. The players win during round 4 here: 3 rounds were completed (faq.scoring tallies a round at the end of its
// refresh phase).
const FRODO = "141001";
const SAM = "141002";

let world: World;
let cards: ReadonlyMap<string, PrintedCard>;

beforeAll(async () => {
  world = await loadWorld();
  cards = world.cards;
});

function base(round = 4): ScenarioState {
  const { state } = table(world, {});
  return { ...withThreat(state, 0, 30), round };
}

describe("scoreOf", () => {
  it("adds threat, damage on surviving heroes and 10 per completed round", () => {
    const state = base();
    const marked = updateCard(updateCard(state, first(state, FRODO), { damage: 2 }), first(state, SAM), { damage: 1 });
    expect(scoreOf(marked, cards)).toEqual({ rounds: 3, victoryPoints: 0, score: 30 + 3 + 30 });
  });

  it("adds the threat cost of a destroyed hero and not its damage", () => {
    const state = base();
    const sam = first(state, SAM);
    const fallen = moveCard(updateCard(state, sam, { damage: 9 }), sam, { zone: "discard", seat: 0 });
    const cost = printedOf(cards, SAM).threat ?? 0;
    expect(cost).toBeGreaterThan(0);
    expect(scoreOf(fallen, cards).score).toBe(30 + cost + 30);
  });

  it("subtracts the victory points of the cards in the victory display", () => {
    const state = base();
    const code = [...cards.values()].find((card) => (card.victory ?? 0) > 0 && card.type !== "quest")?.code ?? "";
    const points = printedOf(cards, code).victory ?? 0;
    expect(points).toBeGreaterThan(0);
    const won = { ...spawn(state, code, { zone: "victory" }).state };
    expect(scoreOf(won, cards)).toEqual({ rounds: 3, victoryPoints: points, score: 30 + 30 - points });
  });

  it("counts the Victory printed on the side the card was on: the Stormcaller is worth 10 on side A and 15 on its Campaign Mode only side (dcce.campaign-mode)", () => {
    const caller = definePrinted({ code: "stormcaller", name: "Stormcaller", type: "enemy", victory: 10, upgraded: { willpower: 0, attack: 7, defense: 6, health: 20, victory: 15 } });
    const held = new Map(cards).set(caller.code, caller);
    const state = base();
    const sideA = spawn(state, caller.code, { zone: "victory" }).state;
    const sideB = (() => {
      const made = spawn(state, caller.code, { zone: "play", seat: 0 });
      return moveCard(updateCard(made.state, made.id, { face: "B" }), made.id, { zone: "victory" });
    })();
    expect(scoreOf(sideA, held)).toEqual({ rounds: 3, victoryPoints: 10, score: 30 + 30 - 10 });
    expect(scoreOf(sideB, held)).toEqual({ rounds: 3, victoryPoints: 15, score: 30 + 30 - 15 });
  });

  it("counts an eliminated seat as 50 plus the threat cost of every hero it started with", () => {
    const state = base();
    const out: ScenarioState = { ...state, seats: [{ ...state.seats[0], eliminated: true, threat: 12 }, state.seats[1]] };
    const costs = (printedOf(cards, FRODO).threat ?? 0) + (printedOf(cards, SAM).threat ?? 0);
    expect(scoreOf(out, cards).score).toBe(50 + costs + 30);
  });
});
