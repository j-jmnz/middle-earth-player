// Rules: hob.bilbo-baggins-ohauh, hob.sack-deck, rr.winning-the-game (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import { loadAnyScenario } from "../../../../scripts/data/load-scenarios.ts";
import { goldenState } from "../../../../test/harness/golden-state.ts";

// What is We Must Away, Ere Break of Day's own in the standalone game: Bilbo Baggins, dealt by the loadout to the first seat, and the end of the game, where Dawn Take You All removes every Troll and Sack card. The cycle checks (a part of its cycle, no campaign card, playable, scored and recorded as a standalone run with
// nothing earned, the loss reasons) are the golden suite's (test/harness/golden-suite.ts, standalone: true). The scenario has no Nightmare deck to deal.
const day = loadAnyScenario("we-must-away-ere-break-of-day");

describe("We Must Away, Ere Break of Day in the the-hobbit cycle", () => {
  it("has no Nightmare deck, and a win ends at Dawn Take You All with Bilbo Baggins still a hero of the first seat", () => {
    expect(day.nightmare).toBeUndefined();
    const state = goldenState(day.id, "two-handed win, the Trolls are fought and the Sack cards are drawn");
    expect(state.cards[state.questStage ?? ""]?.code).toBe("131025");
    const bilbo = Object.values(state.cards).filter((card) => card.code === "131001");
    expect(bilbo.map((card) => [card.zone, card.controller])).toEqual([["heroes", state.firstPlayer]]);
  });
});
