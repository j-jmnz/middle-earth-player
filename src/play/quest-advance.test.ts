// Rules: rr.quest-advancement, ltp.quest-advancement (data/rules/entries.json). The quest advance screen's reading of the table
// (quest-advance.ts): which sent intent advanced the quest, and whether the new stage's own When Revealed is asking, on the stages of
// The Caves of Nibin-Dûm (test/scenarios/the-caves-of-nibin-dum/scene.ts): Surprise Attack has each player search for an enemy as it is revealed (41005:A:1).
import { beforeAll, describe, expect, it } from "vitest";

import { syncConstants } from "../rules/interpret/constants.ts";
import { expectOk } from "../rules/core/test-fixture.ts";
import type { EngineStep } from "../rules/core/intents.ts";
import { runInstruction } from "../rules/interpret/interpret.ts";
import { settle } from "../rules/engine/machine.ts";
import { reduce } from "../rules/engine/reduce.ts";
import type { ScenarioState } from "../rules/core/state.ts";
import { cavesTable, loadCavesWorld, type CavesLayout, type CavesWorld } from "../../test/scenarios/the-caves-of-nibin-dum/scene.ts";

import { ledgerLine } from "./ledger.ts";
import { advancedTo, advanceWords, closeLatch, nextLatch, NO_ADVANCE, openAdvance, openingLatch, questView, stageAsks } from "./quest-advance.ts";
import type { TableMoment } from "./store.ts";

let world: CavesWorld;

beforeAll(async () => {
  world = await loadCavesWorld();
});

function make(layout: CavesLayout = {}) {
  const made = cavesTable(world, layout);
  return { ...made, state: syncConstants(made.state, made.ctx) };
}

type Table = ReturnType<typeof make>;

// `amount` progress on the quest, as questing places it, and the engine steps it ran.
function progress(state: ScenarioState, amount: number, ctx: Table["ctx"]): { state: ScenarioState; steps: EngineStep[] } {
  const steps: EngineStep[] = [];
  const placed = runInstruction({ ...state, window: null }, { verb: "ProgressQuest", amount }, { seat: 0, sourceId: state.questStage }, ctx, steps);
  return { state: settle(syncConstants(placed, ctx), ctx, steps), steps };
}

const sent = (before: ScenarioState, after: ScenarioState, steps: readonly EngineStep[], seq = 1): TableMoment => ({ seq, kind: "sent", before, after, steps });

describe("the quest advance screen", () => {
  it("opens on the intent that advanced the quest, at the stage it reached, and not on another", () => {
    const made = make({ seats: 2, stage: "41004", progress: 0, setAside: ["41027"], deck: ["41030", "41031"], discard: ["41031"] });
    const full = progress(made.state, 8, made.ctx);
    expect(advancedTo(sent(made.state, full.state, full.steps, 4), full.state)).toEqual({ seq: 4, stageId: full.state.questStage });
    expect(full.state.cards[full.state.questStage ?? ""]?.code).toBe("41005");
    // Progress that leaves the stage short advances nothing; neither does an undo.
    const short = progress(made.state, 3, made.ctx);
    expect(advancedTo(sent(made.state, short.state, short.steps), short.state)).toBeNull();
    expect(advancedTo({ seq: 2, kind: "undone", intent: { type: "Pass" }, left: full.state, after: made.state, steps: full.steps }, made.state)).toBeNull();
  });

  it("shows the stage's own question while its When Revealed asks, and none once it is answered (41005:A:1)", () => {
    const made = make({ seats: 2, stage: "41004", progress: 0, setAside: ["41027"], deck: ["41030", "41031"], discard: ["41031"] });
    const full = progress(made.state, 8, made.ctx);
    const stageId = full.state.questStage ?? "";
    expect(full.state.window?.kind).toBe("choose");
    expect(stageAsks(full.state, stageId)).toBe(true);
    let current = full.state;
    for (let guard = 0; guard < 12 && current.window?.kind === "choose"; guard += 1) current = expectOk(reduce(current, { type: "Choose", optionId: current.window.options[0] ?? "" }, made.ctx)).state;
    expect(stageAsks(current, stageId)).toBe(false);
  });

  it("names the stage by its place and side, and how it is completed", () => {
    const made = make({ seats: 1, stage: "41004", progress: 0, setAside: ["41027"], deck: ["41030", "41031"], discard: ["41031"] });
    const words = advanceWords(made.state, made.ctx, made.state.questStage ?? "", "The Dark of Nibin-Dûm", ledgerLine);
    expect(words.eyebrow).toBe("Stage 1 of 4");
    expect(words.title).toBe("The Dark of Nibin-Dûm");
    expect(words.detail).toBe("8 quest points to complete it");
  });
});

