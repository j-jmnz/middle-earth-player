// Rules: rr.effects (data/rules/entries.json); ledger line 148012:A:1.
// The flag noCardDraw (deck family): a seat held by it draws no card from an effect, and the resource phase's draw is not an effect.
import { describe, expect, it } from "vitest";

import { flagged } from "../../core/state.ts";
import { runInstruction } from "../../interpret/interpret.ts";
import { focus, fogTable as table } from "../../../../test/scenarios/fog-on-the-barrow-downs/scene.ts";

describe("noCardDraw (148012:A:1)", () => {
  it("148012:A:1 noCardDraw bars a card effect's draw and not the resource phase's", () => {
    const t = table({ seats: 1, deckOf: ["ally", "ally"] });
    const hold = { ...t.state, modifiers: [{ instanceId: "seat:0", sourceId: "x", stat: "noCardDraw" as const, amount: 1, until: "endOfRound" as const }] };
    const drawn = runInstruction(hold, { verb: "Draw", amount: 1 }, focus(0, null), t.ctx, []);
    expect(drawn.seats[0].hand).toHaveLength(0);
    expect(flagged(hold, "seat:0", "noCardDraw")).toBe(true);
  });
});
