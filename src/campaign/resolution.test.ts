import { beforeAll, describe, expect, it } from "vitest";

import { legalIntents, reduce } from "../rules/engine/reduce.ts";
import { updateCard, type ScenarioState } from "../rules/core/state.ts";
import { openResolution, resolutionResult } from "../rules/setup/resolution.ts";
import { begin, buildTable, FRODO, idsOf, SAM, sceneCards, send, type Run, type Table } from "../../scripts/test-scene.ts";

import { applyResolution, emptyLog } from "./log.ts";

let base: Awaited<ReturnType<typeof sceneCards>>;

beforeAll(async () => {
  base = await sceneCards();
});

// Stage 3 with the last location one step from explored. The quest phase explores it.
function winningQuest(): { run: Run; table: Table } {
  const table = buildTable(base, { stage: "141024", active: "141035", deck: ["f0", "f0", "f0"] });
  const location = idsOf(table, "141035");
  const state = updateCard(table.state, location, { progress: 8 });
  const run = send(begin(state), { type: "Commit", cardIds: [idsOf(table, FRODO), idsOf(table, SAM)] }, table.ctx);
  return { run: send(run, { type: "Pass" }, table.ctx), table };
}

const FIRST = ["141078", "141079"];
const SECOND = ["141077", "141017"];

function optionsOf(state: ScenarioState, ctx: Table["ctx"]): string[] {
  return legalIntents(state, ctx).flatMap((intent) => (intent.type === "ChooseResolution" ? [intent.optionId] : []));
}

describe("win detection from stage 3", () => {
  it("the location leaves play explored, its questResolution record wins, and the first resolution choice opens", () => {
    const { run, table } = winningQuest();
    expect(run.state.cards[idsOf(table, "141035")]?.zone).toBe("encounterDiscard");
    expect(run.state.stageCleared).toBe(true);
    expect(run.state.lost).toBe(false);
    expect(run.state.stack).toEqual([]);
    expect(run.state.window).toEqual({ kind: "resolution", step: 0, seat: 0 });
  });

  it("a quest phase that leaves the location short wins nothing", () => {
    const table = buildTable(base, { stage: "141024", active: "141035", deck: ["f0", "f0", "f0"] });
    let run = send(begin(table.state), { type: "Commit", cardIds: [idsOf(table, FRODO)] }, table.ctx);
    run = send(run, { type: "Pass" }, table.ctx);
    expect(run.state.stageCleared).toBe(false);
    expect(run.state.window?.kind).not.toBe("resolution");
  });
});

describe("a win with frames still pending", () => {
  it("drops the pending frames when the resolution window opens, and keeps the win", () => {
    const { run, table } = winningQuest();
    const frame = { id: "f99", frame: "reveal" as const, cardId: null, seat: 0, peril: false, step: 0, data: { kind: "none" as const } };
    const pending: ScenarioState = { ...run.state, window: null, stack: [frame], resolutionAt: 0 };
    const opened = openResolution(pending, table.ctx);
    expect(opened.stack).toEqual([]);
    expect(opened.stageCleared).toBe(true);
    expect(opened.lost).toBe(false);
    expect(opened.window).toEqual({ kind: "resolution", step: 0, seat: 0 });
  });
});

// The records on 141030's back: choose Gandalf's Delay or The Ring Draws Them, then Gildor Inglorion or Mr. Underhill.
describe("resolution window", () => {
  it("asks the first player one choice at a time, in the card's order, and refuses anything else", () => {
    const { run, table } = winningQuest();
    expect(run.state.resolution.map((instruction) => instruction.verb)).toEqual(["ChooseCards", "ChooseCards"]);
    expect(optionsOf(run.state, table.ctx)).toEqual(FIRST);
    const wrong = reduce(run.state, { type: "ChooseResolution", optionId: SECOND[0] ?? "" }, table.ctx);
    expect(wrong.ok).toBe(false);
    if (!wrong.ok) expect(wrong.reason).toBe("That is not a choice here");
    expect(reduce(run.state, { type: "Pass" }, table.ctx).ok).toBe(false);

    let next = send(run, { type: "ChooseResolution", optionId: FIRST[1] ?? "" }, table.ctx);
    expect(next.state.window).toEqual({ kind: "resolution", step: 1, seat: 0 });
    expect(resolutionResult(next.state)).toBeNull();
    next = send(next, { type: "ChooseResolution", optionId: SECOND[0] ?? "" }, table.ctx);
    expect(next.state.window).toBeNull();
    expect(legalIntents(next.state, table.ctx)).toEqual([]);
    expect(resolutionResult(next.state)?.earned.map((item) => item.code)).toEqual([FIRST[1], SECOND[0]]);
  });

  it("cannot be answered with a number or twice", () => {
    const { run, table } = winningQuest();
    expect(reduce(run.state, { type: "ChooseResolution", optionId: "" }, table.ctx).ok).toBe(false);
    expect(reduce(run.state, { type: "RaiseThreat", amount: 1 }, table.ctx).ok).toBe(false);
  });
});

describe("campaign log", () => {
  function won(): { state: ScenarioState; table: Table } {
    const { run, table } = winningQuest();
    const picked = send(send(run, { type: "ChooseResolution", optionId: FIRST[0] ?? "" }, table.ctx), { type: "ChooseResolution", optionId: SECOND[1] ?? "" }, table.ctx);
    return { state: picked.state, table };
  }

  it("records each chosen card once, a Permanent card on the Ring-bearer, and not the cards left on the table", () => {
    const { state, table } = won();
    const log = applyResolution(emptyLog(1), state.scenarioId, state, table.ctx.cards);
    expect(log.completed).toEqual([state.scenarioId]);
    expect(log.campaignPool).toEqual([
      { code: "141078", back: "encounter", burdenSet: "A Shadow of the Past", attachedTo: null, seat: 0 },
      { code: "141017", back: "player", burdenSet: null, attachedTo: FRODO, seat: 0 },
    ]);
    expect(log.campaignPool.map((card) => card.code)).not.toContain("141079");
    expect(log.campaignPool.map((card) => card.code)).not.toContain("141077");
  });

  it("scores the win by the Learn to Play formula", () => {
    const { state, table } = won();
    const log = applyResolution(emptyLog(1), state.scenarioId, state, table.ctx.cards);
    const record = log.scenarios[state.scenarioId];
    expect(record?.rounds).toBe(state.round);
    const damage = state.seats[0]?.heroes.reduce((sum, id) => sum + (state.cards[id]?.damage ?? 0), 0) ?? 0;
    expect(record?.score).toBe((state.seats[0]?.threat ?? 0) + damage + 10 * state.round - (record?.victoryPoints ?? 0));
    expect(log.score).toBe(record?.score);
  });

  it("does not grant the reward a second time", () => {
    const { state, table } = won();
    const once = applyResolution(emptyLog(1), state.scenarioId, state, table.ctx.cards);
    const again = applyResolution(once, state.scenarioId, state, table.ctx.cards);
    expect(again).toBe(once);
  });

  it("writes nothing for a loss, or while a choice is still open", () => {
    const { run, table } = winningQuest();
    const empty = emptyLog(1);
    expect(applyResolution(empty, run.state.scenarioId, run.state, table.ctx.cards)).toBe(empty);
    const { state } = won();
    const lost = { ...state, lost: true, lossReason: "test" };
    expect(applyResolution(empty, state.scenarioId, lost, table.ctx.cards)).toBe(empty);
    expect(applyResolution(empty, "other-scenario", state, table.ctx.cards)).toBe(empty);
  });
});
