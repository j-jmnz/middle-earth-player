// Rules: rr.framework-steps, rr.attack-resolution-chart (data/rules/entries.json). Every action window of whole starter
// games is named by what comes next, never the bare "Action window".
import { describe, expect, it } from "vitest";

import { expectOk } from "../rules/fixture.ts";
import { legalIntents, reduce, startScenario, type ScenarioState } from "../rules/reduce.ts";
import { nextIntent } from "../../scripts/auto-player.ts";
import { RING_BEARER, starterStart, starterWorld } from "../../scripts/starter-game.ts";

import { windowSheet } from "./bar-sheets.ts";
import { windowPoint } from "./rail.ts";
import { isStepWindow, sheetFor } from "./sheets.ts";

describe("window names", () => {
  it("names every step window of whole games by its next step", async () => {
    const titles = new Set<string>();
    for (const deckId of ["stealth-and-steadfastness", "wisdom-and-wizardry"]) {
      const { ctx } = await starterWorld(deckId);
      for (const seed of [1, 2, 9]) {
        let state: ScenarioState = expectOk(reduce(startScenario(starterStart(deckId, seed), ctx), { type: "Keep" }, ctx)).state;
        const memory = new Set<string>();
        const policy = { scout: "", prefer: "141035", protect: RING_BEARER, play: true, act: true };
        for (let turn = 0; turn < 3000 && !state.lost && !(state.stageCleared && state.window == null); turn += 1) {
          const legal = legalIntents(state, ctx);
          if (isStepWindow(state) && sheetFor(state, ctx, legal, { card: (id) => id, line: () => null }) == null) {
            const point = windowPoint(state);
            expect(point, `${state.mode} ${state.stepWindows.join(",")}`).not.toBeNull();
            const sheet = windowSheet(state, ctx, legal, { card: (id) => id, line: () => null });
            expect(sheet.title).not.toBe("Action window");
            titles.add(sheet.title);
          }
          state = expectOk(reduce(state, nextIntent(state, ctx, policy, memory), ctx)).state;
        }
      }
    }
    expect(titles.has("Before the quest resolves")).toBe(true);
  }, 120_000);
});
