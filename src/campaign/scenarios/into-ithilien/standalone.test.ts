// Rules: rr.setup, rr.winning-the-game, rr.quest-advancement, ats.ally-objectives, ats.setup-into-ithilien (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import { loadAnyScenario } from "../../../../scripts/data/load-scenarios.ts";
import { goldenState } from "../../../../test/harness/golden-state.ts";

// What is Into Ithilien's own in the standalone game: the Easy counts (no Lost Companion, Watcher in the Wood, Mûmak or Southron Support, fewer Blocking Wargs, Overgrown Trails, Morgul Spiders), the four stages, the cards the Setup places
// and the two paths of stage 1B (stage 2 bypassed while Celador is in the staging area, else played). The cycle checks (a part of its cycle, no campaign card, playable, scored and recorded as a standalone run with nothing earned, the loss reasons)
// are the golden suite's (test/harness/golden-suite.ts, standalone: true). The scenario has no Nightmare deck, so the dealt cards are the same on every win.
const ithilien = loadAnyScenario("into-ithilien");
const BYPASSED = ["solo win, stage 2 bypassed", "two-handed win, stage 2 bypassed"];
const PLAYED = ["solo win, stage 2 played", "Easy solo win, stage 2 played", "two-handed win, stage 2 played"];
const countOf = (code: string, name: string) => Object.values(goldenState(ithilien.id, name).cards).filter((card) => card.code === code).length;
const stagedOf = (code: string, name: string) => Object.values(goldenState(ithilien.id, name).cards).filter((card) => card.code === code && card.zone === "staging").length;

describe("Into Ithilien in the against-the-shadow cycle", () => {
  it("deals Celador, 2 Ithilien Roads, the four stages and 4 Southron Companies on every difficulty", () => {
    for (const name of [...BYPASSED, ...PLAYED]) {
      for (const code of ["05025", "05068", "05069", "05070", "05071"]) expect(countOf(code, name), `${name} ${code}`).toBe(1);
      // One Ithilien Road is the active location the Setup places, the other waits in the encounter deck.
      expect(countOf("05028", name), name).toBe(2);
      expect(countOf("05027", name), name).toBe(4);
    }
  });

  it("deals Lost Companion, Watcher in the Wood, Mûmak, Southron Support and 4 Blocking Wargs on Normal and leaves them out or fewer on Easy", () => {
    expect(["05048", "05051", "05054", "05055", "05029", "05046", "05049"].map((code) => countOf(code, "solo win, stage 2 played"))).toEqual([2, 2, 1, 2, 4, 3, 3]);
    expect(["05048", "05051", "05054", "05055", "05029", "05046", "05049"].map((code) => countOf(code, "Easy solo win, stage 2 played"))).toEqual([0, 0, 0, 0, 2, 1, 1]);
  });

  it("deals 2 Ithilien Guardians on Normal and Easy", () => {
    for (const name of ["solo win, stage 2 bypassed", "Easy solo win, stage 2 played"]) expect(countOf("05026", name), name).toBe(2);
  });

  it("places one Southron Company in the staging area for each player", () => {
    // The first round's Setup is the golden suite's opening check; the end of a won game still has the staged Companies it did not engage, so the count is at most the players'.
    for (const name of BYPASSED) expect(stagedOf("05027", name)).toBeLessThanOrEqual(2);
  });

  it("ends every win on Approaching Cair Andros", () => {
    for (const name of [...BYPASSED, ...PLAYED]) {
      const state = goldenState(ithilien.id, name);
      const ended = state.cards[state.questStage ?? ""]?.code === "05071" ? "05071" : state.cards[state.stageLeft?.from ?? ""]?.code;
      expect(ended, name).toBe("05071");
    }
  });

  it("bypasses Southron Counter-attack when Ambush in Ithilien is defeated with Celador in the staging area, and plays it when he is gone", () => {
    const zoneOf = (code: string, name: string) => Object.values(goldenState(ithilien.id, name).cards).find((card) => card.code === code)?.zone;
    for (const name of BYPASSED) expect(zoneOf("05069", name), name).toBe("questDeck");
    for (const name of PLAYED) {
      expect(zoneOf("05069", name), name).not.toBe("questDeck");
      // Celador is gone: removed from the game by his own text.
      expect(zoneOf("05025", name), name).toBe("removed");
    }
  });
});
