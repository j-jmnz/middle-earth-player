// Rules: rr.step-6-4-3, rr.damage, rr.step-7-3, rr.framework-steps (data/rules/entries.json). The banner resolves in beats
// (each line names the cards it touches), says when a destroyed defender left the attack undefended, reads a heal as a
// heal, and sums the round when it ends; the store keeps the last moment worth showing; the first-game guide has a line
// for each step.
import { describe, expect, it } from "vitest";

import { EFFECTS } from "../effects/index.ts";
import { expectOk } from "../rules/core/test-fixture.ts";
import type { EngineStep } from "../rules/core/intents.ts";
import { reduce, startScenario, type ScenarioState } from "../rules/engine/reduce.ts";
import { nextIntent } from "../../scripts/auto-player.ts";
import { RING_BEARER, starterStart, starterWorld } from "../../scripts/starter-game.ts";
import { buildTable, idsOf, SAM, sceneCards } from "../../scripts/test-scene.ts";

import { finishedRoundSteps, momentOf, roundSummary } from "./outcome.ts";
import { guideLine } from "./reference.ts";
import { createTableStore } from "./store.ts";

const rule = (id: string) => ({ rule: id });

describe("banner lines", () => {
  it("name the cards each beat touches, say a heal is a heal, and why an attack became undefended", async () => {
    const base = await sceneCards();
    const table = buildTable(base, { engaged: [{ code: "f3", seat: 0 }] });
    const sam = idsOf(table, SAM);
    const enemy = idsOf(table, "f3");
    const before: ScenarioState = { ...table.state, pendingAttack: { enemyId: enemy, seat: 0, defenderId: sam, undefended: false, shadowResolved: false } as never };
    const steps: EngineStep[] = [
      { kind: "destroy", targetId: sam },
      { kind: "strike", side: "enemy", enemyId: enemy, targetId: "hero", attack: 3, defense: 0, undefended: true, cause: rule("rr.step-6-4-3") },
      { kind: "damage", targetId: "hero", amount: 3, cause: rule("rr.step-6-4-3") },
      { kind: "damage", targetId: sam, amount: -2, cause: rule("rr.damage") },
    ];
    const moment = momentOf(before, table.state, steps, { card: (id) => id });
    // The attack leads the banner; the destruction that came before it, with no group of its own, follows.
    expect(moment?.lines.map((line) => [line.text, line.cards ?? []])).toEqual([
      [`With ${sam} gone, the attack is undefended`, [sam]],
      [`Attack 3 on hero, undefended`, [enemy, "hero"]],
      [`3 damage on hero`, ["hero"]],
      [`2 damage healed on ${sam}`, [sam]],
      [`${sam} is destroyed`, [sam]],
    ]);
  });
});

describe("the round summary", () => {
  it("keeps the round's steps up to the refresh's threat, and sums them", () => {
    const steps: EngineStep[] = [
      { kind: "draw", seat: 0, cardId: "c", cause: rule("rr.step-1-3") },
      { kind: "progress", targetId: "q", amount: 3, cause: rule("rr.step-3-4") },
      { kind: "threat", seat: 0, amount: 2, cause: rule("rr.step-3-4") },
      { kind: "damage", targetId: "hero", amount: 1, cause: rule("rr.step-6-4-3") },
      { kind: "damage", targetId: "orc", amount: 4, cause: rule("rr.step-6-8-3") },
      { kind: "destroy", targetId: "orc" },
      { kind: "threat", seat: 0, amount: 1, cause: rule("rr.step-7-3") },
      { kind: "draw", seat: 0, cardId: "next", cause: rule("rr.step-1-3") },
    ];
    const finished = finishedRoundSteps(steps);
    expect(finished).toHaveLength(7);
    const after = { seatCount: 1, seats: [{ threat: 33 }], cards: {} } as unknown as ScenarioState;
    const summary = roundSummary(2, finished, after, (id) => id === "hero");
    expect(summary?.title).toBe("Round 2 ends");
    expect(summary?.lines.map((line) => line.text)).toEqual(["Threat 30 → 33", "3 progress placed", "1 damage taken, 4 dealt", "1 encounter card defeated or explored", "1 card drawn"]);
  });

  it("is carried by the moment that ends a round, and the banner keeps the last moment worth showing", async () => {
    const { ctx } = await starterWorld("wisdom-and-wizardry");
    const kept = expectOk(reduce(startScenario(starterStart("wisdom-and-wizardry", 2), { ...ctx, effects: EFFECTS }), { type: "Keep" }, ctx)).state;
    const store = createTableStore({ ctx, game: kept });
    const memory = new Set<string>();
    let sawEnd = false;
    for (let turn = 0; turn < 600 && !store.getState().game.lost && !sawEnd; turn += 1) {
      const before = store.getState().shown;
      const state = store.getState().game;
      expect(store.getState().dispatch(nextIntent(state, ctx, { scout: "", prefer: "141035", protect: RING_BEARER }, memory))).toBe(true);
      const moment = store.getState().moment;
      if (moment?.kind === "sent" && moment.steps.length === 0 && !moment.ended) expect(store.getState().shown).toBe(before);
      if (moment?.kind === "sent" && moment.ended) {
        sawEnd = true;
        expect(moment.ended.round).toBe(state.round);
        expect(store.getState().shown).toBe(moment);
      }
    }
    expect(sawEnd).toBe(true);
  }, 60_000);
});

describe("the first-game guide", () => {
  it("has a line for each step the player decides in, and for an action window", async () => {
    const base = await sceneCards();
    const quest = buildTable(base, { start: "quest" });
    expect(guideLine(quest.state, false)).toEqual({ key: "3.2", text: "Commit characters to the quest: they exhaust and add their willpower." });
    expect(guideLine(quest.state, true)?.key).toBe("window");
    const travel = buildTable(base, { start: "travel" });
    expect(guideLine(travel.state, false)?.key).toBe("4.2");
    // A Response inside a step is not the step's decision: Frodo's Response at staging has no staging line.
    expect(guideLine({ ...quest.state, mode: "staging", window: { kind: "response", seat: 0 } }, false)).toBeNull();
  });
});
