import { beforeAll, describe, expect, it } from "vitest";

import { legalIntents, reduce } from "../rules/reduce.ts";
import { updateCard, type ScenarioState } from "../rules/state.ts";
import { openResolution, resolutionResult } from "../rules/resolution.ts";
import { begin, buildTable, FRODO, idsOf, SAM, sceneCards, send, type Run, type Table } from "../../scripts/test-scene.ts";

import { applyResolution, EMPTY_LOG } from "./resolution.ts";

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

function choicesOf(state: ScenarioState, group: number): string[] {
  return state.resolution[group]?.choices.map((choice) => choice.code) ?? [];
}

describe("win detection from stage 3", () => {
  it("the location leaves play explored, its questResolution record wins, and the first reward group opens", () => {
    const { run, table } = winningQuest();
    expect(run.state.cards[idsOf(table, "141035")]?.zone).toBe("encounterDiscard");
    expect(run.state.stageCleared).toBe(true);
    expect(run.state.lost).toBe(false);
    expect(run.state.stack).toEqual([]);
    expect(run.state.window).toEqual({ kind: "resolution", group: 0 });
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
    const { run } = winningQuest();
    const frame = { id: "f99", frame: "reveal" as const, cardId: null, seat: 0, peril: false, step: 0, data: { kind: "none" as const } };
    const pending: ScenarioState = { ...run.state, window: null, stack: [frame], resolutionChoices: [] };
    const opened = openResolution(pending);
    expect(opened.stack).toEqual([]);
    expect(opened.stageCleared).toBe(true);
    expect(opened.lost).toBe(false);
    expect(opened.window).toEqual({ kind: "resolution", group: 0 });
  });
});

describe("resolution window", () => {
  it("offers the codes of one group at a time, in order, and refuses anything else", () => {
    const { run, table } = winningQuest();
    const first = choicesOf(run.state, 0);
    const second = choicesOf(run.state, 1);
    expect(first).toHaveLength(2);
    expect(second).toHaveLength(2);
    expect(legalIntents(run.state, table.ctx)).toEqual(first.map((optionId) => ({ type: "ChooseResolution", optionId })));
    const wrongGroup = reduce(run.state, { type: "ChooseResolution", optionId: second[0] ?? "" }, table.ctx);
    expect(wrongGroup.ok).toBe(false);
    if (!wrongGroup.ok) expect(wrongGroup.reason).toBe("That is not a choice in this group");
    expect(reduce(run.state, { type: "Pass" }, table.ctx).ok).toBe(false);

    let next = send(run, { type: "ChooseResolution", optionId: first[1] ?? "" }, table.ctx);
    expect(next.state.window).toEqual({ kind: "resolution", group: 1 });
    expect(resolutionResult(next.state)).toBeNull();
    next = send(next, { type: "ChooseResolution", optionId: second[0] ?? "" }, table.ctx);
    expect(next.state.window).toBeNull();
    expect(legalIntents(next.state, table.ctx)).toEqual([]);
    expect(resolutionResult(next.state)).toEqual([first[1], second[0]]);
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
    const first = choicesOf(run.state, 0);
    const second = choicesOf(run.state, 1);
    const picked = send(send(run, { type: "ChooseResolution", optionId: first[0] ?? "" }, table.ctx), { type: "ChooseResolution", optionId: second[1] ?? "" }, table.ctx);
    return { state: picked.state, table };
  }

  it("records each chosen card once, a Permanent card as attached, and not the cards left on the table", () => {
    const { state, table } = won();
    const [kept, joined] = [choicesOf(state, 0)[0] ?? "", choicesOf(state, 1)[1] ?? ""];
    const log = applyResolution(EMPTY_LOG, state.scenarioId, state, table.ctx.cards);
    expect(log.scenarios[state.scenarioId]?.rewards).toEqual([kept, joined]);
    const permanent = [kept, joined].filter((code) => table.ctx.cards.get(code)?.keywords.permanent);
    expect(log.attached).toEqual(permanent);
    expect(log.pool).toEqual([kept, joined].filter((code) => !permanent.includes(code)));
    for (const code of [...choicesOf(state, 0), ...choicesOf(state, 1)].filter((code) => code !== kept && code !== joined)) {
      expect([...log.pool, ...log.attached]).not.toContain(code);
    }
  });

  it("does not grant the reward a second time", () => {
    const { state, table } = won();
    const once = applyResolution(EMPTY_LOG, state.scenarioId, state, table.ctx.cards);
    const again = applyResolution(once, state.scenarioId, state, table.ctx.cards);
    expect(again).toBe(once);
  });

  it("writes nothing for a loss, or while a choice is still open", () => {
    const { run, table } = winningQuest();
    expect(applyResolution(EMPTY_LOG, run.state.scenarioId, run.state, table.ctx.cards)).toBe(EMPTY_LOG);
    const { state } = won();
    const lost = { ...state, lost: true, lossReason: "test" };
    expect(applyResolution(EMPTY_LOG, state.scenarioId, lost, table.ctx.cards)).toBe(EMPTY_LOG);
    expect(applyResolution(EMPTY_LOG, "other-scenario", state, table.ctx.cards)).toBe(EMPTY_LOG);
  });
});
