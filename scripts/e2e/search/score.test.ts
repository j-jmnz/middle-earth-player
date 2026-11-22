import { describe, expect, it } from "vitest";

import { updateCard } from "../../../src/rules/core/state.ts";
import { tableFromLayout, type Layout } from "../../../test/harness/scene-kit.ts";

import { mustSurvive, safetyOf, scoreOf, scorePartsOf } from "./score.ts";

const built = (layout: Layout = {}) => tableFromLayout("the-uruk-hai", { phase: "Quest", ...layout });

describe("the search's score", () => {
  it("rises with progress and falls with threat and damage", () => {
    const base = built();
    const base0 = scoreOf(base.state, base.ctx);
    const progressed = built({ progress: 3 });
    const threatened = built({ threat: [44, 28] });
    const hurt = updateCard(base.state, base.hero, { damage: 4 });
    expect(scoreOf(progressed.state, progressed.ctx)).toBeGreaterThan(base0);
    expect(scoreOf(threatened.state, threatened.ctx)).toBeLessThan(base0);
    expect(scoreOf(hurt, base.ctx)).toBeLessThan(base0);
  });

  it("counts the victory display, the heroes and the allies in play", () => {
    const base = built();
    const withAlly = built({ play: [{ code: "ally", seat: 0 }] });
    const parts = scorePartsOf(withAlly.state, withAlly.ctx);
    expect(parts.allies).toBeGreaterThan(0);
    expect(parts.heroes).toBe(scorePartsOf(base.state, base.ctx).heroes);
    expect(scoreOf(withAlly.state, withAlly.ctx)).toBeGreaterThan(scoreOf(base.state, base.ctx));
  });

  it("scores a won game above any table and a lost game below", () => {
    const table = built();
    expect(scoreOf({ ...table.state, stageCleared: true }, table.ctx)).toBeGreaterThan(scoreOf(table.state, table.ctx));
    expect(scoreOf({ ...table.state, lost: true, lossReason: "x" }, table.ctx)).toBeLessThan(scoreOf(table.state, table.ctx));
  });

  it("adds a scenario's hook to the generic score", () => {
    const table = built();
    expect(scoreOf(table.state, table.ctx, () => 77) - scoreOf(table.state, table.ctx)).toBe(77);
  });

  it("ranks a seat nearer its elimination lower, steeply near the level", () => {
    const safe = built({ threat: [30, 28] });
    const near = built({ threat: [49, 28] });
    const gap = scoreOf(safe.state, safe.ctx) - scoreOf(near.state, near.ctx);
    expect(gap).toBeGreaterThan(19 * 1.5);
    expect(safetyOf(near.state, near.ctx)).toBeLessThan(safetyOf(safe.state, safe.ctx));
  });

  it("knows no card the game is lost with on a plain table", () => {
    const table = built();
    expect(mustSurvive(table.state, table.ctx, table.hero)).toBe(false);
  });
});
