// Rules: dcce.aflame, dcce.setup-raid-on-the-grey-havens, rr.damage, rr.first-player (data/rules/entries.json). Aflame X and The Havens Burn on a table of plain-number heroes and the Campaign Expansion's cards
// (test/scenarios/raid-on-the-grey-havens/scene.ts): the keyword, the end of the round, the destruction under The Havens Burn and what that costs, the Setup's discards, the quest cards' effects and the encounter cards that burn.
import { beforeAll, describe, expect, it } from "vitest";

import { holds, outOfPlayCopies } from "../../interpret/conditions.ts";
import { settle } from "../../engine/machine.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ScenarioState } from "../../core/state.ts";
import { legalTargets } from "../../engine/legal.ts";
import { showedHidden } from "../../engine/undo.ts";
import { AFLAME, CODES, codesIn, finish, idOf, idsOf, loadRaidWorld, raidTable, resolveRecords, send, start, type RaidLayout, type RaidWorld } from "../../../../test/scenarios/raid-on-the-grey-havens/scene.ts";
import { aflameOf } from "./values.ts";
import { progressRoom } from "../south/locations.ts";

let world: RaidWorld;

beforeAll(async () => {
  world = await loadRaidWorld();
});

function make(layout: RaidLayout = {}) {
  return raidTable(world, layout);
}
type Table = ReturnType<typeof make>;

const damageOn = (state: ScenarioState, code: string, at = 0): number => state.cards[idsOf(state, code)[at] ?? ""]?.damage ?? 0;
const zoneOf = (state: ScenarioState, code: string, at = 0): string | undefined => state.cards[idsOf(state, code)[at] ?? ""]?.zone;
const underBurn = (state: ScenarioState): string[] => Object.values(state.cards).filter((card) => card.zone === "under").map((card) => card.code).sort();

// The round ends: the phase after "End of round" is reached, as the engine does when the refresh phase is over.
function endRound(made: Table, state: ScenarioState = made.state): Run {
  const steps: EngineStep[] = [];
  const settled = settle({ ...state, phase: "Beginning of round", boundaryPhase: "End of round", mode: "beginRound", window: null }, made.ctx, steps);
  return { state: settled, steps };
}
type Run = { state: ScenarioState; steps: EngineStep[] };

describe("the Aflame keyword (dcce.aflame)", () => {
  it("is read from the scan of each Aflame location, as the value it prints", () => {
    const values = AFLAME.map((code) => aflameOf(make({ staging: [code] }).state, idOf(make({ staging: [code] }).state, code), { cards: world.cards }));
    expect(values).toEqual([12, 5, 5, 4, 3, 4]);
    const made = make({ staging: ["place"] });
    expect(aflameOf(made.state, idOf(made.state, "place"), { cards: world.cards })).toBeNull();
  });
});

describe("the end of the round (dcce.aflame)", () => {
  it("places 1 damage on each Aflame location in the staging area, and none on a location that is not Aflame or is the active location", () => {
    const made = make({ staging: [CODES.piers, CODES.whiteShip, "place"], active: { code: CODES.pillaged } });
    const { state } = endRound(made);
    expect(damageOn(state, CODES.dreamChaser)).toBe(1);
    expect(damageOn(state, CODES.piers)).toBe(1);
    expect(damageOn(state, CODES.whiteShip)).toBe(1);
    expect(damageOn(state, "place")).toBe(0);
    expect(damageOn(state, CODES.pillaged)).toBe(0);
  });

  it("names the rule as the cause of each damage", () => {
    const { steps } = endRound(make());
    const burnt = steps.filter((step) => step.kind === "damage");
    expect(burnt).toHaveLength(1);
    expect(burnt[0]).toMatchObject({ amount: 1, cause: { rule: "dcce.aflame" } });
  });

  it("does nothing in a game with no Aflame location", () => {
    const made = make({ bare: true, staging: ["place"] });
    const { state } = endRound(made);
    expect(damageOn(state, "place")).toBe(0);
  });
});

