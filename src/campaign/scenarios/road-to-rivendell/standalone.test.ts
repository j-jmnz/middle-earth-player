// Rules: rr.setup, rr.winning-the-game, dwd.setup-road-to-rivendell, dwd.ally-objective-arwen-road-to-rivendell (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import { loadAnyScenario } from "../../../../scripts/data/load-scenarios.ts";
import { goldenState } from "../../../../test/harness/golden-state.ts";

// What is Road to Rivendell's own in the standalone game: the Nightmare deck dealt on Nightmare (its recipe takes Orc Outpost, Ruined Road and Barren Hills out, one Goblin Taskmaster too, and shuffles Ambush in the Night's stage, Uruk Elf-stalker, Goblin Trapper,
// Raiding Party, Vicious Trackers, Treacherous Bluffs, Concealed Woods and Tumultuous Assault in), the Easy counts (no Sleeping Sentry, no Orc Ambush, 1 Followed by Night) and the cards set aside. The cycle checks (a part of its cycle, no campaign card, playable, scored and recorded
// as a standalone run with nothing earned, the loss reasons) are the golden suite's (test/harness/golden-suite.ts).
const rivendell = loadAnyScenario("road-to-rivendell");
const countOf = (code: string, name: string) => Object.values(goldenState(rivendell.id, name).cards).filter((card) => card.code === code).length;
const NIGHTMARE_CARDS = ["901403", "901404", "901405", "901406", "901407", "901408", "901409"];

describe("Road to Rivendell in the dwarrowdelf cycle", () => {
  it("deals its Nightmare deck on Nightmare (every card of it has a record)", () => {
    const state = goldenState(rivendell.id, "Nightmare solo win");
    expect(Object.values(state.cards).some((card) => card.code === rivendell.nightmare?.setupCard && card.zone === "nightmare")).toBe(true);
    for (const code of NIGHTMARE_CARDS) expect(countOf(code, "Nightmare solo win"), code).toBeGreaterThan(0);
    for (const code of NIGHTMARE_CARDS) expect(countOf(code, "solo win"), code).toBe(0);
  });

  it("deals Ambush in the Night in place of Orc Outpost on Nightmare, and Orc Outpost on every other difficulty", () => {
    expect(countOf("901402", "Nightmare solo win")).toBe(1);
    expect(countOf("04039", "Nightmare solo win")).toBe(0);
    for (const name of ["solo win", "Easy solo win"]) {
      expect(countOf("901402", name), name).toBe(0);
      expect(countOf("04039", name), name).toBe(1);
    }
  });

  it("deals Arwen into play and Goblin Gate once on every difficulty, and the plain three stages ending on Approaching Rivendell", () => {
    for (const name of ["solo win", "Easy solo win", "Nightmare solo win"]) {
      const state = goldenState(rivendell.id, name);
      const ended = state.cards[state.questStage ?? ""]?.code === "04040" ? "04040" : state.cards[state.stageLeft?.from ?? ""]?.code;
      expect(ended, name).toBe("04040");
      expect(countOf("04041", name), `${name} Arwen`).toBe(1);
      expect(countOf("04043", name), `${name} Goblin Gate`).toBe(1);
      expect(countOf("04038", name), `${name} 04038`).toBe(1);
      expect(countOf("04040", name), `${name} 04040`).toBe(1);
    }
  });

  it("leaves out Sleeping Sentry and Orc Ambush and deals 1 Followed by Night on Easy", () => {
    expect(countOf("04046", "Easy solo win")).toBe(0);
    expect(countOf("04048", "Easy solo win")).toBe(0);
    expect(countOf("04047", "Easy solo win")).toBe(1);
    expect(countOf("04046", "solo win")).toBe(2);
    expect(countOf("04048", "solo win")).toBe(2);
    expect(countOf("04047", "solo win")).toBe(3);
  });

  it("takes Ruined Road and Barren Hills out of the Nightmare deck", () => {
    expect(countOf("04042", "Nightmare solo win")).toBe(0);
    expect(countOf("04045", "Nightmare solo win")).toBe(0);
    expect(countOf("04042", "solo win")).toBe(2);
    expect(countOf("04045", "solo win")).toBe(2);
  });
});
