import { describe, expect, it } from "vitest";

import { stagingThreat } from "../../quest/quest.ts";
import { runInstruction } from "../../interpret/interpret.ts";
import { spawn } from "../../core/zones.ts";
import { ally, hero, table } from "../defense/table.ts";

// Rules: faq.lasting-effects, rr.lasting-effects (data/rules/entries.json); ledger line 145060:A:2.
// RaiseStagingThreat `live: "alliesInDiscard"`: an encounter card's lasting effect is recalculated as the game changes, so an ally that reaches the discard pile later in the phase counts too.

const focus = { seat: 0, sourceId: null };

describe("145060:A:2 (RaiseStagingThreat live)", () => {
  it("counts the allies in the actor's discard pile at each reading until the effect ends, not once when it resolved", () => {
    const built = table({ seatCount: 2, effects: [], heroes: [{ code: "h" }, { code: "g", seat: 1 }], cards: [hero("h"), hero("g"), ally("a1", { cost: 2 })] });
    let state = runInstruction(built.state, { verb: "RaiseStagingThreat", amount: 1, until: "endOfPhase", live: "alliesInDiscard" }, focus, built.ctx, []);
    expect(stagingThreat(state, built.ctx.cards)).toBe(0);
    state = spawn(state, "a1", { zone: "discard", seat: 0 }).state;
    expect(stagingThreat(state, built.ctx.cards)).toBe(1);
    state = spawn(state, "a1", { zone: "discard", seat: 0 }).state;
    expect(stagingThreat(state, built.ctx.cards)).toBe(2);
  });

  it("leaves another player's discard pile out", () => {
    const built = table({ seatCount: 2, effects: [], heroes: [{ code: "h" }, { code: "g", seat: 1 }], cards: [hero("h"), hero("g"), ally("a1", { cost: 2 })] });
    let state = runInstruction(built.state, { verb: "RaiseStagingThreat", amount: 1, until: "endOfPhase", live: "alliesInDiscard" }, focus, built.ctx, []);
    state = spawn(state, "a1", { zone: "discard", seat: 1 }).state;
    expect(stagingThreat(state, built.ctx.cards)).toBe(0);
  });
});
