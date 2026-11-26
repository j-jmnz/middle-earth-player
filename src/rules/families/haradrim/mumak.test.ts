// Rules: hrd.immune-to-player-card-effects, rr.player-elimination, ltp.undefended-attack, rr.cannot (data/rules/entries.json); ledger lines 17047:A:1, 17038:A:1, 17038:A:2, 17038:A:3, 17050:B:2, 17045:A:3. The Tamed Mûmak, the objective ally each player takes at Setup: the take, the
// ally it is, the undefended damage that goes to it whatever its hit points, and the elimination of its controller when it leaves play.
import { describe, expect, it } from "vitest";

import type { EngineStep } from "../../core/intents.ts";
import { withSeat, type ScenarioState } from "../../core/state.ts";
import { fight, idOf, idsOf, legalTargets, opened, run as runInstruction, type Layout } from "../../../../test/harness/scene-kit.ts";
import { moveCard, spawn } from "../../core/zones.ts";
import { finishAttack } from "../../combat/shadow.ts";
import { settle } from "../../engine/machine.ts";
import { pushCardEffects } from "../../interpret/effect-frames.ts";
import { matchesPick, pickCandidates } from "../../interpret/pick.ts";
import { undefendedMumak } from "./mumak.ts";
import { MUMAK, raceTable, URUK } from "./race-kit.ts";

const table = (layout: Layout = {}) => raceTable({ seats: 1, setAside: [], phase: "Combat", ...layout });

/** The Setup record of stage 1A resolves, as the deal does, with one Tamed Mûmak set aside for each of four seats (the scenario deals four). */
function setup(layout: Layout) {
  const made = table({ stage: "17047", setAside: [MUMAK, MUMAK, MUMAK, MUMAK, "17051", "17052", "17053", "17054", "16061"], ...layout });
  const steps: EngineStep[] = [];
  const effects = made.ctx.effects.filter((effect) => effect.id === "17047:setup:1");
  const pushed = pushCardEffects(made.state, "setup", idOf(made.state, "17047"), 0, false, effects, made.ctx, steps);
  return { made, state: settle({ ...pushed, window: null, mode: "stopped" }, made.ctx, steps) };
}

/** The table at the defense window of the Uruk's attack on seat 0, the Mûmak in play. */
function attacked(layout: Layout = {}) {
  const made = table({ engaged: [URUK], play: [MUMAK], ...layout });
  const start = opened(made).state;
  const arrived = fight(made, opened(made, start), (state) => state.window?.kind === "defense");
  return { made, run: arrived, state: arrived.state };
}

describe("17047:A:1 the Setup gives each player a Tamed Mûmak", () => {
  it("each player takes one of the set-aside Tamed Mûmakil into their play area, faceup and ready, and the rest leave the game", () => {
    const { state } = setup({ seats: 2 });
    const mumakil = idsOf(state, MUMAK);
    expect(mumakil).toHaveLength(4);
    expect(mumakil.map((id) => state.cards[id]?.zone).sort()).toEqual(["play", "play", "removed", "removed"]);
    expect([0, 1].map((seat) => (state.seats[seat]?.play ?? []).filter((id) => state.cards[id]?.code === MUMAK).length)).toEqual([1, 1]);
    for (const id of mumakil.filter((card) => state.cards[card]?.zone === "play")) expect(state.cards[id]).toMatchObject({ face: "up", exhausted: false, controller: state.cards[id]?.controller });
    expect(state.orcs).toBeDefined();
  });

  it("a solo game takes one Mûmak and removes the other three", () => {
    const { state } = setup({ seats: 1 });
    expect(idsOf(state, MUMAK).map((id) => state.cards[id]?.zone).sort()).toEqual(["play", "removed", "removed", "removed"]);
  });

  it("the Mûmak is an ally in play its player controls: a character a pick finds, with its printed Willpower 2, Attack 5, Defense 2 and 8 hit points", () => {
    const made = table({ play: [MUMAK] });
    const state = opened(made).state;
    const id = idOf(state, MUMAK);
    expect(matchesPick(state, id, { type: "ally", control: "you" }, { seat: 0, sourceId: null }, made.ctx)).toBe(true);
    expect(matchesPick(state, id, { type: "character", control: "you" }, { seat: 0, sourceId: null }, made.ctx)).toBe(true);
    expect(made.cards.get(MUMAK)).toMatchObject({ willpower: 2, attack: 5, defense: 2, health: 8 });
  });
});

