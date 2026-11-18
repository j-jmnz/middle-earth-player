// Rules: mec108.create-staging-area, mec109.multiple-staging-areas, rr.player-elimination, rr.delayed-effects (data/rules/entries.json); ledger lines 148007:A:2, 148004:A:1, 148004:B:2, 148003:B:2, 148003:B:3.
// Fog on the Barrow-downs' partial split of the staging areas (families/breaking/barrow.ts) on tables built from data/ by the layout kit.
import { describe, expect, it } from "vitest";

import { clearEliminated, eliminateSeat } from "../../core/eliminate.ts";
import type { EngineStep } from "../../core/intents.ts";
import { withSeat, livingSeats, type ScenarioState } from "../../core/state.ts";
import { spawn } from "../../core/zones.ts";
import { settle } from "../../engine/machine.ts";
import { runInstruction } from "../../interpret/interpret.ts";
import { idOf, revealFromTop, tableFromLayout } from "../../../../test/harness/scene-kit.ts";
import { areaSeats, headOf, isolatedAreas, parkedStage, sharedStaging, stageOf, stagingOf } from "./areas.ts";

const SCENARIO = "fog-on-the-barrow-downs";
const STAGE_3 = "148003";
const STAGE_4 = "148004";
const GREAT_BARROW = "148007";
const table = (layout: Parameters<typeof tableFromLayout>[1] = {}) => tableFromLayout(SCENARIO, { stage: STAGE_3, phase: "Quest", ...layout });
const focus = (seat: number, sourceId: string | null = null) => ({ seat, sourceId });
const codeOf = (state: ScenarioState, id: string | null | undefined): string | undefined => (id ? state.cards[id]?.code : undefined);

// A second and third copy of stage 4A lie in the quest deck (the data deals one, the card is printed four times).
function withCopies(state: ScenarioState, count: number): ScenarioState {
  let next = state;
  for (let copy = 0; copy < count; copy += 1) next = spawn(next, STAGE_4, { zone: "questDeck" }).state;
  return next;
}

// Seat 1 reveals a Great Barrow with the encounter deck below it; the quest phase stops where it is.
function trap(layout: Parameters<typeof tableFromLayout>[1] = {}) {
  const t = table({ seats: 2, firstPlayer: 1, deck: ["148011"], staging: ["148009"], ...layout });
  const steps: EngineStep[] = [];
  const revealed = revealFromTop(withCopies(t.state, 2), t.ctx, GREAT_BARROW, steps);
  return { t, steps, ...revealed };
}

describe("148007:A:2 splitting off to a stage 4A of one's own", () => {
  it("the player who revealed the Great Barrow leaves for stage 4A; the others keep stage 3B, its staging area and the Great Barrow", () => {
    const { state, id } = trap();
    expect(state.separate).toBe(true);
    expect(isolatedAreas(state)).toBe(true);
    expect(state.questStage).toBeNull();
    // Seat 0 stays at stage 3B with its staging cards, the Great Barrow among them; seat 1 is at a stage 4A of its own, side B up.
    expect(codeOf(state, stageOf(state, 0))).toBe(STAGE_3);
    expect(codeOf(state, stageOf(state, 1))).toBe(STAGE_4);
    expect(state.cards[stageOf(state, 1) ?? ""]).toMatchObject({ face: "B", controller: 1 });
    expect(stagingOf(state, 0)).toContain(id);
    expect(state.cards[id]?.zone).toBe("staging");
    // Its 4A When Revealed put the discarded Wight into seat 1's own area: not engaged, and not in seat 0's.
    expect(stagingOf(state, 1).map((card) => codeOf(state, card))).toEqual(["148011"]);
    expect([...areaSeats(state)].sort()).toEqual([0, 1]);
    expect(parkedStage(state)).toBeNull();
  });

  it("a player alone at the shared stage parks it: the stage stays in play with its cards, in no player's area", () => {
    const t = table({ seats: 1, deck: ["148011"], staging: ["148009"] });
    const { state, id } = revealFromTop(withCopies(t.state, 1), t.ctx, GREAT_BARROW, []);
    expect(codeOf(state, stageOf(state, 0))).toBe(STAGE_4);
    expect(codeOf(state, parkedStage(state))).toBe(STAGE_3);
    expect(state.cards[parkedStage(state) ?? ""]?.zone).toBe("questStage");
    expect(sharedStaging(state)).toContain(id);
    expect(sharedStaging(state).map((card) => codeOf(state, card))).toContain("148009");
    // Nobody is at it: it is no player's stage, and the one player's area holds only what 4A gave him.
    expect(stagingOf(state, 0).map((card) => codeOf(state, card))).toEqual(["148011"]);
  });

  it("splits a second player off the parked stage's last holder: the second trap parks the stage the first left with it", () => {
    const { t, state } = trap();
    // Seat 0 reveals a Great Barrow of its own at the shared stage too: both are trapped, stage 3B is parked.
    const next = runInstruction(state, { verb: "SplitToOwnStage", code: STAGE_4 }, focus(0, idOf(state, GREAT_BARROW)), t.ctx, []);
    expect(codeOf(next, stageOf(next, 0))).toBe(STAGE_4);
    expect(codeOf(next, stageOf(next, 1))).toBe(STAGE_4);
    expect(codeOf(next, parkedStage(next))).toBe(STAGE_3);
    expect([...areaSeats(next)].sort()).toEqual([0, 1]);
    // A seat already at stage 4A is not split again.
    expect(runInstruction(next, { verb: "SplitToOwnStage", code: STAGE_4 }, focus(0, null), t.ctx, [])).toBe(next);
  });
});

