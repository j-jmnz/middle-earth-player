// Rules: rr.setup, rr.winning-the-game, rr.quest-advancement, rr.removed-from-game, ats.setup-the-siege-of-cair-andros, ats.cair-andros-remove-stage, ats.cair-andros-location-damage (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import { loadAnyScenario } from "../../../../scripts/data/load-scenarios.ts";
import { goldenState } from "../../../../test/harness/golden-state.ts";

// What is The Siege of Cair Andros's own in the standalone game: the Normal and Easy counts of every card, the five stages, the three Battleground locations the Setup places in the staging area, and the stages and locations the paths of the goldens
// leave behind (a stage whose Battleground location was explored is set aside and never played; a location that took its total of damage is removed from the game). The cycle checks (a part of its cycle, no campaign card, playable, scored and
// recorded as a standalone run with nothing earned, the loss reasons) are the golden suite's (test/harness/golden-suite.ts, standalone: true). The scenario has no Nightmare deck.
const andros = loadAnyScenario("the-siege-of-cair-andros");
const NORMAL = "solo win, all five stages";
const EASY = "Easy solo win, all three locations explored";
const CITADEL_EXPLORED = "solo win, Citadel explored";
const BANKS_DESTROYED = "two-handed win, Banks destroyed";
const countOf = (code: string, name: string) => Object.values(goldenState(andros.id, name).cards).filter((card) => card.code === code).length;
const zoneOf = (code: string, name: string) => Object.values(goldenState(andros.id, name).cards).find((card) => card.code === code)?.zone;

describe("The Siege of Cair Andros in the against-the-shadow cycle", () => {
  it("deals every card of the scenario in its Normal or Easy count", () => {
    for (const card of andros.cards) {
      expect(countOf(card.code, NORMAL), `${card.code} Normal`).toBe(card.normal);
      expect(countOf(card.code, EASY), `${card.code} Easy`).toBe(card.easy);
    }
  });

  it("leaves out or thins the cards that Easy changes (Orc Scramblers 3 to 2, Battering Ram 3 to 2, Siege Raft 2 to 1)", () => {
    expect(["05030", "05031", "05032"].map((code) => countOf(code, NORMAL))).toEqual([3, 3, 2]);
    expect(["05030", "05031", "05032"].map((code) => countOf(code, EASY))).toEqual([2, 2, 1]);
  });

  it("deals the five stages and the three Battleground locations once, on both difficulties", () => {
    for (const name of [NORMAL, EASY]) for (const code of ["05072", "05073", "05074", "05075", "05076", "05033", "05034", "05035"]) expect(countOf(code, name), `${name} ${code}`).toBe(1);
  });

  it("plays all five stages and keeps the three locations out of the victory display when the players never travel", () => {
    // Every stage left the quest deck by being defeated, so none is set aside by a Response: the Setup's three locations stay in play (staging area) or were removed by damage.
    for (const code of ["05033", "05034", "05035"]) expect(["staging", "removed"], code).toContain(zoneOf(code, NORMAL));
    expect(goldenState(andros.id, NORMAL).victory).toEqual([]);
  });

  it("sets stage 4 aside without playing it once The Citadel is explored, and keeps The Citadel in the victory display", () => {
    const state = goldenState(andros.id, CITADEL_EXPLORED);
    expect(zoneOf("05075", CITADEL_EXPLORED)).toBe("setAside");
    expect(state.victory.map((id) => state.cards[id]?.code)).toContain("05033");
    expect(zoneOf("05033", CITADEL_EXPLORED)).toBe("victory");
  });

  it("removes a Battleground location from the game at its total of damage: no victory points, no stage set aside by it", () => {
    const state = goldenState(andros.id, BANKS_DESTROYED);
    expect(zoneOf("05035", BANKS_DESTROYED)).toBe("removed");
    expect(state.victory.map((id) => state.cards[id]?.code)).not.toContain("05035");
    const banks = Object.values(state.cards).find((card) => card.code === "05035");
    expect(banks).toMatchObject({ damage: 0, progress: 0 });
  });
});
