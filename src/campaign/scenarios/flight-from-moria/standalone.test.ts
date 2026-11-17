// Rules: rr.setup, rr.winning-the-game, dwd.setup-flight-from-moria, dwd.creating-the-quest-deck (data/rules/entries.json).
// What is Flight from Moria's own in the standalone game: the Nightmare deck dealt on Nightmare (its recipe takes out Blocked by Shadow, a New Devilry and the Stray Goblins, and shuffles in Pursued by Shadow, Blocked by Flame and Ghâsh and the five new encounter cards), the order of the stage 2s in the quest deck
// and the A Foe Beyond copies of each difficulty. The cycle checks (a part of its cycle, no campaign card, playable, scored and recorded as a standalone run with nothing earned, the loss reasons) are the golden suite's (test/harness/golden-suite.ts).
import { describe, expect, it } from "vitest";

import { loadAnyScenario } from "../../../../scripts/data/load-scenarios.ts";
import { goldenState } from "../../../../test/harness/golden-state.ts";

const moria = loadAnyScenario("flight-from-moria");
const zonesOf = (code: string, name: string) => Object.values(goldenState(moria.id, name).cards).filter((card) => card.code === code).map((card) => card.zone);
const countOf = (code: string, name: string) => zonesOf(code, name).length;
const NIGHTMARE_CARDS = ["901205", "901206", "901207", "901208", "901209"];

describe("Flight from Moria in the dwarrowdelf cycle", () => {
  it("deals its Nightmare deck on Nightmare (every card of it has a record)", () => {
    const state = goldenState(moria.id, "Nightmare solo win");
    expect(Object.values(state.cards).some((card) => card.code === moria.nightmare?.setupCard && card.zone === "nightmare")).toBe(true);
    for (const code of NIGHTMARE_CARDS) expect(countOf(code, "Nightmare solo win"), code).toBeGreaterThan(0);
    for (const code of NIGHTMARE_CARDS) expect(countOf(code, "solo win"), code).toBe(0);
  });

  it("901201:B:1 takes Blocked by Shadow, a New Devilry and the Stray Goblins out on Nightmare, and 901202, 901203 and 901204 take their places among the stage 2s", () => {
    expect(countOf("03075", "solo win")).toBe(1);
    expect(countOf("03075", "Nightmare solo win")).toBe(0);
    expect(countOf("03026", "Nightmare solo win")).toBe(countOf("03026", "solo win") - 1);
    expect(countOf("03044", "solo win")).toBe(3);
    expect(countOf("03044", "Nightmare solo win")).toBe(0);
    for (const code of ["901202", "901203", "901204"]) {
      expect(countOf(code, "Nightmare solo win"), code).toBe(1);
      expect(countOf(code, "solo win"), code).toBe(0);
    }
  });

  it("03069:A:1 shuffles the stage 2s in, so the won games end on a stage that wins the game: Blocked by Shadow or Escape from Darkness, and Pursued by Shadow on Nightmare", () => {
    for (const name of ["solo win", "Easy two-handed win"]) {
      const state = goldenState(moria.id, name);
      expect(["03075", "03076"], name).toContain(state.cards[state.questStage ?? ""]?.code);
    }
    for (const name of ["Nightmare solo win", "Nightmare two-handed win"]) {
      const state = goldenState(moria.id, name);
      expect(state.cards[state.stageLeft?.from ?? ""]?.code, name).toBe("901202");
    }
  });

  it("03069:A:1 shuffles 1 copy of A Foe Beyond for each player into the encounter deck: Easy deals one copy, the other difficulties four", () => {
    expect(countOf("03028", "Easy solo win")).toBe(1);
    expect(countOf("03028", "Easy two-handed win")).toBe(1);
    expect(countOf("03028", "solo win")).toBe(4);
    expect(countOf("03028", "two-handed win")).toBe(4);
  });
});