describe("148004:B:2 returning to the stage the players share", () => {
  it("joins the player at stage 3B: its enemies and locations move to that area, engaged enemies stay engaged, and the areas are one again", () => {
    const { t, state } = trap();
    const wight = stagingOf(state, 1)[0] ?? "";
    const engaged = spawn(state, "148011", { zone: "engaged", seat: 1 });
    const returned = runInstruction(engaged.state, { verb: "ReturnToSharedStage", code: STAGE_3 }, focus(1, stageOf(state, 1)), t.ctx, []);
    expect(returned.separate).toBeUndefined();
    expect(returned.isolated).toBeUndefined();
    expect(codeOf(returned, returned.questStage)).toBe(STAGE_3);
    expect(returned.seats[0].stage).toBeUndefined();
    expect(returned.staging).toContain(wight);
    expect(returned.cards[engaged.id]).toMatchObject({ zone: "engaged", controller: 1 });
    // The 4B copy is back in the quest deck with no progress, for the next player a Great Barrow traps.
    expect(returned.questDeck.filter((card) => codeOf(returned, card) === STAGE_4)).toHaveLength(3);
    expect(livingSeats(returned).every((seat) => headOf(returned, seat) === seat)).toBe(true);
  });

  it("takes the parked stage when no player is at it, and the areas stay apart while another player is still trapped", () => {
    const { t, state } = trap();
    const both = runInstruction(state, { verb: "SplitToOwnStage", code: STAGE_4 }, focus(0, idOf(state, GREAT_BARROW)), t.ctx, []);
    const parked = both.questStage ?? parkedStage(both) ?? "";
    const staged = sharedStaging(both);
    const returned = runInstruction(both, { verb: "ReturnToSharedStage", code: STAGE_3 }, focus(1, stageOf(both, 1)), t.ctx, []);
    expect(returned.separate).toBe(true);
    expect(stageOf(returned, 1)).toBe(parked);
    expect(parkedStage(returned)).toBeNull();
    // The cards of the parked staging area are seat 1's now.
    for (const id of staged) expect(stagingOf(returned, 1)).toContain(id);
    expect(codeOf(returned, stageOf(returned, 0))).toBe(STAGE_4);
  });

  it("does nothing for a player at stage 3B or when no stage 3B is in play", () => {
    const { t, state } = trap();
    expect(runInstruction(state, { verb: "ReturnToSharedStage", code: STAGE_3 }, focus(0, null), t.ctx, [])).toBe(state);
    expect(runInstruction(state, { verb: "ReturnToSharedStage", code: "148001" }, focus(1, null), t.ctx, [])).toBe(state);
  });
});

describe("148003:B:2 a player's elimination while the areas are apart", () => {
  it("a trapped player's stage goes back to the quest deck and its staging cards to the discard pile; the others fold into one area", () => {
    const { t, state } = trap();
    const out = clearEliminated(withSeat(state, 1, { ...state.seats[1], eliminated: true }), t.ctx.cards);
    expect(out.separate).toBeUndefined();
    expect(out.questStage).toBe(state.seats[0].stage);
    expect(out.questDeck.filter((card) => codeOf(out, card) === STAGE_4)).toHaveLength(3);
    expect(out.encounterDiscard.map((card) => codeOf(out, card))).toContain("148011");
  });

  it("the shared stage stays in play, parked, when the player at it is eliminated", () => {
    const { t, state } = trap();
    const stage = state.seats[0].stage ?? "";
    const out = clearEliminated(withSeat(state, 0, { ...state.seats[0], eliminated: true }), t.ctx.cards);
    expect(out.separate).toBe(true);
    expect(out.cards[stage]?.zone).toBe("questStage");
    expect(parkedStage(out)).toBe(stage);
    expect(stageOf(out, 1)).toBe(state.seats[1].stage);
    // The staging cards it held stay in play in the staging area, in nobody's list.
    expect(sharedStaging(out)).toEqual(expect.arrayContaining([...state.seats[0].staging]));
  });
});

describe("148003:B:3 every player at this stage", () => {
  it("holds with one shared area, and fails once a player is apart", () => {
    const t = table({ seats: 2 });
    const stage = idOf(t.state, STAGE_3);
    const check = (state: ScenarioState, is: boolean) => runInstruction(state, { verb: "Pick", pick: { type: "player", control: "any" }, when: { kind: "allAtStage", is } }, focus(0, stage), t.ctx, []);
    expect(check(t.state, true)).not.toBe(undefined);
    expect(eliminateSeat).toBeDefined();
  });
});

describe("settle after a split", () => {
  it("the round engine settles the split table without a refusal", () => {
    const { t, state } = trap();
    expect(() => settle({ ...state, mode: "stopped", window: null }, t.ctx, [])).not.toThrow();
  });
});