describe("a destroyed Aflame location (dcce.aflame, 11038:A:1, 11038:A:2)", () => {
  it("is placed facedown underneath The Havens Burn when its damage reaches its Aflame value, and out of play there", () => {
    const made = make({ staging: [{ code: CODES.whiteShip, damage: 3 }] });
    const { state } = endRound(made);
    expect(zoneOf(state, CODES.whiteShip)).toBe("under");
    const ship = state.cards[idOf(state, CODES.whiteShip)]!;
    expect(ship).toMatchObject({ host: idOf(state, CODES.burn), face: "down" });
    expect(state.staging).not.toContain(ship.id);
  });

  it("reveals the top card of the encounter deck for The Havens Burn, as each card is placed", () => {
    const made = make({ staging: [{ code: CODES.whiteShip, damage: 3 }], deck: ["f3", "f0"] });
    const { state } = endRound(made);
    expect(zoneOf(state, "f3")).toBe("staging");
    expect(state.encounterDeck.map((id) => state.cards[id]?.code)).toEqual(["f0"]);
  });

  it("is an Aflame location the sweep finds wherever it is in play, the active location too", () => {
    const made = make({ active: { code: CODES.piers, damage: 5 } });
    const settled = settle(made.state, made.ctx, []);
    expect(zoneOf(settled, CODES.piers)).toBe("under");
    expect(settled.activeLocation).toBeNull();
  });

  it("makes the players lose when the Dream-chaser is placed underneath (11039:A:4)", () => {
    const made = make({ damage: [[CODES.dreamChaser, 11]], phase: "Refresh" });
    const { state } = endRound(made);
    expect(zoneOf(state, CODES.dreamChaser)).toBe("under");
    expect(state.lost).toBe(true);
  });

  it("makes the players lose at 3 more cards than players underneath: 4 cards solo, 5 with two players (11038:A:2)", () => {
    const burning = { code: CODES.caravel, damage: 3 };
    const three = make({ under: [CODES.piers, CODES.pillaged], staging: [burning] });
    expect(endRound(three).state.lost).toBe(false);
    expect(underBurn(endRound(three).state)).toHaveLength(3);
    const four = make({ under: [CODES.piers, CODES.pillaged, CODES.whiteShip], staging: [burning] });
    const lost = endRound(four).state;
    expect(zoneOf(lost, CODES.caravel)).toBe("under");
    expect(lost.lost).toBe(true);
    expect(lost.lossReason).toBeTruthy();
    const duo = make({ seats: 2, under: [CODES.piers, CODES.pillaged, CODES.whiteShip], staging: [burning] });
    expect(endRound(duo).state.lost).toBe(false);
    const duoFull = make({ seats: 2, under: [CODES.piers, CODES.pillaged, CODES.whiteShip, CODES.waveRunner], staging: [burning] });
    expect(endRound(duoFull).state.lost).toBe(true);
  });

  it("counts the cards underneath for a condition: X more than the number of players, or at most a number (11038:A:2, 11182:B:5)", () => {
    const made = make({ seats: 2, under: [CODES.piers, CODES.pillaged] });
    const hold = (min?: number, max?: number, players?: true) => holds(made.state, { kind: "underBurn", ...(min != null ? { min } : {}), ...(max != null ? { max } : {}), ...(players ? { players } : {}) }, { actor: 0, sourceId: null, returned: 0 }, made.ctx);
    expect(hold(2)).toBe(true);
    expect(hold(3)).toBe(false);
    expect(hold(undefined, 2)).toBe(true);
    expect(hold(undefined, 1)).toBe(false);
    expect(hold(1, undefined, true)).toBe(false);
    expect(hold(undefined, 0, true)).toBe(true);
  });
});

describe("what a destroyed Aflame location does under The Havens Burn", () => {
  it("Burning Piers deals 3 damage to the Dream-chaser (11043:A:3)", () => {
    const made = make({ staging: [{ code: CODES.piers, damage: 5 }] });
    const { state } = endRound(made);
    expect(zoneOf(state, CODES.piers)).toBe("under");
    expect(damageOn(state, CODES.dreamChaser)).toBe(4);
  });

  it("White Ship places 1 resource on each Raider enemy in play (11045:A:3)", () => {
    const made = make({ staging: [{ code: CODES.whiteShip, damage: 3 }, "raider"], engaged: [{ code: "raider", seat: 0 }] });
    const { state } = endRound(made);
    const raiders = idsOf(state, "raider").map((id) => state.cards[id]?.resources);
    expect(raiders).toEqual([1, 1]);
  });

  it("Elven Caravel deals 1 damage to each character in play (11047:A:3)", () => {
    const made = make({ staging: [{ code: CODES.caravel, damage: 3 }], seats: 2, play: ["ally"] });
    const { state } = endRound(made);
    expect(zoneOf(state, CODES.caravel)).toBe("under");
    const hurt = Object.values(state.cards).filter((card) => (card.zone === "heroes" || card.zone === "play") && card.damage === 1).length;
    expect(hurt).toBe(4);
  });
});

