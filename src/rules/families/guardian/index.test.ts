// Rules: sotm.guarding-gollum, rr.ownership-and-control, rr.first-player, rr.cannot, rr.in-play-and-out-of-play, rr.removed-from-game (data/rules/entries.json). The guardian family's verbs and hooks on their own (the cards that use them are tested in src/campaign/scenarios/return-to-mirkwood):
// the guard is the controller of the Gollum card, the seat selector, ForEachPlayer's `seats`, ChangeGuardian, EngageAll `inPlay`, Restrict `guardian`, and RemoveDiscardFromGame.
import { describe, expect, it } from "vitest";

import type { Instruction } from "../../../catalog/boundary.ts";
import type { EngineStep } from "../../core/intents.ts";
import { first, idOf, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";
import { eliminateSeat } from "../../core/eliminate.ts";
import { runInstruction } from "../../interpret/interpret.ts";
import { seatFor } from "../../interpret/verbs.ts";
import { seatBarred } from "../../interpret/restrictions.ts";
import { spawn } from "../../core/zones.ts";
import type { ScenarioState } from "../../core/state.ts";
import { guardianSeats, guardedGollum, guardianSeat, otherThanGuardian } from "./seats.ts";

const GOLLUM = "02130";
const table = (layout: Layout = {}) => tableFromLayout("return-to-mirkwood", { seats: 2, play: [{ code: GOLLUM, seat: 0 }], ...layout });
const run = (made: ReturnType<typeof table>, instruction: Instruction, state: ScenarioState = made.state, seat = 0): ScenarioState => runInstruction(state, instruction, { seat, sourceId: null }, made.ctx, [] as EngineStep[]);

describe("the guard is the controller of the Gollum card", () => {
  it("is the seat of the Gollum card in play, and nobody before he is placed or when he is set aside", () => {
    expect(guardianSeat(table().state)).toBe(0);
    expect(guardianSeat(table({ play: [{ code: GOLLUM, seat: 1 }] }).state)).toBe(1);
    expect(guardianSeat(table({ play: [], setAside: [GOLLUM] }).state)).toBeNull();
    expect(guardedGollum(table().state)?.code).toBe(GOLLUM);
  });

  it("seatFor reads who: guardian, the actor when nobody guards him", () => {
    const made = table({ play: [{ code: GOLLUM, seat: 1 }] });
    expect(seatFor(made.state, "guardian", 0)).toBe(1);
    expect(seatFor(table({ play: [] }).state, "guardian", 0)).toBe(0);
    expect(seatFor(made.state, "firstPlayer", 1)).toBe(0);
    expect(seatFor(made.state, "actor", 1)).toBe(1);
  });

  it("the other players are listed from the first player on, the eliminated ones left out", () => {
    const made = table({ seats: 2, firstPlayer: 1, play: [{ code: GOLLUM, seat: 0 }] });
    expect(otherThanGuardian(made.state)).toEqual([1]);
    const steps: EngineStep[] = [];
    expect(otherThanGuardian(eliminateSeat(made.state, 1, steps))).toEqual([]);
  });
});

describe("ChangeGuardian", () => {

  it("sotm.guarding-gollum passes Gollum, with his attachments, to the player picked last, and announces a change of control", () => {
    const made = table({ attached: [{ code: "attachment", to: GOLLUM }] });
    const state = run(made, { verb: "ChangeGuardian" }, picked(made, 1));
    expect(guardianSeat(state)).toBe(1);
    expect(state.cards[idOf(state, "attachment")]?.host).toBe(first(state, GOLLUM));
    expect(state.pendingEvents?.some((event) => event.trigger === "changedControl" && event.cardId === first(state, GOLLUM))).toBe(true);
  });

  it("rr.cannot does nothing while a card says the guard cannot change, when the same player is picked, or when none is", () => {
    const made = table();
    const locked = { ...made.state, modifiers: [...made.state.modifiers, { instanceId: "table", sourceId: "x", stat: "guardianLocked" as const, amount: 1, until: "endOfGame" as const }] };
    expect(guardianSeat(run(made, { verb: "ChangeGuardian" }, picked({ ...made, state: locked }, 1)))).toBe(0);
    expect(guardianSeat(run(made, { verb: "ChangeGuardian" }, picked(made, 0)))).toBe(0);
    expect(guardianSeat(run(made, { verb: "ChangeGuardian" }))).toBe(0);
  });
});

// A frame that has picked the seat, as a Pick of a player leaves it.
function picked(made: ReturnType<typeof table>, seat: number): ScenarioState {
  const frame = { frame: "forced" as const, cardId: null, seat: 0, peril: false, data: { kind: "effect" as const, queue: [], picked: [`seat:${seat}`] } };
  return { ...made.state, stack: [frame as unknown as ScenarioState["stack"][number]] };
}

describe("ForEachPlayer with seats", () => {
  it("seats: guardian is the guard alone, and with a treachery's When Revealed while treacheryHitsAll holds, each other player after him", () => {
    const made = table({ firstPlayer: 1 });
    const treachery = idOf(spawn(made.state, "02135", { zone: "encounterDeck" }).state, "02135");
    const withTreachery = spawn(made.state, "02135", { zone: "encounterDeck" }).state;
    expect(guardianSeats(withTreachery, made.ctx, treachery)).toEqual([0]);
    const wide = { ...withTreachery, modifiers: [...withTreachery.modifiers, { instanceId: "table", sourceId: "x", stat: "treacheryHitsAll" as const, amount: 1, until: "endOfGame" as const }] };
    expect(guardianSeats(wide, made.ctx, treachery)).toEqual([0, 1]);
    // An enemy's own effect, or no source at all, is not a treachery's: Dry Watercourse leaves it alone.
    expect(guardianSeats(wide, made.ctx, first(wide, GOLLUM))).toEqual([0]);
    expect(guardianSeats(wide, made.ctx, null)).toEqual([0]);
  });

  it("a shadow card dealt to an enemy that holds shadowHitsAll is widened, one dealt to another enemy is not", () => {
    const made = table();
    const enemy = spawn(made.state, "f3", { zone: "engaged", seat: 0 });
    const shadow = spawn(enemy.state, "02135", { zone: "shadow", enemyId: enemy.id });
    const flagged = { ...shadow.state, modifiers: [...shadow.state.modifiers, { instanceId: enemy.id, sourceId: enemy.id, stat: "shadowHitsAll" as const, amount: 1, until: "endOfGame" as const }] };
    expect(guardianSeats(shadow.state, made.ctx, shadow.id)).toEqual([0]);
    expect(guardianSeats(flagged, made.ctx, shadow.id)).toEqual([0, 1]);
  });
});

describe("EngageAll inPlay", () => {
  it("02129:B:1 engages the enemies of the staging area and those engaged with another player, with the guard", () => {
    const made = table({ staging: ["f0"], engaged: [{ code: "f3", seat: 1 }] });
    const state = run(made, { verb: "EngageAll", who: "guardian", inPlay: true });
    expect(state.seats[0]?.engaged).toHaveLength(2);
    expect(state.seats[1]?.engaged).toHaveLength(0);
    // Without inPlay only the staging area is engaged, as ever.
    const staged = run(made, { verb: "EngageAll", who: "guardian" });
    expect(staged.seats[0]?.engaged).toHaveLength(1);
    expect(staged.seats[1]?.engaged).toHaveLength(1);
  });
});

describe("Restrict guardian", () => {
  it("02127:B:1 binds the guard only, and not when he is alone", () => {
    const made = table({ stage: "02127" });
    expect(seatBarred(made.state, made.ctx, 0, "commit")).toBe(true);
    expect(seatBarred(made.state, made.ctx, 1, "commit")).toBe(false);
    const steps: EngineStep[] = [];
    expect(seatBarred(eliminateSeat(made.state, 1, steps), made.ctx, 0, "commit")).toBe(false);
  });

  it("02128:B:1 bars the play from the hand of the guard", () => {
    const made = table({ stage: "02128" });
    expect(seatBarred(made.state, made.ctx, 0, "playFromHand")).toBe(true);
    expect(seatBarred(made.state, made.ctx, 1, "playFromHand")).toBe(false);
    expect(seatBarred(table({ stage: "02127" }).state, made.ctx, 0, "playFromHand")).toBe(false);
  });
});

describe("RemoveDiscardFromGame", () => {
  it("900908:A:1 removes the acting player's whole discard pile from the game, and the other player's stays", () => {
    const made = table();
    const mine = spawn(spawn(made.state, "filler", { zone: "discard", seat: 0 }).state, "filler", { zone: "discard", seat: 0 }).state;
    const both = spawn(mine, "filler", { zone: "discard", seat: 1 }).state;
    const state = run(made, { verb: "RemoveDiscardFromGame" }, both);
    expect(state.seats[0]?.discard).toEqual([]);
    expect(state.removed).toHaveLength(2);
    expect(state.seats[1]?.discard).toHaveLength(1);
  });
});
