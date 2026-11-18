// Rules: mec108.create-staging-area, mec109.multiple-staging-areas, rr.player-elimination, rr.delayed-effects, rr.quest-advancement, rr.victory (data/rules/entries.json); ledger lines 148007:A:2, 148004:A:1, 148004:B:2, 148003:B:2, 148003:B:3.
// Fog on the Barrow-downs' partial split of the staging areas (src/rules/families/breaking/barrow.ts) as the cards play it: a Great Barrow splits a player off to a stage 4A of his own while the others stay at stage 3B (parked when
// nobody is at it), stage 4B sends him back, and an elimination while the areas are apart. Each test starts its title with the line it covers; the verbs' own tests are src/rules/families/breaking/barrow.test.ts and fog.test.ts.
import { describe, expect, it } from "vitest";

import { eliminateSeat } from "../../../rules/core/eliminate.ts";
import type { EngineStep } from "../../../rules/core/intents.ts";
import { livingSeats, updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { spawn } from "../../../rules/core/zones.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { areaSeats, headOf, parkedStage, sharedStaging, stageOf, stagingOf, viewOf } from "../../../rules/families/breaking/areas.ts";
import { restricted } from "../../../rules/interpret/restrictions.ts";
import { runInstruction } from "../../../rules/interpret/interpret.ts";
import { idOf, resolveRecords, revealFromTop, tableFromLayout } from "../../../../test/harness/scene-kit.ts";

const SCENARIO = "fog-on-the-barrow-downs";
const STAGE_3 = "148003";
const STAGE_4 = "148004";
const GREAT_BARROW = "148007";
const STANDING_STONES = "148006";
const WIGHT = "148011";
type Layout = NonNullable<Parameters<typeof tableFromLayout>[1]>;
const table = (layout: Layout = {}) => tableFromLayout(SCENARIO, { stage: STAGE_3, phase: "Quest", ...layout });
const focus = (seat: number, sourceId: string | null = null) => ({ seat, sourceId });
const codeOf = (state: ScenarioState, id: string | null | undefined): string | undefined => (id ? state.cards[id]?.code : undefined);
const stopped = (state: ScenarioState): ScenarioState => ({ ...state, mode: "stopped", window: null });

// The data deals one stage 4A and the card is printed four times: the quest deck holds `copies` more.
function withCopies(state: ScenarioState, copies: number): ScenarioState {
  let next = state;
  for (let copy = 0; copy < copies; copy += 1) next = spawn(next, STAGE_4, { zone: "questDeck" }).state;
  return next;
}

// Seat 1 (the first player) reveals a Great Barrow with a Barrow-wight on top of the encounter deck: seat 1 is at a stage 4A of its own, seat 0 stays at stage 3B.
function trapped(layout: Layout = {}) {
  const t = table({ seats: 2, firstPlayer: 1, deck: [WIGHT], staging: ["148009"], ...layout });
  const revealed = revealFromTop(withCopies(t.state, 2), t.ctx, GREAT_BARROW, []);
  return { t, ...revealed };
}

// Both players trapped: seat 0 reveals a Great Barrow of its own after seat 1's.
function bothTrapped() {
  const { t, state } = trapped();
  return { t, state: runInstruction(state, { verb: "SplitToOwnStage", code: STAGE_4 }, focus(0, idOf(state, GREAT_BARROW)), t.ctx, []) };
}

describe("148007:A:2 a Great Barrow entering the staging area splits its player off", () => {
  it("148007:A:2 he leaves the quest for a stage 4A of his own, side B up, and the others keep stage 3B, its staging area and the Great Barrow", () => {
    const { state, id } = trapped();
    expect(state.separate).toBe(true);
    expect(state.questStage).toBeNull();
    expect(codeOf(state, stageOf(state, 0))).toBe(STAGE_3);
    expect(codeOf(state, stageOf(state, 1))).toBe(STAGE_4);
    expect(state.cards[stageOf(state, 1) ?? ""]).toMatchObject({ face: "B", controller: 1 });
    expect(stagingOf(state, 0)).toContain(id);
    expect(stagingOf(state, 1).map((card) => codeOf(state, card))).toEqual([WIGHT]);
    expect(parkedStage(state)).toBeNull();
    // Each seat has an area of its own: each one's first player is itself.
    expect([...areaSeats(state)].sort()).toEqual([0, 1]);
    expect(headOf(state, 0)).toBe(0);
    expect(headOf(state, 1)).toBe(1);
  });

  it("148007:A:2 his committed characters leave the quest", () => {
    const t = table({ seats: 2, firstPlayer: 1, deck: [WIGHT], committed: ["dh1"] });
    const hero = t.state.seats[0].heroes[0] ?? "";
    expect(t.state.cards[hero]?.committed).toBe(true);
    // Seat 0 (the one the committed hero belongs to) reveals the Great Barrow.
    const { state } = revealFromTop(withCopies({ ...t.state, firstPlayer: 0 }, 2), t.ctx, GREAT_BARROW, []);
    expect(state.cards[hero]?.committed).toBe(false);
    expect(codeOf(state, stageOf(state, 0))).toBe(STAGE_4);
  });

  it("148007:A:2 a player alone at the shared stage parks it: the stage stays in play, with its cards, in no player's area", () => {
    const t = table({ seats: 1, deck: [WIGHT], staging: ["148009"] });
    const { state, id } = revealFromTop(withCopies(t.state, 1), t.ctx, GREAT_BARROW, []);
    expect(codeOf(state, stageOf(state, 0))).toBe(STAGE_4);
    expect(codeOf(state, parkedStage(state))).toBe(STAGE_3);
    expect(state.cards[parkedStage(state) ?? ""]?.zone).toBe("questStage");
    expect(sharedStaging(state)).toContain(id);
    expect(sharedStaging(state).map((card) => codeOf(state, card))).toContain("148009");
    // What 4A gave him is his own area: not the parked one.
    expect(stagingOf(state, 0).map((card) => codeOf(state, card))).toEqual([WIGHT]);
  });

  it("148007:A:2 a second player trapped parks the stage the first left with him, and a player already at stage 4A is not split again", () => {
    const { t, state } = bothTrapped();
    expect(codeOf(state, stageOf(state, 0))).toBe(STAGE_4);
    expect(codeOf(state, stageOf(state, 1))).toBe(STAGE_4);
    expect(codeOf(state, parkedStage(state))).toBe(STAGE_3);
    expect(runInstruction(state, { verb: "SplitToOwnStage", code: STAGE_4 }, focus(0, null), t.ctx, [])).toBe(state);
  });
});

describe("148004:B:2 returning to stage 3B", () => {
  it("148004:B:2 the player joins the one at stage 3B: his enemies and locations move to that area, engaged enemies stay engaged, and the areas are one again", () => {
    const { t, state } = trapped();
    const wight = stagingOf(state, 1)[0] ?? "";
    const engaged = spawn(state, WIGHT, { zone: "engaged", seat: 1 });
    const four = stageOf(state, 1);
    const returned = runInstruction(engaged.state, { verb: "ReturnToSharedStage", code: STAGE_3 }, focus(1, four), t.ctx, []);
    expect(returned.separate).toBeUndefined();
    expect(returned.isolated).toBeUndefined();
    expect(codeOf(returned, returned.questStage)).toBe(STAGE_3);
    expect(returned.staging).toContain(wight);
    expect(returned.cards[engaged.id]).toMatchObject({ zone: "engaged", controller: 1 });
    // The stage 4B copy is back in the quest deck with no progress, for the next player a Great Barrow traps.
    expect(returned.questDeck.filter((card) => codeOf(returned, card) === STAGE_4)).toHaveLength(3);
    expect(returned.cards[four ?? ""]).toMatchObject({ zone: "questDeck", progress: 0 });
    expect(livingSeats(returned).every((seat) => headOf(returned, seat) === seat)).toBe(true);
  });

  it("148004:B:2 with nobody at stage 3B he takes the parked stage, and the areas stay apart while another player is still trapped", () => {
    const { t, state } = bothTrapped();
    const parked = parkedStage(state);
    const staged = sharedStaging(state);
    const returned = runInstruction(state, { verb: "ReturnToSharedStage", code: STAGE_3 }, focus(1, stageOf(state, 1)), t.ctx, []);
    expect(returned.separate).toBe(true);
    expect(stageOf(returned, 1)).toBe(parked);
    expect(parkedStage(returned)).toBeNull();
    for (const id of staged) expect(stagingOf(returned, 1)).toContain(id);
    expect(codeOf(returned, stageOf(returned, 0))).toBe(STAGE_4);
  });

  it("148004:B:2 the return waits for the beginning of the travel phase, then 1 progress goes on a Great Barrow at stage 3B (explored here: 1 quest point)", () => {
    const { t, state } = trapped();
    const four = stageOf(state, 1) ?? "";
    const barrow = idOf(state, GREAT_BARROW);
    const record = t.ctx.effects.find((effect) => effect.id === "148004:forced:2");
    const held = { ...state, stageHeld: four, window: null };
    const scheduled = settle({ ...runInstruction(held, { verb: "Delay", until: "beginningOfTravel", instructions: record?.instructions[0]?.verb === "Delay" ? record.instructions[0].instructions : [] }, focus(1, four), t.ctx, []), mode: "stopped" }, t.ctx, []);
    // Until then he is still at stage 4B.
    expect(scheduled.delayed.map((entry) => entry.until)).toEqual(["beginningOfTravel"]);
    expect(scheduled.separate).toBe(true);
    const travel = settle({ ...scheduled, phase: "Travel", boundaryPhase: "Quest", mode: "travel", window: null }, t.ctx, []);
    expect(travel.delayed).toEqual([]);
    expect(travel.separate).toBeUndefined();
    expect(codeOf(travel, travel.questStage)).toBe(STAGE_3);
    expect(travel.stageHeld).toBeUndefined();
    expect(travel.cards[barrow]?.zone).toBe("victory");
  });

  it("148004:B:2 a stage 4B that leaves play with its eliminated player sends one Great Barrow to the victory display, and adds no progress (the designer's ruling)", () => {
    const { state } = trapped();
    const steps: EngineStep[] = [];
    const settled = settle(stopped(eliminateSeat({ ...state, firstPlayer: 0 }, 1, steps)), tableFromLayout(SCENARIO, { stage: STAGE_3 }).ctx, steps);
    expect(livingSeats(settled)).toEqual([0]);
    const barrows = Object.values(settled.cards).filter((card) => card.code === GREAT_BARROW);
    expect(barrows.filter((card) => card.zone === "victory")).toHaveLength(1);
    expect(barrows.every((card) => card.progress === 0)).toBe(true);
  });
});

describe("148003:B:2 an elimination while the areas are apart", () => {
  it("148003:B:2 the player at stage 3B raises his threat by 10 when the trapped player is eliminated, and the areas are one again", () => {
    const { t, state } = trapped();
    const steps: EngineStep[] = [];
    const settled = settle(stopped(eliminateSeat({ ...state, firstPlayer: 0 }, 1, steps)), t.ctx, steps);
    expect(settled.seats[0].threat).toBe(state.seats[0].threat + 10);
    expect(settled.separate).toBeUndefined();
    expect(codeOf(settled, settled.questStage)).toBe(STAGE_3);
    // The trapped player's stage is back in the quest deck and his staging cards in the encounter discard pile.
    expect(settled.questDeck.filter((card) => codeOf(settled, card) === STAGE_4)).toHaveLength(3);
    expect(settled.encounterDiscard.map((card) => codeOf(settled, card))).toContain(WIGHT);
  });

  it("148003:B:2 a trapped player's elimination raises nobody when he was the one at stage 3B's side, and the eliminated player at stage 3B leaves it parked", () => {
    const { t, state } = trapped();
    const stage = stageOf(state, 0) ?? "";
    const steps: EngineStep[] = [];
    const settled = settle(stopped(eliminateSeat(state, 0, steps)), t.ctx, steps);
    // Nobody is at stage 3B: nobody is raised, and the stage stays in play, parked, with its cards.
    expect(settled.seats[1].threat).toBe(state.seats[1].threat);
    expect(parkedStage(settled)).toBe(stage);
    expect(settled.cards[stage]?.zone).toBe("questStage");
    expect(sharedStaging(settled)).toEqual(expect.arrayContaining([...state.seats[0].staging]));
  });
});

describe("148003:B:3 defeating stage 3B", () => {
  it("148003:B:3 cannot be defeated while a player is apart, even with Standing Stones in the victory display, and can once every player is at the stage", () => {
    const apart = trapped({ victory: [STANDING_STONES] });
    const stage = stageOf(apart.state, 0) ?? "";
    const holds = (state: ScenarioState, ctx: typeof apart.t.ctx, seat: number) => restricted(viewOf(state, seat), ctx, "advance").some((rule) => state.cards[rule.sourceId]?.code === STAGE_3);
    expect(holds(apart.state, apart.t.ctx, 0)).toBe(true);
    const together = table({ seats: 2, victory: [STANDING_STONES] });
    expect(holds(together.state, together.ctx, 0)).toBe(false);
    // Without Standing Stones it holds even for players who share the stage.
    const without = table({ seats: 2 });
    expect(holds(without.state, without.ctx, 0)).toBe(true);
    expect(stage).toBeTruthy();
  });

  it("148003:B:3 defeating it wins the game for the players who share it, with a second player eliminated while apart", () => {
    const { t, state } = trapped({ victory: [STANDING_STONES] });
    const steps: EngineStep[] = [];
    const alone = settle(stopped(eliminateSeat({ ...state, firstPlayer: 0 }, 1, steps)), t.ctx, steps);
    const stage = alone.questStage ?? "";
    const points = 16;
    const done = runInstruction(updateCard(alone, stage, { progress: points }), { verb: "AdvanceStage" }, focus(0, stage), t.ctx, []);
    const won = resolveRecords({ ...done, window: null }, t.ctx, STAGE_3, "forced", stage);
    expect(done.stageHeld).toBe(stage);
    expect(won.state.stageCleared).toBe(true);
  });
});

describe("148004:A:1 discarding until a Wight when the encounter deck runs out", () => {
  const stage4 = (layout: Layout) => {
    const t = table({ seats: 1, stage: STAGE_4, ...layout });
    return { t, run: resolveRecords(t.state, t.ctx, STAGE_4, "whenRevealed", idOf(t.state, STAGE_4)) };
  };

  it("148004:A:1 with the deck out of cards before a Wight, the discard pile is shuffled in and the discarding goes on; the Wight joins his staging area", () => {
    const { run } = stage4({ deck: ["f0", "f3"], discard: [WIGHT, "f0"] });
    expect(run.state.staging.map((id) => codeOf(run.state, id))).toEqual([WIGHT]);
    expect(run.state.encounterDiscard.every((id) => codeOf(run.state, id) !== WIGHT)).toBe(true);
  });

  it("148004:A:1 with no Wight in the deck or the discard pile nothing is added to the staging area", () => {
    const { run } = stage4({ deck: ["f0", "f3"], discard: ["f0"] });
    expect(run.state.staging).toEqual([]);
    expect(run.state.encounterDeck).toEqual([]);
  });

  it("148004:A:1 a Wight on top of the deck comes at once, and the discard pile stays where it is", () => {
    const { run } = stage4({ deck: ["f0", WIGHT, "f3"], discard: ["f3"] });
    expect(run.state.staging.map((id) => codeOf(run.state, id))).toEqual([WIGHT]);
    expect(run.state.encounterDiscard.map((id) => codeOf(run.state, id)).sort()).toEqual(["f0", "f3"]);
    expect(run.state.encounterDeck.map((id) => codeOf(run.state, id))).toEqual(["f3"]);
  });
});