describe("the cards facedown underneath The Havens Burn are hidden (dcce.aflame)", () => {
  const burning = { code: CODES.piers, damage: 5 };

  it("is a destroy step marked `under`, so no line names it, and no choice among out-of-play copies lists it", () => {
    const made = make({ staging: [burning], deck: [] });
    const { state, steps } = endRound(made);
    expect(zoneOf(state, CODES.piers)).toBe("under");
    const destroyed = steps.filter((step) => step.kind === "destroy");
    expect(destroyed).toEqual([{ kind: "destroy", targetId: idOf(made.state, CODES.piers), under: true }]);
    // The copies a card can shuffle in from out of play never include one lying under the Burn.
    expect(outOfPlayCopies(state, CODES.piers)).toEqual([]);
    expect(outOfPlayCopies(make({ discard: [CODES.piers] }).state, CODES.piers)).toHaveLength(1);
  });

  it("goes facedown without showing the player anything, so only the Burn's reveal keeps Undo from taking the burn back (docs/brief.md, The engine plays the game)", () => {
    // Nothing to reveal: the card turned facedown is a card the players had already seen, so the intent showed nothing hidden and Undo may take it back.
    const quiet = make({ staging: [burning], deck: [] });
    const settled = endRound(quiet).state;
    expect(zoneOf(settled, CODES.piers)).toBe("under");
    expect(showedHidden(quiet.state, settled)).toBe(false);
    // The Burn reveals the top card of the encounter deck when a card goes under it (11038:A:1): that is hidden information shown, and the burn cannot be undone.
    const revealing = make({ staging: [burning], deck: ["f0", "f0"] });
    expect(showedHidden(revealing.state, endRound(revealing).state)).toBe(true);
  });
});

describe("Raid on the Grey Havens, Setup (11036:A:1)", () => {
  const setup = (layout: RaidLayout) => {
    const made = make({ stage: "11036", ...layout });
    return resolveRecords(made.state, made.ctx, CODES.assault, "setup", made.state.questStage ?? undefined);
  };

  it("discards cards until one Aflame location for each player is discarded, adds each to the staging area, and shuffles the discard pile back", () => {
    const { state } = setup({ bare: true, deck: ["f0", CODES.piers, "f3", CODES.pillaged, "f0", CODES.whiteShip] });
    expect(codesIn(state, "staging")).toHaveLength(1);
    expect(AFLAME).toContain(codesIn(state, "staging")[0]);
    expect(state.encounterDiscard).toEqual([]);
    expect(state.encounterDeck).toHaveLength(5);
  });

  it("is two Aflame locations with two players", () => {
    const { state } = setup({ seats: 2, bare: true, deck: [CODES.piers, "f0", CODES.pillaged, "f3", CODES.whiteShip] });
    const staged = codesIn(state, "staging");
    expect(staged).toHaveLength(2);
    expect(staged.every((code) => AFLAME.includes(code as (typeof AFLAME)[number]))).toBe(true);
    expect(state.encounterDeck).toHaveLength(3);
  });
});

describe("The Corsairs' Assault, side B (11036:B:1)", () => {
  it("deals 1 damage for each Corsair enemy in play to the Aflame location with the lowest Aflame value at the end of the combat phase", () => {
    const made = make({ phase: "Combat", staging: [CODES.piers, CODES.waveRunner, "corsair"], engaged: [{ code: "corsair2", seat: 0 }, { code: "raider", seat: 0 }] });
    const run = resolveRecords(made.state, made.ctx, CODES.assault, "forced", made.state.questStage ?? undefined);
    // 3 Corsairs (the staged one, the engaged one and the Raider): 3 damage destroys the Elven Wave-runner (Aflame 3) and puts it under The Havens Burn.
    expect(zoneOf(run.state, CODES.waveRunner)).toBe("under");
    expect(damageOn(run.state, CODES.piers)).toBe(0);
  });

  it("asks the first player which when Aflame locations are tied on the lowest value", () => {
    const made = make({ phase: "Combat", staging: [CODES.caravel, CODES.whiteShip, "corsair"] });
    const whiteShip = idOf(made.state, CODES.whiteShip);
    const run = resolveRecords(made.state, made.ctx, CODES.assault, "forced", made.state.questStage ?? undefined, (state) => (state.window?.kind === "choose" ? (state.window.options.includes(whiteShip) ? whiteShip : (state.window.options[0] ?? "")) : ""));
    expect(damageOn(run.state, CODES.whiteShip)).toBe(1);
    expect(damageOn(run.state, CODES.caravel)).toBe(0);
  });

  it("does not ask which of the tied locations when no Corsair enemy is in play, and deals nothing", () => {
    const made = make({ phase: "Combat", staging: [CODES.caravel, CODES.whiteShip, "f3"] });
    const asked: string[][] = [];
    const run = resolveRecords(made.state, made.ctx, CODES.assault, "forced", made.state.questStage ?? undefined, (state) => {
      if (state.window?.kind === "choose") asked.push([...state.window.options]);
      return state.window?.kind === "choose" ? (state.window.options[0] ?? "") : "";
    });
    expect(asked).toEqual([]);
    expect([damageOn(run.state, CODES.whiteShip), damageOn(run.state, CODES.caravel)]).toEqual([0, 0]);
  });
});

