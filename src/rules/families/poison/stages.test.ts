// Rules: hob.staging-area-creating, hob.staging-area-combining, mec109.multiple-staging-areas (data/rules/entries.json); ledger lines 132068:B:1, 132069:A:1, 132069:B:2, 132070:A:1. Stage 2B splits the players, stage 3B joins the first player to stage 4, on tables built from data/.
import { describe, expect, it } from "vitest";

import { resolveRecords } from "../../../../test/harness/scene-kit.ts";
import { codeOf, GLADE, spiderTable, STAGE_2, STAGE_3, STAGE_4 } from "../../../../test/scenarios/flies-and-spiders/scene.ts";
import { isolatedAreas, stageOf, stagingOf } from "../breaking/areas.ts";
import { runInstruction } from "../../interpret/interpret.ts";

const revealed = (layout: Parameters<typeof spiderTable>[0] = {}) => {
  const t = spiderTable({ stage: STAGE_2, setAside: [GLADE], ...layout });
  const run = resolveRecords(t.state, t.ctx, STAGE_2, "whenRevealed", t.state.questStage ?? "");
  return { t, state: run.state };
};

describe("stage 2B with two players (132068:B:1)", () => {
  it("the first player takes stage 3 and an area of his own; the other advances to stage 4 and keeps the shared area", () => {
    const { state } = revealed({ seats: 2, staging: ["132032"] });
    expect(state.separate).toBe(true);
    expect(isolatedAreas(state)).toBe(true);
    expect(codeOf(state, stageOf(state, 0))).toBe(STAGE_3);
    expect(codeOf(state, stageOf(state, 1))).toBe(STAGE_4);
    expect(state.cards[stageOf(state, 0) ?? ""]).toMatchObject({ face: "B", controller: 0 });
    expect(state.cards[stageOf(state, 1) ?? ""]).toMatchObject({ face: "B", controller: 1 });
    // The cards of the staging area stay with the player who advances; the Glade, revealed with stage 4A, joins them.
    expect(stagingOf(state, 1).map((id) => codeOf(state, id)).sort()).toEqual([GLADE, "132032"].sort());
    expect(stagingOf(state, 0)).toEqual([]);
  });

  it("3A empties the resource pools of the first player's area and makes his characters unconscious; the other player's are not touched", () => {
    const { state } = revealed({ seats: 2, heroResources: 2 });
    const mine = state.seats[0].heroes;
    expect(mine.length).toBeGreaterThan(0);
    for (const id of mine) expect(state.cards[id]).toMatchObject({ unconscious: true, resources: 0 });
    for (const id of state.seats[1].heroes) expect(state.cards[id]).toMatchObject({ resources: 2 });
    for (const id of state.seats[1].heroes) expect(state.cards[id]?.unconscious).toBeUndefined();
  });
});

describe("stage 2B alone (132068:B:1)", () => {
  it("discards stage 2 and each card of its staging area, and the first player is alone at stage 3 in the one area again", () => {
    const { t, state } = revealed({ seats: 1, staging: ["132032", "132033"] });
    expect(state.separate).toBeUndefined();
    expect(codeOf(state, state.questStage)).toBe(STAGE_3);
    expect(state.staging).toEqual([]);
    expect(state.encounterDiscard.map((id) => codeOf(state, id)).sort()).toEqual(["132032", "132033"].sort());
    const stage2 = Object.values(state.cards).find((card) => card.code === STAGE_2);
    expect(stage2?.zone).toBe("setAside");
    // The Glade stays set aside until stage 4A is revealed.
    expect(Object.values(state.cards).find((card) => card.code === GLADE)?.zone).toBe("setAside");
    expect(t.state.staging.length).toBe(2);
  });
});

describe("stage 2B alone with an active location (132068:B:1)", () => {
  it("keeps the active location, which is not in the staging area, with its progress; the staging cards go", () => {
    const { t, state } = revealed({ seats: 1, staging: ["132032"], active: "132027" });
    const location = t.state.activeLocation ?? "";
    expect(state.cards[location]?.code).toBe("132027");
    expect(state.activeLocation).toBe(location);
    expect(state.cards[location]?.zone).toBe("activeLocation");
    expect(state.staging).toEqual([]);
    expect(state.encounterDiscard.map((id) => codeOf(state, id))).toEqual(["132032"]);
    expect(codeOf(state, state.questStage)).toBe(STAGE_3);
  });

  it("with two players the other player keeps it, as the stage's own", () => {
    const { t, state } = revealed({ seats: 2, active: "132027" });
    expect(state.seats[1].active).toBe(t.state.activeLocation);
  });
});

describe("stage 3B (132069:B:2)", () => {
  it("the first player joins the player at stage 4: his area's cards join the shared area, stage 4A is not revealed again, the areas are one", () => {
    const { t, state } = revealed({ seats: 2, staging: ["132032"] });
    const gladeId = Object.values(state.cards).find((card) => card.code === GLADE)?.id ?? "";
    const here = { ...state, mode: "stopped" as const, window: null };
    const joined = runInstruction(here, { verb: "JoinAtStage", code: STAGE_4 }, { seat: 0, sourceId: stageOf(state, 0) }, t.ctx, []);
    expect(joined.separate).toBeUndefined();
    expect(codeOf(joined, joined.questStage)).toBe(STAGE_4);
    expect(Object.values(joined.cards).filter((card) => card.code === GLADE).length).toBe(1);
    expect(joined.cards[gladeId]?.zone).toBe("staging");
    expect(Object.values(joined.cards).find((card) => card.code === STAGE_3)?.zone).toBe("questDeck");
  });

  it("alone, he advances to stage 4 and it is revealed: the Glade enters the staging area", () => {
    const { t, state } = revealed({ seats: 1 });
    const held = { ...state, mode: "stopped" as const, window: null, stageHeld: state.questStage ?? undefined };
    const out = runInstruction(held, { verb: "JoinAtStage", code: STAGE_4 }, { seat: 0, sourceId: state.questStage }, t.ctx, []);
    expect(codeOf(out, out.questStage)).toBe(STAGE_4);
    expect(out.stageHeld).toBeUndefined();
    expect(out.stack.length).toBeGreaterThan(0);
  });
});