describe("17038:A:1 the Tamed Mûmak is immune to player card effects", () => {
  it("a player card cannot choose it, an encounter card can, and an ordinary ally is open to both", () => {
    const made = table({ play: [MUMAK, "ally"] });
    const state = opened(made).state;
    const mumak = idOf(state, MUMAK);
    const ally = idOf(state, "ally");
    const player = idOf(state, "dh1");
    const spec = { type: "ally", control: "you" } as const;
    expect(pickCandidates(state, spec, 0, [], player, made.ctx)).toEqual([ally]);
    const encounter = spawn(state, "16052", { zone: "staging" });
    expect(pickCandidates(encounter.state, spec, 0, [], encounter.id, made.ctx).sort()).toEqual([ally, mumak].sort());
  });
});

describe("17038:A:2 the damage of an undefended attack must be assigned to the Tamed Mûmak", () => {
  it("the attacked player is offered the Mûmak alone, so the attack lands on it and on no hero", () => {
    const { made, run, state } = attacked();
    const mumak = idOf(state, MUMAK);
    expect(undefendedMumak(state)).toEqual([mumak]);
    expect(legalTargets(state, { type: "Undefended" }, made.ctx)).toEqual([mumak]);
    const done = fight(made, run, (current) => current.pendingAttack == null, { heroCode: MUMAK });
    expect(done.state.cards[mumak]?.damage).toBe(4);
    expect(done.state.cards[idOf(state, "dh1")]?.damage).toBe(0);
  });

  it("all of it goes on the Mûmak whatever its hit points left: an attack of 4 on a Mûmak with 6 damage destroys it, the excess is not assigned elsewhere", () => {
    const { made, run, state } = attacked({ play: [{ code: MUMAK, damage: 6 }] });
    const mumak = idOf(state, MUMAK);
    const done = fight(made, run, (current) => current.pendingAttack == null, { heroCode: MUMAK });
    expect(done.state.cards[mumak]?.zone).not.toBe("play");
    expect(done.state.cards[idOf(state, "dh1")]?.damage).toBe(0);
  });

  it("a defended attack is not redirected: the Mûmak (or a hero) that defends takes it as any defender", () => {
    const { made, run, state } = attacked();
    const defended = fight(made, run, (current) => current.pendingAttack == null, { defender: "dh1" });
    expect(defended.state.cards[idOf(state, MUMAK)]?.damage).toBe(0);
    expect(defended.state.cards[idOf(state, "dh1")]?.damage).toBeGreaterThan(0);
  });

  it("only the controlling player's undefended attacks go to the Mûmak: another seat's attack lands on its own heroes", () => {
    const made = table({ seats: 2, engaged: [URUK], play: [{ code: MUMAK, seat: 1 }] });
    const state = opened(made).state;
    expect(undefendedMumak({ ...state, pendingAttack: { enemyId: idOf(state, URUK), seat: 0 } })).toEqual([]);
    expect(undefendedMumak({ ...state, pendingAttack: { enemyId: idOf(state, URUK), seat: 1 } })).toEqual([idOf(state, MUMAK)]);
    expect(undefendedMumak({ ...state, pendingAttack: null })).toEqual([]);
  });
});