// The answer that takes the option when the window offers it, else the first (a card to pick).
const chooses = (option: string) => (state: ScenarioState): string => (state.window?.kind === "choose" ? (state.window.options.includes(option) ? option : (state.window.options[0] ?? "")) : "");

describe("the encounter cards that burn", () => {
  const reveal = (code: string, layout: RaidLayout, pick?: (state: ScenarioState) => string) => {
    const made = make(layout);
    return { made, ...resolveRecords(made.state, made.ctx, code, "whenRevealed", undefined, pick) };
  };

  it("Corsair Arsonist deals 2 damage to an Aflame location, or searches for the one with the highest Aflame value (11040:A:1)", () => {
    const hit = reveal(CODES.arsonist, { staging: [CODES.piers] }, chooses("damage"));
    expect(damageOn(hit.state, CODES.piers) + damageOn(hit.state, CODES.dreamChaser)).toBe(2);
    const searched = reveal(CODES.arsonist, { deck: [CODES.whiteShip, "f0"], discard: [CODES.piers, CODES.caravel] }, chooses("search"));
    expect(zoneOf(searched.state, CODES.piers)).toBe("staging");
    expect(zoneOf(searched.state, CODES.whiteShip)).toBe("encounterDeck");
    // Tied on the highest value (Burning Piers and Pillaged Ship, both 5): the first player chooses.
    const tied = reveal(CODES.arsonist, { deck: [CODES.piers], discard: [CODES.pillaged] }, (state) => (state.window?.kind === "choose" ? (state.window.options.includes("search") ? "search" : (state.window.options.find((id) => state.cards[id]?.code === CODES.pillaged) ?? "")) : ""));
    expect(zoneOf(tied.state, CODES.pillaged)).toBe("staging");
    expect(zoneOf(tied.state, CODES.piers)).toBe("encounterDeck");
  });

  it("Pillaged Ship deals 3 damage to itself, or adds the topmost enemy in the encounter discard pile to the staging area (11044:A:2)", () => {
    const self = reveal(CODES.pillaged, {}, chooses("damage"));
    expect(damageOn(self.state, CODES.pillaged)).toBe(3);
    const added = reveal(CODES.pillaged, { discard: ["f0", "place", "f3"] }, chooses("discard"));
    expect(zoneOf(added.state, "f3")).toBe("staging");
    expect(zoneOf(added.state, "f0")).toBe("encounterDiscard");
  });

  it("offers only the options that can change the game: no search without an Aflame location to find, no discard option without an enemy in the discard pile (rr.effects)", () => {
    const offered = (code: string, layout: RaidLayout): string[][] => {
      const seen: string[][] = [];
      reveal(code, layout, (state) => {
        // The question between the branches, not the pick of a card that follows it.
        if (state.window?.kind === "choose" && !/^i\d+$/.test(state.window.options[0] ?? "")) seen.push([...state.window.options]);
        return state.window?.kind === "choose" ? (state.window.options[0] ?? "") : "";
      });
      return seen;
    };
    expect(offered(CODES.arsonist, { staging: [CODES.piers], deck: ["f0"], discard: ["place"] })).toEqual([]);
    expect(offered(CODES.arsonist, { staging: [CODES.piers], deck: ["f0"], discard: [CODES.whiteShip] })).toEqual([["damage", "search"]]);
    // With no Aflame location in play only the search is left: it resolves without a question.
    const searched = reveal(CODES.arsonist, { bare: true, discard: [CODES.piers] });
    expect(zoneOf(searched.state, CODES.piers)).toBe("staging");
    expect(offered(CODES.pillaged, { discard: ["place", "treachery"] })).toEqual([]);
    expect(offered(CODES.pillaged, { discard: ["f3"] })).toEqual([["damage", "discard"]]);
  });

  it("Put to the Torch has each player deal 3 damage to a character they control or to an Aflame location (11048:A:1)", () => {
    const run = reveal(CODES.torch, { seats: 2, staging: [CODES.piers] }, (state) => (state.window?.kind === "choose" ? (state.window.options.includes("character") ? "character" : (state.window.options[0] ?? "")) : ""));
    const hurt = Object.values(run.state.cards).filter((card) => card.zone === "heroes" && card.damage === 3);
    expect(hurt).toHaveLength(2);
  });

  it("The Fires Spread deals 1 damage to each Aflame location (11049:A:2) and gains surge when fewer than 3 are in play, so a second card is revealed", () => {
    const few = reveal(CODES.fires, { staging: [CODES.piers] });
    expect(damageOn(few.state, CODES.piers)).toBe(1);
    expect(damageOn(few.state, CODES.dreamChaser)).toBe(1);
    const many = reveal(CODES.fires, { staging: [CODES.piers, CODES.whiteShip] });
    expect([CODES.dreamChaser, CODES.piers, CODES.whiteShip].map((code) => damageOn(many.state, code))).toEqual([1, 1, 1]);
    // Revealed from the encounter deck: with 2 Aflame locations it gains surge, with 3 it does not.
    const revealed = (staging: readonly string[]) => {
      const made = make({ deck: [CODES.fires, "f0", "f0"], staging });
      return codesIn(send(start(made.state), { type: "Pass" }, made.ctx).state, "staging").filter((code) => code === "f0").length;
    };
    expect(revealed([CODES.piers])).toBe(1);
    expect(revealed([CODES.piers, CODES.whiteShip])).toBe(0);
  });
});

