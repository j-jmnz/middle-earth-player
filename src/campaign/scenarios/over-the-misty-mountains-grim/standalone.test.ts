// Rules: hob.bilbo-baggins-ohauh (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import { grimStart, grimWorld } from "../../../../test/scenarios/over-the-misty-mountains-grim/game.ts";
import { startScenario } from "../../../rules/engine/reduce.ts";

// What is Over the Misty Mountains Grim's own in the standalone game. The cycle checks (a part of its cycle, no campaign card, playable, scored and recorded as a standalone run with nothing earned, the loss reasons) are the golden suite's
// (test/harness/golden-suite.ts, standalone: true). Nightmare is not part of this scenario's engine half.
describe("Over the Misty Mountains Grim in the the-hobbit cycle", () => {
  it("is dealt with Bilbo Baggins in front of the first seat only (the golden suite checks the decks the Setup leaves)", async () => {
    const { ctx } = await grimWorld("strong");
    const state = startScenario(grimStart(2, 1, "Normal"), ctx);
    const heroes = (seat: number) => state.seats[seat]?.heroes.map((id) => state.cards[id]?.code);
    expect(heroes(0)?.[0]).toBe("131001");
    expect(heroes(1)).not.toContain("131001");
  });
});