describe("17038:A:3 if the Tamed Mûmak leaves play its controller is eliminated", () => {
  const leaves = (state: ScenarioState, made: ReturnType<typeof table>, id: string): ScenarioState => runInstruction(made, state, { verb: "Discard", target: { kind: "self" } }, { sourceId: id });

  it("a Mûmak that is discarded eliminates its controller, and the other player goes on", () => {
    const made = table({ seats: 2, play: [{ code: MUMAK, seat: 0 }, { code: MUMAK, seat: 1 }] });
    const state = opened(made).state;
    const first = (state.seats[0]?.play ?? []).find((id) => state.cards[id]?.code === MUMAK) ?? "";
    const done = leaves(state, made, first);
    expect(done.seats[0]?.eliminated).toBeTruthy();
    expect(done.seats[1]?.eliminated).toBeFalsy();
    expect(done.lost).toBeFalsy();
  });

  it("a Mûmak destroyed by an undefended attack eliminates its controller, and a game with no player left is lost", () => {
    const { made, run, state } = attacked({ play: [{ code: MUMAK, damage: 6 }] });
    const done = fight(made, run, (current) => current.pendingAttack == null || current.lost === true, { heroCode: MUMAK });
    expect(done.state.seats[0]?.eliminated || done.state.lost).toBeTruthy();
    expect(state.seats[0]?.eliminated).toBeFalsy();
  });
});

describe("17038:A:3 a destroyed Tamed Mûmak still gives the progress of the attack that destroyed it (17050:B:2, 17045:A:3)", () => {
  const SETS = ["17051", "17052", "17053", "17054", "16061"];
  const MUMAK_HURT = { code: MUMAK, damage: 6 };
  // The Uruk attacks seat 0 undefended: the Mûmak takes all of it and is destroyed.
  function destroyed(seats: 1 | 2, layout: Layout) {
    const made = table({ seats, stage: "17050", engaged: [URUK], heroes: [], setAside: SETS, ...layout });
    const state = runInstruction(made, opened(made).state, { verb: "PrepareOrcsArea", stages: SETS.slice(0, 4), number: 1 });
    const arrived = fight(made, opened(made, state), (current) => current.window?.kind === "defense");
    return fight(made, arrived, (current) => current.pendingAttack == null || current.lost === true, { heroCode: MUMAK }).state;
  }

  it("17050:B:2 two-handed: 1 progress goes on the Orcs' stage, then the Mûmak's controller is eliminated and the other player goes on", () => {
    const done = destroyed(2, { play: [{ ...MUMAK_HURT, seat: 0 }, { code: MUMAK, seat: 1 }], heroes: [{ code: "dh1", seat: 0 }, { code: "dh1", seat: 1 }] });
    expect(done.cards[done.orcs?.stage ?? ""]?.progress).toBe(1);
    expect(done.seats[0]?.eliminated).toBeTruthy();
    expect(done.seats[1]?.eliminated).toBeFalsy();
    expect(done.lost).toBeFalsy();
  });

  it("17050:B:2 solo: the progress is placed, then the elimination loses the game", () => {
    const done = destroyed(1, { play: [MUMAK_HURT], heroes: ["dh1"] });
    expect(done.cards[done.orcs?.stage ?? ""]?.progress).toBe(1);
    expect(done.lost).toBe(true);
  });
});