describe("the quest advance screen's latch", () => {
  it("holds an advance until Progress, then leaves it closed; a newer advance opens it again", () => {
    const made = make({ seats: 1, stage: "41004", progress: 0, setAside: ["41027"], deck: ["41030", "41031"], discard: ["41031"] });
    const game = made.state;
    const stageId = game.questStage ?? "";
    const reached = { seq: 3, stageId };
    const held = nextLatch(NO_ADVANCE, reached, questView(game));
    expect(openAdvance(held, game)).toEqual(reached);
    // The same moment read again changes nothing.
    expect(nextLatch(held, reached, questView(game))).toBe(held);
    const closed = closeLatch(held);
    expect(openAdvance(nextLatch(closed, reached, questView(game)), game)).toBeNull();
    expect(openAdvance(nextLatch(closed, { seq: 5, stageId }, questView(game)), game)).toEqual({ seq: 5, stageId });
  });

  it("opens the table on the stage in play until Progress, and a later advance opens it again", () => {
    const made = make({ seats: 1, stage: "41004", progress: 0, setAside: ["41027"], deck: ["41030", "41031"], discard: ["41031"] });
    const game = made.state;
    const stageId = game.questStage ?? "";
    const opening = openingLatch(questView(game));
    expect(openAdvance(opening, game)).toEqual({ seq: 0, stageId });
    expect(nextLatch(opening, null, questView(game))).toBe(opening);
    const closed = closeLatch(opening);
    expect(openAdvance(closed, game)).toBeNull();
    expect(openAdvance(nextLatch(closed, { seq: 1, stageId }, questView(game)), game)).toEqual({ seq: 1, stageId });
    // A game that is over opens on the table.
    expect(openAdvance(openingLatch(questView({ ...game, lost: true })), game)).toBeNull();
  });

  it("goes back to the table by itself once the stage's question is answered (41005:A:1)", () => {
    const made = make({ seats: 2, stage: "41004", progress: 0, setAside: ["41027"], deck: ["41030", "41031"], discard: ["41031"] });
    const full = progress(made.state, 8, made.ctx);
    const reached = advancedTo(sent(made.state, full.state, full.steps, 2), full.state);
    let latch = nextLatch(NO_ADVANCE, reached, questView(full.state));
    expect(openAdvance(latch, full.state)).toEqual(reached);
    let current = full.state;
    for (let guard = 0; guard < 12 && current.window?.kind === "choose"; guard += 1) {
      current = expectOk(reduce(current, { type: "Choose", optionId: current.window.options[0] ?? "" }, made.ctx)).state;
      latch = nextLatch(latch, null, questView(current));
    }
    expect(openAdvance(latch, current)).toBeNull();
  });

  it("also opens on a seat's own stage once stages are separate (Breaking of the Fellowship, 2B on), where no shared stage exists", () => {
    const moment = (id: string): TableMoment => ({ seq: 3, kind: "sent", before: {} as ScenarioState, after: {} as ScenarioState, steps: [{ kind: "advance", cardId: id } as EngineStep] });
    const view = { questStage: null, seatStages: "stage-a|stage-b" };
    expect(advancedTo(moment("stage-b"), view)).toEqual({ seq: 3, stageId: "stage-b" });
    expect(advancedTo(moment("stage-c"), view)).toBeNull();
    // The screen stays up while that stage is one of the seats' and goes once it is not.
    const latch = nextLatch(NO_ADVANCE, { seq: 3, stageId: "stage-a" }, { ...view, asking: null, over: false });
    expect(openAdvance(latch, view)).toEqual({ seq: 3, stageId: "stage-a" });
    expect(openAdvance(latch, { questStage: null, seatStages: "stage-b" })).toBeNull();
  });
});