describe("Mithlond Harbor (11042:A:2, 11042:A:3)", () => {
  it("lets no progress be placed on a location in the staging area while it is there", () => {
    const withHarbor = make({ staging: [CODES.harbor, CODES.pillaged] });
    const pillaged = idOf(withHarbor.state, CODES.pillaged);
    expect(progressRoom(withHarbor.state, pillaged, world.cards)).toBe(0);
    expect(progressRoom(withHarbor.state, idOf(withHarbor.state, CODES.harbor), world.cards)).toBe(0);
    const without = make({ staging: [CODES.pillaged] });
    expect(progressRoom(without.state, idOf(without.state, CODES.pillaged), world.cards)).toBe(4);
    const active = make({ staging: [CODES.harbor], active: { code: CODES.pillaged } });
    expect(progressRoom(active.state, idOf(active.state, CODES.pillaged), world.cards)).toBe(4);
  });
});

describe("the Travel effects of the Aflame locations", () => {
  const travel = (code: string, layout: RaidLayout, pick?: (state: ScenarioState) => string) => {
    const made = make({ phase: "Travel", staging: [code], ...layout });
    return { made, run: finishTravel(send(start(made.state), { type: "Travel", locationId: idOf(made.state, code) }, made.ctx), made.ctx, pick) };
  };
  const finishTravel = (run: Run, ctx: ReturnType<typeof make>["ctx"], pick?: (state: ScenarioState) => string): Run => finish(run, ctx, pick);

  it("the players cannot travel to the Dream-chaser (11039:A:3)", () => {
    const made = make({ phase: "Travel" });
    const travelTo = legalTargets(made.state, { type: "Travel" }, made.ctx);
    expect(travelTo).not.toContain(idOf(made.state, CODES.dreamChaser));
    const withOther = make({ phase: "Travel", staging: [CODES.piers] });
    expect(legalTargets(withOther.state, { type: "Travel" }, withOther.ctx)).toEqual([idOf(withOther.state, CODES.piers)]);
  });

  it("White Ship searches the encounter deck and discard pile for a Corsair enemy, adds it to the staging area and shuffles the deck (11045:A:2)", () => {
    const { run } = travel(CODES.whiteShip, { deck: ["f0", "corsair", "f3"], discard: ["corsair2"] });
    const staged = codesIn(run.state, "staging");
    expect(staged.filter((code) => code.startsWith("corsair"))).toHaveLength(1);
    expect(run.state.activeLocation).toBe(idOf(run.state, CODES.whiteShip));
  });

  it("Elven Caravel has each player assign damage among their characters equal to the damage on it (11047:A:2)", () => {
    const { run } = travel(CODES.caravel, { staging: [{ code: CODES.caravel, damage: 3 }], seats: 2 }, (state) => (state.window?.kind === "choose" ? (state.window.options[0] ?? "") : ""));
    const damage = Object.values(run.state.cards).filter((card) => card.zone === "heroes").reduce((sum, card) => sum + card.damage, 0);
    expect(damage).toBe(6);
  });
});