describe("17038:A:3 the elimination a destroyed Tamed Mûmak owes is never lost", () => {
  const SETS = ["17051", "17052", "17053", "17054", "16061"];
  // The attack ends with the elimination of seat 0 owed (the Mûmak was destroyed by an undefended attack) and its attacker no longer engaged: the instructions of an enemy that left the attack are dropped, this one is not.
  function ended(seats: 1 | 2, left: boolean, destroyedSeat?: number): ScenarioState {
    const made = table({ seats, stage: "17050", engaged: [URUK], heroes: [], setAside: SETS, play: [{ code: MUMAK, seat: 0 }, ...(seats === 2 ? [{ code: MUMAK, seat: 1 }] : [])] });
    const state = runInstruction(made, opened(made).state, { verb: "PrepareOrcsArea", stages: SETS.slice(0, 4), number: 1 });
    const uruk = idOf(state, URUK);
    // `destroyedSeat`: that seat's Mûmak is the one the attack destroyed (in the encounter discard pile); the other seat's Mûmak, if any, is destroyed by nothing.
    const mumak = (seat: number): string => (state.seats[seat]?.play ?? []).find((id) => state.cards[id]?.code === MUMAK) ?? "";
    const gone = destroyedSeat == null ? state : moveCard(state, mumak(destroyedSeat), { zone: "encounterDiscard" });
    const attacking = { ...gone, pendingAttack: { enemyId: uruk, seat: 0, undefended: true, heroId: destroyedSeat == null ? undefined : mumak(destroyedSeat), after: [{ verb: "EliminateAfterAttack" } as const] } };
    const steps: EngineStep[] = [];
    const away = left ? moveCard(attacking, uruk, { zone: "staging" }) : attacking;
    return settle(finishAttack(away, made.ctx, steps), made.ctx, steps);
  }

  it("the attacker stays engaged: the controller is eliminated at the attack's end", () => {
    expect(ended(2, false).seats[0]?.eliminated).toBeTruthy();
  });

  it("solo: the attacker left the engagement, and the controller is still eliminated, so the game is lost", () => {
    const done = ended(1, true);
    expect(done.lost).toBe(true);
    // The deferred elimination runs in the attacker's frame, but the reason names the Mûmak, not the attacker.
    expect(done.lossReason).toBe("Tamed Mûmak left play: Player 1 is eliminated");
  });

  it("solo: a Mûmak the attack destroyed gives the reason \"was destroyed\"", () => {
    const done = ended(1, true, 0);
    expect(done.lost).toBe(true);
    expect(done.lossReason).toBe("Tamed Mûmak was destroyed: Player 1 is eliminated");
  });

  it("the reason names this seat's Mûmak: another seat's destroyed Mûmak does not make it \"was destroyed\"", () => {
    const made = table({ seats: 2, stage: "17050", engaged: [URUK], heroes: [], setAside: SETS, play: [{ code: MUMAK, seat: 0 }, { code: MUMAK, seat: 1 }] });
    const opening = runInstruction(made, opened(made).state, { verb: "PrepareOrcsArea", stages: SETS.slice(0, 4), number: 1 });
    // Seat 1 is out already, its Mûmak in the encounter discard pile; seat 0's Mûmak is still in play when its elimination runs.
    const seat1 = (opening.seats[1]?.play ?? []).find((id) => opening.cards[id]?.code === MUMAK) ?? "";
    const out = withSeat(moveCard(opening, seat1, { zone: "encounterDiscard" }), 1, { ...opening.seats[1]!, eliminated: true });
    const done = settle(finishAttack({ ...out, pendingAttack: { enemyId: idOf(out, URUK), seat: 0, undefended: true, after: [{ verb: "EliminateAfterAttack" } as const] } }, made.ctx, []), made.ctx, []);
    expect(done.lossReason).toBe("Tamed Mûmak left play: Player 1 is eliminated");
  });

  it("two-handed: the attacker left the engagement, and the Mûmak's controller is eliminated while the other player goes on", () => {
    const done = ended(2, true);
    expect(done.seats[0]?.eliminated).toBeTruthy();
    expect(done.seats[1]?.eliminated).toBeFalsy();
    expect(done.lost).toBeFalsy();
  });
});

describe("17050:B:2 after an enemy attacks and destroys a character 1 progress goes on the Orcs' stage", () => {
  it("a hero that defends and is destroyed places 1 progress on the Orcs' stage, whatever stage the players are at", () => {
    const made = table({ stage: "17050", engaged: [URUK], heroes: [], setAside: ["17051", "17052", "17053", "17054", "16061"] });
    const state = runInstruction(made, opened(made).state, { verb: "PrepareOrcsArea", stages: ["17051", "17052", "17053", "17054"], number: 1 });
    const hurt = { ...state, cards: { ...state.cards, [idOf(state, "dh1")]: { ...state.cards[idOf(state, "dh1")]!, damage: 5 } } };
    const arrived = fight(made, opened(made, hurt), (current) => current.window?.kind === "defense");
    const done = fight(made, arrived, (current) => current.pendingAttack == null, { defender: "dh1" });
    expect(done.state.cards[idOf(state, "dh1")]?.zone).toBe("discard");
    expect(done.state.cards[done.state.orcs?.stage ?? ""]?.progress).toBe(1);
  });
});
